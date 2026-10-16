//======================================================================================================
// RELATORIOS - camada de acesso a API e formatacao
// Nenhum calculo de indicador acontece aqui nem em qualquer outro arquivo do
// frontend: ranking, contagem, agrupamento e recorrencia sao resolvidos no
// banco. O navegador so pede um resumo pronto e desenha.
//======================================================================================================
(function () {
  'use strict';

  function urlApi(caminho) {
    return (typeof window.apiUrl === 'function')
      ? window.apiUrl(caminho)
      : caminho;
  }

  function cabecalhos() {
    const token = localStorage.getItem('token');
    const base = { 'Content-Type': 'application/json' };
    if (token) base.Authorization = 'Bearer ' + token;
    return base;
  }

  // Cada chamada nova cancela a anterior da mesma chave. Sem isso, trocar o
  // filtro rapidamente faz respostas antigas chegarem depois das novas e
  // sobrescreverem a tela com dado desatualizado.
  const emVoo = {};

  async function buscar(caminho, parametros, chave) {
    const url = new URL(urlApi(caminho), window.location.origin);
    Object.entries(parametros || {}).forEach(([nome, valor]) => {
      if (valor !== null && valor !== undefined && valor !== '') {
        url.searchParams.set(nome, valor);
      }
    });

    const identificador = chave || caminho;
    if (emVoo[identificador]) emVoo[identificador].abort();
    const controlador = new AbortController();
    emVoo[identificador] = controlador;

    try {
      const resposta = await fetch(url.toString(), {
        headers: cabecalhos(),
        signal: controlador.signal,
      });
      if (!resposta) return null;                       // sessao encerrada
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok || !corpo || corpo.status !== 'ok') {
        const mensagem = (corpo && corpo.mensagem) || 'Erro ao consultar a API.';
        throw new Error(mensagem);
      }
      return corpo.dados;
    } finally {
      if (emVoo[identificador] === controlador) delete emVoo[identificador];
    }
  }

  async function enviar(caminho, metodo, dados) {
    const resposta = await fetch(urlApi(caminho), {
      method: metodo,
      headers: cabecalhos(),
      body: dados ? JSON.stringify(dados) : undefined,
    });
    if (!resposta) return null;
    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok || !corpo || corpo.status !== 'ok') {
      throw new Error((corpo && corpo.mensagem) || 'Erro ao salvar.');
    }
    return corpo;
  }

  //--------------------------------------------------------------- formatacao
  function escaparHtml(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function dataCurta(valor) {
    if (!valor) return '-';
    const data = new Date(String(valor).replace(' ', 'T'));
    if (isNaN(data.getTime())) return '-';
    return data.toLocaleDateString('pt-BR');
  }

  function numero(valor) {
    if (valor === null || valor === undefined || valor === '') return '-';
    return Number(valor).toLocaleString('pt-BR');
  }

  // Indicador sem amostra suficiente nao vira numero: vira travessao. Exibir
  // "0 dias" para quem nunca teve intervalo medido seria informacao falsa.
  function dias(valor) {
    if (valor === null || valor === undefined || valor === '') return '-';
    const n = Number(valor);
    return isNaN(n) ? '-' : n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' d';
  }

  function horas(valor) {
    if (valor === null || valor === undefined || valor === '') return '-';
    const n = Number(valor);
    if (isNaN(n)) return '-';
    if (n < 48) return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' h';
    return (n / 24).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' d';
  }

  function percentual(valor) {
    if (valor === null || valor === undefined) return '-';
    return Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
  }

  //------------------------------------------------------------------ estados
  function estadoCarregando(elemento, mensagem) {
    if (!elemento) return;
    elemento.innerHTML = window.htmlCarregandoLogo
      ? window.htmlCarregandoLogo(mensagem || 'Carregando...')
      : '<div class="rel-estado rel-estado-carregando">'
        + '<span class="rel-spinner" aria-hidden="true"></span>'
        + '<span>' + escaparHtml(mensagem || 'Carregando...') + '</span></div>';
  }

  function estadoVazio(elemento, titulo, detalhe) {
    if (!elemento) return;
    elemento.innerHTML =
      '<div class="rel-estado rel-estado-vazio">'
      + '<strong>' + escaparHtml(titulo || 'Sem dados no período') + '</strong>'
      + (detalhe ? '<span>' + escaparHtml(detalhe) + '</span>' : '')
      + '</div>';
  }

  function estadoErro(elemento, mensagem) {
    if (!elemento) return;
    elemento.innerHTML =
      '<div class="rel-estado rel-estado-erro">'
      + '<strong>Não foi possível carregar</strong>'
      + '<span>' + escaparHtml(mensagem || '') + '</span></div>';
  }

  window.RelatoriosApi = {
    buscar: buscar,
    enviar: enviar,
    urlApi: urlApi,
    escaparHtml: escaparHtml,
    dataCurta: dataCurta,
    numero: numero,
    dias: dias,
    horas: horas,
    percentual: percentual,
    estadoCarregando: estadoCarregando,
    estadoVazio: estadoVazio,
    estadoErro: estadoErro,
  };
})();
