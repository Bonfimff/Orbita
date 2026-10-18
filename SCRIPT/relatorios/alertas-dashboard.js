//======================================================================================================
// ALERTAS DE RECORRENCIA NO PAINEL GERAL DA O.S.
// Bloco pequeno e acionavel: mostra os pontos que estao repetindo o mesmo
// problema e leva direto ao relatorio ja filtrado naquele ponto.
//
// Este arquivo e carregado pela pagina de O.S. (nao pela de Relatorios) e nao
// depende de nada dela alem do config.js. Se o modulo de analise estiver
// indisponivel ou o usuario nao tiver permissao, o bloco simplesmente nao
// aparece - nunca quebra o Painel Geral, que ja funcionava antes dele.
//======================================================================================================
(function () {
  'use strict';

  const DIAS_PADRAO = '30d';
  const LIMITE = 4;

  function urlApi(caminho) {
    return (typeof window.apiUrl === 'function') ? window.apiUrl(caminho) : caminho;
  }

  function escapar(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function dataCurta(valor) {
    if (!valor) return '';
    const data = new Date(String(valor).replace(' ', 'T'));
    return isNaN(data.getTime()) ? '' : data.toLocaleDateString('pt-BR');
  }

  async function carregar() {
    const secao = document.getElementById('os-alertas-recorrencia');
    const lista = document.getElementById('os-alertas-lista');
    if (!secao || !lista) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const resposta = await fetch(
        urlApi('/analitico/alertas?periodo=' + DIAS_PADRAO + '&limite=' + LIMITE),
        { headers: { Authorization: 'Bearer ' + token } });
      if (!resposta || !resposta.ok) return;      // 403/500: bloco fica oculto

      const corpo = await resposta.json();
      if (!corpo || corpo.status !== 'ok') return;

      const dados = corpo.dados || {};
      const itens = dados.itens || [];
      if (!itens.length) return;                  // nada a alertar: segue oculto

      lista.innerHTML = '<ul class="os-alertas-itens">' + itens.map((item) => {
        const critico = item.nivel === 'critico';
        return '<li class="os-alerta os-alerta-' + (critico ? 'critico' : 'atencao') + '"'
          + ' data-ponto="' + escapar(item.ponto_id) + '">'
          + '<span class="os-alerta-bolinha" aria-hidden="true"></span>'
          + '<div class="os-alerta-texto">'
          + '<strong>' + escapar(item.codigo || 'Ponto') + '</strong>'
          + '<span>' + escapar(item.ocorrencias) + ' ocorrência(s) de '
          + escapar(item.problema) + '</span>'
          + '<small>última em ' + dataCurta(item.ultima_ocorrencia)
          + (item.intervalo_medio_dias
             ? ' · a cada ' + item.intervalo_medio_dias + ' dias' : '')
          + '</small></div></li>';
      }).join('') + '</ul>'
        + (dados.pontos_com_reincidencia > itens.length
           ? '<p class="os-alertas-resumo">' + dados.pontos_com_reincidencia
             + ' ponto(s) apresentaram reincidência nos últimos 30 dias.</p>'
           : '');

      // Cada alerta abre o relatório já filtrado naquele ponto - indicador que
      // não leva a lugar nenhum vira decoração.
      lista.querySelectorAll('.os-alerta').forEach((elemento) => {
        elemento.addEventListener('click', () => {
          window.location.href = 'relatorios.html?ponto_id=' + elemento.dataset.ponto;
        });
      });

      secao.hidden = false;
    } catch (erro) {
      console.warn('[alertas] indisponivel:', erro.message);
    }
  }

  //====================================================================
  // Problemas recorrentes e classificacao pendente
  // Cada bloco leva ao relatorio JA FILTRADO: indicador que nao leva a
  // lugar nenhum vira decoracao.
  //====================================================================
  async function carregarBlocosExtras() {
    const token = localStorage.getItem('token');
    if (!token) return;
    const cabecalho = { Authorization: 'Bearer ' + token };

    // --- problemas recorrentes ---
    const alvoProblemas = document.getElementById('os-problemas-recorrentes');
    if (alvoProblemas) {
      try {
        const resposta = await fetch(
          urlApi('/analitico/ranking-problemas?periodo=' + DIAS_PADRAO + '&limite=4'),
          { headers: cabecalho });
        if (resposta.ok) {
          const corpo = await resposta.json();
          const itens = (corpo.dados && corpo.dados.itens) || [];
          if (itens.length) {
            alvoProblemas.innerHTML = '<ul class="os-mini-lista">' + itens.map((item) =>
              '<li data-problema="' + escapar(item.problema_id) + '">'
              + '<span class="os-mini-rotulo">' + escapar(item.problema) + '</span>'
              + '<b>' + escapar(item.ocorrencias) + '</b>'
              + '<small>' + escapar(item.pontos_afetados) + ' ponto(s) afetado(s)</small></li>'
            ).join('') + '</ul>';
            alvoProblemas.querySelectorAll('[data-problema]').forEach((linha) => {
              linha.addEventListener('click', () => {
                window.location.href = 'relatorios.html?problema_id='
                  + linha.dataset.problema;
              });
            });
            alvoProblemas.closest('.os-painel-bloco').hidden = false;
          }
        }
      } catch (erro) {
        console.warn('[alertas] problemas:', erro.message);
      }
    }

    // --- classificacao pendente ---
    const alvoPendencias = document.getElementById('os-classificacao-pendente');
    if (!alvoPendencias) return;
    try {
      const resposta = await fetch(
        urlApi('/classificacao/resumo?periodo=12m'), { headers: cabecalho });
      if (!resposta.ok) return;
      const corpo = await resposta.json();
      const dados = corpo.dados || {};
      if (!dados.pendentes) return;

      const motivos = [
        ['sem_problema', 'Sem problema'],
        ['sem_causa', 'Sem causa'],
        ['sem_solucao', 'Sem solução'],
        ['sem_resultado', 'Sem resultado'],
      ].filter(function (par) { return dados[par[0]] > 0; });

      alvoPendencias.innerHTML =
        '<p class="os-pendencia-total"><strong>' + dados.pendentes
        + '</strong> ocorrência(s) aguardando classificação</p>'
        + '<ul class="os-mini-lista">' + motivos.map(function (par) {
            return '<li data-motivo="' + par[0] + '">'
              + '<span class="os-mini-rotulo">' + par[1] + '</span>'
              + '<b>' + dados[par[0]] + '</b></li>';
          }).join('') + '</ul>'
        + (dados.sem_equipamento
           ? '<small class="os-pendencia-nota">' + dados.sem_equipamento
             + ' sem equipamento informado <button type="button" class="ajuda-contextual" data-ajuda="relatorios-pendentes" aria-label="Ver no manual" title="Ver no manual">i</button></small>'
           : '');

      alvoPendencias.querySelectorAll('[data-motivo]').forEach((linha) => {
        linha.addEventListener('click', () => {
          window.location.href = 'relatorios.html?pendentes=' + linha.dataset.motivo;
        });
      });
      alvoPendencias.closest('.os-painel-bloco').hidden = false;
    } catch (erro) {
      console.warn('[alertas] pendencias:', erro.message);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    carregar();
    carregarBlocosExtras();
    // Recarrega ao voltar para o Painel Geral, para o alerta não ficar velho
    // enquanto o usuário navega pelas outras abas.
    const aba = document.querySelector('.tab-btn[data-tab="gerenciamento"]');
    if (aba) {
      aba.addEventListener('click', () => setTimeout(() => {
        carregar();
        carregarBlocosExtras();
      }, 100));
    }
  });
})();
