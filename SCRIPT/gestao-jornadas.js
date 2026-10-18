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
    const negativo = min < 0;
    const abs = Math.abs(min);
    const h = Math.floor(abs / 60);
    const m = Math.round(abs % 60);
    return (negativo ? '-' : '') + h + 'h' + String(m).padStart(2, '0');
  }
  const saldoTexto = (min) => (min === null || min === undefined ? '' : (min > 0 ? '+' : '') + duracao(min));
  const ROTULOS_AJUSTE = {
    trabalho: 'Ajuste', folga: 'Folga', folga_banco: 'Folga (banco)', extra_banco: 'Banco de horas',
    justificado: 'Justificado', ferias: 'Férias',
  };
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
      corpo.innerHTML = '<tr><td colspan="8">Escolha um funcionário.</td></tr>';
      el('ponto-kpis').innerHTML = '';
      el('ponto-folha-cab').innerHTML = '';
      return;
    }
    corpo.innerHTML = '<tr><td colspan="8">Carregando...</td></tr>';
    const { inicio, fim } = periodoDoMes();
    try {
      const r = await chamar('GET', `/jornada/folha?usuario_id=${pessoa}&inicio=${inicio}&fim=${fim}`);
      ultimaFolha = r;
      desenharFolha(r);
    } catch (e) {
      corpo.innerHTML = `<tr><td colspan="8">${escapar(e.message)}</td></tr>`;
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
      (t.tem_previsto ? kpi('Horas previstas', duracao(t.previsto_minutos)) : '') +
      (t.tem_previsto ? kpi('Saldo (banco de horas)', saldoTexto(t.saldo_minutos) || '0h00',
        t.saldo_minutos < 0 ? 'alerta' : (t.saldo_minutos > 0 ? 'positivo' : '')) : '') +
      kpi('Dias trabalhados', t.dias_trabalhados || 0) +
      (r.escala ? kpi('Dias na escala', t.dias_escala || 0) : '') +
      (r.escala ? kpi('Faltas', t.faltas || 0, t.faltas ? 'alerta' : '') : '') +
      (t.justificados ? kpi('Justificados', t.justificados) : '') +
      kpi('Intervalos', duracao(t.pausa_minutos));

    const linhas = [];
    (r.dados || []).forEach((dia) => {
      const d = new Date(dia.data + 'T12:00');
      const rotuloData = `<span class="ponto-dia">${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}</span> <small>${DIAS[d.getDay()]}</small>`;
      const classeDia = 'ponto-' + dia.situacao + (d.getDay() === 0 || d.getDay() === 6 ? ' ponto-fds' : '') +
        (dia.excecao ? ' ponto-aj-' + dia.excecao.tipo : '');
      const ajuste = dia.excecao ? `<span class="ponto-tag ponto-tag-${dia.excecao.tipo}" title="${escapar(dia.excecao.observacao || '')}">${ROTULOS_AJUSTE[dia.excecao.tipo] || 'Ajuste'}</span>` +
        (dia.excecao.tipo === 'justificado' && dia.excecao.observacao ? ` <small>${escapar(dia.excecao.observacao)}</small>` : '') : '';
      const situacaoDia = ({
        feriado: 'Feriado' + (dia.feriado ? ': ' + escapar(dia.feriado.nome) : ''),
        falta: 'Falta', folga: dia.excecao ? '' : 'Folga', previsto: 'Previsto', trabalhado: '',
      }[dia.situacao] || '') + (dia.feriado && dia.situacao !== 'feriado' ? ' Feriado' : '');
      const previstoTxt = dia.previsto_minutos ? duracao(dia.previsto_minutos) +
        (dia.entrada_prevista ? `<small> ${dia.entrada_prevista}–${dia.saida_prevista}</small>` : '') : '';
      const saldoTxt = dia.saldo_minutos ? `<span class="ponto-saldo ${dia.saldo_minutos < 0 ? 'neg' : 'pos'}">${saldoTexto(dia.saldo_minutos)}</span>` : '';
      if (!dia.jornadas.length) {
        linhas.push(`<tr class="${classeDia}"><td>${rotuloData}</td><td></td><td></td><td></td>` +
          `<td>${previstoTxt}</td><td></td><td>${saldoTxt}</td>` +
          `<td><span class="ponto-situacao">${situacaoDia}</span> ${ajuste}</td></tr>`);
        return;
      }
      dia.jornadas.forEach((j, i) => {
        const intervalo = (j.pausas || []).map((p) => hora(p.inicio) + ' às ' + hora(p.fim)).join('<br>');
        const saida = j.finalizado_em ? hora(j.finalizado_em) + (data(j.finalizado_em).getDate() !== d.getDate() ? ' <small>(+1)</small>' : '') : '';
        const lancada = j.origem === 'Admin' ? ' <span class="ponto-tag" title="Lançada ou ajustada pela gestão">ajuste</span>' : '';
        const ultima = i === dia.jornadas.length - 1;
        linhas.push(`<tr class="${classeDia} ponto-clicavel" data-jornada="${j.id}" tabindex="0">` +
          `<td>${i === 0 ? rotuloData : ''}</td><td>${hora(j.iniciado_em)}</td><td>${intervalo || '-'}</td>` +
          `<td>${saida || '-'}</td><td>${i === 0 ? previstoTxt : ''}</td><td><strong>${duracao(j.trabalhado_minutos)}</strong></td>` +
          `<td>${ultima ? saldoTxt : ''}</td>` +
          `<td>${j.status === 'encerrada' ? '' : selo(j.status)}${dia.feriado ? ' <span class="ponto-situacao">Feriado</span>' : ''}${lancada} ${i === 0 ? ajuste : ''}</td></tr>`);
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
  // o horário padrão (com horário diferente por dia da semana) e o
  // calendário do mês, onde um clique num dia cria um ajuste só daquela data.
  const DIAS_LONGOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const DIAS_EXTENSO = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const DESCR_TIPOS = {
    '': 'Não definida', '5x2': 'Segunda a sexta', '6x1': 'Segunda a sábado', semanal: 'Escolher os dias',
    '12x36': 'Trabalha 1, folga 1', '24x48': 'Trabalha 1, folga 2', '24x72': 'Trabalha 1, folga 3',
  };
  const OPCOES_DIA = [
    { tipo: '', rotulo: 'Seguir a escala', descr: 'Sem ajuste neste dia' },
    { tipo: 'trabalho', rotulo: 'Trabalho', descr: 'Dia extra, outro horário ou feriado trabalhado' },
    { tipo: 'folga', rotulo: 'Folga', descr: 'Não trabalha neste dia' },
    { tipo: 'folga_banco', rotulo: 'Folga com banco de horas', descr: 'Desconta as horas do dia do banco' },
    { tipo: 'extra_banco', rotulo: 'Trabalho para banco de horas', descr: 'As horas trabalhadas viram crédito' },
    { tipo: 'justificado', rotulo: 'Justificado', descr: 'Atestado, declaração, licença: dia abonado' },
  ];
  const esc = {
    lista: [], tipos: [], motivos: [], feriados: {}, excecoes: {}, atual: null, tipo: '', dias: [], horarios: {},
    ano: 0, mes: 0, diaAberto: null, tipoDia: '',
  };

  async function carregarEscalas() {
    try {
      const r = await chamar('GET', '/jornada/escalas');
      esc.lista = r.dados || [];
      esc.tipos = r.tipos || [];
      esc.motivos = r.motivos_justificativa || [];
      esc.feriados = {};
      (r.feriados || []).forEach((f) => { esc.feriados[f.data] = f; });
    } catch (e) {
      el('escala-lista').innerHTML = `<li class="escala-vazio">${escapar(e.message)}</li>`;
      return;
    }
    desenharListaEscalas();
    if (esc.atual) {
      const novo = esc.lista.find((f) => f.id === esc.atual.id);
      if (novo) selecionarFuncionario(novo.id, true);
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

  async function carregarExcecoes() {
    if (!esc.atual) return;
    try {
      esc.excecoes = (await chamar('GET', `/jornada/escalas/${esc.atual.id}/excecoes`)).dados || {};
    } catch (e) { esc.excecoes = {}; }
    desenharCalendarioEscala();
  }

  function selecionarFuncionario(id, manterMes) {
    const f = esc.lista.find((x) => String(x.id) === String(id));
    if (!f) return;
    const trocou = !esc.atual || esc.atual.id !== f.id;
    esc.atual = f;
    const e = f.escala || {};
    esc.tipo = e.tipo || '';
    esc.dias = Array.isArray(e.dias) && e.tipo === 'semanal' ? e.dias.slice() : [1, 2, 3, 4, 5];
    esc.horarios = JSON.parse(JSON.stringify(e.horarios || {}));
    el('escala-nome').textContent = f.nome;
    el('escala-funcao').textContent = (f.funcao || '') + (f.tem_login ? '' : (f.funcao ? ' · ' : '') + 'sem login no sistema (não registra ponto)');
    el('escala-ref').value = e.inicio || '';
    el('escala-entrada').value = e.entrada || '';
    el('escala-saida').value = e.saida || '';
    el('escala-intervalo').value = e.intervalo === null || e.intervalo === undefined ? '' : e.intervalo;
    mensagem(el('escala-msg'), '');
    el('escala-editor-vazio').hidden = true;
    el('escala-editor-corpo').hidden = false;
    if (trocou || !manterMes) {
      const hoje = new Date();
      esc.ano = hoje.getFullYear(); esc.mes = hoje.getMonth();
      fecharDia();
      esc.excecoes = {};
    }
    desenharListaEscalas();
    desenharEditor();
    if (trocou || !manterMes) carregarExcecoes();
  }

  const cicloDo = (tipo) => { const t = esc.tipos.find((x) => x.tipo === tipo); return t ? t.ciclo : null; };

  function diasDoTipo(tipo) {
    if (tipo === '5x2') return [1, 2, 3, 4, 5];
    if (tipo === '6x1') return [1, 2, 3, 4, 5, 6];
    if (tipo === 'semanal') return esc.dias;
    return null;
  }

  function trabalhaPadrao(d) {
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

  function horarioPadrao(d) {
    const h = !cicloDo(esc.tipo) && esc.horarios[String(d.getDay())];
    if (h) return { entrada: h.entrada, saida: h.saida };
    return { entrada: el('escala-entrada').value, saida: el('escala-saida').value };
  }

  // Mesmo raciocínio de services/escalas.py: padrão, feriado e ajuste do dia.
  function planoDoDia(d) {
    const chave = isoLocal(d);
    const fer = esc.feriados[chave];
    const exc = esc.excecoes[chave];
    const base = trabalhaPadrao(d);
    const h = horarioPadrao(d);
    let trabalha = base && !fer;
    let entrada = h.entrada;
    let saida = h.saida;
    if (exc) {
      trabalha = exc.tipo === 'trabalho' || exc.tipo === 'extra_banco';
      if (trabalha) { entrada = exc.entrada || entrada; saida = exc.saida || saida; }
    }
    return { chave, fer, exc, base, trabalha, entrada, saida };
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
    desenharHorariosPorDia();
    desenharCalendarioEscala();
  }

  function desenharHorariosPorDia() {
    const dias = diasDoTipo(esc.tipo);
    const mostra = !!dias && !!el('escala-entrada').value && !!el('escala-saida').value;
    el('escala-bloco-por-dia').hidden = !mostra;
    if (!mostra) return;
    const ordem = [1, 2, 3, 4, 5, 6, 0].filter((d) => dias.includes(d));
    el('escala-por-dia').innerHTML = ordem.map((d) => {
      const h = esc.horarios[String(d)] || {};
      const diferente = !!esc.horarios[String(d)];
      return `<div class="escala-por-dia-linha${diferente ? ' diferente' : ''}" data-dia-semana="${d}">
        <span>${DIAS_EXTENSO[d]}</span>
        <input type="time" data-campo="entrada" value="${h.entrada || el('escala-entrada').value}" aria-label="Entrada de ${DIAS_EXTENSO[d]}">
        <input type="time" data-campo="saida" value="${h.saida || el('escala-saida').value}" aria-label="Saída de ${DIAS_EXTENSO[d]}">
        ${diferente ? '<button type="button" class="escala-por-dia-limpar" title="Voltar ao horário padrão">padrão</button>' : ''}
      </div>`;
    }).join('');
  }

  function desenharCalendarioEscala() {
    if (!esc.atual) return;
    const { ano, mes } = esc;
    el('escala-mes').textContent = new Date(ano, mes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const hoje = new Date();
    const hojeIso = isoLocal(hoje);
    const primeiro = new Date(ano, mes, 1);
    const total = new Date(ano, mes + 1, 0).getDate();
    let html = '';
    for (let i = 0; i < primeiro.getDay(); i++) html += '<span class="escala-previa-dia fora"></span>';
    for (let n = 1; n <= total; n++) {
      const d = new Date(ano, mes, n);
      const p = planoDoDia(d);
      const classes = ['escala-previa-dia', 'clicavel'];
      if (p.trabalha) classes.push('trabalho');
      if (p.fer) classes.push('feriado');
      if (p.exc) classes.push('aj-' + p.exc.tipo);
      if (p.exc && p.exc.tipo === 'trabalho') classes.push('ajuste');
      if (p.chave === hojeIso) classes.push('hoje');
      if (p.chave === esc.diaAberto) classes.push('selecionado');
      if (d < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) classes.push('passado');
      const dica = [p.fer ? p.fer.nome : '', p.exc ? p.exc.rotulo : '',
        p.trabalha && p.entrada && p.saida ? p.entrada + ' às ' + p.saida : ''].filter(Boolean).join(' · ');
      const hora = p.trabalha && p.saida ? `<small>${p.saida}</small>` : '';
      html += `<button type="button" class="${classes.join(' ')}" data-dia-cal="${p.chave}" title="${escapar(dica)}">${n}${hora}</button>`;
    }
    el('escala-previa').innerHTML = html;
  }

  function mudarMesEscala(passo) {
    const alvo = esc.ano * 12 + esc.mes + passo;
    esc.ano = Math.floor(alvo / 12); esc.mes = alvo % 12;
    fecharDia();
    desenharCalendarioEscala();
  }

  // ---- painel do dia
  function abrirDia(chave) {
    esc.diaAberto = chave;
    const [a, m, n] = chave.split('-').map(Number);
    const d = new Date(a, m - 1, n);
    const p = planoDoDia(d);
    const h = horarioPadrao(d);
    const pela = p.fer && p.base ? 'Feriado: ' + p.fer.nome + ' (não trabalha)'
      : p.base ? 'Pela escala: trabalho' + (h.entrada && h.saida ? ', ' + h.entrada + ' às ' + h.saida : '')
        : 'Pela escala: folga' + (p.fer ? ' · Feriado: ' + p.fer.nome : '');
    el('escala-dia-titulo').textContent = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    el('escala-dia-sub').textContent = pela;
    esc.tipoDia = p.exc ? p.exc.tipo : '';
    el('escala-dia-entrada').value = (p.exc && p.exc.entrada) || h.entrada || '';
    el('escala-dia-saida').value = (p.exc && p.exc.saida) || h.saida || '';
    const obs = (p.exc && p.exc.observacao) || '';
    const motivo = esc.motivos.find((m) => obs === m || obs.startsWith(m + ' · '));
    el('escala-dia-motivo').innerHTML = esc.motivos.map((m) => `<option>${escapar(m)}</option>`).join('');
    el('escala-dia-motivo').value = motivo || esc.motivos[0] || '';
    el('escala-dia-obs').value = motivo ? obs.slice(motivo.length).replace(/^ · /, '') : obs;
    mensagem(el('escala-dia-msg'), '');
    desenharOpcoesDia();
    el('escala-dia-painel').hidden = false;
    desenharCalendarioEscala();
    el('escala-dia-painel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function fecharDia() {
    esc.diaAberto = null;
    el('escala-dia-painel').hidden = true;
  }

  function desenharOpcoesDia() {
    el('escala-dia-opcoes').innerHTML = OPCOES_DIA.map((o) => `
      <button type="button" role="radio" aria-checked="${esc.tipoDia === o.tipo}" class="escala-tipo escala-op-dia${esc.tipoDia === o.tipo ? ' ativo' : ''}" data-tipo-dia="${o.tipo}">
        <strong>${o.rotulo}</strong><small>${o.descr}</small>
      </button>`).join('');
    el('escala-dia-horas').hidden = !(esc.tipoDia === 'trabalho' || esc.tipoDia === 'extra_banco');
    el('escala-dia-bloco-motivo').hidden = esc.tipoDia !== 'justificado';
  }

  async function salvarDia() {
    if (!esc.atual || !esc.diaAberto) return;
    const url = `/jornada/escalas/${esc.atual.id}/excecoes/${esc.diaAberto}`;
    try {
      if (!esc.tipoDia) {
        await chamar('DELETE', url);
      } else {
        const comHora = esc.tipoDia === 'trabalho' || esc.tipoDia === 'extra_banco';
        await chamar('PUT', url, {
          tipo: esc.tipoDia,
          entrada: comHora ? el('escala-dia-entrada').value : null,
          saida: comHora ? el('escala-dia-saida').value : null,
          observacao: esc.tipoDia === 'justificado'
            ? [el('escala-dia-motivo').value, el('escala-dia-obs').value.trim()].filter(Boolean).join(' · ')
            : el('escala-dia-obs').value.trim(),
        });
      }
      await carregarExcecoes();
      mensagem(el('escala-dia-msg'), esc.tipoDia ? 'Dia ajustado.' : 'Dia volta a seguir a escala.', 'sucesso');
      if (ultimaFolha && el('ponto-pessoa').value) carregarFolha();
    } catch (err) { mensagem(el('escala-dia-msg'), err.message, 'erro'); }
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
    ['escala-entrada', 'escala-saida'].forEach((id) => el(id).addEventListener('change', () => {
      desenharHorariosPorDia();
      desenharCalendarioEscala();
    }));
    el('escala-ref').addEventListener('change', desenharCalendarioEscala);
    el('escala-por-dia').addEventListener('change', (e) => {
      const linha = e.target.closest('[data-dia-semana]');
      if (!linha) return;
      const d = linha.dataset.diaSemana;
      const ent = linha.querySelector('[data-campo="entrada"]').value;
      const sai = linha.querySelector('[data-campo="saida"]').value;
      if (ent === el('escala-entrada').value && sai === el('escala-saida').value) delete esc.horarios[d];
      else esc.horarios[d] = { entrada: ent, saida: sai };
      desenharHorariosPorDia();
      desenharCalendarioEscala();
    });
    el('escala-por-dia').addEventListener('click', (e) => {
      const b = e.target.closest('.escala-por-dia-limpar');
      if (!b) return;
      delete esc.horarios[b.closest('[data-dia-semana]').dataset.diaSemana];
      desenharHorariosPorDia();
      desenharCalendarioEscala();
    });
    el('escala-mes-ant').addEventListener('click', () => mudarMesEscala(-1));
    el('escala-mes-prox').addEventListener('click', () => mudarMesEscala(1));
    el('escala-previa').addEventListener('click', (e) => {
      const b = e.target.closest('[data-dia-cal]');
      if (b) abrirDia(b.dataset.diaCal);
    });
    el('escala-dia-opcoes').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tipo-dia]');
      if (!b) return;
      esc.tipoDia = b.dataset.tipoDia;
      desenharOpcoesDia();
    });
    el('escala-dia-fechar').addEventListener('click', () => { fecharDia(); desenharCalendarioEscala(); });
    el('escala-dia-salvar').addEventListener('click', salvarDia);
    el('escala-editor').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!esc.atual) return;
      const dias = diasDoTipo(esc.tipo) || [];
      const horarios = {};
      Object.keys(esc.horarios).forEach((k) => { if (dias.includes(Number(k))) horarios[k] = esc.horarios[k]; });
      try {
        await chamar('PUT', '/jornada/escalas/' + esc.atual.id, {
          escala_tipo: esc.tipo,
          escala_dias: esc.dias,
          escala_inicio: el('escala-ref').value,
          escala_entrada: el('escala-entrada').value,
          escala_saida: el('escala-saida').value,
          escala_intervalo: el('escala-intervalo').value,
          escala_horarios: horarios,
        });
        await carregarEscalas();
        mensagem(el('escala-msg'), 'Escala salva.', 'sucesso');
      } catch (err) { mensagem(el('escala-msg'), err.message, 'erro'); }
    });
  }

  // ---------------------------------------------------------- SUBABAS
  function mostrarSecao(qual) {
    document.querySelectorAll('#ponto-subabas .top-tab2').forEach((b) => b.classList.toggle('ativo', b.dataset.ponto === qual));
    ['folha', 'agora', 'historico', 'escalas', 'ferias'].forEach((s) => { el('ponto-sec-' + s).hidden = s !== qual; });
    // Férias: a tabela é de gestao-funcionarios.js, que escuta este aviso.
    if (qual === 'ferias') document.dispatchEvent(new CustomEvent('ponto:ferias'));
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
        carregarAgora();
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
