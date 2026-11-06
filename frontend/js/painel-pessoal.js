(async () => {
  try {
    const resumo = await apiPessoal(`${API_PESSOAL}/resumo`);
    const saldo = document.getElementById("saldo");
    saldo.textContent = dinheiroPessoal(resumo.saldo);
    saldo.classList.add(resumo.saldo < 0 ? "text-danger" : "text-success");
    document.getElementById("recebimentos").textContent = dinheiroPessoal(resumo.total_recebimentos);
    document.getElementById("despesas").textContent = dinheiroPessoal(resumo.total_despesas);
    document.getElementById("interpretacao").textContent = resumo.saldo < 0
      ? "Suas despesas cadastradas superam os recebimentos. Consulte o relatório e planeje seus próximos pagamentos."
      : resumo.saldo > 0
        ? "Seus recebimentos cadastrados superam as despesas. Continue acompanhando seus lançamentos."
        : "Seus recebimentos e despesas estão equilibrados, ou ainda não há lançamentos suficientes.";
  } catch (erro) {
    const elementoErro = document.getElementById("erro");
    elementoErro.textContent = erro.message;
    elementoErro.classList.remove("d-none");
    document.getElementById("interpretacao").textContent = "Não foi possível carregar o resumo financeiro.";
  }
})();