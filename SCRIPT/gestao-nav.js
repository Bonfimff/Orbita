//======================================================================================================
// NAVEGACAO DA AREA DE GESTAO (centro administrativo)
//
// Gestao deixou de ser "mais uma pagina" e virou o guarda-chuva das areas
// administrativas. Relatorios e Cadastros sairam do menu principal e viraram
// itens de Gestao daqui - continuam sendo as MESMAS paginas de antes (mesmas
// URLs, mesmo JS, mesma logica); o que mudou foi so por onde se chega nelas.
//
// ONDE A LISTA APARECE
//   No PAINEL LATERAL ESQUERDO (`.menu`), como uma secao "Gestão" acima da
//   navegacao propria de cada pagina - o mesmo painel que gestao.html ja usa
//   para Usuarios/Perfis/Contratos, so que agora tambem alcanca Cadastros,
//   Relatorios e Jornadas a partir de QUALQUER pagina de Gestao.
//
// POR QUE UM ARQUIVO SO
//   A lista SUBAREAS abaixo e a UNICA fonte da estrutura de Gestao. Incluir
//   uma area nova no futuro (Auditoria, Configuracoes, Parametros...) e
//   acrescentar UMA entrada aqui - nao ha lista repetida em cada HTML.
//
// SEM DUPLICAR BOTAO
//   Em gestao.html, Painel Geral/Usuarios/Perfis/Contratos ja sao botoes
//   nativos do menu lateral (viram aba pelo gestao.js). A secao injetada aqui
//   pula esses e so acrescenta os que a pagina ainda nao tem (Cadastros,
//   Relatorios, Jornadas) - em cadastros.html/relatorios.html/jornada.html,
//   nenhum dos 7 existe nativamente, entao a lista inteira e acrescentada.
//
// PERMISSAO
//   Nao existe regra de permissao propria aqui. Cada subarea aponta para uma
//   chave do mapa `modulos` que o backend ja devolve em /modulos, a mesma que
//   o geral.js sempre usou para o menu principal. Esconder um item e apenas
//   exibicao: o bloqueio real continua em cada endpoint da API.
//
// CLASSE PROPOSITALMENTE DIFERENTE DE .tab-btn
//   Os botoes injetados usam .menu-gestao-item (nao .tab-btn, nem
//   data-tab) para NAO serem capturados pelos seletores genericos que outras
//   paginas ja usam (gestao.js: `.tab-btn`; inicializarAbasPadrao():
//   `.tab-btn[data-tab]`) - evita dois handlers de clique brigando pelo mesmo
//   botao. O visual vem de graca da regra generica `.menu button` do
//   geral.css; so o agrupamento visual da secao e novo (gestao-nav.css).
//======================================================================================================
(function () {
  'use strict';

  // `pagina`  - arquivo que atende a subarea (as paginas existentes, intactas)
  // `tab`     - quando a subarea e uma aba INTERNA daquela pagina, o data-tab dela
  // `modulo`  - chave de permissao ja existente em /modulos
  const SUBAREAS = [
    { id: 'painel-geral', rotulo: 'Painel Geral',     pagina: 'gestao.html',     tab: 'painel-geral', modulo: 'gestao' },
    { id: 'usuarios',     rotulo: 'Usuários',         pagina: 'gestao.html',     tab: 'usuarios',     modulo: 'gestao' },
    { id: 'contratos',    rotulo: 'Contratos',        pagina: 'gestao.html',     tab: 'contratos',    modulo: 'gestao' },
    { id: 'funcionarios', rotulo: 'Funcionários',     pagina: 'gestao.html',     tab: 'funcionarios', modulo: 'gestao' },
    { id: 'cadastros',    rotulo: 'Cadastros',        pagina: 'cadastros.html',  tab: null,           modulo: 'cadastros' },
    { id: 'relatorios',   rotulo: 'Relatórios',       pagina: 'relatorios.html', tab: null,           modulo: 'relatorios' },
    { id: 'jornada',      rotulo: 'Jornadas',         pagina: 'jornada.html',    tab: null,           modulo: 'jornada' },
  ];

  function paginaAtual() {
    const partes = window.location.pathname.split('/');
    return partes[partes.length - 1] || '';
  }

  function permitidas(modulos) {
    if (!modulos) return [];
    return SUBAREAS.filter((s) => !!modulos[s.modulo]);
  }

  function primeiraPermitida(modulos) {
    return permitidas(modulos)[0] || null;
  }

  //---------------------------------------------------------------- render
  function montarMenuLateral(modulos) {
    const menu = document.querySelector('.menu');
    if (!menu) return;

    const disponiveis = permitidas(modulos);
    if (!disponiveis.length) return;

    const atual = paginaAtual();
    // Pagina que nao pertence a Gestao (almoxarifado/frota/ordens): sem secao.
    if (!disponiveis.some((s) => s.pagina === atual)) return;

    // Botoes que a pagina ja tem nativamente para uma subarea de Gestao
    // (em gestao.html: Painel Geral / Usuarios / Perfis / Contratos).
    const nativos = {};
    menu.querySelectorAll(':scope > button[data-tab]').forEach((b) => { nativos[b.dataset.tab] = b; });

    const secao = document.createElement('div');
    secao.className = 'menu-gestao-secao';

    const titulo = document.createElement('span');
    titulo.className = 'menu-gestao-titulo';
    titulo.textContent = 'Gestão';
    secao.appendChild(titulo);

    // A secao e montada na ORDEM de SUBAREAS. Onde a pagina ja tem o botao
    // nativo, ele e MOVIDO para dentro da secao em vez de duplicado:
    // appendChild move o elemento, preservando os listeners que o JS da
    // pagina (gestao.js) ja tinha ligado nele. Assim a ordem fica correta,
    // ha um titulo so, e nada e reimplementado.
    disponiveis.forEach((sub) => {
      const nativo = sub.tab && nativos[sub.tab];
      if (nativo) {
        nativo.classList.add('menu-gestao-item');
        nativo.dataset.subarea = sub.id;
        // O botao nativo ja troca a aba sozinho (listener do JS da pagina).
        // Falta so refletir isso na URL, para o deep-link e o voltar/avancar
        // continuarem funcionando. Nao chamamos irPara aqui: isso dispararia
        // um segundo clique no proprio botao.
        nativo.addEventListener('click', () => {
          if (window.location.hash !== '#' + sub.tab) {
            history.pushState(null, '', '#' + sub.tab);
          }
        });
        secao.appendChild(nativo);
        return;
      }
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'menu-gestao-item';
      botao.textContent = sub.rotulo;
      botao.dataset.subarea = sub.id;
      botao.addEventListener('click', () => irPara(sub));
      secao.appendChild(botao);
    });

    menu.insertBefore(secao, menu.firstChild);

    // Celular: as opções de Gestão ficam dentro do submenu do módulo Gestão
    // (como em Estoque), em vez de num bloco separado no topo do menu.
    const telaPequena = window.matchMedia('(max-width: 768px)');
    // Abas internas da página atual (Relatórios: Análise, Ranking...). No
    // celular ficam aninhadas logo abaixo do item da página na lista de
    // Gestão; na tela grande voltam ao lugar original.
    const paginaPropria = disponiveis.find((s) => s.pagina === atual && s.tab === null);
    const internas = paginaPropria
      ? internosDoMenu(menu).filter((b) => !b.classList.contains('menu-gestao-item'))
      : [];
    const origemInternas = internas.map((b) => ({ b: b, pai: b.parentNode, marca: document.createComment('aba-interna') }));
    origemInternas.forEach((o) => o.pai.insertBefore(o.marca, o.b));
    const aninhadas = document.createElement('div');
    aninhadas.className = 'menu-gestao-internas';
    function encaixarNoSubmenu() {
      const submenu = menu.querySelector('.menu-modulos .menu-submodulos');
      if (!submenu) return;
      const itens = Array.from(secao.querySelectorAll('.menu-gestao-item'))
        .concat(Array.from(submenu.querySelectorAll('.menu-gestao-item')));
      if (telaPequena.matches) {
        submenu.querySelectorAll(':scope > .tab-btn:not(.menu-gestao-item)').forEach((b) => { b.hidden = true; });
        itens.forEach((b) => submenu.appendChild(b));
        secao.hidden = true;
        const itemPagina = paginaPropria && submenu.querySelector('[data-subarea="' + paginaPropria.id + '"]');
        if (itemPagina && internas.length) {
          internas.forEach((b) => { b.hidden = false; aninhadas.appendChild(b); });
          itemPagina.after(aninhadas);
        }
      } else {
        itens.forEach((b) => secao.appendChild(b));
        secao.hidden = false;
        origemInternas.forEach((o) => { o.b.hidden = false; o.pai.insertBefore(o.b, o.marca); });
        aninhadas.remove();
      }
    }
    encaixarNoSubmenu();
    if (telaPequena.addEventListener) telaPequena.addEventListener('change', encaixarNoSubmenu);
    menu.addEventListener('click', (e) => {
      if (telaPequena.matches && e.target.closest('.menu-submodulos .menu-gestao-item')) {
        setTimeout(() => document.querySelector('.menu-toggle[aria-expanded="true"]')?.click(), 0);
      }
    });
    document.body.classList.add('em-gestao');

    // Paginas-subarea inteiras (Cadastros/Relatorios/Jornadas): o titulo
    // mobile mostra o nome da AREA, nao da aba interna, e ganha os atalhos
    // das secoes internas logo abaixo - ver geral.js (window.__painelSubareaFixa).
    const propria = disponiveis.find((s) => s.pagina === atual && s.tab === null);
    if (propria) {
      montarSubnavMobile(propria, menu);
      montarSubnavDesktop(menu);
    }

    sincronizarAtiva();
  }

  const _observers = [];

  // As abas internas da pagina (Analise de Chamados, Ranking de Pontos...)
  // continuam sendo os MESMOS botoes .tab-btn do menu lateral - so buscamos
  // por qualquer profundidade (nao :scope) porque a pagina pode envolve-los
  // num wrapper (.menu-subtabs) so para poder escondê-los em telas largas
  // sem duplicar HTML nem perder os listeners ja ligados neles.
  function internosDoMenu(menu) {
    return Array.from(menu.querySelectorAll('button.tab-btn[data-tab]'));
  }

  // Espelha, como uma fileira de botoes logo abaixo do titulo mobile
  // (.painel-cabecalho), a MESMA navegacao interna que ja existe no menu
  // lateral esquerdo daquela pagina - sem reimplementar a troca de aba,
  // so encaminha o clique para o botao original (mesmo truque ja usado
  // pelo clone do drawer mobile em geral.js).
  function montarSubnavMobile(subarea, menu) {
    window.__painelSubareaFixa = subarea.rotulo;

    const cabecalho = document.querySelector('.painel-cabecalho');
    if (!cabecalho || cabecalho.querySelector('.painel-subnav')) return;

    const internos = internosDoMenu(menu);
    if (!internos.length) return;

    const nav = document.createElement('div');
    nav.className = 'painel-subnav';
    internos.forEach((original) => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'painel-subnav-item';
      botao.textContent = original.textContent.trim();
      if (original.classList.contains('active')) botao.classList.add('active');
      botao.dataset.subnavRef = original.dataset.tab;
      botao.addEventListener('click', () => original.click());
      nav.appendChild(botao);
    });
    cabecalho.appendChild(nav);

    internos.forEach((original) => {
      const obs = new MutationObserver(() => {
        const botao = nav.querySelector('[data-subnav-ref="' + original.dataset.tab + '"]');
        if (botao) botao.classList.toggle('active', original.classList.contains('active'));
      });
      obs.observe(original, { attributes: true, attributeFilter: ['class'] });
      _observers.push(obs);
    });
  }

  // A partir de tablet/desktop (ver CSS: .menu-subtabs some e .subnav-abas
  // aparece nesse tamanho), as abas internas saem do menu lateral - que fica
  // só com as areas de Gestao - e viram uma fileira de pilulas logo abaixo
  // da legenda (.aba-legenda-linha) da aba ativa. Mesmo truque de clique
  // encaminhado do montarSubnavMobile; o que muda e que este nav e MOVIDO
  // (nao clonado de novo) para dentro da aba ativa a cada troca, porque cada
  // tab-content tem sua propria .aba-legenda-linha.
  function montarSubnavDesktop(menu) {
    // So entra em acao se a propria pagina marcou seus botoes internos como
    // "escondiveis" nesse tamanho de tela (envolvendo-os em .menu-subtabs -
    // ver relatorios.html). Sem isso o botao continua so no menu lateral
    // (ex.: cadastros.html, cujas 3 abas ja cabem tranquilamente ali) - nao
    // ha por que duplicar a navegacao em pilulas nesse caso.
    if (!menu.querySelector(':scope > .menu-subtabs')) return;

    const internos = internosDoMenu(menu);
    if (internos.length < 2) return; // nada a "trocar" com uma unica aba

    const nav = document.createElement('div');
    nav.className = 'opcoes-abas subnav-abas';
    internos.forEach((original) => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'top-tab2 subnav-abas-item';
      if (original.classList.contains('active')) botao.classList.add('ativo');
      botao.textContent = original.textContent.trim();
      botao.dataset.subnavRef = original.dataset.tab;
      botao.addEventListener('click', () => original.click());
      nav.appendChild(botao);
    });

    internos.forEach((original) => {
      const obs = new MutationObserver(() => {
        const botao = nav.querySelector('[data-subnav-ref="' + original.dataset.tab + '"]');
        if (botao) botao.classList.toggle('ativo', original.classList.contains('active'));
      });
      obs.observe(original, { attributes: true, attributeFilter: ['class'] });
      _observers.push(obs);
    });

    function reposicionar() {
      const ativa = document.querySelector('.content > .tab-content.active');
      if (!ativa) return;
      const legendHost = ativa.querySelector('.aba-legenda-linha') || ativa.querySelector('.aba-legenda');
      if (!legendHost) return;
      // Fica logo abaixo da trilha (Módulo › Área › Aba), quando ela já
      // estiver posicionada; senão, direto abaixo da legenda. Assim a ordem
      // visual (legenda, trilha, sub-abas, filtros) se mantém independente
      // de qual desses scripts reposicionar primeiro.
      const anchor = ativa.querySelector('.aba-trilha') || legendHost;
      anchor.insertAdjacentElement('afterend', nav);
    }

    reposicionar();
    internos.forEach((original) => {
      original.addEventListener('click', () => setTimeout(reposicionar, 0));
    });
    window.addEventListener('hashchange', () => setTimeout(reposicionar, 0));
  }

  //------------------------------------------------------------- navegacao
  function irPara(sub) {
    if (sub.pagina !== paginaAtual()) {
      // Outra pagina: leva junto a aba interna quando a subarea tem uma.
      window.location.href = sub.pagina + (sub.tab ? '#' + sub.tab : '');
      return;
    }
    if (sub.tab) {
      // Mesma pagina: reaproveita o alternador de abas que a pagina ja tem,
      // em vez de reimplementar troca de aba aqui.
      const alvo = document.querySelector('.tab-btn[data-tab="' + sub.tab + '"]');
      if (alvo) alvo.click();
      // pushState (nao replace) para o voltar/avancar do navegador funcionar.
      if (window.location.hash !== '#' + sub.tab) {
        history.pushState(null, '', '#' + sub.tab);
      }
    }
    sincronizarAtiva();
  }

  function sincronizarAtiva() {
    const secao = document.querySelector('.menu-gestao-secao');
    if (!secao) return;
    const atual = paginaAtual();
    const ativaDom = document.querySelector('.content > .tab-content.active');
    const tabAtiva = ativaDom ? ativaDom.id : null;

    secao.querySelectorAll('[data-subarea]').forEach((botao) => {
      const sub = SUBAREAS.find((s) => s.id === botao.dataset.subarea);
      if (!sub) return;
      // Subarea sem `tab` representa a pagina inteira (Cadastros, Relatorios,
      // Jornadas): fica ativa sempre que estamos nela.
      const ativa = sub.pagina === atual && (!sub.tab || sub.tab === tabAtiva);
      botao.classList.toggle('active', ativa);
    });
  }

  // Aba que a pagina abre por padrao (a marcada como active no HTML). Guardada
  // ANTES de qualquer troca para que o voltar do navegador ate o estado sem
  // hash consiga restaurar o ponto de partida - sem isso a URL voltava mas o
  // conteudo ficava na aba anterior.
  let abaPadrao = null;

  function aplicarHash() {
    const tab = (window.location.hash || '').replace('#', '');
    const destino = tab || abaPadrao;
    if (!destino) return sincronizarAtiva();
    const ativaAgora = document.querySelector('.content > .tab-content.active');
    if (ativaAgora && ativaAgora.id === destino) return sincronizarAtiva();
    const alvo = document.querySelector('.tab-btn[data-tab="' + destino + '"]');
    if (alvo) alvo.click();
    sincronizarAtiva();
  }

  //--------------------------------------------------------------- inicio
  function iniciar() {
    const fonte = (typeof window.obterModulos === 'function')
      ? window.obterModulos()
      : Promise.resolve(JSON.parse(localStorage.getItem('userData') || 'null'));

    Promise.resolve(fonte).then((info) => {
      const modulos = (info && info.modulos) || null;
      if (!modulos) return;
      const inicial = document.querySelector('.content > .tab-content.active');
      abaPadrao = inicial ? inicial.id : null;
      montarMenuLateral(modulos);
      aplicarHash();

      // Qualquer troca de aba da pagina (menu lateral, atalhos internos)
      // reflete na secao de Gestao - o estado ativo nunca fica mentindo.
      document.querySelectorAll('.tab-btn[data-tab]').forEach((botao) => {
        botao.addEventListener('click', () => setTimeout(sincronizarAtiva, 0));
      });
    }).catch(() => { /* sem permissoes carregadas: pagina segue sem a secao */ });
  }

  window.addEventListener('hashchange', aplicarHash);
  window.addEventListener('popstate', () => setTimeout(aplicarHash, 0));

  window.GestaoNav = { SUBAREAS: SUBAREAS, permitidas: permitidas, primeiraPermitida: primeiraPermitida };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
