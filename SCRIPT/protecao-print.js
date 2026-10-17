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
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        esconder();
        try { navigator.clipboard && navigator.clipboard.writeText(''); } catch (err) { /* sem permissão */ }
        setTimeout(mostrar, 1500);
      }
    };
    const bloquear = (e) => { if (alvo.contains(e.target)) e.preventDefault(); };

    window.addEventListener('blur', esconder);
    window.addEventListener('focus', mostrar);
    document.addEventListener('visibilitychange', visibilidade);
    document.addEventListener('keyup', tecla);
    document.addEventListener('keydown', tecla);
    document.addEventListener('contextmenu', bloquear);
    document.addEventListener('copy', bloquear);
    document.addEventListener('dragstart', bloquear);

    return function desligar() {
      window.removeEventListener('blur', esconder);
      window.removeEventListener('focus', mostrar);
      document.removeEventListener('visibilitychange', visibilidade);
      document.removeEventListener('keyup', tecla);
      document.removeEventListener('keydown', tecla);
      document.removeEventListener('contextmenu', bloquear);
      document.removeEventListener('copy', bloquear);
      document.removeEventListener('dragstart', bloquear);
    };
  }

  // Estilo próprio, para funcionar também na página pública do QR.
  if (!document.getElementById('protecao-print-estilo')) {
    const estilo = document.createElement('style');
    estilo.id = 'protecao-print-estilo';
    estilo.textContent = `
      .protegido-print { position: relative; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
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
