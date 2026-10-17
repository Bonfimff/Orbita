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
      dadosPromessa = fetch(base + 'particulas.json?v=4').then((r) => {
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
    const ox = (HEX[i][0] - CENTRO[0]) / UNIDADE * p.t;
    const oy = (HEX[i][1] - CENTRO[1]) / UNIDADE * p.t;
    if (!p.ang) return [p.x + ox, p.y + oy];
    const c = Math.cos(p.ang);
    const s = Math.sin(p.ang);
    return [p.x + ox * c - oy * s, p.y + ox * s + oy * c];
  }

  // ---------------------------------------------------------------- movimento
  // Cada ícone tem um movimento próprio, aplicado à posição de repouso das
  // logos (o ímã e a mola continuam por cima):
  //  - formas cheias (disco do sol, nuvens) são tratadas como um objeto OCO:
  //    as logos grandes ficam na casca da frente e as pequenas na de trás.
  //    A forma gira devagar em torno do eixo vertical; as de trás ficam
  //    menores e mais apagadas e andam ao contrário das da frente (paralaxe);
  //  - sol: além disso, roda devagar no plano, com os raios;
  //  - vento: uma onda percorre as correntes e a espiral balança;
  //  - tempestade: a chuva cai e some.
  function casca(ps, filtro) {
    const corpo = ps.filter(filtro);
    if (!corpo.length) return null;
    const xs = corpo.map((p) => p.x0);
    const ys = corpo.map((p) => p.y0);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const rx = (Math.max(...xs) - Math.min(...xs)) / 2 + 4;
    const ry = (Math.max(...ys) - Math.min(...ys)) / 2 + 4;
    const tamanhos = corpo.map((p) => p.t0).sort((a, b) => a - b);
    const mediana = tamanhos[Math.floor(tamanhos.length / 2)];
    corpo.forEach((p) => {
      const nx = (p.x0 - cx) / rx;
      const ny = (p.y0 - cy) / ry;
      const fundo = Math.sqrt(Math.max(0.08, 1 - nx * nx - ny * ny));
      p.casca = { nx, z: p.t0 >= mediana ? fundo : -fundo };
    });
    return { cx, rx };
  }

  // Profundidade SEM mover as logos (mover deformava a forma): a casca de
  // trás fica mais apagada e uma faixa de luz passa devagar por ela, de um
  // lado ao outro, o que dá a impressão de volume girando.
  function profundidade(p, t) {
    if (!p.casca) return;
    p.z = p.casca.z;
    p.t = p.t0 * (1 + 0.06 * p.casca.z);
    if (p.casca.z >= 0) {
      p.opacidade = 1;
    } else {
      const luz = 0.5 + 0.5 * Math.sin(t * 0.22 - p.casca.nx * 2.6);   // bem devagar
      p.opacidade = 0.35 + 0.35 * luz;
    }
  }

  // Raio de sol a que a logo pertence (pelo ângulo em volta do centro).
  function grupoRaio(p, cx, cy) {
    const graus = Math.atan2(p.y0 - cy, p.x0 - cx) * 180 / Math.PI;
    return 'raio' + ((Math.round(graus / 45) + 8) % 8);
  }

  function movimentoDoIcone(nome, ps) {
    const repor = () => ps.forEach((p) => { p.rx = p.x0; p.ry = p.y0; p.t = p.t0; p.z = p.casca ? p.casca.z : 0; p.opacidade = 1; });

    if (nome === 'sol') {
      const forma = casca(ps, (p) => Math.hypot(p.x0 - 150, p.y0 - 100) < 58);
      ps.forEach((p) => { p.grupo = Math.hypot(p.x0 - 150, p.y0 - 100) < 58 ? 'disco' : grupoRaio(p, 150, 100); });
      return (t) => {
        repor();
        ps.forEach((p) => profundidade(p, t));
        // Bola do meio: gira em volta do próprio centro (as logos giram junto).
        // Raios: dão a volta no sol no sentido horário, como ponteiros de
        // relógio, sempre apontando para fora e sem girar sobre si mesmos.
        ps.forEach((p) => {
          const disco = p.grupo === 'disco';
          const a = disco ? t * 0.14 : t * 0.05;
          const c = Math.cos(a);
          const sn = Math.sin(a);
          const dx = p.rx - 150;
          const dy = p.ry - 100;
          p.rx = 150 + dx * c - dy * sn;
          p.ry = 100 + dx * sn + dy * c;
          p.ang = disco ? a : 0;
        });
      };
    }

    if (nome === 'vento') {
      // Cada corrente tem o próprio óleo: uma não liga na outra.
      ps.forEach((p) => {
        if ((p.x0 > 195 && p.y0 < 100) || p.y0 < 97) p.grupo = 'topo';
        else if (p.y0 < 128 || p.x0 > 238) p.grupo = 'meio';
        else p.grupo = 'baixo';
        p.poucasPontes = true;
      });
      return (t) => {
        repor();
        ps.forEach((p) => {
          // Onda correndo da esquerda para a direita, mais forte na ponta.
          const amplitude = 0.8 + 4.2 * (p.x0 / 300);
          p.ry = p.y0 + amplitude * Math.sin(0.065 * p.x0 - 2.3 * t);
          p.rx = p.x0 + 1.5 * Math.sin(0.04 * p.y0 - 1.7 * t);
          // A espiral de cima balança em volta do próprio centro.
          if (p.x0 > 196 && p.y0 < 100) {
            const a = 0.22 * Math.sin(t * 1.1);
            const dx = p.rx - 225;
            const dy = p.ry - 68;
            p.rx = 225 + dx * Math.cos(a) - dy * Math.sin(a);
            p.ry = 68 + dx * Math.sin(a) + dy * Math.cos(a);
          }
          // As pequenas parecem mais longe: mais apagadas.
          p.opacidade = Math.min(1, 0.55 + p.t0 / 20);
        });
      };
    }

    if (nome === 'tempestade' || nome === 'chuva') {
      const forma = casca(ps, (p) => p.y0 < 120);
      const chuva = ps.filter((p) => p.y0 >= 126 && (nome === 'chuva' || p.x0 < 118 || p.x0 > 205));
      ps.forEach((p) => {
        if (p.y0 < 120) p.grupo = 'nuvem';
        else if (chuva.includes(p)) p.grupo = 'chuva' + Math.round(p.x0 / 24);
        else p.grupo = 'raio';
      });
      return (t) => {
        repor();
        ps.forEach((p) => profundidade(p, t));
        chuva.forEach((p) => {
          const queda = (t * 22 + p.x0 * 1.7) % 26;
          p.ry = p.y0 + queda;
          p.rx = p.x0 - queda * 0.35;
          p.opacidade = 1 - queda / 26;
        });
      };
    }

    if (nome === 'sol-nuvem') {
      // Sol parado atrás (os raios só pulsam, crescendo e voltando) e a nuvem
      // na frente com profundidade. Sol e nuvem não se ligam.
      const SX = 196;
      const SY = 76;
      const naNuvem = (p) => [[72, 150, 30], [114, 128, 40], [160, 144, 32], [186, 160, 18]]
        .some(([cx, cy, r]) => Math.hypot(p.x0 - cx, p.y0 - cy) <= r + 3) ||
        (p.x0 >= 41 && p.x0 <= 201 && p.y0 >= 147);
      ps.forEach((p) => {
        if (naNuvem(p)) p.grupo = 'nuvem';
        else if (Math.hypot(p.x0 - SX, p.y0 - SY) <= 47) p.grupo = 'disco';
        else p.grupo = grupoRaio(p, SX, SY);
      });
      casca(ps, (p) => p.grupo === 'nuvem');
      return (t) => {
        repor();
        ps.forEach((p) => {
          if (p.grupo === 'nuvem') { profundidade(p, t); return; }
          if (p.grupo.startsWith('raio')) {
            const d = Math.hypot(p.x0 - SX, p.y0 - SY);
            const pulso = 1 + 0.07 * Math.sin(t * 1.6) * Math.min(1, (d - 47) / 30);
            p.rx = SX + (p.x0 - SX) * pulso;
            p.ry = SY + (p.y0 - SY) * pulso;
          }
        });
      };
    }

    // Nuvem: objeto oco, profundidade pela luz na casca de trás.
    const forma = casca(ps, () => true);
    return (t) => {
      repor();
      ps.forEach((p) => profundidade(p, t));
    };
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
      const ps = lista.map(([x, y, t]) => ({ x0: x, y0: y, rx: x, ry: y, x, y, vx: 0, vy: 0, t, t0: t, z: 0 }));
      const mover = movimentoDoIcone(nome, ps);
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
        // Frente só liga com frente e fundo com fundo (camadas do objeto oco).
        if (a.casca && b.casca && Math.sign(a.casca.z) !== Math.sign(b.casca.z)) return;
        // Partes diferentes do desenho (disco x raio, sol x nuvem...) não se ligam.
        if ((a.grupo || '') !== (b.grupo || '')) return;
        // Vento: menos ligações, para o traço continuar leve.
        if (a.poucasPontes && Math.random() < 0.5) return;
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
          w: 0.24 * Math.min(ps[i].t, ps[j].t) + 0.7,
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
      let quadroN = 0;

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

        // Movimento próprio do ícone (giro em 3D, sol rodando, onda do vento,
        // chuva caindo): define onde cada logo "mora" neste quadro.
        mover(t);
        quadroN = (quadroN + 1) % 12;
        if (quadroN === 0) {
          // De trás para a frente, para as logos da frente cobrirem as de trás.
          ps.slice().sort((m, n) => m.z - n.z).forEach((p) => ferro.appendChild(p.no));
        }

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
          p.no.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})` +
            (p.ang ? ` rotate(${(p.ang * 180 / Math.PI).toFixed(2)})` : '') + ` scale(${p.t.toFixed(2)})`);
          p.no.setAttribute('opacity', p.opacidade == null ? 1 : p.opacidade.toFixed(2));

          // Gota puxada pelo ímã: base larga, lados abaulados e ponta redonda,
          // como óleo grosso. Cresce e murcha devagar (viscosidade) e, sem o
          // cursor por perto, fica bem discreta.
          if (p.espicula) {
            const alvoForca = (ima.alvo ? 1 : 0.3) * F * gauss;
            p.forca = (p.forca || 0) + (alvoForca - (p.forca || 0)) * (alvoForca > (p.forca || 0) ? 0.05 : 0.025);
            const altura = p.t * 0.7 * p.forca;
            if (altura < 0.5) {
              p.espicula.setAttribute('d', '');
            } else {
              const dist = Math.hypot(ima.x - p.x, ima.y - p.y) || 1;
              const ux = (ima.x - p.x) / dist;
              const uy = (ima.y - p.y) / dist;
              const nxu = -uy;
              const nyu = ux;
              const base = p.t * 0.22;                     // meia largura da base
              const rp = base * (0.75 - 0.25 * Math.min(1, altura / (p.t * 0.7)));  // raio da ponta
              const bx = p.x + ux * p.t * 0.28;
              const by = p.y + uy * p.t * 0.28;
              const cx = bx + ux * altura;                 // centro da ponta
              const cy = by + uy * altura;
              const f = (x) => x.toFixed(2);
              const L0 = [bx + nxu * base, by + nyu * base];
              const R0 = [bx - nxu * base, by - nyu * base];
              const L1 = [cx + nxu * rp, cy + nyu * rp];
              const R1 = [cx - nxu * rp, cy - nyu * rp];
              const frente = [cx + ux * rp, cy + uy * rp];
              // Lados: saem da base inchados e afinam suave até a ponta.
              const cL = [bx + ux * altura * 0.45 + nxu * base * 0.95, by + uy * altura * 0.45 + nyu * base * 0.95];
              const cR = [bx + ux * altura * 0.45 - nxu * base * 0.95, by + uy * altura * 0.45 - nyu * base * 0.95];
              p.espicula.setAttribute('d',
                `M${f(L0[0])} ${f(L0[1])}Q${f(cL[0])} ${f(cL[1])} ${f(L1[0])} ${f(L1[1])}` +
                `Q${f(L1[0] + ux * rp)} ${f(L1[1] + uy * rp)} ${f(frente[0])} ${f(frente[1])}` +
                `Q${f(R1[0] + ux * rp)} ${f(R1[1] + uy * rp)} ${f(R1[0])} ${f(R1[1])}` +
                `Q${f(cR[0])} ${f(cR[1])} ${f(R0[0])} ${f(R0[1])}Z`);
            }
          }
        });

        // Óleo: cada ponte estica, funde e rompe conforme o ímã e um ritmo próprio.
        pontes.forEach((b) => {
          const A = hexNoMundo(b.a, b.ha);
          const B = hexNoMundo(b.b, b.hb);
          // Esticou demais (o giro afastou as duas): a ponte rompe.
          if (!b.comp0) b.comp0 = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
          const esticou = Math.hypot(B[0] - A[0], B[1] - A[1]) > b.comp0 * 1.8 + 3;
          const opac = Math.min(b.a.opacidade == null ? 1 : b.a.opacidade, b.b.opacidade == null ? 1 : b.b.opacidade);
          b.lados[0].setAttribute('opacity', opac.toFixed(2));
          b.lados[1].setAttribute('opacity', opac.toFixed(2));
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
          const alvoE = esticou ? 0 : Math.max(b.minimo, Math.min(1,
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
          const w = b.w * (0.6 + 0.4 * Math.min(1, e * 2)) * (1 + 0.6 * perto * F + 0.5 * Math.max(0, arrasto));
          if (e < 0.03 || esticou) {
            b.lados[0].setAttribute('d', '');
            b.lados[1].setAttribute('d', '');
          } else if (unido) {
            // Pescoço: cheio nas pontas, cintura no meio (mais fina quanto
            // menos "puxado" estiver o óleo).
            const meio = 0.4 + 0.45 * cintura;
            b.lados[0].setAttribute('d', contorno(0, 1, (f) => w * (1 - (1 - meio) * Math.sin(Math.PI * f))));
            b.lados[1].setAttribute('d', '');
          } else {
            // Dois tentáculos crescendo um na direção do outro.
            const fim = 0.5;                                   // a ponta mantém metade da largura
            const ponta = (f) => w * (1 - (1 - fim) * Math.pow(f, 1.4));
            const gota = (u) => {
              const [gx, gy] = ponto(u);
              const r = (w * fim) / 2;
              return `M${(gx - r).toFixed(2)} ${gy.toFixed(2)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0` +
                `a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0Z`;
            };
            b.lados[0].setAttribute('d', contorno(0, alcance, ponta) + gota(alcance));
            b.lados[1].setAttribute('d', contorno(1, 1 - alcance, ponta) + gota(1 - alcance));
          }
        });

      }
      if (REDUZIR) atualizar(4); else quadro = requestAnimationFrame(passo);
    }

    return instancia;
  }

  window.ClimaFerro = { montar };
})();
