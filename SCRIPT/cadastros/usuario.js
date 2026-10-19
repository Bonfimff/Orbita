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
    el('usuario-login').disabled = false;
    el('usuario-nome').value = u ? (u.nome || '') : '';
    el('usuario-email').value = u ? (u.email || '') : '';
    el('usuario-cargo').value = u ? (u.credencial_acesso || '') : '';
    el('usuario-pagina-inicial').value = u ? (u.pagina_inicial || '') : '';
    el('usuario-foto').value = u ? (u.foto_url || '') : '';
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

    // Dados de crachá ficam no funcionário ligado ao usuário.
    el('bloco-pessoa-usuario').hidden = !u;
    if (u) {
      fetch(window.apiUrl('/funcionarios'), { headers: auth() }).then((r) => r.json()).then((d) => {
        const f = (d.funcionarios || []).find((x) => String(x.usuario_id) === String(u.id));
        el('usuario-abrir-funcionario').href = f ? 'cadastros.html#funcionario-' + f.id : 'cadastros.html#funcionario';
      }).catch(() => {});
    }
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
      pagina_inicial: el('usuario-pagina-inicial').value,
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
      payload.usuario = el('usuario-login').value.trim();
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
