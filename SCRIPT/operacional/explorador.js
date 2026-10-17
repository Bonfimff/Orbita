//======================================================================================================
// EXPLORADOR DE ARQUIVOS (estilo Windows)
// Pastas livres, exibição em Ícones ou Detalhes, menu do botão direito
// (Abrir, Baixar, Recortar, Copiar, Colar, Renomear, Excluir, Nova pasta,
// Proteger pasta), arrastar para mover (Ctrl copia), soltar arquivos do
// computador para enviar e atalhos do teclado (F2, Delete, Ctrl+C/X/V/A,
// Enter, Backspace, Alt+←/→). No celular, toque longo abre o menu.
//
// Uso: Explorador.montar(elemento, { base: '/equipamentos/1', podeAlterar, dados })
//   base: rotas {base}/arquivos, {base}/arquivos/<id>[/copiar], {base}/pastas[/<id>[/copiar]]
//   dados: { pastas: [...], arquivos: [...] } já carregados (opcional)
//======================================================================================================
(function () {
  'use strict';

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const url = (c) => (typeof window.apiUrl === 'function' ? window.apiUrl(c) : c);
  const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });
  const tamanho = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round((b || 0) / 1024)) + ' KB');
  const dataHora = (v) => (v ? v.slice(8, 10) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4) + ' ' + v.slice(11, 16) : '');
  const extensao = (nome) => (/\.([a-z0-9]{1,5})$/i.exec(nome || '') || [])[1]?.toLowerCase() || '';

  // Área de transferência compartilhada entre exploradores da página.
  let transferencia = null; // { modo: 'copiar'|'recortar', base, itens: [{tipo, id}] }

  const TIPOS = {
    pdf: ['PDF', '#d93025', 'Documento PDF'], doc: ['DOC', '#2b579a', 'Documento do Word'], docx: ['DOC', '#2b579a', 'Documento do Word'],
    xls: ['XLS', '#217346', 'Planilha do Excel'], xlsx: ['XLS', '#217346', 'Planilha do Excel'], csv: ['CSV', '#217346', 'Arquivo CSV'],
    ppt: ['PPT', '#c43e1c', 'Apresentação'], pptx: ['PPT', '#c43e1c', 'Apresentação'],
    jpg: ['JPG', '#8e44ad', 'Imagem'], jpeg: ['JPG', '#8e44ad', 'Imagem'], png: ['PNG', '#8e44ad', 'Imagem'], gif: ['GIF', '#8e44ad', 'Imagem'], webp: ['IMG', '#8e44ad', 'Imagem'],
    zip: ['ZIP', '#b7791f', 'Pasta compactada'], rar: ['RAR', '#b7791f', 'Arquivo compactado'], '7z': ['7Z', '#b7791f', 'Arquivo compactado'],
    txt: ['TXT', '#5f6b7a', 'Documento de texto'], log: ['LOG', '#5f6b7a', 'Documento de texto'], json: ['JSON', '#5f6b7a', 'Arquivo JSON'], xml: ['XML', '#5f6b7a', 'Arquivo XML'],
    dwg: ['DWG', '#0f766e', 'Desenho CAD'], dxf: ['DXF', '#0f766e', 'Desenho CAD'],
  };
  const tipoDe = (nome) => TIPOS[extensao(nome)] || [(extensao(nome) || 'ARQ').toUpperCase().slice(0, 4), '#64748b', 'Arquivo ' + (extensao(nome).toUpperCase() || '')];

  function iconePasta(protegida, grande) {
    const t = grande ? 56 : 20;
    return `<svg class="exp-svg" viewBox="0 0 48 40" width="${t}" height="${Math.round(t * 40 / 48)}" aria-hidden="true">
      <path d="M2 6a3 3 0 0 1 3-3h13l4 4h21a3 3 0 0 1 3 3v3H2z" fill="#e0a526"/>
      <path d="M2 11h44v24a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z" fill="#f7c948"/>
      <path d="M2 11h44v3H2z" fill="#fbd96b"/>
      ${protegida ? '<g transform="translate(29 20)"><rect x="1" y="7" width="14" height="11" rx="2" fill="#475569"/><path d="M4 7V5a4 4 0 0 1 8 0v2" fill="none" stroke="#475569" stroke-width="2.4"/></g>' : ''}
    </svg>`;
  }

  function iconeArquivo(nome, grande) {
    const [rot, cor] = tipoDe(nome);
    const t = grande ? 48 : 18;
    return `<svg class="exp-svg" viewBox="0 0 40 48" width="${Math.round(t * 40 / 48)}" height="${t}" aria-hidden="true">
      <path d="M4 2h22l10 10v32a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#fff" stroke="#c7ced8" stroke-width="1.5"/>
      <path d="M26 2v8a2 2 0 0 0 2 2h8" fill="#eef1f4" stroke="#c7ced8" stroke-width="1.5"/>
      ${grande ? `<rect x="0" y="26" width="30" height="13" rx="2" fill="${cor}"/><text x="15" y="35.5" text-anchor="middle" font-size="8.5" font-weight="700" font-family="Segoe UI, Arial" fill="#fff">${esc(rot)}</text>`
    : `<rect x="6" y="24" width="24" height="14" rx="2" fill="${cor}"/>`}
    </svg>`;
  }

  function montar(raiz, opcoes) {
    const base = opcoes.base;
    const podeAlterar = !!opcoes.podeAlterar;
    let dados = opcoes.dados || { pastas: [], arquivos: [] };
    let atual = null;          // id da pasta aberta (null = raiz)
    let voltar = [];
    let avancar = [];
    let selecao = new Set();   // 'p:12' | 'a:7'
    let ancora = null;
    let modo = 'icones';
    try { modo = localStorage.getItem('explorador.modo') || 'icones'; } catch (e) { /* sem armazenamento */ }

    raiz.classList.add('exp');
    raiz.innerHTML = `
      <div class="exp-barra">
        <div class="exp-nav">
          <button type="button" class="exp-btn" data-exp="voltar" title="Voltar (Alt+←)" aria-label="Voltar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></button>
          <button type="button" class="exp-btn" data-exp="avancar" title="Avançar (Alt+→)" aria-label="Avançar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
          <button type="button" class="exp-btn" data-exp="acima" title="Pasta acima (Backspace)" aria-label="Pasta acima"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>
        </div>
        <nav class="exp-caminho" aria-label="Local"></nav>
        <div class="exp-acoes">
          ${podeAlterar ? `<button type="button" class="exp-btn exp-btn-texto" data-exp="nova-pasta" title="Nova pasta">${iconePasta(false, false)}<span>Nova pasta</span></button>
          <button type="button" class="exp-btn exp-btn-texto" data-exp="enviar" title="Enviar arquivos"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg><span>Enviar</span></button>` : ''}
          <button type="button" class="exp-btn" data-exp="modo" title="Alternar Ícones / Detalhes" aria-label="Alternar exibição"></button>
        </div>
      </div>
      <div class="exp-area" tabindex="0" role="listbox" aria-multiselectable="true"></div>
      <div class="exp-status"><span class="exp-status-itens"></span><span class="exp-status-msg"></span></div>
      <input type="file" class="exp-entrada sem-botao-upload" multiple hidden>`;

    const area = raiz.querySelector('.exp-area');
    const caminhoEl = raiz.querySelector('.exp-caminho');
    const statusItens = raiz.querySelector('.exp-status-itens');
    const statusMsg = raiz.querySelector('.exp-status-msg');
    const entrada = raiz.querySelector('.exp-entrada');

    // ------------------------------------------------------------ dados
    const pastaPor = (id) => dados.pastas.find((p) => p.id === id);
    const filhos = (pai) => ({
      pastas: dados.pastas.filter((p) => (p.pai_id || null) === pai).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })),
      arquivos: dados.arquivos.filter((a) => (a.pasta_id || null) === pai).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })),
    });
    function caminhoDe(id) {
      const lista = [];
      let p = pastaPor(id);
      while (p) { lista.unshift(p); p = pastaPor(p.pai_id); }
      return lista;
    }
    function itemDe(chave) {
      const [t, id] = chave.split(':');
      return t === 'p' ? { tipo: 'pasta', id: Number(id), obj: pastaPor(Number(id)) } : { tipo: 'arquivo', id: Number(id), obj: dados.arquivos.find((a) => a.id === Number(id)) };
    }

    function mensagem(texto, erro) {
      statusMsg.textContent = texto || '';
      statusMsg.classList.toggle('erro', !!erro);
      clearTimeout(mensagem.t);
      if (texto) mensagem.t = setTimeout(() => { statusMsg.textContent = ''; }, erro ? 7000 : 3500);
    }

    async function pedir(metodo, caminho, corpo) {
      const formulario = corpo instanceof FormData;
      const resp = await fetch(url(base + caminho), {
        method: metodo,
        headers: Object.assign(formulario || !corpo ? {} : { 'Content-Type': 'application/json' }, auth()),
        body: corpo ? (formulario ? corpo : JSON.stringify(corpo)) : undefined,
      });
      const r = await resp.json().catch(() => ({}));
      if (!resp.ok || r.status !== 'ok') throw new Error(r.mensagem || (resp.status === 413 ? 'Arquivo grande demais.' : 'Não foi possível concluir.'));
      if (r.dados && r.dados.pastas) {
        dados = { pastas: r.dados.pastas, arquivos: r.dados.arquivos };
        if (atual !== null && !pastaPor(atual)) atual = null;
        if (typeof opcoes.aoMudar === 'function') opcoes.aoMudar(dados);
      }
      return r.dados || {};
    }

    // ------------------------------------------------------------ desenho
    function desenhar() {
      const { pastas, arquivos } = filhos(atual);
      const trilha = caminhoDe(atual);
      caminhoEl.innerHTML = `<button type="button" class="exp-seg" data-ir="raiz">${iconePasta(false, false)}${esc(opcoes.raizNome || 'Arquivos')}</button>` +
        trilha.map((p) => `<span class="exp-sep">›</span><button type="button" class="exp-seg" data-ir="${p.id}">${esc(p.nome)}</button>`).join('');
      raiz.querySelector('[data-exp="voltar"]').disabled = !voltar.length;
      raiz.querySelector('[data-exp="avancar"]').disabled = !avancar.length;
      raiz.querySelector('[data-exp="acima"]').disabled = atual === null;
      raiz.querySelector('[data-exp="modo"]').innerHTML = modo === 'icones'
        ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>'
        : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
      area.classList.toggle('exp-detalhes', modo === 'detalhes');
      const recortados = transferencia && transferencia.modo === 'recortar' && transferencia.base === base
        ? new Set(transferencia.itens.map((i) => (i.tipo === 'pasta' ? 'p:' : 'a:') + i.id)) : new Set();
      const itemHtml = (chave, nome, icone, data, tipo, tam, extra) => `
        <div class="exp-item${selecao.has(chave) ? ' sel' : ''}${recortados.has(chave) ? ' recortado' : ''}${extra || ''}" data-chave="${chave}" role="option" aria-selected="${selecao.has(chave)}" draggable="${podeAlterar}">
          <span class="exp-icone">${icone}</span>
          <span class="exp-nome" title="${esc(nome)}">${esc(nome)}</span>
          <span class="exp-col exp-data">${esc(data)}</span>
          <span class="exp-col exp-tipo">${esc(tipo)}</span>
          <span class="exp-col exp-tam">${esc(tam)}</span>
        </div>`;
      const grande = modo === 'icones';
      area.innerHTML = (modo === 'detalhes' ? '<div class="exp-cab"><span>Nome</span><span>Data de modificação</span><span>Tipo</span><span>Tamanho</span></div>' : '') +
        pastas.map((p) => itemHtml('p:' + p.id, p.nome, iconePasta(p.protegida, grande), dataHora(p.criado_em), p.protegida ? 'Pasta protegida' : 'Pasta de arquivos', '', p.bloqueada ? ' bloqueada' : '')).join('') +
        arquivos.map((a) => itemHtml('a:' + a.id, a.nome, iconeArquivo(a.nome, grande), dataHora(a.alterado_em || a.enviado_em), tipoDe(a.nome)[2], tamanho(a.tamanho))).join('') +
        (pastas.length || arquivos.length ? '' : `<div class="exp-vazio">Esta pasta está vazia.${podeAlterar ? '<br><small>Arraste arquivos para cá ou use o botão direito para criar uma pasta.</small>' : ''}</div>`);
      const total = pastas.length + arquivos.length;
      statusItens.textContent = total + (total === 1 ? ' item' : ' itens') + (selecao.size ? ` · ${selecao.size} selecionado${selecao.size > 1 ? 's' : ''}` : '');
    }

    function ir(pasta, historico) {
      const destino = pasta === 'raiz' || pasta === undefined ? null : pasta;
      const p = destino !== null ? pastaPor(destino) : null;
      if (p && p.bloqueada) { mensagem('Pasta protegida: só quem pode alterar o equipamento abre.', true); return; }
      if (historico !== false && destino !== atual) { voltar.push(atual); avancar = []; }
      atual = destino;
      selecao.clear();
      desenhar();
      area.focus({ preventScroll: true });
    }

    // ------------------------------------------------------------ seleção
    function chavesVisiveis() { return Array.from(area.querySelectorAll('[data-chave]')).map((e) => e.dataset.chave); }
    function selecionar(chave, ev) {
      if (ev && (ev.ctrlKey || ev.metaKey)) {
        if (selecao.has(chave)) selecao.delete(chave); else selecao.add(chave);
        ancora = chave;
      } else if (ev && ev.shiftKey && ancora) {
        const lista = chavesVisiveis();
        const [a, b] = [lista.indexOf(ancora), lista.indexOf(chave)].sort((x, y) => x - y);
        selecao = new Set(lista.slice(a, b + 1));
      } else {
        selecao = new Set([chave]);
        ancora = chave;
      }
      desenhar();
    }
    const selecionados = () => Array.from(selecao).map(itemDe).filter((i) => i.obj);

    // ------------------------------------------------------------ ações
    async function abrir(item, baixar) {
      if (item.tipo === 'pasta') { ir(item.id); return; }
      const a = item.obj;
      const visualiza = /^(application\/pdf|image\/|text\/)/.test(a.mime || '');
      const aba = !baixar && visualiza ? window.open('about:blank', '_blank') : null;
      try {
        const resp = await fetch(url(`${base}/arquivos/${a.id}`), { headers: auth() });
        if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error(d.mensagem || 'Não foi possível abrir o arquivo.'); }
        const link = URL.createObjectURL(await resp.blob());
        if (aba) {
          aba.location.href = link;
        } else {
          const tag = document.createElement('a');
          tag.href = link; tag.download = a.nome;
          document.body.appendChild(tag); tag.click(); tag.remove();
        }
        setTimeout(() => URL.revokeObjectURL(link), 60000);
      } catch (e) {
        if (aba) aba.close();
        mensagem(e.message, true);
      }
    }

    async function novaPasta(pai) {
      try {
        const r = await pedir('POST', '/pastas', { nome: 'Nova pasta', pai_id: pai });
        if (pai !== atual) ir(pai);
        selecao = new Set(['p:' + r.criada]);
        desenhar();
        renomear('p:' + r.criada);
      } catch (e) { mensagem(e.message, true); }
    }

    function renomear(chave) {
      const el = area.querySelector(`[data-chave="${chave}"] .exp-nome`);
      const item = itemDe(chave);
      if (!el || !item.obj || !podeAlterar) return;
      const original = item.obj.nome;
      const campo = document.createElement('textarea');
      campo.className = 'exp-renomear';
      campo.value = original;
      campo.rows = 1;
      el.replaceWith(campo);
      campo.focus();
      // Como no Windows: seleciona o nome sem a extensão.
      const ponto = item.tipo === 'arquivo' ? original.lastIndexOf('.') : -1;
      campo.setSelectionRange(0, ponto > 0 ? ponto : original.length);
      let feito = false;
      const concluir = async (salvar) => {
        if (feito) return;
        feito = true;
        const novo = campo.value.replace(/\s+/g, ' ').trim();
        if (!salvar || !novo || novo === original) { desenhar(); return; }
        if (/[\\/:*?"<>|]/.test(novo)) { mensagem('Um nome não pode conter \\ / : * ? " < > |', true); desenhar(); return; }
        try {
          await pedir('PUT', (item.tipo === 'pasta' ? '/pastas/' : '/arquivos/') + item.id, { nome: novo });
          desenhar();
        } catch (e) { mensagem(e.message, true); desenhar(); }
      };
      campo.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); concluir(true); }
        if (e.key === 'Escape') { e.preventDefault(); concluir(false); }
      });
      campo.addEventListener('blur', () => concluir(true));
      campo.addEventListener('mousedown', (e) => e.stopPropagation());
      campo.addEventListener('dblclick', (e) => e.stopPropagation());
    }

    async function excluir(itens) {
      if (!itens.length) return;
      const pastas = itens.filter((i) => i.tipo === 'pasta').length;
      const texto = itens.length === 1
        ? `Tem certeza de que deseja excluir ${itens[0].tipo === 'pasta' ? 'a pasta' : 'o arquivo'} "${itens[0].obj.nome}"${itens[0].tipo === 'pasta' ? ' e tudo o que há dentro dela' : ''}?`
        : `Tem certeza de que deseja excluir estes ${itens.length} itens${pastas ? ' (as pastas são excluídas com o conteúdo)' : ''}?`;
      if (!confirm(texto + '\n\nNão dá para desfazer.')) return;
      try {
        for (const i of itens) await pedir('DELETE', (i.tipo === 'pasta' ? '/pastas/' : '/arquivos/') + i.id);
        selecao.clear();
        desenhar();
        mensagem(itens.length === 1 ? 'Item excluído.' : itens.length + ' itens excluídos.');
      } catch (e) { mensagem(e.message, true); desenhar(); }
    }

    function guardar(modoTransferencia, itens) {
      if (!itens.length) return;
      transferencia = { modo: modoTransferencia, base, itens: itens.map((i) => ({ tipo: i.tipo, id: i.id })) };
      mensagem(itens.length + (itens.length === 1 ? ' item ' : ' itens ') + (modoTransferencia === 'copiar' ? 'copiado' : 'recortado') + (itens.length === 1 ? '' : 's') + '. Use Colar no destino.');
      desenhar();
    }

    async function moverOuCopiar(itens, destino, copiar) {
      try {
        for (const i of itens) {
          if (i.tipo === 'pasta') {
            if (copiar) await pedir('POST', `/pastas/${i.id}/copiar`, { pai_id: destino });
            else await pedir('PUT', `/pastas/${i.id}`, { pai_id: destino });
          } else if (copiar) {
            await pedir('POST', `/arquivos/${i.id}/copiar`, { pasta_id: destino });
          } else {
            await pedir('PUT', `/arquivos/${i.id}`, { pasta_id: destino });
          }
        }
        mensagem(copiar ? 'Copiado.' : 'Movido.');
      } catch (e) { mensagem(e.message, true); }
      desenhar();
    }

    async function colar(destino) {
      if (!transferencia || transferencia.base !== base) return;
      const t = transferencia;
      const itens = t.itens.map((i) => ({ tipo: i.tipo, id: i.id, obj: i.tipo === 'pasta' ? pastaPor(i.id) : dados.arquivos.find((a) => a.id === i.id) })).filter((i) => i.obj);
      if (t.modo === 'recortar') transferencia = null;
      await moverOuCopiar(itens, destino, t.modo === 'copiar');
    }

    async function alternarProtecao(item) {
      try {
        await pedir('PUT', '/pastas/' + item.id, { protegida: !item.obj.protegida });
        mensagem(item.obj.protegida ? 'Proteção removida.' : 'Pasta protegida: só quem pode alterar o equipamento abre o conteúdo.');
        desenhar();
      } catch (e) { mensagem(e.message, true); }
    }

    async function enviar(arquivos, destino) {
      if (!podeAlterar || !arquivos.length) return;
      const pasta = destino === undefined ? atual : destino;
      const erros = [];
      let ok = 0;
      for (let i = 0; i < arquivos.length; i++) {
        mensagem(`Enviando ${i + 1} de ${arquivos.length}: ${arquivos[i].name}`);
        const form = new FormData();
        if (pasta !== null) form.append('pasta_id', pasta);
        form.append('arquivos', arquivos[i]);
        try { await pedir('POST', '/arquivos', form); ok += 1; } catch (e) { erros.push(arquivos[i].name + ': ' + e.message); }
        desenhar();
      }
      entrada.value = '';
      if (erros.length) mensagem(erros.join(' · '), true);
      else mensagem(ok + (ok === 1 ? ' arquivo enviado.' : ' arquivos enviados.'));
    }

    // ------------------------------------------------------------ menu do botão direito
    let menu = null;
    function fecharMenu() { if (menu) { menu.remove(); menu = null; } }
    function abrirMenu(x, y, chave) {
      fecharMenu();
      const alvo = chave ? itemDe(chave) : null;
      const itens = alvo ? selecionados() : [];
      const um = itens.length === 1 ? itens[0] : null;
      const destinoColar = um && um.tipo === 'pasta' ? um.id : atual;
      const podeColar = podeAlterar && transferencia && transferencia.base === base;
      const op = [];
      if (alvo) {
        if (um) op.push(['abrir', um.tipo === 'pasta' ? 'Abrir' : 'Abrir', true]);
        if (itens.every((i) => i.tipo === 'arquivo')) op.push(['baixar', itens.length > 1 ? 'Baixar ' + itens.length + ' arquivos' : 'Baixar']);
        if (podeAlterar) {
          op.push('-', ['recortar', 'Recortar', false, 'Ctrl+X'], ['copiar', 'Copiar', false, 'Ctrl+C']);
          if (podeColar && um && um.tipo === 'pasta') op.push(['colar', 'Colar dentro', false, 'Ctrl+V']);
          op.push('-');
          if (um) op.push(['renomear', 'Renomear', false, 'F2']);
          op.push(['excluir', 'Excluir', false, 'Delete']);
          if (um && um.tipo === 'pasta') op.push('-', ['proteger', um.obj.protegida ? 'Remover proteção' : 'Proteger pasta']);
        }
        if (um) op.push('-', ['propriedades', 'Propriedades']);
      } else {
        op.push(['exibir-icones', (modo === 'icones' ? '● ' : '') + 'Exibir como ícones'], ['exibir-detalhes', (modo === 'detalhes' ? '● ' : '') + 'Exibir como detalhes'], ['atualizar', 'Atualizar']);
        if (podeAlterar) {
          op.push('-');
          if (podeColar) op.push(['colar', 'Colar', false, 'Ctrl+V']);
          op.push(['nova-pasta', 'Nova pasta'], ['enviar', 'Enviar arquivos...'], ['selecionar-tudo', 'Selecionar tudo', false, 'Ctrl+A']);
        }
      }
      menu = document.createElement('div');
      menu.className = 'exp-menu';
      menu.setAttribute('role', 'menu');
      menu.innerHTML = op.map((o) => (o === '-' ? '<div class="exp-menu-sep"></div>'
        : `<button type="button" role="menuitem" data-acao="${o[0]}"${o[2] ? ' class="forte"' : ''}><span>${esc(o[1])}</span>${o[3] ? `<kbd>${o[3]}</kbd>` : ''}</button>`)).join('');
      document.body.appendChild(menu);
      const r = menu.getBoundingClientRect();
      menu.style.left = Math.min(x, window.innerWidth - r.width - 6) + 'px';
      menu.style.top = Math.min(y, window.innerHeight - r.height - 6) + 'px';
      menu.querySelector('button')?.focus();
      menu.addEventListener('click', (e) => {
        const b = e.target.closest('[data-acao]');
        if (!b) return;
        fecharMenu();
        executar(b.dataset.acao, itens, um, destinoColar);
      });
      menu.addEventListener('keydown', (e) => {
        const botoes = Array.from(menu.querySelectorAll('button'));
        const i = botoes.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); botoes[(i + 1) % botoes.length].focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); botoes[(i - 1 + botoes.length) % botoes.length].focus(); }
        if (e.key === 'Escape') { fecharMenu(); area.focus(); }
      });
    }

    function propriedades(item) {
      const o = item.obj;
      const linhas = item.tipo === 'pasta'
        ? (() => {
          let pastas = 0; let arquivos = 0; let bytes = 0;
          const pilha = [o.id];
          while (pilha.length) {
            const id = pilha.pop();
            dados.pastas.filter((p) => p.pai_id === id).forEach((p) => { pastas += 1; pilha.push(p.id); });
            dados.arquivos.filter((a) => a.pasta_id === id).forEach((a) => { arquivos += 1; bytes += a.tamanho || 0; });
          }
          return [['Tipo', o.protegida ? 'Pasta protegida' : 'Pasta de arquivos'], ['Contém', `${arquivos} arquivo(s), ${pastas} pasta(s)`], ['Tamanho', tamanho(bytes)], ['Criada em', dataHora(o.criado_em)], ['Criada por', o.criado_por || '-']];
        })()
        : [['Tipo', tipoDe(o.nome)[2]], ['Tamanho', tamanho(o.tamanho)], ['Arquivo original', o.arquivo_nome], ['Enviado em', dataHora(o.enviado_em)], ['Enviado por', o.enviado_por || '-'], ['Modificado em', dataHora(o.alterado_em) || '-']];
      alert(o.nome + '\n\n' + linhas.map(([r, v]) => r + ': ' + v).join('\n'));
    }

    function executar(acao, itens, um, destinoColar) {
      if (acao === 'abrir' && um) abrir(um);
      else if (acao === 'baixar') itens.forEach((i) => abrir(i, true));
      else if (acao === 'recortar') guardar('recortar', itens);
      else if (acao === 'copiar') guardar('copiar', itens);
      else if (acao === 'colar') colar(destinoColar);
      else if (acao === 'renomear' && um) renomear((um.tipo === 'pasta' ? 'p:' : 'a:') + um.id);
      else if (acao === 'excluir') excluir(itens);
      else if (acao === 'proteger' && um) alternarProtecao(um);
      else if (acao === 'propriedades' && um) propriedades(um);
      else if (acao === 'nova-pasta') novaPasta(atual);
      else if (acao === 'enviar') entrada.click();
      else if (acao === 'atualizar') recarregar();
      else if (acao === 'selecionar-tudo') { selecao = new Set(chavesVisiveis()); desenhar(); }
      else if (acao === 'exibir-icones' || acao === 'exibir-detalhes') definirModo(acao === 'exibir-icones' ? 'icones' : 'detalhes');
    }

    function definirModo(m) {
      modo = m;
      try { localStorage.setItem('explorador.modo', m); } catch (e) { /* sem armazenamento */ }
      desenhar();
    }

    async function recarregar() {
      try { await pedir('GET', '/arquivos'); desenhar(); } catch (e) { mensagem(e.message, true); }
    }

    // ------------------------------------------------------------ eventos
    raiz.querySelector('.exp-barra').addEventListener('click', (e) => {
      const b = e.target.closest('[data-exp]');
      if (b) {
        const a = b.dataset.exp;
        if (a === 'voltar' && voltar.length) { avancar.push(atual); ir(voltar.pop(), false); }
        if (a === 'avancar' && avancar.length) { voltar.push(atual); ir(avancar.pop(), false); }
        if (a === 'acima' && atual !== null) ir((pastaPor(atual) || {}).pai_id || 'raiz');
        if (a === 'nova-pasta') novaPasta(atual);
        if (a === 'enviar') entrada.click();
        if (a === 'modo') definirModo(modo === 'icones' ? 'detalhes' : 'icones');
        return;
      }
      const seg = e.target.closest('[data-ir]');
      if (seg) ir(seg.dataset.ir === 'raiz' ? 'raiz' : Number(seg.dataset.ir));
    });
    entrada.addEventListener('change', () => enviar(Array.from(entrada.files)));

    area.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const el = e.target.closest('[data-chave]');
      if (!el) { if (!e.ctrlKey && !e.shiftKey) { selecao.clear(); desenhar(); } return; }
      if (!(selecao.has(el.dataset.chave) && !e.ctrlKey && !e.shiftKey)) selecionar(el.dataset.chave, e);
    });
    area.addEventListener('click', (e) => {
      const el = e.target.closest('[data-chave]');
      if (el && !e.ctrlKey && !e.shiftKey && selecao.size > 1 && selecao.has(el.dataset.chave)) selecionar(el.dataset.chave, e);
    });
    area.addEventListener('dblclick', (e) => {
      const el = e.target.closest('[data-chave]');
      if (el) abrir(itemDe(el.dataset.chave));
    });
    area.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const el = e.target.closest('[data-chave]');
      if (el && !selecao.has(el.dataset.chave)) selecionar(el.dataset.chave);
      if (!el) { selecao.clear(); desenhar(); }
      abrirMenu(e.clientX, e.clientY, el ? el.dataset.chave : null);
    });
    // Toque longo = botão direito.
    let toqueTimer = null;
    area.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      const el = e.target.closest('[data-chave]');
      toqueTimer = setTimeout(() => {
        toqueTimer = null;
        if (el) { selecao = new Set([el.dataset.chave]); desenhar(); }
        abrirMenu(t.clientX, t.clientY, el ? el.dataset.chave : null);
      }, 550);
    }, { passive: true });
    area.addEventListener('touchend', (e) => {
      if (toqueTimer) {
        clearTimeout(toqueTimer);
        toqueTimer = null;
        const el = e.target.closest('[data-chave]');
        if (el && !e.target.closest('.exp-renomear')) { e.preventDefault(); abrir(itemDe(el.dataset.chave)); }
      } else {
        e.preventDefault();
      }
    });
    area.addEventListener('touchmove', () => { clearTimeout(toqueTimer); toqueTimer = null; }, { passive: true });

    area.addEventListener('keydown', (e) => {
      if (e.target.closest('.exp-renomear')) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const itens = selecionados();
      if (e.key === 'Enter' && itens.length === 1) { e.preventDefault(); abrir(itens[0]); }
      else if (e.key === 'Delete' && podeAlterar) { e.preventDefault(); excluir(itens); }
      else if (e.key === 'F2' && podeAlterar && itens.length === 1) { e.preventDefault(); renomear((itens[0].tipo === 'pasta' ? 'p:' : 'a:') + itens[0].id); }
      else if (ctrl && e.key.toLowerCase() === 'a') { e.preventDefault(); selecao = new Set(chavesVisiveis()); desenhar(); }
      else if (ctrl && e.key.toLowerCase() === 'c' && podeAlterar) { e.preventDefault(); guardar('copiar', itens); }
      else if (ctrl && e.key.toLowerCase() === 'x' && podeAlterar) { e.preventDefault(); guardar('recortar', itens); }
      else if (ctrl && e.key.toLowerCase() === 'v' && podeAlterar) { e.preventDefault(); colar(atual); }
      else if ((e.key === 'Backspace' || (e.altKey && e.key === 'ArrowUp')) && atual !== null) { e.preventDefault(); ir((pastaPor(atual) || {}).pai_id || 'raiz'); }
      else if (e.altKey && e.key === 'ArrowLeft' && voltar.length) { e.preventDefault(); avancar.push(atual); ir(voltar.pop(), false); }
      else if (e.altKey && e.key === 'ArrowRight' && avancar.length) { e.preventDefault(); voltar.push(atual); ir(avancar.pop(), false); }
      else if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        const lista = chavesVisiveis();
        if (!lista.length) return;
        e.preventDefault();
        const atualIdx = Math.max(0, lista.indexOf(ancora));
        const colunas = modo === 'icones' ? Math.max(1, Math.floor(area.clientWidth / 112)) : 1;
        const passo = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: colunas, ArrowUp: -colunas }[e.key];
        const novo = e.key === 'Home' ? 0 : e.key === 'End' ? lista.length - 1 : Math.min(lista.length - 1, Math.max(0, atualIdx + passo));
        selecionar(lista[novo], e.shiftKey ? { shiftKey: true } : null);
        area.querySelector(`[data-chave="${lista[novo]}"]`)?.scrollIntoView({ block: 'nearest' });
      }
    });

    // Arrastar: itens para pastas (move; Ctrl copia) e arquivos do computador para enviar.
    let arrastados = null;
    area.addEventListener('dragstart', (e) => {
      const el = e.target.closest('[data-chave]');
      if (!el || !podeAlterar) return;
      if (!selecao.has(el.dataset.chave)) { selecao = new Set([el.dataset.chave]); }
      arrastados = selecionados();
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData('text/plain', 'explorador');
    });
    area.addEventListener('dragend', () => { arrastados = null; raiz.querySelectorAll('.alvo').forEach((x) => x.classList.remove('alvo')); });
    const alvoDe = (e) => {
      const pasta = e.target.closest('[data-chave^="p:"]');
      if (pasta) return Number(pasta.dataset.chave.slice(2));
      const seg = e.target.closest('[data-ir]');
      if (seg) return seg.dataset.ir === 'raiz' ? null : Number(seg.dataset.ir);
      return undefined;
    };
    [area, caminhoEl].forEach((zona) => {
      zona.addEventListener('dragover', (e) => {
        if (!podeAlterar) return;
        const externo = !arrastados && Array.from(e.dataTransfer.types || []).includes('Files');
        const destino = alvoDe(e);
        if (!externo && destino === undefined) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = externo || e.ctrlKey ? 'copy' : 'move';
        raiz.querySelectorAll('.alvo').forEach((x) => x.classList.remove('alvo'));
        (e.target.closest('[data-chave^="p:"]') || e.target.closest('[data-ir]') || (externo ? area : null))?.classList.add('alvo');
      });
      zona.addEventListener('dragleave', (e) => { if (!zona.contains(e.relatedTarget)) raiz.querySelectorAll('.alvo').forEach((x) => x.classList.remove('alvo')); });
      zona.addEventListener('drop', (e) => {
        if (!podeAlterar) return;
        e.preventDefault();
        raiz.querySelectorAll('.alvo').forEach((x) => x.classList.remove('alvo'));
        const destino = alvoDe(e);
        if (!arrastados && e.dataTransfer.files && e.dataTransfer.files.length) {
          enviar(Array.from(e.dataTransfer.files), destino === undefined ? atual : destino);
          return;
        }
        if (!arrastados || destino === undefined) return;
        const itens = arrastados.filter((i) => !(i.tipo === 'pasta' && i.id === destino));
        arrastados = null;
        if (itens.length) moverOuCopiar(itens, destino, e.ctrlKey);
      });
    });

    document.addEventListener('mousedown', (e) => { if (menu && !menu.contains(e.target)) fecharMenu(); });
    window.addEventListener('blur', fecharMenu);
    window.addEventListener('resize', fecharMenu);
    raiz.addEventListener('scroll', fecharMenu, true);

    desenhar();
    return {
      atualizar(novos) { if (novos) dados = novos; if (atual !== null && !pastaPor(atual)) atual = null; desenhar(); },
      recarregar,
      dados: () => dados,
    };
  }

  window.Explorador = { montar };
})();
