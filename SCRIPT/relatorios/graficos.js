//======================================================================================================
// RELATORIOS - graficos em SVG puro
// Sem biblioteca externa e sem CDN, pela mesma razao ja adotada no resto do
// projeto: o painel precisa abrir mesmo sem internet, e um <script> remoto que
// nao carrega deixa a tela em branco sem explicacao.
//
// Sao apenas quatro formas, escolhidas por utilidade e nao por variedade:
//   linhas  - evolucao ao longo do tempo (comparar duas series)
//   barras  - ranking (comparar grandezas entre categorias)
//   rosca   - composicao de um total (poucas fatias)
// Em celular o mesmo SVG e reaproveitado com viewBox menor e menos rotulos.
//======================================================================================================
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const escapar = (t) => window.RelatoriosApi.escaparHtml(t);

  // Paleta alinhada ao KERNEL: bronze da marca como cor principal, cinza-azulado
  // como apoio, ambar/vermelho reservados para alerta.
  const CORES = ['#A8864F', '#475569', '#86683A', '#94a3b8', '#ed6c02',
                 '#c62828', '#334155', '#d6c3a0'];

  function ehCelular() {
    return window.matchMedia('(max-width: 767px)').matches;
  }

  function criar(nome, atributos) {
    const elemento = document.createElementNS(NS, nome);
    Object.entries(atributos || {}).forEach(([chave, valor]) => {
      if (valor !== null && valor !== undefined) {
        elemento.setAttribute(chave, valor);
      }
    });
    return elemento;
  }

  function envelope(largura, altura) {
    const svg = criar('svg', {
      viewBox: '0 0 ' + largura + ' ' + altura,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      class: 'rel-svg',
    });
    return svg;
  }

  function vazio(alvo, mensagem) {
    window.RelatoriosApi.estadoVazio(alvo, mensagem || 'Sem dados no período');
  }

  //=============================================================== LINHAS
  function linhas(alvo, serie, series) {
    if (!alvo) return;
    if (!serie || !serie.length) return vazio(alvo);

    const celular = ehCelular();
    const L = 720, A = celular ? 240 : 280;
    const margem = { topo: 18, dir: 14, baixo: 34, esq: 42 };
    const larguraUtil = L - margem.esq - margem.dir;
    const alturaUtil = A - margem.topo - margem.baixo;

    const maximo = Math.max(
      1,
      ...series.flatMap((s) => serie.map((ponto) => Number(ponto[s.campo]) || 0))
    );

    const svg = envelope(L, A);
    const x = (indice) => margem.esq + (serie.length === 1
      ? larguraUtil / 2
      : (indice * larguraUtil) / (serie.length - 1));
    const y = (valor) => margem.topo + alturaUtil - (valor / maximo) * alturaUtil;

    // Grade horizontal + eixo Y
    const linhasGrade = 4;
    for (let i = 0; i <= linhasGrade; i++) {
      const valor = (maximo / linhasGrade) * i;
      const posicao = y(valor);
      svg.appendChild(criar('line', {
        x1: margem.esq, x2: L - margem.dir, y1: posicao, y2: posicao,
        class: 'rel-svg-grade',
      }));
      const rotulo = criar('text', {
        x: margem.esq - 8, y: posicao + 4, class: 'rel-svg-eixo',
        'text-anchor': 'end',
      });
      rotulo.textContent = Math.round(valor);
      svg.appendChild(rotulo);
    }

    // Rotulos do eixo X: em telas pequenas mostra no maximo 4, senao o texto
    // vira uma mancha ilegivel.
    const maximoRotulos = celular ? 4 : 10;
    const passo = Math.max(1, Math.ceil(serie.length / maximoRotulos));
    serie.forEach((ponto, indice) => {
      if (indice % passo !== 0 && indice !== serie.length - 1) return;
      const rotulo = criar('text', {
        x: x(indice), y: A - 10, class: 'rel-svg-eixo', 'text-anchor': 'middle',
      });
      rotulo.textContent = ponto.rotulo || ponto.chave || '';
      svg.appendChild(rotulo);
    });

    series.forEach((definicao, ordem) => {
      const cor = definicao.cor || CORES[ordem % CORES.length];
      const pontos = serie.map((ponto, indice) =>
        x(indice) + ',' + y(Number(ponto[definicao.campo]) || 0)).join(' ');

      svg.appendChild(criar('polyline', {
        points: pontos, fill: 'none', stroke: cor, 'stroke-width': 2.5,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      }));

      serie.forEach((ponto, indice) => {
        const valor = Number(ponto[definicao.campo]) || 0;
        const circulo = criar('circle', {
          cx: x(indice), cy: y(valor), r: celular ? 3 : 3.5, fill: cor,
        });
        const titulo = criar('title');
        titulo.textContent = (ponto.rotulo || ponto.chave) + ' — '
          + definicao.nome + ': ' + valor;
        circulo.appendChild(titulo);
        svg.appendChild(circulo);
      });
    });

    const legenda = series.map((definicao, ordem) =>
      '<span class="rel-legenda-item"><i style="background:'
      + (definicao.cor || CORES[ordem % CORES.length]) + '"></i>'
      + escapar(definicao.nome) + '</span>').join('');

    alvo.innerHTML = '<div class="rel-legenda">' + legenda + '</div>';
    alvo.appendChild(svg);
  }

  //=============================================================== BARRAS
  function barras(alvo, itens, opcoes) {
    if (!alvo) return;
    if (!itens || !itens.length) return vazio(alvo);

    const config = opcoes || {};
    const celular = ehCelular();
    const lista = itens.slice(0, celular ? 5 : 8);
    const maximo = Math.max(1, ...lista.map((i) => Number(i.valor) || 0));

    // Em celular a barra horizontal com rotulo fica ilegivel abaixo de ~380px:
    // vira lista de cards, que e o formato que se le com o polegar.
    if (celular) {
      alvo.innerHTML = '<ul class="rel-barras-lista">' + lista.map((item, ordem) => {
        const largura = ((Number(item.valor) || 0) / maximo) * 100;
        return '<li class="rel-barra-card"'
          + (item.id ? ' data-id="' + escapar(item.id) + '"' : '')
          + (config.acao ? ' data-acao="' + escapar(config.acao) + '"' : '')
          + '><div class="rel-barra-card-topo">'
          + '<span class="rel-barra-card-rotulo">' + escapar(item.rotulo) + '</span>'
          + '<strong>' + window.RelatoriosApi.numero(item.valor) + '</strong></div>'
          + '<div class="rel-barra-trilho"><span style="width:' + largura.toFixed(1)
          + '%;background:' + CORES[ordem % CORES.length] + '"></span></div>'
          + (item.detalhe ? '<small>' + escapar(item.detalhe) + '</small>' : '')
          + '</li>';
      }).join('') + '</ul>';
      return;
    }

    const alturaBarra = 26, espaco = 12;
    const L = 720;
    const margemEsq = 190;
    const A = lista.length * (alturaBarra + espaco) + 16;
    const svg = envelope(L, A);

    lista.forEach((item, ordem) => {
      const y = ordem * (alturaBarra + espaco) + 8;
      const valor = Number(item.valor) || 0;
      const largura = Math.max(2, (valor / maximo) * (L - margemEsq - 60));

      const rotulo = criar('text', {
        x: margemEsq - 10, y: y + alturaBarra / 2 + 4,
        class: 'rel-svg-rotulo', 'text-anchor': 'end',
      });
      const texto = String(item.rotulo || '');
      rotulo.textContent = texto.length > 26 ? texto.slice(0, 25) + '…' : texto;
      const tituloRotulo = criar('title');
      tituloRotulo.textContent = texto;
      rotulo.appendChild(tituloRotulo);
      svg.appendChild(rotulo);

      const grupo = criar('g', {
        class: config.acao ? 'rel-svg-clicavel' : null,
        'data-id': item.id || null,
        'data-acao': config.acao || null,
      });
      const barra = criar('rect', {
        x: margemEsq, y: y, width: largura, height: alturaBarra, rx: 6,
        fill: CORES[ordem % CORES.length],
      });
      const titulo = criar('title');
      titulo.textContent = texto + ' — ' + valor
        + (item.detalhe ? ' (' + item.detalhe + ')' : '');
      barra.appendChild(titulo);
      grupo.appendChild(barra);

      const numero = criar('text', {
        x: margemEsq + largura + 8, y: y + alturaBarra / 2 + 4,
        class: 'rel-svg-valor',
      });
      numero.textContent = window.RelatoriosApi.numero(valor);
      grupo.appendChild(numero);
      svg.appendChild(grupo);
    });

    alvo.innerHTML = '';
    alvo.appendChild(svg);
  }

  //=============================================================== ROSCA
  function rosca(alvo, itens) {
    if (!alvo) return;
    if (!itens || !itens.length) return vazio(alvo);

    const total = itens.reduce((soma, item) => soma + (Number(item.valor) || 0), 0);
    if (!total) return vazio(alvo);

    const lista = itens.slice(0, 7);
    const L = 320, A = 240, raio = 84, espessura = 30;
    const cx = 110, cy = A / 2;
    const svg = envelope(L, A);

    let anguloAtual = -Math.PI / 2;
    lista.forEach((item, ordem) => {
      const fatia = ((Number(item.valor) || 0) / total) * Math.PI * 2;
      const fim = anguloAtual + fatia;
      const grande = fatia > Math.PI ? 1 : 0;

      const x1 = cx + Math.cos(anguloAtual) * raio;
      const y1 = cy + Math.sin(anguloAtual) * raio;
      const x2 = cx + Math.cos(fim) * raio;
      const y2 = cy + Math.sin(fim) * raio;

      // Fatia de 100% nao pode ser desenhada como arco (inicio == fim):
      // vira um circulo completo, senao o grafico some.
      const caminho = fatia >= Math.PI * 2 - 0.0001
        ? criar('circle', {
            cx: cx, cy: cy, r: raio, fill: 'none',
            stroke: CORES[ordem % CORES.length], 'stroke-width': espessura,
          })
        : criar('path', {
            d: 'M ' + x1 + ' ' + y1 + ' A ' + raio + ' ' + raio + ' 0 '
               + grande + ' 1 ' + x2 + ' ' + y2,
            fill: 'none', stroke: CORES[ordem % CORES.length],
            'stroke-width': espessura,
          });

      const titulo = criar('title');
      titulo.textContent = item.rotulo + ' — ' + item.valor;
      caminho.appendChild(titulo);
      svg.appendChild(caminho);
      anguloAtual = fim;
    });

    const centro = criar('text', {
      x: cx, y: cy + 2, class: 'rel-svg-centro', 'text-anchor': 'middle',
    });
    centro.textContent = window.RelatoriosApi.numero(total);
    svg.appendChild(centro);
    const centroLegenda = criar('text', {
      x: cx, y: cy + 20, class: 'rel-svg-eixo', 'text-anchor': 'middle',
    });
    centroLegenda.textContent = 'ocorrências';
    svg.appendChild(centroLegenda);

    const legenda = lista.map((item, ordem) =>
      '<span class="rel-legenda-item"><i style="background:'
      + CORES[ordem % CORES.length] + '"></i>' + escapar(item.rotulo)
      + ' <b>' + window.RelatoriosApi.numero(item.valor) + '</b></span>').join('');

    alvo.innerHTML = '';
    const caixa = document.createElement('div');
    caixa.className = 'rel-rosca';
    caixa.appendChild(svg);
    const caixaLegenda = document.createElement('div');
    caixaLegenda.className = 'rel-legenda rel-legenda-coluna';
    caixaLegenda.innerHTML = legenda;
    caixa.appendChild(caixaLegenda);
    alvo.appendChild(caixa);
  }

  window.RelatoriosGraficos = {
    linhas: linhas,
    barras: barras,
    rosca: rosca,
    CORES: CORES,
    ehCelular: ehCelular,
  };
})();
