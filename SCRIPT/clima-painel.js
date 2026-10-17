//======================================================================================================
// PREVISÃO DO TEMPO NO LUGAR DA LOGO (painel lateral direito, computador)
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

    function mostrarLogo() {
      cartao.classList.remove('ativa');
      logo.classList.add('ativa');
      setTimeout(mostrarClima, TEMPO_LOGO);
    }

    async function mostrarClima() {
      // Painel escondido (celular) ou aba em segundo plano: não troca.
      if (!painel.getClientRects().length || getComputedStyle(painel).display === "none" || document.hidden) return setTimeout(mostrarClima, TEMPO_LOGO);
      const p = await previsao();
      cartao.innerHTML = `
        <img class="clima-icone" src="../IMG/clima/${p.icone}.svg" alt="">
        <div class="clima-info">
          <strong class="clima-temp">${p.temperatura}°</strong>
          <span class="clima-condicao">${p.condicao}</span>
          <span class="clima-extra">${p.cidade} · mín ${p.minima}° máx ${p.maxima}°</span>
        </div>`;
      logo.classList.remove('ativa');
      cartao.classList.add('ativa');
      setTimeout(mostrarLogo, TEMPO_CLIMA);
    }

    setTimeout(mostrarClima, 4000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
