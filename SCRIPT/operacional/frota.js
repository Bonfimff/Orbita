//======================================================================================================
// FROTA (veiculos) cadastrada na O.S. (integracao operacional)
// Convive com o campo de texto legado "Veículos que serão deslocados".
// Nunca torna veiculo obrigatorio; falha de rede so oculta a secao.
//======================================================================================================
(function () {
  'use strict';

  const elemento = (id) => document.getElementById(id);
  let ordemAtual = null;
  let veiculosCache = null;
  let usuariosCache = null;

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
    const caixa = elemento('os-op-frota-feedback');
    if (!caixa) return;
    caixa.hidden = false;
    caixa.className = 'os-analise-feedback os-analise-feedback-' + (tipo || 'ok');
    caixa.textContent = mensagem;
    clearTimeout(caixa._t);
    caixa._t = setTimeout(() => { caixa.hidden = true; }, 6000);
  }

  async function garantirCatalogos() {
    if (!veiculosCache) {
      const resposta = await fetch(urlApi('/frota/veiculos'), { headers: cabecalhos() });
      const dados = await resposta.json();
      veiculosCache = (dados && dados.veiculos) || [];
    }
    if (!usuariosCache) {
      const resposta = await fetch(urlApi('/usuarios/listar'), { headers: cabecalhos() });
      const dados = await resposta.json();
      usuariosCache = (dados && dados.usuarios) || [];
    }
    const selVeiculo = elemento('os-op-frota-veiculo');
    if (selVeiculo) {
      selVeiculo.innerHTML = '<option value="">Selecione o veículo...</option>'
        + veiculosCache.map((v) => '<option value="' + v.id + '">' + escapar(v.placa) + ' · ' + escapar(v.modelo) + '</option>').join('');
    }
    const selMotorista = elemento('os-op-frota-motorista');
    if (selMotorista) {
      selMotorista.innerHTML = '<option value="">Sem motorista definido</option>'
        + usuariosCache.map((u) => '<option value="' + u.id + '">' + escapar(u.usuario) + '</option>').join('');
    }
  }

  function renderLista(veiculos) {
    const container = elemento('os-op-frota-lista');
    if (!container) return;
    if (!veiculos || !veiculos.length) {
      container.innerHTML = '<p style="color:#888;font-size:13px;">Nenhum veículo alocado nesta O.S. ainda.</p>';
      return;
    }
    container.innerHTML = veiculos.map((v) => (
      '<div class="os-op-card" style="display:flex;justify-content:flex-start;align-items:center;' +
      'gap:8px;padding:10px;border:1px solid #e0e0e0;border-radius:6px;margin-bottom:6px;min-height:44px;">' +
      '<div><strong>' + escapar(v.placa) + '</strong> · ' + escapar(v.modelo) +
      (v.motorista_nome ? ' <span style="color:#666;">(motorista: ' + escapar(v.motorista_nome) + ')</span>' : '') +
      '</div>' +
      '<button type="button" class="os-op-remover os-op-frota-remover" title="Remover" aria-label="Remover" data-id="' + v.id +
      '"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'
    )).join('');

    container.querySelectorAll('.os-op-frota-remover').forEach((botao) => {
      botao.addEventListener('click', async () => {
        try {
          await chamar('DELETE', '/ordens/veiculos/' + botao.dataset.id);
          feedback('Veículo removido.', 'ok');
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
      const veiculos = await chamar('GET', '/ordens/' + ordemAtual + '/veiculos');
      renderLista(veiculos);
    } catch (erro) {
      console.warn('[frota.js] listar', erro.message);
    }
  }

  async function carregar(ordemId) {
    ordemAtual = ordemId;
    const secao = elemento('os-op-frota-secao');
    if (!secao || !ordemId) return;
    try {
      await garantirCatalogos();
      await recarregarLista();
    } catch (erro) {
      console.warn('[frota.js] carregar', erro.message);
      secao.style.display = 'none';
    }
  }

  function inicializar() {
    const botaoAdd = elemento('os-op-frota-add');
    if (botaoAdd) {
      botaoAdd.addEventListener('click', async () => {
        const veiculoId = elemento('os-op-frota-veiculo') && elemento('os-op-frota-veiculo').value;
        const motoristaId = elemento('os-op-frota-motorista') && elemento('os-op-frota-motorista').value;
        if (!ordemAtual || !veiculoId) { feedback('Selecione um veículo.', 'erro'); return; }
        try {
          await chamar('POST', '/ordens/' + ordemAtual + '/veiculos', {
            veiculo_id: Number(veiculoId), motorista_usuario_id: motoristaId ? Number(motoristaId) : null,
          });
          feedback('Veículo alocado.', 'ok');
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

  window.OSFrota = { carregar };
})();
