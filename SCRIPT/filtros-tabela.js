//======================================================================================================
// FILTROS DAS TABELAS (padrão do sistema inteiro)
// Os campos de pesquisa e os seletores de filtro não ficam soltos na tela: vão
// para um painel recolhido, aberto por um ícone discreto no cabeçalho da
// tabela (no celular, onde a tabela vira cartões, numa barrinha acima da lista).
// Toda tabela ganha o ícone; a que não tem filtro próprio recebe uma busca
// rápida por texto. Com filtro preenchido, o ícone mostra um ponto.
//
// Cadastro de filtros próprios: lista FILTROS abaixo (seletores dos campos
// que vão para o painel de cada tabela). Botões de ação ficam onde estão.
//======================================================================================================
(function () {
  'use strict';

  // alvo: a tabela ou o contêiner estável onde a tabela é desenhada.
  // filtros: elementos que vão para o painel. busca: false = sem busca rápida.
  // compartilhados: elementos que acompanham o painel aberto (vários blocos).
  const FILTROS = [
    // O.S.
    { alvo: '#tabela-busca-os', filtros: ['#busca .busca-controles .busca-controle-item', '#btn-buscar-os', '#busca .busca-filtros'], busca: false },
    { alvo: '#tabela-bases', filtros: ['#bases-busca'], busca: false },
    { alvo: '#eqi-tabela', filtros: ['#eqi-busca', '#eqi-tipo', '#eqi-local'], busca: false },
    { alvo: '#cronograma-lista', filtros: ['#cronograma .cronograma-filtros'], busca: false, itens: '.cronograma-item' },
    { alvo: '#eq-tabela', filtros: ['#os-sub-equipamento .cad-busca', '#eq-filtro-tipo', '#eq-filtro-ponto', '#os-sub-equipamento .cad-check-inline'], busca: false },
    // Cadastros
    { alvo: '#cad-tabela', filtros: ['#analise-operacional .cad-busca', '#analise-operacional .cad-check-inline', '#cad-filtro-categoria'], busca: false },
    { alvo: '#loc-tabela', filtros: ['#locais .cad-busca'], busca: false },
    // Estoque (Busca): cada bloco com seus filtros; período e Buscar acompanham o painel aberto
    { alvo: '#Lista-dos-produtos', filtros: ['#busca-bloco-produtos .busca-filtros', '#busca-bloco-produtos .busca-colunas-controle'], compartilhados: 'estoque-busca', busca: false },
    { alvo: '#tabela-kits-lista', filtros: ['#busca-bloco-kits .busca-filtros', '#busca-bloco-kits .busca-colunas-controle'], compartilhados: 'estoque-busca', busca: false },
    { alvo: '#tabela-retiradas-lista', filtros: ['#busca-bloco-retiradas .busca-filtros'], compartilhados: 'estoque-busca', busca: false },
    { alvo: '#tabela-devolucoes-lista', filtros: ['#busca-bloco-devolucoes .busca-filtros'], compartilhados: 'estoque-busca', busca: false },
    { alvo: '#tabela-fornecedores-lista', filtros: ['#busca-bloco-fornecedores .busca-filtros'], compartilhados: 'estoque-busca', busca: false },
    { alvo: '#tabela-requisitantes-lista', filtros: ['#busca-bloco-requisitantes .busca-filtros'], compartilhados: 'estoque-busca', busca: false },
    // Frota
    { alvo: '#frota-gestao-veiculos', filtros: ['#veiculos .frota-gestao-filtros #frota-gestao-busca', '#veiculos .frota-gestao-filtros select'], busca: false },
    { alvo: '#frota-tabela-manutencoes', filtros: ['#manutencao .frota-gestao-filtros select'], busca: true },
    // Gestão
    { alvo: '#tabela-funcionarios', filtros: ['#func-busca', '#func-mostrar-inativos'], busca: false },
    { alvo: '#jor-tabela-busca', filtros: ['#ponto-sec-historico .jor-filtros'], busca: true },
    // Relatórios
    { alvo: '#rel-tabela-cronicos', filtros: ['#cronicos .rel-cronicos-parametros'], busca: true },
    { alvo: '#aud-tabela', filtros: ['#aud-entidade'], busca: false },
  ];
  const COMPARTILHADOS = {
    'estoque-busca': ['#form-busca .busca-controle-item:nth-of-type(2)', '#form-busca button[type="submit"]'],
  };
  // Tabelas que são parte de um formulário em preenchimento ou de uma ficha: sem ícone.
  const IGNORAR = '#tabela-retiradas, #tabela-devolucoes, #tabela-transf-itens, #tabela-entrada-itens, #tabelaProdutos, #tabela-kits-lista-cadastro, ' +
    '.fr-janela table, .frota-detalhe table, .eqi-fundo table, .jor-cal table, .modal table, .ficha-tabela, #ponto-tabela';

  const ICONE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6 7v6l-4 2v-8z"/></svg>';
  const grupos = [];

  function q(sel, raiz) { try { return (raiz || document).querySelector(sel); } catch (e) { return null; } }
  function qq(sel, raiz) { try { return Array.from((raiz || document).querySelectorAll(sel)); } catch (e) { return []; } }

  // Tabela do alvo: o próprio <table> ou a tabela desenhada dentro do contêiner.
  function tabelaDe(g) {
    const a = q(g.alvo);
    if (!a) return null;
    return a.tagName === 'TABLE' ? a : a.querySelector('table');
  }
  // Ponto fixo antes do qual o painel fica (não muda quando a tabela é redesenhada).
  function ancoraDe(alvo) {
    if (alvo.tagName !== 'TABLE') return alvo;
    return alvo.closest('.tabela-responsiva, .tabela-produtos, .frota-tabela-wrap, .rel-tabela-area') || alvo;
  }

  function barraVizinha(ancora) {
    let el = ancora.previousElementSibling;
    while (el && (el.classList.contains('tf-painel') || el.classList.contains('tf-barra'))) el = el.previousElementSibling;
    if (!el || el.tagName !== 'DIV' || el.hidden) return null;
    if (!el.querySelector('button') || el.querySelector('table, textarea, input:not([type="hidden"]), select, h1, h2, h3')) return null;
    return el.children.length <= 4 ? el : null;
  }

  function criarGrupo(g) {
    const alvo = q(g.alvo);
    if (!alvo || alvo.dataset.tfGrupo) return null;
    const ancora = ancoraDe(alvo);
    const grupo = Object.assign({}, g, { alvoEl: alvo, ancora: ancora, aberto: false });
    alvo.dataset.tfGrupo = String(grupos.length);

    const barra = document.createElement('div');
    barra.className = 'tf-barra' + (alvo.tagName === 'TABLE' || alvo.querySelector('table') ? '' : ' tf-barra-sempre');
    barra.innerHTML = `<button type="button" class="tf-icone" aria-expanded="false" title="Filtros e busca" aria-label="Filtros e busca">${ICONE}<span>Filtros</span></button>`;
    const painel = document.createElement('div');
    painel.className = 'tf-painel';
    painel.hidden = true;
    if (g.busca !== false) {
      painel.innerHTML = '<label class="tf-busca"><span>Buscar na tabela</span><input type="search" placeholder="Digite para filtrar as linhas" autocomplete="off"></label>';
    }
    const filtros = document.createElement('div');
    filtros.className = 'tf-campos';
    painel.appendChild(filtros);
    (g.filtros || []).forEach((sel) => qq(sel).forEach((el) => {
      if (!painel.contains(el)) filtros.appendChild(el);
    }));
    if (!filtros.children.length) filtros.remove();
    // Barra de botões logo acima (ex.: "+ Novo"): o botão Filtros vai para a mesma linha.
    const vizinho = barraVizinha(ancora);
    if (vizinho) { vizinho.classList.add('tf-com-toolbar'); vizinho.insertBefore(barra, vizinho.firstChild); }
    else ancora.parentNode.insertBefore(barra, ancora);
    ancora.parentNode.insertBefore(painel, ancora);
    grupo.barra = barra;
    grupo.painel = painel;
    grupo.campos = painel.querySelector('.tf-campos');

    const busca = painel.querySelector('.tf-busca input');
    if (busca) busca.addEventListener('input', () => { aplicarBusca(grupo); marcarAtivo(grupo); });
    painel.addEventListener('input', () => marcarAtivo(grupo));
    painel.addEventListener('change', () => marcarAtivo(grupo));
    barra.querySelector('.tf-icone').addEventListener('click', () => alternar(grupo));
    grupos.push(grupo);
    colocarIcone(grupo);
    marcarAtivo(grupo);
    return grupo;
  }

  function alternar(grupo, abrir) {
    grupo.aberto = abrir === undefined ? !grupo.aberto : abrir;
    grupo.painel.hidden = !grupo.aberto;
    qq(`[data-tf-botao="${grupo.alvoEl.dataset.tfGrupo}"]`).forEach((b) => b.setAttribute('aria-expanded', grupo.aberto ? 'true' : 'false'));
    grupo.barra.querySelector('.tf-icone').setAttribute('aria-expanded', grupo.aberto ? 'true' : 'false');
    if (grupo.aberto && grupo.compartilhados) {
      const destino = grupo.painel.querySelector('.tf-campos') || grupo.painel;
      (COMPARTILHADOS[grupo.compartilhados] || []).forEach((sel) => qq(sel).forEach((el) => destino.insertBefore(el, destino.firstChild)));
      // Elementos que saem do <form> continuam ligados a ele.
      destino.querySelectorAll('input, select, button[type="submit"]').forEach((el) => { if (!el.form) el.setAttribute('form', 'form-busca'); });
    }
    if (grupo.aberto) {
      const primeiro = grupo.painel.querySelector('input:not([type="checkbox"]), select');
      if (primeiro) primeiro.focus({ preventScroll: true });
    }
  }

  // Ícone dentro do cabeçalho da tabela.
  function colocarIcone(grupo) {
    const tabela = tabelaDe(grupo);
    if (!tabela || !tabela.tHead || !tabela.tHead.rows.length) return;
    const idx = grupo.alvoEl.dataset.tfGrupo;
    if (tabela.tHead.querySelector(`[data-tf-botao="${idx}"]`)) return;
    // Primeiro cabeçalho visível: nunca sai da tela quando a tabela rola para o lado.
    const th = Array.from(tabela.tHead.rows[0].cells).find((c) => c.style.display !== 'none');
    if (!th) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tf-icone tf-icone-th';
    b.dataset.tfBotao = idx;
    b.title = 'Filtros e busca';
    b.setAttribute('aria-label', 'Filtros e busca');
    b.setAttribute('aria-expanded', grupo.aberto ? 'true' : 'false');
    b.innerHTML = ICONE;
    b.addEventListener('click', (e) => { e.stopPropagation(); alternar(grupo); });
    th.classList.add('tf-th');
    th.appendChild(b);
    marcarAtivo(grupo);
    grupo.barra.classList.add('tf-com-th');
  }

  function aplicarBusca(grupo) {
    const campo = grupo.painel.querySelector('.tf-busca input');
    const termo = campo ? campo.value.trim().toLowerCase() : '';
    const raiz = grupo.alvoEl.tagName === 'TABLE' ? grupo.alvoEl : grupo.alvoEl;
    const linhas = grupo.itens ? qq(grupo.itens, raiz) : qq('tbody > tr, .rel-cards > li', raiz.tagName === 'TABLE' ? raiz.parentNode : raiz);
    linhas.forEach((l) => l.classList.toggle('tf-oculta', Boolean(termo) && !l.textContent.toLowerCase().includes(termo)));
  }

  function temValor(grupo) {
    return Array.from(grupo.painel.querySelectorAll('input, select')).some((el) => {
      if (el.type === 'checkbox' || el.type === 'radio') return el.checked;
      if (el.type === 'button' || el.type === 'submit') return false;
      if (el.tagName === 'SELECT') return el.selectedIndex > 0;
      if (el.type === 'number' && el.value === el.defaultValue) return false;
      return Boolean(el.value && el.value.trim());
    });
  }

  function marcarAtivo(grupo) {
    const ativo = temValor(grupo);
    const idx = grupo.alvoEl.dataset.tfGrupo;
    grupo.barra.querySelector('.tf-icone').classList.toggle('tf-ativo', ativo);
    qq(`[data-tf-botao="${idx}"]`).forEach((b) => b.classList.toggle('tf-ativo', ativo));
  }

  // Tabelas sem cadastro: ícone com busca rápida.
  function automaticas() {
    qq('.content table').forEach((t) => {
      if (t.closest('[data-tf-grupo]') || t.dataset.tfGrupo || t.matches(IGNORAR) || t.closest('.tf-painel')) return;
      if (!t.tHead || !t.tBodies.length) return;
      if (!t.id && !t.closest('[id]')) return;
      const alvo = t.closest('.rel-tabela-area[id], .rel-so-desktop') ? (t.closest('[id]') || t) : t;
      if (alvo !== t && alvo.dataset.tfGrupo) return;
      if (!alvo.id) return;
      criarGrupo({ alvo: '#' + CSS.escape(alvo.id), busca: true });
    });
  }

  function varrer() {
    FILTROS.forEach((g) => { if (!q(g.alvo) || q(g.alvo).dataset.tfGrupo) return; criarGrupo(g); });
    automaticas();
    grupos.forEach((g) => { colocarIcone(g); if (g.painel.querySelector('.tf-busca input')?.value) aplicarBusca(g); });
  }

  let agendado = false;
  function agendar() {
    if (agendado) return;
    agendado = true;
    setTimeout(() => { agendado = false; varrer(); }, 60);
  }

  function iniciar() {
    varrer();
    // Tabelas desenhadas depois (relatórios, cadastros, listas por API).
    new MutationObserver((muts) => {
      if (muts.some((m) => Array.from(m.addedNodes).some((n) => n.nodeType === 1 && (n.tagName === 'TABLE' || n.tagName === 'TR' || n.querySelector?.('table, tr'))))) agendar();
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 0));
  else setTimeout(iniciar, 0);
  window.FiltrosTabela = { varrer, abrir: (sel) => { const g = grupos.find((x) => x.alvoEl.matches(sel)); if (g) alternar(g, true); } };
})();
