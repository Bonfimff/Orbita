//======================================================================================================
// ESTOQUE › MOVIMENTAÇÕES › ENTRADA › CARREGAR NOTA (XML da NF-e)
// Lê os itens da nota e mostra cada um com o item do estoque correspondente, procurando pelo
// nome principal e pelos outros nomes do item. Quando o fornecedor usa um nome diferente,
// o nome da nota pode ser associado ao item existente (vira mais um nome dele) para que as
// próximas notas já sejam reconhecidas. "Preencher" leva os dados do item para o formulário.
//======================================================================================================
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);
  const cabecalhos = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') });
  const url = (p) => (typeof apiUrl === 'function' ? apiUrl(p) : p);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const chave = (t) => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toUpperCase();
  const moeda = (n) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let nota = null;        // { numero, fornecedor, data, itens: [...] }
  let porNome = new Map(); // nome (normalizado) -> { id, principal }
  let principais = [];     // [{ id, nome }]
  let atual = null;        // índice do item levado ao formulário

  async function carregarNomes() {
    porNome = new Map();
    principais = [];
    const r = await fetch(url('/produtos/sugestoes-nomes'), { headers: cabecalhos() });
    const d = await r.json();
    const principalPorId = new Map();
    (d.nomes || []).forEach((n) => {
      // A rota devolve primeiro os nomes principais, depois os outros nomes.
      if (!principalPorId.has(n.id)) { principalPorId.set(n.id, n.nome); principais.push({ id: n.id, nome: n.nome }); }
      const k = chave(n.nome);
      if (!porNome.has(k)) porNome.set(k, { id: n.id, principal: principalPorId.get(n.id) });
    });
  }

  function texto(no, sel) { const x = no.getElementsByTagName(sel)[0]; return x ? x.textContent.trim() : ''; }

  function lerXml(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('O arquivo não é um XML válido.');
    const inf = doc.getElementsByTagName('infNFe')[0];
    if (!inf) throw new Error('Este XML não é de uma NF-e de produtos. Nota de serviço (NFS-e) não tem itens de estoque.');
    const ide = inf.getElementsByTagName('ide')[0];
    const emit = inf.getElementsByTagName('emit')[0];
    const itens = Array.from(inf.getElementsByTagName('det')).map((det) => {
      const prod = det.getElementsByTagName('prod')[0];
      return {
        codigo: texto(prod, 'cProd').replace(/^0+(?=\d)/, ''),
        nome: texto(prod, 'xProd'),
        unidade: texto(prod, 'uCom'),
        quantidade: Number(texto(prod, 'qCom')) || 0,
        valor: Number(texto(prod, 'vUnCom')) || 0,
      };
    });
    if (!itens.length) throw new Error('A nota não tem itens.');
    return {
      numero: ide ? texto(ide, 'nNF') : '',
      data: ide ? (texto(ide, 'dhEmi') || texto(ide, 'dEmi')).slice(0, 10) : '',
      fornecedor: emit ? texto(emit, 'xNome') : '',
      itens,
    };
  }

  function situacao(item) {
    const m = porNome.get(chave(item.nome));
    if (!m) return { novo: true };
    return { id: m.id, principal: m.principal, outroNome: chave(m.principal) !== chave(item.nome) };
  }

  function desenhar() {
    const caixa = el('entrada-nota');
    if (!nota) { caixa.hidden = true; caixa.innerHTML = ''; return; }
    const linhas = nota.itens.map((it, i) => {
      const s = situacao(it);
      const qtdTxt = (Number.isInteger(it.quantidade) ? it.quantidade : it.quantidade.toLocaleString('pt-BR')) + ' ' + esc(it.unidade);
      const sit = s.novo
        ? '<span class="nota-situacao novo">Item novo</span>' +
          '<div class="nota-associar"><input type="text" list="entrada-nota-principais" placeholder="Ou associe a um item existente" data-associar="' + i + '">' +
          '<button type="button" class="btn-secundario" data-acao="associar" data-i="' + i + '">Associar</button></div>'
        : '<span class="nota-situacao">Item #' + esc(s.id) + '</span> ' + esc(s.principal) +
          (s.outroNome ? '<div class="nota-outro-nome">Reconhecido pelo outro nome do item</div>' : '');
      return '<tr class="' + (it.feito ? 'feito' : '') + '"><td>' + esc(it.nome) + (it.codigo ? '<br><small>Cód. ' + esc(it.codigo) + '</small>' : '') +
        '</td><td class="num">' + qtdTxt + '</td><td class="num">R$ ' + moeda(it.valor) + '</td><td>' + sit +
        '</td><td class="num"><button type="button" class="btn-secundario nota-usar" data-acao="usar" data-i="' + i + '">' +
        (it.feito ? 'Lançado' : 'Preencher') + '</button></td></tr>';
    }).join('');
    caixa.innerHTML = '<div class="entrada-nota-topo"><strong>Nota ' + esc(nota.numero || '-') + '</strong><span>' + esc(nota.fornecedor || '') +
      '</span><span>' + (nota.data ? nota.data.split('-').reverse().join('/') : '') + '</span><span>' + nota.itens.length + ' item(ns)</span>' +
      '<button type="button" class="btn-secundario" data-acao="fechar">Fechar nota</button></div>' +
      '<div style="overflow-x:auto"><table class="entrada-nota-itens"><thead><tr><th>Item na nota</th><th class="num">Quantidade</th><th class="num">Valor unit.</th><th>No estoque</th><th></th></tr></thead><tbody>' +
      linhas + '</tbody></table></div>' +
      '<datalist id="entrada-nota-principais">' + principais.map((p) => '<option value="' + esc(p.nome) + '"></option>').join('') + '</datalist>';
    caixa.hidden = false;
  }

  function avisar(msg, tipo) {
    const f = el('entrada-feedback');
    if (!f) return;
    f.hidden = false;
    f.textContent = msg;
    f.className = 'entrada-feedback entrada-feedback-' + (tipo || 'ok');
  }

  function definir(id, valor) {
    const campo = el(id);
    if (!campo) return;
    campo.value = valor;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function escolherOpcao(id, valor, mapa) {
    const sel = el(id);
    if (!sel || !valor) return;
    const alvo = chave(mapa ? (mapa[chave(valor)] || valor) : valor);
    let op = Array.from(sel.options).find((o) => chave(o.value) === alvo || chave(o.textContent) === alvo);
    if (!op && !mapa) { op = new Option(valor, valor); sel.add(op); }
    if (op) { sel.value = op.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  }

  const UNIDADES = { UN: 'unidade', UND: 'unidade', UNID: 'unidade', PC: 'unidade', PCT: 'unidade', KG: 'kg', M: 'm', MT: 'm', CM: 'cm', L: 'litro', LT: 'litro' };

  function usar(i) {
    const it = nota.itens[i];
    const s = situacao(it);
    atual = i;
    definir('id-entrada', s.novo ? '' : s.id);
    definir('nome-produto-entrada', s.novo ? it.nome : s.principal);
    // Código do fornecedor só vale para item novo; item existente mantém o código interno.
    definir('codigo-entrada', s.novo ? it.codigo : '');
    definir('quantidade-entrada', Math.round(it.quantidade));
    definir('custo-entrada', moeda(it.valor));
    escolherOpcao('unid-medida-entrada', it.unidade, UNIDADES);
    if (nota.numero) definir('numero-nota-entrada', nota.numero);
    if (nota.fornecedor) escolherOpcao('fornecedor-entrada', nota.fornecedor);
    if (nota.data) definir('data-compra-entrada', nota.data);
    const aviso = Number.isInteger(it.quantidade) ? '' : ' A nota traz ' + it.quantidade.toLocaleString('pt-BR') + ' ' + it.unidade + '; o estoque conta em inteiros, confira a quantidade.';
    avisar((s.novo ? 'Item novo preenchido: complete categoria, local e os demais dados e salve.' : 'Entrada do item #' + s.id + ' preenchida. Confira e salve.') + aviso, aviso ? 'erro' : 'ok');
    el('form-entrada-produto').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function associar(i) {
    const it = nota.itens[i];
    const campo = document.querySelector('[data-associar="' + i + '"]');
    const escolhido = principais.find((p) => chave(p.nome) === chave(campo && campo.value));
    if (!escolhido) { avisar('Escolha na lista o item do estoque que corresponde a "' + it.nome + '".', 'erro'); return; }
    try {
      const r = await fetch(url('/produtos/' + escolhido.id + '/apelidos'), { method: 'POST', headers: cabecalhos(), body: JSON.stringify({ nome: it.nome }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.status !== 'ok') throw new Error(d.mensagem || 'Não foi possível associar o nome.');
      porNome.set(chave(it.nome), { id: escolhido.id, principal: escolhido.nome });
      avisar('"' + it.nome + '" agora também é um nome do item #' + escolhido.id + ' (' + escolhido.nome + '). Nas próximas notas ele já será reconhecido.', 'ok');
      desenhar();
    } catch (e) {
      avisar(e.message, 'erro');
    }
  }

  async function abrirArquivo(arquivo) {
    if (!arquivo) return;
    try {
      const xml = await arquivo.text();
      const lida = lerXml(xml);
      await carregarNomes();
      nota = lida;
      atual = null;
      desenhar();
      const novos = nota.itens.filter((it) => situacao(it).novo).length;
      avisar('Nota ' + (nota.numero || '') + ' carregada: ' + nota.itens.length + ' item(ns), ' + novos + ' sem correspondência no estoque. Use Preencher em cada item.', 'ok');
    } catch (e) {
      avisar(e.message || 'Não foi possível ler a nota.', 'erro');
    }
  }

  function iniciar() {
    const botao = el('btn-carregar-nota');
    const input = el('input-carregar-nota-movimentacao');
    const caixa = el('entrada-nota');
    if (!botao || !input || !caixa) return;
    botao.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { abrirArquivo(input.files[0]); input.value = ''; });
    caixa.addEventListener('click', (e) => {
      const b = e.target.closest('[data-acao]');
      if (!b) return;
      if (b.dataset.acao === 'usar') usar(Number(b.dataset.i));
      else if (b.dataset.acao === 'associar') associar(Number(b.dataset.i));
      else if (b.dataset.acao === 'fechar') { nota = null; desenhar(); }
    });
    // Entrada salva com sucesso: o item levado ao formulário fica marcado como lançado.
    const fb = el('entrada-feedback');
    if (fb) new MutationObserver(() => {
      if (nota && atual !== null && fb.classList.contains('entrada-feedback-ok') && /registrada|cadastrado/i.test(fb.textContent)) {
        nota.itens[atual].feito = true;
        atual = null;
        carregarNomes().then(desenhar, desenhar);
      }
    }).observe(fb, { attributes: true, childList: true, characterData: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
