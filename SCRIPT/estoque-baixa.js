//======================================================================================================
// ESTOQUE › MOVIMENTAÇÕES › BAIXA
// Tira do saldo o que não volta mais (avaria, perda, vencimento...). O produto pode ser buscado
// pelo nome principal ou por qualquer um dos outros nomes do item.
//======================================================================================================
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);
  const cabecalhos = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') });
  const url = (p) => (typeof apiUrl === 'function' ? apiUrl(p) : p);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let saldoAtual = null;

  function feedback(msg, tipo) {
    const f = el('baixa-feedback');
    if (!f) return;
    f.hidden = !msg;
    f.textContent = msg || '';
    f.className = 'entrada-feedback entrada-feedback-' + (tipo || 'ok');
  }

  async function carregarNomes() {
    try {
      const r = await fetch(url('/produtos/sugestoes-nomes'), { headers: cabecalhos() });
      const d = await r.json();
      const vistos = new Set();
      el('lista-produtos-baixa').innerHTML = (d.nomes || []).filter((n) => !vistos.has(n.nome) && vistos.add(n.nome))
        .map((n) => '<option value="' + esc(n.nome) + '"></option>').join('');
    } catch (e) { /* sem sugestões: digita o nome */ }
  }

  async function consultarSaldo() {
    const nome = el('baixa-produto').value.trim();
    const caixa = el('baixa-saldo');
    saldoAtual = null;
    caixa.classList.remove('mov-saldo-erro');
    if (!nome) { caixa.textContent = 'Escolha o produto'; return; }
    try {
      const r = await fetch(url('/produtos/estoque'), { method: 'POST', headers: cabecalhos(), body: JSON.stringify({ produto: nome }) });
      const d = await r.json();
      if (!r.ok || d.status !== 'ok') throw new Error(d.mensagem || 'Produto não encontrado.');
      saldoAtual = Number(d.quantidade) || 0;
      caixa.textContent = saldoAtual + ' em estoque';
    } catch (e) {
      caixa.textContent = e.message;
      caixa.classList.add('mov-saldo-erro');
    }
  }

  function formatarData(iso) { return iso ? iso.split('-').reverse().join('/') : '-'; }

  async function carregarLista() {
    const corpo = document.querySelector('#tabela-baixas tbody');
    if (!corpo) return;
    try {
      const r = await fetch(url('/estoque/baixas'), { headers: cabecalhos() });
      const d = await r.json();
      if (!r.ok || d.status !== 'ok') throw new Error(d.mensagem || 'Sem permissão para ver as baixas.');
      const lista = d.baixas || [];
      corpo.innerHTML = lista.length ? lista.map((b) => '<tr><td>' + formatarData(b.data_baixa) + '</td><td>' + esc(b.nome_produto) +
        '</td><td>' + esc(b.quantidade) + '</td><td>' + esc(b.motivo) + '</td><td>' + esc(b.responsavel || '-') +
        '</td><td>' + esc(b.observacao || '-') + '</td></tr>').join('')
        : '<tr><td colspan="6">Nenhuma baixa registrada.</td></tr>';
    } catch (e) {
      corpo.innerHTML = '<tr><td colspan="6">' + esc(e.message) + '</td></tr>';
    }
  }

  function limpar() {
    el('form-baixa').reset();
    el('baixa-data').value = new Date().toISOString().slice(0, 10);
    saldoAtual = null;
    el('baixa-saldo').textContent = 'Escolha o produto';
    el('baixa-saldo').classList.remove('mov-saldo-erro');
  }

  async function salvar(e) {
    e.preventDefault();
    const qtd = parseInt(el('baixa-quantidade').value, 10) || 0;
    const corpo = {
      produto: el('baixa-produto').value.trim(),
      quantidade: qtd,
      data: el('baixa-data').value,
      motivo: el('baixa-motivo').value,
      responsavel: el('baixa-responsavel').value.trim(),
      observacao: el('baixa-observacao').value.trim(),
    };
    if (!corpo.produto) return feedback('Escolha o produto.', 'erro');
    if (qtd <= 0) return feedback('Informe a quantidade.', 'erro');
    if (saldoAtual !== null && qtd > saldoAtual) return feedback('A quantidade passa do saldo atual (' + saldoAtual + ').', 'erro');
    if (!corpo.data) return feedback('Informe a data.', 'erro');
    if (!corpo.motivo) return feedback('Escolha o motivo da baixa.', 'erro');
    if (corpo.motivo === 'Outro' && !corpo.observacao) return feedback('Para o motivo Outro, descreva na observação.', 'erro');
    const botao = el('baixa-salvar');
    botao.disabled = true;
    try {
      const r = await fetch(url('/estoque/baixas'), { method: 'POST', headers: cabecalhos(), body: JSON.stringify(corpo) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.status !== 'ok') throw new Error(d.mensagem || 'Não foi possível registrar a baixa.');
      feedback(d.mensagem, 'ok');
      limpar();
      carregarLista();
    } catch (err) {
      feedback(err.message, 'erro');
    } finally {
      botao.disabled = false;
    }
  }

  function iniciar() {
    if (!el('form-baixa')) return;
    el('baixa-data').value = new Date().toISOString().slice(0, 10);
    el('form-baixa').addEventListener('submit', salvar);
    el('baixa-cancelar').addEventListener('click', () => { limpar(); feedback(''); });
    el('baixa-produto').addEventListener('change', consultarSaldo);
    if (window.FichaRegistro) window.FichaRegistro.ligarConsulta(el('tabela-baixas'), { subtitulo: 'Baixa de material' });
    carregarNomes();
    carregarLista();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
