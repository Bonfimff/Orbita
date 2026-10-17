// Funcionários: a lista fica em Gestão › Funcionários e o formulário em
// Cadastros › Funcionário (abre por cadastros.html#funcionario ou
// #funcionario-<id>). Um clique na linha abre a edição; ao salvar, volta à lista.
// Mesma pessoa = mesmo cadastro: ao digitar o CPF ou o nome, o sistema avisa
// se já existe funcionário ou usuário do sistema com esse nome.
// Tipo sanguíneo, emergência e certificados são do funcionário (o crachá do
// usuário com login lê do funcionário ligado a ele).
(function () {
  'use strict';
  const el = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cab = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') });
  const ICONE_EDITAR = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
  const ICONE_DESATIVAR = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const irParaCadastro = (id) => { window.location.href = 'cadastros.html#funcionario' + (id ? '-' + id : ''); };
  const voltarParaLista = () => { window.location.href = 'gestao.html#funcionarios'; };

  let funcionarios = [];
  let usuarios = [];
  let caps = null;

  async function chamar(metodo, caminho, corpo) {
    const resp = await fetch(apiUrl(caminho), { method: metodo, headers: cab(), body: corpo ? JSON.stringify(corpo) : undefined });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok || dados.status !== 'ok') throw new Error(dados.mensagem || 'Falha na requisição.');
    return dados;
  }

  function cpfFormatado(cpf) {
    const d = String(cpf || '').replace(/\D/g, '');
    if (d.length !== 11) return d;
    return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
  }

  async function carregarLista() {
    const dados = await chamar('GET', '/funcionarios');
    funcionarios = dados.funcionarios || [];
  }

  //============================================================ LISTA (Gestão)
  function render() {
    const tbody = document.querySelector('#tabela-funcionarios tbody');
    const termo = (el('func-busca').value || '').trim().toLowerCase();
    const termoDig = termo.replace(/\D/g, '');
    const inativos = el('func-mostrar-inativos').checked;
    const lista = funcionarios.filter((f) => (inativos || f.ativo) && (!termo ||
      String(f.nome || '').toLowerCase().includes(termo) ||
      String(f.matricula || '').toLowerCase().includes(termo) ||
      (termoDig && String(f.cpf || '').includes(termoDig))));
    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="padding:0.75rem;">Nenhum funcionário encontrado.</td></tr>';
      return;
    }
    tbody.innerHTML = lista.map((f) =>
      '<tr data-id="' + f.id + '" class="linha-clicavel">' +
        '<td>' + esc(f.nome) + '</td>' +
        '<td>' + esc(cpfFormatado(f.cpf) || '-') + '</td>' +
        '<td>' + esc(f.matricula || '-') + '</td>' +
        '<td>' + esc(f.funcao_nome || '-') + '</td>' +
        '<td>' + esc(f.usuario_login || 'Sem login') + '</td>' +
        '<td>' + (f.ativo ? 'Ativo' : 'Inativo') + '</td>' +
        '<td><div class="gestao-acoes-cell">' +
          '<button type="button" class="gestao-btn-icone func-editar" title="Editar">' + ICONE_EDITAR + '</button>' +
          (f.ativo ? '<button type="button" class="gestao-btn-icone func-desativar" title="Desativar">' + ICONE_DESATIVAR + '</button>' : '') +
        '</div></td>' +
      '</tr>').join('');
  }

  function iniciarLista() {
    const tbody = document.querySelector('#tabela-funcionarios tbody');
    tbody.addEventListener('click', async (e) => {
      const linha = e.target.closest('tr[data-id]');
      if (!linha) return;
      if (e.target.closest('.func-desativar')) {
        const f = funcionarios.find((x) => String(x.id) === linha.dataset.id);
        if (!confirm('Desativar ' + f.nome + '? Ele deixa de aparecer para novas equipes, mas continua no histórico.')) return;
        try { await chamar('DELETE', '/funcionarios/' + f.id); await atualizarLista(); } catch (err) { alert(err.message); }
        return;
      }
      // Um clique na linha (ou no lápis) abre a edição.
      irParaCadastro(linha.dataset.id);
    });
    el('func-busca').addEventListener('input', render);
    el('func-mostrar-inativos').addEventListener('change', render);
    el('btn-novo-funcionario')?.addEventListener('click', () => irParaCadastro());
    atualizarLista();
  }

  async function atualizarLista() {
    try {
      await carregarLista();
      render();
    } catch (e) {
      document.querySelector('#tabela-funcionarios tbody').innerHTML =
        '<tr><td colspan="7" style="padding:0.75rem;">' + esc(e.message) + '</td></tr>';
    }
  }

  //====================================================== FORMULÁRIO (Cadastros)
  function feedback(msg, tipo) {
    const f = el('func-feedback');
    f.style.display = msg ? 'block' : 'none';
    f.className = 'gestao-feedback ' + (tipo === 'erro' ? 'erro' : 'sucesso');
    f.textContent = msg || '';
  }

  async function carregarCatalogos() {
    try {
      const resp = await fetch(apiUrl('/funcoes-os'), { headers: cab() });
      const dados = await resp.json();
      const funcoes = (dados && (dados.dados || dados.funcoes)) || [];
      el('func-funcao').innerHTML = '<option value="">Sem função definida</option>' +
        funcoes.map((f) => '<option value="' + f.id + '">' + esc(f.nome) + '</option>').join('');
    } catch (e) { /* sem funções: campo fica só com "Sem função" */ }
    try {
      const resp = await fetch(apiUrl('/usuarios/listar'), { headers: cab() });
      const dados = await resp.json();
      usuarios = (dados && dados.usuarios) || [];
    } catch (e) { usuarios = []; }
  }

  function preencherUsuarios(selecionado) {
    const ligados = new Set(funcionarios.filter((f) => f.usuario_id && String(f.id) !== el('func-id').value)
      .map((f) => String(f.usuario_id)));
    el('func-usuario').innerHTML = '<option value="">Sem login</option>' + usuarios
      .filter((u) => !ligados.has(String(u.id)) || String(u.id) === String(selecionado || ''))
      .map((u) => '<option value="' + u.id + '">' + esc(u.usuario) + '</option>').join('');
    el('func-usuario').value = selecionado ? String(selecionado) : '';
  }

  // Escalas de revezamento (12x36, 24x48...) precisam de um dia de referência.
  function mostrarInicioEscala() {
    const tipo = el('func-escala').value;
    el('func-escala-inicio-item').hidden = !/^(12x36|24x48|24x72)$/.test(tipo);
  }
  document.addEventListener('change', (e) => { if (e.target && e.target.id === 'func-escala') mostrarInicioEscala(); });

  function preencher(f) {
    el('func-id').value = f ? f.id : '';
    el('titulo-cadastro-funcionario').textContent = f ? 'Editar funcionário ' + f.nome : 'Novo funcionário';
    el('func-nome').value = f ? (f.nome || '') : '';
    el('func-cpf').value = f ? cpfFormatado(f.cpf || '') : '';
    el('func-matricula').value = f ? (f.matricula || '') : '';
    el('func-funcao').value = f && f.funcao_id ? String(f.funcao_id) : '';
    el('func-telefone').value = f ? (f.telefone || '') : '';
    el('func-email').value = f ? (f.email || '') : '';
    el('func-observacao').value = f ? (f.observacao || '') : '';
    el('func-ativo').checked = f ? !!f.ativo : true;
    el('func-sangue').value = f ? (f.tipo_sanguineo || '') : '';
    el('func-escala').value = f ? (f.escala_tipo || '') : '';
    el('func-escala-inicio').value = f ? (f.escala_inicio || '') : '';
    mostrarInicioEscala();
    const m = (f && f.medicas) || {};
    el('func-med-alergias').value = m.alergias || '';
    el('func-med-condicoes').value = m.condicoes || '';
    el('func-med-medicamentos').value = m.medicamentos || '';
    el('func-med-contato').value = m.emergencia_nome || '';
    el('func-med-telefone').value = m.emergencia_telefone || '';
    el('func-med-publico').checked = m.publico !== false;
    preencherUsuarios(f ? f.usuario_id : '');
    el('btn-salvar-funcionario').textContent = f ? 'Atualizar funcionário' : 'Salvar funcionário';
    el('func-mesma-pessoa').hidden = true;
    feedback('');
    // Capacitações só existem para funcionário já salvo.
    el('func-bloco-capacitacoes').hidden = !f;
    caps.limpar();
    if (f) caps.carregar('/funcionarios/' + f.id);
  }

  // ---- mesma pessoa (CPF ou nome) ----
  let ultimaBusca = 0;
  async function verificarMesmaPessoa() {
    const caixa = el('func-mesma-pessoa');
    const cpf = el('func-cpf').value.replace(/\D/g, '');
    const nome = el('func-nome').value.trim();
    if (!nome && cpf.length !== 11) { caixa.hidden = true; return; }
    const minha = ++ultimaBusca;
    const params = new URLSearchParams();
    if (cpf.length === 11) params.set('cpf', cpf);
    if (nome) params.set('nome', nome);
    if (el('func-id').value) params.set('ignorar', el('func-id').value);
    try {
      const dados = await chamar('GET', '/funcionarios/mesma-pessoa?' + params.toString());
      if (minha !== ultimaBusca) return;
      if (dados.funcionario) {
        const f = dados.funcionario;
        caixa.innerHTML = 'Já existe o cadastro de <strong>' + esc(f.nome) + '</strong>' +
          (dados.por === 'cpf' ? ' com este CPF.' : ' com este nome.') +
          ' <button type="button" class="func-mesma-acao">Abrir cadastro</button>';
        caixa.hidden = false;
        caixa.querySelector('.func-mesma-acao').addEventListener('click', () => irParaCadastro(f.id));
      } else if (dados.usuario && !el('func-usuario').value) {
        const u = dados.usuario;
        caixa.innerHTML = 'Esta pessoa é o usuário <strong>' + esc(u.usuario) + '</strong> do sistema. ' +
          'O cadastro foi ligado a ele' + (u.email ? ' e o e-mail foi preenchido.' : '.');
        caixa.hidden = false;
        preencherUsuarios(u.id);
        if (u.email && !el('func-email').value) el('func-email').value = u.email;
      } else {
        caixa.hidden = true;
      }
    } catch (e) {
      caixa.hidden = true;
    }
  }

  async function salvar(e) {
    e.preventDefault();
    const id = el('func-id').value;
    const corpo = {
      nome: el('func-nome').value.trim(),
      cpf: el('func-cpf').value,
      matricula: el('func-matricula').value,
      funcao_id: el('func-funcao').value || null,
      telefone: el('func-telefone').value,
      email: el('func-email').value,
      usuario_id: el('func-usuario').value || null,
      ativo: el('func-ativo').checked,
      observacao: el('func-observacao').value,
      tipo_sanguineo: el('func-sangue').value,
      escala_tipo: el('func-escala').value,
      escala_inicio: el('func-escala-inicio').value,
      medicas: {
        alergias: el('func-med-alergias').value,
        condicoes: el('func-med-condicoes').value,
        medicamentos: el('func-med-medicamentos').value,
        emergencia_nome: el('func-med-contato').value,
        emergencia_telefone: el('func-med-telefone').value,
        publico: el('func-med-publico').checked,
      },
    };
    if (!corpo.nome) { feedback('Informe o nome.', 'erro'); return; }
    const botao = el('btn-salvar-funcionario');
    botao.disabled = true;
    try {
      await chamar(id ? 'PUT' : 'POST', id ? '/funcionarios/' + id : '/funcionarios', corpo);
      voltarParaLista();
    } catch (err) {
      feedback(err.message, 'erro');
    } finally {
      botao.disabled = false;
    }
  }

  async function abrirPeloEndereco() {
    const hash = (location.hash || '').replace('#', '');
    if (!hash.startsWith('funcionario')) return;
    document.querySelector('.tab-btn[data-tab="funcionario"]')?.click();
    const id = hash.split('-')[1];
    try { await carregarLista(); } catch (e) { funcionarios = []; }
    preencher(id ? funcionarios.find((f) => String(f.id) === id) || null : null);
  }

  function iniciarFormulario() {
    caps = window.CapacitacoesUI.montar(el('func-caps'));
    carregarCatalogos().then(abrirPeloEndereco);
    el('form-funcionario').addEventListener('submit', salvar);
    el('btn-limpar-funcionario').addEventListener('click', voltarParaLista);
    el('func-nome').addEventListener('blur', verificarMesmaPessoa);
    el('func-cpf').addEventListener('input', () => {
      const d = el('func-cpf').value.replace(/\D/g, '').slice(0, 11);
      el('func-cpf').value = d.length === 11 ? cpfFormatado(d) : d;
      if (d.length === 11) verificarMesmaPessoa();
    });
    window.addEventListener('hashchange', abrirPeloEndereco);
    // Abrir a aba pelo menu (sem #funcionario-id) = novo funcionário.
    document.querySelector('.tab-btn[data-tab="funcionario"]')?.addEventListener('click', () => {
      if (!(location.hash || '').startsWith('#funcionario-') && !el('func-id').value) preencher(null);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (el('form-funcionario')) iniciarFormulario();
    if (el('tabela-funcionarios')) iniciarLista();
  });
})();
