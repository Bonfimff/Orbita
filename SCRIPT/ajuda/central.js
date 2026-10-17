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
    'conteudo-faq.js',
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
      script.src = BASE + arquivo + '?v=19';
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
  // Palavras que as pessoas usam no lugar das do manual.
  const SINONIMOS = {
    carro: ['veiculo'], caminhao: ['veiculo'], viatura: ['veiculo'], placa: ['veiculo'],
    apagar: ['excluir', 'remover'], deletar: ['excluir', 'remover'], remover: ['excluir'],
    criar: ['cadastr', 'abrir', 'nova'], novo: ['cadastr', 'nova'], adicionar: ['cadastr'],
    mudar: ['editar', 'trocar', 'alterar'], alterar: ['editar', 'trocar'], trocar: ['alterar', 'editar'],
    senha: ['login', 'entrar'], logar: ['entrar', 'login'], sair: ['sessao'],
    ordem: ['o.s'], chamado: ['o.s', 'chamados'], servico: ['o.s'],
    material: ['produto', 'estoque'], peca: ['produto', 'material'], item: ['produto'],
    permissao: ['perfil', 'acesso'], liberar: ['permiss', 'acesso'], bloquear: ['permiss'],
    oleo: ['alerta', 'manutencao'], revisao: ['manutencao', 'alerta'], conserto: ['manutencao'],
    combustivel: ['abastecimento'], gasolina: ['abastecimento'], tempo: ['previsao'], clima: ['previsao'],
    funcionario: ['equipe'], tecnico: ['equipe', 'funcionario'], cliente: ['contrato'],
  };

  function variantes(palavra) {
    const lista = [palavra];
    Object.keys(SINONIMOS).forEach((chave) => {
      if (palavra.startsWith(chave) || chave.startsWith(palavra) && palavra.length >= 4) lista.push(...SINONIMOS[chave]);
    });
    // "veiculos" acha "veiculo": tira o plural simples.
    if (palavra.length > 4 && palavra.endsWith('s')) lista.push(palavra.slice(0, -1));
    return lista;
  }

  function pesquisar(termo) {
    const alvo = normalizar(termo).trim();
    if (alvo.length < 2) return null;
    const palavras = alvo.split(/\s+/).filter((p) => p.length > 1 && !['de', 'da', 'do', 'um', 'uma', 'como', 'o', 'a', 'e', 'no', 'na'].includes(p));
    if (!palavras.length) return null;
    const grupos = palavras.map(variantes);
    const achados = [];

    secoes.forEach((secao) => {
      (secao.topicos || []).filter(topicoVisivel).forEach((topico) => {
        const original = textoDoTopico(topico) + ' ' + (topico.grupo || '');
        const texto = normalizar(original);
        const tituloNorm = normalizar(topico.titulo + ' ' + (topico.grupo || ''));
        // Cada palavra pesquisada (ou um sinônimo dela) precisa aparecer.
        if (!grupos.every((vs) => vs.some((v) => texto.includes(v)))) return;

        // Título vale mais que o corpo; a palavra exata vale mais que o sinônimo.
        let peso = 0;
        grupos.forEach((vs) => {
          if (tituloNorm.includes(vs[0])) peso += 12;
          else if (vs.some((v) => tituloNorm.includes(v))) peso += 6;
          if (texto.includes(vs[0])) peso += 3;
        });
        if (secao.id === 'manual') peso += 1;
        const primeira = grupos[0].find((v) => texto.includes(v)) || grupos[0][0];
        achados.push({ secao, topico, peso, termos: grupos.flat(), trecho: trechoDe(texto, original, primeira) });
      });
    });

    achados.sort((a, b) => b.peso - a.peso);
    return achados;
  }

  // Destaca os termos encontrados (ignorando acento e maiúsculas).
  function comMarcacao(texto, termos) {
    const original = String(texto);
    const norm = normalizar(original);
    const marcas = new Array(original.length).fill(false);
    termos.forEach((t) => {
      if (!t || t.length < 2) return;
      let i = norm.indexOf(t);
      while (i >= 0) {
        for (let k = i; k < i + t.length; k++) marcas[k] = true;
        i = norm.indexOf(t, i + t.length);
      }
    });
    let saida = '';
    let aberto = false;
    for (let k = 0; k < original.length; k++) {
      if (marcas[k] && !aberto) { saida += '<mark>'; aberto = true; }
      if (!marcas[k] && aberto) { saida += '</mark>'; aberto = false; }
      saida += escapar(original[k]);
    }
    return saida + (aberto ? '</mark>' : '');
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
                 'placeholder="Buscar na ajuda (ex.: trocar status do veículo)">' +
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
    busca.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      clearTimeout(debounce);
      const resultados = pesquisar(busca.value);
      if (resultados && resultados.length) abrirTopico(resultados[0].topico.id);
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
    let grupoAtual = null;
    indice.innerHTML = topicos.map((t) => {
      const cabeca = t.grupo && t.grupo !== grupoAtual ? '<span class="ajuda-indice-titulo">' + escapar(t.grupo) + '</span>' : '';
      grupoAtual = t.grupo || grupoAtual;
      return cabeca + '<button type="button" class="ajuda-indice-item" data-ir-topico="' +
        escapar(t.id) + '">' + escapar(t.titulo) + '</button>';
    }).join('');

    const conteudo = overlay.querySelector('#ajuda-conteudo');
    grupoAtual = null;
    conteudo.innerHTML =
      (secao.descricao ? '<p class="ajuda-secao-descricao">' + comDestaque(secao.descricao) + '</p>' : '') +
      topicos.map((t) => {
        const cabeca = t.grupo && t.grupo !== grupoAtual ? '<h2 class="ajuda-grupo">' + escapar(t.grupo) + '</h2>' : '';
        grupoAtual = t.grupo || grupoAtual;
        return cabeca + renderTopico(t);
      }).join('');
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
      resultados.map((r, i) =>
        '<button type="button" class="ajuda-resultado' + (i === 0 ? ' primeiro' : '') + '" data-ir-topico="' + escapar(r.topico.id) + '">' +
          '<span class="ajuda-resultado-secao">' + escapar(r.topico.grupo || r.secao.rotulo) +
            (r.secao.id !== 'manual' ? ' · ' + escapar(r.secao.rotulo) : '') + '</span>' +
          '<span class="ajuda-resultado-titulo">' + comMarcacao(r.topico.titulo, r.termos) + '</span>' +
          '<span class="ajuda-resultado-trecho">' + comMarcacao(r.trecho.replace(/\*\*/g, ''), r.termos) + '</span>' +
        '</button>').join('') +
      '<p class="ajuda-dica">Enter abre o primeiro resultado.</p>';
    conteudo.scrollTop = 0;
  }

  //------------------------------------------------------------ abrir/fechar
  // Tópico da página em que a pessoa está (e da aba, quando houver).
  function topicoDaPagina() {
    const pagina = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    const aba = (location.hash || '').replace('#', '') ||
      (document.querySelector('.content > .tab-content.active') || {}).id || '';
    const doManual = (secoes.find((s) => s.id === 'manual') || {}).topicos || [];
    const daPagina = doManual.filter((t) => t.pagina === pagina);
    return (daPagina.find((t) => t.aba && t.aba === aba) || daPagina[0] || {}).id || null;
  }

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
      if (!idSecao && !idTopico) {
        idTopico = topicoDaPagina();
        if (idTopico) idSecao = 'manual';
      }
      mostrarSecao(idSecao || secaoAtiva || (secoes[0] && secoes[0].id), idTopico);
      // No computador o cursor já vai para a busca.
      if (busca && window.matchMedia('(min-width: 769px)').matches) busca.focus({ preventScroll: true });
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
