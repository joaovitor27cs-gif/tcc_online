const API = `${window.CASHFLIP_API_BASE}/pessoal`;
const formulario = document.getElementById("formLogin");
formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const mensagem = document.getElementById("mensagem");
  const botao = formulario.querySelector("button[type=submit]");
  mensagem.className = "text-center mt-3";
  mensagem.textContent = "Verificando acesso...";
  botao.disabled = true;
  try {
    const resposta = await fetch(`${API}/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: document.getElementById("email").value.trim(), senha: document.getElementById("senha").value })
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || "Não foi possível entrar.");
    localStorage.setItem("cashflipTokenPessoal", dados.token);
    localStorage.setItem("cashflipPessoa", JSON.stringify(dados.pessoa));
    localStorage.removeItem("cashflipTokenEmpresarial");
    localStorage.removeItem("cashflipEmpresa");
    window.location.href = "painel-pessoal.html";
  } catch (erro) {
    mensagem.className = "text-center mt-3 text-danger";
    mensagem.textContent = erro.message;
  } finally { botao.disabled = false; }
});
