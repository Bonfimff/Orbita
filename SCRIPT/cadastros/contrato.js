//======================================================================================================
// GESTÃO › CADASTROS › Contratos
// Formulário de criar e editar contrato (nome, CNPJ, especificações) e o
// explorador de arquivos do contrato. A lista fica em Gestão › Contratos;
// de lá, "Editar" e "+ Novo contrato" abrem este formulário por
// cadastros.html#contrato-<id> ou #contrato.
//======================================================================================================
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cabecalhos = (json) => Object.assign(json ? { 'Content-Type': 'application/json' } : {},
    { Authorization: 'Bearer ' + localStorage.getItem('token') });
  const voltarParaLista = () => { window.location.href = 'gestao.html#contratos'; };

  let editandoId = null;

  function feedback(texto, tipo) {
    const f = el('contrato-form-feedback');
    f.textContent = texto || '';
    f.className = 'gestao-feedback' + (tipo ? ' ' + tipo : '');
    f.style.display = texto ? 'block' : 'none';
  }

  async function montarArquivos() {
    const alvo = el('contrato-arquivos-lista');
    if (!editandoId || !window.Explorador) {
      alvo.innerHTML = '<p class="gestao-dica-arquivos">Salve o contrato para organizar os arquivos em pastas.</p>';
      return;
    }
    const id = editandoId;
    alvo.innerHTML = '<p class="gestao-dica-arquivos">Carregando arquivos...</p>';
    try {
      const resp = await fetch(window.apiUrl(`/explorador/contratos/${id}/arquivos`), { headers: cabecalhos() });
      const dados = await resp.json();
      if (dados.status !== 'ok') throw new Error(dados.mensagem || 'Não foi possível carregar os arquivos.');
      if (id !== editandoId) return;
      window.Explorador.montar(alvo, {
        base: '/explorador/contratos/' + id,
        podeAlterar: typeof window.temPermissao !== 'function' || window.temPermissao('gestao_contratos', 'editar'),
        dados: dados.dados,
        raizNome: el('contrato-nome').value || 'Contrato',
      });
    } catch (erro) {
      alvo.innerHTML = '<p class="gestao-dica-arquivos">' + esc(erro.message) + '</p>';
    }
  }

  function preencher(c) {
    editandoId = c ? c.id : null;
    el('form-contratos').reset();
    el('titulo-cadastro-contrato').textContent = c ? 'Editar contrato ' + c.nome : 'Novo contrato';
    el('contrato-nome').value = c ? (c.nome || '') : '';
    el('contrato-cnpj').value = c ? (c.cnpj || '') : '';
    el('contrato-especificacoes').value = c ? (c.especificacoes || '') : '';
    el('btn-salvar-contrato').textContent = c ? 'Atualizar contrato' : 'Salvar contrato';
    feedback('');
    document.dispatchEvent(new CustomEvent('orbita:contrato-selecionado', { detail: { id: editandoId } }));
    montarArquivos();
  }

  async function salvar(e) {
    e.preventDefault();
    const nome = el('contrato-nome').value.trim();
    if (!nome) { feedback('Informe o nome do contrato.', 'erro'); return; }
    const botao = el('btn-salvar-contrato');
    botao.disabled = true;
    try {
      const resp = await fetch(window.apiUrl(editandoId ? `/contratos/${editandoId}` : '/contratos'), {
        method: editandoId ? 'PUT' : 'POST',
        headers: cabecalhos(true),
        body: JSON.stringify({ nome, cnpj: el('contrato-cnpj').value.trim(), especificacoes: el('contrato-especificacoes').value.trim() }),
      });
      const dados = await resp.json();
      if (dados.status !== 'ok') { feedback(dados.mensagem || 'Erro ao salvar contrato.', 'erro'); return; }
      if (!editandoId && dados.contrato && dados.contrato.id) {
        // Contrato novo: continua aqui para já organizar os arquivos.
        history.replaceState(null, '', '#contrato-' + dados.contrato.id);
        preencher(dados.contrato);
        feedback('Contrato salvo. Agora você pode organizar os arquivos.', 'sucesso');
        return;
      }
      voltarParaLista();
    } catch (erro) {
      feedback('Erro de conexão ao salvar o contrato.', 'erro');
    } finally {
      botao.disabled = false;
    }
  }

  async function abrirPeloEndereco() {
    const hash = (location.hash || '').replace('#', '');
    if (!/^contrato(-\d+)?$/.test(hash)) return;
    document.querySelector('.tab-btn[data-tab="contrato"]')?.click();
    const id = hash.split('-')[1];
    if (!id) { preencher(null); return; }
    try {
      const resp = await fetch(window.apiUrl(`/contratos/${id}`), { headers: cabecalhos() });
      const dados = await resp.json();
      preencher(dados.status === 'ok' ? dados.contrato : null);
      if (dados.status !== 'ok') feedback(dados.mensagem || 'Contrato não encontrado.', 'erro');
    } catch (erro) {
      preencher(null);
      feedback('Erro de conexão ao carregar o contrato.', 'erro');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!el('form-contratos')) return;
    el('form-contratos').addEventListener('submit', salvar);
    el('btn-voltar-contrato').addEventListener('click', voltarParaLista);
    // Abrir a aba pelo menu (sem #contrato-id) = contrato novo.
    document.querySelector('.tab-btn[data-tab="contrato"]')?.addEventListener('click', () => {
      if (!/^#contrato-\d+$/.test(location.hash) && !editandoId) preencher(null);
    });
    window.addEventListener('hashchange', abrirPeloEndereco);
    setTimeout(abrirPeloEndereco, 300);
    if (!editandoId) montarArquivos();
  });
})();
