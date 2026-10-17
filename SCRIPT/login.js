//======================================================================================================
// FUNÇÃO PRINCIPAL: Inicialização da Tela de Login
// Configura eventos e funcionalidades da tela de login ao carregar a página.
//======================================================================================================
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const togglePwd = document.getElementById('toggle-password');
  const pwdInput = document.getElementById('password');

  // Logo do login enchendo de petróleo: enche ao abrir a página e volta a
  // encher enquanto espera a resposta do servidor ao entrar.
  const logoEl = document.getElementById('logo-login');
  let logo = null;
  if (logoEl && window.LogoLiquido) {
    const largura = Math.round(logoEl.getBoundingClientRect().width) || 320;
    logo = window.LogoLiquido.montar(logoEl, { largura, altura: Math.round(largura * 581 / 800) });
    logo.encherUmaVez();
  }

  //======================================================================================================
  // FUNÇÃO PRINCIPAL: Alternar Visibilidade da Senha
  // Alterna o tipo do campo de senha entre texto e senha, permitindo ao usuário visualizar ou ocultar a senha digitada.
  //======================================================================================================
  togglePwd.addEventListener('click', () => {
    const type = pwdInput.type === 'password' ? 'text' : 'password';
    pwdInput.type = type;
    const visivel = type === 'text';
    togglePwd.classList.toggle('visivel', visivel);
    togglePwd.setAttribute('aria-label', visivel ? 'Ocultar senha' : 'Mostrar senha');
    togglePwd.title = visivel ? 'Ocultar senha' : 'Mostrar senha';
  });


  //======================================================================================================
  // PÁGINA INICIAL
  // Abre o módulo escolhido no cadastro do usuário (se ele tiver acesso);
  // senão, o primeiro que ele pode ver, na mesma ordem do menu do topo.
  //======================================================================================================
  const PAGINAS = {
    ordens: 'HTML/ordens.html',
    almoxarifado: 'HTML/almoxarifado.html',
    frota: 'HTML/frota.html',
    jornada: 'HTML/jornada.html',
  };
  const ORDEM = ['ordens', 'almoxarifado', 'frota', 'jornada', 'gestao'];

  function paginaDe(modulo, m) {
    if (modulo === 'gestao') {
      if (m.gestao) return 'HTML/gestao.html';
      if (m.relatorios) return 'HTML/relatorios.html';
      if (m.cadastros) return 'HTML/cadastros.html';
      const p = m.permissoes;
      if (m.jornada && (!p || (p.jornada_admin || {}).ver)) return 'HTML/gestao.html#jornadas';
      return null;
    }
    return m[modulo] ? PAGINAS[modulo] : null;
  }

  async function destinoInicial(token) {
    try {
      const res = await fetch(apiUrl('/modulos'), { headers: { Authorization: 'Bearer ' + token } });
      const info = await res.json();
      const m = info.modulos || {};
      const preferida = info.pagina_inicial && paginaDe(info.pagina_inicial, m);
      if (preferida) return preferida;
      for (const modulo of ORDEM) {
        const pagina = paginaDe(modulo, m);
        if (pagina) return pagina;
      }
    } catch (e) { /* sem resposta: segue o padrão */ }
    return 'HTML/ordens.html';
  }

  //======================================================================================================
  // FUNÇÃO PRINCIPAL: Enviar Formulário de Login
  // Realiza a autenticação do usuário, envia os dados para o servidor e trata o retorno do login.
  //======================================================================================================
  form.addEventListener('submit', async e => {
    e.preventDefault();
    errorEl.style.display = 'none';

    const username = form.username.value.trim();
    const password = form.password.value;

    const fimEspera = logo ? logo.aguardar() : () => {};
    try {
      const res = await fetch(apiUrl('/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const result = await res.json();

      // Log completo da resposta do servidor (útil para debug)
      console.log('Resposta do servidor:', result);

      if (res.ok && result.status === 'ok') {
        // Salva dados no navegador
        localStorage.setItem('usuario', JSON.stringify(result.usuario));
        localStorage.setItem('token', result.token);
        window.location.href = await destinoInicial(result.token);
      } else {
        errorEl.textContent = result.mensagem || 'Usuário ou senha inválidos.';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      console.error('Erro ao conectar:', err);
      errorEl.textContent = 'Erro ao conectar ao servidor.';
      errorEl.style.display = 'block';
    } finally {
      fimEspera();
    }
  });
});
