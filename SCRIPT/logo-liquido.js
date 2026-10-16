// Logo enchendo de petróleo, para usar fora das páginas internas (login).
// Mesma simulação do carregamento de geral.js: a superfície é uma fileira
// de molas (equação de onda), o recipiente balança e o líquido responde.
//
// Uso:
//   const logo = LogoLiquido.montar(elemento, { largura, altura });
//   logo.encherUmaVez();        // enche e para cheio
//   const fim = logo.aguardar(); // enche em ciclo até chamar fim()
(function () {
  const COLUNAS = 64;

  function montar(elemento, opcoes) {
    const W = opcoes.largura;
    const H = opcoes.altura;
    const canvas = document.createElement('canvas');
    canvas.className = 'logo-liquido-canvas';
    elemento.appendChild(canvas);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const altura = new Float32Array(COLUNAS + 1);
    const velocidade = new Float32Array(COLUNAS + 1);
    const escala = H / 96;
    let quadro = 0;
    let ultimo = 0;
    let inicioCiclo = 0;
    let proximaGota = 0;
    let nivelAtual = 0;
    let modo = null;          // 'uma-vez' | 'ciclo'
    let duracao = 2400;
    let rapido = null;
    const TEMPO_CHEIO = 700;
    const TEMPO_RAPIDO = 650;

    function reiniciar(agora) {
      altura.fill(0);
      velocidade.fill(0);
      inicioCiclo = agora;
      nivelAtual = 0;
      proximaGota = agora + 300;
    }

    function nivel(p) {
      return 1 - Math.pow(1 - p, 1.6);
    }

    function passo(dt, t) {
      const inclinacao = 0.6 * Math.sin(t * 1.6) + 0.35 * Math.sin(t * 2.7 + 1.2) + 0.15 * Math.sin(t * 4.3 + 0.5);
      const RIGIDEZ = 0.014, AMORTECIMENTO = 0.016, ESPALHAR = 0.1;
      for (let i = 0; i <= COLUNAS; i++) {
        const x = i / COLUNAS - 0.5;
        const alvo = inclinacao * x * 15 * escala;
        velocidade[i] += (alvo - altura[i]) * RIGIDEZ - velocidade[i] * AMORTECIMENTO;
      }
      const limite = 16 * escala;
      for (let i = 0; i <= COLUNAS; i++) {
        altura[i] += velocidade[i] * dt;
        if (!isFinite(altura[i])) { altura[i] = 0; velocidade[i] = 0; }
        altura[i] = Math.max(-limite, Math.min(limite, altura[i]));
      }
      for (let k = 0; k < 2; k++) {
        const delta = new Float32Array(COLUNAS + 1);
        for (let i = 0; i <= COLUNAS; i++) {
          if (i > 0) delta[i] += ESPALHAR * (altura[i - 1] - altura[i]);
          if (i < COLUNAS) delta[i] += ESPALHAR * (altura[i + 1] - altura[i]);
        }
        for (let i = 0; i <= COLUNAS; i++) velocidade[i] += delta[i] * dt;
      }
    }

    function desenhar(t, base) {
      ctx.clearRect(0, 0, W, H);
      const passoX = W / COLUNAS;
      const y = i => base + altura[i];

      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, y(0));
      for (let i = 1; i <= COLUNAS; i++) {
        const xm = (i - 0.5) * passoX;
        ctx.quadraticCurveTo((i - 1) * passoX, y(i - 1), xm, (y(i - 1) + y(i)) / 2);
      }
      ctx.lineTo(W, y(COLUNAS));
      ctx.lineTo(W, H);
      ctx.closePath();
      const corpo = ctx.createLinearGradient(0, base - 6 * escala, 0, H);
      corpo.addColorStop(0, '#2b2621');
      corpo.addColorStop(0.18, '#120f0d');
      corpo.addColorStop(1, '#000');
      ctx.fillStyle = corpo;
      ctx.fill();

      ctx.save();
      ctx.clip();
      const desloc = Math.sin(t * 0.6) * 10 * escala;
      const brilho = ctx.createLinearGradient(W * 0.2 + desloc, base, W * 0.7 + desloc, base + 40 * escala);
      brilho.addColorStop(0, 'rgba(255,255,255,0)');
      brilho.addColorStop(0.45, 'rgba(255,248,235,0.07)');
      brilho.addColorStop(0.55, 'rgba(255,248,235,0.11)');
      brilho.addColorStop(0.65, 'rgba(255,248,235,0.05)');
      brilho.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = brilho;
      ctx.fillRect(0, base - 10 * escala, W, H);
      ctx.restore();

      for (let i = 1; i <= COLUNAS; i++) {
        const inclin = (y(i) - y(i - 1)) / escala;
        const luz = Math.max(0, Math.min(1, -inclin * 0.9 + 0.25));
        if (luz <= 0.02) continue;
        ctx.strokeStyle = 'rgba(255,246,228,' + (0.42 * luz).toFixed(3) + ')';
        ctx.lineWidth = 1.1 * escala;
        ctx.beginPath();
        ctx.moveTo((i - 1) * passoX, y(i - 1) + 0.6);
        ctx.lineTo(i * passoX, y(i) + 0.6);
        ctx.stroke();
      }
    }

    function desenharCheio() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
    }

    function animar(agora) {
      const dt = Math.min(2.5, (agora - (ultimo || agora)) / 16.67) || 1;
      ultimo = agora;
      let decorrido = agora - inicioCiclo;
      let p;
      if (rapido) {
        if (!rapido.inicio) {
          rapido.inicio = agora;
          rapido.de = nivelAtual;
          for (let i = 0; i <= COLUNAS; i++) velocidade[i] += (Math.random() - 0.5) * 2.2 * escala;
        }
        const q = Math.min(1, (agora - rapido.inicio) / TEMPO_RAPIDO);
        nivelAtual = rapido.de + (1 - rapido.de) * (1 - Math.pow(1 - q, 3));
        p = 1;
        if (q >= 1) { rapido = null; parar(); return; }
      } else if (modo === 'uma-vez') {
        p = Math.min(1, decorrido / duracao);
        nivelAtual = nivel(p);
        if (p >= 1) { parar(); return; }
      } else {
        if (decorrido > duracao + TEMPO_CHEIO) { reiniciar(agora); decorrido = 0; }
        p = Math.min(1, decorrido / duracao);
        nivelAtual = nivel(p);
      }
      const base = H * (1.06 - nivelAtual * 1.16);

      if (agora > proximaGota && p < 0.97) {
        const c = Math.floor(COLUNAS * (0.3 + Math.random() * 0.4));
        for (let k = -2; k <= 2; k++) {
          const j = c + k;
          if (j >= 0 && j <= COLUNAS) velocidade[j] += (1.4 - Math.abs(k) * 0.35) * escala;
        }
        proximaGota = agora + 450 + Math.random() * 600;
      }

      const t = agora / 1000;
      const passos = Math.max(1, Math.round(dt * 2));
      for (let k = 0; k < passos; k++) passo(0.5, t);
      desenhar(t, base);
      quadro = requestAnimationFrame(animar);
    }

    function parar() {
      if (quadro) cancelAnimationFrame(quadro);
      quadro = 0;
      modo = null;
      desenharCheio();
    }

    function iniciar(novoModo, novaDuracao) {
      if (quadro) cancelAnimationFrame(quadro);
      modo = novoModo;
      duracao = novaDuracao;
      rapido = null;
      ultimo = 0;
      reiniciar(performance.now());
      quadro = requestAnimationFrame(animar);
    }

    const semMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return {
      encherUmaVez() {
        if (semMovimento) { desenharCheio(); return; }
        iniciar('uma-vez', 2400);
      },
      aguardar() {
        if (semMovimento) { desenharCheio(); return function () {}; }
        iniciar('ciclo', 3200);
        let encerrado = false;
        return function () {
          if (encerrado || !quadro) return;
          encerrado = true;
          rapido = {};
        };
      },
    };
  }

  window.LogoLiquido = { montar };
})();
