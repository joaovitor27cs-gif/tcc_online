from datetime import date, timedelta
from functools import wraps
import math
import os
import json
import re
import secrets
import sqlite3
import urllib.error
import urllib.request

from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash
import banco

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

PASTA_FRONTEND = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
app = Flask(__name__, static_folder=PASTA_FRONTEND, static_url_path="")
CORS(app)

banco.criar_tabelas()


@app.route("/")
def pagina_inicial():
    return send_from_directory(app.static_folder, "index.html")


def empresa_autenticada(funcao):
    @wraps(funcao)
    def wrapper(*args, **kwargs):
        cabecalho = request.headers.get("Authorization", "")
        esquema, _, token = cabecalho.partition(" ")
        empresa = banco.buscar_empresa_por_token(token) if esquema.lower() == "bearer" and token else None
        if not empresa:
            return jsonify({"erro": "Sessão empresarial inválida."}), 401
        request.empresa = empresa
        return funcao(*args, **kwargs)
    return wrapper


def pessoa_autenticada(funcao):
    @wraps(funcao)
    def wrapper(*args, **kwargs):
        esquema, _, token = request.headers.get("Authorization", "").partition(" ")
        pessoa = banco.buscar_pessoa_por_token(token) if esquema.lower() == "bearer" and token else None
        if not pessoa:
            return jsonify({"erro": "Sessão pessoal inválida. Entre novamente."}), 401
        request.pessoa = pessoa
        return funcao(*args, **kwargs)
    return wrapper


def validar_lancamento(dados, inclui_categoria=False, inclui_origem=False):
    if not isinstance(dados, dict):
        return "Envie os dados do lançamento em formato JSON."
    descricao = dados.get("descricao")
    data_vencimento = dados.get("vencimento")
    status = dados.get("status", "Pendente")
    try:
        valor = float(dados.get("valor"))
    except (TypeError, ValueError):
        return "Informe um valor numérico válido."
    if not isinstance(descricao, str) or not descricao.strip():
        return "A descrição é obrigatória."
    if not math.isfinite(valor) or valor <= 0:
        return "O valor deve ser maior que zero."
    if not isinstance(data_vencimento, str):
        return "Informe uma data de vencimento válida."
    try:
        date.fromisoformat(data_vencimento)
    except ValueError:
        return "Informe uma data de vencimento válida."
    if status not in ("Pago", "Pendente"):
        return "O status deve ser Pago ou Pendente."
    if inclui_categoria:
        try:
            categoria_id = int(dados.get("categoria_id"))
        except (TypeError, ValueError):
            return "Selecione uma categoria válida."
        if not any(categoria["id"] == categoria_id for categoria in banco.buscar_categorias()):
            return "A categoria selecionada não existe."
    if inclui_origem:
        origem = dados.get("origem")
        if not isinstance(origem, str) or not origem.strip():
            return "Informe a origem do recebimento."
    return None


@app.route('/api/empresarial/cadastro', methods=['POST'])
def cadastrar_empresa():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify({"erro": "Envie os dados de cadastro em formato JSON."}), 400

    nome = dados.get("nome", "").strip() if isinstance(dados.get("nome"), str) else ""
    email = dados.get("email", "").strip().lower() if isinstance(dados.get("email"), str) else ""
    senha = dados.get("senha", "")
    if not nome:
        return jsonify({"erro": "Informe o nome da empresa."}), 400
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return jsonify({"erro": "Informe um e-mail válido."}), 400
    if not isinstance(senha, str) or len(senha) < 8:
        return jsonify({"erro": "A senha deve ter pelo menos 8 caracteres."}), 400

    try:
        empresa_id = banco.criar_empresa(nome, None, email, generate_password_hash(senha))
    except sqlite3.IntegrityError as erro:
        if "UNIQUE constraint failed" in str(erro):
            return jsonify({"erro": "Já existe uma empresa cadastrada com esse CNPJ ou e-mail."}), 409
        raise
    return jsonify({"sucesso": True, "id": empresa_id, "mensagem": "Empresa cadastrada com sucesso."}), 201


@app.route('/api/empresarial/login', methods=['POST'])
def login_empresarial():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify({"erro": "Envie e-mail e senha em formato JSON."}), 400
    email = dados.get("email", "").strip().lower() if isinstance(dados.get("email"), str) else ""
    senha = dados.get("senha", "")
    empresa = banco.buscar_empresa_por_email(email)
    if not empresa or not isinstance(senha, str) or not check_password_hash(empresa["senha_hash"], senha):
        return jsonify({"erro": "E-mail ou senha incorretos."}), 401

    token = secrets.token_urlsafe(32)
    banco.criar_sessao_empresarial(token, empresa["id"])
    return jsonify({
        "token": token,
        "empresa": {
            "id": empresa["id"],
            "nome": empresa["nome"],
            "cnpj": empresa["cnpj"],
            "email": empresa["email"]
        }
    }), 200


@app.route('/api/empresarial/logout', methods=['POST'])
@empresa_autenticada
def logout_empresarial():
    _, _, token = request.headers.get("Authorization", "").partition(" ")
    banco.excluir_sessao_empresarial(token)
    return jsonify({"sucesso": True}), 200


@app.route('/api/empresarial/me', methods=['GET'])
@empresa_autenticada
def perfil_empresarial():
    return jsonify(request.empresa), 200


@app.route('/api/empresarial/despesas', methods=['GET', 'POST'])
@empresa_autenticada
def despesas_empresariais():
    empresa_id = request.empresa["id"]
    if request.method == "GET":
        return jsonify(banco.buscar_despesas(empresa_id)), 200

    dados = request.get_json(silent=True)
    erro = validar_lancamento(dados, inclui_categoria=True)
    if erro:
        return jsonify({"erro": erro}), 400
    id_criado = banco.inserir_despesa(
        dados["descricao"].strip(),
        int(dados["categoria_id"]),
        float(dados["valor"]),
        dados["vencimento"],
        dados.get("status", "Pendente"),
        empresa_id
    )
    return jsonify({"sucesso": True, "id": id_criado}), 201


@app.route('/api/empresarial/despesas/<int:id>', methods=['GET', 'PUT', 'DELETE'])
@empresa_autenticada
def despesa_empresarial(id):
    empresa_id = request.empresa["id"]
    if request.method == "GET":
        despesa = banco.buscar_despesa(id, empresa_id)
        if not despesa:
            return jsonify({"erro": "Despesa não encontrada."}), 404
        return jsonify(despesa), 200
    if request.method == "DELETE":
        if banco.excluir_despesa(id, empresa_id):
            return jsonify({"sucesso": True}), 200
        return jsonify({"erro": "Despesa não encontrada."}), 404

    dados = request.get_json(silent=True)
    erro = validar_lancamento(dados, inclui_categoria=True)
    if erro:
        return jsonify({"erro": erro}), 400
    linhas = banco.atualizar_despesa(
        id,
        dados["descricao"].strip(),
        int(dados["categoria_id"]),
        float(dados["valor"]),
        dados["vencimento"],
        dados.get("status", "Pendente"),
        empresa_id
    )
    if linhas or banco.buscar_despesa(id, empresa_id):
        return jsonify({"sucesso": True}), 200
    return jsonify({"erro": "Despesa não encontrada."}), 404


@app.route('/api/empresarial/recebimentos', methods=['GET', 'POST'])
@empresa_autenticada
def recebimentos_empresariais():
    empresa_id = request.empresa["id"]
    if request.method == "GET":
        return jsonify(banco.listar_recebimentos(empresa_id)), 200

    dados = request.get_json(silent=True)
    erro = validar_lancamento(dados, inclui_origem=True)
    if erro:
        return jsonify({"erro": erro}), 400
    id_criado = banco.inserir_recebimento(
        empresa_id,
        dados["descricao"].strip(),
        dados["origem"].strip(),
        float(dados["valor"]),
        dados["vencimento"],
        dados.get("status", "Pendente")
    )
    return jsonify({"sucesso": True, "id": id_criado}), 201


@app.route('/api/empresarial/recebimentos/<int:id>', methods=['GET', 'PUT', 'DELETE'])
@empresa_autenticada
def recebimento_empresarial(id):
    empresa_id = request.empresa["id"]
    if request.method == "GET":
        recebimento = banco.buscar_recebimento(id, empresa_id)
        if not recebimento:
            return jsonify({"erro": "Recebimento não encontrado."}), 404
        return jsonify(recebimento), 200
    if request.method == "DELETE":
        if banco.excluir_recebimento(id, empresa_id):
            return jsonify({"sucesso": True}), 200
        return jsonify({"erro": "Recebimento não encontrado."}), 404

    dados = request.get_json(silent=True)
    erro = validar_lancamento(dados, inclui_origem=True)
    if erro:
        return jsonify({"erro": erro}), 400
    linhas = banco.atualizar_recebimento(
        id,
        empresa_id,
        dados["descricao"].strip(),
        dados["origem"].strip(),
        float(dados["valor"]),
        dados["vencimento"],
        dados.get("status", "Pendente")
    )
    if linhas or banco.buscar_recebimento(id, empresa_id):
        return jsonify({"sucesso": True}), 200
    return jsonify({"erro": "Recebimento não encontrado."}), 404


@app.route('/api/empresarial/resumo', methods=['GET'])
@empresa_autenticada
def resumo_empresarial():
    return jsonify(banco.resumo_empresarial(request.empresa["id"])), 200


@app.route('/api/empresarial/notificacoes', methods=['GET'])
@empresa_autenticada
def notificacoes_empresariais():
    data_limite = (date.today() + timedelta(days=7)).isoformat()
    return jsonify(banco.notificacoes_empresariais(request.empresa["id"], data_limite)), 200



# ==========================================================
# ASSISTENTE GEMINI (compartilhado entre os dois perfis)
# ==========================================================
def chamar_gemini(pergunta, perfil, resumo, despesas, recebimentos=None):
    """Envia ao Gemini somente o contexto financeiro do usuário autenticado."""
    contexto = {
        "perfil": perfil,
        "resumo_financeiro": resumo,
        "despesas": despesas[:100],
        "recebimentos": (recebimentos or [])[:100],
    }
    instrucoes = (
        "Você é o Assistente Financeiro do Cashflip. Responda em português do Brasil, "
        "com clareza e sem inventar números. Use apenas o contexto financeiro fornecido. "
        "Se faltarem dados, diga isso. Dê sugestões educativas, não prometa resultados "
        "financeiros. Nunca solicite senhas, tokens ou dados bancários. Não altere registros."
    )
    chave_api = os.environ.get("GEMINI_API_KEY", "").strip()
    modelo = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
    if not chave_api:
        return None, (
            "Configure GEMINI_API_KEY em backend/.env (copie backend/.env.example) "
            "ou no ambiente do backend.",
            503
        )
    if not modelo:
        return None, ("A variável GEMINI_MODEL não pode ficar vazia.", 503)

    payload = {
        "systemInstruction": {"parts": [{"text": instrucoes}]},
        "contents": [{
            "role": "user",
            "parts": [{
                "text": "Contexto financeiro em JSON:\n"
                + json.dumps(contexto, ensure_ascii=False)
                + "\n\nPergunta do usuário:\n"
                + pergunta
            }]
        }],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 800}
    }
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": chave_api},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resposta:
            dados = json.loads(resposta.read().decode("utf-8"))
        candidatos = dados.get("candidates", []) if isinstance(dados, dict) else []
        candidato = candidatos[0] if isinstance(candidatos, list) and candidatos else {}
        conteudo = candidato.get("content", {}) if isinstance(candidato, dict) else {}
        partes = conteudo.get("parts", []) if isinstance(conteudo, dict) else []
        if not isinstance(partes, list):
            partes = []
        texto = "\n".join(
            parte["text"] for parte in partes
            if isinstance(parte, dict) and isinstance(parte.get("text"), str)
        )
        if not isinstance(texto, str) or not texto.strip():
            return None, ("O Gemini não retornou uma resposta de texto. Tente novamente.", 502)
        return texto.strip(), None
    except urllib.error.HTTPError as erro:
        detalhe = erro.read().decode("utf-8", errors="replace")
        print(f"Erro Gemini HTTP {erro.code}: {detalhe[:1000]}")
        if erro.code in (400, 403):
            return None, ("O Gemini recusou a solicitação. Verifique a chave de API e o modelo configurados.", 502)
        if erro.code == 404:
            return None, (f"O modelo Gemini '{modelo}' não foi encontrado. Confira a variável GEMINI_MODEL.", 503)
        if erro.code == 429:
            return None, ("O limite de solicitações do Gemini foi atingido. Tente novamente mais tarde.", 503)
        if erro.code in (500, 502, 503, 504):
            return None, (
                "O Gemini está temporariamente indisponível ou com alta demanda. "
                "Aguarde um pouco e tente novamente.",
                503
            )
        return None, ("O Gemini apresentou um erro ao gerar a resposta. Tente novamente.", 502)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as erro:
        print(f"Falha de comunicação com Gemini: {erro}")
        return None, ("Não foi possível conectar ao Gemini. Verifique sua conexão e tente novamente.", 503)


def validar_pergunta_ia():
    dados = request.get_json(silent=True)
    pergunta = dados.get("pergunta", dados.get("mensagem", "")) if isinstance(dados, dict) else ""
    if not isinstance(pergunta, str) or not pergunta.strip():
        return None, (jsonify({"erro": "Digite uma pergunta para o assistente."}), 400)
    if len(pergunta.strip()) > 2000:
        return None, (jsonify({"erro": "A pergunta deve ter no máximo 2000 caracteres."}), 400)
    return pergunta.strip(), None


# Rotas Ollama antigas mantidas como aliases para clientes já existentes.
@app.route('/api/assistente/ollama', methods=['POST'])
@app.route('/api/assistente/gemini', methods=['POST'])
@empresa_autenticada
def assistente_gemini_empresarial():
    pergunta, erro = validar_pergunta_ia()
    if erro:
        return erro
    empresa_id = request.empresa["id"]
    despesas = banco.buscar_despesas(empresa_id)
    recebimentos = banco.listar_recebimentos(empresa_id)
    resumo = banco.resumo_empresarial(empresa_id)
    resposta, falha = chamar_gemini(pergunta, "empresarial", resumo, despesas, recebimentos)
    if falha:
        return jsonify({"erro": falha[0]}), falha[1]
    return jsonify({"resposta": resposta}), 200


# ==========================================================
# ÁREA DE PESSOA FÍSICA (dados separados da área empresarial)
# ==========================================================
@app.route('/api/pessoal/cadastro', methods=['POST'])
def cadastrar_pessoa():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify({"erro": "Envie os dados em formato JSON."}), 400
    nome = dados.get("nome", "").strip() if isinstance(dados.get("nome"), str) else ""
    email = dados.get("email", "").strip().lower() if isinstance(dados.get("email"), str) else ""
    senha = dados.get("senha", "")
    if len(nome) < 2:
        return jsonify({"erro": "Informe seu nome completo."}), 400
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return jsonify({"erro": "Informe um e-mail válido."}), 400
    if not isinstance(senha, str) or len(senha) < 8:
        return jsonify({"erro": "A senha deve ter pelo menos 8 caracteres."}), 400
    try:
        pessoa_id = banco.criar_pessoa(nome, email, generate_password_hash(senha))
    except sqlite3.IntegrityError:
        return jsonify({"erro": "Este e-mail já está cadastrado."}), 409
    return jsonify({"sucesso": True, "id": pessoa_id, "mensagem": "Conta pessoal criada. Você já pode entrar."}), 201


@app.route('/api/pessoal/login', methods=['POST'])
def login_pessoal():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify({"erro": "Envie e-mail e senha em formato JSON."}), 400
    email = dados.get("email", "").strip().lower() if isinstance(dados.get("email"), str) else ""
    senha = dados.get("senha", "")
    pessoa = banco.buscar_pessoa_por_email(email)
    if not pessoa or not isinstance(senha, str) or not check_password_hash(pessoa["senha_hash"], senha):
        return jsonify({"erro": "E-mail ou senha incorretos."}), 401
    token = secrets.token_urlsafe(32)
    banco.criar_sessao_pessoal(token, pessoa["id"])
    return jsonify({"token": token, "pessoa": {"id": pessoa["id"], "nome": pessoa["nome"], "email": pessoa["email"]}}), 200


@app.route('/api/pessoal/me', methods=['GET'])
@pessoa_autenticada
def perfil_pessoal():
    return jsonify(request.pessoa), 200


@app.route('/api/pessoal/logout', methods=['POST'])
@pessoa_autenticada
def logout_pessoal():
    _, _, token = request.headers.get("Authorization", "").partition(" ")
    banco.excluir_sessao_pessoal(token)
    return jsonify({"sucesso": True}), 200


@app.route('/api/pessoal/despesas', methods=['GET', 'POST'])
@pessoa_autenticada
def despesas_pessoais():
    pessoa_id = request.pessoa["id"]
    if request.method == "GET":
        return jsonify(banco.buscar_despesas_pessoais(pessoa_id)), 200
    dados = request.get_json(silent=True)
    erro = validar_lancamento(dados, inclui_categoria=True)
    if erro:
        return jsonify({"erro": erro}), 400
    novo_id = banco.inserir_despesa_pessoal(pessoa_id, dados["descricao"].strip(), int(dados["categoria_id"]), float(dados["valor"]), dados["vencimento"], dados.get("status", "Pendente"))
    return jsonify({"sucesso": True, "id": novo_id}), 201


@app.route('/api/pessoal/despesas/<int:id>', methods=['PUT', 'DELETE'])
@pessoa_autenticada
def despesa_pessoal(id):
    pessoa_id = request.pessoa["id"]
    if request.method == "DELETE":
        if banco.excluir_despesa_pessoal(id, pessoa_id): return jsonify({"sucesso": True}), 200
        return jsonify({"erro": "Despesa não encontrada."}), 404
    dados = request.get_json(silent=True)
    erro = validar_lancamento(dados, inclui_categoria=True)
    if erro: return jsonify({"erro": erro}), 400
    if banco.atualizar_despesa_pessoal(id, pessoa_id, dados["descricao"].strip(), int(dados["categoria_id"]), float(dados["valor"]), dados["vencimento"], dados.get("status", "Pendente")):
        return jsonify({"sucesso": True}), 200
    return jsonify({"erro": "Despesa não encontrada."}), 404


@app.route('/api/pessoal/recebimentos', methods=['GET', 'POST'])
@pessoa_autenticada
def recebimentos_pessoais():
    pessoa_id = request.pessoa["id"]
    if request.method == "GET": return jsonify(banco.buscar_recebimentos_pessoais(pessoa_id)), 200
    dados = request.get_json(silent=True)
    erro = validar_lancamento(dados, inclui_origem=True)
    if erro: return jsonify({"erro": erro}), 400
    novo_id = banco.inserir_recebimento_pessoal(pessoa_id, dados["descricao"].strip(), dados["origem"].strip(), float(dados["valor"]), dados["vencimento"], dados.get("status", "Pendente"))
    return jsonify({"sucesso": True, "id": novo_id}), 201


@app.route('/api/pessoal/recebimentos/<int:id>', methods=['PUT', 'DELETE'])
@pessoa_autenticada
def recebimento_pessoal(id):
    pessoa_id = request.pessoa["id"]
    if request.method == "DELETE":
        if banco.excluir_recebimento_pessoal(id, pessoa_id): return jsonify({"sucesso": True}), 200
        return jsonify({"erro": "Recebimento não encontrado."}), 404
    dados = request.get_json(silent=True)
    erro = validar_lancamento(dados, inclui_origem=True)
    if erro: return jsonify({"erro": erro}), 400
    if banco.atualizar_recebimento_pessoal(id, pessoa_id, dados["descricao"].strip(), dados["origem"].strip(), float(dados["valor"]), dados["vencimento"], dados.get("status", "Pendente")):
        return jsonify({"sucesso": True}), 200
    return jsonify({"erro": "Recebimento não encontrado."}), 404


@app.route('/api/pessoal/resumo', methods=['GET'])
@pessoa_autenticada
def resumo_pessoal():
    return jsonify(banco.resumo_pessoal(request.pessoa["id"])), 200


@app.route('/api/pessoal/notificacoes', methods=['GET'])
@pessoa_autenticada
def notificacoes_pessoais():
    data_limite = (date.today() + timedelta(days=7)).isoformat()
    return jsonify(banco.notificacoes_pessoais(request.pessoa["id"], data_limite)), 200


# Rotas Ollama antigas mantidas como aliases para clientes já existentes.
@app.route('/api/pessoal/assistente/ollama', methods=['POST'])
@app.route('/api/pessoal/assistente/gemini', methods=['POST'])
@pessoa_autenticada
def assistente_gemini_pessoal():
    pergunta, erro = validar_pergunta_ia()
    if erro:
        return erro
    pessoa_id = request.pessoa["id"]
    despesas = banco.buscar_despesas_pessoais(pessoa_id)
    recebimentos = banco.buscar_recebimentos_pessoais(pessoa_id)
    resumo = banco.resumo_pessoal(pessoa_id)
    resposta, falha = chamar_gemini(pergunta, "pessoal", resumo, despesas, recebimentos)
    if falha:
        return jsonify({"erro": falha[0]}), falha[1]
    return jsonify({"resposta": resposta}), 200


@app.route('/api/categorias', methods=['GET'])
def listar_categorias():
    """Retorna todas as categorias cadastradas ordenadas por nome."""
    categorias = banco.buscar_categorias()
    return jsonify(categorias), 200

@app.route('/api/despesas', methods=['GET'])
def listar_despesas():
    despesas = banco.buscar_despesas()
    return jsonify(despesas), 200

@app.route('/api/despesas', methods=['POST'])
def criar_despesa():
    dados = request.json
    try:
        id_criado = banco.inserir_despesa(
            descricao=dados.get('descricao'),
            categoria_id=dados.get('categoria_id'),
            valor=dados.get('valor'),
            vencimento=dados.get('vencimento'),
            status=dados.get('status', 'Pendente')
        )
        return jsonify({"sucesso": True, "id": id_criado, "mensagem": "Despesa cadastrada com sucesso!"}), 201
    except Exception as e:
        return jsonify({"sucesso": False, "erro": str(e)}), 400

@app.route('/api/despesas/<int:id>', methods=['GET'])
def obter_despesa(id):
    despesa = banco.buscar_despesa(id)
    if despesa:
        return jsonify(despesa), 200
    return jsonify({"sucesso": False, "mensagem": "Despesa não encontrada."}), 404

@app.route('/api/despesas/<int:id>', methods=['PUT'])
def alterar_despesa(id):
    dados = request.json
    linhas = banco.atualizar_despesa(
        id=id,
        descricao=dados.get('descricao'),
        categoria_id=dados.get('categoria_id'),
        valor=dados.get('valor'),
        vencimento=dados.get('vencimento'),
        status=dados.get('status')
    )
    
    if linhas > 0:
        return jsonify({"sucesso": True, "mensagem": "Despesa atualizada com sucesso!"}), 200
    if banco.buscar_despesa(id):
        return jsonify({"sucesso": True, "mensagem": "Despesa atualizada com sucesso!"}), 200
    return jsonify({"sucesso": False, "mensagem": "Despesa não encontrada ou sem alterações."}), 404

@app.route('/api/despesas/<int:id>', methods=['DELETE'])
def deletar_despesa(id):
    linhas = banco.excluir_despesa(id)
    if linhas > 0:
        return jsonify({"sucesso": True, "mensagem": "Despesa excluída com sucesso!"}), 200
    return jsonify({"sucesso": False, "mensagem": "Despesa não encontrada."}), 404


@app.route('/api/resumo/totais', methods=['GET'])
def resumo_totais():
    return jsonify({
        "total_geral": banco.total_despesas(),
        "total_pago": banco.total_pago(),
        "total_pendente": banco.total_pendente()
    }), 200


@app.route('/api/resumo/por-categoria', methods=['GET'])
def resumo_por_categoria():
    resultado = banco.despesas_por_categoria()
    return jsonify(resultado), 200

@app.route('/api/resumo/evolucao', methods=['GET'])
def resumo_evolucao():
    resultado = banco.evolucao_mensal()
    return jsonify(resultado), 200

if __name__ == '__main__':
    app.run(host="0.0.0.0", debug=False, port=5000)