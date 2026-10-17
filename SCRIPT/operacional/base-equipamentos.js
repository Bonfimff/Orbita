//======================================================================================================
// EQUIPAMENTOS NO BALÃO DA BASE (mapas da O.S. e do Painel Geral de Gestão)
// Ao abrir o balão de uma base no mapa, lista os equipamentos vinculados a
// ela. Cada um é um link para a ficha (O.S. › Bases e Equipamentos), aberta
// por ordens.html#equipamento-<id>.
//
// Uso: EquipamentosDaBase.ligar(marcadorLeaflet, idDaBase, htmlDoTopo)
//======================================================================================================
(function () {
  'use strict';

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const url = (c) => (typeof window.apiUrl === 'function' ? window.apiUrl(c) : c);
  let pedido = null;

  // Uma busca só para todas as bases do mapa.
  function equipamentosPorBase() {
    if (!pedido) {
      pedido = fetch(url('/equipamentos?limite=500'), { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
        .then((r) => r.json())
        .then((d) => {
          const mapa = {};
          ((d && d.dados && d.dados.itens) || []).forEach((e) => {
            if (e.base_id) (mapa[e.base_id] = mapa[e.base_id] || []).push(e);
          });
          return mapa;
        })
        .catch(() => null);
      setTimeout(() => { pedido = null; }, 60000);
    }
    return pedido;
  }

  function linkFicha(id) {
    const pagina = (location.pathname.split('/').pop() || '') === 'ordens.html' ? '' : 'ordens.html';
    return pagina + '#equipamento-' + id;
  }

  function ligar(marcador, baseId, topoHtml) {
    const caixa = document.createElement('div');
    caixa.className = 'base-popup';
    caixa.innerHTML = topoHtml + '<div class="base-popup-eq"><small>Carregando equipamentos...</small></div>';
    marcador.bindPopup(caixa, { minWidth: 220, maxWidth: 300 });
    marcador.on('popupopen', async () => {
      const alvo = caixa.querySelector('.base-popup-eq');
      const mapa = await equipamentosPorBase();
      if (!mapa) { alvo.innerHTML = ''; return; }
      const lista = mapa[baseId] || [];
      alvo.innerHTML = lista.length
        ? `<span class="base-popup-titulo">Equipamentos (${lista.length})</span>` + lista.map((e) => `
            <a class="base-popup-item" href="${linkFicha(e.id)}">
              <strong>${esc(e.codigo)}</strong> ${esc(e.nome || '')}
              <small>${esc([e.tipo_nome, e.status && e.status !== 'Ativo' ? String(e.status).replace('Manutencao', 'Manutenção') : ''].filter(Boolean).join(' · '))}</small>
            </a>`).join('')
        : '<small class="base-popup-vazio">Nenhum equipamento nesta base.</small>';
      marcador.getPopup() && marcador.getPopup().update();
    });
  }

  window.EquipamentosDaBase = { ligar };
})();
