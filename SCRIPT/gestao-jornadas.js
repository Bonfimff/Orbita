//======================================================================================================
// GESTÃO › CONTROLE DE PONTO
// Folha de ponto por funcionário e mês, quem está em expediente agora,
// histórico com filtros, escalas de trabalho, detalhe de cada jornada (linha do tempo, correção de
// horário, encerrar/cancelar) e lançamento manual de jornada. Só aparece para
// quem tem a permissão "Ponto da equipe"; a API faz o bloqueio real.
//======================================================================================================
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const SITUACOES = {
    aberta: 'Trabalhando', pausada: 'Em intervalo', encerrada: 'Encerrada', cancelada: 'Cancelada',
  };
  const TIPOS_EVENTO = {
    inicio: 'Entrada', pausa: 'Início do intervalo', retorno: 'Fim do intervalo', fim: 'Saída',
    cancelamento: 'Cancelamento', correcao: 'Correção',
  };

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
      throw new Error((dados && dados.mensagem) || 'Falha na requisição');
    }
    return dados;
  }

  const data = (v) => (v ? new Date(String(v).replace(' ', 'T').replace(/ GMT$/, '')) : null);
  function hora(v) {
    const d = data(v);
    return d && !isNaN(d) ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  }
  function dataHora(v) {
    const d = data(v);
    return d && !isNaN(d) ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
  }
  function duracao(min) {
    if (min === null || min === undefined) return '-';
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h + 'h' + String(m).padStart(2, '0');
  }
  const isoLocal = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function paraInput(v) {
    const d = data(v);
    if (!d || isNaN(d)) return '';
    return isoLocal(d) + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  const selo = (status) => `<span class="jor-badge jor-badge-${status}">${SITUACOES[status] || status}</span>`;

  function mensagem(elemento, texto, tipo) {
    elemento.textContent = texto;
    elemento.className = 'jor-mensagem' + (tipo ? ' ' + tipo : '');
  }

  function abrir(id) {
    el(id).hidden = false;
    if (window.travarRolagemFundo) window.travarRolagemFundo(true);
  }
  function fechar(id) {
    if (el(id).hidden) return;
    el(id).hidden = true;
    if (window.travarRolagemFundo) window.travarRolagemFundo(false);
  }

  // ---------------------------------------------------------- PESSOAS
  let pessoas = [];
  async function carregarPessoas() {
    try {
      pessoas = (await chamar('GET', '/jornada/pessoas')).dados || [];
    } catch (e) { pessoas = []; }
    const opcoes = pessoas.map((p) => `<option value="${p.id}">${escapar(p.nome)}${p.funcao ? ' · ' + escapar(p.funcao) : ''}</option>`).join('');
    el('ponto-pessoa').innerHTML = '<option value="">Escolha o funcionário</option>' + opcoes;
    el('jor-filtro-usuario').innerHTML = '<option value="">Todos os funcionários</option>' + opcoes;
    el('lancar-pessoa').innerHTML = '<option value="">Escolha</option>' + opcoes;
  }

  // ---------------------------------------------------------- FOLHA DE PONTO
  let ultimaFolha = null;
  function periodoDoMes() {
    const [a, m] = el('ponto-mes').value.split('-').map(Number);
    return { inicio: isoLocal(new Date(a, m - 1, 1)), fim: isoLocal(new Date(a, m, 0)) };
  }

  async function carregarFolha() {
    const pessoa = el('ponto-pessoa').value;
    const corpo = document.querySelector('#ponto-tabela tbody');
    if (!pessoa || !el('ponto-mes').value) {
      corpo.innerHTML = '<tr><td colspan="6">Escolha um funcionário.</td></tr>';
      el('ponto-kpis').innerHTML = '';
      el('ponto-folha-cab').innerHTML = '';
      return;
    }
    corpo.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
    const { inicio, fim } = periodoDoMes();
    try {
      const r = await chamar('GET', `/jornada/folha?usuario_id=${pessoa}&inicio=${inicio}&fim=${fim}`);
      ultimaFolha = r;
      desenharFolha(r);
    } catch (e) {
      corpo.innerHTML = `<tr><td colspan="6">${escapar(e.message)}</td></tr>`;
    }
  }

  function desenharFolha(r) {
    const t = r.totais || {};
    const nomeMes = new Date(el('ponto-mes').value + '-01T12:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    el('ponto-folha-cab').innerHTML = `<strong>${escapar((r.pessoa && r.pessoa.nome) || '')}</strong>` +
      `<span>${escapar(nomeMes)}${r.escala ? ' · Escala ' + escapar(r.escala.rotulo) : ''}</span>`;
    const kpi = (rotulo, valor, classe) => `<div class="ponto-kpi ${classe || ''}"><span>${rotulo}</span><strong>${valor}</strong></div>`;
    el('ponto-kpis').innerHTML =
      kpi('Horas trabalhadas', duracao(t.trabalhado_minutos)) +
      kpi('Dias trabalhados', t.dias_trabalhados || 0) +
      (r.escala ? kpi('Dias na escala', t.dias_escala || 0) : '') +
      (r.escala ? kpi('Faltas', t.faltas || 0, t.faltas ? 'alerta' : '') : '') +
      kpi('Intervalos', duracao(t.pausa_minutos));

    const linhas = [];
    (r.dados || []).forEach((dia) => {
      const d = new Date(dia.data + 'T12:00');
      const rotuloData = `<span class="ponto-dia">${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}</span> <small>${DIAS[d.getDay()]}</small>`;
      const classeDia = 'ponto-' + dia.situacao + (d.getDay() === 0 || d.getDay() === 6 ? ' ponto-fds' : '');
      const situacaoDia = {
        feriado: 'Feriado' + (dia.feriado ? ': ' + escapar(dia.feriado.nome) : ''),
        falta: 'Falta', folga: dia.previsto ? '' : 'Folga', previsto: 'Previsto', trabalhado: '',
      }[dia.situacao] || '';
      if (!dia.jornadas.length) {
        linhas.push(`<tr class="${classeDia}"><td>${rotuloData}</td><td></td><td></td><td></td><td></td>` +
          `<td><span class="ponto-situacao">${situacaoDia}</span></td></tr>`);
        return;
      }
      dia.jornadas.forEach((j, i) => {
        const intervalo = (j.pausas || []).map((p) => hora(p.inicio) + ' às ' + hora(p.fim)).join('<br>');
        const saida = j.finalizado_em ? hora(j.finalizado_em) + (data(j.finalizado_em).getDate() !== d.getDate() ? ' <small>(+1)</small>' : '') : '';
        const lancada = j.origem === 'Admin' ? ' <span class="ponto-tag" title="Lançada ou ajustada pela gestão">ajuste</span>' : '';
        linhas.push(`<tr class="${classeDia} ponto-clicavel" data-jornada="${j.id}" tabindex="0">` +
          `<td>${i === 0 ? rotuloData : ''}</td><td>${hora(j.iniciado_em)}</td><td>${intervalo || '-'}</td>` +
          `<td>${saida || '-'}</td><td><strong>${duracao(j.trabalhado_minutos)}</strong></td>` +
          `<td>${j.status === 'encerrada' ? '' : selo(j.status)}${dia.feriado ? ' <span class="ponto-situacao">Feriado</span>' : ''}${lancada}</td></tr>`);
      });
    });
    document.querySelector('#ponto-tabela tbody').innerHTML = linhas.join('');
  }

  // ---------------------------------------------------------- EM EXPEDIENTE
  async function carregarAgora() {
    const corpo = document.querySelector('#jor-tabela-painel tbody');
    try {
      const r = await chamar('GET', '/jornada/painel');
      corpo.innerHTML = (r.dados || []).map((j) => `
        <tr class="ponto-clicavel" data-jornada="${j.id}" tabindex="0">
          <td>${escapar(j.usuario_nome || ('#' + j.usuario_id))}</td>
          <td>${escapar(j.contrato_nome || '-')}</td>
          <td>${selo(j.status)}</td>
          <td>${dataHora(j.iniciado_em)}</td>
        </tr>`).join('') || '<tr><td colspan="4">Ninguém em expediente agora.</td></tr>';
    } catch (e) {
      corpo.innerHTML = `<tr><td colspan="4">${escapar(e.message)}</td></tr>`;
    }
  }

  // ---------------------------------------------------------- HISTÓRICO
  async function buscarHistorico() {
    const params = new URLSearchParams();
    if (el('jor-filtro-usuario').value) params.set('usuario_id', el('jor-filtro-usuario').value);
    if (el('jor-filtro-status').value) params.set('status', el('jor-filtro-status').value);
    if (el('jor-filtro-inicio').value) params.set('inicio', el('jor-filtro-inicio').value);
    if (el('jor-filtro-fim').value) params.set('fim', el('jor-filtro-fim').value + ' 23:59:59');
    params.set('limite', '100');
    const corpo = document.querySelector('#jor-tabela-busca tbody');
    try {
      const r = await chamar('GET', '/jornada/buscar?' + params.toString());
      corpo.innerHTML = (r.dados || []).map((j) => `
        <tr class="ponto-clicavel" data-jornada="${j.id}" tabindex="0">
          <td>${escapar(j.usuario_nome || ('#' + j.usuario_id))}</td>
          <td>${escapar(j.contrato_nome || '-')}</td>
          <td>${dataHora(j.iniciado_em)}</td>
          <td>${j.finalizado_em ? dataHora(j.finalizado_em) : '-'}</td>
          <td>${duracao(j.duracao_minutos)}</td>
          <td>${selo(j.status)}</td>
        </tr>`).join('') || '<tr><td colspan="6">Nenhum resultado.</td></tr>';
    } catch (e) {
      corpo.innerHTML = `<tr><td colspan="6">${escapar(e.message)}</td></tr>`;
    }
  }

  // ---------------------------------------------------------- DETALHE
  let jornadaAberta = null;
  let campoCorrigir = null;

  async function abrirDetalhe(id) {
    mensagem(el('ponto-detalhe-msg'), '');
    el('ponto-corrigir').hidden = true;
    el('ponto-detalhe-titulo').textContent = 'Carregando...';
    el('ponto-detalhe-sub').textContent = '';
    el('ponto-detalhe-info').innerHTML = '';
    el('ponto-detalhe-eventos').innerHTML = '';
    el('ponto-detalhe-acoes').innerHTML = '';
    abrir('ponto-detalhe');
    try {
      const j = (await chamar('GET', '/jornada/' + id)).dados;
      jornadaAberta = j;
      el('ponto-detalhe-titulo').textContent = j.usuario_nome || ('#' + j.usuario_id);
      el('ponto-detalhe-sub').textContent = data(j.iniciado_em).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const item = (r, v) => (v ? `<div><dt>${r}</dt><dd>${v}</dd></div>` : '');
      el('ponto-detalhe-info').innerHTML =
        item('Situação', selo(j.status)) +
        item('Entrada', dataHora(j.iniciado_em)) +
        item('Saída', j.finalizado_em ? dataHora(j.finalizado_em) : 'Em aberto') +
        item('Intervalos', (j.pausas || []).map((p) => hora(p.inicio) + ' às ' + hora(p.fim)).join(', ') || 'Nenhum') +
        item('Trabalhado', '<strong>' + duracao(j.trabalhado_minutos) + '</strong>') +
        item('Contrato', escapar(j.contrato_nome || '')) +
        item('Origem', j.origem === 'Admin' ? 'Lançada pela gestão' : (j.origem === 'Sistema' ? 'Sistema' : 'Registrada pelo funcionário')) +
        item('Observação', escapar(j.observacao || ''));
      el('ponto-detalhe-eventos').innerHTML = (j.eventos || []).map((ev) => `
        <li class="ev-${ev.tipo_evento}">
          <span class="ponto-ev-hora">${dataHora(ev.ocorrido_em)}</span>
          <span class="ponto-ev-tipo">${TIPOS_EVENTO[ev.tipo_evento] || ev.tipo_evento}</span>
          ${ev.tipo_evento === 'correcao' ? `<small>${escapar(ev.valor_anterior ? 'de ' + dataHora(ev.valor_anterior) + ' para ' : 'para ')}${escapar(dataHora(ev.valor_novo))}</small>` : ''}
          ${ev.motivo ? `<small>Motivo: ${escapar(ev.motivo)}</small>` : ''}
          ${ev.usuario_nome ? `<small>por ${escapar(ev.usuario_nome)}</small>` : ''}
        </li>`).join('') || '<li>Sem eventos.</li>';
      const botoes = [];
      if (j.status !== 'cancelada') {
        botoes.push('<button type="button" class="jor-btn jor-btn-secundario" data-corrigir="iniciado_em">Corrigir entrada</button>');
        if (j.finalizado_em) botoes.push('<button type="button" class="jor-btn jor-btn-secundario" data-corrigir="finalizado_em">Corrigir saída</button>');
      }
      if (j.status === 'aberta' || j.status === 'pausada') {
        botoes.push('<button type="button" class="jor-btn jor-btn-principal" data-acao-jornada="encerrar">Registrar saída agora</button>');
        botoes.push('<button type="button" class="jor-btn jor-btn-perigo" data-acao-jornada="cancelar">Cancelar jornada</button>');
      }
      el('ponto-detalhe-acoes').innerHTML = botoes.join('');
    } catch (e) {
      el('ponto-detalhe-titulo').textContent = 'Jornada';
      mensagem(el('ponto-detalhe-msg'), e.message, 'erro');
    }
  }

  async function recarregarTudo() {
    const aberta = document.querySelector('#ponto-subabas .ativo');
    const qual = aberta ? aberta.dataset.ponto : 'folha';
    if (qual === 'folha') await carregarFolha();
    if (qual === 'agora') await carregarAgora();
    if (qual === 'historico') await buscarHistorico();
  }

  function ligarDetalhe() {
    el('ponto-detalhe-acoes').addEventListener('click', async (e) => {
      const corr = e.target.closest('[data-corrigir]');
      if (corr) {
        campoCorrigir = corr.dataset.corrigir;
        el('ponto-corrigir-rotulo').textContent = campoCorrigir === 'iniciado_em' ? 'Novo horário de entrada' : 'Novo horário de saída';
        el('ponto-corrigir-valor').value = paraInput(jornadaAberta[campoCorrigir]);
        el('ponto-corrigir-motivo').value = '';
        el('ponto-corrigir').hidden = false;
        el('ponto-corrigir-valor').focus();
        return;
      }
      const acao = e.target.closest('[data-acao-jornada]');
      if (!acao || !jornadaAberta) return;
      try {
        if (acao.dataset.acaoJornada === 'encerrar') {
          if (!confirm('Registrar a saída desta jornada agora?')) return;
          await chamar('POST', `/jornada/${jornadaAberta.id}/encerrar-administrativo`, {});
        } else {
          const motivo = prompt('Motivo do cancelamento:');
          if (!motivo) return;
          await chamar('POST', `/jornada/${jornadaAberta.id}/cancelar`, { motivo });
        }
        await abrirDetalhe(jornadaAberta.id);
        mensagem(el('ponto-detalhe-msg'), 'Feito.', 'sucesso');
        recarregarTudo();
      } catch (err) { mensagem(el('ponto-detalhe-msg'), err.message, 'erro'); }
    });
    el('ponto-corrigir-cancelar').addEventListener('click', () => { el('ponto-corrigir').hidden = true; });
    el('ponto-corrigir').addEventListener('submit', async (e) => {
      e.preventDefault();
      const valor = el('ponto-corrigir-valor').value.replace('T', ' ') + ':00';
      try {
        await chamar('POST', `/jornada/${jornadaAberta.id}/corrigir`, {
          campo: campoCorrigir, valor, motivo: el('ponto-corrigir-motivo').value.trim(),
        });
        await abrirDetalhe(jornadaAberta.id);
        mensagem(el('ponto-detalhe-msg'), 'Horário corrigido.', 'sucesso');
        recarregarTudo();
      } catch (err) { mensagem(el('ponto-detalhe-msg'), err.message, 'erro'); }
    });
  }

  // ---------------------------------------------------------- LANÇAR
  function abrirLancamento() {
    el('ponto-form-lancar').reset();
    mensagem(el('ponto-lancar-msg'), '');
    el('lancar-pessoa').value = el('ponto-pessoa').value || '';
    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
    el('lancar-data').value = isoLocal(ontem);
    el('lancar-data').max = isoLocal(new Date());
    abrir('ponto-lancamento');
  }

  function ligarLancamento() {
    el('ponto-lancar').addEventListener('click', abrirLancamento);
    el('ponto-form-lancar').addEventListener('submit', async (e) => {
      e.preventDefault();
      const dia = el('lancar-data').value;
      const proximo = (hhmm) => {
        const d = new Date(dia + 'T12:00'); d.setDate(d.getDate() + 1);
        return isoLocal(d) + ' ' + hhmm;
      };
      const entrada = el('lancar-entrada').value;
      const saida = el('lancar-saida').value;
      const noturno = saida <= entrada;
      const ajustar = (hhmm) => (!hhmm ? null : (noturno && hhmm < entrada ? proximo(hhmm) : dia + ' ' + hhmm));
      try {
        await chamar('POST', '/jornada/lancar', {
          usuario_id: Number(el('lancar-pessoa').value),
          inicio: dia + ' ' + entrada,
          fim: noturno ? proximo(saida) : dia + ' ' + saida,
          pausa_inicio: ajustar(el('lancar-int-ini').value),
          pausa_fim: ajustar(el('lancar-int-fim').value),
          motivo: el('lancar-motivo').value.trim(),
        });
        fechar('ponto-lancamento');
        if (el('ponto-pessoa').value !== el('lancar-pessoa').value) el('ponto-pessoa').value = el('lancar-pessoa').value;
        el('ponto-mes').value = dia.slice(0, 7);
        mostrarSecao('folha');
        carregarFolha();
      } catch (err) { mensagem(el('ponto-lancar-msg'), err.message, 'erro'); }
    });
  }

  // ---------------------------------------------------------- ESCALAS
  // Lista de funcionários à esquerda; à direita, o tipo de escala, os dias,
  // o horário previsto e a prévia das próximas 4 semanas.
  const DIAS_LONGOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const DESCR_TIPOS = {
    '': 'Não definida', '5x2': 'Segunda a sexta', '6x1': 'Segunda a sábado', semanal: 'Escolher os dias',
    '12x36': 'Trabalha 1, folga 1', '24x48': 'Trabalha 1, folga 2', '24x72': 'Trabalha 1, folga 3',
  };
  const esc = { lista: [], tipos: [], feriados: {}, atual: null, tipo: '', dias: [] };

  async function carregarEscalas() {
    try {
      const r = await chamar('GET', '/jornada/escalas');
      esc.lista = r.dados || [];
      esc.tipos = r.tipos || [];
      esc.feriados = {};
      (r.feriados || []).forEach((f) => { esc.feriados[f.data] = f; });
    } catch (e) {
      el('escala-lista').innerHTML = `<li class="escala-vazio">${escapar(e.message)}</li>`;
      return;
    }
    desenharListaEscalas();
    if (esc.atual) {
      const novo = esc.lista.find((f) => f.id === esc.atual.id);
      if (novo) selecionarFuncionario(novo.id);
    }
  }

  function desenharListaEscalas() {
    const termo = el('escala-busca').value.trim().toLowerCase();
    const itens = esc.lista.filter((f) => !termo || f.nome.toLowerCase().includes(termo));
    el('escala-lista').innerHTML = itens.map((f) => `
      <li><button type="button" class="escala-item${esc.atual && esc.atual.id === f.id ? ' ativo' : ''}" data-func="${f.id}">
        <span class="escala-item-nome">${escapar(f.nome)}</span>
        <span class="escala-item-info">${escapar(f.funcao || '')}${f.tem_login ? '' : (f.funcao ? ' · ' : '') + 'sem login'}</span>
        <span class="escala-chip${f.escala ? '' : ' vazio'}">${f.escala ? escapar(f.escala.rotulo) : 'Sem escala'}</span>
      </button></li>`).join('') || '<li class="escala-vazio">Nenhum funcionário.</li>';
  }

  function selecionarFuncionario(id) {
    const f = esc.lista.find((x) => String(x.id) === String(id));
    if (!f) return;
    esc.atual = f;
    const e = f.escala || {};
    esc.tipo = e.tipo || '';
    esc.dias = Array.isArray(e.dias) ? e.dias.slice() : [1, 2, 3, 4, 5];
    el('escala-nome').textContent = f.nome;
    el('escala-funcao').textContent = (f.funcao || '') + (f.tem_login ? '' : (f.funcao ? ' · ' : '') + 'sem login no sistema (não registra ponto)');
    el('escala-ref').value = e.inicio || '';
    el('escala-entrada').value = e.entrada || '';
    el('escala-saida').value = e.saida || '';
    mensagem(el('escala-msg'), '');
    el('escala-editor-vazio').hidden = true;
    el('escala-editor-corpo').hidden = false;
    desenharListaEscalas();
    desenharEditor();
  }

  function cicloDo(tipo) {
    const t = esc.tipos.find((x) => x.tipo === tipo);
    return t ? t.ciclo : null;
  }

  function diasDoTipo(tipo) {
    if (tipo === '5x2') return [1, 2, 3, 4, 5];
    if (tipo === '6x1') return [1, 2, 3, 4, 5, 6];
    if (tipo === 'semanal') return esc.dias;
    return null;
  }

  function trabalhaNoDia(d) {
    if (!esc.tipo) return false;
    const dias = diasDoTipo(esc.tipo);
    if (dias) return dias.includes(d.getDay());
    const ciclo = cicloDo(esc.tipo);
    const ref = el('escala-ref').value;
    if (!ciclo || !ref) return false;
    const [a, m, dd] = ref.split('-').map(Number);
    const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(a, m - 1, dd)) / 86400000);
    return ((diff % ciclo) + ciclo) % ciclo === 0;
  }

  function desenharEditor() {
    const opcoes = [{ tipo: '', rotulo: 'Sem escala' }].concat(esc.tipos.map((t) => ({
      tipo: t.tipo, rotulo: t.tipo === 'semanal' ? 'Personalizada' : t.tipo,
    })));
    el('escala-tipos').innerHTML = opcoes.map((o) => `
      <button type="button" role="radio" aria-checked="${esc.tipo === o.tipo}" class="escala-tipo${esc.tipo === o.tipo ? ' ativo' : ''}" data-tipo="${o.tipo}">
        <strong>${escapar(o.rotulo)}</strong><small>${escapar(DESCR_TIPOS[o.tipo] || '')}</small>
      </button>`).join('');
    const semanal = esc.tipo === 'semanal';
    const ciclo = cicloDo(esc.tipo);
    el('escala-bloco-dias').hidden = !semanal;
    el('escala-bloco-ref').hidden = !ciclo;
    el('escala-bloco-horario').hidden = !esc.tipo;
    el('escala-dias').innerHTML = DIAS_LONGOS.map((n, i) => `
      <button type="button" class="escala-dia${esc.dias.includes(i) ? ' ativo' : ''}" data-dia="${i}" aria-pressed="${esc.dias.includes(i)}">${n}</button>`).join('');
    desenharPrevia();
  }

  function desenharPrevia() {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - hoje.getDay());
    let html = '';
    for (let i = 0; i < 28; i++) {
      const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      const chave = isoLocal(d);
      const fer = esc.feriados[chave];
      const classes = ['escala-previa-dia'];
      if (trabalhaNoDia(d)) classes.push('trabalho');
      if (fer) classes.push('feriado');
      if (chave === isoLocal(hoje)) classes.push('hoje');
      if (d < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) classes.push('passado');
      html += `<span class="${classes.join(' ')}" title="${fer ? escapar(fer.nome) : ''}">${d.getDate()}</span>`;
    }
    el('escala-previa').innerHTML = html;
  }

  function ligarEscalas() {
    el('escala-busca').addEventListener('input', desenharListaEscalas);
    el('escala-lista').addEventListener('click', (e) => {
      const b = e.target.closest('[data-func]');
      if (b) selecionarFuncionario(b.dataset.func);
    });
    el('escala-tipos').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tipo]');
      if (!b) return;
      esc.tipo = b.dataset.tipo;
      if (cicloDo(esc.tipo) && !el('escala-ref').value) el('escala-ref').value = isoLocal(new Date());
      desenharEditor();
    });
    el('escala-dias').addEventListener('click', (e) => {
      const b = e.target.closest('[data-dia]');
      if (!b) return;
      const n = Number(b.dataset.dia);
      esc.dias = esc.dias.includes(n) ? esc.dias.filter((x) => x !== n) : esc.dias.concat(n).sort();
      desenharEditor();
    });
    el('escala-ref').addEventListener('change', desenharPrevia);
    el('escala-editor').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!esc.atual) return;
      try {
        await chamar('PUT', '/jornada/escalas/' + esc.atual.id, {
          escala_tipo: esc.tipo,
          escala_dias: esc.dias,
          escala_inicio: el('escala-ref').value,
          escala_entrada: el('escala-entrada').value,
          escala_saida: el('escala-saida').value,
        });
        await carregarEscalas();
        mensagem(el('escala-msg'), 'Escala salva.', 'sucesso');
      } catch (err) { mensagem(el('escala-msg'), err.message, 'erro'); }
    });
  }

  // ---------------------------------------------------------- SUBABAS
  function mostrarSecao(qual) {
    document.querySelectorAll('#ponto-subabas .top-tab2').forEach((b) => b.classList.toggle('ativo', b.dataset.ponto === qual));
    ['folha', 'agora', 'historico', 'escalas'].forEach((s) => { el('ponto-sec-' + s).hidden = s !== qual; });
    if (qual === 'agora') carregarAgora();
    if (qual === 'historico') buscarHistorico();
    if (qual === 'escalas') carregarEscalas();
  }

  function ligarGeral() {
    el('ponto-subabas').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ponto]');
      if (b) mostrarSecao(b.dataset.ponto);
    });
    el('ponto-pessoa').addEventListener('change', carregarFolha);
    el('ponto-mes').addEventListener('change', carregarFolha);
    el('jor-btn-buscar').addEventListener('click', buscarHistorico);
    el('ponto-imprimir').addEventListener('click', () => {
      if (!ultimaFolha || !el('ponto-pessoa').value) { alert('Escolha um funcionário primeiro.'); return; }
      document.body.classList.add('imprimindo-ponto');
      window.print();
      setTimeout(() => document.body.classList.remove('imprimindo-ponto'), 500);
    });
    // Um clique (ou Enter) na linha abre a jornada.
    el('jornadas').addEventListener('click', (e) => {
      const linha = e.target.closest('[data-jornada]');
      if (linha) abrirDetalhe(linha.dataset.jornada);
    });
    el('jornadas').addEventListener('keydown', (e) => {
      const linha = e.target.closest('[data-jornada]');
      if (linha && e.key === 'Enter') abrirDetalhe(linha.dataset.jornada);
    });
    ['ponto-detalhe', 'ponto-lancamento'].forEach((id) => {
      el(id).addEventListener('click', (e) => {
        if (e.target === el(id) || e.target.closest('[data-fechar]')) fechar(id);
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      fechar('ponto-detalhe');
      fechar('ponto-lancamento');
    });
    const hoje = new Date();
    el('ponto-mes').value = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
  }

  function inicializar() {
    if (!localStorage.getItem('token') || !el('jornadas')) return;
    const iniciar = (info) => {
      const matriz = info && info.modulos && info.modulos.permissoes;
      if (matriz && !(matriz.jornada_admin || {}).ver) return;
      ligarGeral();
      ligarDetalhe();
      ligarLancamento();
      ligarEscalas();
      let carregado = false;
      const carregar = () => {
        if (carregado) return;
        carregado = true;
        carregarPessoas();
      };
      if (el('jornadas').classList.contains('active')) carregar();
      new MutationObserver(() => { if (el('jornadas').classList.contains('active')) carregar(); })
        .observe(el('jornadas'), { attributes: true, attributeFilter: ['class'] });
    };
    if (typeof window.obterModulos === 'function') window.obterModulos().then(iniciar, () => iniciar(null));
    else iniciar(null);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializar);
  else inicializar();
})();
