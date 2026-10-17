//======================================================================================================
// CADASTROS › USUÁRIO
// Formulário de criar/editar usuário (a lista fica em Gestão › Usuários).
// Abre por cadastros.html#usuario (novo) ou #usuario-<id> (editar); ao salvar,
// volta para a lista. Inclui tipo sanguíneo, informações de emergência,
// permissões sob medida, contratos e capacitações com PDF.
//======================================================================================================
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);
  if (!el('form-usuario')) return;

  let editandoId = null;
  const auth = (json) => {
    const h = { Authorization: 'Bearer ' + localStorage.getItem('token') };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  };
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const voltar = () => { window.location.href = 'gestao.html#usuarios'; };

  async function carregarPerfis() {
    const select = el('usuario-perfil');
    try {
      const resp = await fetch(window.apiUrl('/perfis'), { headers: auth() });
      const dados = await resp.json();
      const atual = select.value;
      select.innerHTML = '<option value="">Nenhum (sem acesso extra)</option>' +
        (dados.perfis || []).map((p) => `<option value="${p.id}">${esc(p.nome)}${p.fabrica ? ' (fábrica)' : ''}</option>`).join('');
      if (atual) select.value = atual;
    } catch (e) { /* segue só com "Nenhum" */ }
  }

  async function buscarUsuario(id) {
    const resp = await fetch(window.apiUrl('/usuarios'), { headers: auth() });
    const dados = await resp.json();
    if (dados.status !== 'ok') throw new Error(dados.mensagem || 'Não foi possível carregar o usuário.');
    return (dados.usuarios || []).find((u) => String(u.id) === String(id)) || null;
  }

  function preencher(u) {
    editandoId = u ? u.id : null;
    el('titulo-cadastro-usuario').textContent = u ? `Editar usuário ${u.usuario}` : 'Novo usuário';
    el('usuario-id').value = u ? u.id : '';
    el('usuario-login').value = u ? u.usuario : '';
    el('usuario-login').disabled = !!u;
    el('usuario-nome').value = u ? (u.nome || '') : '';
    el('usuario-email').value = u ? (u.email || '') : '';
    el('usuario-cargo').value = u ? (u.credencial_acesso || '') : '';
    el('usuario-foto').value = u ? (u.foto_url || '') : '';
    el('usuario-sangue').value = u ? (u.tipo_sanguineo || '') : '';
    const m = (u && u.medicas) || {};
    el('usuario-med-alergias').value = m.alergias || '';
    el('usuario-med-condicoes').value = m.condicoes || '';
    el('usuario-med-medicamentos').value = m.medicamentos || '';
    el('usuario-med-contato').value = m.emergencia_nome || '';
    el('usuario-med-telefone').value = m.emergencia_telefone || '';
    el('usuario-med-publico').checked = m.publico !== false;
    el('usuario-perfil').value = u ? (u.perfil_id || '') : '';
    el('usuario-usa-customizadas').checked = u ? !!u.usa_permissoes_customizadas : false;
    window.popularChecklistContratos(el('usuario-contratos-lista'), u ? (u.contratos_autorizados || []) : []);

    el('campo-senha-criacao').style.display = u ? 'none' : '';
    el('usuario-senha').required = !u;
    el('usuario-senha').value = '';
    el('campo-redefinir-senha').style.display = u ? '' : 'none';
    el('usuario-redefinir-senha-toggle').checked = false;
    el('usuario-nova-senha').style.display = 'none';
    el('usuario-nova-senha').value = '';

    window.MatrizPermissoes.render('matriz-permissoes-usuario', u ? u.permissoes : {});
    el('bloco-permissoes-usuario').style.display = el('usuario-usa-customizadas').checked ? '' : 'none';
    el('usuario-form-feedback').style.display = 'none';

    el('bloco-capacitacoes').style.display = u ? '' : 'none';
    ['cap-nome', 'cap-certificado', 'cap-emissao', 'cap-validade'].forEach((id) => { el(id).value = ''; });
    if (u) carregarCapacitacoes(u.id);
  }

  async function abrirPeloEndereco() {
    const hash = (location.hash || '').replace('#', '');
    if (!hash.startsWith('usuario')) return;
    document.querySelector('.tab-btn[data-tab="usuario"]')?.click();
    await carregarPerfis();
    const id = hash.split('-')[1];
    if (!id) { preencher(null); return; }
    try {
      const u = await buscarUsuario(id);
      if (!u) throw new Error('Usuário não encontrado.');
      preencher(u);
    } catch (e) {
      preencher(null);
      mostrarErro(e.message);
    }
  }

  function mostrarErro(texto) {
    const fb = el('usuario-form-feedback');
    fb.className = 'gestao-feedback erro';
    fb.textContent = texto;
    fb.style.display = 'block';
  }

  async function salvar(ev) {
    ev.preventDefault();
    el('usuario-form-feedback').style.display = 'none';
    const custom = el('usuario-usa-customizadas').checked;
    const payload = {
      nome: el('usuario-nome').value,
      email: el('usuario-email').value,
      foto_url: el('usuario-foto').value,
      credencial_acesso: el('usuario-cargo').value,
      tipo_sanguineo: el('usuario-sangue').value,
      medicas: {
        alergias: el('usuario-med-alergias').value,
        condicoes: el('usuario-med-condicoes').value,
        medicamentos: el('usuario-med-medicamentos').value,
        emergencia_nome: el('usuario-med-contato').value,
        emergencia_telefone: el('usuario-med-telefone').value,
        publico: el('usuario-med-publico').checked,
      },
      perfil_id: el('usuario-perfil').value || null,
      usa_permissoes_customizadas: custom,
      contratos_autorizados: window.coletarContratosSelecionados(el('usuario-contratos-lista')),
    };
    if (custom) payload.permissoes = window.MatrizPermissoes.coletar('matriz-permissoes-usuario');
    let url = '/usuarios';
    let method = 'POST';
    if (editandoId) {
      url = `/usuarios/${editandoId}`;
      method = 'PUT';
      if (el('usuario-redefinir-senha-toggle').checked) payload.nova_senha = el('usuario-nova-senha').value;
    } else {
      payload.usuario = el('usuario-login').value;
      payload.senha = el('usuario-senha').value;
    }
    try {
      const resp = await fetch(window.apiUrl(url), { method, headers: auth(true), body: JSON.stringify(payload) });
      const dados = await resp.json();
      if (dados.status !== 'ok') { mostrarErro(dados.mensagem || 'Erro ao salvar usuário.'); return; }
      voltar();
    } catch (e) {
      mostrarErro('Erro de conexão ao salvar o usuário.');
    }
  }

  // ---------------------------------------------------- capacitações
  function renderCapacitacoes(dados) {
    const pend = (dados.pendencias || []).map((p) => `<div class="gestao-caps-pendencia">${esc(p.motivo)}</div>`).join('');
    const itens = (dados.capacitacoes || []).map((c) => `
      <div class="gestao-caps-item">
        <span><strong>${esc(c.nome)}</strong>${c.certificado ? ' · ' + esc(c.certificado) : ''}
          <small>${c.validade ? 'válida até ' + c.validade.split('-').reverse().join('/') : 'sem validade'}</small></span>
        <span class="gestao-caps-selo ${esc(c.situacao)}">${esc(c.rotulo)}</span>
        ${c.tem_arquivo ? `<button type="button" class="gestao-caps-link" data-cap-ver="${c.id}">Ver PDF</button>` : ''}
        <label class="gestao-caps-link">${c.tem_arquivo ? 'Trocar PDF' : 'Anexar PDF'}<input type="file" accept="application/pdf" data-cap-arquivo="${c.id}" hidden></label>
        <button type="button" class="gestao-btn-icone" data-cap-excluir="${c.id}" title="Remover" aria-label="Remover ${esc(c.nome)}">&times;</button>
      </div>`).join('');
    el('usuario-capacitacoes-lista').innerHTML = pend + (itens || '<p class="gestao-ajuda-texto">Nenhuma capacitação cadastrada.</p>');
  }

  async function carregarCapacitacoes(id) {
    const lista = el('usuario-capacitacoes-lista');
    lista.innerHTML = '<p class="gestao-ajuda-texto">Carregando...</p>';
    try {
      const resp = await fetch(window.apiUrl(`/usuarios/${id}/capacitacoes`), { headers: auth() });
      const dados = await resp.json();
      if (dados.status !== 'ok') throw new Error(dados.mensagem);
      renderCapacitacoes(dados);
    } catch (e) {
      lista.innerHTML = `<p class="gestao-ajuda-texto">${esc(e.message || 'Não foi possível carregar.')}</p>`;
    }
  }

  document.addEventListener('click', async (e) => {
    if (e.target.closest('#cap-adicionar') && editandoId) {
      const corpo = { nome: el('cap-nome').value, certificado: el('cap-certificado').value, emissao: el('cap-emissao').value, validade: el('cap-validade').value };
      const resp = await fetch(window.apiUrl(`/usuarios/${editandoId}/capacitacoes`), { method: 'POST', headers: auth(true), body: JSON.stringify(corpo) });
      const dados = await resp.json().catch(() => ({}));
      if (dados.status !== 'ok') { alert(dados.mensagem || 'Não foi possível adicionar.'); return; }
      ['cap-nome', 'cap-certificado', 'cap-emissao', 'cap-validade'].forEach((id) => { el(id).value = ''; });
      renderCapacitacoes(dados);
      return;
    }
    const ver = e.target.closest('[data-cap-ver]');
    if (ver && editandoId) {
      const resp = await fetch(window.apiUrl(`/usuarios/${editandoId}/capacitacoes/${ver.dataset.capVer}/arquivo`), { headers: auth() });
      if (!resp.ok) { alert('Não foi possível abrir o PDF.'); return; }
      window.open(URL.createObjectURL(await resp.blob()), '_blank');
      return;
    }
    const excluir = e.target.closest('[data-cap-excluir]');
    if (excluir && editandoId) {
      if (!confirm('Remover esta capacitação?')) return;
      await fetch(window.apiUrl(`/usuarios/${editandoId}/capacitacoes/${excluir.dataset.capExcluir}`), { method: 'DELETE', headers: auth() });
      carregarCapacitacoes(editandoId);
    }
  });

  document.addEventListener('change', async (e) => {
    const campo = e.target.closest('[data-cap-arquivo]');
    if (!campo || !campo.files.length || !editandoId) return;
    const formulario = new FormData();
    formulario.append('arquivo', campo.files[0]);
    const resp = await fetch(window.apiUrl(`/usuarios/${editandoId}/capacitacoes/${campo.dataset.capArquivo}/arquivo`), { method: 'POST', headers: auth(), body: formulario });
    const dados = await resp.json().catch(() => ({}));
    if (dados.status !== 'ok') alert(dados.mensagem || 'Não foi possível anexar.');
    carregarCapacitacoes(editandoId);
  });

  // ---------------------------------------------------- ligações
  el('form-usuario').addEventListener('submit', salvar);
  el('cancelar-cadastro-usuario').addEventListener('click', voltar);
  el('usuario-usa-customizadas').addEventListener('change', (e) => { el('bloco-permissoes-usuario').style.display = e.target.checked ? '' : 'none'; });
  el('usuario-redefinir-senha-toggle').addEventListener('change', (e) => { el('usuario-nova-senha').style.display = e.target.checked ? '' : 'none'; });
  // Abrir a aba pelo menu (sem #usuario-id) = novo usuário.
  document.querySelector('.tab-btn[data-tab="usuario"]')?.addEventListener('click', () => {
    if (!(location.hash || '').startsWith('#usuario-') && editandoId === null) { carregarPerfis(); preencher(null); }
  });
  window.addEventListener('hashchange', abrirPeloEndereco);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(abrirPeloEndereco, 300));
  else setTimeout(abrirPeloEndereco, 300);
})();
