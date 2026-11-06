const API_EMPRESA = `${window.CASHFLIP_API_BASE}/empresarial`;
const avisoEmpresa = document.getElementById("mensagemEmpresa");

function alternarPainel(idPainel) {
  const painelLogin = document.getElementById("painelLogin");
  const painelCadastro = document.getElementById("painelCadastro");
  const exibirCadastro = idPainel === "painelCadastro";
  painelLogin.classList.toggle("active", !exibirCadastro);
  painelLogin.classList.toggle("show", !exibirCadastro);
  painelCadastro.classList.toggle("active", exibirCadastro);
  painelCadastro.classList.toggle("show", exibirCadastro);
  document.getElementById("tabLogin").setAttribute("aria-selected", String(!exibirCadastro));
  document.getElementById("tabCadastro").setAttribute("aria-selected", String(exibirCadastro));
}

function mostrarAvisoEmpresa(texto, tipo = "danger") {
  avisoEmpresa.textContent = texto;
  avisoEmpresa.className = `alert alert-${tipo}`;
}

async function enviarFormularioEmpresa(url, dados) {
  let resposta;
  try {
    resposta = await fetch(`${API_EMPRESA}/${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
  } catch {
    throw new Error("Não foi possível conectar à API. Inicie o backend na porta 5000.");
  }

  const retorno = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(retorno?.erro || `Erro na API (HTTP ${resposta.status}).`);
  }
  return retorno;
}

document.getElementById("tabLogin").addEventListener("click", () => alternarPainel("painelLogin"));
document.getElementById("tabCadastro").addEventListener("click", () => alternarPainel("painelCadastro"));

document.getElementById("formCadastroEmpresa").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  avisoEmpresa.className = "alert d-none";
  const botao = document.getElementById("botaoCadastroEmpresa");
  botao.disabled = true;
  try {
    await enviarFormularioEmpresa("cadastro", {
      nome: document.getElementById("nomeEmpresa").value.trim(),
      email: document.getElementById("emailCadastro").value.trim(),
      senha: document.getElementById("senhaCadastro").value
    });
    formulario.reset();
    alternarPainel("painelLogin");
    mostrarAvisoEmpresa("Empresa cadastrada. Agora entre com o e-mail e a senha cadastrados.", "success");
  } catch (erro) {
    mostrarAvisoEmpresa(erro.message);
  } finally {
    botao.disabled = false;
  }
});

document.getElementById("formLoginEmpresa").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  avisoEmpresa.className = "alert d-none";
  const botao = document.getElementById("botaoLoginEmpresa");
  botao.disabled = true;
  try {
    const sessao = await enviarFormularioEmpresa("login", {
      email: document.getElementById("emailLogin").value.trim(),
      senha: document.getElementById("senhaLogin").value
    });
    localStorage.setItem("cashflipTokenEmpresarial", sessao.token);
    localStorage.setItem("cashflipEmpresa", JSON.stringify(sessao.empresa));
    window.location.href = "despesas.html";
  } catch (erro) {
    mostrarAvisoEmpresa(erro.message);
  } finally {
    botao.disabled = false;
  }
});
