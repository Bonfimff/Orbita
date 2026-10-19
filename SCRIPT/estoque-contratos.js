// Estoque reservado por contrato.
// Entrada: parte da quantidade pode ficar reservada para um ou mais contratos;
// o que não for reservado fica livre para qualquer contrato.
// Retirada: escolhe o contrato e, se o item estiver reservado para outro
// contrato sem saldo livre suficiente, mostra a restrição e não deixa seguir.
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);
  const cabecalhos = () => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + localStorage.getItem('token'),
  });
  const escapar = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let contratos = [];

  async function carregarContratos() {
    try {
      const resp = await fetch(apiUrl('/estoque/contratos'), { headers: cabecalhos() });
      const dados = await resp.json();
      contratos = (dados && dados.contratos) || [];
    } catch (e) {
      contratos = [];
    }
    const sel = el('retirada-contrato');
    if (sel) {
      const atual = sel.value;
      sel.innerHTML = '<option value="">Sem contrato (só estoque livre)</option>' +
        contratos.map((c) => '<option value="' + c.id + '">' + escapar(c.nome) + '</option>').join('');
      sel.value = atual;
    }
  }

  // ===================== ENTRADA =====================
  function opcoesContrato(selecionado) {
    return '<option value="">Escolha o contrato...</option>' + contratos.map((c) =>
      '<option value="' + c.id + '"' + (String(c.id) === String(selecionado) ? ' selected' : '') + '>' +
      escapar(c.nome) + '</option>').join('');
  }

  function linhasContrato() {
    return Array.from(document.querySelectorAll('#entrada-contratos-linhas .entrada-contrato-linha')).map((l) => ({
      contrato_id: l.querySelector('select').value,
      quantidade: parseInt(l.querySelector('input').value, 10) || 0,
    })).filter((c) => c.contrato_id && c.quantidade > 0);
  }

  function atualizarResumoEntrada() {
    const resumo = el('entrada-contratos-resumo');
    if (!resumo) return;
    const total = parseInt((el('quantidade-entrada') || {}).value, 10) || 0;
    const reservado = linhasContrato().reduce((s, c) => s + c.quantidade, 0);
    if (!reservado) {
      resumo.textContent = 'Sem contrato: o item fica livre para qualquer contrato.';
      resumo.classList.remove('entrada-contratos-erro');
      return;
    }
    const livre = total - reservado;
    resumo.textContent = livre < 0
      ? 'A soma por contrato (' + reservado + ') passa da quantidade (' + total + ').'
      : reservado + ' reservado(s) por contrato · ' + livre + ' livre(s) para qualquer contrato.';
    resumo.classList.toggle('entrada-contratos-erro', livre < 0);
  }

  function adicionarLinhaContrato() {
    const box = el('entrada-contratos-linhas');
    if (!box) return;
    const linha = document.createElement('div');
    linha.className = 'entrada-contrato-linha';
    linha.innerHTML =
      '<select aria-label="Contrato">' + opcoesContrato('') + '</select>' +
      '<input type="number" min="1" placeholder="Qtd" aria-label="Quantidade para o contrato" />' +
      '<button type="button" class="entrada-contrato-remover" aria-label="Remover contrato" title="Remover">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    linha.querySelector('.entrada-contrato-remover').addEventListener('click', () => { linha.remove(); atualizarResumoEntrada(); });
    linha.querySelector('select').addEventListener('change', atualizarResumoEntrada);
    linha.querySelector('input').addEventListener('input', atualizarResumoEntrada);
    box.appendChild(linha);
    linha.querySelector('select').focus();
  }

  function feedbackEntrada(msg, tipo) {
    const f = el('entrada-feedback');
    if (!f) { alert(msg); return; }
    f.hidden = false;
    f.className = 'entrada-feedback entrada-feedback-' + (tipo || 'ok');
    f.textContent = msg;
  }

  function valor(id) {
    const c = el(id);
    return c ? String(c.value || '').trim() : '';
  }

  function custoNumero(texto) {
    if (!texto) return '';
    const limpo = texto.replace(/[^\d,.-]/g, '');
    if (limpo.includes(',')) return limpo.replace(/\./g, '').replace(',', '.');
    return limpo;
  }

  // ----- Entrada em lista: acrescenta itens, confere na tabela e salva tudo no fim -----
  // Campos do formulário -> nome no corpo enviado a /estoque/entrada.
  const CAMPOS = {
    'id-entrada': 'id', 'codigo-entrada': 'codigo', 'nome-produto-entrada': 'nome_produto',
    'categoria-entrada': 'categoria', 'quantidade-entrada': 'quantidade', 'numero-serie-entrada': 'numero_serie',
    'unid-medida-entrada': 'unid_medida', 'estoque-minimo-entrada': 'estoque_minimo',
    'numero-nota-entrada': 'numero_nota', 'fornecedor-entrada': 'fornecedor', 'patrimonio': 'patrimonio',
    'local-estoque': 'local_estoque', 'custo-entrada': 'custo', 'garantia-entrada': 'garantia',
    'data-validade-entrada': 'data_validade', 'data-compra-entrada': 'data_compra',
  };
  // Dados da nota: continuam preenchidos ao acrescentar o próximo item.
  const DA_NOTA = ['numero-nota-entrada', 'fornecedor-entrada', 'data-compra-entrada', 'local-estoque', 'patrimonio'];
  const SEM_IMAGEM = '../IMG/Sem_imagem.png';
  const lista = [];
  let editando = null;      // índice do item da lista em edição
  let imagemNova = null;    // imagem escolhida para o item do formulário (data URL)

  function lerFormulario() {
    const campos = {};
    Object.keys(CAMPOS).forEach((id) => { campos[id] = valor(id); });
    return campos;
  }

  function validar(campos, contratosItem) {
    const quantidade = parseInt(campos['quantidade-entrada'], 10) || 0;
    if (quantidade <= 0) return 'Informe a quantidade da entrada.';
    if (!campos['id-entrada'] && !campos['nome-produto-entrada']) return 'Informe o ID de um item existente ou o nome de um item novo.';
    const reservado = contratosItem.reduce((s, c) => s + c.quantidade, 0);
    if (reservado > quantidade) return 'A soma por contrato (' + reservado + ') passa da quantidade da entrada (' + quantidade + ').';
    return '';
  }

  function corpoDo(item) {
    const corpo = { contratos: item.contratos };
    Object.keys(CAMPOS).forEach((id) => { corpo[CAMPOS[id]] = item.campos[id]; });
    corpo.id = corpo.id || null;
    corpo.quantidade = parseInt(corpo.quantidade, 10) || 0;
    corpo.custo = custoNumero(corpo.custo);
    return corpo;
  }

  function textoOpcao(id, v) {
    const sel = el(id);
    if (!sel || sel.tagName !== 'SELECT' || !v) return v || '';
    const op = Array.from(sel.options).find((o) => o.value === v);
    return op ? op.textContent.trim() : v;
  }

  function mostrarImagem(src) {
    const img = el('preview-entrada');
    if (img) img.src = src || SEM_IMAGEM;
  }

  function limparItem() {
    const manter = {};
    DA_NOTA.forEach((id) => { manter[id] = valor(id); });
    el('form-entrada-produto').reset();
    DA_NOTA.forEach((id) => { if (el(id)) el(id).value = manter[id]; });
    el('entrada-contratos-linhas').innerHTML = '';
    imagemNova = null;
    mostrarImagem(null);
    editando = null;
    atualizarResumoEntrada();
    atualizarBotoes();
  }

  function preencherItem(n) {
    const item = lista[n];
    Object.keys(item.campos).forEach((id) => { if (el(id)) el(id).value = item.campos[id]; });
    const box = el('entrada-contratos-linhas');
    box.innerHTML = '';
    item.contratos.forEach((c) => {
      adicionarLinhaContrato();
      const linha = box.lastElementChild;
      linha.querySelector('select').value = String(c.contrato_id);
      linha.querySelector('input').value = c.quantidade;
    });
    imagemNova = item.imagem;
    mostrarImagem(item.imagem || item.imagemExistente);
    editando = n;
    atualizarResumoEntrada();
    atualizarBotoes();
    desenharLista();
    el('form-entrada-produto').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function acrescentar(evento) {
    if (evento) { evento.preventDefault(); evento.stopImmediatePropagation(); }
    const campos = lerFormulario();
    const contratosItem = linhasContrato();
    const erro = validar(campos, contratosItem);
    if (erro) { feedbackEntrada(erro, 'erro'); return; }
    const imgAtual = el('preview-entrada') ? el('preview-entrada').getAttribute('src') : '';
    const item = {
      campos, contratos: contratosItem, imagem: imagemNova,
      imagemExistente: !imagemNova && imgAtual && !/Sem_imagem/.test(imgAtual) ? imgAtual : null, erro: '',
    };
    const nome = campos['nome-produto-entrada'] || ('Item #' + campos['id-entrada']);
    if (editando !== null) { lista[editando] = item; feedbackEntrada('Item atualizado na lista: ' + nome + '.', 'ok'); }
    else { lista.push(item); feedbackEntrada('Item acrescentado à lista: ' + nome + '. Continue ou clique em Salvar entrada.', 'ok'); }
    limparItem();
    desenharLista();
    const primeiro = el('id-entrada');
    if (primeiro) primeiro.focus({ preventScroll: true });
  }

  function desenharLista() {
    const corpo = document.querySelector('#tabela-entrada-itens tbody');
    const bloco = el('entrada-lista');
    if (!corpo || !bloco) return;
    bloco.hidden = !lista.length;
    el('entrada-lista-total').textContent = lista.length + ' item(ns) · ' +
      lista.reduce((s, it) => s + (parseInt(it.campos['quantidade-entrada'], 10) || 0), 0) + ' unidade(s)';
    corpo.innerHTML = lista.map((it, n) => {
      const c = it.campos;
      const reservas = it.contratos.length ? it.contratos.reduce((s, x) => s + x.quantidade, 0) + ' reservado(s)' : '-';
      return '<tr tabindex="0" data-item="' + n + '" class="' + (n === editando ? 'em-edicao ' : '') + (it.erro ? 'com-erro' : '') + '">' +
        '<td>' + escapar(c['nome-produto-entrada'] || '-') + (it.erro ? '<br><small class="entrada-item-erro">' + escapar(it.erro) + '</small>' : '') + '</td>' +
        '<td>' + escapar(c['id-entrada'] || 'Novo') + '</td>' +
        '<td>' + escapar(c['quantidade-entrada']) + '</td>' +
        '<td>' + escapar(c['custo-entrada'] || '-') + '</td>' +
        '<td>' + escapar(c['numero-nota-entrada'] || '-') + '</td>' +
        '<td>' + escapar(textoOpcao('local-estoque', c['local-estoque']) || '-') + '</td>' +
        '<td>' + escapar(reservas) + '</td>' +
        '<td>' + (it.imagem ? 'Nova' : '-') + '</td>' +
        '<td><button type="button" class="btn-secundario" data-remover-item="' + n + '">Remover</button></td></tr>';
    }).join('');
    atualizarBotoes();
  }

  function atualizarBotoes() {
    const add = el('btn-acrescentar-entrada');
    if (add) add.textContent = editando !== null ? 'Atualizar item' : 'Acrescentar à lista';
    const cancelar = el('btn-cancelar-edicao-entrada');
    if (cancelar) cancelar.hidden = editando === null;
    const salvar = el('btn-add');
    if (salvar) {
      salvar.textContent = lista.length ? 'Salvar entrada (' + lista.length + ')' : 'Salvar entrada';
      salvar.disabled = !lista.length;
    }
  }

  async function enviarImagem(produtoId, dataUrl) {
    const resp = await fetch(apiUrl('/produtos/' + produtoId + '/imagem/enviar'), {
      method: 'POST', headers: cabecalhos(), body: JSON.stringify({ imagem_base64: dataUrl }),
    });
    const d = await resp.json().catch(() => ({}));
    if (!resp.ok || d.status !== 'ok') throw new Error(d.mensagem || 'Não foi possível salvar a imagem.');
  }

  async function salvarTudo(evento) {
    if (evento) evento.preventDefault();
    if (!lista.length) { feedbackEntrada('Acrescente ao menos um item à lista.', 'erro'); return; }
    if (editando !== null) { feedbackEntrada('Termine a edição do item (Atualizar item ou Cancelar) antes de salvar.', 'erro'); return; }
    const botao = el('btn-add');
    botao.disabled = true;
    let ok = 0;
    const avisos = [];
    for (let n = 0; n < lista.length;) {
      const item = lista[n];
      botao.textContent = 'Salvando ' + (ok + 1) + '...';
      try {
        const resp = await fetch(apiUrl('/estoque/entrada'), { method: 'POST', headers: cabecalhos(), body: JSON.stringify(corpoDo(item)) });
        const dados = await resp.json().catch(() => ({}));
        if (!resp.ok || dados.status !== 'ok') throw new Error(dados.mensagem || 'Não foi possível registrar.');
        if (item.imagem && dados.produto_id) {
          try { await enviarImagem(dados.produto_id, item.imagem); } catch (e) { avisos.push('Imagem do item #' + dados.produto_id + ': ' + e.message); }
        }
        lista.splice(n, 1);
        ok++;
      } catch (e) {
        item.erro = e.message;
        n++;
      }
    }
    desenharLista();
    if (!lista.length) {
      feedbackEntrada('Entrada registrada: ' + ok + ' item(ns) salvos.' + (avisos.length ? ' ' + avisos.join(' ') : ''), avisos.length ? 'erro' : 'ok');
    } else {
      feedbackEntrada(ok + ' item(ns) salvos; ' + lista.length + ' com problema continuam na lista. Clique no item para corrigir.' +
        (avisos.length ? ' ' + avisos.join(' ') : ''), 'erro');
    }
    atualizarBotoes();
  }

  // Imagem do item: clique abre carregar/trocar e ampliar; o editor corta e retira o fundo.
  function ligarImagemEntrada() {
    const caixa = document.querySelector('#form-entrada-produto .image-preview-container');
    const img = el('preview-entrada');
    if (!caixa || !img) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    caixa.appendChild(input);
    caixa.classList.add('mov-imagem-editavel');
    caixa.setAttribute('role', 'button');
    caixa.tabIndex = 0;
    caixa.title = 'Carregar ou trocar a imagem';
    let menu = null;
    const fecharMenu = () => { if (menu) { menu.remove(); menu = null; } };
    const temImagem = () => !/Sem_imagem/.test(img.getAttribute('src') || '');
    const abrirMenu = () => {
      fecharMenu();
      menu = document.createElement('div');
      menu.className = 'mov-imagem-menu';
      menu.innerHTML = '<button type="button" data-img="carregar">' + (temImagem() ? 'Trocar imagem' : 'Carregar imagem') + '</button>' +
        (temImagem() ? '<button type="button" data-img="ampliar">Ampliar</button>' : '') +
        (imagemNova ? '<button type="button" data-img="desfazer">Desfazer troca</button>' : '');
      caixa.appendChild(menu);
    };
    caixa.addEventListener('click', (e) => {
      const b = e.target.closest('[data-img]');
      if (b) {
        e.stopPropagation();
        const acao = b.dataset.img;
        fecharMenu();
        if (acao === 'carregar') input.click();
        else if (acao === 'ampliar' && window.EditorImagem) window.EditorImagem.ampliar(img.src, valor('nome-produto-entrada'));
        else if (acao === 'desfazer') { imagemNova = null; mostrarImagem(editando !== null ? lista[editando].imagemExistente : null); }
        return;
      }
      if (e.target === input) return;
      menu ? fecharMenu() : abrirMenu();
    });
    caixa.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirMenu(); } });
    document.addEventListener('click', (e) => { if (menu && !caixa.contains(e.target)) fecharMenu(); });
    input.addEventListener('change', async () => {
      const arq = input.files[0];
      input.value = '';
      if (!arq) return;
      try {
        const pronta = window.EditorImagem ? await window.EditorImagem.abrir(arq) : null;
        if (!pronta) return;
        imagemNova = pronta;
        mostrarImagem(pronta);
        feedbackEntrada('Imagem pronta. Ela é salva junto com o item ao salvar a entrada.', 'ok');
      } catch (e) {
        feedbackEntrada(e.message, 'erro');
      }
    });
  }

  // Retirada e Devolução: a imagem só amplia.
  function ligarAmpliar(id) {
    const img = el(id);
    if (!img) return;
    img.classList.add('mov-imagem-ampliavel');
    img.addEventListener('click', () => {
      if (/Sem_imagem/.test(img.getAttribute('src') || '') || !window.EditorImagem) return;
      window.EditorImagem.ampliar(img.src, img.alt);
    });
  }

  // ===================== RETIRADA =====================
  let ultimaVerificacao = 0;

  async function verificarRetirada() {
    const aviso = el('retirada-aviso-contrato');
    const produto = valor('retirada-produto');
    const quantidade = parseInt(valor('retirada-quantidade'), 10) || 0;
    if (!aviso) return true;
    if (!produto || quantidade <= 0) { aviso.hidden = true; return true; }
    const minha = ++ultimaVerificacao;
    try {
      const resp = await fetch(apiUrl('/estoque/restricao-contrato'), {
        method: 'POST', headers: cabecalhos(),
        body: JSON.stringify({ contrato_id: valor('retirada-contrato') || null, itens: [{ produto, quantidade }] }),
      });
      const dados = await resp.json();
      if (minha !== ultimaVerificacao) return true;
      const bloqueio = dados && dados.bloqueios && dados.bloqueios[0];
      if (bloqueio) {
        aviso.textContent = bloqueio.mensagem;
        aviso.hidden = false;
        return false;
      }
      aviso.hidden = true;
      return true;
    } catch (e) {
      aviso.hidden = true;
      return true;
    }
  }

  // Envia o contrato escolhido junto com a retirada (as duas rotas de salvar)
  if (window.fetch) {
    const fetchOriginal = window.fetch.bind(window);
    window.fetch = function (recurso, opcoes) {
      try {
        const url = typeof recurso === 'string' ? recurso : (recurso && recurso.url) || '';
        if (/\/retiradas?\/salvar/.test(url) && opcoes && typeof opcoes.body === 'string' && el('retirada-contrato')) {
          const corpo = JSON.parse(opcoes.body);
          if (corpo && corpo.contrato_id === undefined) {
            corpo.contrato_id = valor('retirada-contrato') || null;
            opcoes = Object.assign({}, opcoes, { body: JSON.stringify(corpo) });
          }
        }
      } catch (e) { /* corpo que não é JSON: segue como veio */ }
      return fetchOriginal(recurso, opcoes);
    };
  }

  // Local de destino da retirada: sempre as bases cadastradas.
  async function carregarBasesDestino() {
    const sel = el('retirada-local');
    if (!sel) return;
    try {
      const resp = await fetch(apiUrl('/bases'), { headers: cabecalhos() });
      const dados = await resp.json();
      const bases = (dados && dados.bases) || [];
      const atual = sel.value;
      sel.innerHTML = '<option value="">' + (bases.length ? 'Selecione a base' : 'Nenhuma base cadastrada') + '</option>' +
        bases.map((b) => '<option value="' + escapar(b.id) + '">' + escapar(b.id + (b.endereco ? ' · ' + b.endereco : '')) + '</option>').join('');
      sel.value = atual;
    } catch (e) {
      sel.innerHTML = '<option value="">Não foi possível carregar as bases</option>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    carregarContratos();
    carregarBasesDestino();

    el('entrada-contratos-add')?.addEventListener('click', async () => {
      if (!contratos.length) await carregarContratos();
      if (!contratos.length) { feedbackEntrada('Nenhum contrato cadastrado em Gestão › Contratos.', 'erro'); return; }
      adicionarLinhaContrato();
    });
    el('quantidade-entrada')?.addEventListener('input', atualizarResumoEntrada);
    el('form-entrada-produto')?.addEventListener('submit', acrescentar, true);
    el('btn-add')?.addEventListener('click', salvarTudo);
    el('btn-cancelar-edicao-entrada')?.addEventListener('click', () => { limparItem(); desenharLista(); feedbackEntrada('Edição cancelada; o item continua na lista como estava.', 'ok'); });
    const tabelaItens = el('tabela-entrada-itens');
    if (tabelaItens) {
      tabelaItens.addEventListener('click', (e) => {
        const rem = e.target.closest('[data-remover-item]');
        if (rem) {
          const n = Number(rem.dataset.removerItem);
          lista.splice(n, 1);
          if (editando === n) limparItem(); else if (editando !== null && editando > n) editando--;
          desenharLista();
          return;
        }
        const linha = e.target.closest('tr[data-item]');
        if (linha) preencherItem(Number(linha.dataset.item));
      });
      tabelaItens.addEventListener('keydown', (e) => {
        const linha = e.target.closest('tr[data-item]');
        if (linha && e.key === 'Enter') preencherItem(Number(linha.dataset.item));
      });
    }
    ligarImagemEntrada();
    ligarAmpliar('retirada-produto-img');
    ligarAmpliar('devolucao-produto-img');
    atualizarBotoes();

    ['retirada-produto', 'retirada-quantidade', 'retirada-contrato'].forEach((id) => {
      el(id)?.addEventListener('change', verificarRetirada);
    });
    el('retirada-quantidade')?.addEventListener('input', () => {
      clearTimeout(verificarRetirada._t);
      verificarRetirada._t = setTimeout(verificarRetirada, 350);
    });
    // Bloqueia acrescentar/finalizar enquanto houver restrição
    ['btn-acrescentar-item', 'btn-enviar-retirada'].forEach((id) => {
      const botao = el(id);
      if (!botao) return;
      botao.addEventListener('click', async (e) => {
        if (botao.dataset.liberado === '1') { botao.dataset.liberado = ''; return; }
        if (!valor('retirada-produto')) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const ok = await verificarRetirada();
        if (!ok) {
          el('retirada-aviso-contrato')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return;
        }
        botao.dataset.liberado = '1';
        botao.click();
      }, true);
    });
  });
})();

// ===================== UTILIZAÇÃO E DEVOLUÇÃO (Painel) =====================
// Para cada O.S. com material retirado: saiu, foi usado no relatório, já
// voltou e quanto ainda falta devolver (só depois que a O.S. é finalizada).
(function () {
  'use strict';
  const el = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmt = (n) => (Math.round(Number(n || 0) * 100) / 100).toLocaleString('pt-BR');

  function irParaDevolucao(idRetirada) {
    const botao = el('btn-devolucao1') || document.querySelector('[data-tab="devolucao"]');
    const aba = document.querySelector('.tab-btn[data-tab="movimentacoes"]');
    if (aba) aba.click();
    setTimeout(() => {
      if (botao) botao.click();
      setTimeout(() => {
        const campo = el('devolucao-id');
        if (campo && idRetirada) {
          campo.value = idRetirada;
          campo.dispatchEvent(new Event('input', { bubbles: true }));
          campo.dispatchEvent(new Event('change', { bubbles: true }));
          campo.focus();
        }
      }, 150);
    }, 100);
  }

  function render(ordens) {
    const box = el('confirmacao-utilizacao-info');
    if (!box) return;
    if (!ordens.length) {
      box.innerHTML = '<p class="utilizacao-vazio">Nenhuma O.S. com material retirado.</p>';
      return;
    }
    box.innerHTML = ordens.map((o) => {
      const linhas = o.itens.map((i) =>
        '<tr>' +
          '<td class="utilizacao-item">' + esc(i.nome) + '</td>' +
          '<td>' + fmt(i.retirado) + '</td>' +
          '<td>' + (o.finalizada ? fmt(i.usado) : '-') + '</td>' +
          '<td class="' + (i.devolver > 0 ? 'utilizacao-devolver' : '') + '">' + (o.finalizada ? fmt(i.devolver) : '-') + '</td>' +
        '</tr>').join('');
      const situacao = !o.finalizada
        ? '<span class="utilizacao-tag utilizacao-tag-andamento">Em andamento</span>'
        : (o.total_devolver > 0
          ? '<span class="utilizacao-tag utilizacao-tag-devolver">Devolver ' + fmt(o.total_devolver) + '</span>'
          : '<span class="utilizacao-tag utilizacao-tag-ok">Tudo conferido</span>');
      const acao = (o.finalizada && o.total_devolver > 0 && o.ids_retirada.length)
        ? '<button type="button" class="utilizacao-btn" data-id-retirada="' + esc(o.ids_retirada[0]) + '">Registrar devolução</button>'
        : '';
      return '<div class="utilizacao-card">' +
        '<div class="utilizacao-topo"><strong>' + esc(o.numero_os || ('O.S. #' + o.id)) + '</strong>' + situacao + '</div>' +
        '<div class="utilizacao-ids">Retirada ' + esc(o.ids_retirada.join(', ') || '-') + '</div>' +
        '<table class="utilizacao-tabela sem-cartao"><thead><tr><th>Item</th><th>Saiu</th><th>Usado</th><th>Devolver</th></tr></thead>' +
        '<tbody>' + linhas + '</tbody></table>' + acao +
        '</div>';
    }).join('');
    box.querySelectorAll('.utilizacao-btn').forEach((b) =>
      b.addEventListener('click', () => irParaDevolucao(b.dataset.idRetirada)));
  }

  async function carregar() {
    const box = el('confirmacao-utilizacao-info');
    if (!box) return;
    try {
      const resp = await fetch(apiUrl('/estoque/utilizacao-os'), {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
      });
      const dados = await resp.json();
      if (!resp.ok || dados.status !== 'ok') throw new Error(dados.mensagem || 'Erro');
      render(dados.ordens || []);
    } catch (e) {
      box.innerHTML = '<p class="utilizacao-vazio">Não foi possível carregar a utilização dos itens.</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', carregar);
  window.recarregarUtilizacaoItens = carregar;
})();

// ===================== AGENDAMENTO DE ENTRADAS (Painel) =====================
(function () {
  'use strict';
  const el = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cab = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') });
  const dataBr = (iso) => (iso ? iso.split('-').reverse().join('/') : '-');
  const X = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  async function chamar(metodo, caminho, corpo) {
    const resp = await fetch(apiUrl(caminho), { method: metodo, headers: cab(), body: corpo ? JSON.stringify(corpo) : undefined });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok || dados.status !== 'ok') throw new Error(dados.mensagem || 'Falha na requisição.');
    return dados;
  }

  function render(lista) {
    const box = el('agendamento-entradas-info');
    if (!box) return;
    if (!lista.length) {
      box.innerHTML = '<p class="utilizacao-vazio">Nenhuma entrada agendada.</p>';
      return;
    }
    const hoje = new Date().toISOString().slice(0, 10);
    box.innerHTML = lista.map((a) => {
      const atrasado = a.previsao_entrega && a.previsao_entrega < hoje;
      return '<div class="agenda-card">' +
        '<div class="agenda-topo"><strong>' + dataBr(a.data_agendada) + '</strong>' +
        (atrasado ? '<span class="utilizacao-tag utilizacao-tag-devolver">Atrasada</span>' : '') +
        '<button type="button" class="os-op-remover agenda-remover" data-id="' + a.id + '" title="Remover" aria-label="Remover">' + X + '</button></div>' +
        '<dl class="agenda-dados">' +
          '<dt>Nº nota</dt><dd>' + esc(a.numero_nota || '-') + '</dd>' +
          (a.fornecedor ? '<dt>Fornecedor</dt><dd>' + esc(a.fornecedor) + '</dd>' : '') +
          '<dt>Previsão</dt><dd>' + dataBr(a.previsao_entrega) + '</dd>' +
          '<dt>Destinação</dt><dd>' + esc(a.destinacao || '-') + '</dd>' +
        '</dl>' +
        '<button type="button" class="utilizacao-btn agenda-recebido" data-id="' + a.id + '">Marcar como recebida</button>' +
        '</div>';
    }).join('');
    box.querySelectorAll('.agenda-remover').forEach((b) => b.addEventListener('click', async () => {
      if (b.dataset.confirmar !== '1') {
        b.dataset.confirmar = '1';
        b.classList.add('confirmando');
        b.title = 'Toque de novo para remover';
        setTimeout(() => { b.dataset.confirmar = ''; b.classList.remove('confirmando'); b.title = 'Remover'; }, 3000);
        return;
      }
      try { await chamar('DELETE', '/estoque/agendamentos/' + b.dataset.id); carregar(); } catch (e) { alert(e.message); }
    }));
    box.querySelectorAll('.agenda-recebido').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await chamar('PUT', '/estoque/agendamentos/' + b.dataset.id); carregar(); } catch (e) { alert(e.message); b.disabled = false; }
    }));
  }

  async function carregar() {
    try {
      const dados = await chamar('GET', '/estoque/agendamentos');
      render(dados.agendamentos || []);
    } catch (e) {
      const box = el('agendamento-entradas-info');
      if (box) box.innerHTML = '<p class="utilizacao-vazio">Não foi possível carregar os agendamentos.</p>';
    }
  }

  function abrirForm(abrir) {
    const form = el('agenda-form');
    if (!form) return;
    form.hidden = !abrir;
    el('agenda-novo-btn').hidden = abrir;
    if (abrir) {
      if (!el('agenda-data').value) el('agenda-data').value = new Date().toISOString().slice(0, 10);
      el('agenda-previsao').focus();
    } else {
      form.reset();
      el('agenda-erro').hidden = true;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!el('agendamento-entradas-info')) return;
    carregar();
    el('agenda-novo-btn')?.addEventListener('click', () => abrirForm(true));
    el('agenda-cancelar')?.addEventListener('click', () => abrirForm(false));
    el('agenda-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const erro = el('agenda-erro');
      erro.hidden = true;
      if (!el('agenda-data').value) { erro.textContent = 'Informe a data agendada.'; erro.hidden = false; return; }
      try {
        await chamar('POST', '/estoque/agendamentos', {
          data_agendada: el('agenda-data').value,
          previsao_entrega: el('agenda-previsao').value,
          numero_nota: el('agenda-nota').value,
          fornecedor: el('agenda-fornecedor').value,
          destinacao: el('agenda-destinacao').value,
        });
        abrirForm(false);
        carregar();
      } catch (err) {
        erro.textContent = err.message;
        erro.hidden = false;
      }
    });
  });
})();
