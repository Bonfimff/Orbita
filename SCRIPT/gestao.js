(function () {
  let perfisCache = [];
  let usuarioLogadoId = null;
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

  // Matriz de permissões: componente compartilhado (SCRIPT/permissoes-matriz.js).
  const {
    carregar: carregarCatalogoPermissoes, render: renderMatrizPermissoes,
    coletar: coletarMatrizPermissoes, resumo: resumoPermissoesPerfil,
  } = window.MatrizPermissoes;

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
          window.location.href = 'cadastros.html#usuario-' + id;
        });
      });
      // Um clique (ou toque) na linha abre a edição, como nas outras tabelas.
      tbody.querySelectorAll('tr[data-usuario-id]').forEach(linha => {
        linha.classList.add('linha-clicavel');
        linha.addEventListener('click', (e) => {
          if (e.target.closest('button, a, input')) return;
          window.location.href = 'cadastros.html#usuario-' + linha.dataset.usuarioId;
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

  // Arquivos do contrato: explorador com pastas livres (SCRIPT/operacional/explorador.js),
  // o mesmo dos equipamentos. Só existe para contrato já salvo.
  async function renderizarArquivosContrato() {
    const alvo = document.getElementById('contrato-arquivos-lista');
    if (!alvo) return;
    if (!contratoEditandoId || !window.Explorador) {
      alvo.className = '';
      alvo.innerHTML = '<p class="gestao-dica-arquivos">Salve o contrato para organizar os arquivos em pastas.</p>';
      return;
    }
    const id = contratoEditandoId;
    alvo.innerHTML = '<p class="gestao-dica-arquivos">Carregando arquivos...</p>';
    try {
      const resp = await fetch(window.apiUrl(`/explorador/contratos/${id}/arquivos`), { headers: authHeaders() });
      const dados = await resp.json();
      if (dados.status !== 'ok') throw new Error(dados.mensagem || 'Não foi possível carregar os arquivos.');
      if (id !== contratoEditandoId) return;
      const nome = document.getElementById('contrato-nome').value || 'Contrato';
      window.Explorador.montar(alvo, {
        base: '/explorador/contratos/' + id,
        podeAlterar: typeof window.temPermissao !== 'function' || window.temPermissao('gestao_contratos', 'editar'),
        dados: dados.dados,
        raizNome: nome,
      });
    } catch (erro) {
      alvo.innerHTML = '<p class="gestao-dica-arquivos">' + escapeHtml(erro.message) + '</p>';
    }
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
    renderizarArquivosContrato();
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
      renderizarArquivosContrato();
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
      'painel-geral': 'Painel Geral', usuarios: 'Usuários', contratos: 'Contratos', funcionarios: 'Funcionários', jornadas: 'Controle de Ponto',
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
    renderizarArquivosContrato();


    // Cadastro de usuário fica em Gestão › Cadastros (lista aqui, formulário lá).
    document.getElementById('btn-novo-usuario')?.addEventListener('click', () => { window.location.href = 'cadastros.html#usuario'; });

    document.getElementById('btn-novo-perfil')?.addEventListener('click', () => abrirModalPerfil(null));
    document.getElementById('fechar-modal-perfil')?.addEventListener('click', fecharModalPerfil);
    document.getElementById('cancelar-modal-perfil')?.addEventListener('click', fecharModalPerfil);
    document.getElementById('form-perfil')?.addEventListener('submit', salvarPerfil);

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
})();
