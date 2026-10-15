//======================================================================================================
// MATERIAIS do estoque vinculados a O.S. (integracao operacional)
// Convive com o campo de texto livre "Materiais Utilizados" (legado).
// Planejar um material NAO debita estoque - so "Confirmar utilização" debita
// de verdade (produtos.quantidade) e gera movimentacao. Estorno gera
// movimentacao reversa, nunca edita a original.
//======================================================================================================
(function () {
  'use strict';

  const elemento = (id) => document.getElementById(id);
  let ordemAtual = null;
  let numeroOsAtual = null;
  let produtosCache = null;

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
    const caixa = elemento('os-op-materiais-feedback');
    if (!caixa) return;
    caixa.hidden = false;
    caixa.className = 'os-analise-feedback os-analise-feedback-' + (tipo || 'ok');
    caixa.textContent = mensagem;
    clearTimeout(caixa._t);
    caixa._t = setTimeout(() => { caixa.hidden = true; }, 6000);
  }

  async function garantirCatalogo() {
    if (produtosCache) return;
    const resposta = await fetch(urlApi('/produtos/consultar'), {
      method: 'POST', headers: cabecalhos(), body: JSON.stringify({}),
    });
    const dados = await resposta.json();
    produtosCache = (dados && dados.produtos) || [];
    const sel = elemento('os-op-materiais-produto');
    if (sel) {
      sel.innerHTML = '<option value="">Selecione o material...</option>'
        + produtosCache.map((p) => '<option value="' + p.id + '">' + escapar(p.nome_produto) +
          ' (saldo: ' + (p.quantidade == null ? '-' : p.quantidade) + ' ' + escapar(p.unidade_medida || '') + ')</option>').join('');
    }
  }

  const STATUS_ROTULO = {
    planejado: 'Planejado', utilizado: 'Utilizado', devolvido: 'Devolvido', estornado: 'Estornado',
  };
  const STATUS_COR = {
    planejado: '#999', utilizado: '#1a7f37', devolvido: '#0969da', estornado: '#b45309',
  };

  function renderLista(materiais) {
    const container = elemento('os-op-materiais-lista');
    if (!container) return;
    if (!materiais || !materiais.length) {
      container.innerHTML = '<p style="color:#888;font-size:13px;">Nenhum material vinculado a esta O.S. ainda.</p>';
      return;
    }
    container.innerHTML = materiais.map((m) => {
      const acoes = [];
      if (m.status === 'planejado') {
        acoes.push('<button type="button" class="btn-primario btn-sm os-op-mat-confirmar" data-id="' + m.id + '" style="min-height:36px;">Confirmar utilização</button>');
        acoes.push('<button type="button" class="btn-secundario btn-sm os-op-mat-remover" data-id="' + m.id + '" style="min-height:36px;">Remover</button>');
      } else if (m.status === 'utilizado') {
        acoes.push('<button type="button" class="btn-secundario btn-sm os-op-mat-estornar" data-id="' + m.id + '" style="min-height:36px;">Estornar</button>');
      }
      return (
        '<div class="os-op-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;' +
        'gap:8px;padding:10px;border:1px solid #e0e0e0;border-radius:6px;margin-bottom:6px;min-height:44px;">' +
        '<div><strong>' + escapar(m.nome_produto) + '</strong> · ' + m.quantidade + ' ' + escapar(m.unidade || '') +
        ' <span style="font-size:11px;color:' + (STATUS_COR[m.status] || '#999') + ';">' +
        escapar(STATUS_ROTULO[m.status] || m.status) + '</span></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;">' + acoes.join('') + '</div></div>'
      );
    }).join('');

    container.querySelectorAll('.os-op-mat-confirmar').forEach((botao) => {
      botao.addEventListener('click', async () => {
        try {
          await chamar('POST', '/ordens/materiais/' + botao.dataset.id + '/confirmar', { numero_os: numeroOsAtual });
          feedback('Utilização confirmada e estoque baixado.', 'ok');
          await recarregarLista();
        } catch (erro) {
          feedback(erro.message, 'erro');
        }
      });
    });
    container.querySelectorAll('.os-op-mat-remover').forEach((botao) => {
      botao.addEventListener('click', async () => {
        try {
          await chamar('DELETE', '/ordens/materiais/' + botao.dataset.id);
          feedback('Material removido do planejamento.', 'ok');
          await recarregarLista();
        } catch (erro) {
          feedback(erro.message, 'erro');
        }
      });
    });
    container.querySelectorAll('.os-op-mat-estornar').forEach((botao) => {
      botao.addEventListener('click', async () => {
        try {
          await chamar('POST', '/ordens/materiais/' + botao.dataset.id + '/estornar', {});
          feedback('Material estornado e estoque creditado de volta.', 'ok');
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
      const materiais = await chamar('GET', '/ordens/' + ordemAtual + '/materiais');
      renderLista(materiais);
    } catch (erro) {
      console.warn('[materiais.js] listar', erro.message);
    }
  }

  async function carregar(ordemId, numeroOs) {
    ordemAtual = ordemId;
    numeroOsAtual = numeroOs;
    const secao = elemento('os-op-materiais-secao');
    if (!secao || !ordemId) return;
    try {
      await garantirCatalogo();
      await recarregarLista();
    } catch (erro) {
      console.warn('[materiais.js] carregar', erro.message);
      secao.style.display = 'none';
    }
  }

  function inicializar() {
    const botaoAdd = elemento('os-op-materiais-add');
    if (botaoAdd) {
      botaoAdd.addEventListener('click', async () => {
        const produtoId = elemento('os-op-materiais-produto') && elemento('os-op-materiais-produto').value;
        const qtdCampo = elemento('os-op-materiais-qtd');
        const quantidade = qtdCampo ? Number(qtdCampo.value) : 0;
        if (!ordemAtual || !produtoId) { feedback('Selecione um material.', 'erro'); return; }
        if (!quantidade || quantidade <= 0) { feedback('Informe uma quantidade válida.', 'erro'); return; }
        try {
          await chamar('POST', '/ordens/' + ordemAtual + '/materiais', {
            produto_id: Number(produtoId), quantidade,
          });
          feedback('Material planejado (estoque ainda não baixado).', 'ok');
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

  window.OSMateriais = { carregar };
})();
