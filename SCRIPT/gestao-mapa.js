//======================================================================================================
// GESTAO - "Mapa da operação" do Painel Geral: bases (quadrado escuro) e
// veículos (bolinha pela situação), com botões para ligar e desligar cada
// camada. Respeita o contrato do usuário (as rotas /bases e /frota/veiculos
// já filtram).
//======================================================================================================
(function () {
  'use strict';

  const CENTRO = [-22.7856, -43.3117]; // Duque de Caxias - RJ
  const CORES = {
    'Em operação': '#3E6FB0',
    'Disponível': '#1a9e55',
    'Em manutenção': '#f39c12',
    'Inativo': '#8d99ae',
  };
  const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  let mapa = null;
  const camadas = {};

  function url(caminho) {
    let base = window.TUNNEL_API_URL || '/';
    if (!base.endsWith('/')) base += '/';
    return base + caminho;
  }

  async function buscar(caminho, chave) {
    try {
      const resp = await fetch(url(caminho), { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
      const dados = await resp.json();
      return Array.isArray(dados[chave]) ? dados[chave] : [];
    } catch (e) {
      console.warn('Mapa da operação: falha ao carregar', caminho, e);
      return [];
    }
  }

  function escapar(t) {
    return String(t ?? '').replace(/[&<>"']/g, c => ENTIDADES[c]);
  }

  function temPosicao(item) {
    return item.latitude != null && item.longitude != null
      && Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude));
  }

  function situacao(v) {
    const st = String(v.status || '').trim();
    if (st === 'Em manutenção' || st === 'Inativo') return st;
    if (v.operacao && !v.operacao.reservado) return 'Em operação';
    return 'Disponível';
  }

  async function montar() {
    const el = document.getElementById('pg-mapa');
    if (!el || !window.L) return;

    const [bases, veiculos] = await Promise.all([buscar('bases', 'bases'), buscar('frota/veiculos', 'veiculos')]);

    if (!mapa) {
      mapa = L.map(el, { scrollWheelZoom: false }).setView(CENTRO, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapa);
      camadas.bases = L.featureGroup().addTo(mapa);
      camadas.veiculos = L.featureGroup().addTo(mapa);
    }
    camadas.bases.clearLayers();
    camadas.veiculos.clearLayers();

    bases.filter(temPosicao).forEach(b => {
      L.marker([Number(b.latitude), Number(b.longitude)], {
        icon: L.divIcon({ className: 'pg-mapa-base', iconSize: [16, 16] }),
        zIndexOffset: -100,
      }).addTo(camadas.bases).bindPopup(`<strong>${escapar(b.id)}</strong><br>${escapar(b.endereco)}`);
    });

    veiculos.filter(temPosicao).forEach(v => {
      const sit = situacao(v);
      const os = v.operacao && !v.operacao.reservado
        ? `<br>${escapar(v.operacao.numero_os || 'O.S. #' + v.operacao.ordem_id)}`
        : '';
      L.circleMarker([Number(v.latitude), Number(v.longitude)], {
        radius: 8, color: '#ffffff', weight: 2, fillColor: CORES[sit], fillOpacity: 0.92,
      }).addTo(camadas.veiculos).bindPopup(
        `<strong>${escapar(v.placa)}</strong><br>${escapar([v.marca, v.modelo].filter(Boolean).join(' '))}<br>${sit}${os}`
      );
    });

    enquadrar();
  }

  function enquadrar() {
    if (!mapa) return;
    const limites = L.latLngBounds([]);
    Object.values(camadas).forEach(c => {
      if (mapa.hasLayer(c) && c.getLayers().length) limites.extend(c.getBounds());
    });
    if (limites.isValid()) mapa.fitBounds(limites, { padding: [30, 30], maxZoom: 15 });
    setTimeout(() => mapa.invalidateSize(), 60);
  }

  document.addEventListener('click', e => {
    const botao = e.target.closest('.pg-mapa-camadas [data-camada]');
    if (botao && mapa) {
      const camada = camadas[botao.dataset.camada];
      const ligar = !mapa.hasLayer(camada);
      if (ligar) camada.addTo(mapa); else mapa.removeLayer(camada);
      botao.classList.toggle('ativo', ligar);
      botao.setAttribute('aria-pressed', String(ligar));
      enquadrar();
      return;
    }
    // A aba pode ter ficado oculta: corrige o tamanho ao voltar ao painel.
    if (e.target.closest('[data-tab="painel-geral"]') && mapa) setTimeout(() => mapa.invalidateSize(), 80);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
