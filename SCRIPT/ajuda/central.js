//======================================================================================================
// CENTRAL DE INFORMACAO E AJUDA
//
// Motor da Central. Nao contem conteudo: o conteudo mora em arquivos proprios
// (SCRIPT/ajuda/conteudo-*.js), carregados SOB DEMANDA na primeira vez que a
// Central e aberta. Assim nenhuma pagina paga o custo do manual inteiro so por
// ter o icone no rodape, e acrescentar documentacao nao mexe neste arquivo.
//
// COMO E ABERTA
//   Pelo icone (i) do rodape do menu lateral, que ja existia em todas as
//   paginas. O icone continua sendo UM so - a Central e que ganhou secoes
//   internas. Nao pertence a Gestao: e documentacao, nao administracao.
//
// PERMISSAO
//   Nenhuma. Consultar o manual nao exige permissao administrativa. Um topico
//   pode declarar `modulo: 'x'` para, no futuro, ser filtrado pelas permissoes
//   que /modulos ja devolve - a funcao `topicoVisivel` abaixo e o unico ponto
//   que precisaria mudar para isso, e ela ja consulta window.obterModulos().
//
// AJUDA CONTEXTUAL
//   Qualquer elemento da plataforma pode virar um gatilho de ajuda so
//   ganhando o atributo `data-ajuda="id-do-topico"`. Um listener delegado no
//   documento cuida do resto - nao e preciso registrar nada por campo. Ver
//   `window.OrbitaAjuda.abrirTopico`.
//======================================================================================================
(function () {
  'use strict';

  // Base do diretorio deste script, para achar os arquivos de conteudo sem
  // depender de onde a pagina que o carregou esta.
  const BASE = (function () {
    const atual = document.currentScript && document.currentScript.src;
    return atual ? atual.replace(/[^/]+$/, '') : '../SCRIPT/ajuda/';
  })();

  const ARQUIVOS_CONTEUDO = [
    'conteudo-manual.js',
    'conteudo-guia.js',
    'conteudo-faq.js',
    'conteudo-sobre.js',
  ];

  const secoes = [];
  let carregamento = null;
  let overlay = null;
  let secaoAtiva = null;
  let topicoAtivo = null;

  //--------------------------------------------------------------- registro
  // Chamada pelos arquivos de conteudo. Cada secao: {id, rotulo, ordem, topicos[]}
  function registrarSecao(secao) {
    if (!secao || !secao.id) return;
    const existente = secoes.findIndex((s) => s.id === secao.id);
    if (existente >= 0) secoes[existente] = secao;
    else secoes.push(secao);
    secoes.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
  }

  function carregarConteudo() {
    if (carregamento) return carregamento;
    carregamento = Promise.all(ARQUIVOS_CONTEUDO.map((arquivo) => new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = BASE + arquivo;
      // Um arquivo de conteudo que falhe nao pode derrubar a Central inteira:
      // resolve mesmo em erro, e a secao correspondente simplesmente nao aparece.
      script.onload = resolve;
      script.onerror = () => { console.error('[ajuda] falhou ao carregar', arquivo); resolve(); };
      document.head.appendChild(script);
    })));
    return carregamento;
  }

  //------------------------------------------------------------ visibilidade
  // Hoje todo topico e visivel. O gancho existe para que um topico marcado com
  // `modulo` possa, no futuro, respeitar as permissoes que ja existem - sem
  // criar um segundo sistema de autorizacao.
  let modulosUsuario = null;
  function topicoVisivel(topico) {
    if (!topico.exigeModulo) return true;
    if (!modulosUsuario) return true; // permissoes ainda nao carregadas: nao esconde
    return !!modulosUsuario[topico.exigeModulo];
  }

  //-------------------------------------------------------------- utilidades
  function escapar(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Aceita **negrito** dentro do texto dos blocos - o suficiente para destacar
  // nomes de tela e botoes sem transformar isto num parser de markdown.
  function comDestaque(texto) {
    return escapar(texto).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function normalizar(texto) {
    return String(texto || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }

  // Texto puro de um topico - usado pela pesquisa, para que ela busque o
  // conteudo REAL e nao uma lista de palavras-chave paralela.
  function textoDoTopico(topico) {
    const partes = [topico.titulo, topico.modulo || ''];
    (topico.corpo || []).forEach((bloco) => {
      if (bloco.texto) partes.push(bloco.texto);
      (bloco.itens || []).forEach((item) => partes.push(typeof item === 'string' ? item : (item.texto || '')));
      (bloco.linhas || []).forEach((linha) => partes.push(linha.join(' ')));
      (bloco.cabecalho || []).forEach((celula) => partes.push(celula));
    });
    return partes.join(' \n ');
  }

  //---------------------------------------------------------------- render
  function renderBloco(bloco) {
    switch (bloco.tipo) {
      case 'subtitulo':
        return '<h4 class="ajuda-subtitulo">' + escapar(bloco.texto) + '</h4>';
      case 'lista':
        return '<ul class="ajuda-lista">' +
          (bloco.itens || []).map((i) => '<li>' + comDestaque(i) + '</li>').join('') + '</ul>';
      case 'passos':
        return '<ol class="ajuda-passos">' +
          (bloco.itens || []).map((i) => '<li>' + comDestaque(i) + '</li>').join('') + '</ol>';
      case 'aviso':
        return '<div class="ajuda-aviso">' + comDestaque(bloco.texto) + '</div>';
      case 'nota':
        return '<div class="ajuda-nota">' + comDestaque(bloco.texto) + '</div>';
      case 'tabela':
        return '<div class="ajuda-tabela-wrap"><table class="ajuda-tabela">' +
          '<thead><tr>' + (bloco.cabecalho || []).map((c) => '<th>' + escapar(c) + '</th>').join('') + '</tr></thead>' +
          '<tbody>' + (bloco.linhas || []).map((linha) =>
            '<tr>' + linha.map((c) => '<td>' + comDestaque(c) + '</td>').join('') + '</tr>').join('') +
          '</tbody></table></div>';
      case 'pergunta':
        return '<div class="ajuda-faq-item">' +
          '<p class="ajuda-faq-pergunta">' + escapar(bloco.texto) + '</p>' +
          '<div class="ajuda-faq-resposta">' + comDestaque(bloco.resposta || '') + '</div></div>';
      default:
        return '<p class="ajuda-paragrafo">' + comDestaque(bloco.texto) + '</p>';
    }
  }

  function renderTopico(topico) {
    const relacionados = (topico.relacionados || [])
      .map((id) => acharTopico(id))
      .filter(Boolean);

    return '<article class="ajuda-topico" id="ajuda-topico-' + escapar(topico.id) + '">' +
      (topico.modulo ? '<span class="ajuda-modulo-tag">' + escapar(topico.modulo) + '</span>' : '') +
      '<h3 class="ajuda-topico-titulo">' + escapar(topico.titulo) + '</h3>' +
      (topico.corpo || []).map(renderBloco).join('') +
      (relacionados.length
        ? '<div class="ajuda-relacionados"><span>Veja também:</span> ' +
          relacionados.map((t) => '<button type="button" class="ajuda-link" data-ir-topico="' +
            escapar(t.id) + '">' + escapar(t.titulo) + '</button>').join('') + '</div>'
        : '') +
      '</article>';
  }

  function acharTopico(id) {
    for (const secao of secoes) {
      const achado = (secao.topicos || []).find((t) => t.id === id);
      if (achado) return achado;
    }
    return null;
  }

  function secaoDoTopico(id) {
    return secoes.find((s) => (s.topicos || []).some((t) => t.id === id)) || null;
  }

  //---------------------------------------------------------------- pesquisa
  function pesquisar(termo) {
    const alvo = normalizar(termo).trim();
    if (alvo.length < 2) return null;
    const palavras = alvo.split(/\s+/);
    const achados = [];

    secoes.forEach((secao) => {
      (secao.topicos || []).filter(topicoVisivel).forEach((topico) => {
        const texto = normalizar(textoDoTopico(topico));
        const tituloNorm = normalizar(topico.titulo);
        // Exige TODAS as palavras: pesquisar "retirada material" nao pode
        // devolver tudo que fala so de material.
        if (!palavras.every((p) => texto.includes(p))) return;

        // Titulo vale mais que corpo, para o resultado mais obvio vir primeiro.
        let peso = 0;
        palavras.forEach((p) => { if (tituloNorm.includes(p)) peso += 10; });
        const indice = texto.indexOf(palavras[0]);
        peso += Math.max(0, 5 - Math.floor(indice / 200));

        achados.push({ secao: secao, topico: topico, peso: peso, trecho: trechoDe(texto, textoDoTopico(topico), palavras[0]) });
      });
    });

    achados.sort((a, b) => b.peso - a.peso);
    return achados;
  }

  function trechoDe(textoNorm, textoOriginal, palavra) {
    const idx = textoNorm.indexOf(palavra);
    if (idx < 0) return textoOriginal.slice(0, 140);
    const inicio = Math.max(0, idx - 60);
    return (inicio > 0 ? '…' : '') + textoOriginal.slice(inicio, idx + 100).replace(/\s+/g, ' ').trim() + '…';
  }

  //------------------------------------------------------------------ shell
  function construir() {
    overlay = document.createElement('div');
    overlay.className = 'ajuda-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Central de Informação e Ajuda');
    overlay.innerHTML =
      '<div class="ajuda-painel">' +
        '<header class="ajuda-cabecalho">' +
          '<div class="ajuda-cabecalho-texto">' +
            '<span class="ajuda-cabecalho-titulo">Informações e Ajuda</span>' +
            '<span class="ajuda-cabecalho-sub" id="ajuda-versao"></span>' +
          '</div>' +
          '<button type="button" class="ajuda-fechar" id="ajuda-fechar" aria-label="Fechar">&times;</button>' +
        '</header>' +
        '<div class="ajuda-busca-area">' +
          '<input type="search" id="ajuda-busca" class="ajuda-busca" autocomplete="off" ' +
                 'placeholder="Pesquisar no Manual, FAQ e Guia Rápido...">' +
        '</div>' +
        '<nav class="ajuda-secoes" id="ajuda-secoes" aria-label="Seções da ajuda"></nav>' +
        '<div class="ajuda-corpo">' +
          '<aside class="ajuda-indice" id="ajuda-indice" aria-label="Índice"></aside>' +
          '<div class="ajuda-conteudo" id="ajuda-conteudo"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('#ajuda-fechar').addEventListener('click', fechar);
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) fechar(); });

    const busca = overlay.querySelector('#ajuda-busca');
    let debounce = null;
    busca.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => aplicarBusca(busca.value), 150);
    });

    // Navegacao interna (relacionados / resultados de busca / indice)
    overlay.addEventListener('click', (ev) => {
      const irTopico = ev.target.closest('[data-ir-topico]');
      if (irTopico) { abrirTopico(irTopico.dataset.irTopico); return; }
      const irSecao = ev.target.closest('[data-ir-secao]');
      if (irSecao) { mostrarSecao(irSecao.dataset.irSecao); return; }
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && overlay && overlay.classList.contains('aberto')) fechar();
    });
  }

  function renderSecoes() {
    const nav = overlay.querySelector('#ajuda-secoes');
    nav.innerHTML = secoes.map((s) =>
      '<button type="button" class="ajuda-secao-btn' + (s.id === secaoAtiva ? ' active' : '') + '" ' +
      'data-ir-secao="' + escapar(s.id) + '">' + escapar(s.rotulo) + '</button>').join('');

    const versao = overlay.querySelector('#ajuda-versao');
    const meta = window.OrbitaAjuda.META;
    versao.textContent = meta
      ? meta.produto + ' ' + meta.versao + ' · Documentação atualizada em ' + meta.atualizadoEm
      : '';
  }

  function mostrarSecao(id, idTopicoFoco) {
    const secao = secoes.find((s) => s.id === id) || secoes[0];
    if (!secao) return;
    secaoAtiva = secao.id;

    overlay.querySelectorAll('[data-ir-secao]').forEach((b) => {
      b.classList.toggle('active', b.dataset.irSecao === secaoAtiva);
    });

    const topicos = (secao.topicos || []).filter(topicoVisivel);

    const indice = overlay.querySelector('#ajuda-indice');
    indice.innerHTML = '<span class="ajuda-indice-titulo">' + escapar(secao.rotulo) + '</span>' +
      topicos.map((t) => '<button type="button" class="ajuda-indice-item" data-ir-topico="' +
        escapar(t.id) + '">' + escapar(t.titulo) + '</button>').join('');

    const conteudo = overlay.querySelector('#ajuda-conteudo');
    conteudo.innerHTML =
      '<div class="ajuda-trilha">Informações e Ajuda <span>›</span> ' + escapar(secao.rotulo) + '</div>' +
      (secao.descricao ? '<p class="ajuda-secao-descricao">' + comDestaque(secao.descricao) + '</p>' : '') +
      topicos.map(renderTopico).join('');
    conteudo.scrollTop = 0;

    if (idTopicoFoco) irAoTopicoNaPagina(idTopicoFoco);
    marcarIndiceAtivo(idTopicoFoco || (topicos[0] && topicos[0].id));
  }

  function marcarIndiceAtivo(id) {
    topicoAtivo = id;
    overlay.querySelectorAll('.ajuda-indice-item').forEach((b) => {
      b.classList.toggle('active', b.dataset.irTopico === id);
    });
  }

  function irAoTopicoNaPagina(id) {
    const alvo = overlay.querySelector('#ajuda-topico-' + CSS.escape(id));
    if (!alvo) return;
    alvo.scrollIntoView({ block: 'start', behavior: 'smooth' });
    alvo.classList.add('ajuda-topico-destaque');
    setTimeout(() => alvo.classList.remove('ajuda-topico-destaque'), 1600);
  }

  function aplicarBusca(termo) {
    const resultados = pesquisar(termo);
    if (resultados === null) { mostrarSecao(secaoAtiva); return; }

    overlay.querySelectorAll('[data-ir-secao]').forEach((b) => b.classList.remove('active'));
    const indice = overlay.querySelector('#ajuda-indice');
    indice.innerHTML = '<span class="ajuda-indice-titulo">Resultados</span>' +
      '<span class="ajuda-indice-vazio">' + resultados.length + ' encontrado(s)</span>';

    const conteudo = overlay.querySelector('#ajuda-conteudo');
    if (!resultados.length) {
      conteudo.innerHTML = '<div class="ajuda-trilha">Pesquisa</div>' +
        '<p class="ajuda-vazio">Nenhum conteúdo encontrado para <strong>' + escapar(termo) + '</strong>.</p>';
      return;
    }
    conteudo.innerHTML = '<div class="ajuda-trilha">Pesquisa <span>›</span> "' + escapar(termo) + '"</div>' +
      resultados.map((r) =>
        '<button type="button" class="ajuda-resultado" data-ir-topico="' + escapar(r.topico.id) + '">' +
          '<span class="ajuda-resultado-secao">' + escapar(r.secao.rotulo) +
            (r.topico.modulo ? ' · ' + escapar(r.topico.modulo) : '') + '</span>' +
          '<span class="ajuda-resultado-titulo">' + escapar(r.topico.titulo) + '</span>' +
          '<span class="ajuda-resultado-trecho">' + escapar(r.trecho) + '</span>' +
        '</button>').join('');
    conteudo.scrollTop = 0;
  }

  //------------------------------------------------------------ abrir/fechar
  function abrir(idSecao, idTopico) {
    if (!overlay) construir();
    overlay.classList.add('aberto');
    document.body.classList.add('ajuda-aberta');

    return carregarConteudo().then(() => {
      // Permissoes so para o gancho de visibilidade; a Central abre mesmo sem elas.
      if (!modulosUsuario && typeof window.obterModulos === 'function') {
        window.obterModulos().then((info) => { modulosUsuario = info && info.modulos; }).catch(() => {});
      }
      renderSecoes();
      const busca = overlay.querySelector('#ajuda-busca');
      if (busca) busca.value = '';
      mostrarSecao(idSecao || secaoAtiva || (secoes[0] && secoes[0].id), idTopico);
    });
  }

  function abrirTopico(id) {
    const secao = secaoDoTopico(id);
    if (!secao) {
      // Topico ainda nao documentado: abre a Central em vez de nao fazer nada.
      return abrir();
    }
    if (!overlay || !overlay.classList.contains('aberto')) return abrir(secao.id, id);
    const busca = overlay.querySelector('#ajuda-busca');
    if (busca) busca.value = '';
    mostrarSecao(secao.id, id);
  }

  function fechar() {
    if (!overlay) return;
    overlay.classList.remove('aberto');
    document.body.classList.remove('ajuda-aberta');
  }

  //--------------------------------------------------- ajuda contextual (i)
  // Qualquer elemento com data-ajuda="id-do-topico" vira gatilho. Delegado no
  // documento: funciona tambem para conteudo inserido depois (modais, tabelas
  // renderizadas por JS), sem precisar religar nada.
  document.addEventListener('click', (ev) => {
    const gatilho = ev.target.closest('[data-ajuda]');
    if (!gatilho) return;
    ev.preventDefault();
    abrirTopico(gatilho.getAttribute('data-ajuda'));
  });

  window.OrbitaAjuda = {
    META: null,               // preenchido por conteudo-sobre.js
    registrarSecao: registrarSecao,
    abrir: abrir,
    abrirTopico: abrirTopico,
    fechar: fechar,
    pesquisar: function (termo) { return carregarConteudo().then(() => pesquisar(termo)); },
    // Cria o botaozinho (i) para ajuda contextual ao lado de um rotulo.
    botaoContextual: function (idTopico, rotuloAcessivel) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ajuda-contextual';
      b.setAttribute('data-ajuda', idTopico);
      b.setAttribute('aria-label', rotuloAcessivel || 'Ajuda sobre este campo');
      b.title = rotuloAcessivel || 'Ajuda';
      b.textContent = 'i';
      return b;
    },
  };
})();
