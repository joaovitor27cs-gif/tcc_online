const API_URL = window.CASHFLIP_API_BASE;
const TOKEN_EMPRESARIAL = localStorage.getItem("cashflipTokenEmpresarial");
const URL_DESPESAS = TOKEN_EMPRESARIAL
  ? `${API_URL}/empresarial/despesas`
  : `${API_URL}/despesas`;

const formulario = document.getElementById("formDespesa");
const campoDescricao = document.getElementById("descricao");
const campoCategoria = document.getElementById("categoriaId");
const campoValor = document.getElementById("valor");
const campoVencimento = document.getElementById("vencimento");
const campoStatus = document.getElementById("status");
const tabela = document.getElementById("tabelaDespesas");
const mensagem = document.getElementById("mensagemApi");
const botaoSalvar = document.getElementById("botaoSalvar");
const botaoCancelar = document.getElementById("botaoCancelar");

let despesaEmEdicao = null;

const escaparHtml = (valor) => String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[caractere]));

const formatarValor = (valor) => Number(valor).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const formatarData = (data) => {
  const [ano, mes, dia] = String(data).slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
};

function mostrarMensagem(texto, tipo = "danger") {
  mensagem.textContent = texto;
  mensagem.className = `alert alert-${tipo}`;
}

function limparMensagem() {
  mensagem.textContent = "";
  mensagem.className = "alert d-none";
}

async function requisitar(url, opcoes = {}) {
  let resposta;
  try {
    resposta = await fetch(url, {
      ...opcoes,
      headers: {
        ...(opcoes.body ? { "Content-Type": "application/json" } : {}),
        ...(TOKEN_EMPRESARIAL ? { Authorization: `Bearer ${TOKEN_EMPRESARIAL}` } : {}),
        ...opcoes.headers
      }
    });
  } catch (erro) {
    throw new Error("Não foi possível conectar à API. Verifique se o backend está rodando na porta 5000.");
  }

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(dados?.erro || dados?.mensagem || `Erro na API (HTTP ${resposta.status}).`);
  }
  return dados;
}

async function carregarCategorias() {
  const categorias = await requisitar(`${API_URL}/categorias`);
  campoCategoria.innerHTML = '<option value="">Selecione uma categoria</option>' +
    categorias.map((categoria) =>
      `<option value="${categoria.id}">${escaparHtml(categoria.nome)}</option>`
    ).join("");
}

async function carregarDespesas() {
  const despesas = await requisitar(URL_DESPESAS);
  if (!despesas.length) {
    tabela.innerHTML = '<tr><td colspan="6" class="text-secondary text-center">Nenhuma despesa cadastrada.</td></tr>';
    return;
  }

  tabela.innerHTML = despesas.map((despesa) => `
    <tr>
      <td>${escaparHtml(despesa.descricao)}</td>
      <td>${escaparHtml(despesa.categoria)}</td>
      <td>${escaparHtml(formatarData(despesa.vencimento))}</td>
      <td>${formatarValor(despesa.valor)}</td>
      <td><span class="badge ${despesa.status === "Pago" ? "bg-success" : "bg-secondary"}">${escaparHtml(despesa.status)}</span></td>
      <td class="text-end">
        <button type="button" class="btn btn-sm btn-outline-light me-2" data-acao="editar" data-id="${despesa.id}">Editar</button>
        <button type="button" class="btn btn-sm btn-outline-danger" data-acao="remover" data-id="${despesa.id}">Remover</button>
      </td>
    </tr>`).join("");
}

function sairDoModoEdicao() {
  despesaEmEdicao = null;
  formulario.reset();
  campoStatus.value = "Pendente";
  botaoSalvar.textContent = "Cadastrar despesa";
  botaoCancelar.classList.add("d-none");
}

function iniciarEdicao(despesa) {
  despesaEmEdicao = despesa.id;
  campoDescricao.value = despesa.descricao;
  campoCategoria.value = String(despesa.categoria_id);
  campoValor.value = despesa.valor;
  campoVencimento.value = String(despesa.vencimento).slice(0, 10);
  campoStatus.value = despesa.status;
  botaoSalvar.textContent = "Salvar alterações";
  botaoCancelar.classList.remove("d-none");
  formulario.scrollIntoView({ behavior: "smooth", block: "center" });
  campoDescricao.focus();
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  limparMensagem();

  const dados = {
    descricao: campoDescricao.value.trim(),
    categoria_id: Number(campoCategoria.value),
    valor: Number(campoValor.value),
    vencimento: campoVencimento.value,
    status: campoStatus.value
  };

  botaoSalvar.disabled = true;
  try {
    const editando = despesaEmEdicao !== null;
    const url = editando ? `${URL_DESPESAS}/${despesaEmEdicao}` : URL_DESPESAS;
    await requisitar(url, {
      method: editando ? "PUT" : "POST",
      body: JSON.stringify(dados)
    });
    sairDoModoEdicao();
    await carregarDespesas();
    mostrarMensagem(editando ? "Despesa atualizada com sucesso." : "Despesa cadastrada com sucesso.", "success");
  } catch (erro) {
    mostrarMensagem(erro.message);
  } finally {
    botaoSalvar.disabled = false;
  }
});

tabela.addEventListener("click", async (evento) => {
  const botao = evento.target.closest("button[data-acao]");
  if (!botao) return;

  limparMensagem();
  const { acao, id } = botao.dataset;
  botao.disabled = true;
  try {
    if (acao === "editar") {
      const despesa = await requisitar(`${URL_DESPESAS}/${id}`);
      iniciarEdicao(despesa);
      return;
    }

    if (!window.confirm("Tem certeza que deseja remover esta despesa?")) return;
    await requisitar(`${URL_DESPESAS}/${id}`, { method: "DELETE" });
    if (String(despesaEmEdicao) === id) sairDoModoEdicao();
    await carregarDespesas();
    mostrarMensagem("Despesa removida com sucesso.", "success");
  } catch (erro) {
    mostrarMensagem(erro.message);
  } finally {
    botao.disabled = false;
  }
});

botaoCancelar.addEventListener("click", () => {
  sairDoModoEdicao();
  limparMensagem();
});

async function iniciarPagina() {
  try {
    if (TOKEN_EMPRESARIAL) {
      const empresa = await requisitar(`${API_URL}/empresarial/me`);
      document.getElementById("linkRecebimentos").classList.remove("d-none");
      document.getElementById("linkAssistenteEmpresa").classList.remove("d-none");
      document.getElementById("nomeEmpresa").textContent = empresa.nome;
      document.getElementById("nomeEmpresa").classList.remove("d-none");
      document.getElementById("linkSair").textContent = "Sair da empresa";
      document.getElementById("linkSair").addEventListener("click", async (evento) => {
        evento.preventDefault();
        try {
          await requisitar(`${API_URL}/empresarial/logout`, { method: "POST" });
        } finally {
          localStorage.removeItem("cashflipTokenEmpresarial");
          localStorage.removeItem("cashflipEmpresa");
          window.location.href = "login-empresarial.html";
        }
      });
    }
    await carregarCategorias();
    await carregarDespesas();
  } catch (erro) {
    if (TOKEN_EMPRESARIAL && erro.message.includes("Sessão empresarial inválida")) {
      localStorage.removeItem("cashflipTokenEmpresarial");
      localStorage.removeItem("cashflipEmpresa");
      window.location.href = "login-empresarial.html";
      return;
    }
    tabela.innerHTML = '<tr><td colspan="6" class="text-secondary text-center">Não foi possível carregar os dados.</td></tr>';
    mostrarMensagem(erro.message);
  }
}

iniciarPagina();
