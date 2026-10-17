//======================================================================================================
// ATALHO PARA SUBABAS DE QUALQUER MÓDULO
// - Endereço com #subaba abre a subaba direto (ex.: frota.html#checklist).
// - Computador: passar o mouse (ou o foco do teclado) num módulo do topo mostra
//   as subabas dele; um clique leva direto para a subaba.
// - Celular: na gaveta, cada módulo ganha uma seta que expande as subabas
//   sem precisar abrir o módulo antes.
// A lista segue a ordem dos menus de cada página. Gestão usa as subáreas
// permitidas de SCRIPT/gestao-nav.js.
//======================================================================================================
(function () {
  'use strict';

  const MAPA = {
    ordens: { pagina: 'ordens.html', abas: [
      ['gerenciamento', 'Painel Geral'], ['cronograma', 'Cronograma'], ['busca', 'Busca'],
      ['bases', 'Bases e Equipamentos'], ['cadastros', 'Cadastros']] },
    almoxarifado: { pagina: 'almoxarifado.html', abas: [
      ['gerenciamento', 'Painel Geral'], ['movimentacoes', 'Movimentações'], ['busca', 'Busca'], ['requisitantes', 'Cadastros']] },
    frota: { pagina: 'frota.html', abas: [
      ['gerenciamento', 'Painel Geral'], ['veiculos', 'Veículos'], ['checklist', 'Checklists'],
      ['abastecimento', 'Abastecimentos'], ['manutencao', 'Manutenções'],
      ['relatorios', 'Relatórios', 'frota_relatorios:ver'], ['cadastros', 'Cadastros']] },
    jornada: { pagina: 'jornada.html', abas: [['meu-painel', 'Meu Ponto']] },
  };

  let modulosInfo = null;
  const paginaAtual = () => (location.pathname.split('/').pop() || '');
  const pode = (perm) => {
    if (!perm || typeof window.temPermissao !== 'function') return true;
    const [c, a] = perm.split(':');
    return window.temPermissao(c, a);
  };

  function subabasDe(modulo) {
    if (modulo === 'gestao') {
      const nav = window.GestaoNav;
      if (!nav || !modulosInfo) return [];
      return nav.permitidas(modulosInfo).map((s) => ({
        rotulo: s.rotulo, pagina: s.pagina, aba: s.tab || '',
      }));
    }
    const m = MAPA[modulo];
    if (!m) return [];
    return m.abas.filter((a) => pode(a[2])).map(([aba, rotulo]) => ({ rotulo, pagina: m.pagina, aba }));
  }

  function hrefDe(item) {
    return item.pagina + (item.aba ? '#' + item.aba : '');
  }

  // Mesma página: troca de aba sem recarregar.
  function irPara(item, ev) {
    if (item.pagina !== paginaAtual()) return;
    const botao = item.aba && document.querySelector('.tab-btn[data-tab="' + item.aba + '"]');
    if (!botao) return;
    if (ev) ev.preventDefault();
    botao.click();
    if (item.aba) history.replaceState(null, '', '#' + item.aba);
    fecharFlutuante();
    if (typeof window.fecharDrawer === 'function') window.fecharDrawer();
  }

  function listaHtml(itens, classe) {
    return itens.map((i, n) => `<a class="${classe}" href="${hrefDe(i)}" data-sub-idx="${n}">${i.rotulo}</a>`).join('');
  }

  // ---------------------------------------------------------- abrir pelo endereço
  function abrirPeloEndereco() {
    const aba = decodeURIComponent((location.hash || '').slice(1));
    if (!aba || !/^[\w-]+$/.test(aba)) return;
    const botao = document.querySelector('.tab-btn[data-tab="' + aba + '"]');
    if (botao && !botao.classList.contains('active')) botao.click();
  }

  // ---------------------------------------------------------- computador: menu flutuante
  let flutuante = null;
  let temporizador = null;

  function fecharFlutuante() {
    clearTimeout(temporizador);
    if (flutuante) flutuante.hidden = true;
  }

  function mostrarFlutuante(aba) {
    const modulo = aba.id.replace(/-tab$/, '');
    const itens = subabasDe(modulo);
    if (!itens.length || window.matchMedia('(max-width: 768px)').matches) return;
    clearTimeout(temporizador);
    if (!flutuante) {
      flutuante = document.createElement('div');
      flutuante.className = 'subabas-flutuante';
      flutuante.setAttribute('role', 'menu');
      flutuante.addEventListener('mouseenter', () => clearTimeout(temporizador));
      flutuante.addEventListener('mouseleave', () => { temporizador = setTimeout(fecharFlutuante, 180); });
      document.body.appendChild(flutuante);
    }
    flutuante.innerHTML = listaHtml(itens, 'subabas-flutuante-item');
    flutuante.querySelectorAll('[data-sub-idx]').forEach((a) => {
      a.setAttribute('role', 'menuitem');
      a.addEventListener('click', (ev) => irPara(itens[Number(a.dataset.subIdx)], ev));
    });
    const r = aba.getBoundingClientRect();
    flutuante.hidden = false;
    const largura = flutuante.offsetWidth;
    flutuante.style.top = Math.round(r.bottom + 6) + 'px';
    flutuante.style.left = Math.round(Math.min(Math.max(8, r.left + r.width / 2 - largura / 2), window.innerWidth - largura - 8)) + 'px';
  }

  function ligarTopo() {
    document.querySelectorAll('.top-bar-right .top-tab').forEach((aba) => {
      aba.setAttribute('aria-haspopup', 'menu');
      aba.addEventListener('mouseenter', () => { if (!aba.classList.contains('modulo-oculto')) mostrarFlutuante(aba); });
      aba.addEventListener('mouseleave', () => { temporizador = setTimeout(fecharFlutuante, 180); });
      aba.addEventListener('focus', () => { if (!aba.classList.contains('modulo-oculto')) mostrarFlutuante(aba); });
      aba.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' && flutuante && !flutuante.hidden) {
          e.preventDefault();
          flutuante.querySelector('a')?.focus();
        }
      });
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharFlutuante(); });
    document.addEventListener('focusin', (e) => {
      if (flutuante && !flutuante.hidden && !flutuante.contains(e.target) && !e.target.closest('.top-bar-right .top-tab')) fecharFlutuante();
    });
    window.addEventListener('scroll', fecharFlutuante, { passive: true });
  }

  // ---------------------------------------------------------- celular: expandir na gaveta
  function ligarGaveta() {
    const secao = document.querySelector('.menu-modulos');
    if (!secao || secao.dataset.subabasProntas) return;
    secao.dataset.subabasProntas = '1';
    secao.querySelectorAll('[data-modulo-ref]').forEach((clone) => {
      if (clone.classList.contains('com-submenu')) return; // módulo atual já mostra as abas
      const modulo = clone.dataset.moduloRef.replace(/-tab$/, '');
      const itens = subabasDe(modulo);
      if (!itens.length) return;
      const linha = document.createElement('div');
      linha.className = 'menu-modulo-linha';
      clone.before(linha);
      linha.appendChild(clone);
      const seta = document.createElement('button');
      seta.type = 'button';
      seta.className = 'menu-modulo-expandir';
      seta.setAttribute('aria-expanded', 'false');
      seta.setAttribute('aria-label', 'Ver subabas de ' + clone.textContent.trim());
      linha.appendChild(seta);
      const lista = document.createElement('div');
      lista.className = 'menu-modulo-subabas';
      lista.hidden = true;
      lista.innerHTML = listaHtml(itens, 'menu-modulo-subaba');
      linha.after(lista);
      seta.addEventListener('click', (e) => {
        e.stopPropagation();
        lista.hidden = !lista.hidden;
        seta.setAttribute('aria-expanded', lista.hidden ? 'false' : 'true');
      });
      // Acompanha o módulo quando as permissões o escondem.
      new MutationObserver(() => {
        const oculto = clone.classList.contains('modulo-oculto');
        linha.classList.toggle('modulo-oculto', oculto);
        if (oculto) lista.hidden = true;
      }).observe(clone, { attributes: true, attributeFilter: ['class'] });
      linha.classList.toggle('modulo-oculto', clone.classList.contains('modulo-oculto'));
    });
  }

  function iniciar() {
    if (!localStorage.getItem('token')) return;
    ligarTopo();
    const pronto = (info) => {
      modulosInfo = (info && info.modulos) || null;
      ligarGaveta();
      // Depois que cada página ligou as próprias abas.
      setTimeout(abrirPeloEndereco, 250);
    };
    if (typeof window.obterModulos === 'function') window.obterModulos().then(pronto, () => pronto(null));
    else pronto(null);
    window.addEventListener('hashchange', abrirPeloEndereco);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 0));
  else setTimeout(iniciar, 0);
})();
