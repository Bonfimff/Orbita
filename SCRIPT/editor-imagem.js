//======================================================================================================
// EDITOR DE IMAGEM (padrão do sistema)
// Cortar, escolher o formato e retirar o fundo antes de salvar a imagem de um item.
//  - Formato: Retrato 3:4 (recomendado, 600x800), Quadrado 1:1, Paisagem 4:3 ou Livre.
//  - Retirar fundo: automático (a partir das bordas da foto) ou "Selecionar fundo" e clicar na cor.
//  - Tolerância ajusta o quanto de cor parecida entra na seleção; Desfazer volta um passo.
// Uso: const dataUrl = await EditorImagem.abrir(arquivo);   // null se cancelar
// Também: EditorImagem.ampliar(src, titulo) abre a imagem em tela cheia.
//======================================================================================================
(function () {
  'use strict';

  const FORMATOS = {
    retrato: { rotulo: 'Retrato 3:4', razao: 3 / 4, saida: [600, 800] },
    quadrado: { rotulo: 'Quadrado 1:1', razao: 1, saida: [800, 800] },
    paisagem: { rotulo: 'Paisagem 4:3', razao: 4 / 3, saida: [800, 600] },
    livre: { rotulo: 'Livre', razao: null, saida: null },
  };
  const MAX_LADO = 1600;

  function carregar(arquivo) {
    return new Promise((ok, erro) => {
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(img.src); ok(img); };
      img.onerror = () => erro(new Error('Não foi possível abrir esta imagem.'));
      img.src = URL.createObjectURL(arquivo);
    });
  }

  function ampliar(src, titulo) {
    const fundo = document.createElement('div');
    fundo.className = 'ei-ampliar';
    fundo.innerHTML = '<button type="button" class="ei-ampliar-fechar" aria-label="Fechar">&times;</button><img alt="">';
    fundo.querySelector('img').src = src;
    fundo.querySelector('img').alt = titulo || 'Imagem do item';
    const fechar = () => { fundo.remove(); document.removeEventListener('keydown', tecla); };
    const tecla = (e) => { if (e.key === 'Escape') fechar(); };
    fundo.addEventListener('click', (e) => { if (e.target === fundo || e.target.closest('.ei-ampliar-fechar')) fechar(); });
    document.addEventListener('keydown', tecla);
    document.body.appendChild(fundo);
  }

  async function abrir(arquivo) {
    const img = await carregar(arquivo);
    const k = Math.min(1, MAX_LADO / Math.max(img.naturalWidth, img.naturalHeight));
    const W = Math.round(img.naturalWidth * k);
    const H = Math.round(img.naturalHeight * k);
    const trab = document.createElement('canvas');
    trab.width = W; trab.height = H;
    const tctx = trab.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(img, 0, 0, W, H);

    return new Promise((resolver) => {
      const fundo = document.createElement('div');
      fundo.className = 'ei-fundo';
      fundo.innerHTML = `
        <div class="ei-janela" role="dialog" aria-modal="true" aria-label="Editar imagem">
          <header class="ei-topo"><strong>Editar imagem</strong><button type="button" class="ei-x" aria-label="Fechar">&times;</button></header>
          <div class="ei-area"><canvas class="ei-tela"></canvas></div>
          <div class="ei-controles">
            <div class="ei-grupo">
              <span class="ei-rotulo">Formato</span>
              <div class="ei-formatos">${Object.keys(FORMATOS).map((f) => `<button type="button" data-formato="${f}">${FORMATOS[f].rotulo}</button>`).join('')}</div>
            </div>
            <div class="ei-grupo">
              <span class="ei-rotulo">Fundo</span>
              <div class="ei-formatos">
                <button type="button" data-acao="auto">Retirar fundo</button>
                <button type="button" data-acao="selecionar">Selecionar fundo</button>
                <button type="button" data-acao="desfazer" disabled>Desfazer</button>
              </div>
              <label class="ei-tolerancia">Tolerância <input type="range" min="4" max="90" value="32"></label>
              <span class="ei-dica" hidden>Clique na cor do fundo para retirar.</span>
            </div>
          </div>
          <footer class="ei-rodape">
            <button type="button" class="btn-secundario" data-acao="cancelar">Cancelar</button>
            <button type="button" class="btn-primario" data-acao="usar">Usar imagem</button>
          </footer>
        </div>`;
      document.body.appendChild(fundo);
      const tela = fundo.querySelector('.ei-tela');
      const ctx = tela.getContext('2d');
      const area = fundo.querySelector('.ei-area');
      const tol = fundo.querySelector('.ei-tolerancia input');
      const dica = fundo.querySelector('.ei-dica');
      const btnDesfazer = fundo.querySelector('[data-acao="desfazer"]');
      const pilha = [];
      let formato = 'retrato';
      let selecionando = false;
      let escala = 1;
      let corte = null; // em pixels da imagem de trabalho
      let arraste = null;

      // Fundo quadriculado: mostra o que ficou transparente.
      const xadrez = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 16;
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 16, 16);
        x.fillStyle = '#e5e7eb'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8);
        return ctx.createPattern(c, 'repeat');
      })();

      function corteInicial() {
        const r = FORMATOS[formato].razao;
        if (!r) { corte = { x: 0, y: 0, w: W, h: H }; return; }
        let w = W, h = W / r;
        if (h > H) { h = H; w = H * r; }
        corte = { x: (W - w) / 2, y: (H - h) / 2, w, h };
      }

      function medir() {
        const maxW = Math.max(200, area.clientWidth - 8);
        const maxH = Math.max(200, area.clientHeight - 8);
        escala = Math.min(maxW / W, maxH / H, 1);
        tela.width = Math.round(W * escala);
        tela.height = Math.round(H * escala);
        desenhar();
      }

      function desenhar() {
        ctx.save();
        ctx.fillStyle = xadrez; ctx.fillRect(0, 0, tela.width, tela.height);
        ctx.drawImage(trab, 0, 0, tela.width, tela.height);
        const c = { x: corte.x * escala, y: corte.y * escala, w: corte.w * escala, h: corte.h * escala };
        ctx.fillStyle = 'rgba(15,23,42,.45)';
        ctx.beginPath(); ctx.rect(0, 0, tela.width, tela.height); ctx.rect(c.x, c.y, c.w, c.h); ctx.fill('evenodd');
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
        ctx.fillStyle = '#fff';
        [[c.x, c.y], [c.x + c.w, c.y], [c.x, c.y + c.h], [c.x + c.w, c.y + c.h]].forEach(([x, y]) => ctx.fillRect(x - 6, y - 6, 12, 12));
        ctx.restore();
      }

      function ponto(e) {
        const r = tela.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
      }

      function canto(p) {
        const raio = 18 * (W / tela.getBoundingClientRect().width);
        const cs = { nw: [corte.x, corte.y], ne: [corte.x + corte.w, corte.y], sw: [corte.x, corte.y + corte.h], se: [corte.x + corte.w, corte.y + corte.h] };
        return Object.keys(cs).find((k) => Math.abs(p.x - cs[k][0]) < raio && Math.abs(p.y - cs[k][1]) < raio) || null;
      }

      function limitar() {
        corte.w = Math.max(20, Math.min(corte.w, W));
        corte.h = Math.max(20, Math.min(corte.h, H));
        corte.x = Math.max(0, Math.min(corte.x, W - corte.w));
        corte.y = Math.max(0, Math.min(corte.y, H - corte.h));
      }

      tela.addEventListener('pointerdown', (e) => {
        const p = ponto(e);
        if (selecionando) { retirarDe([[Math.floor(p.x), Math.floor(p.y)]]); return; }
        const c = canto(p);
        const dentro = p.x > corte.x && p.x < corte.x + corte.w && p.y > corte.y && p.y < corte.y + corte.h;
        if (!c && !dentro) return;
        arraste = { c, p0: p, corte0: Object.assign({}, corte) };
        tela.setPointerCapture(e.pointerId);
      });
      tela.addEventListener('pointermove', (e) => {
        const p = ponto(e);
        if (!arraste) {
          tela.style.cursor = selecionando ? 'crosshair' : (canto(p) ? 'nwse-resize' : 'move');
          return;
        }
        const dx = p.x - arraste.p0.x, dy = p.y - arraste.p0.y, a = arraste.corte0;
        if (!arraste.c) { corte.x = a.x + dx; corte.y = a.y + dy; }
        else {
          const r = FORMATOS[formato].razao;
          const esq = arraste.c.includes('w'), cima = arraste.c.includes('n');
          let w = a.w + (esq ? -dx : dx);
          let h = r ? w / r : a.h + (cima ? -dy : dy);
          w = Math.max(20, w); h = Math.max(20, h);
          if (r && (w > W || h > H)) { const f = Math.min(W / w, H / h); w *= f; h *= f; }
          corte.w = w; corte.h = h;
          corte.x = esq ? a.x + a.w - w : a.x;
          corte.y = cima ? a.y + a.h - h : a.y;
        }
        limitar();
        desenhar();
      });
      const soltar = () => { arraste = null; };
      tela.addEventListener('pointerup', soltar);
      tela.addEventListener('pointercancel', soltar);

      // Retira (deixa transparente) a região de cor parecida ligada aos pontos de partida.
      function retirarDe(sementes) {
        const dados = tctx.getImageData(0, 0, W, H);
        const px = dados.data;
        pilha.push(tctx.getImageData(0, 0, W, H));
        if (pilha.length > 12) pilha.shift();
        btnDesfazer.disabled = false;
        const limite = Number(tol.value);
        const visto = new Uint8Array(W * H);
        const fila = [];
        sementes.forEach(([x, y]) => {
          if (x < 0 || y < 0 || x >= W || y >= H) return;
          const i = y * W + x;
          if (px[i * 4 + 3] === 0) return;
          fila.push([i, px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
        });
        while (fila.length) {
          const [i, r0, g0, b0] = fila.pop();
          if (visto[i]) continue;
          const o = i * 4;
          const dist = Math.abs(px[o] - r0) + Math.abs(px[o + 1] - g0) + Math.abs(px[o + 2] - b0);
          if (px[o + 3] !== 0 && dist > limite * 3) continue;
          visto[i] = 1;
          px[o + 3] = 0;
          const x = i % W, y = (i - x) / W;
          if (x > 0) fila.push([i - 1, r0, g0, b0]);
          if (x < W - 1) fila.push([i + 1, r0, g0, b0]);
          if (y > 0) fila.push([i - W, r0, g0, b0]);
          if (y < H - 1) fila.push([i + W, r0, g0, b0]);
        }
        tctx.putImageData(dados, 0, 0);
        desenhar();
      }

      function retirarAutomatico() {
        // Parte de vários pontos das bordas: fundos lisos de foto de produto saem de uma vez.
        const s = [];
        const passo = Math.max(4, Math.round(Math.min(W, H) / 24));
        for (let x = 0; x < W; x += passo) { s.push([x, 0], [x, H - 1]); }
        for (let y = 0; y < H; y += passo) { s.push([0, y], [W - 1, y]); }
        retirarDe(s);
      }

      function exportar() {
        const f = FORMATOS[formato];
        let [ow, oh] = f.saida || [0, 0];
        if (!f.saida) { const k2 = 800 / Math.max(corte.w, corte.h); ow = Math.round(corte.w * k2); oh = Math.round(corte.h * k2); }
        const saida = document.createElement('canvas');
        saida.width = ow; saida.height = oh;
        const sctx = saida.getContext('2d');
        sctx.imageSmoothingQuality = 'high';
        sctx.drawImage(trab, corte.x, corte.y, corte.w, corte.h, 0, 0, ow, oh);
        // Com transparência: PNG; sem: JPG (arquivo bem menor).
        const a = sctx.getImageData(0, 0, ow, oh).data;
        let transparente = false;
        for (let i = 3; i < a.length; i += 4) { if (a[i] < 250) { transparente = true; break; } }
        return transparente ? saida.toDataURL('image/png') : saida.toDataURL('image/jpeg', 0.9);
      }

      function marcarFormato() {
        fundo.querySelectorAll('[data-formato]').forEach((b) => b.classList.toggle('ativo', b.dataset.formato === formato));
      }

      function fechar(valor) {
        window.removeEventListener('resize', medir);
        fundo.remove();
        resolver(valor);
      }

      fundo.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.classList.contains('ei-x') || b.dataset.acao === 'cancelar') fechar(null);
        else if (b.dataset.acao === 'usar') fechar(exportar());
        else if (b.dataset.formato) { formato = b.dataset.formato; marcarFormato(); corteInicial(); desenhar(); }
        else if (b.dataset.acao === 'auto') retirarAutomatico();
        else if (b.dataset.acao === 'selecionar') {
          selecionando = !selecionando;
          b.classList.toggle('ativo', selecionando);
          dica.hidden = !selecionando;
        } else if (b.dataset.acao === 'desfazer' && pilha.length) {
          tctx.putImageData(pilha.pop(), 0, 0);
          btnDesfazer.disabled = !pilha.length;
          desenhar();
        }
      });

      corteInicial();
      marcarFormato();
      window.addEventListener('resize', medir);
      requestAnimationFrame(medir);
    });
  }

  window.EditorImagem = { abrir, ampliar, FORMATOS };
})();
