(() => {
  const script = document.currentScript;
  const modo = script?.dataset.modo;
  const pessoal = modo === "pessoal";
  const token = localStorage.getItem(pessoal ? "cashflipTokenPessoal" : "cashflipTokenEmpresarial");
  const navegacao = document.querySelector("nav .navbar-collapse");

  if (!token || !navegacao || !["pessoal", "empresarial"].includes(modo)) return;

  const paginaDespesas = pessoal ? "despesas-pessoais.html" : "despesas.html";
  const paginaRecebimentos = pessoal ? "recebimentos-pessoais.html" : "recebimentos.html";
  const endpoint = pessoal
    ? `${window.CASHFLIP_API_BASE}/pessoal/notificacoes`
    : `${window.CASHFLIP_API_BASE}/empresarial/notificacoes`;
  const idWidget = "cashflipNotificacoes";

  if (document.getElementById(idWidget)) return;

  const estilos = document.createElement("style");
  estilos.textContent = `
    #cashflipNotificacoes { position: relative; }
    #cashflipNotificacoesPainel {
      position: absolute; top: calc(100% + .5rem); right: 0; z-index: 1080;
      width: min(22rem, calc(100vw - 2rem)); max-height: 70vh; overflow-y: auto;
      padding: 1rem; border: 1px solid #495057; border-radius: .5rem;
      background: #212529; box-shadow: 0 .5rem 1rem rgba(0,0,0,.4);
    }
    #cashflipNotificacoesPainel[hidden] { display: none; }
    .cashflip-aviso + .cashflip-aviso { border-top: 1px solid #495057; }
  `;
  document.head.append(estilos);

  const widget = document.createElement("div");
  widget.id = idWidget;
  widget.className = "ms-lg-3 mt-2 mt-lg-0";
  widget.innerHTML = `
    <button type="button" class="btn btn-outline-light btn-sm" id="cashflipNotificacoesBotao"
      aria-expanded="false" aria-controls="cashflipNotificacoesPainel">
      Avisos <span class="badge bg-danger ms-1" id="cashflipNotificacoesContagem" hidden></span>
    </button>
    <section id="cashflipNotificacoesPainel" aria-label="Avisos financeiros" aria-live="polite" hidden>
      <h2 class="h6 mb-3">Vencimentos próximos</h2>
      <div id="cashflipNotificacoesLista" class="small text-secondary">Carregando avisos...</div>
    </section>
  `;
  navegacao.append(widget);

  const botao = widget.querySelector("#cashflipNotificacoesBotao");
  const painel = widget.querySelector("#cashflipNotificacoesPainel");
  const lista = widget.querySelector("#cashflipNotificacoesLista");
  const contagem = widget.querySelector("#cashflipNotificacoesContagem");

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
  const formatarData = (valor) => {
    const [ano, mes, dia] = String(valor).slice(0, 10).split("-");
    return `${dia}/${mes}/${ano}`;
  };
  const diasAte = (valor) => {
    const [ano, mes, dia] = String(valor).slice(0, 10).split("-").map(Number);
    const vencimento = Date.UTC(ano, mes - 1, dia);
    const hoje = new Date();
    const hojeUtc = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    return Math.round((vencimento - hojeUtc) / 86400000);
  };
  const textoData = (dias) => dias < 0
    ? `Vencido há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"}`
    : dias === 0 ? "Vence hoje" : `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;

  function renderizarAvisos(dados) {
    const avisos = [
      ...(dados.despesas || []).map((item) => ({ ...item, tipo: "Despesa", link: paginaDespesas })),
      ...(dados.recebimentos || []).map((item) => ({ ...item, tipo: "Recebimento", link: paginaRecebimentos }))
    ].sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));

    contagem.textContent = String(avisos.length);
    contagem.hidden = avisos.length === 0;
    if (!avisos.length) {
      lista.className = "small text-secondary";
      lista.textContent = "Nenhuma despesa ou recebimento pendente para os próximos 7 dias.";
      return;
    }

    lista.className = "small";
    lista.innerHTML = avisos.map((item) => `
      <a class="cashflip-aviso d-block py-2 text-decoration-none text-light" href="${item.link}">
        <span class="d-flex justify-content-between gap-2">
          <strong>${item.tipo}: ${escaparHtml(item.descricao)}</strong>
          <span class="text-nowrap">${formatarValor(item.valor)}</span>
        </span>
        <span class="d-block text-secondary">${textoData(diasAte(item.vencimento))} (${formatarData(item.vencimento)})</span>
      </a>
    `).join("");
  }

  async function carregarAvisos() {
    try {
      const resposta = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        throw new Error(dados?.erro || `Não foi possível carregar os avisos (HTTP ${resposta.status}).`);
      }
      renderizarAvisos(dados);
    } catch (erro) {
      lista.className = "small text-danger";
      lista.textContent = erro.message || "Não foi possível carregar os avisos.";
    }
  }

  botao.addEventListener("click", () => {
    const abrir = painel.hidden;
    painel.hidden = !abrir;
    botao.setAttribute("aria-expanded", String(abrir));
  });

  document.addEventListener("click", (evento) => {
    if (!widget.contains(evento.target)) {
      painel.hidden = true;
      botao.setAttribute("aria-expanded", "false");
    }
  });

  carregarAvisos();
  window.setInterval(carregarAvisos, 60000);
})();
