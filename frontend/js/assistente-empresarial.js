const API_URL = window.CASHFLIP_API_BASE;
const TOKEN_EMPRESARIAL = localStorage.getItem("cashflipTokenEmpresarial");
const form = document.getElementById("formIAEmpresarial");
const campo = document.getElementById("perguntaIAEmpresarial");
const chat = document.getElementById("chatEmpresarial");
const botao = document.getElementById("enviarIAEmpresarial");
const aviso = document.getElementById("avisoIAEmpresarial");

function limparSessaoEmpresarial() {
  localStorage.removeItem("cashflipTokenEmpresarial");
  localStorage.removeItem("cashflipEmpresa");
}

function mostrarAviso(texto, tipo = "danger") {
  aviso.className = `alert alert-${tipo} py-2`;
  aviso.textContent = texto;
}

function adicionarMensagem(texto, tipo) {
  const bolha = document.createElement("div");
  bolha.className = `p-2 rounded mb-3 d-inline-block text-white ${tipo === "usuario" ? "bg-danger ms-auto" : "bg-secondary"}`;
  bolha.style.whiteSpace = "pre-wrap";
  bolha.style.overflowWrap = "anywhere";
  bolha.textContent = texto;
  const linha = document.createElement("div");
  linha.className = "d-flex";
  linha.appendChild(bolha);
  chat.appendChild(linha);
  chat.scrollTop = chat.scrollHeight;
  return bolha;
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const pergunta = campo.value.trim();
  if (!pergunta) {
    mostrarAviso("Digite uma pergunta.", "warning");
    return;
  }

  adicionarMensagem(pergunta, "usuario");
  campo.value = "";
  campo.disabled = true;
  botao.disabled = true;
  mostrarAviso("O Gemini está preparando uma resposta...", "info");
  const carregando = adicionarMensagem("Analisando os dados financeiros...", "ia");
  const controlador = new AbortController();
  const tempoLimite = setTimeout(() => controlador.abort(), 125000);
  try {
    const resposta = await fetch(`${API_URL}/assistente/gemini`, {
      method: "POST",
      signal: controlador.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN_EMPRESARIAL}`
      },
      body: JSON.stringify({ pergunta })
    });
    const dados = await resposta.json().catch(() => ({}));
    if (resposta.status === 401) {
      limparSessaoEmpresarial();
      window.location.replace("login-empresarial.html");
      return;
    }
    carregando.textContent = resposta.ok
      ? (dados.resposta || "O Gemini não retornou texto.")
      : (dados.erro || `Erro HTTP ${resposta.status}`);
    mostrarAviso(
      resposta.ok ? "Resposta recebida." : "Não foi possível obter resposta do Gemini.",
      resposta.ok ? "success" : "danger"
    );
  } catch (erro) {
    carregando.textContent = erro.name === "AbortError"
      ? "A resposta do Gemini demorou mais que o esperado. Tente novamente."
      : "Não foi possível conectar ao backend. Confira se o Flask está em execução e se GEMINI_API_KEY está configurada.";
    mostrarAviso("Falha de conexão.");
  } finally {
    clearTimeout(tempoLimite);
    campo.disabled = false;
    botao.disabled = false;
    campo.focus();
  }
});

document.getElementById("linkSair").addEventListener("click", async (evento) => {
  evento.preventDefault();
  try {
    const resposta = await fetch(`${API_URL}/empresarial/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN_EMPRESARIAL}` }
    });
    if (!resposta.ok && resposta.status !== 401) {
      throw new Error(`A API não confirmou o encerramento da sessão (HTTP ${resposta.status}).`);
    }
  } catch (erro) {
    console.error("Erro ao encerrar a sessão empresarial:", erro);
  } finally {
    limparSessaoEmpresarial();
    window.location.href = "login-empresarial.html";
  }
});

async function iniciarAssistenteEmpresarial() {
  if (!TOKEN_EMPRESARIAL) {
    window.location.replace("login-empresarial.html");
    return;
  }
  try {
    const resposta = await fetch(`${API_URL}/empresarial/me`, {
      headers: { Authorization: `Bearer ${TOKEN_EMPRESARIAL}` }
    });
    if (!resposta.ok) {
      limparSessaoEmpresarial();
      window.location.replace("login-empresarial.html");
      return;
    }
    const empresa = await resposta.json();
    document.getElementById("nomeEmpresa").textContent = empresa.nome;
  } catch (erro) {
    console.error("Não foi possível validar a sessão empresarial:", erro);
    mostrarAviso("Não foi possível conectar à API. Verifique se o backend está rodando na porta 5000.");
  }
}

iniciarAssistenteEmpresarial();
