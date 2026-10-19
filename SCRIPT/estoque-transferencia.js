//======================================================================================================
// ESTOQUE › MOVIMENTAÇÕES › TRANSFERÊNCIA
// Nota de saída para outra filial: os itens saem do saldo deste estoque e é gerado um documento
// em PDF (abre no navegador) para acompanhar o material até a filial de destino.
// O produto pode ser buscado pelo nome principal ou por qualquer outro nome do item.
//======================================================================================================
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);
  const cabecalhos = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') });
  const url = (p) => (typeof apiUrl === 'function' ? apiUrl(p) : p);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const chave = (t) => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').trim().toUpperCase();
  const dataBr = (iso) => (iso ? iso.split('-').reverse().join('/') : '-');

  let itens = [];       // [{ produto, quantidade, saldo }]
  let saldoAtual = null;
  let registros = [];

  function feedback(msg, tipo) {
    const f = el('transf-feedback');
    f.hidden = !msg;
    f.textContent = msg || '';
    f.className = 'entrada-feedback entrada-feedback-' + (tipo || 'ok');
  }

  async function carregarNomes() {
    try {
      const r = await fetch(url('/produtos/sugestoes-nomes'), { headers: cabecalhos() });
      const d = await r.json();
      const vistos = new Set();
      el('lista-produtos-transf').innerHTML = (d.nomes || []).filter((n) => !vistos.has(n.nome) && vistos.add(n.nome))
        .map((n) => '<option value="' + esc(n.nome) + '"></option>').join('');
    } catch (e) { /* sem sugestões: digita o nome */ }
  }

  async function saldoDe(nome) {
    const r = await fetch(url('/produtos/estoque'), { method: 'POST', headers: cabecalhos(), body: JSON.stringify({ produto: nome }) });
    const d = await r.json();
    if (!r.ok || d.status !== 'ok') throw new Error(d.mensagem || 'Produto não encontrado.');
    return Number(d.quantidade) || 0;
  }

  async function consultarSaldo() {
    const nome = el('transf-produto').value.trim();
    const caixa = el('transf-saldo');
    saldoAtual = null;
    caixa.classList.remove('mov-saldo-erro');
    if (!nome) { caixa.textContent = 'Escolha o produto'; return; }
    try {
      saldoAtual = await saldoDe(nome);
      const ja = itens.filter((i) => chave(i.produto) === chave(nome)).reduce((s, i) => s + i.quantidade, 0);
      caixa.textContent = saldoAtual + ' em estoque' + (ja ? ' (' + ja + ' já nesta transferência)' : '');
    } catch (e) {
      caixa.textContent = e.message;
      caixa.classList.add('mov-saldo-erro');
    }
  }

  function desenharItens() {
    const corpo = document.querySelector('#tabela-transf-itens tbody');
    corpo.innerHTML = itens.length ? itens.map((i, n) => '<tr><td>' + esc(i.produto) + '</td><td>' + i.quantidade + '</td><td>' +
      (i.saldo === null ? '-' : i.saldo) + '</td><td><button type="button" class="btn-secundario" data-remover="' + n + '">Remover</button></td></tr>').join('')
      : '<tr><td colspan="4">Nenhum item acrescentado.</td></tr>';
  }

  async function acrescentar() {
    const produto = el('transf-produto').value.trim();
    const quantidade = parseInt(el('transf-quantidade').value, 10) || 0;
    if (!produto) return feedback('Escolha o produto.', 'erro');
    if (quantidade <= 0) return feedback('Informe a quantidade.', 'erro');
    if (saldoAtual === null) await consultarSaldo();
    if (saldoAtual === null) return feedback('Produto não encontrado no estoque.', 'erro');
    const ja = itens.filter((i) => chave(i.produto) === chave(produto)).reduce((s, i) => s + i.quantidade, 0);
    if (quantidade + ja > saldoAtual) return feedback('Saldo insuficiente: há ' + saldoAtual + (ja ? ', ' + ja + ' já nesta transferência' : '') + '.', 'erro');
    itens.push({ produto, quantidade, saldo: saldoAtual });
    el('transf-produto').value = '';
    el('transf-quantidade').value = '';
    saldoAtual = null;
    el('transf-saldo').textContent = 'Escolha o produto';
    feedback('');
    desenharItens();
    el('transf-produto').focus();
  }

  function limpar() {
    el('form-transferencia').reset();
    el('transf-data').value = new Date().toISOString().slice(0, 10);
    itens = [];
    saldoAtual = null;
    el('transf-saldo').textContent = 'Escolha o produto';
    el('transf-saldo').classList.remove('mov-saldo-erro');
    desenharItens();
  }

  async function salvar(e) {
    e.preventDefault();
    // Produto digitado e ainda não acrescentado entra junto.
    if (el('transf-produto').value.trim() && el('transf-quantidade').value) {
      const antes = itens.length;
      await acrescentar();
      if (itens.length === antes) return;
    }
    const corpo = {
      data: el('transf-data').value,
      filial: el('transf-filial').value.trim(),
      responsavel: el('transf-responsavel').value.trim(),
      transportador: el('transf-transportador').value.trim(),
      observacao: el('transf-observacao').value.trim(),
      itens: itens.map((i) => ({ produto: i.produto, quantidade: i.quantidade })),
    };
    if (!corpo.data) return feedback('Informe a data.', 'erro');
    if (!corpo.filial) return feedback('Informe a filial de destino.', 'erro');
    if (!corpo.itens.length) return feedback('Acrescente ao menos um item.', 'erro');
    const botao = el('transf-salvar');
    botao.disabled = true;
    try {
      const r = await fetch(url('/estoque/transferencias'), { method: 'POST', headers: cabecalhos(), body: JSON.stringify(corpo) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.status !== 'ok') throw new Error(d.mensagem || 'Não foi possível registrar a transferência.');
      limpar();
      feedback(d.mensagem, 'ok');
      await carregarLista();
      if (d.id) abrirDocumento(d.id);
    } catch (err) {
      feedback(err.message, 'erro');
    } finally {
      botao.disabled = false;
    }
  }

  async function abrirDocumento(id) {
    const aba = window.open('', '_blank');
    if (aba) aba.document.write('<p style="font-family:sans-serif;padding:24px">Gerando o documento...</p>');
    try {
      const r = await fetch(url('/estoque/transferencias/' + id + '/documento'), { headers: cabecalhos() });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.mensagem || 'Não foi possível gerar o documento.'); }
      const link = URL.createObjectURL(new Blob([await r.blob()], { type: 'application/pdf' }));
      if (aba) aba.location.href = link; else window.location.href = link;
      setTimeout(() => URL.revokeObjectURL(link), 120000);
    } catch (e) {
      if (aba) aba.close();
      feedback(e.message, 'erro');
    }
  }

  async function carregarLista() {
    const corpo = document.querySelector('#tabela-transferencias tbody');
    try {
      const r = await fetch(url('/estoque/transferencias'), { headers: cabecalhos() });
      const d = await r.json();
      if (!r.ok || d.status !== 'ok') throw new Error(d.mensagem || 'Sem permissão para ver as transferências.');
      registros = d.transferencias || [];
      el('lista-filiais-transf').innerHTML = (d.filiais || []).map((f) => '<option value="' + esc(f) + '"></option>').join('');
      corpo.innerHTML = registros.length ? registros.map((t, n) => '<tr tabindex="0" data-transf="' + n + '"><td>' + esc(t.numero) + '</td><td>' +
        dataBr(t.data_transferencia) + '</td><td>' + esc(t.filial_destino) + '</td><td>' + esc(t.itens) + '</td><td>' + esc(t.quantidade) +
        '</td><td>' + esc(t.responsavel || '-') + '</td></tr>').join('')
        : '<tr><td colspan="6">Nenhuma transferência registrada.</td></tr>';
    } catch (e) {
      corpo.innerHTML = '<tr><td colspan="6">' + esc(e.message) + '</td></tr>';
    }
  }

  function abrirFicha(linha) {
    const t = registros[Number(linha.dataset.transf)];
    if (!t || !window.FichaRegistro) return;
    window.FichaRegistro.abrir({
      titulo: 'Transferência ' + t.numero,
      subtitulo: 'Saída para ' + t.filial_destino,
      campos: [['Data', dataBr(t.data_transferencia)], ['Filial de destino', t.filial_destino],
        ['Responsável pela saída', t.responsavel || '-'], ['Transportador / veículo', t.transportador || '-'],
        ['Itens', t.resumo || '-', { largo: true }], ['Observação', t.observacao || '-', { largo: true }]],
      semExcluir: true,
      acoes: [{ rotulo: 'Ver documento (PDF)', fn: () => abrirDocumento(t.id) }],
    });
  }

  function iniciar() {
    if (!el('form-transferencia')) return;
    el('transf-data').value = new Date().toISOString().slice(0, 10);
    el('form-transferencia').addEventListener('submit', salvar);
    el('transf-acrescentar').addEventListener('click', acrescentar);
    el('transf-limpar').addEventListener('click', () => { limpar(); feedback(''); });
    el('transf-produto').addEventListener('change', consultarSaldo);
    document.querySelector('#tabela-transf-itens tbody').addEventListener('click', (e) => {
      const b = e.target.closest('[data-remover]');
      if (!b) return;
      itens.splice(Number(b.dataset.remover), 1);
      desenharItens();
    });
    if (window.FichaRegistro) window.FichaRegistro.ligarTabela(el('tabela-transferencias'), 'tr[data-transf]', abrirFicha);
    carregarNomes();
    carregarLista();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
