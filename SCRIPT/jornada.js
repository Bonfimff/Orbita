//======================================================================================================
// JORNADA (módulo próprio, acessível sem Gestão)
// Auto-serviço: iniciar/pausar/retomar/finalizar a própria jornada, histórico
// e calendário com escala e feriados. O controle das jornadas da equipe fica
// em Gestão › Controle de Jornadas (SCRIPT/gestao-jornadas.js).
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
    const rotulos = { aberta: 'Trabalhando', pausada: 'Em intervalo', encerrada: 'Encerrada', cancelada: 'Cancelada' };
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
      texto.textContent = 'Trabalhando';
      detalhe.textContent = `Entrada: ${formatarDataHora(jornada.iniciado_em)}`;
      btnPausar.style.display = '';
      btnFinalizar.style.display = '';
      iniciarCronometro(jornada.iniciado_em);
    } else if (situacao === 'em_pausa') {
      card.classList.add('jor-status-pausada');
      texto.textContent = 'Em intervalo';
      detalhe.textContent = `Entrada: ${formatarDataHora(jornada.iniciado_em)}`;
      btnRetomar.style.display = '';
      btnFinalizar.style.display = '';
    } else {
      card.classList.add('jor-status-fora');
      texto.textContent = 'Fora do expediente';
      detalhe.textContent = 'Nenhum registro em andamento.';
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
      if (window.FichaRegistro) window.FichaRegistro.ligarConsulta(document.getElementById('jor-tabela-historico'), { subtitulo: 'Meu registro de ponto' });
    } catch (e) {
      console.error('[jornada] meu historico', e);
    }
  }

  function ligarAcoesMeuPainel() {
    const msg = el('jor-mensagem');

    el('jor-btn-iniciar').addEventListener('click', async () => {
      try {
        await chamar('POST', '/jornada/iniciar', {});
        mostrarMensagem(msg, 'Entrada registrada.', 'sucesso');
        await carregarEstadoAtual();
        await carregarMeuHistorico();
      } catch (e) { mostrarMensagem(msg, e.message, 'erro'); }
    });

    el('jor-btn-pausar').addEventListener('click', async () => {
      try {
        await chamar('POST', '/jornada/pausar', {});
        mostrarMensagem(msg, 'Intervalo iniciado.', 'sucesso');
        await carregarEstadoAtual();
      } catch (e) { mostrarMensagem(msg, e.message, 'erro'); }
    });

    el('jor-btn-retomar').addEventListener('click', async () => {
      try {
        await chamar('POST', '/jornada/retomar', {});
        mostrarMensagem(msg, 'Intervalo encerrado.', 'sucesso');
        await carregarEstadoAtual();
      } catch (e) { mostrarMensagem(msg, e.message, 'erro'); }
    });

    el('jor-btn-finalizar').addEventListener('click', async () => {
      if (!confirm('Registrar a saída agora?')) return;
      try {
        await chamar('POST', '/jornada/finalizar', {});
        mostrarMensagem(msg, 'Saída registrada.', 'sucesso');
        await carregarEstadoAtual();
        await carregarMeuHistorico();
      } catch (e) { mostrarMensagem(msg, e.message, 'erro'); }
    });
  }

  // ---------------------------------------------------------- CALENDÁRIO
  // Escala da pessoa (do cadastro de funcionário) e feriados nacionais e
  // municipais deste ano e do próximo.
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const cal = { escala: null, feriados: {}, excecoes: {}, ano: 0, mes: 0, selecionado: null };

  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const dataLocal = (texto) => { const [a, m, d] = texto.split('-').map(Number); return new Date(a, m - 1, d); };

  function trabalhaPadrao(d) {
    const e = cal.escala;
    if (!e) return false;
    if (Array.isArray(e.dias) && !e.ciclo) return e.dias.includes(d.getDay());
    if (!e.ciclo || !e.inicio) return false;
    const diff = Math.round((d - dataLocal(e.inicio)) / 86400000);
    return ((diff % e.ciclo) + e.ciclo) % e.ciclo === 0;
  }

  // Padrão da escala + feriado (não trabalha) + ajuste daquele dia feito pela gestão.
  function trabalhaNo(d) {
    const exc = cal.excecoes[iso(d)];
    if (exc) return exc.tipo === 'trabalho' || exc.tipo === 'extra_banco';
    if (cal.feriados[iso(d)]) return false;
    return trabalhaPadrao(d);
  }

  function horarioDo(d) {
    const e = cal.escala || {};
    const exc = cal.excecoes[iso(d)];
    const h = (!e.ciclo && (e.horarios || {})[String(d.getDay())]) || { entrada: e.entrada, saida: e.saida };
    return { entrada: (exc && exc.entrada) || h.entrada, saida: (exc && exc.saida) || h.saida };
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
      const exc = cal.excecoes[chave];
      const h = horarioDo(data);
      const titulo = [fer ? fer.nome + (fer.tipo === 'municipal' ? ' (municipal)' : ' (nacional)') : '',
        exc ? exc.rotulo + (exc.observacao ? ': ' + exc.observacao : '') : '',
        trabalhaNo(data) && h.entrada && h.saida ? h.entrada + ' às ' + h.saida : ''].filter(Boolean).join(' · ');
      if (exc) classes.push('aj-' + exc.tipo);
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
      : '';
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
    const excHoje = cal.excecoes[hojeIso];
    const hHoje = horarioDo(hoje);
    const nota = excHoje ? ' · ' + escapar(excHoje.rotulo) + (excHoje.observacao ? ': ' + escapar(excHoje.observacao) : '') : '';
    el('jor-hoje-escala').innerHTML = cal.escala
      ? (trabalhaNo(hoje)
        ? '<i class="lg-escala"></i>Dia de trabalho' + (hHoje.entrada && hHoje.saida ? ', ' + hHoje.entrada + ' às ' + hHoje.saida : '') + nota
        : '<i style="background:#e2e8f0"></i>Folga hoje' + nota)
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
      cal.excecoes = resp.dados.excecoes || {};
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
    carregarEstadoAtual();
    carregarMeuHistorico();
    ligarCalendario();
    carregarCalendario();

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
