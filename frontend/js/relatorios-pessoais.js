const PALETA_PESSOAL = [
  "#B31B1B", "#E8743B", "#F2C14E", "#4CAF7A", "#3FA7D6", "#8E6FD8",
  "#D96FA8", "#2EC4B6", "#9BC53D", "#C77DFF", "#FF9F9F", "#E0B1CB", "#8A8D91"
];
const CORES_STATUS_DESPESA = { Pago: "#2ecc71", Pendente: "#F2C14E" };
const corStatusDespesa = (status, indice) => CORES_STATUS_DESPESA[status] || PALETA_PESSOAL[(indice + 3) % PALETA_PESSOAL.length];
const mesesPessoais = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const formatarMesPessoal = (anoMes) => {
  const [ano, mes] = anoMes.split("-");
  return `${mesesPessoais[Number(mes) - 1]}/${ano}`;
};
const formatarDinheiroPessoal = (valor) => dinheiroPessoal(valor);
const somarLancamentosPessoais = (lista) => lista.reduce((total, item) => total + Number(item.valor || 0), 0);
const escaparHtmlRelatorio = (valor) => escaparPessoal(valor);

Chart.defaults.color = "#adb5bd";
Chart.defaults.borderColor = "rgba(255,255,255,0.08)";
Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

const tooltipComPercentualPessoal = {
  callbacks: {
    label: (contexto) => {
      const total = contexto.dataset.data.reduce((soma, valor) => soma + valor, 0);
      const percentual = total ? contexto.parsed / total * 100 : 0;
      return ` ${contexto.label}: ${formatarDinheiroPessoal(contexto.parsed)} (${percentual.toFixed(1).replace(".", ",")}%)`;
    }
  }
};

const graficosPessoais = {};
function recriarGraficoPessoal(id, configuracao) {
  if (graficosPessoais[id]) graficosPessoais[id].destroy();
  graficosPessoais[id] = new Chart(document.getElementById(id), configuracao);
}

function alternarGraficoVazio(idVazio, idCanvas, vazio) {
  document.getElementById(idVazio).style.display = vazio ? "flex" : "none";
  document.getElementById(idCanvas).style.display = vazio ? "none" : "block";
}

function renderDistribuicaoPessoal(itens, canvasId, vazioId, tipo, corDoItem) {
  alternarGraficoVazio(vazioId, canvasId, itens.length === 0);
  if (!itens.length) return;

  recriarGraficoPessoal(canvasId, {
    type: tipo,
    data: {
      labels: itens.map(([rotulo]) => rotulo),
      datasets: [{
        data: itens.map(([, valor]) => valor),
        backgroundColor: itens.map(([rotulo], indice) => corDoItem(rotulo, indice)),
        borderColor: "#000",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...(tipo === "doughnut" ? { cutout: "60%" } : {}),
      plugins: {
        legend: { position: "right", labels: { boxWidth: 12 } },
        tooltip: tooltipComPercentualPessoal
      }
    }
  });
}

function renderEvolucaoMensalPessoal(lancamentos, canvasId, vazioId, rotuloStatus, corDataset) {
  const meses = [...new Set(lancamentos.map((item) => String(item.vencimento).slice(0, 7)))].sort();
  const status = [...new Set(lancamentos.map((item) => item.status))];
  alternarGraficoVazio(vazioId, canvasId, meses.length === 0);
  if (!meses.length) return;

  const conjuntos = status.map((statusItem) => ({
    label: rotuloStatus(statusItem),
    data: meses.map((mes) => somarLancamentosPessoais(
      lancamentos.filter((item) => item.status === statusItem && String(item.vencimento).slice(0, 7) === mes)
    )),
    backgroundColor: corDataset(statusItem),
    borderRadius: 4
  }));

  recriarGraficoPessoal(canvasId, {
    type: "bar",
    data: { labels: meses.map(formatarMesPessoal), datasets: conjuntos },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { callback: (valor) => formatarDinheiroPessoal(valor) }
        }
      },
      plugins: {
        legend: { position: "top", labels: { boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: (contexto) => ` ${contexto.dataset.label}: ${formatarDinheiroPessoal(contexto.parsed.y)}`,
            footer: (itensTooltip) => "Total: " + formatarDinheiroPessoal(
              itensTooltip.reduce((total, item) => total + item.parsed.y, 0)
            )
          }
        }
      }
    }
  });
}

function renderIndicadoresPessoais(despesas, recebimentos) {
  const atualizacoes = {
    kpiTotalDespesas: somarLancamentosPessoais(despesas),
    kpiDespesasPagas: somarLancamentosPessoais(despesas.filter((item) => item.status === "Pago")),
    kpiDespesasPendentes: somarLancamentosPessoais(despesas.filter((item) => item.status === "Pendente")),
    kpiTotalRecebimentos: somarLancamentosPessoais(recebimentos),
    kpiRecebimentosPagos: somarLancamentosPessoais(recebimentos.filter((item) => item.status === "Pago")),
    kpiRecebimentosPendentes: somarLancamentosPessoais(recebimentos.filter((item) => item.status === "Pendente"))
  };
  Object.entries(atualizacoes).forEach(([id, valor]) => {
    document.getElementById(id).textContent = formatarDinheiroPessoal(valor);
  });
}

function renderGraficosDespesas(despesas) {
  const categorias = {};
  const status = {};
  despesas.forEach((item) => {
    categorias[item.categoria] = (categorias[item.categoria] || 0) + Number(item.valor);
    status[item.status] = (status[item.status] || 0) + Number(item.valor);
  });

  renderDistribuicaoPessoal(
    Object.entries(categorias).sort((a, b) => b[1] - a[1]),
    "graficoCategorias",
    "vazioCategorias",
    "pie",
    (_, indice) => PALETA_PESSOAL[indice % PALETA_PESSOAL.length]
  );
  renderDistribuicaoPessoal(
    Object.entries(status),
    "graficoStatusDespesas",
    "vazioStatusDespesas",
    "doughnut",
    corStatusDespesa
  );
  renderEvolucaoMensalPessoal(
    despesas,
    "graficoMensalDespesas",
    "vazioMensalDespesas",
    (itemStatus) => itemStatus,
    (itemStatus) => corStatusDespesa(itemStatus, 0)
  );
}

function renderGraficosRecebimentos(recebimentos) {
  const origens = {};
  const status = {};
  recebimentos.forEach((item) => {
    origens[item.origem] = (origens[item.origem] || 0) + Number(item.valor);
    const rotuloStatus = item.status === "Pago" ? "Recebido" : "Pendente";
    status[rotuloStatus] = (status[rotuloStatus] || 0) + Number(item.valor);
  });

  renderDistribuicaoPessoal(
    Object.entries(origens).sort((a, b) => b[1] - a[1]),
    "graficoOrigens",
    "vazioOrigens",
    "pie",
    (_, indice) => PALETA_PESSOAL[indice % PALETA_PESSOAL.length]
  );
  renderDistribuicaoPessoal(
    Object.entries(status),
    "graficoStatusRecebimentos",
    "vazioStatusRecebimentos",
    "doughnut",
    (itemStatus) => itemStatus === "Recebido" ? "#2ecc71" : "#F2C14E"
  );
  renderEvolucaoMensalPessoal(
    recebimentos,
    "graficoMensalRecebimentos",
    "vazioMensalRecebimentos",
    (itemStatus) => itemStatus === "Pago" ? "Recebido" : "Pendente",
    (itemStatus) => itemStatus === "Pago" ? "#2ecc71" : "#F2C14E"
  );
}

function renderTabelaDespesasPessoais(despesas) {
  const corpo = document.getElementById("tabelaDespesas");
  if (!despesas.length) {
    corpo.innerHTML = '<tr><td colspan="5" class="text-secondary text-center">Nenhuma despesa cadastrada.</td></tr>';
    return;
  }
  corpo.innerHTML = despesas.map((item) => `
    <tr>
      <td>${escaparHtmlRelatorio(item.descricao)}</td>
      <td>${escaparHtmlRelatorio(item.categoria)}</td>
      <td>${escaparHtmlRelatorio(dataPessoal(item.vencimento))}</td>
      <td class="text-end">${formatarDinheiroPessoal(item.valor)}</td>
      <td class="${item.status === "Pago" ? "text-success" : "text-warning"}">${escaparHtmlRelatorio(item.status)}</td>
    </tr>`).join("");
}

function renderTabelaRecebimentosPessoais(recebimentos) {
  const corpo = document.getElementById("tabelaRecebimentos");
  if (!recebimentos.length) {
    corpo.innerHTML = '<tr><td colspan="5" class="text-secondary text-center">Nenhum recebimento cadastrado.</td></tr>';
    return;
  }
  corpo.innerHTML = recebimentos.map((item) => `
    <tr>
      <td>${escaparHtmlRelatorio(item.descricao)}</td>
      <td>${escaparHtmlRelatorio(item.origem)}</td>
      <td>${escaparHtmlRelatorio(dataPessoal(item.vencimento))}</td>
      <td class="text-end">${formatarDinheiroPessoal(item.valor)}</td>
      <td class="${item.status === "Pago" ? "text-success" : "text-warning"}">${item.status === "Pago" ? "Recebido" : "Pendente"}</td>
    </tr>`).join("");
}

async function carregarRelatorioPessoal() {
  try {
    const [despesas, recebimentos] = await Promise.all([
      apiPessoal(`${API_PESSOAL}/despesas`),
      apiPessoal(`${API_PESSOAL}/recebimentos`)
    ]);
    if (!Array.isArray(despesas) || !Array.isArray(recebimentos)) {
      throw new Error("A API retornou dados financeiros em formato inválido.");
    }

    renderIndicadoresPessoais(despesas, recebimentos);
    renderGraficosDespesas(despesas);
    renderGraficosRecebimentos(recebimentos);
    renderTabelaDespesasPessoais(despesas);
    renderTabelaRecebimentosPessoais(recebimentos);
  } catch (erro) {
    const aviso = document.getElementById("erro");
    aviso.textContent = erro.message || "Não foi possível carregar os gráficos pessoais.";
    aviso.classList.remove("d-none");
    document.getElementById("tabelaDespesas").innerHTML =
      '<tr><td colspan="5" class="text-secondary text-center">Não foi possível carregar as despesas.</td></tr>';
    document.getElementById("tabelaRecebimentos").innerHTML =
      '<tr><td colspan="5" class="text-secondary text-center">Não foi possível carregar os recebimentos.</td></tr>';
  }
}

carregarRelatorioPessoal();
