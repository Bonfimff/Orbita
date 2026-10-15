/**
 * CONFIGURAÇÃO CENTRALIZADA - URLs E CONSTANTES
 * Este arquivo contém todas as URLs de API e constantes globais
 * Mantenha este arquivo atualizado para mudanças de ambiente
 */

(function () {
  // ================================================================
  // DETECCAO AUTOMATICA DE AMBIENTE
  // O mesmo codigo roda local e no servidor, sem precisar editar nada:
  //  - aberto em localhost / 127.0.0.1 / rede interna / file://  -> API local
  //  - aberto em qualquer outro dominio                          -> API publica
  // Para forcar um ambiente (ex.: testar a API de producao rodando local),
  // use no console: localStorage.setItem('apiBaseUrl', 'https://kernel-api.exksvol.com')
  // e para voltar ao automatico: localStorage.removeItem('apiBaseUrl')
  // ================================================================
  const API_PRODUCAO = 'https://kernel-api.exksvol.com';
  const PORTA_API_LOCAL = 5000;

  function detectarAmbiente() {
    const host = window.location.hostname; // '' quando aberto via file://
    const ehLocal =
      host === '' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);

    if (!ehLocal) return API_PRODUCAO;

    // Mantem o mesmo host da pagina para funcionar tambem quando
    // outro aparelho da rede acessa o painel pelo IP da maquina.
    const hostLocal = host === '' ? 'localhost' : host;
    return `${window.location.protocol === 'https:' ? 'https' : 'http'}://${hostLocal}:${PORTA_API_LOCAL}`;
  }

  // Override manual tem prioridade sobre a deteccao automatica
  const API_BASE_URL = localStorage.getItem('apiBaseUrl') || detectarAmbiente();
  const isDevelopment = API_BASE_URL !== API_PRODUCAO;

  console.log(`[config] API em uso: ${API_BASE_URL}${localStorage.getItem('apiBaseUrl') ? ' (forcado via localStorage)' : ''}`);

  // CONSTANTES DE ENDPOINTS
  const API_ENDPOINTS = {
    // Autenticação
    LOGIN: `${API_BASE_URL}/login`,
    MODULOS: `${API_BASE_URL}/modulos`,

    // Produtos
    PRODUTOS_CONSULTAR: `${API_BASE_URL}/produtos/consultar`,
    PRODUTOS_SALVAR: `${API_BASE_URL}/produtos/salvar`,
    PRODUTOS_BUSCAR: (id) => `${API_BASE_URL}/produtos/buscar/${id}`,
    PRODUTOS_ATUALIZAR: (id) => `${API_BASE_URL}/produtos/atualizar/${id}`,
    PRODUTOS_EXCLUIR: (id) => `${API_BASE_URL}/produtos/excluir/${id}`,
    PRODUTOS_ESTOQUE: `${API_BASE_URL}/produtos/estoque`,
    PRODUTOS_SUGESTOES: `${API_BASE_URL}/produtos/sugestoes-nomes`,
    PRODUTOS_IMAGEM: (id) => `${API_BASE_URL}/produtos/${id}/imagem`,

    // Retiradas
    RETIRADAS_SALVAR: `${API_BASE_URL}/retirada/salvar`,
    RETIRADAS_LISTAR: `${API_BASE_URL}/retiradas`,
    RETIRADAS_IDS: `${API_BASE_URL}/retiradas/ids`,
    RETIRADAS_POR_ID: `${API_BASE_URL}/retiradas/por-id`,

    // Devoluções
    DEVOLUCAO_SALVAR: `${API_BASE_URL}/devolucao/salvar`,

    // Kits
    KITS_SALVAR: `${API_BASE_URL}/kits/salvar`,
    KITS_ITENS: `${API_BASE_URL}/kits/itens`,
    KITS_SUGESTOES: `${API_BASE_URL}/kits/sugestoes-nomes`,

    // Fornecedores
    FORNECEDORES_SALVAR: `${API_BASE_URL}/fornecedores/salvar`,

    // Requisitantes
    REQUISITANTES_SALVAR: `${API_BASE_URL}/requisitantes/salvar`,
    REQUISITANTES_LISTAR: `${API_BASE_URL}/requisitantes`,

    // Parâmetros
    PARAMETROS_CATEGORIA: `${API_BASE_URL}/parametros/categoria`,
    PARAMETROS_PATRIMONIO: `${API_BASE_URL}/parametros/patrimonio`,
    PARAMETROS_LOCAL_ESTOQUE: `${API_BASE_URL}/parametros/localEstoque`,
    PARAMETROS_FINALIDADE: `${API_BASE_URL}/parametros/finalidade`,
    PARAMETROS_TIPO: (tipo) => `${API_BASE_URL}/parametros/${tipo}`,
    PARAMETROS_LISTA: `${API_BASE_URL}/parametros`,

    // Usuário
    USUARIO_IMAGEM: (userId) => `${API_BASE_URL}/usuario/imagem/${userId}`,
  };


  // HELPER: monta a URL completa a partir de um caminho relativo.
  // Use SEMPRE esta funcao (ou API_ENDPOINTS) em vez de escrever a URL na mao,
  // caso contrario o modo local e o de producao se misturam.
  function apiUrl(path) {
    if (!path) return API_BASE_URL;
    if (/^https?:\/\//i.test(path)) return path;
    return API_BASE_URL + (path.startsWith('/') ? path : '/' + path);
  }

  // FUNO HELPER PARA FAZER FETCH COM TOKEN
  async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(endpoint, { ...options, headers });

      if (response.status === 401) {
        encerrarSessao();
        return null;
      }

      return response;
    } catch (error) {
      console.error('Erro na requisição:', error);
      throw error;
    }
  }


  // CAMINHO CORRETO DA TELA DE LOGIN A PARTIR DE QUALQUER PAGINA
  function urlLogin() {
    return /\/HTML\//i.test(window.location.pathname) ? '../index.html' : 'index.html';
  }

  // ENCERRA A SESSAO UMA UNICA VEZ (evita varios redirecionamentos simultaneos)
  let sessaoEncerrada = false;
  function encerrarSessao(mensagem) {
    if (sessaoEncerrada) return;
    sessaoEncerrada = true;
    console.warn(mensagem || 'Sessao expirada ou invalida. Redirecionando para o login...');
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('userData');
    window.location.href = urlLogin();
  }

  // INTERCEPTADOR GLOBAL DE FETCH
  // Garante em TODAS as chamadas da API o mesmo comportamento:
  //  - envia o token automaticamente (sem sobrescrever headers ja definidos)
  //  - trata 401/403 de forma unica, encerrando a sessao
  // Nao altera Content-Type: uploads com FormData continuam funcionando.
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = function (input, init) {
    init = init || {};
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const ehApi = url.indexOf(API_BASE_URL) === 0;

    if (ehApi) {
      const token = localStorage.getItem('token');
      const headers = new Headers(init.headers || (typeof input === 'object' && input.headers) || {});
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', 'Bearer ' + token);
      }
      init = Object.assign({}, init, { headers: headers });
    }

    return fetchOriginal(input, init).then(function (resposta) {
      if (ehApi && resposta.status === 401) {
        encerrarSessao();
      }
      return resposta;
    });
  };

  // Expõe globais necessários para os outros scripts
  window.API_BASE_URL       = API_BASE_URL;
  window.apiUrl             = apiUrl;
  window.API_EM_DESENVOLVIMENTO = isDevelopment;
  window.encerrarSessao     = encerrarSessao;
  window.API_ENDPOINTS      = API_ENDPOINTS;
  window.fetchAPI           = fetchAPI;
  window.TUNNEL_API_URL     = API_BASE_URL + '/';
  window.TUNNEL_KITS_API_URL = API_ENDPOINTS.KITS_ITENS;
})();


