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
    if (!valor) return '-';
    const d = new Date(String(valor).replace(' ', 'T'));
    if (isNaN(d.getTime())) return valor;
    return d.toLocaleString('pt-BR');
  }

  function formatarDuracao(minutos) {
    if (minutos === null || minutos === undefined) return '-';
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
    el('jor-status-tempo').textContent = '--:--:--';
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
      texto.textContent = 'Em jornada';
      detalhe.textContent = `Início: ${formatarDataHora(jornada.iniciado_em)}`;
      btnPausar.style.display = '';
      btnFinalizar.style.display = '';
      iniciarCronometro(jornada.iniciado_em);
    } else if (situacao === 'em_pausa') {
      card.classList.add('jor-status-pausada');
      texto.textContent = 'Em pausa';
      detalhe.textContent = `Jornada iniciada em ${formatarDataHora(jornada.iniciado_em)}`;
      btnRetomar.style.display = '';
      btnFinalizar.style.display = '';
    } else {
      card.classList.add('jor-status-fora');
      texto.textContent = 'Fora de jornada';
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
          <td>${escapar(j.contrato_nome || '-')}</td>
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
          <td>${escapar(j.contrato_nome || '-')}</td>
          <td>${formatarDataHora(j.iniciado_em)}</td>
          <td>${formatarDataHora(j.finalizado_em)}</td>
          <td>${formatarDuracao(j.duracao_minutos)}</td>
          <td>${badge(j.status)}</td>
          <td>
            ${(j.status === 'aberta' || j.status === 'pausada')
              ? `<button class="jor-btn jor-btn-admin" data-acao="encerrar" data-id="${j.id}">Encerrar</button>
                 <button class="jor-btn jor-btn-admin" data-acao="cancelar" data-id="${j.id}">Cancelar</button>`
              : '-'}
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

  // ---------------------------------------------------------- CALENDÁRIO
  // Escala da pessoa (do cadastro de funcionário) e feriados nacionais e
  // municipais deste ano e do próximo.
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const cal = { escala: null, feriados: {}, ano: 0, mes: 0, selecionado: null };

  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const dataLocal = (texto) => { const [a, m, d] = texto.split('-').map(Number); return new Date(a, m - 1, d); };

  function trabalhaNo(d) {
    const e = cal.escala;
    if (!e) return false;
    const dia = d.getDay();
    if (e.tipo === '5x2') return dia >= 1 && dia <= 5;
    if (e.tipo === '6x1') return dia >= 1 && dia <= 6;
    if (!e.ciclo || !e.inicio) return false;
    const diff = Math.round((d - dataLocal(e.inicio)) / 86400000);
    return ((diff % e.ciclo) + e.ciclo) % e.ciclo === 0;
  }

  function limitesNavegacao() {
    const hoje = new Date();
    return { min: hoje.getFullYear() * 12, max: (hoje.getFullYear() + 1) * 12 + 11 };
  }

  function desenharCalendario() {
    const { ano, mes } = cal;
    el('jor-cal-mes').textContent = MESES[mes] + ' de ' + ano;
    const lim = limitesNavegacao();
    el('jor-cal-ant').disabled = ano * 12 + mes <= lim.min;
    el('jor-cal-prox').disabled = ano * 12 + mes >= lim.max;

    const primeiro = new Date(ano, mes, 1);
    const total = new Date(ano, mes + 1, 0).getDate();
    const hojeIso = iso(new Date());
    let html = '';
    for (let i = 0; i < primeiro.getDay(); i++) html += '<span class="jor-cal-dia fora"></span>';
    for (let d = 1; d <= total; d++) {
      const data = new Date(ano, mes, d);
      const chave = iso(data);
      const fer = cal.feriados[chave];
      const classes = ['jor-cal-dia'];
      if (data.getDay() === 0 || data.getDay() === 6) classes.push('fds');
      if (trabalhaNo(data)) classes.push('escala');
      if (fer) classes.push('feriado', fer.tipo);
      if (chave === hojeIso) classes.push('hoje');
      if (chave === cal.selecionado) classes.push('selecionado');
      const titulo = fer ? fer.nome + (fer.tipo === 'municipal' ? ' (municipal)' : ' (nacional)') : '';
      html += '<button type="button" class="' + classes.join(' ') + '" data-dia="' + chave + '"' +
        (titulo ? ' title="' + escapar(titulo) + '"' : ' tabindex="-1"') + '>' + d + '</button>';
    }
    el('jor-cal-dias').innerHTML = html;

    const prefixo = ano + '-' + String(mes + 1).padStart(2, '0');
    el('jor-cal-lista').innerHTML = Object.keys(cal.feriados).filter((k) => k.startsWith(prefixo)).sort()
      .map((k) => '<li' + (k === cal.selecionado ? ' class="ativo"' : '') + '><b>' + k.slice(8) + '</b>' + escapar(cal.feriados[k].nome) +
        '<small>' + (cal.feriados[k].tipo === 'municipal' ? 'Municipal' : 'Nacional') + '</small></li>').join('');

    el('jor-cal-info').textContent = cal.escala
      ? 'Escala ' + cal.escala.rotulo + '.'
      : 'Sua escala ainda não foi cadastrada. Peça para incluírem no seu cadastro de funcionário.';
  }

  function abrirCalendario() {
    const hoje = new Date();
    cal.ano = hoje.getFullYear(); cal.mes = hoje.getMonth(); cal.selecionado = null;
    desenharCalendario();
    el('jor-cal').hidden = false;
    if (window.travarRolagemFundo) window.travarRolagemFundo(true);
  }

  function fecharCalendario() {
    if (el('jor-cal').hidden) return;
    el('jor-cal').hidden = true;
    if (window.travarRolagemFundo) window.travarRolagemFundo(false);
  }

  function mudarMes(passo) {
    const alvo = cal.ano * 12 + cal.mes + passo;
    const lim = limitesNavegacao();
    if (alvo < lim.min || alvo > lim.max) return;
    cal.ano = Math.floor(alvo / 12); cal.mes = alvo % 12; cal.selecionado = null;
    desenharCalendario();
  }

  function ligarCalendario() {
    el('jor-btn-calendario').addEventListener('click', abrirCalendario);
    el('jor-cal-fechar').addEventListener('click', fecharCalendario);
    el('jor-cal-ant').addEventListener('click', () => mudarMes(-1));
    el('jor-cal-prox').addEventListener('click', () => mudarMes(1));
    el('jor-cal').addEventListener('click', (e) => { if (e.target === el('jor-cal')) fecharCalendario(); });
    el('jor-cal-dias').addEventListener('click', (e) => {
      const dia = e.target.closest('.feriado');
      if (!dia) return;
      cal.selecionado = cal.selecionado === dia.dataset.dia ? null : dia.dataset.dia;
      desenharCalendario();
    });
    document.addEventListener('keydown', (e) => {
      if (el('jor-cal').hidden) return;
      if (e.key === 'Escape') fecharCalendario();
      else if (e.key === 'ArrowLeft') mudarMes(-1);
      else if (e.key === 'ArrowRight') mudarMes(1);
    });
    // Arrastar para o lado troca o mês (celular).
    let x0 = null;
    el('jor-cal-dias').addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    el('jor-cal-dias').addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) mudarMes(dx < 0 ? 1 : -1);
    });
  }

  function preencherHoje() {
    const hoje = new Date();
    const hojeIso = iso(hoje);
    el('jor-hoje-data').textContent = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    el('jor-hoje-escala').innerHTML = cal.escala
      ? (trabalhaNo(hoje) ? '<i class="lg-escala"></i>Dia de trabalho na sua escala (' + escapar(cal.escala.tipo) + ')'
        : '<i style="background:#e2e8f0"></i>Folga na sua escala (' + escapar(cal.escala.tipo) + ')')
      : '<i style="background:#e2e8f0"></i>Escala não cadastrada';
    const fer = cal.feriados[hojeIso];
    el('jor-hoje-feriado').innerHTML = fer ? '<i class="lg-' + fer.tipo + '" style="border-radius:50%"></i>Feriado: ' + escapar(fer.nome) : '';
    const proximo = Object.keys(cal.feriados).sort().find((k) => k > hojeIso);
    el('jor-proximo-feriado').textContent = proximo
      ? 'Próximo feriado: ' + cal.feriados[proximo].nome + ', ' + dataLocal(proximo).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
      : '';
  }

  async function carregarCalendario() {
    try {
      const resp = await chamar('GET', '/jornada/calendario');
      cal.escala = resp.dados.escala || null;
      cal.feriados = {};
      (resp.dados.feriados || []).forEach((f) => { cal.feriados[f.data] = f; });
    } catch (e) {
      console.error('[jornada] calendario', e);
    }
    preencherHoje();
  }

  function inicializar() {
    if (typeof window.inicializarAbasPadrao === 'function') window.inicializarAbasPadrao();
    if (!localStorage.getItem('token')) return;
    ligarAcoesMeuPainel();
    ligarAcoesAdmin();
    carregarEstadoAtual();
    carregarMeuHistorico();
    ligarCalendario();
    carregarCalendario();

    // Administração: só para quem tem a permissão (a API também bloqueia).
    const iniciarAdmin = (info) => {
      const matriz = info && info.modulos && info.modulos.permissoes;
      if (matriz && !(matriz.jornada_admin || {}).ver) return;
      carregarPainelAdmin();
      document.querySelectorAll('.tab-btn[data-tab="administracao"]').forEach((botao) => {
        botao.addEventListener('click', () => { buscarHistoricoAdmin(); });
      });
    };
    if (typeof window.obterModulos === 'function') window.obterModulos().then(iniciarAdmin, () => iniciarAdmin(null));
    else iniciarAdmin();
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
