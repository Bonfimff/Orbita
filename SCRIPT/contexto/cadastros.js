//======================================================================================================
// CONTEXTO OPERACIONAL - provedor da pagina Cadastros (cadastros.html)
// Base de Atendimento, Região e Equipamento so tem contexto quando um
// registro especifico esta aberto no formulario lateral (evento disparado
// por SCRIPT/cadastros/formulario.js). Sem selecao, mostra so a explicacao
// minima - regra 12: nao preencher por preencher.
//======================================================================================================
(function () {
  'use strict';

  const CP = window.ContextPanel;
  const api = window.RelatoriosApi;
  if (!CP || !api) return;

  function numero(valor) {
    return api.numero(valor || 0);
  }

  const EXPLICACOES = {
    'analise-operacional': 'Estes catálogos definem o vocabulário usado para classificar os chamados.',
    ativos: 'Selecione um equipamento na lista para ver seu resumo operacional.',
    locais: null, // tratado por sub-aba (pontos/regioes)
  };

  async function contextoBase(id) {
    if (!id) {
      CP.render({ titulo: 'Contexto Operacional',
        blocos: [{ tipo: 'texto', texto: 'Selecione uma base de atendimento para ver seu resumo operacional.' }] });
      return;
    }
    CP.carregando('Contexto Operacional');
    try {
      const d = await CP.buscar('/contexto/base/' + id);
      const blocos = [
        { tipo: 'titulo', texto: (d.codigo || '') + (d.nome ? ' · ' + d.nome : '') || 'Base de Atendimento' },
      ];
      if (d.regiao) blocos.push({ tipo: 'kpi', rotulo: 'Região', valor: d.regiao });
      if (d.equipamentos_total !== null && d.equipamentos_total !== undefined) {
        blocos.push({ tipo: 'kpi', rotulo: 'Equipamentos', valor: numero(d.equipamentos_total) });
      }
      blocos.push({ tipo: 'kpi', rotulo: 'O.S. abertas', valor: numero(d.os_abertas) });
      if (d.ultima_ocorrencia) blocos.push({ tipo: 'kpi', rotulo: 'Última ocorrência', valor: api.dataCurta(d.ultima_ocorrencia) });

      if (d.equipamentos_status && Object.keys(d.equipamentos_status).length) {
        blocos.push({ tipo: 'separador' });
        blocos.push({ tipo: 'titulo', texto: 'Equipamentos' });
        const status = d.equipamentos_status;
        const normais = status['Ativo'] || 0;
        const atencao = status['Em Manutencao'] || 0;
        const indisponiveis = (status['Descartado'] || 0) + (status['Inativo'] || 0);
        if (normais) blocos.push({ tipo: 'status', cor: 'verde', texto: numero(normais) + ' normal(is)' });
        if (atencao) blocos.push({ tipo: 'status', cor: 'amarelo', texto: numero(atencao) + ' em atenção' });
        if (indisponiveis) blocos.push({ tipo: 'status', cor: 'vermelho', texto: numero(indisponiveis) + ' indisponível/is' });
      }

      CP.render({ titulo: 'Contexto Operacional', blocos });
    } catch (erro) {
      CP.erro('Contexto Operacional', 'Contexto ainda não disponível para o seu perfil.');
    }
  }

  async function contextoRegiao(id) {
    if (!id) {
      CP.render({ titulo: 'Contexto Operacional',
        blocos: [{ tipo: 'texto', texto: 'Selecione uma região para ver seu resumo operacional.' }] });
      return;
    }
    CP.carregando('Contexto Operacional');
    try {
      const d = await CP.buscar('/contexto/regiao/' + id);
      const blocos = [{ tipo: 'titulo', texto: d.nome || 'Região' }];
      blocos.push({ tipo: 'kpi', rotulo: 'Bases', valor: numero(d.bases) });
      if (d.equipamentos !== null && d.equipamentos !== undefined) blocos.push({ tipo: 'kpi', rotulo: 'Equipamentos', valor: numero(d.equipamentos) });
      blocos.push({ tipo: 'kpi', rotulo: 'O.S. abertas', valor: numero(d.os_abertas) });
      blocos.push({ tipo: 'kpi', rotulo: 'Ocorrências recentes (7d)', valor: numero(d.ocorrencias_recentes_7d) });

      if (d.status_bases) {
        blocos.push({ tipo: 'separador' });
        blocos.push({ tipo: 'titulo', texto: 'Status das bases' });
        if (d.status_bases.normais) blocos.push({ tipo: 'status', cor: 'verde', texto: numero(d.status_bases.normais) + ' normal(is)' });
        if (d.status_bases.atencao) blocos.push({ tipo: 'status', cor: 'amarelo', texto: numero(d.status_bases.atencao) + ' em atenção' });
        if (d.status_bases.criticas) blocos.push({ tipo: 'status', cor: 'vermelho', texto: numero(d.status_bases.criticas) + ' crítica(s)' });
      }

      if (d.maior_recorrencia) {
        blocos.push({ tipo: 'separador' });
        blocos.push({ tipo: 'titulo', texto: 'Maior recorrência' });
        blocos.push({ tipo: 'kpi', rotulo: d.maior_recorrencia.nome, valor: numero(d.maior_recorrencia.total) + ' ocorrência(s)' });
      }

      CP.render({ titulo: 'Contexto Operacional', blocos });
    } catch (erro) {
      CP.erro('Contexto Operacional', 'Contexto ainda não disponível para o seu perfil.');
    }
  }

  async function contextoEquipamento(id) {
    if (!id) {
      CP.render({ titulo: 'Contexto Operacional',
        blocos: [{ tipo: 'texto', texto: EXPLICACOES.ativos }] });
      return;
    }
    CP.carregando('Contexto Operacional');
    try {
      const d = await CP.buscar('/contexto/equipamento/' + id);
      const blocos = [{ tipo: 'titulo', texto: (d.codigo || '') + (d.nome ? ' · ' + d.nome : '') || 'Equipamento' }];
      if (d.base_nome || d.base_codigo) blocos.push({ tipo: 'kpi', rotulo: 'Base', valor: d.base_nome || d.base_codigo });
      if (d.tipo) blocos.push({ tipo: 'kpi', rotulo: 'Tipo', valor: d.tipo });
      if (d.status) {
        const cor = d.status === 'Ativo' ? 'verde' : (d.status === 'Em Manutencao' ? 'amarelo' : 'vermelho');
        blocos.push({ tipo: 'status', cor: cor, texto: d.status });
      }
      if (d.ultima_ocorrencia) blocos.push({ tipo: 'kpi', rotulo: 'Última ocorrência', valor: api.dataCurta(d.ultima_ocorrencia) });
      blocos.push({ tipo: 'kpi', rotulo: 'O.S. relacionadas', valor: numero(d.os_relacionadas) });

      blocos.push({ tipo: 'separador' });
      blocos.push({ tipo: 'titulo', texto: 'Histórico' });
      blocos.push({ tipo: 'kpi', rotulo: 'Últimos 30 dias', valor: numero(d.ocorrencias_30d) + ' ocorrência(s)' });
      if (d.tendencia === 'subindo') blocos.push({ tipo: 'alerta', texto: '↗ tendência de reincidência' });
      else if (d.tendencia === 'descendo') blocos.push({ tipo: 'status', cor: 'verde', texto: '↘ ocorrências em queda' });

      CP.render({ titulo: 'Contexto Operacional', blocos });
    } catch (erro) {
      CP.erro('Contexto Operacional', 'Contexto ainda não disponível para o seu perfil.');
    }
  }

  function contextoExplicativo(texto) {
    CP.render({ titulo: 'Contexto Operacional', blocos: texto ? [{ tipo: 'texto', texto: texto }] : [] });
  }

  function iniciar() {
    contextoExplicativo(EXPLICACOES['analise-operacional']);

    document.querySelectorAll('.menu .tab-btn[data-tab]').forEach((botao) => {
      botao.addEventListener('click', () => {
        const tabId = botao.dataset.tab;
        if (tabId === 'analise-operacional') contextoExplicativo(EXPLICACOES['analise-operacional']);
        else if (tabId === 'ativos') contextoEquipamento(null);
        else if (tabId === 'locais') {
          const subAtivo = document.querySelector('#loc-subabas .top-tab2.ativo');
          if (subAtivo && subAtivo.dataset.loc === 'regioes') contextoRegiao(null);
          else contextoBase(null);
        }
      });
    });

    document.getElementById('loc-subabas')?.addEventListener('click', (evento) => {
      const botao = evento.target.closest('[data-loc]');
      if (!botao) return;
      if (botao.dataset.loc === 'regioes') contextoRegiao(null);
      else contextoBase(null);
    });

    document.addEventListener('orbita:registro-selecionado', (evento) => {
      const detalhe = evento.detail || {};
      if (detalhe.tipo === 'base') contextoBase(detalhe.id);
      else if (detalhe.tipo === 'regiao') contextoRegiao(detalhe.id);
      else if (detalhe.tipo === 'equipamento') contextoEquipamento(detalhe.id);
    });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
