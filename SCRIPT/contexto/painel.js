//======================================================================================================
// CONTEXTO OPERACIONAL - motor do painel lateral direito (#sidebar-content)
//
// Substitui o antigo bloco estatico "Sobre esta tela" por um componente
// reutilizavel: cada pagina so precisa chamar ContextPanel.render(...) com um
// titulo e uma lista de "blocos" ja calculados. Este arquivo NAO sabe nada
// sobre usuarios, bases, contratos etc - so sabe desenhar. Quem sabe o que
// mostrar em cada tela e SCRIPT/contexto/<pagina>.js.
//
// Reaproveita a mesma linguagem visual que ja existia em #sidebar-content
// (h4 + ul/li com borda esquerda), so que agora montada dinamicamente.
//======================================================================================================
(function () {
  'use strict';

  function escapar(texto) {
    const div = document.createElement('div');
    div.textContent = texto == null ? '' : String(texto);
    return div.innerHTML;
  }

  function alvo() {
    return document.getElementById('sidebar-content');
  }

  // ---- cache leve por URL, para nao repetir a mesma consulta ao trocar de
  // sub-aba e voltar. Invalidado manualmente via ContextPanel.invalidar().
  const cache = {};

  async function buscarComCache(caminho, ttlMs) {
    const agora = Date.now();
    const entrada = cache[caminho];
    if (entrada && (agora - entrada.quando) < (ttlMs || 15000)) {
      return entrada.promessa;
    }
    const promessa = window.RelatoriosApi.buscar(caminho, {}, 'ctx:' + caminho);
    cache[caminho] = { quando: agora, promessa };
    try {
      return await promessa;
    } catch (erro) {
      delete cache[caminho];
      throw erro;
    }
  }

  function invalidar(caminho) {
    if (caminho) delete cache[caminho];
    else Object.keys(cache).forEach((k) => delete cache[k]);
  }

  // ---- renderizacao ---------------------------------------------------
  function linhaBloco(bloco) {
    switch (bloco.tipo) {
      case 'titulo':
        return '<li class="ctx-subtitulo">' + escapar(bloco.texto) + '</li>';

      case 'kpi':
        return '<li class="ctx-kpi"><span class="ctx-kpi-rotulo">' + escapar(bloco.rotulo)
          + '</span><span class="ctx-kpi-valor">' + escapar(bloco.valor) + '</span></li>';

      case 'alerta':
        return '<li class="ctx-alerta"><span class="ctx-alerta-icone">⚠</span> '
          + escapar(bloco.texto) + '</li>';

      case 'status': {
        const icone = { verde: '🟢', amarelo: '🟡', vermelho: '🔴' }[bloco.cor] || '⚪';
        return '<li class="ctx-status">' + icone + ' ' + escapar(bloco.texto) + '</li>';
      }

      case 'atalho':
        return '<li class="ctx-atalho"><a href="' + escapar(bloco.href || '#') + '">→ '
          + escapar(bloco.texto) + '</a></li>';

      case 'separador':
        return '<li class="ctx-separador"></li>';

      case 'texto':
        return '<li class="ctx-texto">' + escapar(bloco.texto) + '</li>';

      default:
        return '';
    }
  }

  /**
   * spec = {
   *   titulo: 'Contexto Operacional' (opcional, tem esse valor por padrao),
   *   subtitulo: 'USUÁRIOS' (opcional - nome da secao em destaque),
   *   blocos: [ {tipo:'kpi', rotulo, valor}, {tipo:'alerta', texto}, ... ],
   * }
   * Sem `blocos` (ou array vazio) cai automaticamente no estado vazio -
   * regra 12: nunca preencher por preencher.
   */
  function render(spec) {
    const raiz = alvo();
    if (!raiz) return;

    const titulo = (spec && spec.titulo) || 'Contexto Operacional';
    const blocos = (spec && spec.blocos) || [];

    let html = '<h4>' + escapar(titulo) + '</h4>';
    if (spec && spec.subtitulo) {
      html += '<p class="ctx-subtitulo-topo">' + escapar(spec.subtitulo) + '</p>';
    }

    if (!blocos.length) {
      html += '<ul><li class="ctx-vazio">'
        + escapar(spec && spec.mensagemVazia || 'Nenhuma informação operacional adicional disponível.')
        + '</li></ul>';
    } else {
      html += '<ul>' + blocos.map(linhaBloco).join('') + '</ul>';
    }

    raiz.innerHTML = html;
  }

  function carregando(titulo) {
    const raiz = alvo();
    if (!raiz) return;
    raiz.innerHTML = '<h4>' + escapar(titulo || 'Contexto Operacional') + '</h4>'
      + '<div class="carregando-inline" role="status"><span class="carregando-inline-logo"></span><span class="carregando-inline-texto">Carregando...</span></div>';
  }

  function erro(titulo, mensagem) {
    const raiz = alvo();
    if (!raiz) return;
    raiz.innerHTML = '<h4>' + escapar(titulo || 'Contexto Operacional') + '</h4>'
      + '<ul><li class="ctx-texto">' + escapar(mensagem || 'Não foi possível carregar o contexto.') + '</li></ul>';
  }

  window.ContextPanel = {
    render: render,
    carregando: carregando,
    erro: erro,
    buscar: buscarComCache,
    invalidar: invalidar,
  };
})();
