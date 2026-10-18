//======================================================================================================
// ÍCONES DOS MAPAS (padrão do sistema inteiro)
// Base = alfinete padrão do mapa. Veículo = bolinha na cor da situação.
// - Sempre na posição real.
// - Diminuem aos poucos conforme o mapa se afasta.
// - Nunca saem do ponto: só mudam de tamanho.
// - Ficam visíveis até a visão de um estado inteiro (zoom 7). Mais longe que
//   isso, os próximos viram um indicador único e discreto; o clique aproxima.
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
  const DISTANCIA = 30;        // px: na visão de país, grupos por proximidade
  const ZOOM_AGRUPAR = 6;      // deste zoom para baixo (mais longe que um estado), agrupa
  const BRASIL = [[-34.2, -74.5], [5.6, -28.6]];

  // Escala pelo zoom: diminui de forma contínua ao afastar
  // (1,1 no zoom 17 ou mais; 0,4 na visão de estado, zoom 7).
  function escala(zoom) {
    return Math.max(0.4, Math.min(1.1, 0.4 + (zoom - 7) * 0.07));
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

  // Prepara o mapa (limite, busca e seletor) logo ao criar, mesmo antes dos pontos.
  // opcoes.tipos: quais tipos o mapa mostra (padrão base e veículo); o seletor só lista esses.
  function preparar(mapa, opcoes) {
    if (!mapa || mapa._mi) return mapa;
    mapa._miTipos = (opcoes && opcoes.tipos) || ['base', 'veiculo'];
    {
      mapa._mi = [];
      mapa._miGrupos = L.layerGroup().addTo(mapa);
      limitarAoBrasil(mapa);
      mapa._miOcultos = { base: false, veiculo: false };
      criarControle(mapa);
      const agendar = () => { clearTimeout(mapa._miT); mapa._miT = setTimeout(() => ajustar(mapa), 30); };
      mapa.on('zoomend', () => ajustar(mapa));
      mapa.on('layeradd layerremove', (e) => { if (e.layer && e.layer._miGrupo) return; agendar(); });
      mapa.on('resize', () => limitarAoBrasil(mapa));
    }
    return mapa;
  }

  function registrar(mapa, marcador) {
    if (!mapa || !marcador) return marcador;
    preparar(mapa);
    mapa._mi = mapa._mi.filter((m) => mapa.hasLayer(m));
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
    const ocultos = mapa._miOcultos || {};
    mapa._mi.forEach((m) => { if (ocultos[m._miTipo] && mapa.hasLayer(m)) mostrar(m, false); });
    const ativos = mapa._mi.filter((m) => mapa.hasLayer(m) && !ocultos[m._miTipo]);
    ativos.forEach((m) => {
      if (m._miTipo === 'base') m.setIcon(iconeBase(s));
      else if (m.setRadius) {
        m.setRadius(Math.max(3, RAIO_VEICULO * s));
        m.setStyle({ weight: s < 0.6 ? 1 : 2 });
      }
    });

    mapa._miGrupos.clearLayers();
    const pontos = ativos.map((m) => ({ m, p: mapa.latLngToLayerPoint(m.getLatLng()) }));
    const usados = new Set();
    // Até a visão de estado: cada um no seu ponto, sem agrupar.
    if (zoom > ZOOM_AGRUPAR) {
      ativos.forEach((m) => mostrar(m, true));
      return;
    }
    pontos.forEach((a, i) => {
      if (usados.has(i)) return;
      const grupo = [a];
      usados.add(i);
      pontos.forEach((b, j) => {
        if (!usados.has(j) && grupo.some((g) => g.p.distanceTo(b.p) < DISTANCIA)) { grupo.push(b); usados.add(j); }
      });
      if (grupo.length === 1) { mostrar(a.m, true); return; }
      grupo.forEach((g) => mostrar(g.m, false));
      // Indicador no centro real do grupo; o clique aproxima até os itens aparecerem.
      const limites = L.latLngBounds(grupo.map((g) => g.m.getLatLng()));
      const ind = L.marker(limites.getCenter(), { icon: iconeGrupo(), keyboard: true, title: 'Aproxime para ver', zIndexOffset: 500 });
      ind._miGrupo = true;
      ind.on('click', () => {
        // Aproxima pelo menos até a visão de estado, onde os itens aparecem.
        if (limites.getNorthEast().equals(limites.getSouthWest())) mapa.setView(limites.getCenter(), ZOOM_AGRUPAR + 3);
        else mapa.fitBounds(limites.pad(0.3), { maxZoom: ZOOM_AGRUPAR + 3 });
      });
      mapa._miGrupos.addLayer(ind);
    });
  }

  // Nome pesquisável: título, ou texto do balão.
  function nomeDe(m) {
    if (m._miNome) return m._miNome;
    if (m.options && m.options.title) return m.options.title;
    const p = m.getPopup && m.getPopup();
    let c = p ? p.getContent() : '';
    if (typeof c === 'function') c = c(m);
    if (c && c.nodeType) return (c.textContent || '').trim();
    const d = document.createElement('div');
    d.innerHTML = String(c || '').replace(/<br\s*\/?>/gi, ' · ');
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function sem(t) { return String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(); }

  // Busca e seletor de exibição sobre o mapa.
  function criarControle(mapa) {
    const Ctl = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const box = L.DomUtil.create('div', 'mi-ctl');
        const rotulo = mapa._miTipos.length > 1 ? 'Buscar veículo ou base' : (mapa._miTipos[0] === 'base' ? 'Buscar base' : 'Buscar veículo');
        box.innerHTML = `<input type="search" class="mi-busca" placeholder="${rotulo}" aria-label="${rotulo}">`
          + '<div class="mi-resultados" hidden></div>'
          + '<div class="mi-filtro">'
          + (mapa._miTipos.length > 1 ? mapa._miTipos.map((t) => `<label><input type="checkbox" data-tipo="${t}" checked> ${t === 'base' ? 'Bases' : 'Veículos'}</label>`).join('') : '')
          + '</div>';
        L.DomEvent.disableClickPropagation(box);
        L.DomEvent.disableScrollPropagation(box);
        const input = box.querySelector('.mi-busca');
        const res = box.querySelector('.mi-resultados');
        const ir = (m) => {
          mapa.setView(m.getLatLng(), Math.max(mapa.getZoom(), 15));
          if (m.getPopup && m.getPopup()) setTimeout(() => m.openPopup(), 300);
          res.hidden = true;
        };
        const buscar = () => {
          const q = sem(input.value.trim());
          if (!q) { res.hidden = true; res.innerHTML = ''; return; }
          const achados = mapa._mi.filter((m) => mapa.hasLayer(m) && !mapa._miOcultos[m._miTipo] && sem(nomeDe(m)).includes(q)).slice(0, 8);
          res.innerHTML = '';
          if (!achados.length) res.innerHTML = '<div class="mi-vazio">Nada encontrado</div>';
          achados.forEach((m) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = (m._miTipo === 'base' ? '📍 ' : '🚗 ') + nomeDe(m).slice(0, 70);
            b.addEventListener('click', () => ir(m));
            res.appendChild(b);
          });
          res.hidden = false;
        };
        input.addEventListener('input', buscar);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); const b = res.querySelector('button'); if (b) b.click(); }
          if (e.key === 'Escape') { input.value = ''; buscar(); }
        });
        box.querySelectorAll('.mi-filtro input').forEach((c) => c.addEventListener('change', () => {
          mapa._miOcultos[c.dataset.tipo] = !c.checked;
          if (c.checked) mapa._mi.forEach((m) => { if (m._miTipo === c.dataset.tipo) { mostrar(m, true); if (!c.checked) m.closePopup(); } });
          else mapa._mi.forEach((m) => { if (m._miTipo === c.dataset.tipo) m.closePopup && m.closePopup(); });
          ajustar(mapa);
          buscar();
        }));
        return box;
      },
    });
    new Ctl().addTo(mapa);
  }

  window.MapaIcones = { preparar, base, veiculo, registrar, ajustar, escala };
})();
