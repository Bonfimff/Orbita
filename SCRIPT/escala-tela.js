//======================================================================================================
// ESCALA DA INTERFACE (carregado no <head> de todas as páginas, antes do resto)
// Notebook e tablet deitado: a interface inteira fica em 80% para caber bem na tela.
// Telas grandes (1800px ou mais) e celular/tablet em pé: 100%.
// O "Tamanho do texto" das Configurações aumenta tudo junto, em até 3 níveis (+10% cada).
// O fator vai para a variável --zv (zoom do body); as alturas em vh do CSS dividem por ele.
//======================================================================================================
(function () {
  'use strict';

  const CHAVE = 'kernel.pref.texto'; // '0' a '3' (antigo: 'normal' = 0, 'grande' = 1)

  function nivel() {
    let v = null;
    try { v = localStorage.getItem(CHAVE); } catch (e) { /* sem armazenamento */ }
    if (v === 'grande') return 1;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 0;
  }

  function base() {
    const w = window.innerWidth;
    return w >= 1024 && w < 1800 ? 0.8 : 1;
  }

  function fator() { return Math.round(base() * (1 + 0.1 * nivel()) * 100) / 100; }

  function aplicar() {
    document.documentElement.style.setProperty('--zv', String(fator()));
  }

  aplicar();
  window.addEventListener('resize', aplicar);
  window.KernelEscala = { aplicar, fator, nivel, CHAVE };
})();
