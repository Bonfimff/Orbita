(function () {
  let perfisCache = [];
  let usuarioLogadoId = null;
  let perfilEditandoId = null;

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
          <tr data-usuario-id="${u.id}" class="linha-clicavel" tabindex="0">
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
                    </tr>
        `;
      }).join('');

      // Padrão das tabelas: clique abre a ficha; Editar e Excluir ficam nela.
      usuariosCache = dados.usuarios;
      window.FichaRegistro.ligarTabela(tbody, 'tr[data-usuario-id]', (linha) => abrirFichaUsuario(linha.dataset.usuarioId));
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      tbody.innerHTML = '<tr><td colspan="4" style="padding:0.75rem;">Erro de conexão ao carregar usuários.</td></tr>';
    }
  }

  let usuariosCache = [];
  function abrirFichaUsuario(id) {
    const u = usuariosCache.find((x) => String(x.id) === String(id));
    if (!u) return;
    const F = window.FichaRegistro;
    F.abrir({
      titulo: u.usuario,
      subtitulo: 'Usuário #' + u.id + (String(u.id) === usuarioLogadoId ? ' · você' : ''),
      campos: [
        ['Cargo', u.credencial_acesso || 'Sem cargo definido'],
        ['Perfil de acesso', (u.perfil_nome || 'Sem perfil vinculado') + (u.usa_permissoes_customizadas ? ' (customizado)' : '')],
        ['E-mail', u.email || '-'],
      ],
      editar: () => { window.location.href = 'cadastros.html#usuario-' + u.id; },
      podeEditar: F.pode('gestao_usuarios', 'editar'),
      excluir: () => F.apagar('/usuarios/' + u.id),
      podeExcluir: F.pode('gestao_usuarios', 'excluir'),
      semExcluir: u.pode_excluir ? '' : 'Não é possível excluir este usuário',
      confirmar: 'Excluir este usuário? Essa ação não pode ser desfeita.',
      aoExcluir: carregarUsuarios,
    });
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
          <div class="gestao-perfil-card linha-clicavel" data-perfil-id="${p.id}" tabindex="0">
            <div class="gestao-perfil-card-header">
              <h3>${p.nome}</h3>
              ${p.fabrica ? '<span class="gestao-tag gestao-tag-fabrica">Fábrica</span>' : ''}
            </div>
            <div class="gestao-perfil-usuarios">${p.total_usuarios} usuário(s) vinculado(s)</div>
            <div class="gestao-perfil-modulos">
              ${resumoPermissoesPerfil(p.permissoes || {})}
            </div>
          </div>
        `;
      }).join('');

      window.FichaRegistro.ligarTabela(grid, '[data-perfil-id]', (card) => {
        const p = perfisCache.find((x) => String(x.id) === card.dataset.perfilId);
        const F = window.FichaRegistro;
        F.abrir({
          titulo: p.nome,
          subtitulo: p.fabrica ? 'Perfil de fábrica' : 'Perfil de acesso',
          campos: [['Usuários vinculados', String(p.total_usuarios)]],
          corpo: '<div class="gestao-perfil-modulos">' + resumoPermissoesPerfil(p.permissoes || {}) + '</div>',
          editar: () => abrirModalPerfil(p),
          podeEditar: F.pode('gestao_perfis', 'editar'),
          excluir: () => F.apagar('/perfis/' + p.id),
          podeExcluir: F.pode('gestao_perfis', 'excluir'),
          semExcluir: p.fabrica ? 'Perfis de fábrica não podem ser excluídos' : '',
          confirmar: 'Excluir este perfil de acesso?',
          aoExcluir: carregarPerfis,
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

  // Aqui fica só a lista e a ficha de consulta (dados + arquivos). O cadastro
  // e a edição ficam em Gestão › Cadastros › Contratos (SCRIPT/cadastros/contrato.js).
  const irParaCadastroContrato = (id) => { window.location.href = 'cadastros.html#contrato' + (id ? '-' + id : ''); };

  async function carregarContratos() {
    const tbody = document.querySelector('#tabela-contratos tbody');
    if (!tbody) return;
    try {
      const resp = await fetch(window.apiUrl('/contratos'), { headers: authHeaders() });
      const dados = await resp.json();
      if (dados.status !== 'ok') {
        tbody.innerHTML = `<tr><td colspan="4" style="padding:0.75rem;">${escapeHtml(dados.mensagem || 'Erro ao carregar contratos.')}</td></tr>`;
        return;
      }
      if (!dados.contratos.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:0.75rem;">Nenhum contrato cadastrado.</td></tr>';
        return;
      }
      tbody.innerHTML = dados.contratos.map(c => `
        <tr data-contrato-id="${c.id}" class="linha-clicavel" tabindex="0" title="Ver contrato">
          <td>${escapeHtml(c.nome)}</td>
          <td>${escapeHtml(c.cnpj || '-')}</td>
          <td>${(c.usuarios || []).map(u => escapeHtml(u.usuario)).join(', ') || '-'}</td>
                </tr>
      `).join('');
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
      tbody.innerHTML = '<tr><td colspan="4" style="padding:0.75rem;">Erro de conexão ao carregar contratos.</td></tr>';
    }
  }

  // Ficha de consulta: dados e arquivos, sem precisar entrar na edição.
  let contratoFichaId = null;
  async function abrirFichaContrato(id) {
    const fundo = document.getElementById('contrato-ficha');
    contratoFichaId = id;
    document.getElementById('contrato-ficha-titulo').textContent = 'Carregando...';
    document.getElementById('contrato-ficha-sub').textContent = '';
    document.getElementById('contrato-ficha-info').innerHTML = '';
    document.getElementById('contrato-ficha-arquivos').innerHTML = '';
    fundo.hidden = false;
    if (window.travarRolagemFundo) window.travarRolagemFundo(true);
    document.dispatchEvent(new CustomEvent('orbita:contrato-selecionado', { detail: { id } }));
    try {
      const [rc, ra] = await Promise.all([
        fetch(window.apiUrl(`/contratos/${id}`), { headers: authHeaders() }).then(r => r.json()),
        fetch(window.apiUrl(`/explorador/contratos/${id}/arquivos`), { headers: authHeaders() }).then(r => r.json()).catch(() => ({})),
      ]);
      if (id !== contratoFichaId) return;
      if (rc.status !== 'ok') throw new Error(rc.mensagem || 'Contrato não encontrado.');
      const c = rc.contrato;
      document.getElementById('contrato-ficha-titulo').textContent = c.nome;
      document.getElementById('contrato-ficha-sub').textContent = c.cnpj ? 'CNPJ ' + c.cnpj : '';
      const item = (r, v) => (v ? `<div><dt>${r}</dt><dd>${v}</dd></div>` : '');
      document.getElementById('contrato-ficha-info').innerHTML =
        item('Usuários com acesso', escapeHtml((c.usuarios || []).map(u => u.usuario).join(', '))) +
        item('Especificações', escapeHtml(c.especificacoes || '').replace(/\n/g, '<br>'));
      const alvo = document.getElementById('contrato-ficha-arquivos');
      if (ra.status === 'ok' && window.Explorador) {
        window.Explorador.montar(alvo, {
          base: '/explorador/contratos/' + id,
          podeAlterar: typeof window.temPermissao !== 'function' || window.temPermissao('gestao_contratos', 'editar'),
          dados: ra.dados,
          raizNome: c.nome,
        });
      } else {
        alvo.innerHTML = `<p class="gestao-dica-arquivos">${escapeHtml(ra.mensagem || 'Sem acesso aos arquivos.')}</p>`;
      }
    } catch (erro) {
      document.getElementById('contrato-ficha-titulo').textContent = 'Contrato';
      document.getElementById('contrato-ficha-info').innerHTML = `<div><dd>${escapeHtml(erro.message)}</dd></div>`;
    }
  }

  function fecharFichaContrato() {
    const fundo = document.getElementById('contrato-ficha');
    if (!fundo || fundo.hidden) return;
    fundo.hidden = true;
    contratoFichaId = null;
    if (window.travarRolagemFundo) window.travarRolagemFundo(false);
    document.dispatchEvent(new CustomEvent('orbita:contrato-selecionado', { detail: { id: null } }));
  }

  async function excluirContrato(id) {
    if (!confirm('Excluir este contrato? Os usuários vinculados a ele perderão o acesso.')) return;
    try {
      const resp = await fetch(window.apiUrl(`/contratos/${id}`), { method: 'DELETE', headers: authHeaders() });
      const dados = await resp.json();
      if (dados.status !== 'ok') {
        alert(dados.mensagem || 'Erro ao excluir contrato.');
        return false;
      }
      carregarContratos();
      return true;
    } catch (error) {
      console.error('Erro ao excluir contrato:', error);
      alert('Erro de conexão ao excluir o contrato.');
    }
  }

  function ligarContratos() {
    const tbody = document.querySelector('#tabela-contratos tbody');
    if (!tbody) return;
    tbody.addEventListener('click', (e) => {
      const linha = e.target.closest('tr[data-contrato-id]');
      if (!linha) return;
      const id = Number(linha.dataset.contratoId);
      abrirFichaContrato(id);
    });
    tbody.addEventListener('keydown', (e) => {
      const linha = e.target.closest('tr[data-contrato-id]');
      if (linha && e.key === 'Enter') abrirFichaContrato(Number(linha.dataset.contratoId));
    });
    document.getElementById('btn-novo-contrato')?.addEventListener('click', () => irParaCadastroContrato());
    document.getElementById('contrato-ficha-editar')?.addEventListener('click', () => irParaCadastroContrato(contratoFichaId));
    document.getElementById('contrato-ficha-excluir')?.addEventListener('click', async () => {
      if (await excluirContrato(contratoFichaId)) document.getElementById('contrato-ficha').hidden = true;
    });
    const fundo = document.getElementById('contrato-ficha');
    fundo?.addEventListener('click', (e) => {
      if (e.target === fundo || e.target.closest('[data-fechar-contrato]')) fecharFichaContrato();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharFichaContrato(); });
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
    ligarContratos();


    // Cadastro de usuário fica em Gestão › Cadastros (lista aqui, formulário lá).
    document.getElementById('btn-novo-usuario')?.addEventListener('click', () => { window.location.href = 'cadastros.html#usuario'; });

    document.getElementById('btn-novo-perfil')?.addEventListener('click', () => abrirModalPerfil(null));
    document.getElementById('fechar-modal-perfil')?.addEventListener('click', fecharModalPerfil);
    document.getElementById('cancelar-modal-perfil')?.addEventListener('click', fecharModalPerfil);
    document.getElementById('form-perfil')?.addEventListener('submit', salvarPerfil);

    document.getElementById('modal-perfil')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-perfil') fecharModalPerfil();
    });

  });
})();
