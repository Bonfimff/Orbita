//======================================================================================================
// PROTEÇÃO CONTRA PRINT (crachá e página do QR)
// Nenhuma página consegue impedir de verdade uma captura de tela: ela é feita
// pelo sistema, fora do navegador. Aqui só se dificulta e se marca:
//  - o conteúdo some quando a página perde o foco (troca de app, alternador
//    de janelas, ferramentas de recorte);
//  - a tecla Print Screen esconde o conteúdo e apaga a área de transferência;
//  - imprimir sai em branco; seleção e menu do botão direito ficam desligados;
//  - uma marca d'água com data e hora identifica de quando é a imagem.
//
// Uso: ProtecaoPrint.proteger(elemento, { marca: 'texto da marca' }) -> desligar()
//======================================================================================================
(function () {
  'use strict';

  function proteger(alvo, opcoes) {
    if (!alvo) return () => {};
    alvo.classList.add('protegido-print');

    const marca = document.createElement('div');
    marca.className = 'protegido-marca';
    marca.setAttribute('aria-hidden', 'true');
    const texto = (opcoes && opcoes.marca) || ('KERNEL · ' + new Date().toLocaleString('pt-BR'));
    marca.innerHTML = Array.from({ length: 14 }, () => `<span>${texto}</span>`).join('');
    alvo.appendChild(marca);

    const capa = document.createElement('div');
    capa.className = 'protegido-capa';
    capa.textContent = 'Conteúdo protegido. Volte para esta tela para ver o crachá.';
    alvo.appendChild(capa);

    const esconder = () => alvo.classList.add('protegido-oculto');
    const mostrar = () => alvo.classList.remove('protegido-oculto');
    const visibilidade = () => (document.hidden ? esconder() : mostrar());
    const tecla = (e) => {
      // Copiar, imprimir, salvar e selecionar tudo ficam bloqueados.
      const k = String(e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ['c', 'p', 's', 'a', 'x', 'u'].includes(k) && !(campo(e.target) && k !== 'p' && k !== 's')) {
        e.preventDefault();
        return;
      }
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        esconder();
        try { navigator.clipboard && navigator.clipboard.writeText(''); } catch (err) { /* sem permissão */ }
        setTimeout(mostrar, 1500);
      }
    };
    const campo = (el) => el && el.closest && el.closest('input, textarea, select');
    const bloquear = (e) => { if (alvo.contains(e.target) && !campo(e.target)) e.preventDefault(); };

    // Só mostra com a página em primeiro plano e com foco (ferramentas de
    // recorte tiram o foco antes de capturar).
    if (!document.hasFocus()) esconder();
    const vigia = setInterval(() => { if (!document.hasFocus() || document.hidden) esconder(); }, 300);
    window.addEventListener('blur', esconder);
    window.addEventListener('pagehide', esconder);
    window.addEventListener('focus', mostrar);
    document.addEventListener('visibilitychange', visibilidade);
    document.addEventListener('keyup', tecla);
    document.addEventListener('keydown', tecla);
    document.addEventListener('contextmenu', bloquear);
    document.addEventListener('copy', bloquear);
    document.addEventListener('dragstart', bloquear);
    document.addEventListener('cut', bloquear);
    document.addEventListener('selectstart', bloquear);

    return function desligar() {
      clearInterval(vigia);
      window.removeEventListener('pagehide', esconder);
      window.removeEventListener('blur', esconder);
      window.removeEventListener('focus', mostrar);
      document.removeEventListener('visibilitychange', visibilidade);
      document.removeEventListener('keyup', tecla);
      document.removeEventListener('keydown', tecla);
      document.removeEventListener('contextmenu', bloquear);
      document.removeEventListener('copy', bloquear);
      document.removeEventListener('dragstart', bloquear);
      document.removeEventListener('cut', bloquear);
      document.removeEventListener('selectstart', bloquear);
    };
  }

  // Estilo próprio, para funcionar também na página pública do QR.
  if (!document.getElementById('protecao-print-estilo')) {
    const estilo = document.createElement('style');
    estilo.id = 'protecao-print-estilo';
    estilo.textContent = `
      .protegido-print { position: relative; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
      .protegido-print input, .protegido-print textarea, .protegido-print select { -webkit-user-select: text; user-select: text; }
      .protegido-print img { -webkit-user-drag: none; pointer-events: auto; }
      .protegido-marca { position: absolute; inset: 0; z-index: 5; pointer-events: none; overflow: hidden;
        display: flex; flex-wrap: wrap; align-content: flex-start; gap: 34px 26px; padding: 18px; transform: rotate(-24deg) scale(1.4);
        opacity: .07; color: #1F2D3D; font: 700 11px/1 Inter, system-ui, sans-serif; white-space: nowrap; }
      .protegido-capa { display: none; position: absolute; inset: 0; z-index: 6; align-items: center; justify-content: center;
        padding: 24px; background: #1F2D3D; color: #fff; font: 600 14px/1.4 Inter, system-ui, sans-serif; text-align: center; }
      .protegido-oculto > .protegido-capa { display: flex; }
      @media print { .protegido-print { visibility: hidden !important; } body * { visibility: hidden !important; } }
    `;
    document.head.appendChild(estilo);
  }

  window.ProtecaoPrint = { proteger };
})();
