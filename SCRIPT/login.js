//======================================================================================================
// FUNÇÃO PRINCIPAL: Inicialização da Tela de Login
// Configura eventos e funcionalidades da tela de login ao carregar a página.
//======================================================================================================
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const togglePwd = document.getElementById('toggle-password');
  const pwdInput = document.getElementById('password');

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
  // FUNÇÃO PRINCIPAL: Enviar Formulário de Login
  // Realiza a autenticação do usuário, envia os dados para o servidor e trata o retorno do login.
  //======================================================================================================
  form.addEventListener('submit', async e => {
    e.preventDefault();
    errorEl.style.display = 'none';

    const username = form.username.value.trim();
    const password = form.password.value;

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
        window.location.href = 'HTML/almoxarifado.html'; // Redireciona após login
      } else {
        errorEl.textContent = result.mensagem || 'Usuário ou senha inválidos.';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      console.error('Erro ao conectar:', err);
      errorEl.textContent = 'Erro ao conectar ao servidor.';
      errorEl.style.display = 'block';
    }
  });
});
