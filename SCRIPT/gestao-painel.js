//======================================================================================================
// GESTAO - dashboard da aba "Painel Geral" (gestao.html)
// Uma unica chamada a /contexto/painel-geral alimenta os KPIs, os dois
// graficos, os alertas de outros modulos e as ultimas atividades - o mesmo
// endpoint que ja serve o Contexto Operacional lateral (SCRIPT/contexto/
// gestao.js), entao nao ha consulta duplicada.
//
// Regra do projeto: nada de numero inventado. Um indicador sem dado real
// simplesmente nao aparece (ver ausencia de "revisao preventiva"/"troca de
// oleo" nos alertas - a estrutura atual nao registra essas datas em lugar
// nenhum do sistema).
//======================================================================================================
(function () {
  'use strict';

  const api = window.RelatoriosApi;
  const graficos = window.RelatoriosGraficos;
  const CP = window.ContextPanel;
  if (!api || !graficos || !CP) return;

  const escapar = api.escaparHtml;
  const numero = api.numero;

  const ICONES = {
    abertas: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5l3 2"/>',
    execucao: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    pendentes: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    encerradas: '<path d="M20 6 9 17l-5-5"/>',
    recorrente: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.7 18a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    frota: '<path d="M3 13l2-5h11l3 5"/><path d="M2 13h19v4H2z"/><circle cx="7" cy="18" r="1.8"/><circle cx="16" cy="18" r="1.8"/>',
    estoque: '<path d="M3 7l9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
  };

  function svg(nome) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONES[nome] || '') + '</svg>';
  }

  function card(icone, cor, rotulo, valor) {
    return '<div class="painel-card">'
      + '<span class="painel-card-icone painel-icone-' + cor + '">' + svg(icone) + '</span>'
      + '<span class="painel-card-label">' + escapar(rotulo) + '</span>'
      + '<span class="painel-card-valor">' + escapar(valor) + '</span>'
      + '</div>';
  }

  function renderKpis(kpis) {
    const alvo = document.getElementById('pg-kpis');
    if (!alvo || !kpis) return;
    alvo.innerHTML = [
      card('abertas', 'teal', 'O.S. abertas', numero(kpis.abertas)),
      card('execucao', 'azul', 'Em execução', numero(kpis.em_execucao)),
      card('pendentes', 'ambar', 'Pendentes', numero(kpis.pendentes)),
      card('encerradas', 'verde', 'Encerradas (30d)', numero(kpis.encerradas_30d)),
      card('recorrente', 'vermelho', 'Problemas recorrentes', numero(kpis.problemas_recorrentes)),
    ].join('');
  }

  function renderEvolucao(evolucao) {
    const alvo = document.getElementById('pg-gr-evolucao');
    if (!alvo) return;
    const serie = (evolucao || []).map((p) => ({
      rotulo: api.dataCurta(p.data).slice(0, 5),
      total: p.total,
    }));
    graficos.linhas(alvo, serie, [{ campo: 'total', nome: 'O.S. abertas' }]);
  }

  function renderSituacao(situacao) {
    const alvo = document.getElementById('pg-gr-situacao');
    if (!alvo) return;
    if (!situacao || !situacao.total) {
      api.estadoVazio(alvo, 'Sem O.S. no período');
      return;
    }
    graficos.rosca(alvo, [
      { rotulo: 'Concluídas', valor: situacao.concluidas },
      { rotulo: 'Em andamento', valor: situacao.em_andamento },
      { rotulo: 'Pendentes', valor: situacao.pendentes },
    ].filter((item) => item.valor > 0));
  }

  function renderAlertas(alertasExtra) {
    const bloco = document.getElementById('pg-alertas-bloco');
    const alvo = document.getElementById('pg-alertas');
    if (!bloco || !alvo) return;
    const cartoes = [];
    if (alertasExtra && alertasExtra.frota_manutencao) {
      cartoes.push(card('frota', 'laranja', 'Frota', numero(alertasExtra.frota_manutencao) + ' veículo(s) em manutenção'));
    }
    if (alertasExtra && alertasExtra.estoque_baixo) {
      cartoes.push(card('estoque', 'roxo', 'Estoque', numero(alertasExtra.estoque_baixo) + ' produto(s) com estoque baixo'));
    }
    bloco.hidden = cartoes.length === 0;
    alvo.innerHTML = cartoes.join('');
  }

  function textoAtividade(item) {
    if (item.tipo === 'os_aberta') {
      return { titulo: 'O.S. ' + escapar(item.os) + ' iniciada', sub: '' };
    }
    if (item.tipo === 'os_encerrada') {
      return { titulo: 'O.S. ' + escapar(item.os) + ' encerrada', sub: '' };
    }
    const sub = [item.problema, item.base].filter(Boolean).map(escapar).join(' — ');
    return { titulo: 'Problema recorrente confirmado', sub: sub };
  }

  function renderAtividades(lista) {
    const alvo = document.getElementById('pg-atividades');
    if (!alvo) return;
    if (!lista || !lista.length) {
      alvo.innerHTML = '<li>Nenhuma atividade recente.</li>';
      return;
    }
    alvo.innerHTML = lista.map((item) => {
      const texto = textoAtividade(item);
      return '<li><span class="rel-cronologia-data">' + api.dataCurta(item.data) + '</span>'
        + '<div><strong>' + texto.titulo + '</strong>'
        + (texto.sub ? '<small>' + texto.sub + '</small>' : '')
        + '</div></li>';
    }).join('');
  }

  async function carregar() {
    try {
      // Mesmo cache (15s) que o Contexto Operacional lateral usa para este
      // endpoint (SCRIPT/contexto/gestao.js) - evita duas consultas iguais
      // quando a aba Painel Geral abre.
      const dados = await CP.buscar('/contexto/painel-geral');
      if (!dados) return;
      renderKpis(dados.kpis);
      renderEvolucao(dados.evolucao_7d);
      renderSituacao(dados.situacao_30d);
      renderAlertas(dados.alertas_extra);
      renderAtividades(dados.atividades_recentes);
    } catch (erro) {
      console.warn('[gestao-painel] falha ao carregar painel geral:', erro.message);
    }
  }

  function iniciar() {
    if (!document.getElementById('pg-kpis')) return;
    carregar();
    document.querySelector('.menu .tab-btn[data-tab="painel-geral"]')
      ?.addEventListener('click', carregar);
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
