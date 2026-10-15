//======================================================================================================
// CONTEXTO OPERACIONAL - provedor da pagina Relatórios (relatorios.html)
// Reaproveita o resumo que a propria aba "Análise de Chamados" ja calcula
// (evento orbita:resumo-relatorio disparado por relatorios/painel.js) em vez
// de repetir a mesma consulta com os mesmos filtros.
//======================================================================================================
(function () {
  'use strict';

  const CP = window.ContextPanel;
  const api = window.RelatoriosApi;
  if (!CP || !api) return;

  function numero(valor) {
    return api.numero(valor || 0);
  }

  function contextoPeriodo(dados) {
    const blocos = [
      { tipo: 'titulo', texto: 'Período atual' },
      { tipo: 'kpi', rotulo: 'O.S.', valor: numero(dados.total_chamados) },
      { tipo: 'kpi', rotulo: 'Encerradas', valor: numero(dados.encerrados) },
      { tipo: 'kpi', rotulo: 'Em aberto', valor: numero(dados.abertos) },
    ];
    if (dados.pontos_reincidentes) {
      blocos.push({ tipo: 'kpi', rotulo: 'Bases reincidentes', valor: numero(dados.pontos_reincidentes) });
    }
    CP.render({ titulo: 'Contexto Operacional', blocos });
  }

  function contextoOutraAba(tabId) {
    const explicacoes = {
      auditoria: 'Trilha de alterações dos cadastros e classificações, somente leitura.',
    };
    CP.render({
      titulo: 'Contexto Operacional',
      blocos: explicacoes[tabId] ? [{ tipo: 'texto', texto: explicacoes[tabId] }] : [],
    });
  }

  let ultimoResumo = null;

  function iniciar() {
    document.addEventListener('orbita:resumo-relatorio', (evento) => {
      ultimoResumo = evento.detail;
      const ativa = document.querySelector('.menu .tab-btn.active[data-tab]');
      if (!ativa || ativa.dataset.tab === 'analise') contextoPeriodo(ultimoResumo);
    });

    document.querySelectorAll('.menu .tab-btn[data-tab]').forEach((botao) => {
      botao.addEventListener('click', () => {
        const tabId = botao.dataset.tab;
        if (tabId === 'analise' && ultimoResumo) contextoPeriodo(ultimoResumo);
        else if (tabId !== 'analise') contextoOutraAba(tabId);
      });
    });

    CP.render({
      titulo: 'Contexto Operacional',
      blocos: [{ tipo: 'texto', texto: 'Calculando o resumo do período...' }],
    });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
