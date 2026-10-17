(function () {
  // Lista de permissões: vem da API (services/permissoes.py), que é a mesma
  // tabela usada para bloquear as rotas. Colunas: Visualizar, Editar e
  // Criar/Excluir; a linha só mostra caixa nas colunas que fazem sentido.
  const COLUNAS = [
    { acao: 'ver', rotulo: 'Ver' },
    { acao: 'editar', rotulo: 'Editar' },
    { acao: 'excluir', rotulo: 'Criar/Excluir' },
  ];
  let catalogoPermissoes = null;

  async function carregarCatalogoPermissoes() {
    if (catalogoPermissoes) return catalogoPermissoes;
    const resp = await fetch(window.apiUrl('/permissoes/catalogo'), { headers: authHeaders() });
    const dados = await resp.json();
    if (dados.status !== 'ok') throw new Error(dados.mensagem || 'Não foi possível carregar a lista de permissões.');
    catalogoPermissoes = dados.catalogo;
    return catalogoPermissoes;
  }

  let perfisCache = [];
  let usuarioLogadoId = null;
  let usuarioEditandoId = null;
  let perfilEditandoId = null;
  let contratoEditandoId = null;

  function authHeaders(json = false) {
    const h = { 'Authorization': 'Bearer ' + localStorage.getItem('token') };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  function pegarIdUsuarioLogado() {
    try {
      const token = localStorage.getItem('token');
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return String(payload.sub);
    } catch (e) {
      return null;
    }
  }

  function listaDeString(texto) {
    const partes = (texto || '').split(',').map(s => s.trim()).filter(Boolean);
    return partes.length ? partes : null;
  }

  function stringDeLista(lista) {
    return Array.isArray(lista) ? lista.join(', ') : '';
  }

  // ===== Matriz de permissões (usada no form de usuário e de perfil) =====
  async function renderMatrizPermissoes(containerId, valoresAtuais) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const v = valoresAtuais || {};
    container.innerHTML = '<div class="gestao-matriz-linha"><span>Carregando permissões...</span></div>';
    let catalogo;
    try {
      catalogo = await carregarCatalogoPermissoes();
    } catch (e) {
      container.innerHTML = `<div class="gestao-matriz-linha"><span>${e.message}</span></div>`;
      return;
    }
    container.innerHTML = `
      <div class="gestao-matriz-linha gestao-matriz-cabecalho">
        <span>Permissão</span>
        ${COLUNAS.map(c => `<span>${c.rotulo.replace('/', '/<wbr>')}</span>`).join('')}
      </div>
      ${catalogo.map(g => `
        <div class="gestao-matriz-grupo" data-grupo="${g.grupo}">
          <span>${g.grupo}</span>
          ${COLUNAS.map(c => g.itens.some(i => i.acoes.includes(c.acao))
            ? `<button type="button" class="gestao-matriz-todos" data-acao="${c.acao}" title="Marcar ou desmarcar a coluna inteira deste grupo">todos</button>`
            : '<span></span>').join('')}
        </div>
        ${g.itens.map(item => {
          const atual = v[item.chave] || {};
          return `
            <div class="gestao-matriz-linha" data-modulo="${item.chave}" data-grupo="${g.grupo}">
              <span>${item.rotulo}</span>
              ${COLUNAS.map(c => item.acoes.includes(c.acao)
                ? `<input type="checkbox" class="gestao-perm" data-acao="${c.acao}" aria-label="${c.rotulo}: ${item.rotulo}" ${atual[c.acao] ? 'checked' : ''}>`
                : '<span class="gestao-matriz-vazio" aria-hidden="true"></span>').join('')}
            </div>`;
        }).join('')}
      `).join('')}
    `;
  }

  // Editar ou criar sem poder ver não faz sentido: marca "Visualizar" junto.
  // O botão "todos" do grupo marca/desmarca a coluna inteira.
  document.addEventListener('change', e => {
    const caixa = e.target.closest('.gestao-perm');
    if (!caixa || !caixa.checked || caixa.dataset.acao === 'ver') return;
    const ver = caixa.closest('.gestao-matriz-linha').querySelector('.gestao-perm[data-acao="ver"]');
    if (ver) ver.checked = true;
  });
  document.addEventListener('click', e => {
    const botao = e.target.closest('.gestao-matriz-todos');
    if (!botao) return;
    const matriz = botao.closest('.gestao-matriz-permissoes');
    const grupo = botao.closest('.gestao-matriz-grupo').dataset.grupo;
    const caixas = Array.from(matriz.querySelectorAll(`.gestao-matriz-linha[data-grupo="${grupo}"] .gestao-perm[data-acao="${botao.dataset.acao}"]`));
    const marcar = caixas.some(c => !c.checked);
    caixas.forEach(c => {
      c.checked = marcar;
      if (marcar && c.dataset.acao !== 'ver') {
        const ver = c.closest('.gestao-matriz-linha').querySelector('.gestao-perm[data-acao="ver"]');
        if (ver) ver.checked = true;
      }
    });
  });

  function coletarMatrizPermissoes(containerId) {
    const container = document.getElementById(containerId);
    const resultado = {};
    if (!container) return resultado;
    container.querySelectorAll('.gestao-matriz-linha[data-modulo]').forEach(linha => {
      const permissoes = {};
      linha.querySelectorAll('.gestao-perm').forEach(campo => {
        permissoes[campo.dataset.acao] = campo.checked ? 1 : 0;
      });
      resultado[linha.dataset.modulo] = permissoes;
    });
    return resultado;
  }

  function resumoPermissoesPerfil(permissoes) {
    if (!catalogoPermissoes) return '';
    return catalogoPermissoes.map(g => {
      let total = 0;
      let liberadas = 0;
      g.itens.forEach(item => item.acoes.forEach(acao => {
        total += 1;
        if ((permissoes[item.chave] || {})[acao]) liberadas += 1;
      }));
      const texto = liberadas === 0 ? 'Sem acesso' : (liberadas === total ? 'Completo' : `${liberadas} de ${total}`);
      return `<div class="gestao-perfil-modulo-linha"><span>${g.grupo}</span><span>${texto}</span></div>`;
    }).join('');
  }

  // ===== Aba Usuários =====
  async function carregarUsuarios() {
    const tbody = document.querySelector('#tabela-usuarios tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4"><div class="carregando-inline" role="status"><span class="carregando-inline-logo"></span><span class="carregando-inline-texto">Carregando...</span></div></td></tr>';
    try {
      const resp = await fetch(window.apiUrl('/usuarios'), { headers: authHeaders() });
      const dados = await resp.json();
      if (dados.status !== 'ok') {
        tbody.innerHTML = `<tr><td colspan="4" style="padding:0.75rem;">${dados.mensagem || 'Erro ao carregar usuários.'}</td></tr>`;
        return;
      }

      // Os 3 cards antigos saíram do Painel Geral (virou o dashboard
      // operacional) - o resumo de usuários agora mora no Contexto
      // Operacional daquela aba. optional chaining aqui só por segurança,
      // caso alguma tela antiga ainda tenha esses ids.
      const elCadastros = document.getElementById('gestao-total-cadastros');
      const elAdmins = document.getElementById('gestao-total-admins');
      const elTecnicos = document.getElementById('gestao-total-tecnicos');
      if (elCadastros) elCadastros.textContent = dados.kpis.total;
      if (elAdmins) elAdmins.textContent = dados.kpis.administradores;
      if (elTecnicos) elTecnicos.textContent = dados.kpis.tecnicos_operadores;

      if (!dados.usuarios.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:0.75rem;">Nenhum usuário cadastrado.</td></tr>';
        return;
      }

      tbody.innerHTML = dados.usuarios.map(u => {
        const ehVoce = String(u.id) === usuarioLogadoId;
        const avatarSrc = u.foto_url || '../IMG/user-icon.png';
        return `
          <tr data-usuario-id="${u.id}">
            <td>
              <div class="gestao-usuario-cell">
                <img class="gestao-avatar" src="${avatarSrc}" alt="${u.usuario}" onerror="this.src='../IMG/user-icon.png'">
                <div>
                  <div class="gestao-usuario-nome">${u.usuario}${ehVoce ? '<span class="gestao-tag gestao-tag-voce">Você</span>' : ''}</div>
                  <div class="gestao-usuario-id">ID #${u.id}</div>
                </div>
              </div>
            </td>
            <td>
              <span class="gestao-cargo-badge">${u.credencial_acesso || 'Sem cargo definido'}</span>
              <div class="gestao-perfil-linha">
                ${u.perfil_nome || 'Sem perfil vinculado'}
                ${u.usa_permissoes_customizadas ? '<span class="gestao-tag gestao-tag-customizado">Customizado</span>' : ''}
              </div>
            </td>
            <td>${u.email || '-'}</td>
            <td>
              <div class="gestao-acoes-cell">
                <button type="button" class="gestao-btn-icone gestao-editar-usuario" title="Editar"><svg class="icone-acao" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg></button>
                <button type="button" class="gestao-btn-icone gestao-excluir-usuario" title="${u.pode_excluir ? 'Excluir' : 'Não é possível excluir este usuário'}" ${u.pode_excluir ? '' : 'disabled'}><svg class="icone-acao" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg></button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.gestao-editar-usuario').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.target.closest('tr').dataset.usuarioId;
          abrirModalUsuario(dados.usuarios.find(u => String(u.id) === id));
        });
      });
      tbody.querySelectorAll('.gestao-excluir-usuario').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.target.closest('tr').dataset.usuarioId;
          excluirUsuario(id);
        });
      });
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      tbody.innerHTML = '<tr><td colspan="4" style="padding:0.75rem;">Erro de conexão ao carregar usuários.</td></tr>';
    }
  }

  async function excluirUsuario(id) {
    if (!confirm('Excluir este usuário? Essa ação não pode ser desfeita.')) return;
    try {
      const resp = await fetch(window.apiUrl(`/usuarios/${id}`), { method: 'DELETE', headers: authHeaders() });
      const dados = await resp.json();
      if (dados.status !== 'ok') {
        alert(`Não foi possível excluir: ${dados.mensagem || resp.statusText}`);
        return;
      }
      carregarUsuarios();
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      alert('Erro de conexão ao excluir o usuário.');
    }
  }

  function popularSelectPerfis() {
    const select = document.getElementById('usuario-perfil');
    if (!select) return;
    const atual = select.value;
    select.innerHTML = '<option value="">Nenhum (sem acesso extra)</option>' +
      perfisCache.map(p => `<option value="${p.id}">${p.nome}${p.fabrica ? ' (fábrica)' : ''}</option>`).join('');
    if (atual) select.value = atual;
  }

  // O checklist de contratos (popular/coletar) é um componente compartilhado
  // em geral.js - window.popularChecklistContratos / coletarContratosSelecionados -
  // usado aqui e também em Frota/Bases pra vincular recursos a contratos.
  function popularChecklistContratosUsuario(contratosSelecionadosNomes = []) {
    return window.popularChecklistContratos(document.getElementById('usuario-contratos-lista'), contratosSelecionadosNomes);
  }

  function coletarContratosSelecionadosUsuario() {
    return window.coletarContratosSelecionados(document.getElementById('usuario-contratos-lista'));
  }

  function abrirModalUsuario(usuario) {
    usuarioEditandoId = usuario ? usuario.id : null;
    document.getElementById('titulo-modal-usuario').textContent = usuario ? `Editar usuário [${usuario.usuario}]` : 'Novo usuário';
    document.getElementById('usuario-id').value = usuario ? usuario.id : '';
    document.getElementById('usuario-login').value = usuario ? usuario.usuario : '';
    document.getElementById('usuario-login').disabled = !!usuario;
    document.getElementById('usuario-nome').value = usuario ? (usuario.nome || '') : '';
    document.getElementById('usuario-email').value = usuario ? (usuario.email || '') : '';
    document.getElementById('usuario-cargo').value = usuario ? (usuario.credencial_acesso || '') : '';
    document.getElementById('usuario-foto').value = usuario ? (usuario.foto_url || '') : '';
    document.getElementById('usuario-perfil').value = usuario ? (usuario.perfil_id || '') : '';
    document.getElementById('usuario-usa-customizadas').checked = usuario ? !!usuario.usa_permissoes_customizadas : false;
    popularChecklistContratosUsuario(usuario ? (usuario.contratos_autorizados || []) : []);

    document.getElementById('campo-senha-criacao').style.display = usuario ? 'none' : '';
    document.getElementById('usuario-senha').required = !usuario;
    document.getElementById('campo-redefinir-senha').style.display = usuario ? '' : 'none';
    document.getElementById('usuario-redefinir-senha-toggle').checked = false;
    document.getElementById('usuario-nova-senha').style.display = 'none';
    document.getElementById('usuario-nova-senha').value = '';
    document.getElementById('usuario-senha').value = '';

    renderMatrizPermissoes('matriz-permissoes-usuario', usuario ? usuario.permissoes : {});
    document.getElementById('bloco-permissoes-usuario').style.display = document.getElementById('usuario-usa-customizadas').checked ? '' : 'none';

    const feedback = document.getElementById('usuario-form-feedback');
    feedback.style.display = 'none';
    feedback.textContent = '';

    // Capacitações só existem para usuário já salvo.
    document.getElementById('bloco-capacitacoes').style.display = usuario ? '' : 'none';
    ['cap-nome', 'cap-certificado', 'cap-emissao', 'cap-validade'].forEach((id) => { document.getElementById(id).value = ''; });
    if (usuario) carregarCapacitacoes(usuario.id);

    document.getElementById('modal-usuario').style.display = 'flex';
  }

  // ===== Capacitações do usuário (NR-10, NR-35...) =====
  function renderCapacitacoes(dados) {
    const lista = document.getElementById('usuario-capacitacoes-lista');
    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
    lista.innerHTML = pend + (itens || '<p class="gestao-ajuda-texto">Nenhuma capacitação cadastrada.</p>');
  }

  async function carregarCapacitacoes(id) {
    const lista = document.getElementById('usuario-capacitacoes-lista');
    lista.innerHTML = '<p class="gestao-ajuda-texto">Carregando...</p>';
    try {
      const resp = await fetch(window.apiUrl(`/usuarios/${id}/capacitacoes`), { headers: authHeaders() });
      const dados = await resp.json();
      if (dados.status !== 'ok') throw new Error(dados.mensagem);
      renderCapacitacoes(dados);
    } catch (e) {
      lista.innerHTML = `<p class="gestao-ajuda-texto">${e.message || 'Não foi possível carregar.'}</p>`;
    }
  }

  document.addEventListener('click', async (e) => {
    if (e.target.closest('#cap-adicionar')) {
      if (!usuarioEditandoId) return;
      const corpo = {
        nome: document.getElementById('cap-nome').value,
        certificado: document.getElementById('cap-certificado').value,
        emissao: document.getElementById('cap-emissao').value,
        validade: document.getElementById('cap-validade').value,
      };
      const resp = await fetch(window.apiUrl(`/usuarios/${usuarioEditandoId}/capacitacoes`), {
        method: 'POST', headers: authHeaders(true), body: JSON.stringify(corpo),
      });
      const dados = await resp.json().catch(() => ({}));
      if (dados.status !== 'ok') { alert(dados.mensagem || 'Não foi possível adicionar.'); return; }
      ['cap-nome', 'cap-certificado', 'cap-emissao', 'cap-validade'].forEach((id) => { document.getElementById(id).value = ''; });
      renderCapacitacoes(dados);
      return;
    }
    const ver = e.target.closest('[data-cap-ver]');
    if (ver && usuarioEditandoId) {
      const resp = await fetch(window.apiUrl(`/usuarios/${usuarioEditandoId}/capacitacoes/${ver.dataset.capVer}/arquivo`), { headers: authHeaders() });
      if (!resp.ok) { alert('Não foi possível abrir o PDF.'); return; }
      window.open(URL.createObjectURL(await resp.blob()), '_blank');
      return;
    }
    const excluir = e.target.closest('[data-cap-excluir]');
    if (excluir && usuarioEditandoId) {
      if (!confirm('Remover esta capacitação?')) return;
      await fetch(window.apiUrl(`/usuarios/${usuarioEditandoId}/capacitacoes/${excluir.dataset.capExcluir}`), {
        method: 'DELETE', headers: authHeaders(),
      });
      carregarCapacitacoes(usuarioEditandoId);
    }
  });

  function fecharModalUsuario() {
    document.getElementById('modal-usuario').style.display = 'none';
    usuarioEditandoId = null;
  }

  async function salvarUsuario(event) {
    event.preventDefault();
    const feedback = document.getElementById('usuario-form-feedback');
    feedback.style.display = 'none';

    const usaCustomizadas = document.getElementById('usuario-usa-customizadas').checked;
    const payload = {
      nome: document.getElementById('usuario-nome').value,
      email: document.getElementById('usuario-email').value,
      foto_url: document.getElementById('usuario-foto').value,
      credencial_acesso: document.getElementById('usuario-cargo').value,
      perfil_id: document.getElementById('usuario-perfil').value || null,
      usa_permissoes_customizadas: usaCustomizadas,
      contratos_autorizados: coletarContratosSelecionadosUsuario(),
    };

    if (usaCustomizadas) {
      payload.permissoes = coletarMatrizPermissoes('matriz-permissoes-usuario');
    }

    let url, method;
    if (usuarioEditandoId) {
      url = `/usuarios/${usuarioEditandoId}`;
      method = 'PUT';
      if (document.getElementById('usuario-redefinir-senha-toggle').checked) {
        payload.nova_senha = document.getElementById('usuario-nova-senha').value;
      }
    } else {
      url = '/usuarios';
      method = 'POST';
      payload.usuario = document.getElementById('usuario-login').value;
      payload.senha = document.getElementById('usuario-senha').value;
    }

    try {
      const resp = await fetch(window.apiUrl(url), {
        method,
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });
      const dados = await resp.json();
      if (dados.status !== 'ok') {
        feedback.className = 'gestao-feedback erro';
        feedback.textContent = dados.mensagem || 'Erro ao salvar usuário.';
        feedback.style.display = 'block';
        return;
      }
      fecharModalUsuario();
      carregarUsuarios();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      feedback.className = 'gestao-feedback erro';
      feedback.textContent = 'Erro de conexão ao salvar o usuário.';
      feedback.style.display = 'block';
    }
  }

  // ===== Aba Perfis de Acesso =====
  async function carregarPerfis() {
    const grid = document.getElementById('grid-perfis');
    if (!grid) return;
    grid.innerHTML = '<div class="carregando-inline" role="status"><span class="carregando-inline-logo"></span><span class="carregando-inline-texto">Carregando...</span></div>';
    try {
      const resp = await fetch(window.apiUrl('/perfis'), { headers: authHeaders() });
      const dados = await resp.json();
      if (dados.status !== 'ok') {
        grid.innerHTML = `<p style="padding:0.75rem;">${dados.mensagem || 'Erro ao carregar perfis.'}</p>`;
        return;
      }
      perfisCache = dados.perfis;
      try { await carregarCatalogoPermissoes(); } catch (e) { /* resumo fica vazio */ }
      popularSelectPerfis();

      if (!perfisCache.length) {
        grid.innerHTML = '<p style="padding:0.75rem;">Nenhum perfil cadastrado.</p>';
        return;
      }

      grid.innerHTML = perfisCache.map(p => {
        return `
          <div class="gestao-perfil-card" data-perfil-id="${p.id}">
            <div class="gestao-perfil-card-header">
              <h3>${p.nome}</h3>
              ${p.fabrica ? '<span class="gestao-tag gestao-tag-fabrica">Fábrica</span>' : ''}
            </div>
            <div class="gestao-perfil-usuarios">${p.total_usuarios} usuário(s) vinculado(s)</div>
            <div class="gestao-perfil-modulos">
              ${resumoPermissoesPerfil(p.permissoes || {})}
            </div>
            <div class="gestao-perfil-card-acoes">
              <button type="button" class="gestao-btn-icone gestao-editar-perfil" title="Editar"><svg class="icone-acao" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg></button>
              <button type="button" class="gestao-btn-icone gestao-excluir-perfil" title="${p.fabrica ? 'Perfis de fábrica não podem ser excluídos' : 'Excluir'}" ${p.fabrica ? 'disabled' : ''}><svg class="icone-acao" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg></button>
            </div>
          </div>
        `;
      }).join('');

      grid.querySelectorAll('.gestao-editar-perfil').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.target.closest('[data-perfil-id]').dataset.perfilId;
          abrirModalPerfil(perfisCache.find(p => String(p.id) === id));
        });
      });
      grid.querySelectorAll('.gestao-excluir-perfil').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.target.closest('[data-perfil-id]').dataset.perfilId;
          excluirPerfil(id);
        });
      });
    } catch (error) {
      console.error('Erro ao carregar perfis:', error);
      grid.innerHTML = '<p style="padding:0.75rem;">Erro de conexão ao carregar perfis.</p>';
    }
  }

  async function excluirPerfil(id) {
    if (!confirm('Excluir este perfil de acesso?')) return;
    try {
      const resp = await fetch(window.apiUrl(`/perfis/${id}`), { method: 'DELETE', headers: authHeaders() });
      const dados = await resp.json();
      if (dados.status !== 'ok') {
        alert(`Não foi possível excluir: ${dados.mensagem || resp.statusText}`);
        return;
      }
      carregarPerfis();
    } catch (error) {
      console.error('Erro ao excluir perfil:', error);
      alert('Erro de conexão ao excluir o perfil.');
    }
  }

  function abrirModalPerfil(perfil) {
    perfilEditandoId = perfil ? perfil.id : null;
    document.getElementById('titulo-modal-perfil').textContent = perfil ? `Editar perfil [${perfil.nome}]` : 'Novo perfil de acesso';
    document.getElementById('perfil-id').value = perfil ? perfil.id : '';
    document.getElementById('perfil-nome').value = perfil ? perfil.nome : '';
    document.getElementById('perfil-contratos-autorizados').value = perfil ? stringDeLista(perfil.contratos_autorizados) : '';
    document.getElementById('perfil-contratos-leitura').value = perfil ? stringDeLista(perfil.contratos_somente_leitura) : '';

    renderMatrizPermissoes('matriz-permissoes-perfil', perfil ? perfil.permissoes : {});

    const feedback = document.getElementById('perfil-form-feedback');
    feedback.style.display = 'none';
    feedback.textContent = '';

    document.getElementById('modal-perfil').style.display = 'flex';
  }

  function fecharModalPerfil() {
    document.getElementById('modal-perfil').style.display = 'none';
    perfilEditandoId = null;
  }

  async function salvarPerfil(event) {
    event.preventDefault();
    const feedback = document.getElementById('perfil-form-feedback');
    feedback.style.display = 'none';

    const payload = {
      nome: document.getElementById('perfil-nome').value,
      permissoes: coletarMatrizPermissoes('matriz-permissoes-perfil'),
      contratos_autorizados: listaDeString(document.getElementById('perfil-contratos-autorizados').value),
      contratos_somente_leitura: listaDeString(document.getElementById('perfil-contratos-leitura').value),
    };

    const url = perfilEditandoId ? `/perfis/${perfilEditandoId}` : '/perfis';
    const method = perfilEditandoId ? 'PUT' : 'POST';

    try {
      const resp = await fetch(window.apiUrl(url), {
        method,
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });
      const dados = await resp.json();
      if (dados.status !== 'ok') {
        feedback.className = 'gestao-feedback erro';
        feedback.textContent = dados.mensagem || 'Erro ao salvar perfil.';
        feedback.style.display = 'block';
        return;
      }
      fecharModalPerfil();
      carregarPerfis();
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      feedback.className = 'gestao-feedback erro';
      feedback.textContent = 'Erro de conexão ao salvar o perfil.';
      feedback.style.display = 'block';
    }
  }

  // ===== Aba Contratos =====
  function escapeHtml(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderizarArquivosContrato(arquivos) {
    const lista = document.getElementById('contrato-arquivos-lista');
    if (!lista) return;
    arquivos = arquivos || [];
    if (!arquivos.length) {
      lista.innerHTML = '<p style="color:#999;font-size:13px;">Nenhum arquivo anexado.</p>';
      return;
    }
    lista.innerHTML = `
      <table>
        <thead><tr><th>Arquivo</th><th>Enviado em</th><th></th></tr></thead>
        <tbody>
          ${arquivos.map(a => `
            <tr>
              <td><a href="${a.arquivo_base64}" download="${escapeHtml(a.nome_arquivo || 'arquivo')}">${escapeHtml(a.nome_arquivo || 'arquivo')}</a></td>
              <td>${a.criado_em || ''}</td>
              <td><button type="button" class="gestao-btn-icone" data-remove-contrato-arquivo="${a.id}" title="Remover"><svg class="icone-acao" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg></button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  function lerArquivoComoBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function enviarArquivosPendentesContrato(contratoId) {
    const input = document.getElementById('contrato-arquivo-input');
    const arquivos = input?.files ? Array.from(input.files) : [];
    for (const arquivo of arquivos) {
      const base64 = await lerArquivoComoBase64(arquivo);
      await fetch(window.apiUrl(`/contratos/${contratoId}/arquivos`), {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ nome_arquivo: arquivo.name, mime_type: arquivo.type, arquivo_base64: base64 }),
      });
    }
    if (input) input.value = '';
  }

  async function excluirArquivoContrato(arquivoId) {
    if (!confirm('Remover este arquivo do contrato?')) return;
    await fetch(window.apiUrl(`/contratos/arquivos/${arquivoId}`), { method: 'DELETE', headers: authHeaders() });
    if (contratoEditandoId) await carregarContratoParaEdicao(contratoEditandoId);
  }

  function limparFormularioContrato() {
    document.getElementById('form-contratos')?.reset();
    contratoEditandoId = null;
    document.dispatchEvent(new CustomEvent('orbita:contrato-selecionado', { detail: { id: null } }));
    document.getElementById('btn-salvar-contrato').textContent = 'Salvar Contrato';
    renderizarArquivosContrato([]);
    const feedback = document.getElementById('contrato-form-feedback');
    feedback.style.display = 'none';
    feedback.textContent = '';
  }

  async function carregarContratos() {
    const tbody = document.querySelector('#tabela-contratos tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5"><div class="carregando-inline" role="status"><span class="carregando-inline-logo"></span><span class="carregando-inline-texto">Carregando...</span></div></td></tr>';
    try {
      const resp = await fetch(window.apiUrl('/contratos'), { headers: authHeaders() });
      const dados = await resp.json();
      if (dados.status !== 'ok') {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:0.75rem;">${dados.mensagem || 'Erro ao carregar contratos.'}</td></tr>`;
        return;
      }
      if (!dados.contratos.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding:0.75rem;">Nenhum contrato cadastrado.</td></tr>';
        return;
      }
      tbody.innerHTML = dados.contratos.map(c => `
        <tr data-contrato-id="${c.id}">
          <td>${escapeHtml(c.nome)}</td>
          <td>${escapeHtml(c.cnpj || '-')}</td>
          <td>${(c.usuarios || []).map(u => escapeHtml(u.usuario)).join(', ') || '-'}</td>
          <td>${(c.arquivos || []).length}</td>
          <td>
            <div class="gestao-acoes-cell">
              <button type="button" class="gestao-btn-icone gestao-editar-contrato" title="Editar"><svg class="icone-acao" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg></button>
              <button type="button" class="gestao-btn-icone gestao-excluir-contrato" title="Excluir"><svg class="icone-acao" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg></button>
            </div>
          </td>
        </tr>
      `).join('');
      tbody.querySelectorAll('.gestao-editar-contrato').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = Number(e.target.closest('tr').dataset.contratoId);
          carregarContratoParaEdicao(id);
        });
      });
      tbody.querySelectorAll('.gestao-excluir-contrato').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = Number(e.target.closest('tr').dataset.contratoId);
          excluirContrato(id);
        });
      });
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
      tbody.innerHTML = '<tr><td colspan="5" style="padding:0.75rem;">Erro de conexão ao carregar contratos.</td></tr>';
    }
  }

  async function carregarContratoParaEdicao(id) {
    try {
      const resp = await fetch(window.apiUrl(`/contratos/${id}`), { headers: authHeaders() });
      const dados = await resp.json();
      if (dados.status !== 'ok') return;
      const c = dados.contrato;
      contratoEditandoId = c.id;
      document.dispatchEvent(new CustomEvent('orbita:contrato-selecionado', { detail: { id: c.id } }));
      document.getElementById('contrato-nome').value = c.nome || '';
      document.getElementById('contrato-cnpj').value = c.cnpj || '';
      document.getElementById('contrato-especificacoes').value = c.especificacoes || '';
      document.getElementById('btn-salvar-contrato').textContent = 'Atualizar Contrato';
      renderizarArquivosContrato(c.arquivos || []);
    } catch (error) {
      console.error('Erro ao carregar contrato:', error);
    }
  }

  async function excluirContrato(id) {
    if (!confirm('Excluir este contrato? Os usuários vinculados a ele perderão o acesso.')) return;
    try {
      const resp = await fetch(window.apiUrl(`/contratos/${id}`), { method: 'DELETE', headers: authHeaders() });
      const dados = await resp.json();
      if (dados.status !== 'ok') {
        alert(dados.mensagem || 'Erro ao excluir contrato.');
        return;
      }
      if (contratoEditandoId === id) limparFormularioContrato();
      carregarContratos();
    } catch (error) {
      console.error('Erro ao excluir contrato:', error);
      alert('Erro de conexão ao excluir o contrato.');
    }
  }

  async function salvarContrato(event) {
    event.preventDefault();
    const feedback = document.getElementById('contrato-form-feedback');
    feedback.style.display = 'none';

    const nome = document.getElementById('contrato-nome').value.trim();
    if (!nome) return;

    const payload = {
      nome,
      cnpj: document.getElementById('contrato-cnpj').value.trim(),
      especificacoes: document.getElementById('contrato-especificacoes').value.trim(),
    };

    const btn = document.getElementById('btn-salvar-contrato');
    if (btn) btn.disabled = true;
    try {
      const url = contratoEditandoId ? `/contratos/${contratoEditandoId}` : '/contratos';
      const method = contratoEditandoId ? 'PUT' : 'POST';
      const resp = await fetch(window.apiUrl(url), {
        method,
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });
      const dados = await resp.json();
      if (dados.status !== 'ok') {
        feedback.className = 'gestao-feedback erro';
        feedback.textContent = dados.mensagem || 'Erro ao salvar contrato.';
        feedback.style.display = 'block';
        return;
      }
      const contratoId = dados.contrato?.id || contratoEditandoId;
      await enviarArquivosPendentesContrato(contratoId);
      limparFormularioContrato();
      carregarContratos();
    } catch (error) {
      console.error('Erro ao salvar contrato:', error);
      feedback.className = 'gestao-feedback erro';
      feedback.textContent = 'Erro de conexão ao salvar o contrato.';
      feedback.style.display = 'block';
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ===== Abas (Usuários / Perfis) =====
  function inicializarAbas() {
    const legendaPrincipal = document.getElementById('legenda-principal');
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // A aba padrao ja vem marcada 'active' no HTML (painel-geral); o codigo so
    // reforca aqui caso a marcacao no HTML mude no futuro.
    const padraoTab = document.querySelector('.tab-btn.active[data-tab]') || document.querySelector('.tab-btn[data-tab="painel-geral"]');
    const padraoContent = padraoTab && document.getElementById(padraoTab.dataset.tab);
    if (padraoTab && padraoContent) {
      padraoTab.classList.add('active');
      padraoContent.classList.add('active');
    }

    const LEGENDAS = {
      'painel-geral': 'Painel Geral', usuarios: 'Usuários', contratos: 'Contratos',
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', function () {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        this.classList.add('active');
        const tabId = this.getAttribute('data-tab');
        const contentToShow = document.getElementById(tabId);
        if (contentToShow) contentToShow.classList.add('active');
        if (legendaPrincipal) {
          legendaPrincipal.textContent = LEGENDAS[tabId] || 'Painel Geral';
        }

        if (tabId === 'usuarios') carregarUsuarios();
        if (tabId === 'contratos') carregarContratos();
      });
    });
  }

  // Perfis de Acesso agora vive dentro da aba Usuários, como sub-secao -
  // mesmo padrao das sub-abas de Cadastros (loc-subabas).
  function inicializarSubabaUsuarios() {
    const subabas = document.getElementById('usuarios-subabas');
    if (!subabas) return;
    subabas.addEventListener('click', (evento) => {
      const botao = evento.target.closest('[data-usu]');
      if (!botao) return;
      subabas.querySelectorAll('.top-tab2').forEach((b) => b.classList.remove('ativo'));
      botao.classList.add('ativo');
      const alvo = botao.dataset.usu;
      document.querySelectorAll('.usuarios-subaba').forEach((painel) => {
        const ativo = painel.id === alvo || (alvo === 'usuarios' && painel.id === 'usuarios-lista');
        painel.classList.toggle('ativa', ativo);
        painel.hidden = !ativo;
      });
      if (alvo === 'perfis') carregarPerfis();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    usuarioLogadoId = pegarIdUsuarioLogado();
    inicializarAbas();
    inicializarSubabaUsuarios();
    carregarUsuarios();
    carregarPerfis();
    renderizarArquivosContrato([]);

    document.getElementById('btn-novo-usuario')?.addEventListener('click', () => abrirModalUsuario(null));
    document.getElementById('fechar-modal-usuario')?.addEventListener('click', fecharModalUsuario);
    document.getElementById('cancelar-modal-usuario')?.addEventListener('click', fecharModalUsuario);
    document.getElementById('form-usuario')?.addEventListener('submit', salvarUsuario);
    document.getElementById('usuario-usa-customizadas')?.addEventListener('change', (e) => {
      document.getElementById('bloco-permissoes-usuario').style.display = e.target.checked ? '' : 'none';
    });
    document.getElementById('usuario-redefinir-senha-toggle')?.addEventListener('change', (e) => {
      document.getElementById('usuario-nova-senha').style.display = e.target.checked ? '' : 'none';
    });

    document.getElementById('btn-novo-perfil')?.addEventListener('click', () => abrirModalPerfil(null));
    document.getElementById('fechar-modal-perfil')?.addEventListener('click', fecharModalPerfil);
    document.getElementById('cancelar-modal-perfil')?.addEventListener('click', fecharModalPerfil);
    document.getElementById('form-perfil')?.addEventListener('submit', salvarPerfil);

    document.getElementById('modal-usuario')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-usuario') fecharModalUsuario();
    });
    document.getElementById('modal-perfil')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-perfil') fecharModalPerfil();
    });

    document.getElementById('form-contratos')?.addEventListener('submit', salvarContrato);
    document.getElementById('btn-limpar-contrato')?.addEventListener('click', limparFormularioContrato);
    document.getElementById('contrato-arquivos-lista')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-contrato-arquivo]');
      if (btn) excluirArquivoContrato(Number(btn.dataset.removeContratoArquivo));
    });
  });

  // Anexar o PDF do certificado de uma capacitação.
  document.addEventListener('change', async (e) => {
    const campo = e.target.closest('[data-cap-arquivo]');
    if (!campo || !campo.files.length || !usuarioEditandoId) return;
    const formulario = new FormData();
    formulario.append('arquivo', campo.files[0]);
    const resp = await fetch(window.apiUrl(`/usuarios/${usuarioEditandoId}/capacitacoes/${campo.dataset.capArquivo}/arquivo`), {
      method: 'POST', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }, body: formulario,
    });
    const dados = await resp.json().catch(() => ({}));
    if (dados.status !== 'ok') alert(dados.mensagem || 'Não foi possível anexar.');
    carregarCapacitacoes(usuarioEditandoId);
  });
})();
