const endpointRecebimentos = `${API_PESSOAL}/recebimentos`;
let recebimentoEmEdicao = null;
const formularioRecebimento = document.getElementById("formLancamento");
const tabelaRecebimentos = document.getElementById("lista");
const mensagemRecebimentos = document.getElementById("mensagem");
const campoDescricaoRecebimento = document.getElementById("descricao");
const campoOrigemRecebimento = document.getElementById("origem");
const campoValorRecebimento = document.getElementById("valor");
const campoDataRecebimento = document.getElementById("vencimento");
const campoStatusRecebimento = document.getElementById("status");
const botaoSalvarRecebimento = document.getElementById("salvar");
const botaoCancelarRecebimento = document.getElementById("cancelar");

function avisarRecebimentos(texto, tipo = "danger") {
  mensagemRecebimentos.textContent = texto;
  mensagemRecebimentos.className = `alert alert-${tipo}`;
}

async function carregarResumoRecebimentos() {
  const resumo = await apiPessoal(`${API_PESSOAL}/resumo`);
  document.getElementById("totalRecebimentos").textContent = dinheiroPessoal(resumo.total_recebimentos);
  document.getElementById("totalDespesas").textContent = dinheiroPessoal(resumo.total_despesas);
  const saldo = document.getElementById("saldoPessoal");
  saldo.textContent = dinheiroPessoal(resumo.saldo);
  saldo.classList.toggle("text-danger", resumo.saldo < 0);
  saldo.classList.toggle("text-success", resumo.saldo >= 0);
}

async function carregarRecebimentosPessoais() {
  const itens = await apiPessoal(endpointRecebimentos);
  if (!itens.length) {
    tabelaRecebimentos.innerHTML = '<tr><td colspan="6" class="text-secondary text-center">Nenhum recebimento cadastrado.</td></tr>';
    window.itensPessoais = [];
    return;
  }

  tabelaRecebimentos.innerHTML = itens.map((item) => `
    <tr>
      <td>${escaparPessoal(item.descricao)}</td>
      <td>${escaparPessoal(item.origem)}</td>
      <td>${dataPessoal(item.vencimento)}</td>
      <td>${dinheiroPessoal(item.valor)}</td>
      <td><span class="badge ${item.status === "Pago" ? "bg-success" : "bg-secondary"}">${item.status === "Pago" ? "Recebido" : "Pendente"}</span></td>
      <td class="text-end text-nowrap">
        <button type="button" class="btn btn-sm btn-outline-light me-2" data-acao="editar" data-id="${item.id}">Editar</button>
        <button type="button" class="btn btn-sm btn-outline-danger" data-acao="remover" data-id="${item.id}">Remover</button>
      </td>
    </tr>`).join("");
  window.itensPessoais = itens;
}

function cancelarEdicaoRecebimento() {
  recebimentoEmEdicao = null;
  formularioRecebimento.reset();
  campoStatusRecebimento.value = "Pendente";
  document.getElementById("tituloForm").textContent = "Gerenciar recebimentos pessoais";
  botaoSalvarRecebimento.textContent = "Cadastrar recebimento";
  botaoCancelarRecebimento.classList.add("d-none");
}

function editarRecebimentoPessoal(item) {
  recebimentoEmEdicao = item.id;
  campoDescricaoRecebimento.value = item.descricao;
  campoOrigemRecebimento.value = item.origem;
  campoValorRecebimento.value = item.valor;
  campoDataRecebimento.value = String(item.vencimento).slice(0, 10);
  campoStatusRecebimento.value = item.status;
  document.getElementById("tituloForm").textContent = "Editar recebimento";
  botaoSalvarRecebimento.textContent = "Salvar alterações";
  botaoCancelarRecebimento.classList.remove("d-none");
  formularioRecebimento.scrollIntoView({ behavior: "smooth", block: "center" });
  campoDescricaoRecebimento.focus();
}

formularioRecebimento.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mensagemRecebimentos.className = "alert d-none";
  botaoSalvarRecebimento.disabled = true;
  const editando = recebimentoEmEdicao !== null;
  try {
    const payload = {
      descricao: campoDescricaoRecebimento.value.trim(),
      origem: campoOrigemRecebimento.value.trim(),
      valor: Number(campoValorRecebimento.value),
      vencimento: campoDataRecebimento.value,
      status: campoStatusRecebimento.value
    };
    const url = editando ? `${endpointRecebimentos}/${recebimentoEmEdicao}` : endpointRecebimentos;
    await apiPessoal(url, {
      method: editando ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    cancelarEdicaoRecebimento();
    await Promise.all([carregarRecebimentosPessoais(), carregarResumoRecebimentos()]);
    avisarRecebimentos(editando ? "Recebimento atualizado com sucesso." : "Recebimento cadastrado com sucesso.", "success");
  } catch (erro) {
    avisarRecebimentos(erro.message);
  } finally {
    botaoSalvarRecebimento.disabled = false;
  }
});

tabelaRecebimentos.addEventListener("click", async (evento) => {
  const botao = evento.target.closest("button[data-acao]");
  if (!botao) return;
  botao.disabled = true;
  mensagemRecebimentos.className = "alert d-none";
  const item = (window.itensPessoais || []).find((recebimento) => recebimento.id === Number(botao.dataset.id));
  try {
    if (botao.dataset.acao === "editar") {
      if (item) editarRecebimentoPessoal(item);
      return;
    }
    if (!window.confirm("Tem certeza que deseja remover este recebimento?")) return;
    await apiPessoal(`${endpointRecebimentos}/${botao.dataset.id}`, { method: "DELETE" });
    if (String(recebimentoEmEdicao) === botao.dataset.id) cancelarEdicaoRecebimento();
    await Promise.all([carregarRecebimentosPessoais(), carregarResumoRecebimentos()]);
    avisarRecebimentos("Recebimento removido com sucesso.", "success");
  } catch (erro) {
    avisarRecebimentos(erro.message);
  } finally {
    botao.disabled = false;
  }
});

botaoCancelarRecebimento.addEventListener("click", () => {
  cancelarEdicaoRecebimento();
  mensagemRecebimentos.className = "alert d-none";
});

(async () => {
  try {
    await Promise.all([carregarRecebimentosPessoais(), carregarResumoRecebimentos()]);
  } catch (erro) {
    avisarRecebimentos(erro.message);
    tabelaRecebimentos.innerHTML = '<tr><td colspan="6" class="text-secondary text-center">Não foi possível carregar os recebimentos.</td></tr>';
  }
})();
