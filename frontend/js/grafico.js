const API_URL = window.CASHFLIP_API_BASE;
const TOKEN_EMPRESARIAL = localStorage.getItem("cashflipTokenEmpresarial");
const URL_DESPESAS = `${API_URL}/empresarial/despesas`;
const URL_RECEBIMENTOS = `${API_URL}/empresarial/recebimentos`;

// Cores
const PALETA = [
  "#B31B1B", "#E8743B", "#F2C14E", "#4CAF7A", "#3FA7D6", "#8E6FD8",
  "#D96FA8", "#2EC4B6", "#9BC53D", "#C77DFF", "#FF9F9F", "#E0B1CB", "#8A8D91"
];
const COR_STATUS = { "Pago": "#2ecc71", "Pendente": "#F2C14E" };
const corStatus = (s, i) => COR_STATUS[s] || PALETA[(i + 3) % PALETA.length];

// Tema escuro do Chart.js
Chart.defaults.color = "#adb5bd";
Chart.defaults.borderColor = "rgba(255,255,255,0.08)";
Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

// Utilitários
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (ym) => { const [a, m] = ym.split("-"); return `${MESES[Number(m) - 1]}/${a}`; };
const dataBR = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}/${a}`; };
const escapeHtml = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const somar = (lista) => lista.reduce((acc, d) => acc + Number(d.valor || 0), 0);

const tooltipComPercentual = {
  callbacks: {
    label: (ctx) => {
      const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
      const pct = total ? (ctx.parsed / total) * 100 : 0;
      return ` ${ctx.label}: ${brl(ctx.parsed)} (${pct.toFixed(1).replace(".", ",")}%)`;
    }
  }
};

let graficos = {};
const recriar = (id, config) => {
  if (graficos[id]) graficos[id].destroy();
  graficos[id] = new Chart(document.getElementById(id), config);
};
const alternarVazio = (idVazio, idCanvas, vazio) => {
  document.getElementById(idVazio).style.display = vazio ? "flex" : "none";
  document.getElementById(idCanvas).style.display = vazio ? "none" : "block";
};

// Indicadores
function renderIndicadores(despesas) {
  const pago = somar(despesas.filter((d) => d.status === "Pago"));
  const pendente = somar(despesas.filter((d) => d.status === "Pendente"));
  document.getElementById("kpiTotal").textContent = brl(somar(despesas));
  document.getElementById("kpiPago").textContent = brl(pago);
  document.getElementById("kpiPendente").textContent = brl(pendente);
}

function renderIndicadoresRecebimentos(recebimentos) {
  const recebido = somar(recebimentos.filter((r) => r.status === "Pago"));
  const pendente = somar(recebimentos.filter((r) => r.status === "Pendente"));
  document.getElementById("kpiRecebimentos").textContent = brl(somar(recebimentos));
  document.getElementById("kpiRecebido").textContent = brl(recebido);
  document.getElementById("kpiAReceber").textContent = brl(pendente);
}

function renderDistribuicao(itens, canvasId, vazioId, tipo, cores) {
  alternarVazio(vazioId, canvasId, itens.length === 0);
  if (!itens.length) return;

  recriar(canvasId, {
    type: tipo,
    data: {
      labels: itens.map((i) => i[0]),
      datasets: [{
        data: itens.map((i) => i[1]),
        backgroundColor: itens.map((item, i) => cores(item[0], i)),
        borderColor: "#000",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "right", labels: { boxWidth: 12 } },
        tooltip: tooltipComPercentual
      }
    }
  });
}

function renderCategorias(despesas) {
  const porCategoria = {};
  despesas.forEach((d) => { porCategoria[d.categoria] = (porCategoria[d.categoria] || 0) + Number(d.valor); });
  const itens = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
  renderDistribuicao(itens, "graficoCategorias", "vazioCategorias", "pie", (_, i) => PALETA[i % PALETA.length]);
}

function renderStatus(despesas) {
  const porStatus = {};
  despesas.forEach((d) => { porStatus[d.status] = (porStatus[d.status] || 0) + Number(d.valor); });
  const itens = Object.entries(porStatus);
  renderDistribuicao(itens, "graficoStatus", "vazioStatus", "doughnut", corStatus);
}

function renderOrigens(recebimentos) {
  const porOrigem = {};
  recebimentos.forEach((r) => { porOrigem[r.origem] = (porOrigem[r.origem] || 0) + Number(r.valor); });
  const itens = Object.entries(porOrigem).sort((a, b) => b[1] - a[1]);
  renderDistribuicao(itens, "graficoOrigens", "vazioOrigens", "pie", (_, i) => PALETA[i % PALETA.length]);
}

function renderStatusRecebimentos(recebimentos) {
  const porStatus = {};
  recebimentos.forEach((r) => {
    const status = r.status === "Pago" ? "Recebido" : "Pendente";
    porStatus[status] = (porStatus[status] || 0) + Number(r.valor);
  });
  renderDistribuicao(
    Object.entries(porStatus),
    "graficoStatusRecebimentos",
    "vazioStatusRecebimentos",
    "doughnut",
    (status) => status === "Recebido" ? "#2ecc71" : "#F2C14E"
  );
}

function renderEvolucaoMensal(lancamentos, canvasId, vazioId, rotuloStatus = (status) => status, corDataset = corStatus) {
  const meses = [...new Set(lancamentos.map((item) => String(item.vencimento).slice(0, 7)))].sort();
  const status = [...new Set(lancamentos.map((item) => item.status))];

  alternarVazio(vazioId, canvasId, meses.length === 0);
  if (!meses.length) return;

  const datasets = status.map((s, idx) => ({
    label: rotuloStatus(s),
    data: meses.map((m) => somar(lancamentos.filter((item) => item.status === s && String(item.vencimento).slice(0, 7) === m))),
    backgroundColor: corDataset(s, idx),
    borderRadius: 4
  }));

  recriar(canvasId, {
    type: "bar",
    data: { labels: meses.map(rotuloMes), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { callback: (v) => brl(v) } }
      },
      plugins: {
        legend: { position: "top", labels: { boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${brl(ctx.parsed.y)}`,
            footer: (items) => "Total: " + brl(items.reduce((a, i) => a + i.parsed.y, 0))
          }
        }
      }
    }
  });
}

function renderMensal(despesas) {
  renderEvolucaoMensal(despesas, "graficoMensal", "vazioMensal");
}

function renderMensalRecebimentos(recebimentos) {
  renderEvolucaoMensal(
    recebimentos,
    "graficoMensalRecebimentos",
    "vazioMensalRecebimentos",
    (status) => status === "Pago" ? "Recebido" : "Pendente",
    (status) => status === "Pago" ? "#2ecc71" : "#F2C14E"
  );
}

// Tabela
function renderTabela(despesas) {
  const corpo = document.getElementById("tabelaResumo");
  if (!despesas.length) {
    corpo.innerHTML = '<tr><td colspan="5" class="text-secondary text-center">Nenhuma despesa cadastrada.</td></tr>';
    return;
  }
  corpo.innerHTML = despesas.map((d) => `
    <tr>
      <td>${escapeHtml(d.descricao)}</td>
      <td>${escapeHtml(d.categoria)}</td>
      <td>${dataBR(d.vencimento)}</td>
      <td class="text-end">${brl(d.valor)}</td>
      <td class="${d.status === "Pago" ? "text-success" : "text-danger"}">${escapeHtml(d.status)}</td>
    </tr>`).join("");
}

async function carregar() {
  try {
    if (!TOKEN_EMPRESARIAL) {
      window.location.replace("login-empresarial.html");
      return;
    }
    if (TOKEN_EMPRESARIAL) {
      const auth = await fetch(`${API_URL}/empresarial/me`, {
        headers: { Authorization: `Bearer ${TOKEN_EMPRESARIAL}` }
      });
      if (!auth.ok) {
        localStorage.removeItem("cashflipTokenEmpresarial");
        localStorage.removeItem("cashflipEmpresa");
        window.location.replace("login-empresarial.html");
        return;
      }
      const empresa = await auth.json();
      document.getElementById("linkRecebimentos").classList.remove("d-none");
      document.getElementById("linkAssistenteEmpresa").classList.remove("d-none");
      document.getElementById("nomeEmpresa").textContent = empresa.nome;
      document.getElementById("nomeEmpresa").classList.remove("d-none");
      document.getElementById("linkSair").textContent = "Sair da empresa";
      document.getElementById("linkSair").addEventListener("click", async (evento) => {
        evento.preventDefault();
        try {
          await fetch(`${API_URL}/empresarial/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${TOKEN_EMPRESARIAL}` }
          });
        } finally {
          localStorage.removeItem("cashflipTokenEmpresarial");
          localStorage.removeItem("cashflipEmpresa");
          window.location.href = "login-empresarial.html";
        }
      });
    }
    const resp = await fetch(URL_DESPESAS, {
      headers: TOKEN_EMPRESARIAL ? { Authorization: `Bearer ${TOKEN_EMPRESARIAL}` } : {}
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const despesas = await resp.json();
    const respRecebimentos = await fetch(URL_RECEBIMENTOS, {
      headers: { Authorization: `Bearer ${TOKEN_EMPRESARIAL}` }
    });
    if (!respRecebimentos.ok) throw new Error("Não foi possível carregar os recebimentos empresariais (HTTP " + respRecebimentos.status + ").");
    const recebimentos = await respRecebimentos.json();

    document.getElementById("erroApi").classList.add("d-none");
    renderIndicadores(despesas);
    renderIndicadoresRecebimentos(recebimentos);
    renderCategorias(despesas);
    renderStatus(despesas);
    renderMensal(despesas);
    renderOrigens(recebimentos);
    renderStatusRecebimentos(recebimentos);
    renderMensalRecebimentos(recebimentos);
    renderTabela(despesas);
  } catch (e) {
    console.error(e);
    const erro = document.getElementById("erroApi");
    erro.textContent = e.message || "Não foi possível carregar os dados empresariais.";
    erro.classList.remove("d-none");
    document.getElementById("tabelaResumo").innerHTML =
      '<tr><td colspan="5" class="text-secondary text-center">Sem dados.</td></tr>';
  }
}

carregar();
