//======================================================================================================
// FONTE ÚNICA DOS MÓDULOS PERMITIDOS
// Antes a resposta de /modulos era lida em dois caminhos separados (cache e
// fetch), cada um com a sua cópia do laço que aplica as permissões ao menu,
// duas cópias da mesma regra, que podiam divergir. Aqui vira uma promessa só,
// reaproveitada por quem precisar (menu principal e barra de Gestão), sem
// disparar dois fetches na mesma carga de página.
//======================================================================================================
let _promessaModulos = null;
window.obterModulos = function obterModulos() {
  if (_promessaModulos) return _promessaModulos;

  // Sempre pergunta ao servidor: as permissões podem ter mudado desde o login
  // (perfil alterado, módulo novo). A cópia guardada só é usada se o servidor
  // não responder, para o menu não sumir sem conexão.
  const cache = (() => {
    try { return JSON.parse(localStorage.getItem('userData') || 'null'); } catch (e) { return null; }
  })();
  const token = localStorage.getItem('token');
  _promessaModulos = fetch(apiUrl('/modulos'), {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
  })
    .then(res => res.json())
    .then(data => {
      if (data.status !== 'ok') throw new Error(data.mensagem || 'Falha ao obter módulos');
      const info = { usuario: data.usuario, modulos: data.modulos };
      localStorage.setItem('userData', JSON.stringify(info));
      return info;
    })
    .catch(erro => {
      if (cache) return cache;
      throw erro;
    });
  return _promessaModulos;
};

//======================================================================================================
// FUNÇÃO PRINCIPAL: Inicialização do Sistema
// Inicializa o sistema ao carregar a página, configurando módulos, autenticação, eventos de interface e responsividade.
//======================================================================================================
document.addEventListener('DOMContentLoaded', async function () {
  const moduleTabs = document.querySelectorAll('.top-tab');
  const modules = {
    almoxarifado: 'almoxarifado.html',
    frota: 'frota.html',
    ordens: 'ordens.html',
    gestao: 'gestao.html',
    relatorios: 'relatorios.html',
    cadastros: 'cadastros.html',
    jornada: 'jornada.html'
  };

  const userNameElement = document.getElementById('logged-user');
  const userIconElement = document.querySelector('.user-icon'); // Elemento da imagem do usuário
  let token = localStorage.getItem('token');
  
  if (!token) {
    console.error('Token não encontrado. Faça login novamente.');
    return;
  }

  //  PEGA OS DADOS DO USUÁRIO DO LOCALSTORAGE COM A CHAVE CORRETA
  const usuarioData = localStorage.getItem('usuario');
  let userId = null;
  let username = null;
  
  if (usuarioData) {
    try {
      const parsedUsuarioData = JSON.parse(usuarioData);
      userId = parsedUsuarioData.id;
      username = parsedUsuarioData.username;
    } catch (error) {
      console.error('❌ Erro ao parsear usuarioData do localStorage:', error);
    }
  }

  //======================================================================================================
  // FUNÇÃO PRINCIPAL: Calcular Tempo Restante do Token
  // Calcula o tempo restante até a expiração do token JWT do usuário.
  //======================================================================================================
  function calcularTempoRestanteToken() {
    try {
      if (!token) return 'Token não encontrado';
      
      // Decodifica o token JWT (apenas o payload, sem verificar assinatura)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const payload = JSON.parse(jsonPayload);
      const exp = payload.exp; // Timestamp de expiração
      
      if (!exp) return 'Token sem expiração definida';
      
      const agora = Math.floor(Date.now() / 1000); // Timestamp atual em segundos
      const tempoRestante = exp - agora;
      
      if (tempoRestante <= 0) {
        return 'Token expirado';
      }
      
      // Converte segundos para horas, minutos e segundos
      const horas = Math.floor(tempoRestante / 3600);
      const minutos = Math.floor((tempoRestante % 3600) / 60);
      const segundos = tempoRestante % 60;
      
      return `${horas}h ${minutos}m ${segundos}s`;
      
    } catch (error) {
      console.error('Erro ao calcular tempo do token:', error);
      return 'Erro ao calcular tempo';
    }
  }


  //======================================================================================================
  // FUNÇÃO PRINCIPAL: Verificar Token Expirado
  // Verifica se o token JWT está expirado e executa ações de segurança caso necessário.
  //======================================================================================================
  function verificarTokenExpirado() {
    // Em modo local/desenvolvimento, não redireciona por token expirado
    // (o ambiente é definido pela detecção automática do config.js)
    if (window.API_EM_DESENVOLVIMENTO) {
      return false;
    }
    try {
      if (!token) {
        console.log('🔒 Token não encontrado, redirecionando para login...');
        limparStorageERedirecionarLogin();
        return true;
      }
      
      // Decodifica o token JWT
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const payload = JSON.parse(jsonPayload);
      const exp = payload.exp; // Timestamp de expiração
      
      if (!exp) {
        console.warn('⚠️ Token sem expiração definida');
        return false;
      }
      
      const agora = Math.floor(Date.now() / 1000); // Timestamp atual em segundos
      const tempoRestante = exp - agora;
      
      if (tempoRestante <= 0) {
        console.log('🔒 Token expirado, redirecionando para login...');
        limparStorageERedirecionarLogin();
        return true;
      }
      
      //  AVISO QUANDO FALTAM MENOS DE 5 MINUTOS
      if (tempoRestante <= 300) { // 5 minutos = 300 segundos
        console.warn(`⏰ Token expira em ${Math.floor(tempoRestante / 60)} minutos!`);
        mostrarAvisoTokenProximoVencimento(tempoRestante);
      }
      
      return false;
      
    } catch (error) {
      console.error('❌ Erro ao verificar token:', error);
      limparStorageERedirecionarLogin();
      return true;
    }
  }

  //======================================================================================================
  // FUNÇÃO PRINCIPAL: Limpar Storage e Redirecionar para Login
  // Limpa o localStorage e redireciona o usuário para a tela de login.
  //======================================================================================================
  function limparStorageERedirecionarLogin() {
    // Delegado ao config.js para que todas as telas encerrem a sessao do mesmo jeito
    if (typeof window.encerrarSessao === 'function') {
      window.encerrarSessao();
      return;
    }
    localStorage.clear();
    window.location.href = /\/HTML\//i.test(window.location.pathname) ? '../index.html' : 'index.html';
  }


  //======================================================================================================
  // FUNÇÃO PRINCIPAL: Mostrar Aviso de Token Próximo ao Vencimento
  // Exibe um banner de aviso quando o token está próximo do vencimento.
  // @param {number} tempoRestante - Tempo restante em segundos para expiração do token.
  //======================================================================================================
  function mostrarAvisoTokenProximoVencimento(tempoRestante) {
    // Se a caixa de senha já está aberta, não mostra o aviso por cima.
    if (document.getElementById('sessao-renovar-fundo')) return;
    let banner = document.getElementById('token-warning-banner');
    const minutos = Math.floor(tempoRestante / 60);
    const segundos = tempoRestante % 60;
    const texto = 'Sua sessão expira em ' + minutos + 'm ' + String(segundos).padStart(2, '0') + 's.';

    if (banner) {
      if (banner.dataset.fechado === '1') return;
      const t = banner.querySelector('.sessao-aviso-texto');
      if (t) t.textContent = texto;
      return;
    }

    banner = document.createElement('div');
    banner.id = 'token-warning-banner';
    banner.className = 'sessao-aviso';
    banner.setAttribute('role', 'alert');
    banner.innerHTML =
      '<span class="sessao-aviso-texto"></span>' +
      '<button type="button" class="sessao-aviso-continuar">Continuar conectado</button>' +
      '<button type="button" class="sessao-aviso-fechar" aria-label="Fechar aviso">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    banner.querySelector('.sessao-aviso-texto').textContent = texto;
    document.body.appendChild(banner);

    banner.querySelector('.sessao-aviso-continuar').addEventListener('click', abrirRenovacaoSessao);
    banner.querySelector('.sessao-aviso-fechar').addEventListener('click', () => {
      banner.dataset.fechado = '1';
      banner.remove();
    });

    // compatibilidade com chamadas antigas
    window.renovarSessao = abrirRenovacaoSessao;
    window.fecharAviso = () => banner.remove();
  }

  // Caixa flutuante: digita só a senha e continua na mesma página.
  function abrirRenovacaoSessao() {
    if (document.getElementById('sessao-renovar-fundo')) return;
    let usuarioLogado = {};
    try { usuarioLogado = JSON.parse(localStorage.getItem('usuario') || '{}') || {}; } catch (e) { usuarioLogado = {}; }
    const login = usuarioLogado.usuario || usuarioLogado.username || usuarioLogado.login || '';
    if (!login) { limparStorageERedirecionarLogin(); return; }

    const fundo = document.createElement('div');
    fundo.id = 'sessao-renovar-fundo';
    fundo.className = 'sessao-renovar-fundo';
    fundo.innerHTML =
      '<form class="sessao-renovar" role="dialog" aria-modal="true" aria-labelledby="sessao-renovar-titulo">' +
        '<h4 id="sessao-renovar-titulo">Continuar conectado</h4>' +
        '<p class="sessao-renovar-usuario"></p>' +
        '<input type="password" class="sessao-renovar-senha" placeholder="Senha" autocomplete="current-password" required />' +
        '<p class="sessao-renovar-erro" hidden></p>' +
        '<div class="sessao-renovar-acoes">' +
          '<button type="button" class="sessao-renovar-sair">Sair</button>' +
          '<button type="submit" class="sessao-renovar-ok">Continuar</button>' +
        '</div>' +
      '</form>';
    fundo.querySelector('.sessao-renovar-usuario').textContent = 'Digite a senha de ' + login + ' para continuar nesta página.';
    document.body.appendChild(fundo);
    document.getElementById('token-warning-banner')?.remove();

    const form = fundo.querySelector('form');
    const campo = fundo.querySelector('.sessao-renovar-senha');
    const erro = fundo.querySelector('.sessao-renovar-erro');
    const botao = fundo.querySelector('.sessao-renovar-ok');
    setTimeout(() => campo.focus(), 30);

    fundo.querySelector('.sessao-renovar-sair').addEventListener('click', limparStorageERedirecionarLogin);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      erro.hidden = true;
      botao.disabled = true;
      botao.textContent = 'Entrando...';
      try {
        const resp = await originalFetch(window.apiUrl('/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: login, password: campo.value }),
        });
        const dados = await resp.json().catch(() => ({}));
        if (!resp.ok || dados.status !== 'ok' || !dados.token) {
          throw new Error(dados.mensagem || 'Senha incorreta.');
        }
        localStorage.setItem('token', dados.token);
        if (dados.usuario) localStorage.setItem('usuario', JSON.stringify(dados.usuario));
        token = dados.token;
        fundo.remove();
      } catch (err) {
        erro.textContent = err.message || 'Não foi possível continuar.';
        erro.hidden = false;
        campo.select();
      } finally {
        botao.disabled = false;
        botao.textContent = 'Continuar';
      }
    });
  }

  //  VERIFICAÇÃO INICIAL DO TOKEN
  if (verificarTokenExpirado()) {
    return; // Para a execução se o token estiver expirado
  }

  //  MONITORAMENTO CONTÍNUO DO TOKEN (verifica a cada 30 segundos)
  window.tokenMonitorInterval = setInterval(() => {
    console.log('🔍 Verificando status do token...');
    verificarTokenExpirado();
  }, 30000); // 30 segundos

  //  VERIFICA TOKEN ANTES DE FAZER REQUISIÇÕES IMPORTANTES
  window.addEventListener('beforeunload', () => {
    clearInterval(window.tokenMonitorInterval);
    clearInterval(window.tokenCountdownInterval);
  });

  //  INTERCEPTA ERROS 401 (Unauthorized) EM FETCH REQUESTS
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    return originalFetch.apply(this, args)
      .then(response => {
        if (response.status === 401) {
          console.log(' Resposta 401 recebida - Token inválido ou expirado');
          limparStorageERedirecionarLogin();
        }
        return response;
      })
      .catch(error => {
        console.error('❌ Erro na requisição:', error);
        throw error;
      });
  };

  //======================================================================================================
  // FUNÇÃO PRINCIPAL: Criar Modal de Perfil do Usuário
  // Cria e exibe o modal de perfil do usuário com informações e opções de sessão.
  // @returns {HTMLElement} Elemento do modal criado.
  //======================================================================================================
  function criarModalPerfil() {
    // Verifica token antes de mostrar modal
    if (verificarTokenExpirado()) {
      return;
    }
    
    // Remove modal existente se houver
    const modalExistente = document.getElementById('user-profile-modal');
    if (modalExistente) {
      modalExistente.remove();
    }
    
    // Cria o modal
    const modal = document.createElement('div');
    modal.id = 'user-profile-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 2000;
      animation: fadeIn 0.3s ease;
    `;
    
    // Conteúdo do modal
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      padding: 30px;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 90%;
      text-align: center;
      position: relative;
      animation: slideIn 0.3s ease;
    `;
    
    // Obtém dados do usuário
    const usuarioCompleto = JSON.parse(localStorage.getItem('usuario') || '{}');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const imagemUsuario = localStorage.getItem(`imagem_usuario_${userId}`);
    
    // HTML do modal
    modalContent.innerHTML = `
      <div style="position: absolute; top: 10px; right: 15px;">
        <button id="close-profile-modal" style="
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">×</button>
      </div>
      
      <div style="margin-bottom: 20px;">
        <img id="profile-photo" src="${imagemUsuario || '../IMG/default-user.png'}" 
             style="
               width: 100px;
               height: 100px;
               border-radius: 50%;
               object-fit: cover;
               border: 4px solid #475569;
               margin-bottom: 15px;
               cursor: pointer;
               transition: transform 0.2s ease, box-shadow 0.2s ease;
             "
             title="Clique para expandir a foto">
        <h3 style="margin: 0; color: #333; font-size: 24px;">${username || usuarioCompleto.username || 'Usuário'}</h3>
      </div>
      
      <div style="text-align: left; margin: 20px 0;">
        <div style="margin-bottom: 12px;">
          <strong style="color: #666;">ID:</strong> 
          <span style="color: #333;">${userId || 'N/A'}</span>
        </div>
        
        <div style="margin-bottom: 12px;">
          <strong style="color: #666;">Email:</strong> 
          <span style="color: #333;">${usuarioCompleto.email || 'N/A'}</span>
        </div>
        
        <div style="margin-bottom: 12px;">
          <strong style="color: #666;">Tipo:</strong> 
          <span style="color: #333;">${usuarioCompleto.tipo || 'N/A'}</span>
        </div>
        
        <div style="margin-bottom: 12px;">
          <strong style="color: #666;">Status:</strong> 
          <span style="color: #28a745;">●</span> 
          <span style="color: #333;">Online</span>
        </div>
        
        <div style="margin-bottom: 12px;">
          <strong style="color: #666;">Token expira em:</strong> 
          <span id="token-countdown" style="color: #007bff; font-weight: bold;">${calcularTempoRestanteToken()}</span>
        </div>
      </div>
      
      <div style="margin-top: 25px; display: flex; gap: 10px; justify-content: center;">
        <button id="refresh-token-btn" style="
          background-color: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
        ">Renovar Token</button>
        
        <button id="logout-from-modal" style="
          background-color: #dc3545;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
        ">Sair</button>
      </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    //  FUNÇÃO PARA CRIAR MODAL DE FOTO EXPANDIDA
    function criarModalFotoExpandida() {
      // Remove modal de foto existente se houver
      const modalFotoExistente = document.getElementById('expanded-photo-modal');
      if (modalFotoExistente) {
        modalFotoExistente.remove();
      }
      
      // Cria o modal de foto expandida
      const modalFoto = document.createElement('div');
      modalFoto.id = 'expanded-photo-modal';
      modalFoto.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 3000;
        animation: fadeIn 0.3s ease;
      `;
      
      // Container da foto expandida
      const fotoContainer = document.createElement('div');
      fotoContainer.style.cssText = `
        position: relative;
        max-width: 90%;
        max-height: 90%;
        text-align: center;
      `;
      
      // Foto expandida
      const fotoExpandida = document.createElement('img');
      fotoExpandida.src = imagemUsuario || '../IMG/default-user.png';
      fotoExpandida.style.cssText = `
        max-width: 100%;
        max-height: 80vh;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        animation: zoomIn 0.3s ease;
      `;
      
      // Botão fechar foto expandida
      const btnFecharFoto = document.createElement('button');
      btnFecharFoto.innerHTML = '×';
      btnFecharFoto.style.cssText = `
        position: absolute;
        top: -10px;
        right: -10px;
        background: #fff;
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        font-size: 24px;
        cursor: pointer;
        color: #333;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      // Informações da foto
      const infoFoto = document.createElement('div');
      infoFoto.style.cssText = `
        margin-top: 20px;
        color: white;
        text-align: center;
      `;
      infoFoto.innerHTML = `
        <h3 style="margin: 10px 0; color: #475569;">${username || usuarioCompleto.username || 'Usuário'}</h3>
        <p style="margin: 5px 0; opacity: 0.8;">ID: ${userId || 'N/A'}</p>
        <p style="margin: 5px 0; opacity: 0.6; font-size: 14px;">Clique fora da imagem ou no X para fechar</p>
      `;
      
      // Monta o modal de foto
      fotoContainer.appendChild(fotoExpandida);
      fotoContainer.appendChild(btnFecharFoto);
      fotoContainer.appendChild(infoFoto);
      modalFoto.appendChild(fotoContainer);
      document.body.appendChild(modalFoto);
      
      // Event listeners para fechar foto expandida
      btnFecharFoto.addEventListener('click', () => {
        modalFoto.remove();
      });
      
      modalFoto.addEventListener('click', (e) => {
        if (e.target === modalFoto) {
          modalFoto.remove();
        }
      });
      
      // Fechar com ESC
      const handleEscKey = (e) => {
        if (e.key === 'Escape') {
          modalFoto.remove();
          document.removeEventListener('keydown', handleEscKey);
        }
      };
      document.addEventListener('keydown', handleEscKey);
      
      return modalFoto;
    }
    
    //  ADICIONA ESTILOS DE ANIMAÇÃO (incluindo nova animação zoomIn)
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes slideIn {
        from { transform: translateY(-50px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      @keyframes zoomIn {
        from { transform: scale(0.5); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      
      #close-profile-modal:hover {
        background-color: #f5f5f5;
        border-radius: 50%;
      }
      
      #refresh-token-btn:hover {
        background-color: #0056b3;
      }
      
      #logout-from-modal:hover {
        background-color: #c82333;
      }
      
      #profile-photo:hover {
        transform: scale(1.05);
        box-shadow: 0 5px 15px rgba(168, 134, 79, 0.3);
      }
    `;
    document.head.appendChild(style);
    
    //  EVENT LISTENERS
    
    // Event listener para expandir foto
    const profilePhoto = document.getElementById('profile-photo');
    profilePhoto.addEventListener('click', (e) => {
      e.stopPropagation(); // Evita fechar o modal de perfil
      criarModalFotoExpandida();
    });
    
    // Fechar modal
    document.getElementById('close-profile-modal').addEventListener('click', () => {
      modal.style.display = 'none';
      clearInterval(window.tokenCountdownInterval); // Para o contador
    });
    
    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
        clearInterval(window.tokenCountdownInterval);
      }
    });
    
    // Renovar token (redireciona para login)
    document.getElementById('refresh-token-btn').addEventListener('click', () => {
      alert('Você será redirecionado para fazer login novamente.');
      limparStorageERedirecionarLogin(); //  USA NOVA FUNÇÃO
    });
    
    // Logout
    document.getElementById('logout-from-modal').addEventListener('click', () => {
      if (confirm('Tem certeza que deseja sair?')) {
        limparStorageERedirecionarLogin(); //  USA NOVA FUNÇÃO
      }
    });
    
    return modal;
  }

  //======================================================================================================
  // FUNÇÃO PRINCIPAL: Mostrar Modal de Perfil
  // Exibe o modal de perfil do usuário e inicia o contador regressivo do token.
  //======================================================================================================
  function mostrarModalPerfil() {
    // Verifica token antes de mostrar modal
    if (verificarTokenExpirado()) {
      return;
    }
    
    const modal = criarModalPerfil();
    modal.style.display = 'flex';
    
    //  INICIA CONTADOR REGRESSIVO DO TOKEN
    const tokenCountdown = document.getElementById('token-countdown');
    if (tokenCountdown) {
      window.tokenCountdownInterval = setInterval(() => {
        const tempoRestante = calcularTempoRestanteToken();
        tokenCountdown.textContent = tempoRestante;
        
        //  MODIFICADO: USA NOVA FUNÇÃO DE LIMPEZA
        if (tempoRestante === 'Token expirado') {
          tokenCountdown.style.color = '#dc3545';
          clearInterval(window.tokenCountdownInterval);
          
          setTimeout(() => {
            alert('Seu token expirou. Você será redirecionado para fazer login novamente.');
            limparStorageERedirecionarLogin(); 
          }, 2000);
        }
      }, 1000); // Atualiza a cada segundo
    }
  }

  //======================================================================================================
  // FUNÇÃO PRINCIPAL: Carregar Imagem do Usuário
  // Carrega a imagem do usuário do localStorage ou do servidor e aplica no ícone do usuário.
  //======================================================================================================
  async function carregarImagemUsuario(userId) {
    try {
      //  PRIMEIRO: Verifica se já tem a imagem no localStorage
      const imagemSalva = localStorage.getItem(`imagem_usuario_${userId}`);
      
      if (imagemSalva) {
        // Aplica a imagem salva
        if (userIconElement) {
          userIconElement.src = imagemSalva;
          userIconElement.style.borderRadius = '50%';
          userIconElement.style.objectFit = 'cover';
          userIconElement.style.width = '40px';
          userIconElement.style.height = '40px';
          userIconElement.style.cursor = 'pointer'; //  INDICA QUE É CLICÁVEL
          userIconElement.title = 'Clique para ver perfil'; //  TOOLTIP
        }
        return; //  SAIR DA FUNÇÃO - NÃO PRECISA BUSCAR NO SERVIDOR
      }

      
      const response = await fetch(apiUrl(`/usuario/imagem/${userId}`), {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok' && data.imagem) {
          // Converte base64 para imagem
          const imagemBase64 = data.imagem;
          const imagemSrc = `data:image/jpeg;base64,${imagemBase64}`;
          
          //  SALVA A IMAGEM NO LOCALSTORAGE
          localStorage.setItem(`imagem_usuario_${userId}`, imagemSrc);
          
          if (userIconElement) {
            userIconElement.src = imagemSrc;
            userIconElement.style.borderRadius = '50%';
            userIconElement.style.objectFit = 'cover';
            userIconElement.style.width = '40px';
            userIconElement.style.height = '40px';
            userIconElement.style.cursor = 'pointer'; 
            userIconElement.title = 'Clique para ver perfil';
          }
        } else {
          
          if (userIconElement) {
            userIconElement.style.cursor = 'pointer'; 
            userIconElement.title = 'Clique para ver perfil'; 
          }
        }
      } else {
        console.warn('⚠️ Erro ao carregar imagem do usuário:', response.status);
      }
    } catch (error) {
      console.error('❌ Erro ao conectar com servidor para carregar imagem:', error);
    }
  }

  
  if (userId && userIconElement) {
    await carregarImagemUsuario(userId);
    
    
    userIconElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      mostrarModalPerfil();
    });
  }

  // ATUALIZA O NOME DO USUÁRIO COM O USERNAME DO LOCALSTORAGE
  if (userNameElement && username) {
    userNameElement.textContent = `Bem-vindo, ${username}!`;
  }

  // Aplica as permissões ao menu principal. Um caminho só, alimentado por
  // window.obterModulos() (cache ou servidor), em vez das duas cópias que
  // existiam aqui antes.
  function aplicarPermissoesMenu(modulos) {
    Object.keys(modules).forEach(modulo => {
      const tab = document.getElementById(`${modulo}-tab`);
      // Relatórios/Cadastros/Jornada não são mais botões do menu principal
      // (viraram subabas de Gestão); continuam no mapa porque ele é o
      // registro de destinos usado pela navegação.
      if (!tab) return;

      let permitido = !!(modulos && modulos[modulo]);
      let destino = modules[modulo];

      // Gestão virou o guarda-chuva administrativo. Ela precisa aparecer para
      // quem tem QUALQUER uma das suas subáreas: esconder aqui tiraria de um
      // usuário que só tem 'relatorios' o único caminho que restou até ele.
      // Isso não concede acesso novo, cada subaba continua exibida apenas
      // com a permissão dela, e o bloqueio real segue nos endpoints da API.
      if (modulo === 'gestao' && window.GestaoNav) {
        const primeira = window.GestaoNav.primeiraPermitida(modulos);
        permitido = !!primeira;
        if (primeira) destino = primeira.pagina;
      }

      if (permitido) {
        tab.classList.remove('modulo-oculto');
        tab.addEventListener('click', () => {
          if (typeof window.fecharDrawer === 'function') window.fecharDrawer();
          window.location.href = destino;
        });
      } else {
        tab.classList.add('modulo-oculto');
      }
    });
  }

  try {
    const info = await window.obterModulos();
    if (userNameElement && !username && info.usuario) {
      userNameElement.textContent = `Bem-vindo, ${info.usuario}!`;
    }
    aplicarPermissoesMenu(info.modulos);
  } catch (err) {
    console.error('Erro ao obter módulos:', err);
  }

  // MODIFICA O LOGOUT BUTTON PARA USAR A NOVA FUNÇÃO
  const logoutButton = document.getElementById('btn-logout');
  logoutButton.addEventListener('click', function () {
    limparStorageERedirecionarLogin(); //  USA NOVA FUNÇÃO
  });

  // Navegacao mobile agora e feita pelo drawer unificado no final deste arquivo.
});

//======================================================================================================
// FUNÇÃO PRINCIPAL: Botão de Informações e Ajuda
// O ícone (i) do rodapé do menu lateral abre a Central de Informação e Ajuda
// (SCRIPT/ajuda/central.js): manual, perguntas frequentes, guia rápido e
// informações da plataforma. Continua sendo UM único ícone, o que ganhou
// seções foi a Central, não o rodapé.
//
// Se a Central não estiver carregada na página, cai no balão simples que
// existia antes, para nenhuma tela ficar com um botão morto.
//======================================================================================================
document.addEventListener('DOMContentLoaded', function () {
  const infoButton = document.getElementById('btn-info');
  const modal = document.getElementById('info-modal');
  const modalOkButton = document.getElementById('modal-ok-btn');

  if (infoButton) {
    infoButton.addEventListener('click', function () {
      if (window.OrbitaAjuda && typeof window.OrbitaAjuda.abrir === 'function') {
        window.OrbitaAjuda.abrir();
        return;
      }
      if (modal) modal.style.display = 'flex';
    });
  }

  // Balão legado: só é ligado se ainda existir na página.
  if (modal) {
    if (modalOkButton) {
      modalOkButton.addEventListener('click', function () {
        modal.style.display = 'none';
      });
    }
    modal.addEventListener('click', function (event) {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    });
  }
});


//======================================================================================================
// MÓDULO: Navegação mobile (drawer) + utilidades de responsividade
// Injeta o botão hambúrguer, controla o menu lateral como drawer em telas pequenas,
// replica as abas de módulo dentro do drawer e garante que tabelas largas rolem
// dentro do próprio container (e não na página inteira).
// Roda em todas as páginas por ser carregado junto do geral.js.
//======================================================================================================
(function () {
  const MOBILE_MAX = 768;

  function iniciarDrawer() {
    const menu = document.querySelector('.menu');
    const topBar = document.querySelector('.top-bar');
    const topBarLeft = document.querySelector('.top-bar-left');
    if (!menu || !topBar) return;

    // --- Botão hambúrguer ---
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'menu-toggle';
    botao.id = 'menu-toggle';
    botao.setAttribute('aria-label', 'Abrir menu');
    botao.setAttribute('aria-controls', 'menu-lateral');
    botao.setAttribute('aria-expanded', 'false');
    botao.innerHTML = '&#9776;';
    (topBarLeft || topBar).insertBefore(botao, (topBarLeft || topBar).firstChild);

    if (!menu.id) menu.id = 'menu-lateral';

    // --- Overlay ---
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    document.body.appendChild(overlay);

    // --- Módulos dentro do drawer (as .top-tab ficam ocultas no mobile) ---
    const abasModulo = Array.from(document.querySelectorAll('.top-bar-right .top-tab'));
    if (abasModulo.length) {
      const secao = document.createElement('div');
      secao.className = 'menu-modulos';

      const titulo = document.createElement('span');
      titulo.className = 'menu-modulos-titulo';
      titulo.textContent = 'Módulos';
      secao.appendChild(titulo);

      abasModulo.forEach(aba => {
        const clone = document.createElement('button');
        clone.type = 'button';
        clone.textContent = aba.textContent.trim();
        clone.dataset.moduloRef = aba.id;
        if (aba.classList.contains('active')) clone.classList.add('active');
        // Espelha a visibilidade definida pelas permissões do usuário
        if (aba.classList.contains('modulo-oculto')) clone.classList.add('modulo-oculto');
        clone.addEventListener('click', () => {
          fechar();
          aba.click();
        });
        secao.appendChild(clone);
      });

      menu.insertBefore(secao, menu.firstChild);

      // Mantém os clones em sincronia quando as permissões escondem uma aba
      const observer = new MutationObserver(() => {
        secao.querySelectorAll('[data-modulo-ref]').forEach(clone => {
          const original = document.getElementById(clone.dataset.moduloRef);
          if (original) clone.classList.toggle('modulo-oculto', original.classList.contains('modulo-oculto'));
        });
      });
      abasModulo.forEach(aba => observer.observe(aba, { attributes: true, attributeFilter: ['style', 'class'] }));

      // Tela pequena: as abas do módulo atual (Painel Geral, Busca...)
      // aparecem dentro do módulo ativo, como submenu. Na tela grande
      // voltam para o lugar original.
      const moduloAtivo = secao.querySelector('[data-modulo-ref].active');
      if (moduloAtivo) {
        const submenu = document.createElement('div');
        submenu.className = 'menu-submodulos';
        moduloAtivo.after(submenu);
        moduloAtivo.classList.add('com-submenu');
        moduloAtivo.setAttribute('aria-expanded', 'true');
        const abasDoModulo = Array.from(menu.querySelectorAll(':scope > .tab-btn'));
        const ancora = document.createComment('abas-do-modulo');
        if (abasDoModulo.length) abasDoModulo[0].before(ancora);
        const telaPequena = window.matchMedia('(max-width: 768px)');
        function posicionarAbas() {
          if (!abasDoModulo.length) return;
          if (telaPequena.matches) {
            abasDoModulo.forEach(b => submenu.appendChild(b));
          } else {
            abasDoModulo.forEach(b => ancora.parentNode.insertBefore(b, ancora));
          }
        }
        posicionarAbas();
        if (telaPequena.addEventListener) telaPequena.addEventListener('change', posicionarAbas);
        else if (telaPequena.addListener) telaPequena.addListener(posicionarAbas);
        // Tocar no módulo ativo recolhe/abre o submenu em vez de recarregar
        moduloAtivo.addEventListener('click', (e) => {
          if (!telaPequena.matches) return;
          e.stopImmediatePropagation();
          const aberto = !submenu.classList.toggle('recolhido');
          moduloAtivo.setAttribute('aria-expanded', aberto ? 'true' : 'false');
        }, true);
        // Tocar numa aba do submenu fecha o drawer
        submenu.addEventListener('click', (e) => { if (e.target.closest('.tab-btn')) setTimeout(fechar, 0); });
      }
    }

    function estaAberto() {
      return menu.classList.contains('aberto');
    }

    // O drawer começa logo abaixo do cabeçalho; se o cabeçalho já saiu da
    // tela pela rolagem, ocupa a altura toda, sem deixar faixa vazia em cima.
    function ajustarTopoDrawer() {
      const barra = document.querySelector('.top-bar');
      const topo = barra ? Math.max(0, Math.round(barra.getBoundingClientRect().bottom)) : 0;
      // Ancorado em top/bottom (e não em 100vh) para acompanhar a altura
      // real visível no celular, que muda com a barra do navegador.
      menu.style.top = topo + 'px';
      menu.style.bottom = '0';
      menu.style.height = 'auto';
      menu.style.maxHeight = 'none';
      overlay.style.top = topo + 'px';
    }

    // Limpa o ajuste quando o drawer termina de fechar, para não afetar o
    // menu no layout de desktop.
    menu.addEventListener('transitionend', () => {
      if (!estaAberto()) {
        menu.style.top = ''; menu.style.bottom = ''; menu.style.height = ''; menu.style.maxHeight = '';
        overlay.style.top = '';
      }
    });

    function abrir() {
      ajustarTopoDrawer();
      menu.classList.add('aberto');
      overlay.classList.add('ativo');
      document.body.classList.add('drawer-aberto');
      botao.setAttribute('aria-expanded', 'true');
      botao.setAttribute('aria-label', 'Fechar menu');
    }

    function fechar() {
      menu.classList.remove('aberto');
      overlay.classList.remove('ativo');
      document.body.classList.remove('drawer-aberto');
      botao.setAttribute('aria-expanded', 'false');
      botao.setAttribute('aria-label', 'Abrir menu');
    }

    botao.addEventListener('click', () => (estaAberto() ? fechar() : abrir()));
    overlay.addEventListener('click', fechar);

    // Fecha ao escolher uma aba (mantém o fluxo de navegação no celular)
    menu.addEventListener('click', e => {
      if (window.innerWidth > MOBILE_MAX) return;
      const alvo = e.target.closest('button');
      if (alvo && !alvo.dataset.moduloRef) setTimeout(fechar, 0);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && estaAberto()) fechar();
    });

    // Ao voltar para desktop o drawer nunca pode ficar "preso" aberto
    window.addEventListener('resize', () => {
      if (window.innerWidth > MOBILE_MAX && estaAberto()) fechar();
    });

    window.fecharDrawer = fechar;
    window.abrirDrawer = abrir;
  }

  //====================================================================================================
  // Envolve tabelas largas em um wrapper com rolagem horizontal própria.
  // Evita que a página inteira ganhe scroll lateral em telas pequenas.
  //====================================================================================================
  function tornarTabelasResponsivas(raiz) {
    (raiz || document).querySelectorAll('table').forEach(tabela => {
      const pai = tabela.parentElement;
      if (!pai) return;
      if (pai.classList.contains('tabela-responsiva') || pai.classList.contains('tabela-produtos')) return;
      // Ja existe um container com rolagem propria (ex.: .frota-tabela-wrap)
      const overflowPai = window.getComputedStyle(pai).overflowX;
      if (overflowPai === 'auto' || overflowPai === 'scroll') return;
      const wrapper = document.createElement('div');
      wrapper.className = 'tabela-responsiva';
      pai.insertBefore(wrapper, tabela);
      wrapper.appendChild(tabela);
    });
  }

  //====================================================================================================
  // Tabela em cartões no celular: cada célula ganha data-rotulo com o título da
  // coluna, e o CSS (geral.css, "TABELAS EM CARTÕES") mostra "rótulo: valor".
  // Vale para toda .estilo-tabela; quem não quiser usa a classe .sem-cartao.
  //====================================================================================================
  function rotularCelulas(raiz) {
    (raiz || document).querySelectorAll('table.estilo-tabela:not(.sem-cartao)').forEach(tabela => {
      const titulos = Array.from(tabela.querySelectorAll('thead th')).map(th => th.textContent.trim());
      if (!titulos.length) return;
      tabela.querySelectorAll('tbody tr').forEach(linha => {
        let coluna = 0;
        Array.from(linha.cells).forEach(celula => {
          const vao = celula.colSpan || 1;
          if (vao === 1 && titulos[coluna] && celula.dataset.rotulo !== titulos[coluna]) {
            celula.dataset.rotulo = titulos[coluna];
          }
          coluna += vao;
        });
      });
    });
  }

  //====================================================================================================
  // Campo de arquivo como botão com ícone de upload.
  // O <input type="file"> continua no lugar (só fica oculto na tela), então os
  // scripts que leem input.files e ouvem 'change' seguem funcionando. Um <label>
  // ligado a ele faz o papel de botão e um texto ao lado mostra o que foi escolhido.
  // Inputs com display:none já têm botão próprio e ficam de fora, assim como .sem-botao-upload.
  //====================================================================================================
  const ICONE_UPLOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M12 15V4"/><path d="m7 9 5-5 5 5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>';
  let contadorUpload = 0;

  function melhorarCamposArquivo(raiz) {
    (raiz || document).querySelectorAll('input[type="file"]:not([data-upload-pronto]):not(.sem-botao-upload)').forEach(input => {
      if (input.style.display === 'none') return;
      input.dataset.uploadPronto = '1';
      if (!input.id) input.id = 'upload-campo-' + (++contadorUpload);

      const ehImagem = /image/.test(input.accept || '') && !/\.pdf|\.doc|\.xls/.test(input.accept || '');
      const textoBotao = ehImagem
        ? (input.multiple ? 'Enviar fotos' : 'Enviar foto')
        : (input.multiple ? 'Enviar arquivos' : 'Enviar arquivo');
      const textoVazio = 'Nenhum arquivo selecionado';

      const campo = document.createElement('div');
      campo.className = 'upload-campo';
      const botao = document.createElement('label');
      botao.className = 'upload-btn';
      botao.htmlFor = input.id;
      botao.innerHTML = ICONE_UPLOAD + '<span>' + textoBotao + '</span>';
      const nomes = document.createElement('span');
      nomes.className = 'upload-nomes';

      input.parentNode.insertBefore(campo, input);
      campo.appendChild(input);
      campo.appendChild(botao);
      campo.appendChild(nomes);
      input.classList.add('upload-input-oculto');

      function atualizar() {
        const arquivos = input.files ? Array.from(input.files) : [];
        if (!arquivos.length) {
          nomes.textContent = textoVazio;
          nomes.classList.remove('upload-nomes-cheio');
        } else {
          nomes.textContent = arquivos.length === 1 ? arquivos[0].name : arquivos.length + ' arquivos selecionados';
          nomes.title = arquivos.map(a => a.name).join(', ');
          nomes.classList.add('upload-nomes-cheio');
        }
      }

      input.addEventListener('change', atualizar);
      // Scripts limpam o campo com input.value = '' (não dispara 'change')
      const descritor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      Object.defineProperty(input, 'value', {
        configurable: true,
        get() { return descritor.get.call(this); },
        set(v) { descritor.set.call(this, v); atualizar(); },
      });
      if (input.form) input.form.addEventListener('reset', () => setTimeout(atualizar, 0));
      atualizar();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    iniciarDrawer();
    melhorarCamposArquivo(document);
    tornarTabelasResponsivas(document);
    rotularCelulas(document);

    // Tabelas criadas dinamicamente também recebem o wrapper
    const alvo = document.querySelector('.content');
    if (alvo && window.MutationObserver) {
      let agendado = false;
      new MutationObserver(() => {
        if (agendado) return;
        agendado = true;
        setTimeout(() => {
          agendado = false;
          tornarTabelasResponsivas(alvo);
          rotularCelulas(alvo);
          melhorarCamposArquivo(alvo);
        }, 0);
      }).observe(alvo, { childList: true, subtree: true });
    }
    // Modais ficam fora de .content: campos de arquivo criados neles também viram botão
    if (window.MutationObserver) {
      let agendadoArquivo = false;
      new MutationObserver(() => {
        if (agendadoArquivo) return;
        agendadoArquivo = true;
        setTimeout(() => { agendadoArquivo = false; melhorarCamposArquivo(document); }, 0);
      }).observe(document.body, { childList: true, subtree: true });
    }
  });

  window.tornarTabelasResponsivas = tornarTabelasResponsivas;
  window.rotularCelulas = rotularCelulas;
  window.melhorarCamposArquivo = melhorarCamposArquivo;
})();

//======================================================================================================
// MÓDULO: Barra de navegação inferior (celular/tablet)
// Espelha as abas do menu lateral numa tab bar fixa no rodapé, no padrão de app nativo.
// Não duplica lógica: cada botão apenas dispara o clique da .tab-btn original, e o
// estado "ativo" é espelhado por MutationObserver. O botão "Mais" abre o drawer, onde
// ficam as abas restantes, os módulos e as ações de configuração/sair.
// Cada página escolhe rótulo e ícone via data-nav-label / data-nav-icone na .tab-btn.
//======================================================================================================
(function () {
  // Traços dos ícones (24x24, herdam a cor via currentColor)
  const ICONES = {
    inicio: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    painel: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
    busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    movimentacoes: '<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>',
    cadastros: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    relatorio: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    veiculo: '<path d="M3 13l2-5h11l3 5"/><path d="M2 13h19v4H2z"/><circle cx="7" cy="18" r="1.8"/><circle cx="16" cy="18" r="1.8"/>',
    mapa: '<path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2z"/><path d="M9 3v16M15 5v16"/>',
    agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    usuarios: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 8.5a3 3 0 0 1 0 5"/><path d="M18 20a6 6 0 0 0-2-4.5"/>',
    sino: '<path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5z"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
    mais: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    padrao: '<circle cx="12" cy="12" r="8"/>'
  };

  function svg(nome) {
    const traco = ICONES[nome] || ICONES.padrao;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + traco + '</svg>';
  }

  function iniciarNavInferior() {
    const menu = document.querySelector('.menu');
    if (!menu || document.querySelector('.nav-inferior')) return;

    const abas = Array.from(menu.querySelectorAll('.tab-btn'));
    if (!abas.length) return;

    const nav = document.createElement('nav');
    nav.className = 'nav-inferior';
    nav.setAttribute('aria-label', 'Navegação principal');

    // Cabendo todas em 4 posicoes, a barra mostra so as abas. Se houver mais,
    // a quarta posicao vira "Mais" e o excedente fica no drawer - senao alguma
    // aba ficaria inalcancavel pela barra.
    const cabemTodas = abas.length <= 4;
    const principais = cabemTodas ? abas : abas.slice(0, 4);
    principais.forEach(aba => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'nav-inferior-item';
      botao.dataset.abaRef = aba.dataset.tab || '';
      const rotulo = aba.dataset.navLabel || aba.textContent.trim();
      botao.innerHTML = svg(aba.dataset.navIcone) + '<span>' + rotulo + '</span>';
      botao.addEventListener('click', () => aba.click());
      nav.appendChild(botao);
    });

    // Destaque da barra: o botao do menu nem sempre acompanha (clicar numa
    // sub-aba troca o .tab-content sem mexer no menu), entao o estado sai da
    // tela ativa - direto pelo id, ou pela secao declarada em data-secao.
    const refPorNome = {};
    abas.forEach(aba => {
      refPorNome[aba.textContent.trim()] = aba.dataset.tab || '';
    });

    function sincronizarDestaque() {
      const tela = document.querySelector('.tab-content.active');
      if (!tela) return;
      const refSecao = tela.dataset.secao ? refPorNome[tela.dataset.secao] : '';
      nav.querySelectorAll('.nav-inferior-item[data-aba-ref]').forEach(item => {
        const ref = item.dataset.abaRef;
        item.classList.toggle('active', !!ref && (ref === tela.id || ref === refSecao));
      });
    }

    const conteudo = document.querySelector('.content');
    if (conteudo) {
      let agendado = false;
      new MutationObserver(() => {
        if (agendado) return;
        agendado = true;
        setTimeout(() => {
          agendado = false;
          sincronizarDestaque();
        }, 0);
      }).observe(conteudo, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    sincronizarDestaque();

    if (!cabemTodas) {
      const mais = document.createElement('button');
      mais.type = 'button';
      mais.className = 'nav-inferior-item';
      mais.innerHTML = svg('mais') + '<span>Mais</span>';
      mais.addEventListener('click', () => {
        if (typeof window.abrirDrawer === 'function') window.abrirDrawer();
      });
      nav.appendChild(mais);
    }

    document.body.appendChild(nav);
    document.body.classList.add('tem-nav-inferior');
  }

  //====================================================================================================
  // Cabecalho do painel em celular/tablet: titulo grande da aba + trilha de navegacao
  // ("Almoxarifado > Movimentacoes > Retirada"). Substitui a faixa escura .aba-legenda,
  // que fica pesada demais em tela pequena (o CSS a esconde nesse tamanho).
  // O titulo e espelhado da propria .aba-legenda, entao acompanha a troca de aba em
  // qualquer modulo - inclusive nos que reescrevem a legenda por JS (frota/gestao).
  //====================================================================================================
  function iniciarCabecalhoPainel() {
    const conteudo = document.querySelector('.content');
    if (!conteudo || document.querySelector('.painel-cabecalho')) return;

    const bloco = document.createElement('div');
    bloco.className = 'painel-cabecalho';
    bloco.innerHTML =
      '<h1 class="painel-titulo"></h1>'
      + '<nav class="painel-trilha" aria-label="Trilha de navegacao"></nav>';
    conteudo.insertBefore(bloco, conteudo.firstChild);

    const elTitulo = bloco.querySelector('.painel-titulo');
    const elTrilha = bloco.querySelector('.painel-trilha');

    // A partir de tablet a legenda normal (.aba-legenda) volta a aparecer -
    // mas a orientacao hierarquica (mesma trilha do titulo mobile) continua
    // valendo em qualquer tamanho de tela, agora logo ABAIXO da legenda em
    // vez de substitui-la. E um unico nav, reposicionado a cada troca de
    // aba - igual ao SCRIPT/relatorios/filtros.js faz com a barra de filtros.
    const elTrilhaSempre = document.createElement('nav');
    elTrilhaSempre.className = 'aba-trilha';
    elTrilhaSempre.setAttribute('aria-label', 'Trilha de navegacao');
    const moduloAtivo = document.getElementById('modulo-ativo');
    const nomeModulo = moduloAtivo ? moduloAtivo.textContent.trim() : '';

    // A legenda pode trazer setas/simbolos decorativos ("Entrada ⭷") que nao
    // fazem sentido como titulo.
    function limpar(texto) {
      return (texto || '').replace(/[⬀-⯿←-⇿■-◿]/g, '').trim();
    }

    // A sub-aba ativa (Entrada/Retirada/...) e marcada de dois jeitos no projeto:
    // por classe .active ou por style inline com o teal da marca. Cobre os dois.
    // Trata como o mesmo nome variacoes de caixa/plural ("Busca" x "Buscas"),
    // para a trilha nao repetir o mesmo nivel duas vezes.
    function mesmoNome(a, b) {
      const na = (a || '').toLowerCase();
      const nb = (b || '').toLowerCase();
      if (!na || !nb) return false;
      return na === nb || na.indexOf(nb) === 0 || nb.indexOf(na) === 0;
    }

    function pillAtiva(pill) {
      return pill.classList.contains('active')
        || pill.classList.contains('active-requisitantes')
        || /12B5AC/i.test(pill.getAttribute('style') || '');
    }

    function atualizar() {
      const aba = document.querySelector('.tab-content.active');

      const legenda = (aba && aba.querySelector('.aba-legenda'))
        || document.getElementById('legenda-principal')
        || document.querySelector('.aba-legenda');

      // Nome da secao, em ordem de confiabilidade:
      // 1) data-secao na propria tela (declarado no HTML para sub-abas, que
      //    trocam o .tab-content sem mexer no botao do menu);
      // 2) o botao do menu correspondente ao id da tela ativa;
      // 3) o botao do menu ativo; 4) a legenda.
      let nomeAba = '';
      if (aba && aba.dataset.secao) {
        nomeAba = aba.dataset.secao;
      } else {
        const btnDaTela = aba && document.querySelector('.menu .tab-btn[data-tab="' + aba.id + '"]');
        const btnMenu = btnDaTela || document.querySelector('.menu .tab-btn.active');
        nomeAba = limpar(btnMenu ? btnMenu.textContent : (legenda ? legenda.textContent : ''));
      }

      let subAba = '';
      if (aba) {
        const pill = Array.from(aba.querySelectorAll('.opcoes-abas .top-tab2')).find(pillAtiva);
        if (pill) subAba = limpar(pill.textContent);
      }
      // Sem sub-aba explicita, a legenda ainda pode nomear a tela atual - mas
      // so quando acrescenta informacao ("Busca" x "Buscas" nao acrescenta).
      if (!subAba && legenda) {
        const daLegenda = limpar(legenda.textContent);
        if (daLegenda && !mesmoNome(daLegenda, nomeAba)) subAba = daLegenda;
      }

      // Ponto de extensao: uma pagina inteira pode ser, ela propria, uma
      // subarea de outra (ex.: cadastros.html e "Cadastros" dentro de
      // Gestao). Nesse caso o titulo mobile deve mostrar o nome da PAGINA,
      // nao o nome da aba interna - a aba interna vira o nivel seguinte da
      // trilha, e so isso muda; a logica de nomeAba/subAba acima continua a
      // mesma usada por almoxarifado.html e por toda pagina de duas abas.
      // Ausente (undefined) em toda pagina que nao se registrar - zero
      // mudanca de comportamento fora disso.
      const subareaFixa = window.__painelSubareaFixa;

      elTitulo.textContent = subareaFixa || subAba || nomeAba;

      const partes = [];
      if (nomeModulo) partes.push(nomeModulo);
      if (subareaFixa) partes.push(subareaFixa);
      if (nomeAba) partes.push(nomeAba);
      if (subAba && !mesmoNome(subAba, nomeAba)) partes.push(subAba);

      function renderTrilha(nav) {
        nav.innerHTML = partes.map((parte, i) => {
          const classe = i === partes.length - 1 ? 'painel-trilha-atual' : 'painel-trilha-item';
          const sep = i ? '<span class="painel-trilha-sep" aria-hidden="true">&rsaquo;</span>' : '';
          return sep + '<span class="' + classe + '"></span>';
        }).join('');
        // textContent (e nao innerHTML) para nao interpretar o texto vindo da pagina
        nav.querySelectorAll('span:not(.painel-trilha-sep)').forEach((el, i) => {
          el.textContent = partes[i];
        });
      }

      renderTrilha(elTrilha);
      renderTrilha(elTrilhaSempre);

      // Reposiciona a trilha "sempre visivel" logo abaixo da legenda ativa
      // (ou do wrapper .aba-legenda-linha, quando a pagina tiver um - ver
      // relatorios.html) - assim ela acompanha qualquer troca de aba. Usa a
      // mesma `legenda` (com fallback para #legenda-principal) calculada
      // acima, porque paginas como gestao.html/frota.html tem UM h2 global
      // fora de cada .tab-content, reescrito por JS - nao um por aba.
      if (legenda) {
        const host = legenda.closest('.aba-legenda-linha') || legenda;
        host.insertAdjacentElement('afterend', elTrilhaSempre);
      }
    }

    atualizar();

    // Reage a troca de aba, de sub-aba e a reescrita da legenda pelo JS do modulo.
    // Usa setTimeout (e nao requestAnimationFrame) porque rAF nao roda com a aba
    // em segundo plano, e o titulo ficaria travado.
    let agendado = false;
    new MutationObserver(() => {
      if (agendado) return;
      agendado = true;
      setTimeout(() => {
        agendado = false;
        atualizar();
      }, 0);
    }).observe(conteudo, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  //====================================================================================================
  // Sino de notificacoes (celular/tablet).
  // Nao inventa conteudo: mostra exatamente o painel "Status do Sistema" que ja existe
  // na barra lateral direita do desktop (#sidebar-content), que some em tela pequena.
  // O contador e o numero de itens desse painel.
  //====================================================================================================
  function iniciarSinoNotificacoes() {
    const topBar = document.querySelector('.top-bar');
    const fonte = document.getElementById('sidebar-content');
    if (!topBar || !fonte || document.querySelector('.sino-notificacoes')) return;

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'sino-notificacoes';
    botao.setAttribute('aria-label', 'Notificacoes');
    botao.setAttribute('aria-expanded', 'false');
    botao.innerHTML = svg('sino') + '<span class="sino-contador" hidden></span>';
    topBar.appendChild(botao);

    // Painel da direita como gaveta (igual ao menu da esquerda, do outro lado)
    const painel = document.createElement('aside');
    painel.className = 'sino-painel';
    painel.setAttribute('aria-label', 'Painel lateral');
    painel.innerHTML = '<div class="sino-painel-corpo"></div>';
    document.body.appendChild(painel);
    const sombra = document.createElement('div');
    sombra.className = 'sino-overlay';
    document.body.appendChild(sombra);

    const contador = botao.querySelector('.sino-contador');
    const corpo = painel.querySelector('.sino-painel-corpo');

    function contarItens() {
      const itens = fonte.querySelectorAll('li').length
        || fonte.querySelectorAll('p').length;
      contador.textContent = itens > 9 ? '9+' : String(itens);
      contador.hidden = itens === 0;
    }

    function abrir() {
      // Reclona a cada abertura para refletir o estado atual do painel
      corpo.innerHTML = '';
      corpo.appendChild(fonte.cloneNode(true));
      corpo.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      // Fecha o menu da esquerda se estiver aberto
      const menuEsq = document.querySelector('.menu.aberto');
      if (menuEsq) document.querySelector('.menu-toggle')?.click();
      painel.classList.add('aberto');
      sombra.classList.add('ativo');
      botao.setAttribute('aria-expanded', 'true');
    }

    function fechar() {
      painel.classList.remove('aberto');
      sombra.classList.remove('ativo');
      botao.setAttribute('aria-expanded', 'false');
    }

    botao.addEventListener('click', e => {
      e.stopPropagation();
      if (painel.classList.contains('aberto')) fechar(); else abrir();
    });

    sombra.addEventListener('click', fechar);
    // Abrir o menu da esquerda fecha este painel
    document.querySelector('.menu-toggle')?.addEventListener('click', () => {
      if (painel.classList.contains('aberto')) fechar();
    }, true);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') fechar();
    });

    contarItens();
    new MutationObserver(contarItens).observe(fonte, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', function () {
    iniciarNavInferior();
    iniciarCabecalhoPainel();
    iniciarSinoNotificacoes();
  });
})();

//======================================================================================================
// MÓDULO: Checklist de contratos (componente compartilhado)
// Preenche e lê uma lista de checkboxes de contratos (.checklist-contratos),
// usada em qualquer formulário que vincule um recurso a um ou mais
// contratos (usuário, veículo, base). Cacheia a lista de contratos entre
// chamadas pra não repetir o fetch a cada abertura de modal/formulário.
//======================================================================================================
(function () {
  let contratosCache = null;
  let contratosCachePromise = null;

  function apiUrlContratos() {
    if (typeof window.apiUrl === 'function') return window.apiUrl('/contratos');
    const base = window.TUNNEL_API_URL || window.API_BASE_URL || '';
    return base.replace(/\/$/, '') + '/contratos';
  }

  function authHeadersContratos() {
    return { Authorization: 'Bearer ' + localStorage.getItem('token') };
  }

  async function obterContratosCache() {
    if (contratosCache) return contratosCache;
    if (contratosCachePromise) return contratosCachePromise;
    contratosCachePromise = fetch(apiUrlContratos(), { headers: authHeadersContratos() })
      .then(r => r.json())
      .then(dados => {
        contratosCache = (dados && dados.status === 'ok' && Array.isArray(dados.contratos)) ? dados.contratos : [];
        return contratosCache;
      })
      .catch(erro => {
        console.warn('Falha ao carregar contratos:', erro);
        contratosCache = [];
        return contratosCache;
      })
      .finally(() => { contratosCachePromise = null; });
    return contratosCachePromise;
  }

  function escaparHtmlContratos(texto) {
    const div = document.createElement('div');
    div.textContent = String(texto == null ? '' : texto);
    return div.innerHTML;
  }

  // Preenche um container .checklist-contratos com um checkbox por contrato.
  // `selecionados` é a lista de nomes já vinculados (marca os checkboxes correspondentes).
  async function popularChecklistContratos(container, selecionados) {
    if (!container) return;
    const contratos = await obterContratosCache();
    if (!contratos.length) {
      container.innerHTML = '<p style="color:#999;font-size:13px;margin:0;">Nenhum contrato cadastrado ainda.</p>';
      return;
    }
    const marcados = new Set(selecionados || []);
    container.innerHTML = contratos.map(c => `
      <label>
        <input type="checkbox" class="checklist-contratos-item" value="${escaparHtmlContratos(c.nome)}" ${marcados.has(c.nome) ? 'checked' : ''}>
        ${escaparHtmlContratos(c.nome)}
      </label>
    `).join('');
  }

  // Lê os contratos marcados num container .checklist-contratos.
  // Retorna null quando nada está marcado (= recurso geral, sem vínculo).
  function coletarContratosSelecionados(container) {
    if (!container) return null;
    const marcados = Array.from(container.querySelectorAll('.checklist-contratos-item:checked')).map(cb => cb.value);
    return marcados.length ? marcados : null;
  }

  window.popularChecklistContratos = popularChecklistContratos;
  window.coletarContratosSelecionados = coletarContratosSelecionados;
})();


//======================================================================================================
// MÓDULO: Troca de abas padrão (opt-in)
// Hoje cada módulo reimplementa o mesmo laço de .tab-btn/.tab-content
// (ordens.js, gestao.js, frota.js...). Esta função é a versão única dessa
// lógica, mas NÃO roda sozinha: as páginas existentes continuam com o código
// delas para não haver duas ligações no mesmo botão (que alternariam a aba
// duas vezes por clique). Páginas novas chamam window.inicializarAbasPadrao().
//======================================================================================================
window.inicializarAbasPadrao = function inicializarAbasPadrao() {
  const abas = document.querySelectorAll('.menu .tab-btn[data-tab]');
  const telas = document.querySelectorAll('.content > .tab-content');
  if (!abas.length || !telas.length) return;

  abas.forEach(aba => {
    aba.addEventListener('click', function () {
      abas.forEach(b => b.classList.remove('active'));
      telas.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      const alvo = document.getElementById(this.dataset.tab);
      if (alvo) alvo.classList.add('active');
      if (typeof window.fecharDrawer === 'function') window.fecharDrawer();
    });
  });
};

// Carregamento com a logo enchendo de petróleo.
// A superfície é simulada como uma fileira de molas (equação de onda):
// o recipiente balança, o líquido responde com atraso, as ondas se
// propagam e perdem força aos poucos. Uso: const fim = mostrarCarregandoLogo(); ... fim();
(function () {
  let camada = null;
  let canvas = null;
  let ctx = null;
  let pedidos = 0;
  let quadro = 0;
  const TEMPO_MINIMO = 500;
  const TAMANHO = 96;
  const COLUNAS = 48;
  const TEMPO_ENCHER = 9000;   // ms até ficar cheio
  const TEMPO_CHEIO = 900;     // ms parado cheio antes de recomeçar

  let altura = new Float32Array(COLUNAS + 1);
  let velocidade = new Float32Array(COLUNAS + 1);
  let inicioCiclo = 0;
  let ultimo = 0;
  let proximaGota = 0;
  let nivelAtual = 0;
  let rapido = null;          // { inicio, de } quando os dados chegaram
  const TEMPO_RAPIDO = 650;   // ms para encher o resto depois que os dados chegam

  function criar() {
    camada = document.createElement('div');
    camada.className = 'carregando-logo';
    camada.setAttribute('role', 'status');
    camada.setAttribute('aria-label', 'Carregando');
    camada.innerHTML = '<div class="carregando-logo-recipiente"><div class="carregando-logo-marca"><canvas class="carregando-logo-canvas"></canvas></div></div>';
    document.body.appendChild(camada);
    canvas = camada.querySelector('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = TAMANHO * dpr;
    canvas.height = TAMANHO * dpr;
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
  }

  function reiniciar(agora) {
    altura.fill(0);
    velocidade.fill(0);
    inicioCiclo = agora;
    nivelAtual = 0;
    proximaGota = agora + 400;
  }

  // Nível sobe rápido no começo e desacelera perto do topo, como um
  // recipiente que vai ficando mais estreito para o olho.
  function nivel(p) {
    return 1 - Math.pow(1 - p, 1.6);
  }

  function passo(dt, t) {
    // Balanço do recipiente: duas frequências fora de fase dão um
    // movimento que não se repete de forma mecânica.
    const inclinacao = 0.6 * Math.sin(t * 1.6) + 0.35 * Math.sin(t * 2.7 + 1.2) + 0.15 * Math.sin(t * 4.3 + 0.5);
    const RIGIDEZ = 0.014, AMORTECIMENTO = 0.016, ESPALHAR = 0.1;
    for (let i = 0; i <= COLUNAS; i++) {
      const x = i / COLUNAS - 0.5;
      // força do balanço empurra o líquido para um dos lados
      const alvo = inclinacao * x * 15;
      velocidade[i] += (alvo - altura[i]) * RIGIDEZ - velocidade[i] * AMORTECIMENTO;
    }
    for (let i = 0; i <= COLUNAS; i++) {
      altura[i] += velocidade[i] * dt;
      if (!isFinite(altura[i])) { altura[i] = 0; velocidade[i] = 0; }
      altura[i] = Math.max(-16, Math.min(16, altura[i]));
    }
    // propagação entre vizinhos (duas passadas suavizam)
    for (let k = 0; k < 2; k++) {
      const delta = new Float32Array(COLUNAS + 1);
      for (let i = 0; i <= COLUNAS; i++) {
        if (i > 0) delta[i] += ESPALHAR * (altura[i - 1] - altura[i]);
        if (i < COLUNAS) delta[i] += ESPALHAR * (altura[i + 1] - altura[i]);
      }
      for (let i = 0; i <= COLUNAS; i++) velocidade[i] += delta[i] * dt;
    }
  }

  function desenhar(t, base) {
    ctx.clearRect(0, 0, TAMANHO, TAMANHO);
    const passoX = TAMANHO / COLUNAS;
    const y = i => base + altura[i];

    // corpo do líquido
    ctx.beginPath();
    ctx.moveTo(0, TAMANHO);
    ctx.lineTo(0, y(0));
    for (let i = 1; i <= COLUNAS; i++) {
      const xm = (i - 0.5) * passoX;
      ctx.quadraticCurveTo((i - 1) * passoX, y(i - 1), xm, (y(i - 1) + y(i)) / 2);
    }
    ctx.lineTo(TAMANHO, y(COLUNAS));
    ctx.lineTo(TAMANHO, TAMANHO);
    ctx.closePath();
    const corpo = ctx.createLinearGradient(0, base - 6, 0, TAMANHO);
    corpo.addColorStop(0, '#2b2621');
    corpo.addColorStop(0.18, '#120f0d');
    corpo.addColorStop(1, '#000');
    ctx.fillStyle = corpo;
    ctx.fill();

    // reflexo interno: faixa larga e suave que acompanha a inclinação
    ctx.save();
    ctx.clip();
    const desloc = Math.sin(t * 0.6) * 10;
    const brilho = ctx.createLinearGradient(20 + desloc, base, 70 + desloc, base + 40);
    brilho.addColorStop(0, 'rgba(255,255,255,0)');
    brilho.addColorStop(0.45, 'rgba(255,248,235,0.07)');
    brilho.addColorStop(0.55, 'rgba(255,248,235,0.11)');
    brilho.addColorStop(0.65, 'rgba(255,248,235,0.05)');
    brilho.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = brilho;
    ctx.fillRect(0, base - 10, TAMANHO, TAMANHO);
    ctx.restore();

    // reflexo na superfície: mais forte onde a onda está virada para a luz (vinda de cima à esquerda)
    for (let i = 1; i <= COLUNAS; i++) {
      const inclin = y(i) - y(i - 1);
      const luz = Math.max(0, Math.min(1, -inclin * 0.9 + 0.25));
      if (luz <= 0.02) continue;
      ctx.strokeStyle = 'rgba(255,246,228,' + (0.42 * luz).toFixed(3) + ')';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo((i - 1) * passoX, y(i - 1) + 0.6);
      ctx.lineTo(i * passoX, y(i) + 0.6);
      ctx.stroke();
    }
  }

  function animar(agora) {
    if (!pedidos && !camada.classList.contains('visivel')) { quadro = 0; return; }
    const dt = Math.min(2.5, (agora - (ultimo || agora)) / 16.67) || 1;
    ultimo = agora;
    let decorrido = agora - inicioCiclo;
    let p;
    if (rapido) {
      // dados prontos: termina de encher depressa, com uma agitação a mais
      if (!rapido.inicio) {
        rapido.inicio = agora;
        rapido.de = nivelAtual;
        for (let i = 0; i <= COLUNAS; i++) velocidade[i] += (Math.random() - 0.5) * 2.2;
      }
      const q = Math.min(1, (agora - rapido.inicio) / TEMPO_RAPIDO);
      nivelAtual = rapido.de + (1 - rapido.de) * (1 - Math.pow(1 - q, 3));
      if (q >= 1 && !rapido.fechou) { rapido.fechou = true; setTimeout(rapido.aoEncher, 180); }
      p = 1;
    } else {
      if (decorrido > TEMPO_ENCHER + TEMPO_CHEIO) { reiniciar(agora); decorrido = 0; }
      p = Math.min(1, decorrido / TEMPO_ENCHER);
      nivelAtual = nivel(p);
    }
    const base = TAMANHO * (1.06 - nivelAtual * 1.16);

    // gotas caindo de cima de tempos em tempos: perturbação local que se espalha
    if (agora > proximaGota && p < 0.97) {
      const c = Math.floor(COLUNAS * (0.3 + Math.random() * 0.4));
      for (let k = -2; k <= 2; k++) {
        const j = c + k;
        if (j >= 0 && j <= COLUNAS) velocidade[j] += (1.4 - Math.abs(k) * 0.35);
      }
      proximaGota = agora + 450 + Math.random() * 600;
    }

    const t = agora / 1000;
    // passos fixos: a simulação fica estável mesmo se a tela travar
    const passos = Math.max(1, Math.round(dt * 2));
    for (let k = 0; k < passos; k++) passo(0.5, t);
    desenhar(t, base);
    quadro = requestAnimationFrame(animar);
  }

  window.mostrarCarregandoLogo = function () {
    if (!camada) criar();
    pedidos++;
    const inicio = Date.now();
    rapido = null;
    if (!quadro) {
      ultimo = 0;
      reiniciar(performance.now());
      quadro = requestAnimationFrame(animar);
    }
    requestAnimationFrame(() => camada.classList.add('visivel'));
    let encerrado = false;
    return function () {
      if (encerrado) return;
      encerrado = true;
      const espera = Math.max(0, TEMPO_MINIMO - (Date.now() - inicio));
      setTimeout(() => {
        pedidos = Math.max(0, pedidos - 1);
        if (pedidos) return;
        rapido = { aoEncher: () => { if (!pedidos) camada.classList.remove('visivel'); } };
      }, espera);
    };
  };
})();


//======================================================================================================
// Cartões dos painéis que levam a algum lugar.
// Um elemento com data-ir-aba="<data-tab>" vira clicável e abre a aba.
// Opcionais: data-ir-sub="<id de botão>" (sub-aba), data-ir-filtro="<id do campo>=<valor>",
// data-ir-acao="<função global>" (ex.: refazer a busca), data-ir-rolar="<id>".
//======================================================================================================
(function () {
  function irPara(alvo) {
    const aba = alvo.dataset.irAba;
    const botaoAba = aba && document.querySelector('.tab-btn[data-tab="' + aba + '"]');
    if (botaoAba) botaoAba.click();
    setTimeout(() => {
      if (alvo.dataset.irSub) document.getElementById(alvo.dataset.irSub)?.click();
      if (alvo.dataset.irFiltro) {
        const pos = alvo.dataset.irFiltro.indexOf('=');
        const campo = document.getElementById(alvo.dataset.irFiltro.slice(0, pos));
        if (campo) {
          campo.value = alvo.dataset.irFiltro.slice(pos + 1);
          campo.dispatchEvent(new Event('input', { bubbles: true }));
          campo.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      const acao = alvo.dataset.irAcao;
      if (acao && typeof window[acao] === 'function') window[acao]();
      const rolar = alvo.dataset.irRolar && document.getElementById(alvo.dataset.irRolar);
      if (rolar) rolar.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 120);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-ir-aba]').forEach((cartao) => {
      cartao.classList.add('cartao-link');
      if (!cartao.hasAttribute('tabindex')) cartao.setAttribute('tabindex', '0');
      cartao.setAttribute('role', 'link');
    });
  });
  document.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-ir-aba]');
    if (!alvo || e.target.closest('button, a, input, select, textarea, label')) return;
    irPara(alvo);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const alvo = e.target.closest && e.target.closest('[data-ir-aba]');
    if (!alvo || alvo !== e.target) return;
    e.preventDefault();
    irPara(alvo);
  });
})();
