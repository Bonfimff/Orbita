//======================================================================================================
// ESTOQUE › CADASTROS › PARÂMETROS
// Grava de verdade no banco (/parametros/cadastro) e atualiza na hora as listas que usam cada
// parâmetro: categoria, unidade de medida, patrimônio, local de estoque e finalidade.
// Clicar num parâmetro cadastrado abre a ficha; Excluir fica dentro dela (com permissão).
// Local de destino da retirada não é parâmetro: são as bases cadastradas.
//======================================================================================================
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);
  const cabecalhos = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') });
  const url = (p) => (typeof apiUrl === 'function' ? apiUrl(p) : p);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Listas do sistema que recebem cada tipo de parâmetro.
  const DESTINOS = {
    categoria: { ids: ['categoria-produto-consulta', 'categoria-entrada', 'categoria', 'categoria-kit'], vazio: 'Selecione uma categoria' },
    unidadeMedida: { ids: ['unid-medida-entrada', 'unid-medida'], vazio: 'Selecione', somar: true },
    patrimonio: { ids: ['patrimonio-entrada', 'patrimonio', 'patrimonio-cadastro', 'patrimonio-consulta'], vazio: 'Selecione um patrimônio' },
    localEstoque: { ids: ['local-estoque', 'local-estoque-cadastro', 'local-estoque-entrada'], vazio: 'Selecione um local de estoque' },
    finalidade: { ids: ['retirada-finalidade', 'finalidade', 'finalidade-entrada', 'finalidade-consulta'], vazio: 'Selecione uma finalidade' },
  };
  const COM_ENDERECO = ['patrimonio', 'localEstoque'];
  let cadastrados = [];

  function feedback(msg, tipo) {
    const f = el('parametros-feedback');
    if (!f) return;
    f.hidden = !msg;
    f.textContent = msg || '';
    f.className = 'entrada-feedback entrada-feedback-' + (tipo || 'ok');
  }

  function preencherListas() {
    Object.keys(DESTINOS).forEach((tipo) => {
      const valores = cadastrados.filter((p) => p.tipo === tipo).map((p) => p.valor);
      const cfg = DESTINOS[tipo];
      cfg.ids.forEach((id) => {
        const sel = el(id);
        if (!sel || sel.tagName !== 'SELECT') return;
        const atual = sel.value;
        if (cfg.somar) {
          // Unidade de medida: mantém as unidades fixas e acrescenta as cadastradas.
          const existentes = new Set(Array.from(sel.options).map((o) => o.value.toUpperCase()));
          valores.forEach((v) => { if (!existentes.has(v.toUpperCase())) sel.add(new Option(v, v)); });
        } else if (valores.length) {
          sel.innerHTML = '<option value="">' + esc(cfg.vazio) + '</option>' + valores.map((v) => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
        }
        if (atual) sel.value = atual;
      });
    });
  }

  function desenharTabela() {
    const corpo = document.querySelector('#tabela-parametros tbody');
    if (!corpo) return;
    corpo.innerHTML = cadastrados.length ? cadastrados.map((p, n) => '<tr tabindex="0" data-param="' + n + '"><td>' + esc(p.rotulo_tipo) +
      '</td><td>' + esc(p.valor) + '</td><td>' + esc(p.endereco || '-') + '</td><td>' + esc(p.observacoes || '-') + '</td></tr>').join('')
      : '<tr><td colspan="4">Nenhum parâmetro cadastrado.</td></tr>';
  }

  async function carregar() {
    try {
      const r = await fetch(url('/parametros/cadastro'), { headers: cabecalhos() });
      const d = await r.json();
      if (!r.ok || d.status !== 'ok') throw new Error(d.mensagem || 'Não foi possível carregar os parâmetros.');
      cadastrados = d.parametros || [];
      desenharTabela();
      preencherListas();
    } catch (e) {
      const corpo = document.querySelector('#tabela-parametros tbody');
      if (corpo) corpo.innerHTML = '<tr><td colspan="4">' + esc(e.message) + '</td></tr>';
    }
  }

  function campos(tipo) {
    if (!tipo) return '';
    let html = '<div><label for="param-valor">NOME</label><input type="text" id="param-valor" maxlength="255" required></div>';
    if (COM_ENDERECO.includes(tipo)) {
      html += '<div><label for="param-endereco">ENDEREÇO</label><input type="text" id="param-endereco" maxlength="255"></div>' +
        '<div><label for="param-obs">OBSERVAÇÕES</label><textarea id="param-obs"></textarea></div>';
    }
    return html;
  }

  async function salvar(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    const tipo = el('parametro-outros').value;
    const valor = (el('param-valor') || {}).value || '';
    if (!tipo) return feedback('Escolha o tipo de parâmetro.', 'erro');
    if (!valor.trim()) return feedback('Informe o nome.', 'erro');
    const botao = el('form-outros').querySelector('button[type="submit"]');
    botao.disabled = true;
    try {
      const r = await fetch(url('/parametros/cadastro'), {
        method: 'POST', headers: cabecalhos(),
        body: JSON.stringify({ tipo, valor, endereco: (el('param-endereco') || {}).value || '', observacoes: (el('param-obs') || {}).value || '' }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.status !== 'ok') throw new Error(d.mensagem || 'Não foi possível salvar.');
      feedback(d.mensagem + ' Já aparece nas listas do estoque.', 'ok');
      el('param-valor').value = '';
      if (el('param-endereco')) el('param-endereco').value = '';
      if (el('param-obs')) el('param-obs').value = '';
      el('param-valor').focus();
      await carregar();
    } catch (err) {
      feedback(err.message, 'erro');
    } finally {
      botao.disabled = false;
    }
  }

  function abrirFicha(linha) {
    const p = cadastrados[Number(linha.dataset.param)];
    const F = window.FichaRegistro;
    if (!p || !F) return;
    F.abrir({
      titulo: p.valor,
      subtitulo: p.rotulo_tipo,
      campos: [['Tipo', p.rotulo_tipo], ['Nome', p.valor], ['Endereço', p.endereco || '-'], ['Observações', p.observacoes || '-', { largo: true }]],
      podeExcluir: F.pode ? F.pode('estoque_cadastros', 'excluir') : true,
      excluir: () => F.apagar('/parametros/cadastro/' + p.id),
      aoExcluir: () => { feedback('Parâmetro excluído: ' + p.valor + '.', 'ok'); carregar(); },
    });
  }

  function iniciar() {
    const form = el('form-outros');
    const sel = el('parametro-outros');
    if (!form || !sel) return;
    sel.addEventListener('change', () => { el('campos-dinamicos').innerHTML = campos(sel.value); }, true);
    // Toma o lugar do envio antigo, que só desenhava na tela.
    form.addEventListener('submit', salvar, true);
    if (window.FichaRegistro) window.FichaRegistro.ligarTabela(el('tabela-parametros'), 'tr[data-param]', abrirFicha);
    // Depois das cargas antigas da página, para as listas ficarem com o que está no banco.
    setTimeout(carregar, 600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
