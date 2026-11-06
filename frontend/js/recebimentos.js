const API_EMPRESARIAL = `${window.CASHFLIP_API_BASE}/empresarial`;
const tokenEmpresa = localStorage.getItem("cashflipTokenEmpresarial");
const formularioRecebimento = document.getElementById("formRecebimento");
const tabelaRecebimentos = document.getElementById("tabelaRecebimentos");
const mensagemRecebimentos = document.getElementById("mensagemRecebimentos");
const campoDescricao = document.getElementById("descricaoRecebimento");
const campoOrigem = document.getElementById("origemRecebimento");
const campoValor = document.getElementById("valorRecebimento");
const campoData = document.getElementById("dataRecebimento");
const campoStatus = document.getElementById("statusRecebimento");
const botaoSalvar = document.getElementById("botaoSalvarRecebimento");
const botaoCancelar = document.getElementById("botaoCancelarRecebimento");
let recebimentoEmEdicao = null;

if (!tokenEmpresa) window.location.replace("login-empresarial.html");

const escaparHtml = (valor) => String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[caractere]));
const dinheiro = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (data) => {
  const [ano, mes, dia] = String(data).slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
};

function avisar(texto, tipo = "danger") {
  mensagemRecebimentos.textContent = texto;
  mensagemRecebimentos.className = `alert alert-${tipo}`;
}

async function requisitarEmpresa(url, opcoes = {}) {
  let resposta;
  try {
    resposta = await fetch(url, {
      ...opcoes,
      headers: {
        ...(opcoes.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${tokenEmpresa}`,
        ...opcoes.headers
      }
    });
  } catch {
    throw new Error("Não foi possível conectar à API. Verifique se o backend está rodando na porta 5000.");
  }
  const dados = await resposta.json().catch(() => null);
  if (resposta.status === 401) {
    localStorage.removeItem("cashflipTokenEmpresarial");
    localStorage.removeItem("cashflipEmpresa");
    window.location.replace("login-empresarial.html");
    throw new Error("Sessão empresarial encerrada.");
  }
  if (!resposta.ok) throw new Error(dados?.erro || `Erro na API (HTTP ${resposta.status}).`);
  return dados;
}

async function carregarResumo() {
  const resumo = await requisitarEmpresa(`${API_EMPRESARIAL}/resumo`);
  document.getElementById("totalRecebimentos").textContent = dinheiro(resumo.total_recebimentos);
  document.getElementById("totalDespesas").textContent = dinheiro(resumo.total_despesas);
  const saldo = document.getElementById("saldoEmpresa");
  saldo.textContent = dinheiro(resumo.saldo);
  saldo.classList.toggle("text-danger", resumo.saldo < 0);
  saldo.classList.toggle("text-success", resumo.saldo >= 0);
}

async function carregarRecebimentos() {
  const recebimentos = await requisitarEmpresa(`${API_EMPRESARIAL}/recebimentos`);
  if (!recebimentos.length) {
    tabelaRecebimentos.innerHTML = '<tr><td colspan="6" class="text-secondary text-center">Nenhum recebimento cadastrado.</td></tr>';
    return;
  }
  tabelaRecebimentos.innerHTML = recebimentos.map((item) => `
    <tr>
      <td>${escaparHtml(item.descricao)}</td>
      <td>${escaparHtml(item.origem)}</td>
      <td>${escaparHtml(dataBR(item.vencimento))}</td>
      <td>${dinheiro(item.valor)}</td>
      <td><span class="badge ${item.status === "Pago" ? "bg-success" : "bg-secondary"}">${item.status === "Pago" ? "Recebido" : "Pendente"}</span></td>
      <td class="text-end">
        <button type="button" class="btn btn-sm btn-outline-light me-2" data-acao="editar" data-id="${item.id}">Editar</button>
        <button type="button" class="btn btn-sm btn-outline-danger" data-acao="remover" data-id="${item.id}">Remover</button>
      </td>
    </tr>`).join("");
}

function cancelarEdicao() {
  recebimentoEmEdicao = null;
  formularioRecebimento.reset();
  campoStatus.value = "Pendente";
  botaoSalvar.textContent = "Cadastrar recebimento";
  botaoCancelar.classList.add("d-none");
}

function editarRecebimento(item) {
  recebimentoEmEdicao = item.id;
  campoDescricao.value = item.descricao;
  campoOrigem.value = item.origem;
  campoValor.value = item.valor;
  campoData.value = String(item.vencimento).slice(0, 10);
  campoStatus.value = item.status;
  botaoSalvar.textContent = "Salvar alterações";
  botaoCancelar.classList.remove("d-none");
  formularioRecebimento.scrollIntoView({ behavior: "smooth", block: "center" });
  campoDescricao.focus();
}

formularioRecebimento.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mensagemRecebimentos.className = "alert d-none";
  const editando = recebimentoEmEdicao !== null;
  botaoSalvar.disabled = true;
  try {
    await requisitarEmpresa(editando
      ? `${API_EMPRESARIAL}/recebimentos/${recebimentoEmEdicao}`
      : `${API_EMPRESARIAL}/recebimentos`, {
      method: editando ? "PUT" : "POST",
      body: JSON.stringify({
        descricao: campoDescricao.value.trim(),
        origem: campoOrigem.value.trim(),
        valor: Number(campoValor.value),
        vencimento: campoData.value,
        status: campoStatus.value
      })
    });
    cancelarEdicao();
    await Promise.all([carregarRecebimentos(), carregarResumo()]);
    avisar(editando ? "Recebimento atualizado com sucesso." : "Recebimento cadastrado com sucesso.", "success");
  } catch (erro) {
    avisar(erro.message);
  } finally {
    botaoSalvar.disabled = false;
  }
});

tabelaRecebimentos.addEventListener("click", async (evento) => {
  const botao = evento.target.closest("button[data-acao]");
  if (!botao) return;
  botao.disabled = true;
  mensagemRecebimentos.className = "alert d-none";
  const { acao, id } = botao.dataset;
  try {
    if (acao === "editar") {
      editarRecebimento(await requisitarEmpresa(`${API_EMPRESARIAL}/recebimentos/${id}`));
      return;
    }
    if (!window.confirm("Tem certeza que deseja remover este recebimento?")) return;
    await requisitarEmpresa(`${API_EMPRESARIAL}/recebimentos/${id}`, { method: "DELETE" });
    if (String(recebimentoEmEdicao) === id) cancelarEdicao();
    await Promise.all([carregarRecebimentos(), carregarResumo()]);
    avisar("Recebimento removido com sucesso.", "success");
  } catch (erro) {
    avisar(erro.message);
  } finally {
    botao.disabled = false;
  }
});

botaoCancelar.addEventListener("click", () => {
  cancelarEdicao();
  mensagemRecebimentos.className = "alert d-none";
});

document.getElementById("linkSair").addEventListener("click", async (evento) => {
  evento.preventDefault();
  try {
    await requisitarEmpresa(`${API_EMPRESARIAL}/logout`, { method: "POST" });
  } catch (erro) {
    console.error("Erro ao encerrar a sessão empresarial:", erro);
  } finally {
    localStorage.removeItem("cashflipTokenEmpresarial");
    localStorage.removeItem("cashflipEmpresa");
    window.location.href = "login-empresarial.html";
  }
});

async function iniciarRecebimentos() {
  if (!tokenEmpresa) return;
  try {
    const empresa = await requisitarEmpresa(`${API_EMPRESARIAL}/me`);
    document.getElementById("nomeEmpresa").textContent = empresa.nome;
    document.getElementById("linkAssistenteEmpresa").classList.remove("d-none");
    await Promise.all([carregarRecebimentos(), carregarResumo()]);
  } catch (erro) {
    if (!window.location.pathname.endsWith("login-empresarial.html")) avisar(erro.message);
  }
}

iniciarRecebimentos();
