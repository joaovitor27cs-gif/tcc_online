const API_PESSOAL = `${window.CASHFLIP_API_BASE}/pessoal`;
const tokenPessoal = localStorage.getItem("cashflipTokenPessoal");
if (!tokenPessoal) location.replace("login.html");

async function apiPessoal(url, options = {}) {
  let resposta;
  try {
    resposta = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${tokenPessoal}`,
        ...options.headers
      }
    });
  } catch (erro) {
    if (erro.name === "AbortError") throw erro;
    throw new Error("Não foi possível conectar. Inicie o backend Flask na porta 5000.");
  }

  const dados = await resposta.json().catch(() => ({}));
  if (resposta.status === 401) {
    localStorage.removeItem("cashflipTokenPessoal");
    localStorage.removeItem("cashflipPessoa");
    location.replace("login.html");
    throw new Error("Sessão encerrada.");
  }
  if (!resposta.ok) throw new Error(dados.erro || `Erro HTTP ${resposta.status}`);
  return dados;
}

const dinheiroPessoal = valor => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const escaparPessoal = valor => String(valor ?? "").replace(/[&<>"']/g, caractere => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[caractere]));
const dataPessoal = valor => {
  const [ano, mes, dia] = String(valor || "").slice(0, 10).split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : "";
};

const pessoaSalva = JSON.parse(localStorage.getItem("cashflipPessoa") || "{}");
const nomePessoaEl = document.getElementById("nomePessoa");
if (nomePessoaEl) nomePessoaEl.textContent = pessoaSalva.nome || "pessoa";

const sairEl = document.getElementById("sair");
if (sairEl) {
  sairEl.addEventListener("click", async evento => {
    evento.preventDefault();
    try {
      await apiPessoal(`${API_PESSOAL}/logout`, { method: "POST" });
    } catch (erro) {
      console.error("Erro ao encerrar a sessão pessoal:", erro);
    } finally {
      localStorage.removeItem("cashflipTokenPessoal");
      localStorage.removeItem("cashflipPessoa");
      location.href = "login.html";
    }
  });
}
