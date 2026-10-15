//======================================================================================================
// JORNADA OPERACIONAL (Fase 10)
// Auto-servico (iniciar/pausar/retomar/finalizar a propria jornada) +
// painel administrativo (quem esta em jornada agora, historico, acoes
// administrativas). Nunca envia status/inicio/fim livres para a API - so
// chama as acoes de dominio (/jornada/iniciar, /pausar, /retomar,
// /finalizar, /<id>/encerrar-administrativo, /<id>/cancelar).
//======================================================================================================
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);

  function urlApi(caminho) {
    return (typeof window.apiUrl === 'function') ? window.apiUrl(caminho) : caminho;
  }

  function cabecalhos() {
    const token = localStorage.getItem('token');
    const base = { 'Content-Type': 'application/json' };
    if (token) base.Authorization = 'Bearer ' + token;
    return base;
  }

  function escapar(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  async function chamar(metodo, caminho, corpo) {
    const resposta = await fetch(urlApi(caminho), {
      method: metodo, headers: cabecalhos(), body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok || !dados || dados.status !== 'ok') {
      const erro = new Error((dados && dados.mensagem) || 'Falha na requisição');
      erro.codigo = resposta.status;
      throw erro;
    }
    return dados;
  }

  function formatarDataHora(valor) {
    if (!valor) return '—';
    const d = new Date(String(valor).replace(' ', 'T'));
    if (isNaN(d.getTime())) return valor;
    return d.toLocaleString('pt-BR');
  }

  function formatarDuracao(minutos) {
    if (minutos === null || minutos === undefined) return '—';
    const h = Math.floor(minutos / 60);
    const m = Math.round(minutos % 60);
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }

  function badge(status) {
    const rotulos = { aberta: 'Aberta', pausada: 'Pausada', encerrada: 'Encerrada', cancelada: 'Cancelada' };
    return `<span class="jor-badge jor-badge-${status}">${rotulos[status] || status}</span>`;
  }

  function mostrarMensagem(elemento, texto, tipo) {
    elemento.textContent = texto;
    elemento.className = 'jor-mensagem' + (tipo ? ' ' + tipo : '');
    if (texto) setTimeout(() => { if (elemento.textContent === texto) elemento.textContent = ''; }, 6000);
  }

  // ---------------------------------------------------------- MEU PAINEL
  let cronometroId = null;
  let inicioAtual = null;

  function pararCronometro() {
    if (cronometroId) { clearInterval(cronometroId); cronometroId = null; }
    el('jor-status-tempo').textContent = '';
  }

  function iniciarCronometro(desde) {
    pararCronometro();
    inicioAtual = new Date(String(desde).replace(' ', 'T'));
    function atualizar() {
      const diffMs = Date.now() - inicioAtual.getTime();
      if (diffMs < 0) { el('jor-status-tempo').textContent = ''; return; }
      const totalSeg = Math.floor(diffMs / 1000);
      const h = String(Math.floor(totalSeg / 3600)).padStart(2, '0');
      const m = String(Math.floor((totalSeg % 3600) / 60)).padStart(2, '0');
      const s = String(totalSeg % 60).padStart(2, '0');
      el('jor-status-tempo').textContent = `${h}:${m}:${s}`;
    }
    atualizar();
    cronometroId = setInterval(atualizar, 1000);
  }

  function aplicarEstado(situacao, jornada) {
    const card = el('jor-status-card');
    const texto = el('jor-status-texto');
    const detalhe = el('jor-status-detalhe');
    const btnIniciar = el('jor-btn-iniciar');
    const btnPausar = el('jor-btn-pausar');
    const btnRetomar = el('jor-btn-retomar');
    const btnFinalizar = el('jor-btn-finalizar');

    card.classList.remove('jor-status-fora', 'jor-status-aberta', 'jor-status-pausada');
    btnIniciar.style.display = 'none';
    btnPausar.style.display = 'none';
    btnRetomar.style.display = 'none';
    btnFinalizar.style.display = 'none';
    pararCronometro();

    if (situacao === 'em_jornada') {
      card.classList.add('jor-status-aberta');
      texto.textContent = 'EM JORNADA';
      detalhe.textContent = `Início: ${formatarDataHora(jornada.iniciado_em)}`;
      btnPausar.style.display = '';
      btnFinalizar.style.display = '';
      iniciarCronometro(jornada.iniciado_em);
    } else if (situacao === 'em_pausa') {
      card.classList.add('jor-status-pausada');
      texto.textContent = 'EM PAUSA';
      detalhe.textContent = `Jornada iniciada em ${formatarDataHora(jornada.iniciado_em)}`;
      btnRetomar.style.display = '';
      btnFinalizar.style.display = '';
    } else {
      card.classList.add('jor-status-fora');
      texto.textContent = 'FORA DE JORNADA';
      detalhe.textContent = 'Nenhuma jornada em andamento.';
      btnIniciar.style.display = '';
    }
  }

  async function carregarEstadoAtual() {
    try {
      const resp = await chamar('GET', '/jornada/atual');
      aplicarEstado(resp.dados.situacao, resp.dados.jornada);
    } catch (e) {
      console.error('[jornada] estado atual', e);
    }
  }

  async function carregarMeuHistorico() {
    try {
      const resp = await chamar('GET', '/jornada/meu-historico?limite=20');
      const tbody = document.querySelector('#jor-tabela-historico tbody');
      tbody.innerHTML = (resp.dados || []).map((j) => `
        <tr>
          <td>${formatarDataHora(j.iniciado_em)}</td>
          <td>${formatarDataHora(j.finalizado_em)}</td>
          <td>${formatarDuracao(j.duracao_minutos)}</td>
          <td>${badge(j.status)}</td>
          <td>${escapar(j.observacao || '')}</td>
        </tr>`).join('') || '<tr><td colspan="5">Nenhum registro.</td></tr>';
    } catch (e) {
      console.error('[jornada] meu historico', e);
    }
  }

  function ligarAcoesMeuPainel() {
    const msg = el('jor-mensagem');

    el('jor-btn-iniciar').addEventListener('click', async () => {
      try {
        await chamar('POST', '/jornada/iniciar', {});
        mostrarMensagem(msg, 'Jornada iniciada.', 'sucesso');
        await carregarEstadoAtual();
        await carregarMeuHistorico();
      } catch (e) { mostrarMensagem(msg, e.message, 'erro'); }
    });

    el('jor-btn-pausar').addEventListener('click', async () => {
      try {
        await chamar('POST', '/jornada/pausar', {});
        mostrarMensagem(msg, 'Jornada pausada.', 'sucesso');
        await carregarEstadoAtual();
      } catch (e) { mostrarMensagem(msg, e.message, 'erro'); }
    });

    el('jor-btn-retomar').addEventListener('click', async () => {
      try {
        await chamar('POST', '/jornada/retomar', {});
        mostrarMensagem(msg, 'Jornada retomada.', 'sucesso');
        await carregarEstadoAtual();
      } catch (e) { mostrarMensagem(msg, e.message, 'erro'); }
    });

    el('jor-btn-finalizar').addEventListener('click', async () => {
      if (!confirm('Finalizar a jornada atual?')) return;
      try {
        await chamar('POST', '/jornada/finalizar', {});
        mostrarMensagem(msg, 'Jornada finalizada.', 'sucesso');
        await carregarEstadoAtual();
        await carregarMeuHistorico();
      } catch (e) { mostrarMensagem(msg, e.message, 'erro'); }
    });
  }

  // ---------------------------------------------------------- ADMINISTRACAO
  async function carregarPainelAdmin() {
    try {
      const resp = await chamar('GET', '/jornada/painel');
      const tbody = document.querySelector('#jor-tabela-painel tbody');
      tbody.innerHTML = (resp.dados || []).map((j) => `
        <tr>
          <td>${escapar(j.usuario_nome || ('#' + j.usuario_id))}</td>
          <td>${escapar(j.contrato_nome || '—')}</td>
          <td>${badge(j.status)}</td>
          <td>${formatarDataHora(j.iniciado_em)}</td>
          <td>
            <button class="jor-btn jor-btn-admin" data-acao="encerrar" data-id="${j.id}">Encerrar</button>
            <button class="jor-btn jor-btn-admin" data-acao="cancelar" data-id="${j.id}">Cancelar</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="5">Nenhum funcionário em jornada no momento.</td></tr>';
    } catch (e) {
      if (e.codigo !== 403) console.error('[jornada] painel admin', e);
    }
  }

  async function buscarHistoricoAdmin() {
    const params = new URLSearchParams();
    const usuarioId = el('jor-filtro-usuario').value.trim();
    if (usuarioId) params.set('usuario_id', usuarioId);
    if (el('jor-filtro-status').value) params.set('status', el('jor-filtro-status').value);
    if (el('jor-filtro-inicio').value) params.set('inicio', el('jor-filtro-inicio').value);
    if (el('jor-filtro-fim').value) params.set('fim', el('jor-filtro-fim').value);
    params.set('limite', '100');

    try {
      const resp = await chamar('GET', '/jornada/buscar?' + params.toString());
      const tbody = document.querySelector('#jor-tabela-busca tbody');
      tbody.innerHTML = (resp.dados || []).map((j) => `
        <tr>
          <td>${escapar(j.usuario_nome || ('#' + j.usuario_id))}</td>
          <td>${escapar(j.contrato_nome || '—')}</td>
          <td>${formatarDataHora(j.iniciado_em)}</td>
          <td>${formatarDataHora(j.finalizado_em)}</td>
          <td>${formatarDuracao(j.duracao_minutos)}</td>
          <td>${badge(j.status)}</td>
          <td>
            ${(j.status === 'aberta' || j.status === 'pausada')
              ? `<button class="jor-btn jor-btn-admin" data-acao="encerrar" data-id="${j.id}">Encerrar</button>
                 <button class="jor-btn jor-btn-admin" data-acao="cancelar" data-id="${j.id}">Cancelar</button>`
              : '—'}
          </td>
        </tr>`).join('') || '<tr><td colspan="7">Nenhum resultado.</td></tr>';
    } catch (e) {
      mostrarMensagem(el('jor-admin-mensagem'), e.message, 'erro');
    }
  }

  function ligarAcoesAdmin() {
    el('jor-btn-buscar').addEventListener('click', buscarHistoricoAdmin);

    document.addEventListener('click', async (ev) => {
      const botao = ev.target.closest('[data-acao]');
      if (!botao) return;
      const acao = botao.dataset.acao;
      const id = botao.dataset.id;
      if (acao === 'encerrar') {
        if (!confirm('Encerrar administrativamente esta jornada?')) return;
        try {
          await chamar('POST', `/jornada/${id}/encerrar-administrativo`, {});
          mostrarMensagem(el('jor-admin-mensagem'), 'Jornada encerrada.', 'sucesso');
          await carregarPainelAdmin();
          await buscarHistoricoAdmin();
        } catch (e) { mostrarMensagem(el('jor-admin-mensagem'), e.message, 'erro'); }
      } else if (acao === 'cancelar') {
        const motivo = prompt('Motivo do cancelamento:');
        if (!motivo) return;
        try {
          await chamar('POST', `/jornada/${id}/cancelar`, { motivo });
          mostrarMensagem(el('jor-admin-mensagem'), 'Jornada cancelada.', 'sucesso');
          await carregarPainelAdmin();
          await buscarHistoricoAdmin();
        } catch (e) { mostrarMensagem(el('jor-admin-mensagem'), e.message, 'erro'); }
      }
    });
  }

  function inicializar() {
    if (typeof window.inicializarAbasPadrao === 'function') window.inicializarAbasPadrao();
    if (!localStorage.getItem('token')) return;
    ligarAcoesMeuPainel();
    ligarAcoesAdmin();
    carregarEstadoAtual();
    carregarMeuHistorico();
    carregarPainelAdmin();

    document.querySelectorAll('.tab-btn[data-tab="administracao"]').forEach((botao) => {
      botao.addEventListener('click', () => { buscarHistoricoAdmin(); });
    });
  }

  // 'DOMContentLoaded' pode ja ter disparado quando este script roda
  // (mesma guarda ja necessaria em paginas com carregamento em cache) -
  // sem isso o listener e registrado tarde demais e nunca executa.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
