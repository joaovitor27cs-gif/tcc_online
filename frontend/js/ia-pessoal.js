const formIA = document.getElementById("formPergunta");
const campoMensagemIA = document.getElementById("mensagem");
const chatIA = document.getElementById("chat");
const botaoIA = document.getElementById("enviar");
const avisoIA = document.getElementById("aviso");

function adicionarMensagemIA(texto, tipo) {
  const linha = document.createElement("div");
  linha.className = "message-row";
  const bolha = document.createElement("div");
  bolha.className = `bubble ${tipo === "usuario" ? "user" : "bot"}`;
  bolha.textContent = texto;
  linha.appendChild(bolha);
  chatIA.appendChild(linha);
  chatIA.scrollTop = chatIA.scrollHeight;
  return bolha;
}

formIA.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const mensagem = campoMensagemIA.value.trim();
  if (!mensagem) return;

  adicionarMensagemIA(mensagem, "usuario");
  campoMensagemIA.value = "";
  campoMensagemIA.disabled = true;
  botaoIA.disabled = true;
  avisoIA.className = "alert alert-info mt-3 mb-0";
  avisoIA.textContent = "O Gemini está analisando seus dados financeiros...";
  const bolhaResposta = adicionarMensagemIA("Analisando seus dados financeiros...", "ia");
  const controlador = new AbortController();
  const tempoLimite = setTimeout(() => controlador.abort(), 125000);

  try {
    const dados = await apiPessoal(`${API_PESSOAL}/assistente/gemini`, {
      method: "POST",
      signal: controlador.signal,
      body: JSON.stringify({ pergunta: mensagem })
    });
    bolhaResposta.textContent = dados.resposta || "O Gemini não retornou uma resposta.";
    avisoIA.className = "alert alert-success mt-3 mb-0";
    avisoIA.textContent = "Resposta recebida.";
  } catch (erro) {
    bolhaResposta.textContent = erro.name === "AbortError"
      ? "A resposta do Gemini demorou mais que o esperado. Tente novamente."
      : erro.message || "Não foi possível obter uma resposta do Gemini.";
    avisoIA.className = "alert alert-danger mt-3 mb-0";
    avisoIA.textContent = erro.name === "AbortError"
      ? "O Gemini não respondeu a tempo."
      : erro.message || "Não foi possível consultar a IA.";
  } finally {
    clearTimeout(tempoLimite);
    campoMensagemIA.disabled = false;
    botaoIA.disabled = false;
    campoMensagemIA.focus();
  }
});

document.querySelectorAll(".sugestao").forEach((botao) => {
  botao.addEventListener("click", () => {
    campoMensagemIA.value = botao.textContent.trim();
    campoMensagemIA.focus();
  });
});
