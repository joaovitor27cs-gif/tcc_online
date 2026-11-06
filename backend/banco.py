import sqlite3
from pathlib import Path

def conectar():
    conexao = sqlite3.connect(Path(__file__).resolve().parent.parent / "financeiro.db")
    conexao.row_factory = sqlite3.Row
    return conexao


def criar_tabelas():

    conexao = conectar()
    cursor = conexao.cursor()

    

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS empresas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            cnpj TEXT UNIQUE,
            email TEXT NOT NULL UNIQUE,
            senha_hash TEXT NOT NULL
        )
    """)

    colunas_empresa = {
        coluna["name"]: coluna for coluna in cursor.execute("PRAGMA table_info(empresas)")
    }
    if colunas_empresa["cnpj"]["notnull"]:
        cursor.execute("""
            CREATE TABLE empresas_nova (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                cnpj TEXT UNIQUE,
                email TEXT NOT NULL UNIQUE,
                senha_hash TEXT NOT NULL
            )
        """)
        cursor.execute("""
            INSERT INTO empresas_nova (id, nome, cnpj, email, senha_hash)
            SELECT id, nome, cnpj, email, senha_hash FROM empresas
        """)
        cursor.execute("DROP TABLE empresas")
        cursor.execute("ALTER TABLE empresas_nova RENAME TO empresas")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS despesas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao TEXT NOT NULL,
            categoria_id INTEGER NOT NULL,
            valor REAL NOT NULL,
            vencimento TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Pendente',
            empresa_id INTEGER,

            FOREIGN KEY (categoria_id)
            REFERENCES categorias(id),
            FOREIGN KEY (empresa_id)
            REFERENCES empresas(id)
        )
    """)

    colunas_despesas = {
        coluna["name"] for coluna in cursor.execute("PRAGMA table_info(despesas)")
    }
    if "empresa_id" not in colunas_despesas:
        cursor.execute("ALTER TABLE despesas ADD COLUMN empresa_id INTEGER REFERENCES empresas(id)")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessoes_empresariais (
            token TEXT PRIMARY KEY,
            empresa_id INTEGER NOT NULL,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS recebimentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            descricao TEXT NOT NULL,
            origem TEXT NOT NULL,
            valor REAL NOT NULL,
            vencimento TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Pendente',
            FOREIGN KEY (empresa_id) REFERENCES empresas(id)
        )
    """)

    cursor.execute("""CREATE TABLE IF NOT EXISTS pessoas_fisicas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        senha_hash TEXT NOT NULL,
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")
    cursor.execute("""CREATE TABLE IF NOT EXISTS sessoes_pessoais (
        token TEXT PRIMARY KEY,
        pessoa_id INTEGER NOT NULL,
        FOREIGN KEY (pessoa_id) REFERENCES pessoas_fisicas(id) ON DELETE CASCADE
    )""")
    cursor.execute("""CREATE TABLE IF NOT EXISTS despesas_pessoais (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pessoa_id INTEGER NOT NULL,
        descricao TEXT NOT NULL,
        categoria_id INTEGER NOT NULL,
        valor REAL NOT NULL,
        vencimento TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pendente',
        FOREIGN KEY (pessoa_id) REFERENCES pessoas_fisicas(id) ON DELETE CASCADE,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    )""")
    cursor.execute("""CREATE TABLE IF NOT EXISTS recebimentos_pessoais (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pessoa_id INTEGER NOT NULL,
        descricao TEXT NOT NULL,
        origem TEXT NOT NULL,
        valor REAL NOT NULL,
        vencimento TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pendente',
        FOREIGN KEY (pessoa_id) REFERENCES pessoas_fisicas(id) ON DELETE CASCADE
    )""")

    conexao.commit()
    conexao.close()

    inserir_categorias_iniciais()


def inserir_categorias_iniciais():

    conexao = conectar()
    cursor = conexao.cursor()

    categorias = [
        "Alimentação",
        "Moradia",
        "Luz",
        "Água",
        "Internet",
        "Telefone",
        "Transporte",
        "Saúde",
        "Educação",
        "Lazer",
        "Vestuário",
        "Assinaturas",
        "Outros"
    ]

    for categoria in categorias:

        cursor.execute("""
            INSERT OR IGNORE INTO categorias (nome)
            VALUES (?)
        """, (categoria,))

    conexao.commit()
    conexao.close()



def buscar_categorias():

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute("""
        SELECT *
        FROM categorias
        ORDER BY nome
    """)

    categorias = cursor.fetchall()

    conexao.close()

    return [dict(categoria) for categoria in categorias]



def inserir_despesa(
    descricao,
    categoria_id,
    valor,
    vencimento,
    status="Pendente",
    empresa_id=None
):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute("""
        INSERT INTO despesas
        (
            descricao,
            categoria_id,
            valor,
            vencimento,
            status,
            empresa_id
        )
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        descricao,
        categoria_id,
        valor,
        vencimento,
        status,
        empresa_id
    ))

    conexao.commit()

    id_despesa = cursor.lastrowid

    conexao.close()

    return id_despesa


 
def buscar_despesas(empresa_id=None):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute("""
        SELECT
            despesas.id,
            despesas.descricao,
            despesas.categoria_id,
            categorias.nome AS categoria,
            despesas.valor,
            despesas.vencimento,
            despesas.status

        FROM despesas

        INNER JOIN categorias
            ON despesas.categoria_id = categorias.id

        WHERE despesas.empresa_id IS ?

        ORDER BY despesas.vencimento
    """, (empresa_id,))

    despesas = cursor.fetchall()

    conexao.close()

    return [dict(despesa) for despesa in despesas]



def buscar_despesa(id, empresa_id=None):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute("""
        SELECT
            despesas.id,
            despesas.descricao,
            despesas.categoria_id,
            categorias.nome AS categoria,
            despesas.valor,
            despesas.vencimento,
            despesas.status

        FROM despesas

        INNER JOIN categorias
            ON despesas.categoria_id = categorias.id

        WHERE despesas.id = ? AND despesas.empresa_id IS ?
    """, (id, empresa_id))

    despesa = cursor.fetchone()

    conexao.close()

    if despesa:
        return dict(despesa)

    return None


def atualizar_despesa(
    id,
    descricao,
    categoria_id,
    valor,
    vencimento,
    status,
    empresa_id=None
):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute("""
        UPDATE despesas

        SET
            descricao = ?,
            categoria_id = ?,
            valor = ?,
            vencimento = ?,
            status = ?

        WHERE id = ? AND empresa_id IS ?
    """, (
        descricao,
        categoria_id,
        valor,
        vencimento,
        status,
        id,
        empresa_id
    ))

    conexao.commit()

    linhas_alteradas = cursor.rowcount

    conexao.close()

    return linhas_alteradas



def excluir_despesa(id, empresa_id=None):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute("""
        DELETE FROM despesas
        WHERE id = ? AND empresa_id IS ?
    """, (id, empresa_id))

    conexao.commit()

    linhas_excluidas = cursor.rowcount

    conexao.close()

    return linhas_excluidas



def total_despesas(empresa_id=None):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute("""
        SELECT COALESCE(SUM(valor), 0) AS total
        FROM despesas
        WHERE empresa_id IS ?
    """, (empresa_id,))

    resultado = cursor.fetchone()

    conexao.close()

    return resultado["total"]



def total_pago(empresa_id=None):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute("""
        SELECT COALESCE(SUM(valor), 0) AS total
        FROM despesas
        WHERE status = 'Pago' AND empresa_id IS ?
    """, (empresa_id,))

    resultado = cursor.fetchone()

    conexao.close()

    return resultado["total"]



def total_pendente(empresa_id=None):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute("""
        SELECT COALESCE(SUM(valor), 0) AS total
        FROM despesas
        WHERE status = 'Pendente' AND empresa_id IS ?
    """, (empresa_id,))

    resultado = cursor.fetchone()

    conexao.close()

    return resultado["total"]



def despesas_por_categoria(empresa_id=None):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute("""
        SELECT
            categorias.nome AS categoria,
            COALESCE(SUM(despesas.valor), 0) AS total

        FROM categorias

        LEFT JOIN despesas
            ON despesas.categoria_id = categorias.id
            AND despesas.empresa_id IS ?

        GROUP BY categorias.id

        ORDER BY total DESC
    """, (empresa_id,))

    resultado = cursor.fetchall()

    conexao.close()

    return [dict(item) for item in resultado]



def evolucao_mensal(empresa_id=None):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute("""
        SELECT
            substr(vencimento, 1, 7) AS mes,
            SUM(valor) AS total

        FROM despesas

        WHERE empresa_id IS ?

        GROUP BY substr(vencimento, 1, 7)

        ORDER BY mes
    """, (empresa_id,))

    resultado = cursor.fetchall()

    conexao.close()

    return [dict(item) for item in resultado]



def despesas_por_status(empresa_id=None):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute("""
        SELECT
            status,
            COUNT(*) AS quantidade,
            SUM(valor) AS total

        FROM despesas

        WHERE empresa_id IS ?

        GROUP BY status
    """, (empresa_id,))

    resultado = cursor.fetchall()

    conexao.close()

    return [dict(item) for item in resultado]


def criar_empresa(nome, cnpj, email, senha_hash):
    conexao = conectar()
    try:
        cursor = conexao.cursor()
        cursor.execute("""
            INSERT INTO empresas (nome, cnpj, email, senha_hash)
            VALUES (?, ?, ?, ?)
        """, (nome, cnpj, email, senha_hash))
        conexao.commit()
        return cursor.lastrowid
    finally:
        conexao.close()


def buscar_empresa_por_email(email):
    conexao = conectar()
    cursor = conexao.cursor()
    cursor.execute("""
        SELECT id, nome, cnpj, email, senha_hash
        FROM empresas
        WHERE email = ?
    """, (email,))
    empresa = cursor.fetchone()
    conexao.close()
    return dict(empresa) if empresa else None


def criar_sessao_empresarial(token, empresa_id):
    conexao = conectar()
    conexao.execute("""
        INSERT INTO sessoes_empresariais (token, empresa_id)
        VALUES (?, ?)
    """, (token, empresa_id))
    conexao.commit()
    conexao.close()


def buscar_empresa_por_token(token):
    conexao = conectar()
    cursor = conexao.cursor()
    cursor.execute("""
        SELECT empresas.id, empresas.nome, empresas.cnpj, empresas.email
        FROM sessoes_empresariais
        INNER JOIN empresas ON empresas.id = sessoes_empresariais.empresa_id
        WHERE sessoes_empresariais.token = ?
    """, (token,))
    empresa = cursor.fetchone()
    conexao.close()
    return dict(empresa) if empresa else None


def excluir_sessao_empresarial(token):
    conexao = conectar()
    cursor = conexao.cursor()
    cursor.execute("DELETE FROM sessoes_empresariais WHERE token = ?", (token,))
    conexao.commit()
    excluida = cursor.rowcount > 0
    conexao.close()
    return excluida


def listar_recebimentos(empresa_id):
    conexao = conectar()
    cursor = conexao.cursor()
    cursor.execute("""
        SELECT id, descricao, origem, valor, vencimento, status
        FROM recebimentos
        WHERE empresa_id = ?
        ORDER BY vencimento
    """, (empresa_id,))
    itens = cursor.fetchall()
    conexao.close()
    return [dict(item) for item in itens]


def buscar_recebimento(id, empresa_id):
    conexao = conectar()
    cursor = conexao.cursor()
    cursor.execute("""
        SELECT id, descricao, origem, valor, vencimento, status
        FROM recebimentos
        WHERE id = ? AND empresa_id = ?
    """, (id, empresa_id))
    item = cursor.fetchone()
    conexao.close()
    return dict(item) if item else None


def inserir_recebimento(empresa_id, descricao, origem, valor, vencimento, status):
    conexao = conectar()
    cursor = conexao.cursor()
    cursor.execute("""
        INSERT INTO recebimentos (empresa_id, descricao, origem, valor, vencimento, status)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (empresa_id, descricao, origem, valor, vencimento, status))
    conexao.commit()
    id_recebimento = cursor.lastrowid
    conexao.close()
    return id_recebimento


def atualizar_recebimento(id, empresa_id, descricao, origem, valor, vencimento, status):
    conexao = conectar()
    cursor = conexao.cursor()
    cursor.execute("""
        UPDATE recebimentos
        SET descricao = ?, origem = ?, valor = ?, vencimento = ?, status = ?
        WHERE id = ? AND empresa_id = ?
    """, (descricao, origem, valor, vencimento, status, id, empresa_id))
    conexao.commit()
    linhas = cursor.rowcount
    conexao.close()
    return linhas


def excluir_recebimento(id, empresa_id):
    conexao = conectar()
    cursor = conexao.cursor()
    cursor.execute("DELETE FROM recebimentos WHERE id = ? AND empresa_id = ?", (id, empresa_id))
    conexao.commit()
    linhas = cursor.rowcount
    conexao.close()
    return linhas


def resumo_empresarial(empresa_id):
    conexao = conectar()
    cursor = conexao.cursor()
    cursor.execute("""
        SELECT
            COALESCE((SELECT SUM(valor) FROM despesas WHERE empresa_id = ?), 0) AS total_despesas,
            COALESCE((SELECT SUM(valor) FROM recebimentos WHERE empresa_id = ?), 0) AS total_recebimentos,
            COALESCE((SELECT SUM(valor) FROM despesas WHERE empresa_id = ? AND status = 'Pago'), 0) AS despesas_pagas,
            COALESCE((SELECT SUM(valor) FROM recebimentos WHERE empresa_id = ? AND status = 'Pago'), 0) AS recebimentos_confirmados
    """, (empresa_id, empresa_id, empresa_id, empresa_id))
    totais = dict(cursor.fetchone())
    conexao.close()
    totais["saldo"] = totais["total_recebimentos"] - totais["total_despesas"]
    return totais


def _buscar_lancamentos_proximos(tabela, coluna_titular, titular_id, data_limite):
    with conectar() as conexao:
        linhas = conexao.execute(f"""
            SELECT id, descricao, valor, vencimento, status
            FROM {tabela}
            WHERE {coluna_titular} = ? AND status = 'Pendente'
              AND date(vencimento) <= date(?)
            ORDER BY vencimento
        """, (titular_id, data_limite)).fetchall()
        return [dict(linha) for linha in linhas]


def notificacoes_empresariais(empresa_id, data_limite):
    return {
        "despesas": _buscar_lancamentos_proximos("despesas", "empresa_id", empresa_id, data_limite),
        "recebimentos": _buscar_lancamentos_proximos("recebimentos", "empresa_id", empresa_id, data_limite)
    }


# ==========================================================
# INICIALIZAÇÃO DO BANCO
# ==========================================================

if __name__ == "__main__":

    criar_tabelas()

    print("Banco de dados criado com sucesso!")

    print("\nCategorias:")

    for categoria in buscar_categorias():
        print(categoria)

# ==========================================================
# CONTAS E LANÇAMENTOS DE PESSOA FÍSICA
# ==========================================================
def criar_pessoa(nome, email, senha_hash):
    with conectar() as conexao:
        cursor = conexao.execute("INSERT INTO pessoas_fisicas (nome, email, senha_hash) VALUES (?, ?, ?)", (nome, email, senha_hash))
        return cursor.lastrowid


def buscar_pessoa_por_email(email):
    with conectar() as conexao:
        linha = conexao.execute("SELECT id, nome, email, senha_hash FROM pessoas_fisicas WHERE email = ? COLLATE NOCASE", (email,)).fetchone()
        return dict(linha) if linha else None


def criar_sessao_pessoal(token, pessoa_id):
    with conectar() as conexao:
        conexao.execute("INSERT INTO sessoes_pessoais (token, pessoa_id) VALUES (?, ?)", (token, pessoa_id))


def buscar_pessoa_por_token(token):
    with conectar() as conexao:
        linha = conexao.execute("SELECT p.id, p.nome, p.email FROM pessoas_fisicas p JOIN sessoes_pessoais s ON s.pessoa_id = p.id WHERE s.token = ?", (token,)).fetchone()
        return dict(linha) if linha else None


def excluir_sessao_pessoal(token):
    with conectar() as conexao:
        conexao.execute("DELETE FROM sessoes_pessoais WHERE token = ?", (token,))


def buscar_despesas_pessoais(pessoa_id):
    with conectar() as conexao:
        rows = conexao.execute("SELECT d.id, d.descricao, d.categoria_id, c.nome AS categoria, d.valor, d.vencimento, d.status FROM despesas_pessoais d JOIN categorias c ON c.id=d.categoria_id WHERE d.pessoa_id=? ORDER BY d.vencimento", (pessoa_id,)).fetchall()
        return [dict(r) for r in rows]


def inserir_despesa_pessoal(pessoa_id, descricao, categoria_id, valor, vencimento, status):
    with conectar() as conexao:
        cur = conexao.execute("INSERT INTO despesas_pessoais (pessoa_id, descricao, categoria_id, valor, vencimento, status) VALUES (?, ?, ?, ?, ?, ?)", (pessoa_id, descricao, categoria_id, valor, vencimento, status))
        return cur.lastrowid


def atualizar_despesa_pessoal(id, pessoa_id, descricao, categoria_id, valor, vencimento, status):
    with conectar() as conexao:
        cur = conexao.execute("UPDATE despesas_pessoais SET descricao=?, categoria_id=?, valor=?, vencimento=?, status=? WHERE id=? AND pessoa_id=?", (descricao, categoria_id, valor, vencimento, status, id, pessoa_id))
        return cur.rowcount > 0


def excluir_despesa_pessoal(id, pessoa_id):
    with conectar() as conexao:
        cur = conexao.execute("DELETE FROM despesas_pessoais WHERE id=? AND pessoa_id=?", (id, pessoa_id))
        return cur.rowcount > 0


def buscar_recebimentos_pessoais(pessoa_id):
    with conectar() as conexao:
        rows = conexao.execute("SELECT id, descricao, origem, valor, vencimento, status FROM recebimentos_pessoais WHERE pessoa_id=? ORDER BY vencimento", (pessoa_id,)).fetchall()
        return [dict(r) for r in rows]


def inserir_recebimento_pessoal(pessoa_id, descricao, origem, valor, vencimento, status):
    with conectar() as conexao:
        cur = conexao.execute("INSERT INTO recebimentos_pessoais (pessoa_id, descricao, origem, valor, vencimento, status) VALUES (?, ?, ?, ?, ?, ?)", (pessoa_id, descricao, origem, valor, vencimento, status))
        return cur.lastrowid


def atualizar_recebimento_pessoal(id, pessoa_id, descricao, origem, valor, vencimento, status):
    with conectar() as conexao:
        cur = conexao.execute("UPDATE recebimentos_pessoais SET descricao=?, origem=?, valor=?, vencimento=?, status=? WHERE id=? AND pessoa_id=?", (descricao, origem, valor, vencimento, status, id, pessoa_id))
        return cur.rowcount > 0


def excluir_recebimento_pessoal(id, pessoa_id):
    with conectar() as conexao:
        cur = conexao.execute("DELETE FROM recebimentos_pessoais WHERE id=? AND pessoa_id=?", (id, pessoa_id))
        return cur.rowcount > 0


def resumo_pessoal(pessoa_id):
    with conectar() as conexao:
        row = conexao.execute("SELECT COALESCE((SELECT SUM(valor) FROM despesas_pessoais WHERE pessoa_id=?),0) total_despesas, COALESCE((SELECT SUM(valor) FROM recebimentos_pessoais WHERE pessoa_id=?),0) total_recebimentos, COALESCE((SELECT SUM(valor) FROM despesas_pessoais WHERE pessoa_id=? AND status='Pago'),0) despesas_pagas, COALESCE((SELECT SUM(valor) FROM recebimentos_pessoais WHERE pessoa_id=? AND status='Pago'),0) recebimentos_confirmados", (pessoa_id, pessoa_id, pessoa_id, pessoa_id)).fetchone()
        resultado = dict(row)
        resultado["saldo"] = resultado["total_recebimentos"] - resultado["total_despesas"]
        return resultado


def notificacoes_pessoais(pessoa_id, data_limite):
    return {
        "despesas": _buscar_lancamentos_proximos("despesas_pessoais", "pessoa_id", pessoa_id, data_limite),
        "recebimentos": _buscar_lancamentos_proximos("recebimentos_pessoais", "pessoa_id", pessoa_id, data_limite)
    }
