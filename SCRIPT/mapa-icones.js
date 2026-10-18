//======================================================================================================
// ÍCONES DOS MAPAS (padrão do sistema inteiro)
// Base = alfinete padrão do mapa. Veículo = bolinha na cor da situação.
// - Sempre na posição real.
// - Diminuem aos poucos conforme o mapa se afasta.
// - Quando ficariam encostados (ou com o mapa muito afastado), somem e dão
//   lugar a um indicador único e discreto naquele lugar; o clique aproxima.
// - O mapa fica limitado ao Brasil.
//
// Uso: const m = MapaIcones.base([lat, lng]).addTo(camada); MapaIcones.registrar(mapa, m);
//      const v = MapaIcones.veiculo([lat, lng], cor).addTo(camada); MapaIcones.registrar(mapa, v);
//======================================================================================================
(function () {
  'use strict';

  const CDN = 'https://unpkg.com/leaflet@1.9.4/dist/images/';
  const PIN = [25, 41];
  const RAIO_VEICULO = 8;
  const DISTANCIA = 30;       // px: abaixo disso, vira indicador único
  const ZOOM_SO_INDICADOR = 8; // deste zoom para baixo, só indicadores
  const BRASIL = [[-34.2, -74.5], [5.6, -28.6]];

  // Escala pelo zoom: diminui de forma contínua ao afastar (1,1 no zoom 17 ou mais).
  function escala(zoom) {
    return Math.max(0.5, Math.min(1.1, 0.5 + (zoom - 8) * 0.067));
  }

  function iconeBase(s) {
    const w = Math.round(PIN[0] * s);
    const h = Math.round(PIN[1] * s);
    return L.icon({
      iconUrl: CDN + 'marker-icon.png',
      iconRetinaUrl: CDN + 'marker-icon-2x.png',
      shadowUrl: CDN + 'marker-shadow.png',
      iconSize: [w, h],
      iconAnchor: [Math.round(w / 2), h],
      popupAnchor: [0, -Math.round(h * 0.85)],
      shadowSize: [Math.round(41 * s), Math.round(41 * s)],
      shadowAnchor: [Math.round(13 * s), Math.round(41 * s)],
    });
  }

  function iconeGrupo() {
    return L.divIcon({ className: 'mi-grupo', iconSize: [18, 18], iconAnchor: [9, 9], html: '<span></span>' });
  }

  function base(latlng, opcoes) {
    const m = L.marker(latlng, Object.assign({ icon: iconeBase(1) }, opcoes || {}));
    m._miTipo = 'base';
    return m;
  }

  function veiculo(latlng, cor, opcoes) {
    const m = L.circleMarker(latlng, Object.assign({
      radius: RAIO_VEICULO, color: '#ffffff', weight: 2, fillColor: cor || '#64748b', fillOpacity: 0.92,
    }, opcoes || {}));
    m._miTipo = 'veiculo';
    return m;
  }

  function limitarAoBrasil(mapa) {
    const limites = L.latLngBounds(BRASIL);
    mapa.setMaxBounds(limites.pad(0.05));
    mapa.options.maxBoundsViscosity = 1;
    mapa.setMinZoom(Math.max(3, mapa.getBoundsZoom(limites, true) - 0));
  }

  function registrar(mapa, marcador) {
    if (!mapa || !marcador) return marcador;
    if (!mapa._mi) {
      mapa._mi = [];
      mapa._miGrupos = L.layerGroup().addTo(mapa);
      limitarAoBrasil(mapa);
      const agendar = () => { clearTimeout(mapa._miT); mapa._miT = setTimeout(() => ajustar(mapa), 30); };
      mapa.on('zoomend', () => ajustar(mapa));
      mapa.on('layeradd layerremove', (e) => { if (e.layer && e.layer._miGrupo) return; agendar(); });
      mapa.on('resize', () => limitarAoBrasil(mapa));
    }
    mapa._mi.push(marcador);
    clearTimeout(mapa._miT);
    mapa._miT = setTimeout(() => ajustar(mapa), 30);
    return marcador;
  }

  function mostrar(m, visivel) {
    const els = [m._icon, m._shadow, m._path].filter(Boolean);
    els.forEach((el) => { el.style.display = visivel ? '' : 'none'; });
  }

  function ajustar(mapa) {
    if (!mapa._mi) return;
    const zoom = mapa.getZoom();
    const s = escala(zoom);
    const ativos = mapa._mi.filter((m) => mapa.hasLayer(m));
    ativos.forEach((m) => {
      if (m._miTipo === 'base') m.setIcon(iconeBase(s));
      else if (m.setRadius) m.setRadius(Math.max(4, Math.round(RAIO_VEICULO * s)));
    });

    mapa._miGrupos.clearLayers();
    const pontos = ativos.map((m) => ({ m, p: mapa.latLngToLayerPoint(m.getLatLng()) }));
    const usados = new Set();
    const soIndicador = zoom <= ZOOM_SO_INDICADOR;
    pontos.forEach((a, i) => {
      if (usados.has(i)) return;
      const grupo = [a];
      usados.add(i);
      pontos.forEach((b, j) => {
        if (!usados.has(j) && grupo.some((g) => g.p.distanceTo(b.p) < DISTANCIA)) { grupo.push(b); usados.add(j); }
      });
      if (grupo.length === 1 && !soIndicador) { mostrar(a.m, true); return; }
      grupo.forEach((g) => mostrar(g.m, false));
      // Indicador no centro real do grupo; o clique aproxima até os itens aparecerem.
      const limites = L.latLngBounds(grupo.map((g) => g.m.getLatLng()));
      const ind = L.marker(limites.getCenter(), { icon: iconeGrupo(), keyboard: true, title: 'Aproxime para ver', zIndexOffset: 500 });
      ind._miGrupo = true;
      ind.on('click', () => {
        if (grupo.length === 1 || limites.getNorthEast().equals(limites.getSouthWest())) mapa.setView(limites.getCenter(), Math.max(zoom + 3, ZOOM_SO_INDICADOR + 2));
        else mapa.fitBounds(limites.pad(0.6), { maxZoom: Math.max(zoom + 3, ZOOM_SO_INDICADOR + 2) });
      });
      mapa._miGrupos.addLayer(ind);
    });
  }

  window.MapaIcones = { base, veiculo, registrar, ajustar, escala };
})();
