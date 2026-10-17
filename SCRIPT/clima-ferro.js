//======================================================================================================
// ÍCONES DE CLIMA EM "FERROFLUIDO"
// Cada logo da Kernel é uma partícula de ferro; entre elas corre um óleo
// viscoso. Um ímã invisível passeia pelo desenho (ou segue o mouse): perto
// dele as partículas são puxadas um pouco, presas por mola (nunca se
// soltam), e o óleo estica tentáculos de um hexágono ao vizinho, funde num
// pescoço só e depois afina até romper, com atraso, como líquido grosso.
//
// Como: a camada do óleo é feita de círculos sob um filtro "gooey" (desfoque
// + limiar de opacidade), que funde formas próximas como metaballs. As logos
// ficam por cima, nítidas, para a geometria não deformar.
// Posições das logos: IMG/clima/particulas.json (gerado por backup/gerar_clima.py).
//
// Uso: const anim = ClimaFerro.montar(elemento, 'sol'); ... anim.parar();
//======================================================================================================
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const COR = '#0f1a2e';
  // Geometria da logo (caixa de 500, igual ao gerador): 7 hexágonos e 4 pescoços.
  const HEX = [[250, 97], [118, 172], [385, 172], [250, 245], [118, 320], [385, 320], [250, 395]];
  const LIGACOES = [[0, 1], [2, 3], [3, 5], [4, 6]];
  const CENTRO = [251.5, 246];
  const UNIDADE = 400;
  const REDUZIR = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let dadosPromessa = null;
  function dados(base) {
    if (!dadosPromessa) {
      dadosPromessa = fetch(base + 'particulas.json?v=2').then((r) => {
        if (!r.ok) throw new Error('particulas.json');
        return r.json();
      });
    }
    return dadosPromessa;
  }

  function el(nome, attrs) {
    const e = document.createElementNS(NS, nome);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  }

  // Desenho da logo com largura 1, centrada na origem.
  function grupoLogo(id) {
    const g = el('g', {
      id: id, fill: 'currentColor', stroke: 'currentColor', 'stroke-width': 6, 'stroke-linejoin': 'round',
      transform: `scale(${1 / UNIDADE}) translate(${-CENTRO[0]} ${-CENTRO[1]})`,
    });
    HEX.forEach(([cx, cy]) => {
      const pts = [];
      for (let k = 0; k < 6; k++) {
        const a = (-90 + 60 * k) * Math.PI / 180;
        pts.push((cx + 58 * Math.cos(a)).toFixed(1) + ',' + (cy + 58 * Math.sin(a)).toFixed(1));
      }
      g.appendChild(el('polygon', { points: pts.join(' ') }));
    });
    LIGACOES.forEach(([a, b]) => {
      g.appendChild(el('line', { x1: HEX[a][0], y1: HEX[a][1], x2: HEX[b][0], y2: HEX[b][1], 'stroke-width': 34 }));
    });
    return g;
  }

  // Centro de um hexágono da logo, em coordenadas do desenho.
  function hexNoMundo(p, i) {
    return [p.x + (HEX[i][0] - CENTRO[0]) / UNIDADE * p.t, p.y + (HEX[i][1] - CENTRO[1]) / UNIDADE * p.t];
  }

  let contador = 0;

  function montar(alvo, nome, opcoes) {
    const base = (opcoes && opcoes.base) || '../IMG/clima/';
    let parado = false;
    let quadro = null;
    let instancia = { parar() { parado = true; if (quadro) cancelAnimationFrame(quadro); } };

    dados(base).then((d) => {
      if (parado) return;
      const lista = d.icones[nome];
      if (!lista) throw new Error('ícone ' + nome);
      desenhar(alvo, d.largura, d.altura, lista);
    }).catch(() => {
      // Sem os dados: usa o SVG estático.
      alvo.innerHTML = `<img src="${base}${nome}.svg" alt="" style="width:100%;height:auto">`;
    });

    function desenhar(alvo, W, H, lista) {
      const id = 'cf' + (++contador);
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'clima-ferro' });
      svg.style.color = COR;
      svg.style.width = '100%';
      svg.style.height = 'auto';
      svg.style.display = 'block';
      svg.style.overflow = 'visible';
      const defs = el('defs');
      defs.appendChild(grupoLogo(id + 'k'));
      svg.appendChild(defs);

      const oleo = el('g', { fill: 'currentColor' });
      const ferro = el('g');
      svg.appendChild(oleo);
      svg.appendChild(ferro);
      alvo.innerHTML = '';
      alvo.appendChild(svg);

      // Partículas (logos): posição de repouso, posição atual e velocidade.
      const ps = lista.map(([x, y, t]) => ({ rx: x, ry: y, x, y, vx: 0, vy: 0, t }));
      ps.forEach((p) => {
        p.no = el('use', { href: `#${id}k` });
        ferro.appendChild(p.no);
        if (p.t >= 9) {
          p.espicula = el('path', { d: '' });
          oleo.appendChild(p.espicula);
        }
      });

      // Pontes possíveis entre vizinhas: hexágonos mais próximos de cada par.
      const pontes = [];
      const grau = new Array(ps.length).fill(0);
      const cand = [];
      ps.forEach((a, i) => ps.forEach((b, j) => {
        if (j <= i || Math.min(a.t, b.t) < 5) return;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < (a.t + b.t) * 0.95) cand.push([dist, i, j]);
      }));
      cand.sort((m, n) => m[0] - n[0]);
      cand.forEach(([, i, j]) => {
        if (grau[i] >= 4 || grau[j] >= 4) return;
        let melhor = null;
        for (let ha = 0; ha < 7; ha++) {
          for (let hb = 0; hb < 7; hb++) {
            const pa = hexNoMundo(ps[i], ha);
            const pb = hexNoMundo(ps[j], hb);
            const dd = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
            if (!melhor || dd < melhor[0]) melhor = [dd, ha, hb];
          }
        }
        grau[i] += 1;
        grau[j] += 1;
        const forma = () => { const c = el('path', { d: '' }); oleo.appendChild(c); return c; };
        pontes.push({
          a: ps[i], b: ps[j], ha: melhor[1], hb: melhor[2],
          w: 0.17 * Math.min(ps[i].t, ps[j].t) + 0.5,
          e: 0, fase: Math.random() * Math.PI * 2, ritmo: 0.25 + Math.random() * 0.35,
          lados: [forma(), forma()],
          // Um terço das pontes nunca seca de vez: mantém o efeito vivo.
          minimo: Math.random() < 0.33 ? 0.35 : 0,
        });
      });

      // Ímã: passeia sozinho; com o mouse por cima, segue o cursor.
      const ima = { x: W / 2, y: H / 2, alvo: null };
      svg.addEventListener('pointermove', (e) => {
        const r = svg.getBoundingClientRect();
        const novo = [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
        // Velocidade do mouse (no desenho): o líquido é arrastado no sentido do movimento.
        if (ima.alvo) {
          ima.mvx = (ima.mvx || 0) * 0.6 + (novo[0] - ima.alvo[0]) * 0.4;
          ima.mvy = (ima.mvy || 0) * 0.6 + (novo[1] - ima.alvo[1]) * 0.4;
        }
        ima.alvo = novo;
      });
      svg.addEventListener('pointerleave', () => { ima.alvo = null; ima.mvx = ima.mvy = 0; });

      let visivel = true;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((ent) => { visivel = ent[0].isIntersecting; }).observe(svg);
      }

      const RAIO_IMA = 55;
      let inicio = performance.now();

      function passo(agora) {
        if (parado) return;
        quadro = requestAnimationFrame(passo);
        if (!visivel || document.hidden || !svg.isConnected) return;
        atualizar((agora - inicio) / 1000);
      }

      // Para testes: simula `segundos` de animação na hora (60 quadros/s).
      instancia.avancar = (segundos) => {
        const base = (performance.now() - inicio) / 1000;
        for (let k = 0; k < segundos * 60; k++) atualizar(base + k / 60);
      };

      function atualizar(t) {

        // Caminho do ímã quando ninguém está com o mouse em cima.
        const destino = ima.alvo || [W / 2 + W * 0.36 * Math.sin(t * 0.23), H / 2 + H * 0.3 * Math.sin(t * 0.37 + 1)];
        ima.x += (destino[0] - ima.x) * 0.06;
        ima.y += (destino[1] - ima.y) * 0.06;
        // Intensidade do campo: o ímã se aproxima e se afasta em ciclos (com o
        // mouse em cima, fica sempre forte). Suavizada para subir e descer devagar.
        const pulso = 0.5 + 0.5 * Math.sin(t * 0.45);
        const campoAlvo = ima.alvo ? 1 : pulso * pulso * (3 - 2 * pulso);
        ima.campo = (ima.campo || 0) + (campoAlvo - (ima.campo || 0)) * 0.03;
        const F = ima.campo;
        ima.mvx = (ima.mvx || 0) * 0.94;
        ima.mvy = (ima.mvy || 0) * 0.94;

        // Partículas: puxadas para o ímã, presas ao lugar por mola.
        ps.forEach((p) => {
          const dx = ima.x - p.rx;
          const dy = ima.y - p.ry;
          const dist = Math.hypot(dx, dy) || 1;
          const gauss = Math.exp(-(dist * dist) / (2 * RAIO_IMA * RAIO_IMA));
          // Aglomera na direção do ímã (as menores andam mais), sem soltar da mola.
          const puxa = (1.2 + 5.5 * F) * gauss * (12 / (p.t + 6));
          const ax = p.rx + dx / dist * puxa;
          const ay = p.ry + dy / dist * puxa;
          p.vx = (p.vx + (ax - p.x) * 0.07) * 0.8;
          p.vy = (p.vy + (ay - p.y) * 0.07) * 0.8;
          p.x += p.vx;
          p.y += p.vy;
          p.no.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${p.t})`);

          // Espícula (instabilidade de Rosensweig): ponta afiada que nasce da
          // logo e aponta para o ímã, crescendo com o campo.
          if (p.espicula) {
            const altura = p.t * 0.75 * F * gauss;
            if (altura < 0.6) {
              p.espicula.setAttribute('d', '');
            } else {
              const ux = (ima.x - p.x) / (Math.hypot(ima.x - p.x, ima.y - p.y) || 1);
              const uy = (ima.y - p.y) / (Math.hypot(ima.x - p.x, ima.y - p.y) || 1);
              const r0 = p.t * 0.32;                 // nasce da borda da logo
              const base = p.t * 0.16;               // meia largura da base
              const bx = p.x + ux * r0;
              const by = p.y + uy * r0;
              const tx = bx + ux * altura;
              const ty = by + uy * altura;
              const nx = -uy * base;
              const ny = ux * base;
              // Lados côncavos, como a ponta de um líquido puxado.
              const c1x = bx + ux * altura * 0.35 + nx * 0.25;
              const c1y = by + uy * altura * 0.35 + ny * 0.25;
              const c2x = bx + ux * altura * 0.35 - nx * 0.25;
              const c2y = by + uy * altura * 0.35 - ny * 0.25;
              p.espicula.setAttribute('d',
                `M${(bx + nx).toFixed(2)} ${(by + ny).toFixed(2)}Q${c1x.toFixed(2)} ${c1y.toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)}` +
                `Q${c2x.toFixed(2)} ${c2y.toFixed(2)} ${(bx - nx).toFixed(2)} ${(by - ny).toFixed(2)}Z`);
            }
          }
        });

        // Óleo: cada ponte estica, funde e rompe conforme o ímã e um ritmo próprio.
        pontes.forEach((b) => {
          const A = hexNoMundo(b.a, b.ha);
          const B = hexNoMundo(b.b, b.hb);
          const mx = (A[0] + B[0]) / 2;
          const my = (A[1] + B[1]) / 2;
          const dIma = Math.hypot(ima.x - mx, ima.y - my);
          const perto = Math.exp(-(dIma * dIma) / (2 * RAIO_IMA * RAIO_IMA));
          // Arrasto do mouse: à frente do movimento o líquido chega (pontes
          // se formam); atrás dele o líquido sai (pontes secam).
          let arrasto = 0;
          const vel = Math.hypot(ima.mvx || 0, ima.mvy || 0);
          if (ima.alvo && vel > 0.05) {
            const rx = mx - ima.x;
            const ry = my - ima.y;
            const rd = Math.hypot(rx, ry) || 1;
            const lado = (rx * ima.mvx + ry * ima.mvy) / (rd * vel);       // +1 à frente, -1 atrás
            const alcance = Math.exp(-(rd * rd) / (2 * 75 * 75));
            arrasto = lado * alcance * Math.min(1, vel / 1.2) * 1.8;
          }
          // Mexendo o mouse, o arrasto manda mais que a atração parada.
          const movimento = ima.alvo ? Math.min(1, vel / 1.2) : 0;
          const alvoE = Math.max(b.minimo, Math.min(1,
            perto * (0.4 + 1.6 * F) * (1 - 0.75 * movimento) + 0.45 * Math.sin(t * b.ritmo + b.fase) * (1 - 0.5 * F) + 0.05 + arrasto));
          // Viscosidade: segue o alvo devagar; afinar é mais lento que esticar.
          b.e += (alvoE - b.e) * (alvoE > b.e ? 0.045 : 0.025);
          const e = b.e;

          // Curva do pescoço, puxada na direção do ímã.
          const curva = Math.min(5, perto * 7) * e;
          const ux = ima.x - mx;
          const uy = ima.y - my;
          const un = Math.hypot(ux, uy) || 1;
          const cx = mx + ux / un * curva;
          const cy = my + uy / un * curva;
          const ponto = (u) => [
            (1 - u) * (1 - u) * A[0] + 2 * (1 - u) * u * cx + u * u * B[0],
            (1 - u) * (1 - u) * A[1] + 2 * (1 - u) * u * cy + u * u * B[1],
          ];

          // Contorno com largura variável ao longo da curva: grosso junto ao
          // hexágono, afinando para a ponta. Quando as pontas se encontram
          // vira um pescoço só, com cintura que afina até romper.
          const alcance = e * 0.62;
          const unido = alcance >= 0.5;
          const cintura = unido ? Math.min(1, (alcance - 0.5) / 0.12) : 0;
          function contorno(u0, u1, largura) {
            const N = 14;
            const esq = [];
            const dir = [];
            for (let k = 0; k <= N; k++) {
              const u = u0 + (u1 - u0) * k / N;
              const [px, py] = ponto(u);
              const [qx, qy] = ponto(Math.min(1, u + 0.01));
              const [ox, oy] = ponto(Math.max(0, u - 0.01));
              let nx = -(qy - oy);
              let ny = qx - ox;
              const nn = Math.hypot(nx, ny) || 1;
              nx /= nn; ny /= nn;
              const meia = largura(k / N) / 2;
              esq.push((px + nx * meia).toFixed(2) + ' ' + (py + ny * meia).toFixed(2));
              dir.push((px - nx * meia).toFixed(2) + ' ' + (py - ny * meia).toFixed(2));
            }
            return 'M' + esq.join('L') + 'L' + dir.reverse().join('L') + 'Z';
          }
          const w = b.w * (0.55 + 0.45 * Math.min(1, e * 2));
          if (e < 0.03) {
            b.lados[0].setAttribute('d', '');
            b.lados[1].setAttribute('d', '');
          } else if (unido) {
            // Pescoço: cheio nas pontas, cintura no meio (mais fina quanto
            // menos "puxado" estiver o óleo).
            const meio = 0.25 + 0.55 * cintura;
            b.lados[0].setAttribute('d', contorno(0, 1, (f) => w * (1 - (1 - meio) * Math.sin(Math.PI * f))));
            b.lados[1].setAttribute('d', '');
          } else {
            // Dois tentáculos crescendo um na direção do outro.
            const ponta = (f) => w * Math.pow(1 - f, 0.6) * (0.85 + 0.15 * (1 - f)) + 0.15;
            b.lados[0].setAttribute('d', contorno(0, alcance, ponta));
            b.lados[1].setAttribute('d', contorno(1, 1 - alcance, ponta));
          }
        });

      }
      if (REDUZIR) atualizar(4); else quadro = requestAnimationFrame(passo);
    }

    return instancia;
  }

  window.ClimaFerro = { montar };
})();
