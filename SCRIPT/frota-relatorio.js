//======================================================================================================
// FROTA - aba Relatórios
// Indicadores, evolução, rankings e resumo por veículo a partir do que a
// Frota já registra (veículos, manutenções, abastecimentos, checklists,
// alertas e uso nas O.S.). Os números vêm prontos de GET /frota/relatorio;
// aqui só se desenha, com os mesmos gráficos da página de Relatórios.
//======================================================================================================
(function () {
  'use strict';

  const api = window.RelatoriosApi;
  const graficos = window.RelatoriosGraficos;
  if (!api || !graficos) return;

  const el = (id) => document.getElementById(id);
  const estado = { periodo: '30d', inicio: '', fim: '', placa: '', contrato: '', tipo: '' };
  let ultimo = null;
  let carregado = false;

  const moeda = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const numero = (v) => api.numero(v || 0);

  const ICONES = {
    veiculo: '<path d="M3 13l2-5h11l3 5"/><path d="M2 13h19v4H2z"/><circle cx="7" cy="18" r="1.8"/><circle cx="16" cy="18" r="1.8"/>',
    chave: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    moeda: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v12"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    rota: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a4 4 0 0 0 0-8H10a4 4 0 0 1 0-8h6"/>',
    os: '<path d="M7 3h8l4 4v14H7z"/><path d="M10 12h6M10 16h6"/>',
    bomba: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M3 21h12M14 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V8l-3-3"/>',
    lista: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    alerta: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.7 18a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
  };

  function cartao(rotulo, valor, icone, detalhe) {
    return '<div class="painel-card rel-kpi">'
      + '<span class="painel-card-icone rel-kpi-icone"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + ICONES[icone] + '</svg></span>'
      + '<span class="painel-card-label">' + api.escaparHtml(rotulo) + '</span>'
      + '<strong class="painel-card-valor">' + valor + '</strong>'
      + (detalhe ? '<small class="rel-kpi-detalhe">' + api.escaparHtml(detalhe) + '</small>' : '')
      + '</div>';
  }

  function parametros() {
    const p = {};
    if (estado.periodo === 'custom') {
      p.inicio = estado.inicio;
      p.fim = estado.fim;
    } else {
      p.periodo = estado.periodo;
    }
    ['placa', 'contrato', 'tipo'].forEach((c) => { if (estado[c]) p[c] = estado[c]; });
    return p;
  }

  function preencherSelect(id, itens, mapear) {
    const campo = el(id);
    if (!campo) return;
    const atual = campo.value;
    campo.innerHTML = '<option value="">Todos</option>' + itens.map((i) => {
      const par = mapear(i);
      return '<option value="' + api.escaparHtml(par.valor) + '">' + api.escaparHtml(par.texto) + '</option>';
    }).join('');
    campo.value = atual;
  }

  function rotuloPeriodo(chave, agrupamento) {
    if (agrupamento === 'mes') {
      const [ano, mes] = chave.split('-');
      return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(mes) - 1] + '/' + ano.slice(2);
    }
    return api.dataCurta(chave).slice(0, 5);
  }

  async function carregar() {
    if (estado.periodo === 'custom' && !(estado.inicio && estado.fim)) return;
    carregado = true;
    const alvos = ['frota-rel-evolucao', 'frota-rel-custo', 'frota-rel-km', 'frota-rel-tipos', 'frota-rel-oficinas'];
    el('frota-rel-kpis').innerHTML = window.htmlCarregandoLogo ? window.htmlCarregandoLogo('Calculando indicadores...') : 'Carregando...';
    alvos.forEach((id) => api.estadoCarregando(el(id)));

    let dados;
    try {
      dados = await api.buscar('/frota/relatorio', parametros(), 'frota-relatorio');
    } catch (erro) {
      if (erro.name === 'AbortError') return;
      el('frota-rel-kpis').innerHTML = '';
      alvos.forEach((id) => api.estadoErro(el(id), erro.message));
      el('frota-rel-tabela').querySelector('tbody').innerHTML = '<tr><td colspan="12">' + api.escaparHtml(erro.message) + '</td></tr>';
      return;
    }
    if (!dados) return;
    ultimo = dados;

    preencherSelect('frota-rel-placa', dados.filtros.placas, (v) => ({ valor: v.placa, texto: v.placa + ' · ' + v.modelo }));
    preencherSelect('frota-rel-contrato', dados.filtros.contratos, (c) => ({ valor: c, texto: c }));
    preencherSelect('frota-rel-tipo', dados.filtros.tipos, (t) => ({ valor: t, texto: t }));

    el('frota-rel-periodo').textContent = api.dataCurta(dados.periodo.inicio) + ' a ' + api.dataCurta(dados.periodo.fim);

    const r = dados.resumo || {};
    const compacto = (v) => (v >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : moeda(v));
    el('frota-rel-kpis').innerHTML = r.veiculos ? [
      cartao('Veículos', numero(r.veiculos), 'veiculo', `${r.ativos} ativos, ${r.em_manutencao} em manutenção`),
      cartao('Disponível', numero(r.disponibilidade) + '%', 'relogio', `${numero(r.dias_parado)} dia(s) parado(s)`),
      cartao('Manutenções', numero(r.manutencoes), 'chave'),
      cartao('Custo', compacto(r.custo_manutencao), 'moeda', moeda(r.custo_manutencao)),
    ].join('') : '<p class="frota-texto-suave">Nenhum veículo encontrado com esses filtros.</p>';
    el('frota-rel-kpis-uso').innerHTML = r.veiculos ? [
      cartao('O.S.', numero(r.os_atendidas), 'os'),
      cartao('Km em O.S.', numero(r.km_os), 'rota'),
      cartao('Abastec.', numero(r.abastecimentos), 'bomba'),
      cartao('Checklists', numero(r.checklists), 'lista'),
      cartao('Alertas', numero(r.alertas_vencidos), 'alerta', 'vencidos hoje'),
    ].join('') : '';

    el('frota-rel-agrupamento').textContent = dados.agrupamento === 'mes' ? 'Por mês' : 'Por dia';
    graficos.linhas(el('frota-rel-evolucao'),
      dados.evolucao.map((p) => Object.assign({ rotulo: rotuloPeriodo(p.periodo, dados.agrupamento) }, p)), [
        { campo: 'os', nome: 'O.S. atendidas', cor: graficos.CORES[0] },
        { campo: 'manutencoes', nome: 'Manutenções', cor: graficos.CORES[4] },
        { campo: 'abastecimentos', nome: 'Abastecimentos', cor: graficos.CORES[1] },
      ]);
    graficos.barras(el('frota-rel-custo'), dados.custo_por_veiculo.map((i) => Object.assign({}, i, { detalhe: i.detalhe + ' · ' + moeda(i.valor) })));
    graficos.barras(el('frota-rel-km'), dados.km_por_veiculo);
    graficos.rosca(el('frota-rel-tipos'), dados.por_tipo);
    graficos.barras(el('frota-rel-oficinas'), dados.por_oficina);

    const linhas = dados.veiculos || [];
    el('frota-rel-tabela').querySelector('tbody').innerHTML = linhas.length ? linhas.map((v) => `
      <tr>
        <td>${api.escaparHtml(v.placa)}</td>
        <td>${api.escaparHtml(v.modelo)}</td>
        <td>${api.escaparHtml(v.status)}</td>
        <td class="num">${v.km_atual != null ? numero(v.km_atual) : '-'}</td>
        <td class="num">${numero(v.os)}</td>
        <td class="num">${numero(v.km_os)}</td>
        <td class="num">${numero(v.manutencoes)}</td>
        <td class="num">${moeda(v.custo)}</td>
        <td class="num">${numero(v.dias_parado)}</td>
        <td class="num">${numero(v.abastecimentos)}</td>
        <td class="num">${numero(v.checklists)}</td>
        <td class="num ${v.alertas_vencidos ? 'alerta' : ''}">${numero(v.alertas_vencidos)}</td>
      </tr>`).join('') : '<tr><td colspan="12">Nenhum veículo encontrado.</td></tr>';
  }

  function baixarTabela() {
    if (!ultimo || !ultimo.veiculos) return;
    const cab = ['Placa', 'Veículo', 'Status', 'Km atual', 'O.S.', 'Km em O.S.', 'Manutenções', 'Custo', 'Dias parado', 'Abastecimentos', 'Checklists', 'Alertas vencidos', 'Contratos'];
    const linhas = ultimo.veiculos.map((v) => [v.placa, v.modelo, v.status, v.km_atual ?? '', v.os, v.km_os, v.manutencoes,
      String(v.custo).replace('.', ','), v.dias_parado, v.abastecimentos, v.checklists, v.alertas_vencidos, (v.contratos || []).join(' | ')]);
    const csv = [cab].concat(linhas).map((l) => l.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `relatorio-frota_${ultimo.periodo.inicio}_${ultimo.periodo.fim}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function iniciar() {
    const chips = el('frota-rel-periodos');
    if (!chips) return;
    chips.addEventListener('click', (e) => {
      const botao = e.target.closest('[data-periodo]');
      if (!botao) return;
      chips.querySelectorAll('.rel-chip').forEach((c) => c.classList.toggle('rel-chip-ativo', c === botao));
      estado.periodo = botao.dataset.periodo;
      document.querySelectorAll('#frota-rel-filtros [data-custom]').forEach((c) => { c.hidden = estado.periodo !== 'custom'; });
      carregar();
    });
    [['frota-rel-inicio', 'inicio'], ['frota-rel-fim', 'fim'], ['frota-rel-placa', 'placa'],
     ['frota-rel-contrato', 'contrato'], ['frota-rel-tipo', 'tipo']].forEach(([id, campo]) => {
      el(id).addEventListener('change', () => { estado[campo] = el(id).value; carregar(); });
    });
    el('frota-rel-limpar').addEventListener('click', () => {
      ['placa', 'contrato', 'tipo'].forEach((c) => { estado[c] = ''; el('frota-rel-' + c).value = ''; });
      carregar();
    });
    el('frota-rel-baixar').addEventListener('click', baixarTabela);

    // Só consulta quando a aba é aberta pela primeira vez.
    const aba = el('relatorios');
    const verificar = () => { if (!carregado && aba.classList.contains('active')) carregar(); };
    new MutationObserver(verificar).observe(aba, { attributes: true, attributeFilter: ['class'] });
    verificar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
