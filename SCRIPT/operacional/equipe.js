//======================================================================================================
// EQUIPE cadastrada na O.S. (integracao operacional)
// Convive com os campos de texto legados (responsavel/integrantes). Nunca
// derruba a tela de O.S. se a API estiver indisponivel ou sem permissao -
// a secao so fica vazia/oculta.
//======================================================================================================
(function () {
  'use strict';

  const elemento = (id) => document.getElementById(id);
  let ordemAtual = null;
  let usuariosCache = null;
  let funcoesCache = null;

  function urlApi(caminho) {
    return (typeof window.apiUrl === 'function') ? window.apiUrl(caminho) : caminho;
  }

  function cabecalhos() {
    const token = localStorage.getItem('token');
    const base = { 'Content-Type': 'application/json' };
    if (token) base.Authorization = 'Bearer ' + token;
    return base;
  }

  function escapar(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  async function chamar(metodo, caminho, corpo) {
    const resposta = await fetch(urlApi(caminho), {
      method: metodo, headers: cabecalhos(), body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok || !dados || dados.status !== 'ok') {
      throw new Error((dados && dados.mensagem) || 'Falha na requisição');
    }
    return dados.dados;
  }

  function feedback(mensagem, tipo) {
    const caixa = elemento('os-op-equipe-feedback');
    if (!caixa) return;
    caixa.hidden = false;
    caixa.className = 'os-analise-feedback os-analise-feedback-' + (tipo || 'ok');
    caixa.textContent = mensagem;
    clearTimeout(caixa._t);
    caixa._t = setTimeout(() => { caixa.hidden = true; }, 6000);
  }

  async function garantirCatalogos() {
    if (!usuariosCache) {
      const resposta = await fetch(urlApi('/usuarios/listar'), { headers: cabecalhos() });
      const dados = await resposta.json();
      usuariosCache = (dados && dados.usuarios) || [];
    }
    if (!funcoesCache) {
      funcoesCache = await chamar('GET', '/funcoes-os');
    }
    const selUsuario = elemento('os-op-equipe-usuario');
    if (selUsuario) {
      selUsuario.innerHTML = '<option value="">Selecione o funcionário...</option>'
        + usuariosCache.map((u) => '<option value="' + u.id + '">' + escapar(u.usuario) + '</option>').join('');
    }
    const selFuncao = elemento('os-op-equipe-funcao');
    if (selFuncao) {
      selFuncao.innerHTML = '<option value="">Sem função definida</option>'
        + funcoesCache.map((f) => '<option value="' + f.id + '">' + escapar(f.nome) + '</option>').join('');
    }
    const selEquipePadrao = elemento('os-op-equipe-padrao-select');
    if (selEquipePadrao) {
      try {
        const equipes = await chamar('GET', '/equipes-padrao');
        selEquipePadrao.innerHTML = '<option value="">Selecione uma equipe padrão...</option>'
          + equipes.map((e) => '<option value="' + e.id + '">' + escapar(e.nome) + ' (' + (e.membros || []).length + ' membros)</option>').join('');
      } catch (erro) {
        console.warn('[equipe.js] equipes-padrao', erro.message);
      }
    }
  }

  let responsavelAtual = '';

  function renderLista(membros) {
    const container = elemento('os-op-equipe-lista');
    if (!container) return;
    if (!membros || !membros.length) {
      container.innerHTML = '<p style="color:#888;font-size:13px;">Nenhum funcionário cadastrado nesta O.S. ainda.</p>';
      return;
    }
    const nomeDe = (m) => String(m.usuario_nome || m.usuario_login || '');
    const atual = String(responsavelAtual || '').trim().toLowerCase();
    container.innerHTML = membros.map((m) => (
      '<div class="os-op-card" style="display:flex;justify-content:flex-start;align-items:center;' +
      'gap:8px;padding:10px;border:1px solid #e0e0e0;border-radius:6px;margin-bottom:6px;min-height:44px;">' +
      '<label class="os-op-responsavel" title="Responsável da O.S.">' +
      '<input type="radio" name="os-op-responsavel" value="' + escapar(nomeDe(m)) + '"' +
      (atual && nomeDe(m).trim().toLowerCase() === atual ? ' checked' : '') + ' aria-label="Responsável da O.S.">' +
      '</label>' +
      '<div><strong>' + escapar(nomeDe(m)) + '</strong>' +
      (m.funcao_nome ? ' <span style="color:#666;">(' + escapar(m.funcao_nome) + ')</span>' : '') +
      '</div>' +
      '<button type="button" class="os-op-remover os-op-equipe-remover" title="Remover" aria-label="Remover" data-id="' + m.id +
      '"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'
    )).join('');

    container.querySelectorAll('input[name="os-op-responsavel"]').forEach((radio) => {
      radio.addEventListener('change', async () => {
        if (!radio.checked || !ordemAtual) return;
        try {
          await chamar('PUT', '/ordens/' + ordemAtual + '/responsavel', { nome: radio.value });
          responsavelAtual = radio.value;
          if (typeof window.definirResponsavelEquipeOS === 'function') window.definirResponsavelEquipeOS(radio.value);
          feedback(radio.value + ' é o responsável da O.S.', 'ok');
        } catch (erro) {
          feedback(erro.message, 'erro');
          await recarregarLista();
        }
      });
    });

    container.querySelectorAll('.os-op-equipe-remover').forEach((botao) => {
      botao.addEventListener('click', async () => {
        try {
          await chamar('DELETE', '/ordens/funcionarios/' + botao.dataset.id);
          feedback('Funcionário removido.', 'ok');
          await recarregarLista();
        } catch (erro) {
          feedback(erro.message, 'erro');
        }
      });
    });
  }

  async function recarregarLista() {
    if (!ordemAtual) return;
    try {
      const [membros, resp] = await Promise.all([
        chamar('GET', '/ordens/' + ordemAtual + '/funcionarios'),
        chamar('GET', '/ordens/' + ordemAtual + '/responsavel').catch(() => null),
      ]);
      responsavelAtual = (resp && resp.responsavel) || '';
      renderLista(membros);
    } catch (erro) {
      console.warn('[equipe.js] listar', erro.message);
    }
  }

  async function carregar(ordemId) {
    ordemAtual = ordemId;
    const secao = elemento('os-op-equipe-secao');
    if (!secao || !ordemId) return;
    try {
      await garantirCatalogos();
      await recarregarLista();
    } catch (erro) {
      console.warn('[equipe.js] carregar', erro.message);
      secao.style.display = 'none';
    }
  }

  function inicializar() {
    const botaoAdd = elemento('os-op-equipe-add');
    if (botaoAdd) {
      botaoAdd.addEventListener('click', async () => {
        const usuarioId = elemento('os-op-equipe-usuario') && elemento('os-op-equipe-usuario').value;
        const funcaoId = elemento('os-op-equipe-funcao') && elemento('os-op-equipe-funcao').value;
        if (!ordemAtual || !usuarioId) { feedback('Selecione um funcionário.', 'erro'); return; }
        try {
          await chamar('POST', '/ordens/' + ordemAtual + '/funcionarios', {
            usuario_id: Number(usuarioId), funcao_id: funcaoId ? Number(funcaoId) : null, tipo: 'planejado',
          });
          feedback('Funcionário adicionado.', 'ok');
          await recarregarLista();
        } catch (erro) {
          feedback(erro.message, 'erro');
        }
      });
    }
    const botaoAplicar = elemento('os-op-equipe-padrao-aplicar');
    if (botaoAplicar) {
      botaoAplicar.addEventListener('click', async () => {
        const equipeId = elemento('os-op-equipe-padrao-select') && elemento('os-op-equipe-padrao-select').value;
        if (!ordemAtual || !equipeId) { feedback('Selecione uma equipe padrão.', 'erro'); return; }
        try {
          const resultado = await chamar('POST', '/ordens/' + ordemAtual + '/equipes-padrao/' + equipeId + '/aplicar');
          feedback((resultado.adicionados || 0) + ' membro(s) adicionado(s).', 'ok');
          await recarregarLista();
        } catch (erro) {
          feedback(erro.message, 'erro');
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }

  window.OSEquipe = { carregar };
  // Ao escolher a pessoa, já seleciona a função que ela usou por último.
  document.addEventListener('DOMContentLoaded', function () {
    const selUsuario = elemento('os-op-equipe-usuario');
    const selFuncao = elemento('os-op-equipe-funcao');
    if (!selUsuario || !selFuncao) return;
    selUsuario.addEventListener('change', async function () {
      const usuarioId = selUsuario.value;
      if (!usuarioId) return;
      try {
        const dados = await chamar('GET', '/funcoes-os/ultima/' + usuarioId);
        if (selUsuario.value !== usuarioId) return;
        if (dados && dados.funcao_id && selFuncao.querySelector('option[value="' + dados.funcao_id + '"]')) {
          selFuncao.value = String(dados.funcao_id);
        }
      } catch (erro) {
        console.warn('[equipe.js] ultima funcao', erro.message);
      }
    });
  });
})();
