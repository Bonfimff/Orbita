//======================================================================================================
// PREVISÃO DO TEMPO NO LUGAR DA LOGO (painel lateral no computador e
// miniatura na barra de cima no celular)
// A logo fica a maior parte do tempo; de vez em quando cede o lugar a um
// cartão com a previsão, desenhada com os ícones feitos da própria logo
// (IMG/clima/*.svg). Por enquanto os dados são de TESTE: a cada aparição
// mostra uma condição diferente da lista abaixo. Depois troca-se a função
// `previsao()` por uma consulta real, sem mexer no resto.
//======================================================================================================
(function () {
  'use strict';

  const TEMPO_LOGO = 15000;
  const TEMPO_CLIMA = 8000;

  const TESTE = [
    { icone: 'sol', condicao: 'Ensolarado', temperatura: 31, minima: 22, maxima: 33 },
    { icone: 'sol-nuvem', condicao: 'Parcialmente nublado', temperatura: 28, minima: 21, maxima: 30 },
    { icone: 'nuvem', condicao: 'Nublado', temperatura: 25, minima: 20, maxima: 27 },
    { icone: 'chuva', condicao: 'Chuva', temperatura: 22, minima: 19, maxima: 25 },
    { icone: 'tempestade', condicao: 'Chuva com trovoadas', temperatura: 23, minima: 19, maxima: 26 },
    { icone: 'vento', condicao: 'Ventania', temperatura: 24, minima: 19, maxima: 27 },
  ];
  let indice = 0;

  function previsao() {
    const dado = TESTE[indice % TESTE.length];
    indice += 1;
    return Promise.resolve(Object.assign({ cidade: 'Duque de Caxias' }, dado));
  }

  function montar() {
    const painel = document.querySelector('.sidebar-right');
    const logo = painel && painel.querySelector(':scope > img.logo');
    if (!logo || painel.querySelector('.clima-palco')) return;

    const palco = document.createElement('div');
    palco.className = 'clima-palco';
    logo.replaceWith(palco);
    logo.classList.add('clima-face', 'ativa');
    palco.appendChild(logo);

    const cartao = document.createElement('div');
    cartao.className = 'clima-face clima-cartao';
    cartao.setAttribute('aria-live', 'polite');
    palco.appendChild(cartao);

    // Pré-carrega os ícones para a troca não piscar.
    TESTE.forEach((d) => { const img = new Image(); img.src = '../IMG/clima/' + d.icone + '.svg'; });

    // Carrossel: 0 = logo, 1 = previsão. Troca sozinho, e as bolinhas
    // (ou arrastar para o lado) passam na hora; mexer reinicia o tempo.
    const faces = [logo, cartao];
    const TEMPOS = [TEMPO_LOGO, TEMPO_CLIMA];
    const pontos = document.createElement('div');
    pontos.className = 'clima-pontos';
    pontos.setAttribute('role', 'tablist');
    pontos.innerHTML = ['Logo', 'Previsão do tempo'].map((nome, i) =>
      `<button type="button" role="tab" aria-label="${nome}" data-face="${i}"></button>`).join('');
    palco.after(pontos);

    let atual = 0;
    let timer = null;

    let animacao = null;
    async function preencherClima() {
      const p = await previsao();
      if (animacao) animacao.parar();
      cartao.innerHTML = `
        <div class="clima-icone"></div>
        <div class="clima-info">
          <strong class="clima-temp">${p.temperatura}°</strong>
          <span class="clima-condicao">${p.condicao}</span>
          <span class="clima-extra">${p.cidade} · mín ${p.minima}° máx ${p.maxima}°</span>
        </div>`;
      const alvo = cartao.querySelector('.clima-icone');
      // Ícone vivo (ferrofluido); sem o script, o SVG estático.
      if (window.ClimaFerro) animacao = window.ClimaFerro.montar(alvo, p.icone);
      else alvo.innerHTML = `<img src="../IMG/clima/${p.icone}.svg" alt="" style="width:100%">`;
    }

    async function irPara(i) {
      i = (i + faces.length) % faces.length;
      if (i === 1) await preencherClima();
      atual = i;
      faces.forEach((f, k) => f.classList.toggle('ativa', k === i));
      pontos.querySelectorAll('button').forEach((b, k) => {
        b.classList.toggle('ativo', k === i);
        b.setAttribute('aria-selected', String(k === i));
      });
      agendar();
    }

    function agendar() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Painel escondido (celular) ou aba em segundo plano: não troca.
        const visivel = painel.getClientRects().length && getComputedStyle(painel).display !== 'none' && !document.hidden;
        if (visivel) irPara(atual + 1); else agendar();
      }, atual === 0 && !agendar.iniciou ? 4000 : TEMPOS[atual]);
      agendar.iniciou = true;
    }

    pontos.addEventListener('click', (e) => {
      const b = e.target.closest('[data-face]');
      if (b) irPara(Number(b.dataset.face));
    });

    // Arrastar (mouse ou dedo) para o lado também passa.
    let inicioX = null;
    palco.addEventListener('pointerdown', (e) => { inicioX = e.clientX; });
    palco.addEventListener('pointerup', (e) => {
      if (inicioX === null) return;
      const dx = e.clientX - inicioX;
      inicioX = null;
      if (Math.abs(dx) > 30) irPara(atual + (dx < 0 ? 1 : -1));
    });
    palco.addEventListener('dragstart', (e) => e.preventDefault());

    irPara(0);
  }

  // Celular: miniatura no lugar da logo da barra de cima. Alterna sozinha
  // entre a logo e a previsão (ícone + temperatura); um toque troca na hora.
  function montarTopo() {
    const logo = document.querySelector('.top-bar-logo');
    if (!logo || document.querySelector('.clima-topo')) return;
    const palco = document.createElement('button');
    palco.type = 'button';
    palco.className = 'clima-topo';
    palco.setAttribute('aria-label', 'Alternar entre a logo e a previsão do tempo');
    logo.replaceWith(palco);
    logo.classList.add('clima-topo-face', 'ativa');
    palco.appendChild(logo);
    const mini = document.createElement('span');
    mini.className = 'clima-topo-face clima-topo-mini';
    palco.appendChild(mini);

    const celular = window.matchMedia('(max-width: 768px)');
    let mostrandoClima = false;
    let timer = null;
    let animacao = null;

    async function mostrar(clima) {
      if (clima) {
        const p = await previsao();
        if (animacao) animacao.parar();
        mini.innerHTML = `<span class="clima-topo-icone"></span><span class="clima-topo-temp">${p.temperatura}°</span>`;
        const alvo = mini.querySelector('.clima-topo-icone');
        if (window.ClimaFerro) animacao = window.ClimaFerro.montar(alvo, p.icone, { cor: '#ffffff' });
        palco.setAttribute('aria-label', `${p.condicao}, ${p.temperatura} graus. Tocar para voltar à logo`);
      } else {
        palco.setAttribute('aria-label', 'Logo KERNEL. Tocar para ver a previsão do tempo');
      }
      mostrandoClima = clima;
      logo.classList.toggle('ativa', !clima);
      mini.classList.toggle('ativa', clima);
      agendar();
    }

    function agendar() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (celular.matches && !document.hidden) mostrar(!mostrandoClima);
        else agendar();
      }, mostrandoClima ? TEMPO_CLIMA : TEMPO_LOGO);
    }

    palco.addEventListener('click', () => mostrar(!mostrandoClima));
    agendar();
  }

  function iniciar() {
    montar();
    montarTopo();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
