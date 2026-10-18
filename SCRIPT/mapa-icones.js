//======================================================================================================
// ÍCONES DOS MAPAS (padrão do sistema inteiro)
// Base = alfinete padrão do mapa. Veículo = bolinha na cor da situação.
// Os dois acompanham o zoom com uma escala suave (sem crescer ou sumir de
// forma brusca) e, quando ficariam um em cima do outro, se afastam um pouco
// em círculo só na tela; a posição real não muda.
//
// Uso: const m = MapaIcones.base([lat, lng]).addTo(camada); MapaIcones.registrar(mapa, m);
//      const v = MapaIcones.veiculo([lat, lng], cor).addTo(camada); MapaIcones.registrar(mapa, v);
//======================================================================================================
(function () {
  'use strict';

  const CDN = 'https://unpkg.com/leaflet@1.9.4/dist/images/';
  const PIN = [25, 41];
  const RAIO_VEICULO = 8;
  const DISTANCIA = 26; // px: abaixo disso os marcadores se afastam

  // Escala pelo zoom: 0,65 no zoom 8 ou menos, até 1,1 no zoom 17 ou mais.
  function escala(zoom) {
    return Math.max(0.65, Math.min(1.1, 0.65 + (zoom - 8) * 0.05));
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

  function registrar(mapa, marcador) {
    if (!mapa || !marcador) return marcador;
    if (!mapa._mi) {
      mapa._mi = [];
      const atualizar = () => ajustar(mapa);
      mapa.on('zoomend', atualizar);
      mapa.on('layeradd layerremove', () => { clearTimeout(mapa._miT); mapa._miT = setTimeout(atualizar, 30); });
    }
    marcador._miOrig = marcador.getLatLng();
    mapa._mi.push(marcador);
    clearTimeout(mapa._miT);
    mapa._miT = setTimeout(() => ajustar(mapa), 30);
    return marcador;
  }

  function ajustar(mapa) {
    const s = escala(mapa.getZoom());
    // Só os marcadores ainda no mapa (camadas podem ter sido limpas ou desligadas).
    mapa._mi = mapa._mi.filter((m) => m._map || m._miOrig);
    const ativos = mapa._mi.filter((m) => mapa.hasLayer(m));
    ativos.forEach((m) => {
      if (m._miTipo === 'base') m.setIcon(iconeBase(s));
      else if (m.setRadius) m.setRadius(Math.max(5, Math.round(RAIO_VEICULO * s)));
    });
    // Afasta os que ficariam sobrepostos na tela (grupos por proximidade).
    const pontos = ativos.map((m) => ({ m, p: mapa.latLngToLayerPoint(m._miOrig) }));
    const usados = new Set();
    const limite = DISTANCIA * s;
    pontos.forEach((a, i) => {
      if (usados.has(i)) return;
      const grupo = [a];
      usados.add(i);
      pontos.forEach((b, j) => {
        if (!usados.has(j) && a.p.distanceTo(b.p) < limite) { grupo.push(b); usados.add(j); }
      });
      if (grupo.length === 1) { a.m.setLatLng(a.m._miOrig); return; }
      const cx = grupo.reduce((t, g) => t + g.p.x, 0) / grupo.length;
      const cy = grupo.reduce((t, g) => t + g.p.y, 0) / grupo.length;
      const raio = Math.max(limite * 0.75, (limite * grupo.length) / (2 * Math.PI));
      grupo.forEach((g, k) => {
        const ang = (2 * Math.PI * k) / grupo.length - Math.PI / 2;
        g.m.setLatLng(mapa.layerPointToLatLng(L.point(cx + raio * Math.cos(ang), cy + raio * Math.sin(ang))));
      });
    });
  }

  window.MapaIcones = { base, veiculo, registrar, ajustar, escala };
})();
