//======================================================================================================
// EDITOR DE IMAGEM (padrão do sistema)
// Imagem sempre quadrada (800 x 800, PNG com fundo transparente).
// Recorte do fundo por separação de objeto (GrabCut, OpenCV.js), guiado pelo usuário:
//  - Ao abrir, o recorte roda sozinho supondo o item no centro da foto.
//  - "Marcar o item": desenhar um retângulo em volta do item e o recorte é refeito.
//  - Pincéis "Manter" e "Retirar": pintar por cima do que ficou errado; o recorte é refeito.
//  - Borda suavizada; "Desfazer" volta um passo e "Foto original" devolve a foto sem recorte.
// O item pode ser diminuído ou aumentado dentro do quadro (controle ou roda do mouse) e arrastado.
// Uso: const dataUrl = await EditorImagem.abrir(arquivo);   // null se cancelar
// Também: EditorImagem.ampliar(src, titulo) abre a imagem em tela cheia.
//======================================================================================================
(function () {
  'use strict';

  const MAX_LADO = 1600;      // foto de trabalho
  const LADO_CALCULO = 640;   // o recorte é calculado nesta escala (rápido) e aplicado na foto inteira
  const LADO_SAIDA = 800;
  const OPENCV = 'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js';
  let opencv = null;

  // O módulo do OpenCV é "thenable" e se resolve nele mesmo: nunca usar await/resolve direto nele
  // (vira laço infinito). A promessa entrega um envelope { cv }.
  function carregarOpenCV() {
    if (opencv) return opencv;
    opencv = new Promise((ok, erro) => {
      const pronto = () => {
        const c = window.cv;
        if (!c) return erro(new Error('Recorte de fundo indisponível.'));
        if (c.Mat) return ok({ cv: c });
        c.onRuntimeInitialized = () => ok({ cv: c });
      };
      if (window.cv) { pronto(); return; }
      const s = document.createElement('script');
      s.src = OPENCV;
      s.async = true;
      s.onload = pronto;
      s.onerror = () => { opencv = null; erro(new Error('Não foi possível carregar o recorte de fundo. Verifique a internet.')); };
      document.head.appendChild(s);
    });
    return opencv;
  }

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
    const trab = document.createElement('canvas');            // foto com o recorte aplicado
    trab.width = W; trab.height = H;
    const tctx = trab.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(img, 0, 0, W, H);
    const original = tctx.getImageData(0, 0, W, H);

    // Escala de cálculo
    const kc = Math.min(1, LADO_CALCULO / Math.max(W, H));
    const w = Math.max(1, Math.round(W * kc)), h = Math.max(1, Math.round(H * kc));
    const peq = document.createElement('canvas'); peq.width = w; peq.height = h;
    const pctx = peq.getContext('2d', { willReadFrequently: true });
    pctx.drawImage(trab, 0, 0, w, h);
    const peqDados = pctx.getImageData(0, 0, w, h);
    // Pinceladas do usuário (verde = manter, vermelho = retirar), na escala de cálculo
    const tracos = document.createElement('canvas'); tracos.width = w; tracos.height = h;
    const rctx = tracos.getContext('2d', { willReadFrequently: true });

    return new Promise((resolver) => {
      const fundo = document.createElement('div');
      fundo.className = 'ei-fundo';
      fundo.innerHTML = `
        <div class="ei-janela" role="dialog" aria-modal="true" aria-label="Editar imagem">
          <header class="ei-topo"><strong>Editar imagem</strong><button type="button" class="ei-x" aria-label="Fechar">&times;</button></header>
          <div class="ei-area"><canvas class="ei-tela"></canvas><div class="ei-ocupado" hidden>Retirando o fundo...</div></div>
          <div class="ei-controles">
            <div class="ei-grupo">
              <span class="ei-rotulo">Fundo</span>
              <div class="ei-formatos">
                <button type="button" data-ferramenta="foco">Marcar o item</button>
                <button type="button" data-ferramenta="manter">Pincel manter</button>
                <button type="button" data-ferramenta="retirar">Pincel retirar</button>
              </div>
              <div class="ei-formatos">
                <button type="button" data-acao="desfazer" disabled>Desfazer</button>
                <button type="button" data-acao="original">Foto original</button>
              </div>
              <label class="ei-tolerancia">Pincel <input type="range" class="ei-pincel" min="4" max="60" value="18"></label>
              <span class="ei-dica"></span>
            </div>
            <div class="ei-grupo ei-grupo-largo">
              <span class="ei-rotulo">Tamanho do item no quadro</span>
              <label class="ei-tolerancia"><span>Menor</span><input type="range" class="ei-zoom" min="20" max="400" value="100"><span>Maior</span></label>
              <div class="ei-formatos"><button type="button" data-acao="centralizar">Centralizar</button></div>
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
      const zoom = fundo.querySelector('.ei-zoom');
      const pincel = fundo.querySelector('.ei-pincel');
      const dica = fundo.querySelector('.ei-dica');
      const ocupado = fundo.querySelector('.ei-ocupado');
      const btnDesfazer = fundo.querySelector('[data-acao="desfazer"]');
      const DICAS = {
        '': 'Arraste para posicionar o item. Use as ferramentas acima para corrigir o recorte.',
        foco: 'Desenhe um retângulo em volta do item que deve ficar.',
        manter: 'Pinte sobre partes do item que sumiram. O recorte é refeito ao soltar.',
        retirar: 'Pinte sobre o fundo que ficou. O recorte é refeito ao soltar.',
      };
      let ferramenta = '';
      let cx = 0.5, cy = 0.5, z = 1;     // posição e escala da foto no quadro
      let arraste = null;
      let caixaFoco = null;               // retângulo em desenho (coordenadas da foto)
      let mascara = null;                 // cv.Mat do GrabCut (escala de cálculo)
      let ultimoRet = null;
      const pilha = [];
      let cv = null;

      const xadrez = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 16;
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 16, 16);
        x.fillStyle = '#e5e7eb'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8);
        return ctx.createPattern(c, 'repeat');
      })();

      function retangulo(lado) {
        const e = ((lado * 0.9) / Math.max(W, H)) * z;
        const rw = W * e, rh = H * e;
        return { x: cx * lado - rw / 2, y: cy * lado - rh / 2, w: rw, h: rh, e };
      }

      function medir() {
        const lado = Math.max(220, Math.min(area.clientWidth - 16, area.clientHeight - 16));
        tela.width = tela.height = Math.round(lado);
        desenhar();
      }

      function desenhar() {
        ctx.fillStyle = xadrez;
        ctx.fillRect(0, 0, tela.width, tela.height);
        const r = retangulo(tela.width);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(trab, r.x, r.y, r.w, r.h);
        if (ferramenta === 'manter' || ferramenta === 'retirar') {
          ctx.globalAlpha = 0.5; ctx.drawImage(tracos, r.x, r.y, r.w, r.h); ctx.globalAlpha = 1;
        }
        if (caixaFoco) {
          ctx.setLineDash([6, 4]); ctx.strokeStyle = '#A8864F'; ctx.lineWidth = 2;
          ctx.strokeRect(r.x + caixaFoco.x * r.e, r.y + caixaFoco.y * r.e, caixaFoco.w * r.e, caixaFoco.h * r.e);
          ctx.setLineDash([]);
        }
        ctx.strokeStyle = 'rgba(15,23,42,.35)'; ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, tela.width - 1, tela.height - 1);
      }

      function pontoTela(e) {
        const b = tela.getBoundingClientRect();
        return { x: (e.clientX - b.left) * (tela.width / b.width), y: (e.clientY - b.top) * (tela.height / b.height) };
      }
      function pontoFoto(p) {
        const r = retangulo(tela.width);
        return { x: (p.x - r.x) / r.e, y: (p.y - r.y) / r.e };
      }

      function pintar(pf, anterior) {
        rctx.strokeStyle = rctx.fillStyle = ferramenta === 'manter' ? 'rgb(0,200,0)' : 'rgb(220,0,0)';
        rctx.lineCap = 'round';
        const raio = Number(pincel.value) / retangulo(tela.width).e * kc;
        rctx.lineWidth = raio * 2;
        rctx.beginPath();
        const a = anterior || pf;
        rctx.moveTo(a.x * kc, a.y * kc); rctx.lineTo(pf.x * kc, pf.y * kc);
        rctx.stroke();
      }

      tela.addEventListener('pointerdown', (e) => {
        const p = pontoTela(e);
        tela.setPointerCapture(e.pointerId);
        if (ferramenta === 'foco') { const pf = pontoFoto(p); arraste = { foco: pf }; caixaFoco = { x: pf.x, y: pf.y, w: 0, h: 0 }; }
        else if (ferramenta) { const pf = pontoFoto(p); arraste = { ultimo: pf }; pintar(pf); desenhar(); }
        else arraste = { p0: p, cx0: cx, cy0: cy };
      });
      tela.addEventListener('pointermove', (e) => {
        tela.style.cursor = ferramenta ? 'crosshair' : 'grab';
        if (!arraste) return;
        const p = pontoTela(e);
        if (arraste.foco) {
          const pf = pontoFoto(p);
          caixaFoco = { x: Math.min(pf.x, arraste.foco.x), y: Math.min(pf.y, arraste.foco.y), w: Math.abs(pf.x - arraste.foco.x), h: Math.abs(pf.y - arraste.foco.y) };
        } else if (arraste.ultimo) {
          const pf = pontoFoto(p); pintar(pf, arraste.ultimo); arraste.ultimo = pf;
        } else {
          cx = arraste.cx0 + (p.x - arraste.p0.x) / tela.width;
          cy = arraste.cy0 + (p.y - arraste.p0.y) / tela.height;
        }
        desenhar();
      });
      const soltar = () => {
        if (!arraste) return;
        const era = arraste;
        arraste = null;
        if (era.foco && caixaFoco && caixaFoco.w > 8 && caixaFoco.h > 8) {
          const rc = { x: caixaFoco.x * kc, y: caixaFoco.y * kc, w: caixaFoco.w * kc, h: caixaFoco.h * kc };
          caixaFoco = null;
          recortar('ret', rc);
        } else if (era.foco) { caixaFoco = null; desenhar(); }
        else if (era.ultimo) recortar('tracos');
      };
      tela.addEventListener('pointerup', soltar);
      tela.addEventListener('pointercancel', soltar);
      tela.addEventListener('wheel', (e) => {
        e.preventDefault();
        z = Math.max(0.2, Math.min(4, z * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
        zoom.value = Math.round(z * 100);
        desenhar();
      }, { passive: false });
      zoom.addEventListener('input', () => { z = Number(zoom.value) / 100; desenhar(); });

      function guardar() {
        pilha.push({ imagem: tctx.getImageData(0, 0, W, H), mascara: mascara ? mascara.clone() : null, tracos: rctx.getImageData(0, 0, w, h) });
        if (pilha.length > 8) { const v = pilha.shift(); if (v.mascara) v.mascara.delete(); }
        btnDesfazer.disabled = false;
      }

      // Aplica a máscara (escala de cálculo) na foto inteira, com borda suavizada.
      function aplicarMascara() {
        const alfa = new cv.Mat(h, w, cv.CV_8UC1);
        const m = mascara.data, a = alfa.data;
        for (let i = 0; i < m.length; i++) a[i] = (m[i] === 1 || m[i] === 3) ? 255 : 0;
        // Fica só com a maior região do item (some com ilhas soltas do fundo).
        const rotulos = new cv.Mat(), est = new cv.Mat(), cen = new cv.Mat();
        const n = cv.connectedComponentsWithStats(alfa, rotulos, est, cen, 8, cv.CV_32S);
        if (n > 2) {
          let maior = 1, area = 0;
          for (let i = 1; i < n; i++) { const ar = est.intAt(i, cv.CC_STAT_AREA); if (ar > area) { area = ar; maior = i; } }
          const rd = rotulos.data32S;
          for (let i = 0; i < a.length; i++) {
            if (a[i] && rd[i] !== maior && est.intAt(rd[i], cv.CC_STAT_AREA) < area * 0.15) a[i] = 0;
          }
        }
        rotulos.delete(); est.delete(); cen.delete();
        cv.GaussianBlur(alfa, alfa, new cv.Size(3, 3), 0);
        const cinza = new ImageData(w, h);
        for (let i = 0; i < a.length; i++) { const o = i * 4; cinza.data[o] = cinza.data[o + 1] = cinza.data[o + 2] = a[i]; cinza.data[o + 3] = 255; }
        alfa.delete();
        const cm = document.createElement('canvas'); cm.width = w; cm.height = h;
        cm.getContext('2d').putImageData(cinza, 0, 0);
        const grande = document.createElement('canvas'); grande.width = W; grande.height = H;
        const gctx = grande.getContext('2d', { willReadFrequently: true });
        gctx.imageSmoothingQuality = 'high';
        gctx.drawImage(cm, 0, 0, W, H);
        const g = gctx.getImageData(0, 0, W, H).data;
        const saida = new ImageData(new Uint8ClampedArray(original.data), W, H);
        for (let i = 3; i < saida.data.length; i += 4) saida.data[i] = g[i - 3];
        tctx.putImageData(saida, 0, 0);
      }

      async function recortar(modo, rc) {
        ocupado.hidden = false;
        await new Promise((r) => setTimeout(r, 30));
        try {
          cv = cv || (await carregarOpenCV()).cv;
          guardar();
          const src = cv.matFromImageData(peqDados);
          const rgb = new cv.Mat();
          cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
          src.delete();
          const bgd = new cv.Mat(), fgd = new cv.Mat();
          if (modo === 'ret' || !mascara) {
            const r = rc || ultimoRet || { x: w * 0.04, y: h * 0.04, w: w * 0.92, h: h * 0.92 };
            ultimoRet = r;
            if (mascara) mascara.delete();
            mascara = new cv.Mat();
            const ret = new cv.Rect(Math.max(1, Math.round(r.x)), Math.max(1, Math.round(r.y)),
              Math.max(4, Math.min(w - 2, Math.round(r.w))), Math.max(4, Math.min(h - 2, Math.round(r.h))));
            cv.grabCut(rgb, mascara, ret, bgd, fgd, 5, cv.GC_INIT_WITH_RECT);
          }
          if (modo === 'tracos' || modo === 'ret') {
            // Pinceladas valem como certeza: verde = item, vermelho = fundo.
            const t = rctx.getImageData(0, 0, w, h).data;
            const md = mascara.data;
            let tem = false;
            for (let i = 0; i < md.length; i++) {
              const o = i * 4;
              if (t[o + 3] < 40) continue;
              if (t[o + 1] > t[o]) md[i] = cv.GC_FGD; else md[i] = cv.GC_BGD;
              tem = true;
            }
            if (tem) cv.grabCut(rgb, mascara, new cv.Rect(0, 0, 1, 1), bgd, fgd, 3, cv.GC_INIT_WITH_MASK);
          }
          rgb.delete(); bgd.delete(); fgd.delete();
          aplicarMascara();
        } catch (e) {
          dica.textContent = e.message || 'Não foi possível retirar o fundo.';
        } finally {
          ocupado.hidden = true;
          desenhar();
        }
      }

      function exportar() {
        const saida = document.createElement('canvas');
        saida.width = saida.height = LADO_SAIDA;
        const sctx = saida.getContext('2d');
        sctx.imageSmoothingQuality = 'high';
        const r = retangulo(LADO_SAIDA);
        sctx.drawImage(trab, r.x, r.y, r.w, r.h);
        return saida.toDataURL('image/png');
      }

      function escolher(f) {
        ferramenta = ferramenta === f ? '' : f;
        fundo.querySelectorAll('[data-ferramenta]').forEach((b) => b.classList.toggle('ativo', b.dataset.ferramenta === ferramenta));
        dica.textContent = DICAS[ferramenta];
        desenhar();
      }

      function fechar(valor) {
        window.removeEventListener('resize', medir);
        if (mascara) mascara.delete();
        pilha.forEach((p) => { if (p.mascara) p.mascara.delete(); });
        fundo.remove();
        resolver(valor);
      }

      fundo.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.ferramenta) escolher(b.dataset.ferramenta);
        else if (b.classList.contains('ei-x') || b.dataset.acao === 'cancelar') fechar(null);
        else if (b.dataset.acao === 'usar') fechar(exportar());
        else if (b.dataset.acao === 'centralizar') { cx = cy = 0.5; z = 1; zoom.value = 100; desenhar(); }
        else if (b.dataset.acao === 'original') {
          guardar();
          tctx.putImageData(original, 0, 0);
          if (mascara) { mascara.delete(); mascara = null; }
          rctx.clearRect(0, 0, w, h);
          desenhar();
        } else if (b.dataset.acao === 'desfazer' && pilha.length) {
          const v = pilha.pop();
          tctx.putImageData(v.imagem, 0, 0);
          rctx.putImageData(v.tracos, 0, 0);
          if (mascara) mascara.delete();
          mascara = v.mascara;
          btnDesfazer.disabled = !pilha.length;
          desenhar();
        }
      });

      dica.textContent = DICAS[''];
      window.addEventListener('resize', medir);
      requestAnimationFrame(() => { medir(); recortar('ret'); });
    });
  }

  window.EditorImagem = { abrir, ampliar };
})();
