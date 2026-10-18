//======================================================================================================
// FICHA DO REGISTRO (padrão de todas as tabelas)
// Clique na linha: abre esta janela só para ver. Dentro dela ficam as ações
// do registro: Editar (vai para a edição) e Excluir (só para quem pode).
// Nenhuma tabela tem botão de editar ou excluir na própria linha.
//
// Uso:
//   FichaRegistro.abrir({
//     titulo, subtitulo,
//     campos: [['Rótulo', 'valor'], ['Outro', '<b>html</b>', { html: true }]],  // vazios somem
//     corpo: 'html extra' | elemento,          // opcional (tabela, explorador...)
//     editar: () => {...}, podeEditar: true,   // sem editar, o botão não aparece
//     excluir: async () => {...}, podeExcluir: true, confirmar: 'Excluir este registro?',
//     semExcluir: 'motivo',                    // mostra o botão desativado com o motivo
//     acoes: [{ rotulo, fn, classe }],         // ações extras do registro
//     aoExcluir: () => {...},                  // depois de excluir (ex.: recarregar a lista)
//   })
//
// Permissão: passe podeEditar/podeExcluir já calculados ou use
// FichaRegistro.pode('modulo_chave', 'editar').
//======================================================================================================
(function () {
  'use strict';

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let fundo = null;
  let atual = null;

  function construir() {
    fundo = document.createElement('div');
    fundo.className = 'fr-fundo';
    fundo.hidden = true;
    fundo.innerHTML = `
      <div class="fr-janela" role="dialog" aria-modal="true" aria-labelledby="fr-titulo">
        <div class="fr-topo">
          <div class="fr-cabeca"><h3 id="fr-titulo"></h3><small class="fr-sub"></small></div>
          <button type="button" class="fr-fechar" aria-label="Fechar">&times;</button>
        </div>
        <div class="fr-conteudo">
          <dl class="fr-campos"></dl>
          <div class="fr-corpo"></div>
        </div>
        <div class="fr-msg" role="alert" hidden></div>
        <div class="fr-acoes"></div>
      </div>`;
    document.body.appendChild(fundo);
    fundo.addEventListener('click', (e) => {
      if (e.target === fundo || e.target.closest('.fr-fechar')) fechar();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && fundo && !fundo.hidden) fechar();
    });
  }

  function botao(rotulo, classe, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fr-btn ' + (classe || '');
    b.textContent = rotulo;
    if (fn) b.addEventListener('click', fn);
    return b;
  }

  function mensagem(texto) {
    const m = fundo.querySelector('.fr-msg');
    m.textContent = texto || '';
    m.hidden = !texto;
  }

  function abrir(o) {
    if (!fundo) construir();
    atual = o || {};
    fundo.querySelector('#fr-titulo').textContent = atual.titulo || 'Registro';
    fundo.querySelector('.fr-sub').textContent = atual.subtitulo || '';
    fundo.querySelector('.fr-campos').innerHTML = (atual.campos || [])
      .filter((c) => c && c[1] !== undefined && c[1] !== null && String(c[1]).trim() !== '')
      .map((c) => `<div${c[2] && c[2].largo ? ' class="fr-largo"' : ''}><dt>${esc(c[0])}</dt><dd>${c[2] && c[2].html ? c[1] : esc(c[1])}</dd></div>`)
      .join('');
    const corpo = fundo.querySelector('.fr-corpo');
    corpo.innerHTML = '';
    if (typeof atual.corpo === 'string') corpo.innerHTML = atual.corpo;
    else if (atual.corpo instanceof Node) corpo.appendChild(atual.corpo);
    mensagem('');

    const acoes = fundo.querySelector('.fr-acoes');
    acoes.innerHTML = '';
    if (atual.excluir && atual.podeExcluir !== false) {
      const bEx = botao(atual.rotuloExcluir || 'Excluir', 'fr-perigo', async () => {
        if (atual.confirmar !== false && !confirm(atual.confirmar || 'Excluir este registro? Essa ação não pode ser desfeita.')) return;
        bEx.disabled = true;
        try {
          await atual.excluir();
          const depois = atual.aoExcluir;
          fechar();
          if (depois) depois();
        } catch (e) {
          mensagem(e && e.message ? e.message : 'Não foi possível excluir.');
          bEx.disabled = false;
        }
      });
      if (atual.semExcluir) { bEx.disabled = true; bEx.title = atual.semExcluir; }
      acoes.appendChild(bEx);
    }
    const espaco = document.createElement('span');
    espaco.className = 'fr-espaco';
    acoes.appendChild(espaco);
    (atual.acoes || []).forEach((a) => {
      if (a && a.mostrar !== false) acoes.appendChild(botao(a.rotulo, a.classe || 'fr-secundario', () => a.fn(fechar)));
    });
    if (atual.editar && atual.podeEditar !== false) {
      acoes.appendChild(botao(atual.rotuloEditar || 'Editar', 'fr-primario', () => { const f = atual.editar; fechar(); f(); }));
    }
    acoes.appendChild(botao('Fechar', 'fr-secundario', fechar));
    fundo.hidden = false;
    document.body.classList.add('fr-aberta');
    const primeiro = acoes.querySelector('.fr-primario') || acoes.lastElementChild;
    if (primeiro) primeiro.focus({ preventScroll: true });
  }

  function fechar() {
    if (!fundo || fundo.hidden) return;
    fundo.hidden = true;
    document.body.classList.remove('fr-aberta');
    const o = atual;
    atual = null;
    if (o && o.aoFechar) o.aoFechar();
  }

  function pode(chave, acao) {
    return typeof window.temPermissao !== 'function' || window.temPermissao(chave, acao);
  }

  // Ajuda para tabelas: marca as linhas como clicáveis e liga clique e Enter.
  // seletor: linhas (ex.: 'tr[data-id]'); fn(linha, evento).
  function ligarTabela(container, seletor, fn) {
    if (!container || container.dataset.frLigada === seletor) return;
    container.dataset.frLigada = seletor;
    container.addEventListener('click', (e) => {
      const linha = e.target.closest(seletor);
      if (!linha || !container.contains(linha)) return;
      if (e.target.closest('button, a, input, select, textarea, label')) return;
      fn(linha, e);
    });
    container.addEventListener('keydown', (e) => {
      const linha = e.target.closest(seletor);
      if (linha && e.key === 'Enter' && e.target === linha) fn(linha, e);
    });
  }

  // Tabela só de consulta: o clique na linha mostra cabeçalho e valor de cada
  // coluna. Serve para relatórios e listas sem cadastro próprio.
  // opcoes: { titulo: (linha, celulas) => texto, subtitulo, acoes: (linha) => [{rotulo, fn}] }
  function ligarConsulta(tabela, opcoes) {
    if (!tabela) return;
    const o = opcoes || {};
    const tbody = tabela.tBodies[0];
    if (!tbody) return;
    const marcar = () => tbody.querySelectorAll(':scope > tr').forEach((tr) => {
      if (tr.cells.length > 1 && !tr.hasAttribute('data-fr')) { tr.setAttribute('data-fr', 'consulta'); tr.tabIndex = 0; }
    });
    marcar();
    new MutationObserver(marcar).observe(tbody, { childList: true });
    ligarTabela(tbody, 'tr[data-fr="consulta"]', (tr) => {
      const cab = Array.from((tabela.tHead && tabela.tHead.rows[0] ? tabela.tHead.rows[0].cells : []));
      const celulas = Array.from(tr.cells);
      const campos = celulas
        .filter((td) => td.style.display !== 'none' && td.dataset.coluna !== 'acao' && !td.querySelector('button'))
        .map((td) => { const i = celulas.indexOf(td); const th = (td.dataset.coluna && cab.find((h) => h.dataset.coluna === td.dataset.coluna)) || cab[i]; return [th ? th.textContent.trim() : 'Coluna ' + (i + 1), td.innerHTML.trim(), { html: true }]; })
        .filter((c) => c[0] && c[1] && c[1] !== '-');
      abrir({
        titulo: o.titulo ? o.titulo(tr, celulas) : (celulas[0] ? celulas[0].textContent.trim() : 'Registro'),
        subtitulo: o.subtitulo || '',
        campos: campos,
        acoes: o.acoes ? o.acoes(tr, celulas) : [],
      });
    });
  }

  // DELETE na API; lança erro com a mensagem do servidor (a ficha mostra).
  async function apagar(caminho) {
    const resp = await fetch(typeof window.apiUrl === 'function' ? window.apiUrl(caminho) : caminho, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
    });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok || (dados.status && dados.status !== 'ok' && dados.status !== 'sucesso')) {
      throw new Error(dados.mensagem || dados.erro || 'Não foi possível excluir.');
    }
    return dados;
  }

  window.FichaRegistro = { abrir, fechar, pode, ligarTabela, ligarConsulta, apagar, escapar: esc };
})();
