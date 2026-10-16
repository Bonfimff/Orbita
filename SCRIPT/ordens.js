
// ============================================================
//  Ordens de Serviço, SCRIPT principal
// ============================================================
(function () {

const OS_API_BASE = window.TUNNEL_API_URL || (window.API_BASE_URL + '/');
const BASES_GEO_CACHE_KEY = 'svplus_bases_geocodificadas';
const STATUS_EM_ATENDIMENTO = ['Em Andamento', 'Em Deslocamento', 'Chegada no Local'];

let basesMapaLeaflet = null;
let basesMapaLeafletCamada = null;
let basesMapaRenderToken = 0;
let leafletLoadPromise = null;

let despachoResponsaveis = [];
let despachoIntegrantes = [];
let despachoVeiculos = [];
let despachoItens = [];
let despachoIdRetiradaManual = null;
let materiaisAdicionados = [];
let materiaisBasesAdicionados = [];
let baseFotosFiles = [];
let baseDocsFiles = [];
let basePreviewState = null;
let osEdicaoSomenteVisualizacao = false;
let salvandoNovoPontoModal = false;
let salvandoSaidaEdicaoModal = false;

function carregarLeafletSeNecessario() {
  if (window.L) return Promise.resolve(true);
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve) => {
    const finalizar = () => resolve(Boolean(window.L));

    if (!document.querySelector('link[data-svplus-leaflet]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
      css.setAttribute('data-svplus-leaflet', '1');
      document.head.appendChild(css);
    }

    const scriptExistente = document.querySelector('script[data-svplus-leaflet]');
    if (scriptExistente) {
      if (window.L) {
        finalizar();
      } else {
        scriptExistente.addEventListener('load', finalizar, { once: true });
        scriptExistente.addEventListener('error', finalizar, { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.setAttribute('data-svplus-leaflet', '1');
    script.addEventListener('load', finalizar, { once: true });
    script.addEventListener('error', finalizar, { once: true });
    document.body.appendChild(script);
  });

  return leafletLoadPromise;
}

function osApiUrl(path) {
  let base = (window.TUNNEL_API_URL || OS_API_BASE);
  if (!base.endsWith('/')) base += '/';
  if (path.startsWith('/')) path = path.slice(1);
  return base + path;
}

function authHeaders(json = false) {
  const h = { 'Authorization': 'Bearer ' + localStorage.getItem('token') };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function parseListaTexto(valor) {
  if (Array.isArray(valor)) {
    return valor
      .map(item => String(item || '').trim())
      .filter(Boolean);
  }

  const texto = String(valor || '').trim();
  if (!texto) return [];

  // Aceita payload legado em JSON serializado: ["a","b"].
  if (texto.startsWith('[') && texto.endsWith(']')) {
    try {
      const arr = JSON.parse(texto);
      if (Array.isArray(arr)) {
        return arr
          .map(item => String(item || '').trim())
          .filter(Boolean);
      }
    } catch (error) {
      // Se falhar JSON, continua no split textual.
    }
  }

  return texto
    .split(/[\n,;]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function badgeStatus(status) {
  const mapa = {
    'Aberta':                              { bg: '#ff9800', txt: '#fff' },
    'Em Andamento':                        { bg: '#2196f3', txt: '#fff' },
    'Em Deslocamento':                     { bg: '#7b1fa2', txt: '#fff' },
    'Aguardando Despacho de Equipamentos': { bg: '#e65100', txt: '#fff' },
    'Chegada no Local':                    { bg: '#00796b', txt: '#fff' },
    'Finalizada':                          { bg: '#4caf50', txt: '#fff' },
    'Cancelada':                           { bg: '#9e9e9e', txt: '#fff' },
  };
  const c = mapa[status] || { bg: '#757575', txt: '#fff' };
  return `<span class="os-badge" style="background:${c.bg};color:${c.txt};">${status}</span>`;
}

function badgePrioridade(p) {
  const cores = {
    'Baixa':   { bg: '#64b5f6', txt: '#222' },
    'Média':   { bg: '#ffd54f', txt: '#222' },
    'Alta':    { bg: '#ff8a65', txt: '#fff' },
    'Urgente': { bg: '#e53935', txt: '#fff' },
  };
  const c = cores[p] || { bg: '#bdbdbd', txt: '#222' };
  return `<span class="os-badge" style="background:${c.bg};color:${c.txt};">${p}</span>`;
}

function tecnicoExibicao(os) {
  const respEquipe = (os?.responsavel_equipe || '').trim();
  const tecnico = (os?.tecnico_responsavel || '').trim();
  return respEquipe || tecnico || '-';
}

function atualizarLegendaTecnicoModal(os) {
  const el = document.getElementById('edit-os-tecnico-legenda');
  if (!el) return;
  el.textContent = `Técnico responsável: ${tecnicoExibicao(os)}`;
}

function badgePontoStatus(status) {
  const mapa = {
    'Pendente':         { bg: '#e0e0e0', txt: '#333' },
    'Em Preparo':       { bg: '#f3ead8', txt: '#6b5228' },
    'Em Deslocamento':  { bg: '#7b1fa2', txt: '#fff' },
    'Chegada no Local': { bg: '#00796b', txt: '#fff' },
    'Finalizado':       { bg: '#4caf50', txt: '#fff' },
    'Cancelado':        { bg: '#9e9e9e', txt: '#fff' },
  };
  const c = mapa[status] || { bg: '#e0e0e0', txt: '#333' };
  return `<span class="os-badge" style="background:${c.bg};color:${c.txt};font-size:11px;">${status}</span>`;
}

function obterStatusEfetivoOS(os = {}) {
  const statusBase = String(os?.status || '').trim();
  if (statusBase === 'Finalizada' || statusBase === 'Cancelada') return statusBase;

  const pontos = Array.isArray(os?.pontos) ? os.pontos : [];
  const statusPontos = pontos.map(p => String(p?.status || '').trim());

  if (statusPontos.includes('Chegada no Local')) return 'Chegada no Local';
  if (statusPontos.includes('Em Deslocamento')) return 'Em Deslocamento';
  if (statusPontos.includes('Finalizado') && statusBase !== 'Finalizada') return 'Em Andamento';

  return statusBase || 'Aberta';
}

function mostrarFeedback(msg, tipo = 'ok') {
  const el = document.getElementById('os-feedback');
  if (!el) return;
  el.textContent = msg;
  el.className = tipo === 'ok' ? 'feedback-sucesso' : 'feedback-erro';
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function carregarCacheGeocodificacaoBases() {
  try {
    return JSON.parse(localStorage.getItem(BASES_GEO_CACHE_KEY) || '{}');
  } catch (error) {
    return {};
  }
}

function salvarCacheGeocodificacaoBases(cache) {
  try {
    localStorage.setItem(BASES_GEO_CACHE_KEY, JSON.stringify(cache || {}));
  } catch (error) {
    console.warn('Falha ao salvar cache de geocodificação das bases:', error);
  }
}

function construirEnderecoMapaBase(base) {
  const endereco = String(base?.endereco || '').trim();
  const complemento = String(base?.complemento || '').trim();
  const link = String(base?.link_localizacao || '').trim();

  // Prioriza endereco textual para geocodificacao, com fallback no link quando necessario.
  if (endereco && complemento) return `${endereco}, ${complemento}`;
  if (endereco) return endereco;
  return link;
}

function chaveGeocodificacaoBase(base) {
  return construirEnderecoMapaBase(base).trim().toLowerCase();
}

async function geocodificarBase(base, cache) {
  const consulta = construirEnderecoMapaBase(base);
  if (!consulta) return null;

  const chave = chaveGeocodificacaoBase(base);
  if (cache[chave]) return cache[chave];

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&countrycodes=br&q=${encodeURIComponent(consulta)}`, {
      headers: {
        'Accept-Language': 'pt-BR',
      },
    });

    if (!response.ok) return null;

    const dados = await response.json();
    if (!Array.isArray(dados) || dados.length === 0) return null;

    const posicao = {
      lat: Number(dados[0].lat),
      lng: Number(dados[0].lon),
      label: consulta,
      display_name: dados[0].display_name || consulta,
    };

    if (Number.isFinite(posicao.lat) && Number.isFinite(posicao.lng)) {
      cache[chave] = posicao;
      return posicao;
    }
  } catch (error) {
    console.warn('Falha ao geocodificar base:', consulta, error);
  }

  return null;
}

// Centro de referência quando um veículo não tem posição real (mesma
// convenção usada no mapa da Frota, pra estimativa cair na mesma região).
const VEICULOS_MAPA_CENTRO = [-22.7856, -43.3117]; // Duque de Caxias - RJ

function hashTextoVeiculo(valor) {
  const texto = String(valor || 'SVPLUS');
  let hash = 0;
  for (let i = 0; i < texto.length; i += 1) {
    hash = ((hash << 5) - hash) + texto.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Sem GPS real integrado, a posição do veículo no mapa é estimada a partir
// da placa (determinística: a mesma placa sempre cai no mesmo ponto), do
// jeito que já era feito no mapa da Frota - aqui replicado porque aquela
// lógica vive isolada dentro da IIFE de frota.js.
function coordenadaEstimativaVeiculo(placa, indice) {
  const hash = hashTextoVeiculo(`${placa || ''}-${indice}`);
  const deltaLat = ((hash % 900) / 10000) - 0.045;
  const deltaLng = (((Math.floor(hash / 1000)) % 900) / 10000) - 0.045;
  return [
    VEICULOS_MAPA_CENTRO[0] + deltaLat,
    VEICULOS_MAPA_CENTRO[1] + deltaLng,
  ];
}

function corMarcadorVeiculo(status) {
  const st = String(status || '').trim();
  if (st === 'Em manutenção') return '#f39c12';
  if (st === 'Inativo') return '#8d99ae';
  if (st === 'Em operação') return '#3E6FB0';
  return '#1a9e55';
}

async function listarBases() {
  try {
    const resp = await fetch(osApiUrl('bases'), { headers: authHeaders() });
    const dados = await resp.json();
    return (dados.status === 'ok' && Array.isArray(dados.bases)) ? dados.bases : [];
  } catch (error) {
    console.warn('Falha ao carregar bases:', error);
    return [];
  }
}

async function listarVeiculosParaMapa() {
  try {
    const resp = await fetch(osApiUrl('frota/veiculos'), { headers: authHeaders() });
    const dados = await resp.json();
    return (dados.status === 'ok' && Array.isArray(dados.veiculos)) ? dados.veiculos : [];
  } catch (error) {
    console.warn('Falha ao carregar veículos para o mapa:', error);
    return [];
  }
}

// Persiste a posição geocodificada na base (best-effort: se falhar, o mapa
// ainda funciona nesta sessão, só volta a geocodificar na próxima carga).
async function salvarCoordenadasBase(baseId, lat, lng) {
  try {
    await fetch(osApiUrl(`bases/${encodeURIComponent(baseId)}`), {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    });
  } catch (error) {
    console.warn('Falha ao salvar coordenadas geocodificadas da base:', baseId, error);
  }
}

async function renderizarMapaBasesGerenciamento() {
  const mapaContainer = document.getElementById('bases-mapa-container');
  const mapaEl = document.getElementById('bases-mapa');
  const legendaEl = document.getElementById('bases-mapa-legenda');
  const contagemEl = document.getElementById('bases-mapa-contagem');
  if (!mapaContainer || !mapaEl || !legendaEl || !contagemEl) return;

  const [bases, veiculos] = await Promise.all([listarBases(), listarVeiculosParaMapa()]);

  if (bases.length === 0 && veiculos.length === 0) {
    mapaContainer.style.display = 'none';
    legendaEl.innerHTML = '';
    contagemEl.textContent = 'Nenhum veículo ou base cadastrado ainda (ou nenhum dentro dos contratos autorizados).';
    if (basesMapaLeaflet) {
      basesMapaLeaflet.remove();
      basesMapaLeaflet = null;
      basesMapaLeafletCamada = null;
    }
    return;
  }

  mapaContainer.style.display = 'block';
  contagemEl.textContent = `${veiculos.length} veículo(s) · ${bases.length} base(s)`;

  if (!window.L) {
    await carregarLeafletSeNecessario();
  }

  if (!window.L) {
    contagemEl.textContent += ' - mapa indisponível.';
    return;
  }

  const tokenRenderizacao = ++basesMapaRenderToken;

  if (basesMapaLeaflet) {
    basesMapaLeaflet.remove();
    basesMapaLeaflet = null;
    basesMapaLeafletCamada = null;
  }

  mapaEl.innerHTML = '';
  basesMapaLeaflet = L.map('bases-mapa', {
    zoomControl: true,
    scrollWheelZoom: false,
  }).setView([-14.235, -51.9253], 4);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(basesMapaLeaflet);

  basesMapaLeafletCamada = L.featureGroup().addTo(basesMapaLeaflet);

  // ---- Bases: usa lat/long já salvo; só geocodifica o que ainda não tem ----
  const cacheGeo = carregarCacheGeocodificacaoBases();
  const basesComPosicao = await Promise.all(bases.map(async (base) => {
    if (Number.isFinite(base.latitude) && Number.isFinite(base.longitude)) {
      return { base, posicao: { lat: base.latitude, lng: base.longitude } };
    }
    const posicao = await geocodificarBase(base, cacheGeo);
    if (posicao) salvarCoordenadasBase(base.id, posicao.lat, posicao.lng);
    return { base, posicao };
  }));

  if (tokenRenderizacao !== basesMapaRenderToken || !basesMapaLeaflet || !basesMapaLeafletCamada) return;

  salvarCacheGeocodificacaoBases(cacheGeo);

  const basesValidas = basesComPosicao.filter(item => item.posicao);
  const itensLegenda = [];

  basesValidas.forEach(({ base, posicao }) => {
    const id = String(base.id || '').trim() || 'Base';
    const enderecoExibicao = construirEnderecoMapaBase(base) || construirLocalizacaoBase(base);
    const marcador = L.marker([posicao.lat, posicao.lng]).addTo(basesMapaLeafletCamada);
    marcador.bindPopup(`
      <div style="min-width:180px;">
        <strong>📍 ${escapeHtml(id)}</strong><br>
        <span>${escapeHtml(enderecoExibicao)}</span>
      </div>
    `);
    itensLegenda.push(`<div class="pontos-mapa-legenda-item"><strong>📍 ${escapeHtml(id)}</strong> - ${escapeHtml(enderecoExibicao)}</div>`);
  });

  // ---- Veículos: posição estimada (sem GPS real integrado ainda) ----
  veiculos.forEach((veiculo, indice) => {
    const temPosicao = veiculo.latitude != null && veiculo.longitude != null;
    const [lat, lng] = temPosicao ? [Number(veiculo.latitude), Number(veiculo.longitude)] : coordenadaEstimativaVeiculo(veiculo.placa, indice);
    const situacao = (veiculo.status === 'Ativo' && veiculo.operacao && !veiculo.operacao.reservado) ? 'Em operação' : (veiculo.status || '-');
    const cor = corMarcadorVeiculo(situacao);
    const marcador = L.circleMarker([lat, lng], {
      radius: 8,
      color: '#ffffff',
      weight: 2,
      fillColor: cor,
      fillOpacity: 0.92,
    }).addTo(basesMapaLeafletCamada);
    marcador.bindPopup(`
      <div style="min-width:180px;">
        <strong>🚗 ${escapeHtml(veiculo.placa || 'Sem placa')}</strong><br>
        ${escapeHtml([veiculo.marca, veiculo.modelo].filter(Boolean).join(' ') || 'Veículo')}<br>
        Situação: ${escapeHtml(situacao)}<br>
        <em style="font-size:11px;color:#888;">${temPosicao ? 'Última posição' : 'Posição estimada'}</em>
      </div>
    `);
    itensLegenda.push(`<div class="pontos-mapa-legenda-item"><strong>🚗 ${escapeHtml(veiculo.placa || 'Sem placa')}</strong> - ${escapeHtml(situacao)}${temPosicao ? '' : ' (posição estimada)'}</div>`);
  });

  legendaEl.innerHTML = itensLegenda.join('') || '<div class="pontos-mapa-legenda-item">Nenhum ponto localizado no mapa.</div>';

  const bounds = basesMapaLeafletCamada.getBounds();
  if (bounds.isValid()) {
    basesMapaLeaflet.fitBounds(bounds, { padding: [30, 30] });
    if (basesValidas.length + veiculos.length === 1) {
      basesMapaLeaflet.setZoom(Math.min(basesMapaLeaflet.getZoom(), 15));
    }
  }
}

function renderizarListaItens(containerId, itens) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!itens || itens.length === 0) {
    container.innerHTML = '';
    return;
  }
  try {
    container.innerHTML = '';

    itens.forEach((item) => {
      let textoItem = '';
      try {
        textoItem = typeof item === 'string'
          ? item
          : item?.label ?? item?.nome ?? item?.value ?? String(item ?? '');
      } catch (error) {
        console.warn('Falha ao converter item da lista para texto:', item, error);
      }

      const pill = document.createElement('span');
      pill.className = 'lista-item-pill';
      pill.textContent = textoItem;
      container.appendChild(pill);
    });
  } catch (error) {
    console.error('Erro ao renderizar lista em ' + containerId + ':', error, itens);
    container.innerHTML = '';
  }
}

function renderizarListaItensClean(containerId, itens) {
  return renderizarListaItens(containerId, itens);
}

function adicionarItemLista(inputId, lista, containerId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const valor = input.value.trim();
  if (!valor) return;
  lista.push(valor);
  input.value = '';
  renderizarListaItens(containerId, lista);
}

function removerItemLista(containerId, index) {
  const lista = containerId === 'edit-despacho-responsavel-list' ? despachoResponsaveis : despachoIntegrantes;
  if (!lista || index < 0 || index >= lista.length) return;
  lista.splice(index, 1);
  renderizarListaItens(containerId, lista);
}

// ============================================================
//  GERENCIAMENTO DE ITENS DE DESPACHO
// ============================================================

function renderizarTabelaItensDespacho() {
  const tbody = document.getElementById('tabela-itens-despacho');
  if (!tbody) return;
  
  if (despachoItens.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #999;">Nenhum item adicionado.</td></tr>';
    return;
  }
  
  tbody.innerHTML = despachoItens.map((item, index) => {
    const ehItemManual = item.id_retirada && item.id_retirada.startsWith('MANU');
    const botaoAcao = ehItemManual
      ? '<button type="button" class="btn-remover-item-despacho" data-index="' + index + '" style="padding: 4px 8px; background: #e74c3c; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">Remover</button>'
      : '<button type="button" class="btn-retirar-grupo-despacho" data-index="' + index + '" style="padding: 4px 8px; background: #17a2b8; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;" title="Retira todos os itens desta retirada juntos">Retirada</button>';

    const estiloLinha = ehItemManual ? '' : ' style="background-color: #fffbf0;"';
    const idRetiradaDisplay = item.id_retirada ? '<span style="font-family: monospace; font-weight: bold;">' + escapeHtml(item.id_retirada) + '</span>' : '-';

    return '<tr' + estiloLinha + '>' +
      '<td style="padding: 8px; border: 1px solid #ddd;">' + escapeHtml(item.nome) + '</td>' +
      '<td style="padding: 8px; text-align: center; border: 1px solid #ddd;">' + item.quantidade + '</td>' +
      '<td style="padding: 8px; text-align: center; border: 1px solid #ddd; color: #666;">' + idRetiradaDisplay + '</td>' +
      '<td style="padding: 8px; text-align: center; border: 1px solid #ddd;">' + botaoAcao + '</td>' +
      '</tr>';
  }).join('');
}

function obterIdRetiradaManualDespacho() {
  const existente = despachoItens.find(item => item.id_retirada && item.id_retirada.startsWith('MANU'));
  if (existente?.id_retirada) {
    despachoIdRetiradaManual = existente.id_retirada;
    return despachoIdRetiradaManual;
  }

  if (despachoIdRetiradaManual) {
    return despachoIdRetiradaManual;
  }

  const osIdEl = document.getElementById('edit-os-id');
  const osId = osIdEl && osIdEl.value ? String(osIdEl.value) : 'XXXX';
  despachoIdRetiradaManual = 'MANU-' + osId;
  return despachoIdRetiradaManual;
}

async function carregarProdutosParaDespacho() {
  const datalist = document.getElementById('lista-itens-estoque');
  if (!datalist) return;
  
  try {
    const token = localStorage.getItem('token');
    
    // Tenta primeiro com o endpoint de consulta (POST com filtros)
    let resp = await fetch(osApiUrl('produtos/consultar'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        nome_produto_consulta: '',
        codigo_produto_consulta: '',
        categoria_produto_consulta: '',
      }),
    });
    
    let data = null;
    
    if (resp.ok) {
      data = await resp.json();
    } else {
      // Se consulta falhar, tenta um endpoint alternativo simples
      console.warn('produtos/consultar falhou com status', resp.status);
      resp = await fetch(osApiUrl('produtos/listar'), {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
        },
      });
      
      if (resp.ok) {
        data = await resp.json();
      } else {
        console.warn('Falha ao carregar produtos para despacho');
        return;
      }
    }
    
    let produtos = [];
    
    if (data?.status === 'ok' && Array.isArray(data?.produtos)) {
      produtos = data.produtos;
    } else if (Array.isArray(data)) {
      produtos = data;
    }
    
    const baseDatalist = document.getElementById('base-material-sugestoes');
    datalist.innerHTML = '';
    if (baseDatalist) baseDatalist.innerHTML = '';
    produtos.forEach(prod => {
      const nomeProduto = prod.nome_produto || prod.nome || prod.name || '';
      if (nomeProduto) {
        const option = document.createElement('option');
        option.value = nomeProduto;
        datalist.appendChild(option);
        if (baseDatalist) {
          const optionBase = document.createElement('option');
          optionBase.value = nomeProduto;
          baseDatalist.appendChild(optionBase);
        }
      }
    });
    
    if (produtos.length > 0) {
      console.log('Carregados ' + produtos.length + ' produtos para sugestao de despacho');
    } else {
      console.warn('Nenhum produto encontrado para sugestao');
    }
  } catch (e) {
    console.error('Erro ao carregar produtos para despacho:', e);
  }
}

function adicionarItemDespacho() {
  const nomeInput = document.getElementById('edit-despacho-item-nome');
  const qtdInput = document.getElementById('edit-despacho-item-qtd');

  
  if (!nomeInput || !qtdInput) return;
  
  const nome = nomeInput.value.trim();
  const qtd = parseInt(qtdInput.value, 10);
  
  if (!nome) {
    alert('Digite o nome do item.');
    return;
  }
  if (isNaN(qtd) || qtd < 1) {
    alert('Digite uma quantidade válida.');
    return;
  }
  
  // Usa o mesmo ID de retirada manual para todos os itens da mesma O.S.
  const idRetirada = obterIdRetiradaManualDespacho();
  
  despachoItens.push({ nome, quantidade: qtd, id_retirada: idRetirada });
  nomeInput.value = '';
  qtdInput.value = '';
  renderizarTabelaItensDespacho();
}

function removerItemDespacho(index) {
  if (index < 0 || index >= despachoItens.length) return;
  
  const item = despachoItens[index];
  
  // Só permite remover itens manuais (que começam com MANU)
  const ehItemManual = item.id_retirada && item.id_retirada.startsWith('MANU');
  
  if (!ehItemManual) {
    alert('Este item foi carregado de uma retirada anterior e não pode ser removido aqui.\n\nPara remover, realize uma devolução no estoque.');
    return;
  }
  
  despachoItens.splice(index, 1);
  renderizarTabelaItensDespacho();
}

function retirarGrupoDespacho(index) {
  if (index < 0 || index >= despachoItens.length) return;

  const item = despachoItens[index];
  const idRetirada = item.id_retirada;

  if (!idRetirada || idRetirada.startsWith('MANU')) {
    removerItemDespacho(index);
    return;
  }

  const totalAntes = despachoItens.length;
  const itensDaMesmaRetirada = despachoItens.filter(despachoItem => despachoItem.id_retirada === idRetirada);
  despachoItens = despachoItens.filter(despachoItem => despachoItem.id_retirada !== idRetirada);
  renderizarTabelaItensDespacho();

  alert('Todos os itens da retirada ' + idRetirada + ' foram removidos juntos do despacho.\n\nItens removidos: ' + itensDaMesmaRetirada.length);
  console.log('Retirada ' + idRetirada + ' removida do despacho (' + itensDaMesmaRetirada.length + ' item(ns), total antes: ' + totalAntes + ')');
}

// ============================================================
//  BUSCAR ITENS DE RETIRADA
// ============================================================

function mostrarFeedbackRetirada(msg, tipo = 'info') {
  const el = document.getElementById('feedback-carregamento-retirada');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.style.color = tipo === 'sucesso' ? '#4caf50' : (tipo === 'erro' ? '#e74c3c' : '#666');
  el.style.fontWeight = tipo === 'sucesso' || tipo === 'erro' ? 'bold' : 'normal';
}

async function testarConexaoAPI() {
  try {
    if (!window.TUNNEL_API_URL) {
      window.TUNNEL_API_URL = 'http://127.0.0.1:5000';
    }
    
    let baseUrl = window.TUNNEL_API_URL;
    if (!baseUrl.endsWith('/')) baseUrl += '/';
    const url = baseUrl + 'modulos'; // tenta endpoint que sempre existe
    
    console.log('Testando conectividade com:', url);
    
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Teste de conexao:', resp.status, resp.statusText);
    return true;
  } catch (e) {
    console.error('Teste de conexao falhou:', e.message);
    return false;
  }
}

async function buscarItensRetirada(idRetirada) {
  if (!idRetirada || !idRetirada.trim()) {
    alert('Digite o ID da retirada.');
    return;
  }
  
  mostrarFeedbackRetirada('Buscando retirada...');
  
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      mostrarFeedbackRetirada('Sessão expirada. Faça login novamente.', 'erro');
      return;
    }
    
    // Garante que TUNNEL_API_URL está definido
    if (!window.TUNNEL_API_URL) {
      window.TUNNEL_API_URL = 'http://127.0.0.1:5000';
    }
    
    // Constrói a URL manualmente
    let baseUrl = window.TUNNEL_API_URL;
    if (!baseUrl.endsWith('/')) baseUrl += '/';
    const url = baseUrl + 'retiradas';
    
    console.log('Buscando retiradas em:', url);
    console.log('Token presente:', !!token);
    
    // Tenta buscar sem o interceptor de fetch (usando timeout curto para evitar travamento)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 segundos de timeout
    
    const resp = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
    });
    
    clearTimeout(timeout);
    
    console.log('Resposta HTTP:', resp.status, resp.statusText);
    
    if (!resp.ok) {
      if (resp.status === 401) {
        mostrarFeedbackRetirada('Token inválido ou expirado. Faça login novamente.', 'erro');
        localStorage.removeItem('token');
        return;
      }
      mostrarFeedbackRetirada('Erro ao buscar retiradas: ' + resp.status, 'erro');
      console.error('Erro HTTP ' + resp.status + ':', resp);
      return;
    }
    
    const data = await resp.json();
    
    // Extrai o array de retiradas - o servidor retorna { retiradas: [...], total: N }
    const todasRetiradas = data?.retiradas || (Array.isArray(data) ? data : []);
    
    console.log('Retiradas recebidas:', todasRetiradas.length);
    
    if (!Array.isArray(todasRetiradas) || todasRetiradas.length === 0) {
      mostrarFeedbackRetirada('Nenhuma retirada encontrada no sistema.', 'erro');
      return;
    }
    
    // Procura a retirada com o ID especificado
    // ATENÇÃO: o campo é 'id_retirada' (com underscore), não 'id'
    const retiradasBuscadas = todasRetiradas.filter(r => 
      (r.id_retirada && String(r.id_retirada).trim() === idRetirada.trim())
    );
    
    console.log('Retiradas encontradas com ID:', retiradasBuscadas.length);
    
    if (retiradasBuscadas.length === 0) {
      mostrarFeedbackRetirada('Retirada com ID "' + idRetirada + '" nao encontrada.', 'erro');
      const idsDisponiveis = todasRetiradas.map(r => r.id_retirada).slice(0, 5).join(', ');
      console.log('IDs disponíveis (primeiros 5):', idsDisponiveis);
      return;
    }
    
    // Agrupa os itens por produto (pode haver múltiplas linhas da mesma retirada com produtos diferentes)
    const itensMap = {};
    retiradasBuscadas.forEach(ret => {
      const produto = ret.produto || '';
      const qtd = parseInt(ret.quantidade || 0, 10);
      if (produto && qtd > 0) {
        if (itensMap[produto]) {
          itensMap[produto] += qtd; // Soma quantidades do mesmo produto
        } else {
          itensMap[produto] = qtd;
        }
      }
    });
    
    // Converte para array de itens
    const itensACarregar = Object.entries(itensMap).map(([nome, quantidade]) => ({
      nome,
      quantidade,
    }));
    
    console.log('Itens extraidos:', itensACarregar);
    
    if (itensACarregar.length === 0) {
      mostrarFeedbackRetirada('Retirada ' + idRetirada + ' nao possui itens validos.', 'aviso');
      return;
    }
    
    // Carrega os itens
    let totalCarregado = 0;
    
    itensACarregar.forEach(item => {
      const nomeItem = item.nome.trim();
      const qtdItem = item.quantidade;
      
      if (nomeItem && qtdItem > 0) {
        // Verifica se item já existe (evita duplicatas)
        const jaExiste = despachoItens.some(i => i.nome.toLowerCase() === nomeItem.toLowerCase());
        if (!jaExiste) {
          despachoItens.push({
            nome: nomeItem,
            quantidade: qtdItem,
            id_retirada: idRetirada,
          });
          totalCarregado++;
          console.log('Item adicionado: ' + nomeItem + ' (' + qtdItem + ')');
        } else {
          console.log('Item ja existe: ' + nomeItem);
        }
      }
    });
    
    if (totalCarregado === 0) {
      mostrarFeedbackRetirada('Nenhum item novo foi adicionado (possiveis duplicatas).', 'aviso');
      return;
    }
    
    renderizarTabelaItensDespacho();
    mostrarFeedbackRetirada(totalCarregado + ' item(ns) carregado(s) da retirada ' + idRetirada + '.', 'sucesso');
  } catch (e) {
    console.error('Erro ao buscar retirada:', e);
    console.error('Nome do erro:', e.name);
    console.error('Mensagem:', e.message);
    console.error('Stack:', e.stack);
    
    if (e.name === 'AbortError') {
      mostrarFeedbackRetirada('Timeout: servidor não respondeu em tempo. Tente novamente.', 'erro');
    } else {
      mostrarFeedbackRetirada('Erro: ' + (e.message || 'Falha ao buscar retirada. Verifique sua conexao.'), 'erro');
    }
  }
}

function iniciarEscaneamentoQR() {
  // Verifica se o navegador suporta camera
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Seu navegador não suporta acesso à câmera.');
    return;
  }
  
  const idInput = document.getElementById('edit-despacho-id-retirada');
  
  // Cria um container temporário para o scanner
  let scanner = document.getElementById('qr-scanner-container');
  if (!scanner) {
    scanner = document.createElement('div');
    scanner.id = 'qr-scanner-container';
    scanner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 99999;
    `;
    document.body.appendChild(scanner);
  }
  
  scanner.innerHTML = `
    <div style="position: relative; width: 300px; height: 300px; border: 2px solid #4caf50; border-radius: 8px; overflow: hidden;">
      <video id="qr-video" style="width: 100%; height: 100%; object-fit: cover;"></video>
    </div>
    <p style="color: white; margin-top: 20px; text-align: center;">Aponte a câmera para o QR Code da Retirada</p>
    <button id="btn-cancelar-scanner" style="margin-top: 20px; padding: 10px 20px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
  `;
  
  const video = document.getElementById('qr-video');
  const btnCancelar = document.getElementById('btn-cancelar-scanner');
  
  btnCancelar.addEventListener('click', () => {
    scanner.remove();
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
  });
  
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      video.srcObject = stream;
      
      // Simples detecção de padrão QR (em produção, use biblioteca como jsQR)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const detectar = () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          
          // Aqui você poderia usar jsQR() se incluir a biblioteca
          // Por enquanto, usamos um placeholder
          // Em produção: const code = jsQR(imageData.data, canvas.width, canvas.height);
        }
        requestAnimationFrame(detectar);
      };
      detectar();
      
      // Timeout de 30 segundos
      setTimeout(() => {
        if (scanner.parentElement) {
          alert('Tempo limite do scanner excedido. Tente novamente.');
          scanner.remove();
          if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
          }
        }
      }, 30000);
    })
    .catch(err => {
      console.error('Erro ao acessar câmera:', err);
      alert('Não foi possível acessar a câmera. Verifique as permissões.');
      scanner.remove();
    });
  
  mostrarFeedbackRetirada('Scanner de QR aberto. Escaneie ou digite o ID manualmente.', 'info');
}

const CHAVE_ULTIMA_ETAPA_MODAL_OS = 'os_ultima_etapa_modal';
const CHAVE_ULTIMO_PONTO_MODAL_OS = 'os_ultimo_ponto_modal';
let etapaModalAtual = 1;
let ultimaEtapaModalVisualizada = (() => {
  try {
    const valor = Number(localStorage.getItem(CHAVE_ULTIMA_ETAPA_MODAL_OS) || '1');
    return Math.min(5, Math.max(1, valor));
  } catch {
    return 1;
  }
})();
let ultimoPontoModalVisualizado = (() => {
  try {
    const valor = Number(localStorage.getItem(CHAVE_ULTIMO_PONTO_MODAL_OS) || '0');
    return Number.isFinite(valor) ? Math.max(0, Math.floor(valor)) : 0;
  } catch {
    return 0;
  }
})();

function atualizarResumoDadosOSModal() {
  const resumo = document.getElementById('edit-os-dados-resumo');
  if (!resumo) return;

  const responsavel = despachoResponsaveis.length
    ? despachoResponsaveis.join(', ')
    : 'Nao informado';
  const prioridade = document.getElementById('edit-os-prioridade')?.value || 'Nao informada';
  const descricaoBruta = document.getElementById('edit-os-descricao')?.value.trim() || 'Nao informada';
  const descricao = descricaoBruta.length > 140 ? `${descricaoBruta.slice(0, 140)}...` : descricaoBruta;

  resumo.innerHTML = `
    <div><strong>Responsável da equipe:</strong> ${escapeHtml(responsavel)}</div>
    <div><strong>Prioridade:</strong> ${escapeHtml(prioridade)}</div>
    <div><strong>Descrição do serviço:</strong> ${escapeHtml(descricao)}</div>
  `;
}

function atualizarMinimizacaoDadosOSModal() {
  const blocoDados = document.getElementById('edit-os-dados-cabecalho');
  const resumo = document.getElementById('edit-os-dados-resumo');
  if (!blocoDados || !resumo) return;

  const minimizado = etapaModalAtual > 1;
  blocoDados.style.display = minimizado ? 'none' : '';
  resumo.style.display = minimizado ? 'block' : 'none';
  if (minimizado) {
    atualizarResumoDadosOSModal();
  }
}

function irParaEtapaModal(etapa) {
  const etapaAnterior = etapaModalAtual;
  etapaModalAtual = Math.min(5, Math.max(1, etapa));
  ultimaEtapaModalVisualizada = etapaModalAtual;
  try {
    localStorage.setItem(CHAVE_ULTIMA_ETAPA_MODAL_OS, String(ultimaEtapaModalVisualizada));
  } catch {
    // Ignora falha de persistencia (ex.: modo privado/restricao de armazenamento).
  }

  // Auto-salva relatório ao sair da etapa 5
  if (etapaAnterior === 5 && etapaModalAtual !== 5) {
    salvarFechamentoOS('salvar', true);
  }
  document.querySelectorAll('.modal-etapa').forEach(bloco => {
    const n = Number(bloco.getAttribute('data-etapa') || '1');
    bloco.style.display = n === etapaModalAtual ? 'block' : 'none';
  });
  document.querySelectorAll('.modal-etapa-pill').forEach(pill => {
    const n = Number(pill.getAttribute('data-etapa') || '1');
    pill.classList.toggle('active', n === etapaModalAtual);
  });

  const btnAnterior = document.getElementById('btn-etapa-anterior');
  const btnProxima = document.getElementById('btn-etapa-proxima');
  if (btnAnterior) btnAnterior.disabled = etapaModalAtual === 1;
  if (btnProxima) btnProxima.disabled = etapaModalAtual === 5;

  if (etapaModalAtual === 5) {
    popularItensUtilizados();
  }

  const tituloEtapa = document.getElementById('edit-os-titulo-etapa');
  if (tituloEtapa) {
    tituloEtapa.textContent = etapaModalAtual === 2 ? 'Despacho de Veiculo' : 'Despacho da Equipe';
  }

  const legendaTecnico = document.getElementById('edit-os-tecnico-legenda');
  if (legendaTecnico) {
    legendaTecnico.style.display = etapaModalAtual === 1 ? '' : 'none';
  }

  atualizarMinimizacaoDadosOSModal();
}

function renderizarMateriaisLista() {
  const lista = document.getElementById('fech-materiais-lista');
  if (!lista) return;
  if (materiaisAdicionados.length === 0) {
    lista.innerHTML = '<p style="color:#999;font-size:13px;">Nenhum material adicionado.</p>';
    return;
  }
  const linhas = materiaisAdicionados.map((m, i) => `
    <tr>
      <td style="padding:8px; border:1px solid #ddd;">${escapeHtml(m.nome)}</td>
      <td style="padding:8px; text-align:center; border:1px solid #ddd; width:100px;">${m.quantidade}</td>
      <td style="padding:8px; text-align:center; border:1px solid #ddd; width:80px;">
        <button type="button" data-remove-idx="${i}" style="background:#e74c3c; color:#fff; border:none; border-radius:4px; padding:4px 10px; cursor:pointer; font-size:12px;">Remover</button>
      </td>
    </tr>`).join('');
  lista.innerHTML = `
    <table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:4px;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px; text-align:left; border:1px solid #ddd;">Material</th>
          <th style="padding:8px; text-align:center; border:1px solid #ddd;">Quantidade</th>
          <th style="padding:8px; border:1px solid #ddd;"></th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>`;
}

function renderizarBaseMateriaisLista() {
  const lista = document.getElementById('base-materiais-lista');
  if (!lista) return;
  if (materiaisBasesAdicionados.length === 0) {
    lista.innerHTML = '<p style="color:#999;font-size:13px;">Nenhum material adicionado.</p>';
    return;
  }

  const linhas = materiaisBasesAdicionados.map((m, i) => `
    <tr>
      <td>${escapeHtml(m.nome)}</td>
      <td style="text-align:center;">${m.quantidade}</td>
      <td style="text-align:center;">${escapeHtml(m.unidade)}</td>
      <td style="text-align:center;"><button type="button" data-remove-base-idx="${i}">Remover</button></td>
    </tr>`).join('');

  lista.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Material</th>
          <th>Quantidade</th>
          <th>Unidade</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>`;
}

function adicionarMaterialBase() {
  const nomeEl = document.getElementById('base-material-nome');
  const qtdEl = document.getElementById('base-material-qtd');
  const unidadeEl = document.getElementById('base-material-unidade');
  if (!nomeEl || !qtdEl || !unidadeEl) return;

  const nome = nomeEl.value.trim();
  const quantidade = parseFloat(qtdEl.value);
  const unidade = unidadeEl.value.trim();

  if (!nome) { alert('Informe o material.'); return; }
  if (isNaN(quantidade) || quantidade <= 0) { alert('Informe uma quantidade válida.'); return; }
  if (!unidade) { alert('Informe a unidade de medida.'); return; }

  materiaisBasesAdicionados.push({ nome, quantidade, unidade });
  nomeEl.value = '';
  qtdEl.value = '';
  unidadeEl.value = '';
  renderizarBaseMateriaisLista();
}

function removerMaterialBase(index) {
  materiaisBasesAdicionados.splice(index, 1);
  renderizarBaseMateriaisLista();
}

function formatarBytes(bytes) {
  if (bytes === 0) return '0 B';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  const expoente = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, expoente)).toFixed(1)} ${unidades[expoente]}`;
}

function atualizarPreviewBaseFotos() {
  const preview = document.getElementById('base-fotos-preview');
  if (!preview) return;
  if (baseFotosFiles.length === 0) {
    preview.innerHTML = '<p>Nenhuma foto adicionada.</p>';
    return;
  }
  preview.innerHTML = baseFotosFiles.map((item, index) => {
    const url = URL.createObjectURL(item.file);
    return `
      <div class="base-file-thumb" data-base-foto-item-index="${index}">
        <button type="button" class="base-file-remove" data-base-foto-index="${index}" title="Remover foto">×</button>
        <img src="${url}" alt="${escapeHtml(item.file.name)}">
        <span>${escapeHtml(item.file.name)}</span>
        ${item.caption ? `<span class="base-file-caption">${escapeHtml(item.caption)}</span>` : ''}
      </div>`;
  }).join('');
}

function atualizarPreviewBaseDocs() {
  const preview = document.getElementById('base-docs-preview');
  if (!preview) return;
  if (baseDocsFiles.length === 0) {
    preview.innerHTML = '<p>Nenhum documento adicionado.</p>';
    return;
  }
  preview.innerHTML = baseDocsFiles.map((item, index) => `
    <div class="base-doc-item" data-base-doc-item-index="${index}">
      <div class="base-doc-info">
        <span class="base-doc-icon">📄</span>
        <div class="base-doc-meta">
          <span class="base-doc-name">${escapeHtml(item.file.name)}</span>
          <span class="base-doc-size">${formatarBytes(item.file.size)}</span>
          ${item.caption ? `<span class="base-file-caption">${escapeHtml(item.caption)}</span>` : ''}
        </div>
      </div>
      <button type="button" class="base-file-remove" data-base-doc-index="${index}" title="Remover documento">×</button>
    </div>`).join('');
}

function adicionarBaseFotos(files) {
  if (!files || files.length === 0) return;
  Array.from(files).forEach(file => {
    const existe = baseFotosFiles.some(item => item.file.name === file.name && item.file.size === file.size);
    if (!existe) baseFotosFiles.push({ file, caption: '' });
  });
  atualizarPreviewBaseFotos();
}

function adicionarBaseDocumentos(files) {
  if (!files || files.length === 0) return;
  Array.from(files).forEach(file => {
    const existe = baseDocsFiles.some(item => item.file.name === file.name && item.file.size === file.size);
    if (!existe) baseDocsFiles.push({ file, caption: '' });
  });
  atualizarPreviewBaseDocs();
}

function removerBaseFoto(index) {
  baseFotosFiles.splice(index, 1);
  atualizarPreviewBaseFotos();
}

function removerBaseDoc(index) {
  baseDocsFiles.splice(index, 1);
  atualizarPreviewBaseDocs();
}

function abrirModalBasePreview(tipo, index) {
  const modal = document.getElementById('base-file-preview-modal');
  const previewMedia = document.getElementById('preview-media');
  const previewName = document.getElementById('preview-file-name');
  const previewSize = document.getElementById('preview-file-size');
  const previewCaption = document.getElementById('preview-file-caption');
  const downloadButton = document.getElementById('preview-download');
  const deleteButton = document.getElementById('preview-delete');
  if (!modal || !previewMedia || !previewName || !previewSize || !previewCaption || !downloadButton || !deleteButton) return;

  const item = tipo === 'foto' ? baseFotosFiles[index] : baseDocsFiles[index];
  if (!item) return;
  const file = item.file;
  const url = URL.createObjectURL(file);

  previewMedia.innerHTML = file.type.startsWith('image/')
    ? `<img src="${url}" alt="${escapeHtml(file.name)}" class="preview-expanded-image">`
    : `<div class="preview-doc-file"><span class="base-doc-icon">📄</span><div><strong>${escapeHtml(file.name)}</strong><p>${escapeHtml(file.type || 'Documento')}</p></div></div>`;

  previewName.textContent = file.name;
  previewSize.textContent = formatarBytes(file.size);
  previewCaption.value = item.caption || '';
  downloadButton.dataset.downloadUrl = url;

  basePreviewState = { tipo, index, url };
  modal.style.display = 'flex';
}

function fecharModalBasePreview() {
  const modal = document.getElementById('base-file-preview-modal');
  if (!modal) return;
  if (basePreviewState?.url) URL.revokeObjectURL(basePreviewState.url);
  basePreviewState = null;
  modal.style.display = 'none';
}

function salvarPreviewCaption() {
  if (!basePreviewState) return;
  const captionInput = document.getElementById('preview-file-caption');
  if (!captionInput) return;
  const { tipo, index } = basePreviewState;
  const item = tipo === 'foto' ? baseFotosFiles[index] : baseDocsFiles[index];
  if (!item) return;
  item.caption = captionInput.value.trim();
  if (tipo === 'foto') atualizarPreviewBaseFotos(); else atualizarPreviewBaseDocs();
}

function baixarPreviewArquivo() {
  if (!basePreviewState) return;
  const { tipo, index } = basePreviewState;
  const item = tipo === 'foto' ? baseFotosFiles[index] : baseDocsFiles[index];
  if (!item) return;
  const url = URL.createObjectURL(item.file);
  const a = document.createElement('a');
  a.href = url;
  a.download = item.file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function excluirPreviewArquivo() {
  if (!basePreviewState) return;
  const { tipo, index } = basePreviewState;
  if (tipo === 'foto') removerBaseFoto(index);
  else removerBaseDoc(index);
  fecharModalBasePreview();
}

function adicionarMaterialUtilizado() {
  const nomeEl = document.getElementById('fech-material-nome');
  const qtdEl = document.getElementById('fech-material-qtd');
  const nome = nomeEl?.value.trim();
  const quantidade = parseFloat(qtdEl?.value) || 0;
  if (!nome) { alert('Informe o nome do material.'); return; }

  const itemDespacho = despachoItens.find(i => i.nome.toLowerCase() === nome.toLowerCase());
  if (!itemDespacho) {
    alert(`"${nome}" não foi despachado. Selecione um item da lista de despacho.`);
    return;
  }

  if (quantidade <= 0) { alert('Informe uma quantidade válida.'); return; }
  if (quantidade > itemDespacho.quantidade) {
    alert(`Quantidade máxima disponível para "${itemDespacho.nome}" é ${itemDespacho.quantidade}.`);
    return;
  }

  materiaisAdicionados.push({ nome: itemDespacho.nome, quantidade });
  nomeEl.value = '';
  qtdEl.value = '1';
  renderizarMateriaisLista();
}

function removerMaterialUtilizado(index) {
  materiaisAdicionados.splice(index, 1);
  renderizarMateriaisLista();
}

function popularItensUtilizados() {
  // Atualiza sugestões do datalist com itens do despacho
  const datalist = document.getElementById('fech-material-sugestoes');
  if (datalist) {
    datalist.innerHTML = despachoItens
      .map(i => `<option value="${escapeHtml(i.nome)}">`)
      .join('');
  }
  renderizarMateriaisLista();
}

function coletarDadosFechamento() {
  return {
    diagnostico_equipamento: document.getElementById('fech-diagnostico')?.value.trim() || '',
    procedimento_executado: document.getElementById('fech-procedimento')?.value.trim() || '',
    situacao_final: document.getElementById('fech-situacao')?.value || '',
    itens_utilizados: materiaisAdicionados.length > 0 ? JSON.stringify(materiaisAdicionados) : '',
  };
}

function todosPontosFinalizadosOuCancelados() {
  const selects = Array.from(document.querySelectorAll('#modal-pontos-lista .ponto-status-select, .os-status-ponto-slot .ponto-status-select'));
  if (selects.length === 0) return true;
  return selects.every(sel => {
    const status = String(sel.value || '').trim();
    return status === 'Finalizado' || status === 'Cancelado';
  });
}

function atualizarEstadoBotaoSalvarFechamento() {
  const botaoSalvar = document.getElementById('btn-salvar-fechamento');
  const msgBloqueio = document.getElementById('msg-fechamento-bloqueado');
  if (!botaoSalvar) return;

  const statusAtual = document.getElementById('edit-os-status-atual')?.value || '';
  const situacaoFinal = document.getElementById('fech-situacao')?.value || '';
  const pontosConcluidos = todosPontosFinalizadosOuCancelados();
  const podeFinalizar = statusAtual !== 'Finalizada' && statusAtual !== 'Cancelada' && !!situacaoFinal && pontosConcluidos;

  botaoSalvar.disabled = !podeFinalizar;
  botaoSalvar.classList.toggle('botao-fechamento-bloqueado', !podeFinalizar);
  botaoSalvar.innerHTML = podeFinalizar ? 'Salvar Relatório' : '🔒 Salvar Relatório';
  botaoSalvar.title = podeFinalizar
    ? ''
    : 'Selecione a Situação Final e deixe cada ponto em Finalizado ou Cancelado (pode misturar os dois) para habilitar.';
  if (msgBloqueio) {
    msgBloqueio.textContent = podeFinalizar
      ? ''
      : 'Selecione a Situação Final e deixe cada ponto como Finalizado ou Cancelado; pode ter alguns Finalizado e outros Cancelado.';
    msgBloqueio.style.display = podeFinalizar ? 'none' : 'block';
  }
}

async function salvarFechamentoOS(acao = 'salvar', silencioso = false) {
  const id = document.getElementById('edit-os-id')?.value;
  if (!id) return;

  const dados = coletarDadosFechamento();

  if (!silencioso && acao === 'finalizar') {
    if (!dados.situacao_final) {
      alert('Informe a Situação Final antes de finalizar.');
      return;
    }
    if (!confirm('Tem certeza que deseja finalizar esta O.S.? O status será alterado para "Finalizada".')) return;
  }

  try {
    const resp = await fetch(osApiUrl(`ordens/fechamento/${id}`), {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify({ acao, ...dados }),
    });
    const data = await resp.json();
    if (!resp.ok || data.status !== 'ok') {
      if (!silencioso) alert(data.mensagem || 'Erro ao salvar relatório.');
      return;
    }
    if (!silencioso) {
      alert(data.mensagem || 'Fechamento salvo com sucesso!');
      await recarregarDadosOrdemModal(id);
      carregarDashboard();
      buscarOrdens();
    }
    if (acao === 'finalizar') {
      document.getElementById('modal-editar-os').style.display = 'none';
    }
  } catch (e) {
    console.error(e);
    if (!silencioso) alert('Falha ao salvar relatório da O.S.');
  }
}

function escapeHtml(texto = '') {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
//  CRONOGRAMA DE SERVIÇO
// ============================================================

let cronogramaEditandoId = null;
let cronogramaOrdensCache = [];
let cronogramaVeiculosCache = [];
let cronogramaLocaisCache = [];

function badgeStatusAgendamento(status) {
  const cores = {
    'Pendente':     { bg: '#ffb300', txt: '#222' },
    'Em Andamento': { bg: '#2196f3', txt: '#fff' },
    'Concluído':    { bg: '#4caf50', txt: '#fff' },
    'Cancelado':    { bg: '#9e9e9e', txt: '#fff' },
  };
  const c = cores[status] || { bg: '#757575', txt: '#fff' };
  return `<span class="os-badge" style="background:${c.bg};color:${c.txt};">${status}</span>`;
}

async function carregarOrdensParaSelectAgendamento() {
  const select = document.getElementById('agendamento-os');
  if (!select) return;
  try {
    const resp = await fetch(osApiUrl('ordens'), { headers: authHeaders() });
    const data = await resp.json();
    cronogramaOrdensCache = (data.ordens || []);
  } catch (e) {
    console.warn('Falha ao carregar O.S. para o cronograma:', e);
  }
  select.innerHTML = '<option value="">Nenhuma O.S. vinculada</option>' +
    cronogramaOrdensCache.map(os => `<option value="${os.id}">${escapeHtml(os.numero_os)} · ${escapeHtml(os.solicitante || '')}</option>`).join('');
}

async function carregarVeiculosParaSelectAgendamento() {
  const select = document.getElementById('agendamento-veiculo');
  if (!select) return;
  try {
    const resp = await fetch(osApiUrl('frota/veiculos'), { headers: authHeaders() });
    const data = await resp.json();
    cronogramaVeiculosCache = (data.veiculos || []);
  } catch (e) {
    console.warn('Falha ao carregar veículos para o cronograma:', e);
  }
  select.innerHTML = '<option value="">Selecione o veículo alocado...</option>' +
    cronogramaVeiculosCache.map(v => `<option value="${v.id}">${escapeHtml(v.placa)} · ${escapeHtml(v.modelo)}</option>`).join('');
}

async function carregarLocaisParaSelectAgendamento() {
  const select = document.getElementById('agendamento-local');
  if (!select) return;
  try {
    const resp = await fetch(osApiUrl('locais'), { headers: authHeaders() });
    const data = await resp.json();
    cronogramaLocaisCache = (data.locais || []);
  } catch (e) {
    console.warn('Falha ao carregar bases para o cronograma:', e);
  }
  select.innerHTML = '<option value="">Selecione local / base...</option>' +
    cronogramaLocaisCache.map(l => {
      const rotulo = [l.endereco, l.complemento].filter(Boolean).join(' · ') || l.nome || ('Base #' + l.id);
      return `<option value="${l.id}">${escapeHtml(rotulo)}</option>`;
    }).join('');
}

function dataISOParaBR(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function dataBRParaISO(br) {
  if (!br) return '';
  const [dia, mes, ano] = br.split('/');
  return `${ano}-${mes}-${dia}`;
}

async function carregarCronograma() {
  const lista = document.getElementById('cronograma-lista');
  if (!lista) return;
  lista.innerHTML = '<div class="carregando-inline" role="status"><span class="carregando-inline-logo"></span><span class="carregando-inline-texto">Carregando...</span></div>';

  const dataFiltro = document.getElementById('cronograma-filtro-data')?.value;
  const url = dataFiltro ? osApiUrl(`agendamentos?data=${dataFiltro}`) : osApiUrl('agendamentos');

  try {
    const resp = await fetch(url, { headers: authHeaders() });
    const data = await resp.json();
    if (!resp.ok || data.status !== 'ok') {
      lista.innerHTML = `<p class="cronograma-vazio">${data.mensagem || 'Erro ao carregar cronograma.'}</p>`;
      return;
    }
    const agenda = data.agendamentos || [];
    if (!agenda.length) {
      lista.innerHTML = '<p class="cronograma-vazio">Nenhum agendamento para este filtro.</p>';
      return;
    }
    const icone = (d) => `<svg class="cronograma-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const ICONES = {
      hora:    icone('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
      veiculo: icone('<path d="M3 13l2-5h11l3 5"/><path d="M3 13h18v4H3z"/><circle cx="7" cy="17" r="1.6"/><circle cx="17" cy="17" r="1.6"/>'),
      local:   icone('<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>'),
      pessoa:  icone('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5"/>'),
    };
    const classeTag = (v) => 'tag-' + String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-');
    lista.innerHTML = agenda.map(a => `
      <div class="cronograma-item" data-id="${a.id}">
        <div class="cronograma-item-topo">
          <div class="cronograma-item-tags">
            ${a.numero_os ? `<span class="cronograma-os">${escapeHtml(a.numero_os)}</span>` : ''}
            <span class="cronograma-data">${escapeHtml(a.data_agendada || '')}</span>
          </div>
          <div class="cronograma-item-tags">
            <span class="cronograma-tag ${classeTag(a.prioridade)}">${escapeHtml(a.prioridade || '')}</span>
            <span class="cronograma-tag ${classeTag(a.status)}">${escapeHtml(a.status || '')}</span>
          </div>
        </div>
        <div class="cronograma-item-titulo">${escapeHtml(a.titulo)}</div>
        <div class="cronograma-item-meta">
          <span>${ICONES.hora}${a.hora_inicio} às ${a.hora_fim}</span>
          ${a.veiculo_placa ? `<span>${ICONES.veiculo}<strong>${escapeHtml(a.veiculo_placa)}</strong></span>` : ''}
          ${a.local_endereco ? `<span>${ICONES.local}${escapeHtml(a.local_endereco)}</span>` : ''}
          <span>${ICONES.pessoa}${escapeHtml(a.responsavel_tecnico)}</span>
        </div>
        ${a.observacoes ? `<div class="cronograma-item-obs">${escapeHtml(a.observacoes)}</div>` : ''}
        <div class="cronograma-item-acoes">
          <button type="button" class="btn-editar-agendamento" data-id="${a.id}" title="Editar"><svg class="icone-acao" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg></button>
          <button type="button" class="btn-excluir-agendamento" data-id="${a.id}" title="Excluir"><svg class="icone-acao" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg></button>
        </div>
      </div>
    `).join('');

    lista.querySelectorAll('.btn-editar-agendamento').forEach(btn => {
      btn.addEventListener('click', () => abrirPainelAgendamento(Number(btn.dataset.id)));
    });
    lista.querySelectorAll('.btn-excluir-agendamento').forEach(btn => {
      btn.addEventListener('click', () => excluirAgendamento(Number(btn.dataset.id)));
    });
  } catch (e) {
    console.error('Erro ao carregar cronograma:', e);
    lista.innerHTML = '<p class="cronograma-vazio">Erro de conexão ao carregar o cronograma.</p>';
  }
}

async function abrirPainelAgendamento(id) {
  const titulo = document.getElementById('cronograma-painel-titulo');
  document.getElementById('form-agendamento')?.reset();
  cronogramaEditandoId = id || null;

  await Promise.all([
    carregarOrdensParaSelectAgendamento(),
    carregarVeiculosParaSelectAgendamento(),
    carregarLocaisParaSelectAgendamento(),
  ]);

  if (id) {
    if (titulo) titulo.textContent = 'Editar agendamento operacional';
    try {
      const resp = await fetch(osApiUrl(`agendamentos/${id}`), { headers: authHeaders() });
      const data = await resp.json();
      if (data.status === 'ok') {
        const a = data.agendamento;
        document.getElementById('agendamento-id').value = a.id;
        document.getElementById('agendamento-titulo').value = a.titulo || '';
        document.getElementById('agendamento-os').value = a.ordem_servico_id || '';
        document.getElementById('agendamento-data').value = dataBRParaISO(a.data_agendada);
        document.getElementById('agendamento-hora-inicio').value = a.hora_inicio || '';
        document.getElementById('agendamento-hora-fim').value = a.hora_fim || '';
        document.getElementById('agendamento-veiculo').value = a.veiculo_id || '';
        document.getElementById('agendamento-responsavel').value = a.responsavel_tecnico || '';
        document.getElementById('agendamento-local').value = a.local_id || '';
        document.getElementById('agendamento-prioridade').value = a.prioridade || 'Média';
        document.getElementById('agendamento-status').value = a.status || 'Pendente';
        document.getElementById('agendamento-obs').value = a.observacoes || '';
      }
    } catch (e) {
      console.error('Erro ao carregar agendamento:', e);
    }
  } else {
    if (titulo) titulo.textContent = 'Novo agendamento operacional';
  }

  const feedback = document.getElementById('agendamento-feedback');
  if (feedback) { feedback.style.display = 'none'; feedback.textContent = ''; }

  abrirCadastroOS('os-sub-agendamento', 'agendamento-titulo');
}

// Depois de salvar (ou desistir), volta para a lista do cronograma.
function fecharPainelAgendamento() {
  cronogramaEditandoId = null;
  irParaAbaOS('cronograma');
}

async function salvarAgendamento(e) {
  e.preventDefault();
  const feedback = document.getElementById('agendamento-feedback');
  feedback.style.display = 'none';

  const payload = {
    titulo: document.getElementById('agendamento-titulo').value.trim(),
    ordem_servico_id: document.getElementById('agendamento-os').value || null,
    data_agendada: document.getElementById('agendamento-data').value,
    hora_inicio: document.getElementById('agendamento-hora-inicio').value,
    hora_fim: document.getElementById('agendamento-hora-fim').value,
    veiculo_id: document.getElementById('agendamento-veiculo').value || null,
    responsavel_tecnico: document.getElementById('agendamento-responsavel').value.trim(),
    local_id: document.getElementById('agendamento-local').value || null,
    prioridade: document.getElementById('agendamento-prioridade').value,
    status: document.getElementById('agendamento-status').value,
    observacoes: document.getElementById('agendamento-obs').value.trim(),
  };

  try {
    const url = cronogramaEditandoId ? osApiUrl(`agendamentos/${cronogramaEditandoId}`) : osApiUrl('agendamentos');
    const metodo = cronogramaEditandoId ? 'PUT' : 'POST';
    const resp = await fetch(url, { method: metodo, headers: authHeaders(true), body: JSON.stringify(payload) });
    const data = await resp.json();
    if (!resp.ok || data.status !== 'ok') {
      feedback.className = 'gestao-feedback erro';
      feedback.textContent = data.mensagem || 'Erro ao salvar agendamento.';
      feedback.style.display = 'block';
      return;
    }
    const editando = Boolean(cronogramaEditandoId);
    fecharPainelAgendamento();
    avisoRapidoOS(editando ? 'Agendamento atualizado.' : 'Agendamento criado.');
  } catch (err) {
    console.error(err);
    feedback.className = 'gestao-feedback erro';
    feedback.textContent = 'Falha na comunicação com o servidor.';
    feedback.style.display = 'block';
  }
}

async function excluirAgendamento(id) {
  if (!confirm('Excluir este agendamento do cronograma?')) return;
  try {
    const resp = await fetch(osApiUrl(`agendamentos/${id}`), { method: 'DELETE', headers: authHeaders() });
    const data = await resp.json();
    if (resp.ok && data.status === 'ok') {
      carregarCronograma();
    } else {
      alert(data.mensagem || 'Erro ao excluir agendamento.');
    }
  } catch (e) {
    console.error('Erro ao excluir agendamento:', e);
  }
}

function lerArquivoComoDataURL(arquivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(arquivo);
  });
}

function badgeTipoFoto(tipo) {
  const nomes = {
    inicio: 'Início',
    execucao: 'Execução',
    fechamento: 'Fechamento',
    extra: 'Extra',
  };
  const classe = `foto-tipo-${tipo || 'extra'}`;
  return `<span class="foto-tipo-badge ${classe}">${nomes[tipo] || 'Extra'}</span>`;
}

function obterTipoFotoPadrao(fotos = []) {
  const possuiTipo = tipo => Array.isArray(fotos) && fotos.some(f => f?.tipo === tipo);
  if (!possuiTipo('inicio')) return 'inicio';
  if (!possuiTipo('execucao')) return 'execucao';
  if (!possuiTipo('fechamento')) return 'fechamento';
  return 'extra';
}

function atualizarClasseStatusPonto(selectEl) {
  if (!selectEl) return;
  selectEl.classList.remove(
    'ponto-status-pendente',
    'ponto-status-em-deslocamento',
    'ponto-status-chegada',
    'ponto-status-em-preparo',
    'ponto-status-finalizado',
    'ponto-status-cancelado'
  );

  const mapaClasse = {
    'Pendente': 'ponto-status-pendente',
    'Em Preparo': 'ponto-status-em-preparo',
    'Em Deslocamento': 'ponto-status-em-deslocamento',
    'Chegada no Local': 'ponto-status-chegada',
    'Finalizado': 'ponto-status-finalizado',
    'Cancelado': 'ponto-status-cancelado',
  };

  const classe = mapaClasse[selectEl.value];
  if (classe) selectEl.classList.add(classe);
}

function obterTransicoesStatusPonto(statusAtual = 'Pendente') {
  const status = String(statusAtual || 'Pendente');
  const mapa = {
    'Pendente': ['Pendente', 'Em Preparo', 'Em Deslocamento', 'Cancelado'],
    'Em Preparo': ['Em Preparo', 'Pendente', 'Em Deslocamento', 'Cancelado'],
    'Em Deslocamento': ['Em Deslocamento', 'Chegada no Local', 'Cancelado'],
    'Chegada no Local': ['Chegada no Local', 'Finalizado', 'Cancelado'],
    'Finalizado': ['Finalizado', 'Cancelado'],
    'Cancelado': ['Cancelado'],
  };
  return mapa[status] || [status, 'Cancelado'];
}

function atualizarOpcoesStatusPonto(selectEl) {
  if (!selectEl) return;
  const statusReferencia = String(selectEl.dataset.statusAtual || selectEl.value || 'Pendente');
  const permitidos = new Set(obterTransicoesStatusPonto(statusReferencia));

  // Mantem sempre o status atual visivel/selecionavel para evitar bloqueio da UI.
  permitidos.add(statusReferencia);
  permitidos.add(String(selectEl.value || statusReferencia));

  selectEl.querySelectorAll('option').forEach(opcao => {
    opcao.disabled = !permitidos.has(opcao.value);
  });
}

function normalizarSrcImagem(valor = '') {
  if (!valor) return '';
  return valor.startsWith('data:') ? valor : `data:image/jpeg;base64,${valor}`;
}

function obterTextoLegendaFoto(valor = '') {
  const texto = String(valor || '').trim();
  return texto || 'Sem legenda';
}

let modalFotoPontoEl = null;

function garantirModalFotoPonto() {
  if (modalFotoPontoEl) return modalFotoPontoEl;

  const modal = document.createElement('div');
  modal.className = 'ponto-foto-modal';
  modal.innerHTML = `
    <div class="ponto-foto-modal-backdrop" data-acao="fechar"></div>
    <div class="ponto-foto-modal-dialog" role="dialog" aria-modal="true" aria-label="Visualização da foto do ponto">
      <button type="button" class="ponto-foto-modal-fechar" data-acao="fechar" aria-label="Fechar visualização">×</button>
      <div class="ponto-foto-modal-corpo">
        <img src="" alt="Foto ampliada do ponto" class="ponto-foto-modal-imagem" />
        <img src="../IMG/Logoescura.png" alt="" aria-hidden="true" class="ponto-foto-modal-marca" />
        <div class="ponto-foto-modal-info">
          <button type="button" class="ponto-foto-modal-tags" aria-expanded="false" title="Mostrar legenda e ações">
            <span class="ponto-foto-modal-tipo"></span>
            <span class="ponto-foto-modal-data"></span>
            <span class="ponto-foto-modal-resumo"></span>
            <svg class="ponto-foto-modal-seta" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>
          </button>
          <div class="ponto-foto-modal-detalhes">
          <label class="ponto-foto-modal-label" for="ponto-foto-modal-legenda">Legenda</label>
          <textarea id="ponto-foto-modal-legenda" class="ponto-foto-modal-legenda" rows="3" maxlength="255" placeholder="Digite a legenda da imagem"></textarea>
          <div class="ponto-foto-modal-acoes">
            <button type="button" class="btn-secundario btn-sm ponto-foto-modal-excluir">Excluir</button>
            <button type="button" class="btn-primario btn-sm ponto-foto-modal-salvar">Salvar legenda</button>
          </div>
          </div>
        </div>
      </div>
    </div>
  `;

  modal.querySelector('.ponto-foto-modal-tags')?.addEventListener('click', () => {
    const info = modal.querySelector('.ponto-foto-modal-info');
    const aberto = info.classList.toggle('aberto');
    modal.querySelector('.ponto-foto-modal-tags').setAttribute('aria-expanded', aberto ? 'true' : 'false');
    if (aberto) modal.querySelector('.ponto-foto-modal-legenda')?.focus();
  });

  modal.addEventListener('click', (event) => {
    if (event.target.dataset.acao === 'fechar') {
      fecharModalFotoPonto();
    }
  });

  modal.querySelector('.ponto-foto-modal-salvar')?.addEventListener('click', async () => {
    const fotoId = modal.dataset.fotoId;
    const ordemId = modal.dataset.ordemId;
    const legenda = modal.querySelector('.ponto-foto-modal-legenda')?.value.trim() || '';

    if (!fotoId || !ordemId) return;

    const botaoSalvar = modal.querySelector('.ponto-foto-modal-salvar');
    if (botaoSalvar) botaoSalvar.disabled = true;

    try {
      const resp = await fetch(osApiUrl(`ordens/pontos/fotos/${fotoId}`), {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify({ legenda }),
      });
      const data = await resp.json();
      if (!resp.ok || data.status !== 'ok') {
        alert(data.mensagem || 'Erro ao atualizar a legenda da foto.');
        return;
      }
      fecharModalFotoPonto();
      await recarregarPontosModal(ordemId);
    } catch (e) {
      console.error(e);
      alert('Falha ao atualizar a legenda da foto.');
    } finally {
      if (botaoSalvar) botaoSalvar.disabled = false;
    }
  });

  modal.querySelector('.ponto-foto-modal-excluir')?.addEventListener('click', async () => {
    const fotoId = modal.dataset.fotoId;
    const ordemId = modal.dataset.ordemId;

    if (!fotoId || !ordemId) return;

    // Confirmação no próprio botão: o primeiro clique pede confirmação,
    // o segundo (em até 4 s) exclui. Evita o confirm() do navegador, que
    // alguns navegadores bloqueiam.
    const botaoExcluir = modal.querySelector('.ponto-foto-modal-excluir');
    if (botaoExcluir && botaoExcluir.dataset.confirmar !== '1') {
      botaoExcluir.dataset.confirmar = '1';
      botaoExcluir.textContent = 'Confirmar exclusão';
      botaoExcluir.classList.add('confirmando');
      clearTimeout(botaoExcluir._tempo);
      botaoExcluir._tempo = setTimeout(() => {
        botaoExcluir.dataset.confirmar = '';
        botaoExcluir.textContent = 'Excluir';
        botaoExcluir.classList.remove('confirmando');
      }, 4000);
      return;
    }
    if (botaoExcluir) {
      clearTimeout(botaoExcluir._tempo);
      botaoExcluir.dataset.confirmar = '';
      botaoExcluir.textContent = 'Excluir';
      botaoExcluir.classList.remove('confirmando');
    }

    if (botaoExcluir) botaoExcluir.disabled = true;

    try {
      const resp = await fetch(osApiUrl(`ordens/pontos/fotos/${fotoId}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || data.status !== 'ok') {
        alert(data.mensagem || 'Erro ao excluir foto.');
        return;
      }
      fecharModalFotoPonto();
      await recarregarPontosModal(ordemId);
    } catch (e) {
      console.error(e);
      alert('Falha ao excluir foto do ponto.');
    } finally {
      if (botaoExcluir) botaoExcluir.disabled = false;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('ativo')) {
      fecharModalFotoPonto();
    }
  });

  document.body.appendChild(modal);
  modalFotoPontoEl = modal;
  return modalFotoPontoEl;
}

function abrirModalFotoPonto(dados) {
  const modal = garantirModalFotoPonto();
  const img = modal.querySelector('.ponto-foto-modal-imagem');
  const tipo = modal.querySelector('.ponto-foto-modal-tipo');
  const data = modal.querySelector('.ponto-foto-modal-data');
  const legenda = modal.querySelector('.ponto-foto-modal-legenda');

  modal.dataset.fotoId = dados.fotoId || '';
  modal.dataset.ordemId = dados.ordemId || '';

  if (img) img.src = dados.src || '';
  if (tipo) tipo.innerHTML = badgeTipoFoto(dados.tipo || 'extra');
  if (data) data.textContent = dados.criadoEm || '';
  if (legenda) legenda.value = dados.legenda || '';
  const resumo = modal.querySelector('.ponto-foto-modal-resumo');
  if (resumo) resumo.textContent = dados.legenda || 'Sem legenda';
  modal.querySelector('.ponto-foto-modal-info')?.classList.remove('aberto');
  modal.querySelector('.ponto-foto-modal-tags')?.setAttribute('aria-expanded', 'false');

  modal.classList.add('ativo');
  document.body.classList.add('modal-foto-ponto-aberto');
}

function fecharModalFotoPonto() {
  if (!modalFotoPontoEl) return;
  modalFotoPontoEl.classList.remove('ativo');
  document.body.classList.remove('modal-foto-ponto-aberto');
}

async function enviarFotoPonto(form) {
  if (!form || form.dataset.enviando === '1') return;

  const pontoId = form.dataset.pontoId;
  const ordemIdRef = form.dataset.ordemId;
  const totalExtras = Number(form.dataset.totalExtras || '0');
  const tipo = form.querySelector('.ponto-foto-tipo')?.value;
  const arquivoInput = form.querySelector('.ponto-foto-arquivo');
  const legendaInput = form.querySelector('.ponto-foto-legenda');
  const ajuda = form.querySelector('.ponto-foto-ajuda');
  const legenda = legendaInput?.value.trim() || '';
  const arquivo = arquivoInput?.files?.[0];

  if (!arquivo) return;

  if (tipo === 'extra' && totalExtras >= 7) {
    alert('Este ponto já atingiu o limite de 7 fotos extras.');
    if (arquivoInput) arquivoInput.value = '';
    return;
  }

  form.dataset.enviando = '1';
  if (ajuda) ajuda.textContent = 'Enviando foto...';

  try {
    const imagemBase64 = await lerArquivoComoDataURL(arquivo);
    const resp = await fetch(osApiUrl(`ordens/pontos/${pontoId}/fotos`), {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        tipo,
        legenda,
        nome_arquivo: arquivo.name,
        mime_type: arquivo.type,
        imagem_base64: imagemBase64,
      }),
    });
    const data = await resp.json();
    if (!resp.ok || data.status !== 'ok') {
      alert(data.mensagem || 'Erro ao salvar foto do ponto.');
      return;
    }

    const selectTipo = form.querySelector('.ponto-foto-tipo');
    if (selectTipo) {
      const avancar = { inicio: 'execucao', execucao: 'fechamento', fechamento: 'extra' };
      const proximo = avancar[tipo];
      if (proximo) selectTipo.value = proximo;
    }

    if (arquivoInput) arquivoInput.value = '';
    if (legendaInput) legendaInput.value = '';

    await recarregarPontosModal(ordemIdRef);
  } catch (e) {
    console.error(e);
    alert('Falha ao enviar foto do ponto.');
  } finally {
    delete form.dataset.enviando;
    if (ajuda && form.isConnected) {
      ajuda.textContent = '';
    }
  }
}

// ============================================================
//  GERENCIAMENTO, Dashboard
// ============================================================

async function carregarDashboard() {
  try {
    const resp = await fetch(osApiUrl('ordens'), { headers: authHeaders() });
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.status !== 'ok') return;

    const t = data.totais || {};
    document.getElementById('total-abertas').textContent     = t.abertas     || 0;
    document.getElementById('total-andamento').textContent   = t.andamento   || 0;
    document.getElementById('total-finalizadas').textContent = t.finalizadas || 0;
    document.getElementById('total-canceladas').textContent  = t.canceladas  || 0;
    const totalGeral = document.getElementById('total-geral');
    if (totalGeral) totalGeral.textContent = (t.abertas || 0) + (t.andamento || 0) + (t.finalizadas || 0) + (t.canceladas || 0);

    const tbody = document.querySelector('#tabela-ordens-recentes tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const recentes = (data.ordens || []).slice(0, 10);
    recentes.forEach(os => {
      const row = document.createElement('tr');
      row.dataset.osId = String(os.id || '');
      row.innerHTML = `
        <td>${os.numero_os || ''}</td>
        <td>${os.data_abertura || ''}</td>
        <td>${os.solicitante || ''}</td>
        <td>${os.tipo_servico || ''}</td>
        <td>${badgePrioridade(os.prioridade)}</td>
        <td>${escapeHtml(tecnicoExibicao(os))}</td>
        <td>${badgeStatus(os.status)}</td>
      `;
      tbody.appendChild(row);
    });
    adicionarListenersAcoesOS(tbody);
  } catch (e) {
    console.error('Erro ao carregar dashboard:', e);
  }
}

// ============================================================
//  ABERTURA DE NOVA O.S.
// ============================================================

// Adiciona linha de ponto de atendimento no formulário
function adicionarPontoForm() {
  const container = document.getElementById('os-pontos-container');
  if (!container) return;
  const idx = container.querySelectorAll('.ponto-item').length + 1;
  const div = document.createElement('div');
  div.className = 'ponto-item';
  div.innerHTML = `
    <div class="ponto-item-header">
      <span class="ponto-item-label">Ponto ${idx}</span>
      <div class="ponto-item-acoes-header">
        <button type="button" class="btn-ponto-rota-form btn-acao" title="Ir para este ponto" aria-label="Ir para este ponto">
          <svg class="ponto-icone-mapa" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"></path>
          </svg>
        </button>
        <button type="button" class="btn-remover-ponto btn-acao" title="Remover ponto">✕</button>
      </div>
    </div>
    <div class="ponto-item-campos">
      <div class="ponto-busca-id-row">
        <input type="text" class="ponto-id-local" placeholder="ID da base (ex.: BASE-CENTRO)" />
        <button type="button" class="btn-buscar-local btn-secundario btn-sm">Buscar</button>
      </div>
      <div class="ponto-endereco-row">
        <input type="text" class="ponto-endereco" placeholder="Endereço *" required />
        <input type="text" class="ponto-complemento" placeholder="Complemento" />
      </div>
    </div>
  `;

  const idInput = div.querySelector('.ponto-id-local');
  const endInput = div.querySelector('.ponto-endereco');
  const compInput = div.querySelector('.ponto-complemento');
  endInput?.addEventListener('input', atualizarMapaUnicoForm);
  compInput?.addEventListener('input', atualizarMapaUnicoForm);
  idInput?.addEventListener('input', () => {
    idInput.dataset.localValido = 'false';
    atualizarMapaUnicoForm();
  });

  div.querySelector('.btn-buscar-local').addEventListener('click', async () => {
    await buscarLocalPorId(
      div.querySelector('.ponto-id-local'),
      div.querySelector('.ponto-endereco'),
      div.querySelector('.ponto-complemento')
    );
  });

  div.querySelector('.ponto-id-local').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await buscarLocalPorId(
        div.querySelector('.ponto-id-local'),
        div.querySelector('.ponto-endereco'),
        div.querySelector('.ponto-complemento')
      );
    }
  });

  div.querySelector('.btn-remover-ponto').addEventListener('click', () => {
    div.remove();
    container.querySelectorAll('.ponto-item').forEach((item, i) => {
      const label = item.querySelector('.ponto-item-label');
      if (label) label.textContent = `Ponto ${i + 1}`;
    });
    atualizarBotaoRoteirizarForm();
    atualizarMapaUnicoForm();
  });

  div.querySelector('.btn-ponto-rota-form').addEventListener('click', () => {
    const dados = extrairEnderecoPontoDoFormulario(div);
    abrirRotaPontoEspecifico(dados.enderecoCompleto);
  });

  container.appendChild(div);
  atualizarBotaoRoteirizarForm();
  atualizarMapaUnicoForm();
}

async function buscarLocalPorId(idInput, endInput, compInput) {
  const id = idInput?.value.trim();
  if (!id) { alert('Digite o ID do local.'); return; }
  const btnBuscar = idInput?.parentElement?.querySelector('.btn-buscar-local');
  if (btnBuscar) btnBuscar.disabled = true;
  try {
    const resp = await fetch(osApiUrl(`clientes/buscar/${encodeURIComponent(id)}`), { headers: authHeaders() });
    const data = await resp.json();
    if (!resp.ok || data.status !== 'ok' || !data.cliente) {
      if (idInput) idInput.dataset.localValido = 'false';
      alert(data.mensagem || 'Local não encontrado.');
      return;
    }
    if (idInput) idInput.dataset.localValido = 'true';
    if (endInput)  endInput.value  = data.cliente.endereco    || '';
    if (compInput) compInput.value = data.cliente.complemento || '';
    atualizarMapaUnicoForm();
    if (endInput) endInput.focus();
  } catch (e) {
    if (idInput) idInput.dataset.localValido = 'false';
    console.error(e);
    alert('Falha ao buscar local.');
  } finally {
    if (btnBuscar) btnBuscar.disabled = false;
  }
}

function atualizarBotaoRoteirizarForm() {
  const container = document.getElementById('os-pontos-container');
  const btn = document.getElementById('btn-roteirizar-form');
  if (!container || !btn) return;
  const enderecos = Array.from(container.querySelectorAll('.ponto-item'))
    .map(item => extrairEnderecoPontoDoFormulario(item).enderecoCompleto)
    .filter(Boolean);
  btn.style.display = enderecos.length >= 2 ? 'inline-flex' : 'none';
  btn.onclick = () => roteirizarPontos(enderecos);
}

function roteirizarPontos(enderecos) {
  if (!enderecos || enderecos.length < 2) {
    alert('São necessários ao menos 2 pontos para roteirizar.');
    return;
  }
  const origem = enderecos[0];
  const destino = enderecos[enderecos.length - 1];
  const intermediarios = enderecos.slice(1, -1);
  const params = new URLSearchParams({
    api: '1',
    travelmode: 'driving',
    origin: origem,
    destination: destino,
  });
  // "optimize:true" permite ao Google Maps reorganizar os pontos intermediários.
  if (intermediarios.length > 0) {
    params.set('waypoints', `optimize:true|${intermediarios.join('|')}`);
  }
  const url = `https://www.google.com/maps/dir/?${params.toString()}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function abrirRotaPontoEspecifico(endereco) {
  const destino = String(endereco || '').trim();
  if (!destino) {
    alert('Endereco do ponto nao informado.');
    return;
  }
  const params = new URLSearchParams({
    api: '1',
    origin: 'Current Location',
    destination: destino,
    travelmode: 'driving',
  });
  const url = `https://www.google.com/maps/dir/?${params.toString()}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function montarUrlMapaDirecoesEmbed(pontos) {
  if (!Array.isArray(pontos) || pontos.length === 0) return '';

  if (pontos.length === 1) {
    const unico = pontos[0];
    const paramsUnico = new URLSearchParams({
      output: 'embed',
      saddr: 'Current Location',
      daddr: unico.endereco,
      dirflg: 'd',
      hl: 'pt-BR',
    });
    return `https://maps.google.com/maps?${paramsUnico.toString()}`;
  }

  const origem = pontos[0].endereco;
  const destinosEncadeados = pontos.slice(1)
    .map(p => p.endereco)
    .filter(Boolean)
    .join(' to:');

  const params = new URLSearchParams({
    output: 'embed',
    dirflg: 'd',
    saddr: origem,
    daddr: destinosEncadeados,
    hl: 'pt-BR',
  });

  return `https://maps.google.com/maps?${params.toString()}`;
}

function construirLocalizacaoBase(base) {
  const endereco = String(base.endereco || '').trim();
  const complemento = String(base.complemento || '').trim();
  const link = String(base.link_localizacao || '').trim();
  if (link) return link;
  if (endereco && complemento) return `${endereco}, ${complemento}`;
  return endereco || '';
}

async function cadastrarBase(event) {
  if (event && event.preventDefault) event.preventDefault();

  const id = String(document.getElementById('base-id')?.value || '').trim();
  const linkLocalizacao = String(document.getElementById('base-link-localizacao')?.value || '').trim();
  const endereco = String(document.getElementById('base-endereco')?.value || '').trim();
  const complemento = String(document.getElementById('base-complemento')?.value || '').trim();
  const obs = String(document.getElementById('base-obs')?.value || '').trim();
  const contratos = window.coletarContratosSelecionados(document.getElementById('base-contratos-lista'));

  if (!id || !endereco) {
    alert('Preencha os campos obrigatórios: ID da base e endereço.');
    return;
  }

  try {
    const resp = await fetch(osApiUrl('bases'), {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        id,
        contratos,
        link_localizacao: linkLocalizacao,
        endereco,
        complemento,
        obs,
        materiais: materiaisBasesAdicionados.slice(),
      }),
    });
    const dados = await resp.json();
    if (dados.status !== 'ok') {
      alert(dados.mensagem || 'Erro ao cadastrar base.');
      return;
    }
  } catch (error) {
    console.error('Erro ao cadastrar base:', error);
    alert('Erro ao cadastrar base. Verifique sua conexão.');
    return;
  }

  materiaisBasesAdicionados = [];

  const formBases = document.getElementById('form-bases');
  if (formBases) formBases.reset();
  window.popularChecklistContratos(document.getElementById('base-contratos-lista'), []);

  const listaMateriaisBases = document.getElementById('base-materiais-lista');
  if (listaMateriaisBases) listaMateriaisBases.innerHTML = '';

  const baseIdInput = document.getElementById('base-id');
  if (baseIdInput) baseIdInput.readOnly = false;
  await carregarTabelaBases();
  irParaAbaOS('bases');
  avisoRapidoOS('Base salva.');
  try {
    await renderizarMapaBasesGerenciamento();
  } catch (error) {
    console.error('Erro ao atualizar mapa após cadastro da base:', error);
  }
}

function limparCadastroBases() {
  materiaisBasesAdicionados = [];
  const baseIdInput = document.getElementById('base-id');
  if (baseIdInput) baseIdInput.readOnly = false;

  const formBases = document.getElementById('form-bases');
  if (formBases) formBases.reset();
  window.popularChecklistContratos(document.getElementById('base-contratos-lista'), []);

  const listaMateriaisBases = document.getElementById('base-materiais-lista');
  if (listaMateriaisBases) listaMateriaisBases.innerHTML = '';
}

function extrairEnderecoPontoDoFormulario(item) {
  const enderecoDigitado = item.querySelector('.ponto-endereco')?.value.trim() || '';
  const complemento = item.querySelector('.ponto-complemento')?.value.trim() || '';
  const idInput = item.querySelector('.ponto-id-local');
  const idTexto = idInput?.value.trim() || '';
  const idValido = idInput?.dataset.localValido === 'true';

  // Se o usuário digitou um endereço no campo de ID, usa como fallback.
  const idPareceEndereco = /\s|,|-/.test(idTexto);
  const enderecoBase = enderecoDigitado || (!idValido && idPareceEndereco ? idTexto : '');
  const enderecoCompleto = complemento ? `${enderecoBase}, ${complemento}` : enderecoBase;

  return {
    endereco: enderecoBase,
    complemento,
    enderecoCompleto,
    idTexto,
    idValido,
  };
}

function obterPontosFormParaMapa() {
  return Array.from(document.querySelectorAll('#os-pontos-container .ponto-item')).map((item, index) => {
    const dados = extrairEnderecoPontoDoFormulario(item);
    return {
      endereco: dados.enderecoCompleto,
      numero_ponto: index + 1,
      id_cliente: dados.idValido && dados.idTexto ? dados.idTexto : '',
    };
  }).filter(p => p.endereco);
}

function aplicarModoVisualizacaoOS(ativo) {
  osEdicaoSomenteVisualizacao = Boolean(ativo);

  const modal = document.getElementById('modal-editar-os');
  if (!modal) return;

  const seletoresCampos = [
    '#edit-os-prioridade',
    '#edit-os-descricao',
    '#edit-despacho-responsavel-input',
    '#edit-despacho-integrante-input',
    '#edit-despacho-veiculo-input',
    '#edit-despacho-item-nome',
    '#edit-despacho-item-qtd',
    '#novo-ponto-id-local',
    '#novo-ponto-endereco',
    '#novo-ponto-complemento',
    '#fech-diagnostico',
    '#fech-procedimento',
    '#fech-situacao',
    '#fech-material-nome',
    '#fech-material-qtd',
    '.ponto-status-select',
    '.ponto-foto-tipo',
    '.ponto-foto-arquivo',
    '.ponto-foto-legenda',
  ];

  const seletoresBotoesBloqueados = [
    '#btn-adicionar-responsavel',
    '#btn-adicionar-integrante',
    '#btn-adicionar-veiculo',
    '#btn-adicionar-item-despacho',
    '#btn-adicionar-ponto-modal',
    '#btn-buscar-local-modal',
    '#btn-adicionar-material',
    '#btn-salvar-fechamento',
    '.lista-item-remover',
    '.btn-remover-item-despacho',
    '.btn-retirar-grupo-despacho',
    '.ponto-modal-bolinha-adicionar',
    '.ponto-foto-modal-salvar',
    '.ponto-foto-modal-excluir',
  ];

  modal.querySelectorAll(seletoresCampos.join(',')).forEach(el => {
    el.disabled = osEdicaoSomenteVisualizacao;
  });

  modal.querySelectorAll(seletoresBotoesBloqueados.join(',')).forEach(el => {
    el.disabled = osEdicaoSomenteVisualizacao;
  });
}

function obterIdClienteValidoDoItem(item) {
  const idInput = item?.querySelector?.('.ponto-id-local');
  if (!idInput) return '';
  const idTexto = String(idInput.value || '').trim();
  const idValido = idInput.dataset.localValido === 'true';
  return idValido && idTexto ? idTexto : '';
}

function atualizarMapaUnicoForm() {
  const mapaContainer = document.getElementById('os-pontos-mapa-container');
  const iframe = document.getElementById('os-pontos-mapa');
  const legendaEl = document.getElementById('os-pontos-mapa-legenda');
  if (!mapaContainer || !iframe || !legendaEl) return;

  const pontos = obterPontosFormParaMapa();
  if (pontos.length === 0) {
    mapaContainer.style.display = 'none';
    iframe.src = '';
    legendaEl.innerHTML = '';
    return;
  }

  iframe.src = montarUrlMapaDirecoesEmbed(pontos);
  legendaEl.innerHTML = pontos
    .map((p, index) => {
      const numeroPonto = Number(p.numero_ponto) || (index + 1);
      const idCliente = String(p.id_cliente || '').trim();
      const prefixo = idCliente
        ? `Ponto ${numeroPonto} - ID:<span class="pontos-mapa-id-destaque">${escapeHtml(idCliente)}</span> - Endereco:`
        : `Ponto ${numeroPonto} - Endereco:`;
      return `<span class="pontos-mapa-legenda-item"><strong>${prefixo}</strong> ${escapeHtml(p.endereco)}</span>`;
    })
    .join('');
  mapaContainer.style.display = 'block';
}

function atualizarMapaUnicoModal(pontos) {
  const mapaContainer = document.getElementById('modal-pontos-mapa-container');
  const iframe = document.getElementById('modal-pontos-mapa');
  const legendaEl = document.getElementById('modal-pontos-mapa-legenda');
  if (!mapaContainer || !iframe || !legendaEl) return;

  const pontosValidos = (Array.isArray(pontos) ? pontos : []).map((p, index) => {
    const endereco = (p.endereco || '').trim();
    const complemento = (p.complemento || '').trim();
    const enderecoCompleto = complemento ? `${endereco}, ${complemento}` : endereco;
    const numeroPonto = Number(p.numero_ponto) || (index + 1);
    const idCliente = String(p.id_cliente || '').trim();
    return { endereco: enderecoCompleto, numeroPonto, idCliente };
  }).filter(p => p.endereco);

  if (pontosValidos.length === 0) {
    mapaContainer.style.display = 'none';
    iframe.src = '';
    legendaEl.innerHTML = '';
    return;
  }

  iframe.src = montarUrlMapaDirecoesEmbed(pontosValidos);
  legendaEl.innerHTML = pontosValidos
    .map(p => {
      const prefixo = p.idCliente
        ? `Ponto ${p.numeroPonto} - ID:<span class="pontos-mapa-id-destaque">${escapeHtml(p.idCliente)}</span> - Endereco:`
        : `Ponto ${p.numeroPonto} - Endereco:`;
      return `<span class="pontos-mapa-legenda-item"><strong>${prefixo}</strong> ${escapeHtml(p.endereco)}</span>`;
    })
    .join('');
  mapaContainer.style.display = 'block';
}

async function abrirOrdem(e) {
  e.preventDefault();
  const btn = document.querySelector('#form-os button[type="submit"]');
  if (btn) btn.disabled = true;

  // Coleta pontos do formulário
  const pontos = [];
  document.querySelectorAll('#os-pontos-container .ponto-item').forEach(item => {
    const dados = extrairEnderecoPontoDoFormulario(item);
    if (dados.endereco) {
      pontos.push({
        endereco:    dados.endereco,
        complemento: dados.complemento,
        id_cliente: obterIdClienteValidoDoItem(item),
      });
    }
  });

  const payload = {
    solicitante:         document.getElementById('os-solicitante').value.trim(),
    setor:               '',
    contrato:            document.getElementById('os-contrato')?.value.trim() || '',
    tipo_servico:        document.getElementById('os-tipo').value,
    prioridade:          document.getElementById('os-prioridade').value,
    descricao:           document.getElementById('os-descricao').value.trim(),
    tecnico_responsavel: document.getElementById('os-tecnico')?.value.trim() || '',
    data_prevista:       null,
    status:              'Aberta',
    pontos,
  };

  try {
    const resp = await fetch(osApiUrl('ordens/salvar'), {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (resp.ok && data.status === 'ok') {
      const extra = pontos.length ? ` com ${pontos.length} ponto(s) de atendimento` : '';
      mostrarFeedback(`Ordem ${data.numero_os} aberta com sucesso${extra}!`, 'ok');
      document.getElementById('form-os').reset();
      document.getElementById('os-pontos-container').innerHTML = '';
      carregarDashboard();
      irParaAbaOS('busca');
      avisoRapidoOS(`Ordem ${data.numero_os} aberta${extra}.`);
    } else {
      mostrarFeedback(`❌ ${data.mensagem || 'Erro ao salvar.'}`, 'erro');
    }
  } catch (err) {
    console.error(err);
    mostrarFeedback('❌ Falha na comunicação com o servidor.', 'erro');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ============================================================
//  BUSCA DE ORDENS
// ============================================================

async function buscarOrdens() {
  const status  = document.getElementById('busca-os-status')?.value || '';
  const inicio  = document.getElementById('busca-os-inicio')?.value || '';
  const fim     = document.getElementById('busca-os-fim')?.value || '';

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (inicio) params.set('inicio', inicio);
  if (fim)    params.set('fim', fim);

  try {
    const resp = await fetch(`${osApiUrl('ordens')}?${params.toString()}`, { headers: authHeaders() });
    const data = await resp.json();
    if (!resp.ok || data.status !== 'ok') return;
    popularTabelaBusca(data.ordens || []);
  } catch (e) {
    console.error('Erro ao buscar ordens:', e);
  }
}

function popularTabelaBusca(ordens) {
  const tbody = document.querySelector('#tabela-busca-os tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  ordens.forEach(os => {
    const row = document.createElement('tr');
    row.dataset.osId = String(os.id || '');
    row.innerHTML = `
      <td data-coluna="numero_os">${os.numero_os || ''}</td>
      <td data-coluna="data_abertura">${os.data_abertura || ''}</td>
      <td data-coluna="solicitante">${os.solicitante || ''}</td>
      <td data-coluna="setor">${os.setor || '-'}</td>
      <td data-coluna="contrato">${escapeHtml(os.contrato || '-')}</td>
      <td data-coluna="tipo_servico">${os.tipo_servico || ''}</td>
      <td data-coluna="prioridade">${badgePrioridade(os.prioridade)}</td>
      <td data-coluna="tecnico_responsavel">${escapeHtml(tecnicoExibicao(os))}</td>
      <td data-coluna="status">${badgeStatus(os.status)}</td>
      <td data-coluna="data_prevista">${os.data_prevista || '-'}</td>
      <td data-coluna="data_conclusao">${os.data_conclusao || '-'}</td>
      <td data-coluna="descricao" class="os-descricao-cell" title="${(os.descricao || '').replace(/"/g, '&quot;')}">${os.descricao || ''}</td>
      <td>
        <button class="btn-acao btn-editar-os" data-id="${os.id}" title="Editar"><svg class="icone-acao" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg></button>
        <button class="btn-acao btn-excluir-os" data-id="${os.id}" title="Excluir"><svg class="icone-acao" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg></button>
      </td>
    `;
    tbody.appendChild(row);
  });
  adicionarListenersAcoesOS(tbody);
  filtrarTabelaOS();
}

// ============================================================
//  FILTRO EM TEMPO REAL, tabela de busca
// ============================================================

function filtrarTabelaOS() {
  const numero      = document.getElementById('filtro-os-numero')?.value.trim().toLowerCase() || '';
  const solicitante = document.getElementById('filtro-os-solicitante')?.value.trim().toLowerCase() || '';
  const tecnico     = document.getElementById('filtro-os-tecnico')?.value.trim().toLowerCase() || '';
  const tipo        = document.getElementById('filtro-os-tipo')?.value.toLowerCase() || '';

  const tbody = document.querySelector('#tabela-busca-os tbody');
  if (!tbody) return;

  tbody.querySelectorAll('tr').forEach(linha => {
    const num = linha.querySelector('[data-coluna="numero_os"]')?.textContent.toLowerCase() || '';
    const sol = linha.querySelector('[data-coluna="solicitante"]')?.textContent.toLowerCase() || '';
    const tec = linha.querySelector('[data-coluna="tecnico_responsavel"]')?.textContent.toLowerCase() || '';
    const tip = linha.querySelector('[data-coluna="tipo_servico"]')?.textContent.toLowerCase() || '';

    const passa = (!numero || num.includes(numero))
               && (!solicitante || sol.includes(solicitante))
               && (!tecnico || tec.includes(tecnico))
               && (!tipo || tip.includes(tipo));
    linha.style.display = passa ? '' : 'none';
  });
}

// ============================================================
//  AÇÕES, Editar / Excluir
// ============================================================

function adicionarListenersAcoesOS(container) {
  container.querySelectorAll('.btn-editar-os').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEdicao(btn.dataset.id));
  });
  container.querySelectorAll('.btn-excluir-os').forEach(btn => {
    btn.addEventListener('click', () => confirmarExclusao(btn.dataset.id));
  });

  container.querySelectorAll('tr').forEach(row => {
    row.addEventListener('dblclick', event => {
      if (event.target.closest('button')) return;
      const osId = row.dataset.osId;
      if (!osId) return;
      abrirModalEdicao(osId);
    });
  });
}

async function abrirModalEdicao(id) {
  const fim = window.mostrarCarregandoLogo ? window.mostrarCarregandoLogo() : null;
  try {
    await abrirModalEdicaoInterno(id);
  } finally {
    if (fim) fim();
  }
}

async function abrirModalEdicaoInterno(id) {
  try {
    const resp = await fetch(osApiUrl(`ordens/buscar/${id}`), { headers: authHeaders() });
    const data = await resp.json();
    if (!resp.ok || data.status !== 'ok') return;
    const os = data.ordem;

    const statusEfetivo = obterStatusEfetivoOS(os);
    const statusEmAtendimento = STATUS_EM_ATENDIMENTO.includes(statusEfetivo);
    const modoVisualizacao = statusEfetivo === 'Finalizada' || statusEfetivo === 'Cancelada';

    document.getElementById('edit-os-id').value         = os.id;
    document.getElementById('edit-os-status-atual').value = statusEfetivo;
    document.getElementById('edit-os-prioridade').value = os.prioridade || 'Média';
    document.getElementById('edit-os-descricao').value = os.descricao || '';
    document.getElementById('edit-os-status-label').textContent = `Status: ${statusEfetivo === "Chegada no Local" ? "Em Atuação no Local" : statusEfetivo}`;
    atualizarLegendaTecnicoModal(os);

    despachoResponsaveis = parseListaTexto(os.responsavel_equipe);
    despachoIntegrantes = parseListaTexto(os.equipe_membros);
    despachoVeiculos = parseListaTexto(os.veiculos_despacho);
    renderizarListaItens('edit-despacho-responsavel-list', despachoResponsaveis);
    renderizarListaItens('edit-despacho-equipe-list', despachoIntegrantes);
    renderizarListaItens('edit-despacho-veiculos-list', despachoVeiculos);
    document.getElementById('edit-despacho-responsavel-input').value = '';
    document.getElementById('edit-despacho-integrante-input').value = '';
    document.getElementById('edit-despacho-veiculo-input').value = '';

    const prioridadeEl = document.getElementById('edit-os-prioridade');
    const descricaoEl = document.getElementById('edit-os-descricao');

    if (prioridadeEl) prioridadeEl.disabled = statusEmAtendimento || modoVisualizacao;
    if (descricaoEl) descricaoEl.disabled = statusEmAtendimento || modoVisualizacao;

    atualizarResumoDadosOSModal();

    irParaEtapaModal(ultimaEtapaModalVisualizada || 1);

    // Carrega pontos de atendimento no modal
    renderizarPontosModal(os.pontos || [], id);

    // Carrega dados de fechamento
    const diagElA = document.getElementById('fech-diagnostico');
    const procElA = document.getElementById('fech-procedimento');
    const sitElA = document.getElementById('fech-situacao');
    if (diagElA) diagElA.value = os.diagnostico_equipamento || '';
    if (procElA) procElA.value = os.procedimento_executado || '';
    if (sitElA) sitElA.value = os.situacao_final || '';
    atualizarEstadoBotaoSalvarFechamento();

    // Inicializa materiais utilizados
    try {
      materiaisAdicionados = os.itens_utilizados ? JSON.parse(os.itens_utilizados) : [];
    } catch { materiaisAdicionados = []; }

    document.getElementById('modal-editar-os').style.display = 'flex';
    aplicarModoVisualizacaoOS(modoVisualizacao);

    // Secao "Analise da ocorrencia" (modulo de Relatorios). Falha aqui nao
    // pode derrubar a tela de O.S.: a secao simplesmente nao aparece.
    if (window.AnaliseOS && typeof window.AnaliseOS.carregar === 'function') {
      window.AnaliseOS.carregar(os.id);
    }

    // Integracao operacional (equipe/frota/materiais cadastrados). Mesma
    // regra: falha aqui nunca derruba a tela de O.S.
    if (window.OSEquipe && typeof window.OSEquipe.carregar === 'function') {
      window.OSEquipe.carregar(os.id);
    }
    if (window.OSFrota && typeof window.OSFrota.carregar === 'function') {
      window.OSFrota.carregar(os.id);
    }
    if (window.OSMateriais && typeof window.OSMateriais.carregar === 'function') {
      window.OSMateriais.carregar(os.id, os.numero_os);
    }
  } catch (e) {
    console.error('Erro ao carregar OS para edição:', e);
  }
}

function coletarDadosDespachoModal() {
  return {
    responsavel_equipe: despachoResponsaveis.join(', '),
    equipe_membros: despachoIntegrantes.join(', '),
    veiculos_despacho: despachoVeiculos.join(', '),
    equipamentos_despacho: despachoItens.length > 0 ? JSON.stringify(despachoItens) : '',
  };
}

async function processarDespachoOS(acao = 'salvar') {
  const id = document.getElementById('edit-os-id')?.value;
  if (!id) return;

  try {
    const resp = await fetch(osApiUrl(`ordens/despacho/${id}`), {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify({
        acao,
        ...coletarDadosDespachoModal(),
      }),
    });
    const data = await resp.json();
    if (!resp.ok || data.status !== 'ok') {
      alert(data.mensagem || 'Erro ao processar despacho.');
      return;
    }

    // Após salvar o despacho, salva os itens manuais como retiradas
    // Precisa passar o número da O.S., então vamos buscar do modal ou usar o ID
    const numeroOS = document.querySelector('table [data-coluna="numero_os"]')?.textContent || id;
    await salvarItensManualSomeRetiradas(id, numeroOS);

    alert(data.mensagem || 'Despacho atualizado com sucesso.');
    await recarregarDadosOrdemModal(id);
    carregarDashboard();
    buscarOrdens();
  } catch (e) {
    console.error(e);
    alert('Falha ao processar despacho da O.S.');
  }
}

async function salvarItensManualSomeRetiradas(osId, numeroOS) {
  // Filtra apenas itens manuais (ID começa com MANU)
  const itensManuals = despachoItens.filter(item => 
    item.id_retirada && item.id_retirada.startsWith('MANU')
  );
  
  if (itensManuals.length === 0) {
    console.log('ℹ Nenhum item manual para salvar como retirada');
    return;
  }
  
  console.log(`📦 Salvando ${itensManuals.length} item(ns) manual(is) como retirada(s)...`);
  
  // Extrai nome do usuário do localStorage
  let usuarioNome = 'Usuário Sistema';
  try {
    const usuarioObj = JSON.parse(localStorage.getItem('usuario') || '{}');
    usuarioNome = usuarioObj.nome || usuarioObj.usuario || usuarioObj.email || usuarioNome;
  } catch (e) {
    console.warn('Não foi possível extrair nome do usuário:', e);
  }
  
  const dataAtual = new Date().toISOString().split('T')[0];
  const osNumero = numeroOS || osId;
  
  for (const item of itensManuals) {
    try {
      const retiradaData = {
        id_retirada: item.id_retirada,
        data: dataAtual,
        requisitante: usuarioNome,
        responsavel: usuarioNome,
        produto: item.nome,
        quantidade: item.quantidade,
        local_destino: 'O.S.',
        finalidade: `Despacho para O.S. ${osNumero}`,
        observacoes: `Item adicionado manualmente para a O.S. ${osNumero}`,
      };
      
      console.log(`📝 Salvando item: ${item.nome} (${item.quantidade})`);
      
      const respRetirada = await fetch(osApiUrl('retirada/salvar'), {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(retiradaData),
      });
      
      const dataRetirada = await respRetirada.json();
      if (!respRetirada.ok || dataRetirada.status !== 'ok') {
        console.warn(`⚠ Erro ao salvar retirada para ${item.nome}:`, dataRetirada.mensagem);
      } else {
        console.log(`✓ Retirada salva para ${item.nome}`);
      }
    } catch (e) {
      console.error(`❌ Erro ao salvar retirada manual ${item.nome}:`, e);
    }
  }
  
  console.log('✓ Itens manuais processados');
}

async function recarregarDadosOrdemModal(id) {
  try {
    const resp = await fetch(osApiUrl(`ordens/buscar/${id}`), { headers: authHeaders() });
    const data = await resp.json();
    if (!resp.ok || data.status !== 'ok') return;
    const os = data.ordem;

    const statusEfetivo = obterStatusEfetivoOS(os);
    const modoVisualizacao = statusEfetivo === 'Finalizada' || statusEfetivo === 'Cancelada';
    document.getElementById('edit-os-status-atual').value = statusEfetivo;
    document.getElementById('edit-os-status-label').textContent = `Status: ${statusEfetivo === "Chegada no Local" ? "Em Atuação no Local" : statusEfetivo}`;
    atualizarLegendaTecnicoModal(os);
    despachoResponsaveis = parseListaTexto(os.responsavel_equipe);
    despachoIntegrantes = parseListaTexto(os.equipe_membros);
    despachoVeiculos = parseListaTexto(os.veiculos_despacho);
    renderizarListaItens('edit-despacho-responsavel-list', despachoResponsaveis);
    renderizarListaItens('edit-despacho-equipe-list', despachoIntegrantes);
    renderizarListaItens('edit-despacho-veiculos-list', despachoVeiculos);
    document.getElementById('edit-despacho-responsavel-input').value = '';
    document.getElementById('edit-despacho-integrante-input').value = '';
    document.getElementById('edit-despacho-veiculo-input').value = '';
    
    // Carrega itens de despacho
    despachoItens = [];
    despachoIdRetiradaManual = null;
    if (os.equipamentos_despacho) {
      try {
        const itensCarregados = JSON.parse(os.equipamentos_despacho);
        if (Array.isArray(itensCarregados)) {
          // Converte itens antigos (que usavam campo 'data') para novo formato (id_retirada)
          const idManualExistente = itensCarregados.find(item => item.id_retirada && item.id_retirada.startsWith('MANU'))?.id_retirada || null;
          if (idManualExistente) {
            despachoIdRetiradaManual = idManualExistente;
          }
          despachoItens = itensCarregados.map(item => {
            // Se já tem id_retirada, mantém
            if (!item.id_retirada) {
              // Se tem campo data antigo ou não tem id, gera um ID genérico
              item.id_retirada = 'LEGACY-OS-' + (os.numero_os || 'XXXX');
              // Remove o campo data antigo
              delete item.data;
            } else if (item.id_retirada.startsWith('MANU') && despachoIdRetiradaManual) {
              item.id_retirada = despachoIdRetiradaManual;
            }
            return item;
          });
        }
      } catch (e) {
        // Se não for JSON, ignora (pode ser texto antigo)
        console.log('Equipamentos em formato de texto');
      }
    }
    renderizarTabelaItensDespacho();
    carregarProdutosParaDespacho();

    const statusEmAtendimento = STATUS_EM_ATENDIMENTO.includes(statusEfetivo);
    const prioridadeEl = document.getElementById('edit-os-prioridade');
    const descricaoEl = document.getElementById('edit-os-descricao');

    if (prioridadeEl) prioridadeEl.disabled = statusEmAtendimento || modoVisualizacao;
    if (descricaoEl) descricaoEl.disabled = statusEmAtendimento || modoVisualizacao;

    atualizarResumoDadosOSModal();
    atualizarMinimizacaoDadosOSModal();

    renderizarPontosModal(os.pontos || [], id);

    // Carrega dados de fechamento
    const diagElB = document.getElementById('fech-diagnostico');
    const procElB = document.getElementById('fech-procedimento');
    const sitElB = document.getElementById('fech-situacao');
    if (diagElB) diagElB.value = os.diagnostico_equipamento || '';
    if (procElB) procElB.value = os.procedimento_executado || '';
    if (sitElB) sitElB.value = os.situacao_final || '';
    atualizarEstadoBotaoSalvarFechamento();
    if (os.itens_utilizados && etapaModalAtual === 5) {
      popularItensUtilizados();
    }
    aplicarModoVisualizacaoOS(modoVisualizacao);
  } catch (e) {
    console.error('Erro ao recarregar dados da O.S. no modal:', e);
  }
}

// ============================================================
//  PONTOS DE ATENDIMENTO, Modal
// ============================================================

function renderizarPontosModal(pontos, ordemId) {
  const lista = document.getElementById('modal-pontos-lista');
  if (!lista) return;

  const abrirFormularioNovoPonto = () => {
    const formNovoPonto = document.getElementById('form-novo-ponto-modal');
    if (!formNovoPonto) return;
    formNovoPonto.style.display = 'block';
    const campoId = document.getElementById('novo-ponto-id-local');
    campoId?.focus();
  };

  if (pontos.length === 0) {
    lista.innerHTML = `
      <div class="pontos-modal-nav" role="tablist" aria-label="Ações de pontos de atendimento">
        <button type="button" class="ponto-modal-bolinha ponto-modal-bolinha-adicionar" aria-label="Adicionar ponto">+</button>
      </div>
      <p class="pontos-vazio">Nenhum ponto de atendimento cadastrado.</p>
    `;
    lista.querySelector('.ponto-modal-bolinha-adicionar')?.addEventListener('click', abrirFormularioNovoPonto);
    atualizarMapaUnicoModal([]);
    return;
  }

  const botoesSelecaoPontos = pontos.length >= 1
    ? pontos.map((p, index) => `
        <button type="button" class="ponto-modal-bolinha${index === 0 ? ' ativo' : ''}" data-ponto-idx="${index}" aria-label="Mostrar ponto ${index + 1}" aria-pressed="${index === 0 ? 'true' : 'false'}">${index + 1}</button>
      `).join('')
    : '';

  const pontosHtml = pontos.map((p, index) => {
    const fotos = Array.isArray(p.fotos) ? p.fotos : [];
    const temFotoInicio = fotos.some(f => f.tipo === 'inicio');
    const tipoFotoPadrao = obterTipoFotoPadrao(fotos);

    return `
    <div class="ponto-row ponto-row-modal${index === 0 ? ' ativo' : ''}" id="ponto-row-${p.id}" data-ponto-idx="${index}">
      <div class="ponto-row-info">
        <div class="pontos-modal-nav pontos-modal-nav-inline" role="tablist" aria-label="Selecionar ponto de atendimento">
          <div class="pontos-modal-nav-scroll">
            ${botoesSelecaoPontos}
          </div>
          <button type="button" class="ponto-modal-bolinha ponto-modal-bolinha-adicionar" aria-label="Adicionar ponto">+</button>
        </div>
        <button type="button" class="btn-ponto-rota-modal btn-acao" data-ponto-idx="${index}" data-endereco="${escapeHtml(p.endereco + (p.complemento ? ', ' + p.complemento : ''))}" title="Ir para este ponto" aria-label="Ir para este ponto">
          <svg class="ponto-icone-mapa" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"></path>
          </svg>
        </button>
        <select class="ponto-status-select" data-ponto-id="${p.id}" data-tem-foto-inicio="${temFotoInicio ? 'true' : 'false'}" aria-label="Status do ponto de atendimento">
          <option value="Pendente"${p.status === 'Pendente' ? ' selected' : ''}>Pendente</option>
          <option value="Em Preparo"${p.status === 'Em Preparo' ? ' selected' : ''}>Em Preparo</option>
          <option value="Em Deslocamento"${p.status === 'Em Deslocamento' ? ' selected' : ''}>Em Deslocamento</option>
          <option value="Chegada no Local"${p.status === 'Chegada no Local' ? ' selected' : ''}>Em Atuação no Local</option>
          <option value="Finalizado"${p.status === 'Finalizado' ? ' selected' : ''}>Finalizado</option>
          <option value="Cancelado"${p.status === 'Cancelado' ? ' selected' : ''}>Cancelado</option>
        </select>
      </div>

      <div class="ponto-fotos-bloco">
        <div class="ponto-foto-form" data-ponto-id="${p.id}" data-ordem-id="${ordemId}" data-total-extras="${fotos.filter(f => f.tipo === 'extra').length}">
          <div class="ponto-foto-linha ponto-foto-linha-principal">
            <select class="ponto-foto-tipo ponto-input">
              <option value="inicio"${tipoFotoPadrao === 'inicio' ? ' selected' : ''}>Foto de início</option>
              <option value="execucao"${tipoFotoPadrao === 'execucao' ? ' selected' : ''}>Foto de execução</option>
              <option value="fechamento"${tipoFotoPadrao === 'fechamento' ? ' selected' : ''}>Foto de fechamento</option>
              <option value="extra"${tipoFotoPadrao === 'extra' ? ' selected' : ''}>Foto extra</option>
            </select>
            <input type="file" class="ponto-foto-arquivo ponto-input" accept="image/*" />
          </div>
          <div class="ponto-foto-linha ponto-foto-linha-secundaria">
            <input type="text" class="ponto-foto-legenda ponto-input" maxlength="255" placeholder="Legenda da imagem" />
          </div>
        </div>

        <div class="ponto-fotos-galeria">
          ${fotos.length === 0
            ? '<p class="pontos-vazio">Nenhuma foto cadastrada para este ponto.</p>'
            : fotos.map(f => `
              <div class="ponto-foto-card" id="ponto-foto-${f.id}" data-foto-id="${f.id}" data-ordem-id="${ordemId}">
                <button type="button" class="ponto-foto-abrir" data-foto-id="${f.id}" data-ordem-id="${ordemId}" data-legenda="${escapeHtml(f.legenda || '')}" data-tipo="${escapeHtml(f.tipo || 'extra')}" data-criado-em="${escapeHtml(f.criado_em || '')}" title="Abrir foto">
                  <img src="${normalizarSrcImagem(f.imagem_base64)}" alt="Foto do ponto" class="ponto-foto-thumb" />
                </button>
                <div class="ponto-foto-meta">
                  ${badgeTipoFoto(f.tipo)}
                  <span class="ponto-foto-legenda">${escapeHtml(obterTextoLegendaFoto(f.legenda))}</span>
                  <span class="ponto-foto-data">${escapeHtml(f.criado_em || '')}</span>
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    </div>
  `;
  }).join('');

  lista.innerHTML = `<div class="pontos-modal-conteudo">${pontosHtml}</div>`;

  const atualizarMapaPontoSelecionado = indiceAtivo => {
    const pontoSelecionado = pontos[indiceAtivo];
    atualizarMapaUnicoModal(pontoSelecionado ? [{ ...pontoSelecionado, numero_ponto: indiceAtivo + 1 }] : []);
  };

  const ativarPontoModal = indiceAtivo => {
    lista.querySelectorAll('.ponto-row-modal').forEach(row => {
      row.classList.toggle('ativo', Number(row.dataset.pontoIdx || '0') === indiceAtivo);
    });
    lista.querySelectorAll('.ponto-modal-bolinha[data-ponto-idx]').forEach(botao => {
      botao.classList.toggle('ativo', Number(botao.dataset.pontoIdx || '0') === indiceAtivo);
      botao.setAttribute('aria-pressed', Number(botao.dataset.pontoIdx || '0') === indiceAtivo ? 'true' : 'false');
    });
    ultimoPontoModalVisualizado = indiceAtivo;
    try {
      localStorage.setItem(CHAVE_ULTIMO_PONTO_MODAL_OS, String(ultimoPontoModalVisualizado));
    } catch {
      // Ignora falha de persistencia (ex.: modo privado/restricao de armazenamento).
    }
    atualizarMapaPontoSelecionado(indiceAtivo);
  };

  lista.querySelectorAll('.ponto-modal-bolinha[data-ponto-idx]').forEach(botao => {
    botao.addEventListener('click', () => {
      ativarPontoModal(Number(botao.dataset.pontoIdx || '0'));
    });
  });

  lista.querySelectorAll('.ponto-modal-bolinha-adicionar').forEach(botaoAdicionar => {
    botaoAdicionar.addEventListener('click', abrirFormularioNovoPonto);
  });

  const indiceInicialPonto = Math.min(
    Math.max(0, ultimoPontoModalVisualizado),
    Math.max(0, pontos.length - 1)
  );

  if (pontos.length > 1) {
    ativarPontoModal(indiceInicialPonto);
  } else {
    lista.querySelectorAll('.ponto-row-modal').forEach(row => row.classList.add('ativo'));
    ultimoPontoModalVisualizado = 0;
    atualizarMapaPontoSelecionado(0);
  }

  // Listeners nos selects de status do ponto
  lista.querySelectorAll('.ponto-status-select').forEach(sel => {
    sel.dataset.statusAtual = sel.value;
    atualizarClasseStatusPonto(sel);
    atualizarOpcoesStatusPonto(sel);
    sel.addEventListener('change', async function () {
      const statusAnterior = this.dataset.statusAtual || this.value;
      if (this.selectedOptions?.[0]?.disabled) {
        this.value = statusAnterior;
        atualizarClasseStatusPonto(this);
        atualizarOpcoesStatusPonto(this);
        return;
      }
      const resultado = await atualizarStatusPonto(this.dataset.pontoId, this.value);
      if (!resultado.ok) {
        alert(resultado.mensagem || 'Não foi possível atualizar o status do ponto.');
        this.value = statusAnterior;
        atualizarClasseStatusPonto(this);
        atualizarOpcoesStatusPonto(this);
        atualizarEstadoBotaoSalvarFechamento();
        return;
      }
      this.dataset.statusAtual = this.value;
      atualizarClasseStatusPonto(this);
      atualizarOpcoesStatusPonto(this);
      atualizarEstadoBotaoSalvarFechamento();
    });
  });

  lista.querySelectorAll('.ponto-foto-arquivo').forEach(input => {
    input.addEventListener('change', async function () {
      const form = this.closest('.ponto-foto-form');
      const arquivo = this.files?.[0];
      if (!form || !arquivo) return;
      const confirmado = await confirmarFotoPonto(form, arquivo);
      if (!confirmado) { this.value = ''; return; }
      await enviarFotoPonto(form);
    });
  });

  lista.querySelectorAll('.btn-ponto-rota-modal').forEach(btn => {
    btn.addEventListener('click', function () {
      const indice = Number(this.dataset.pontoIdx || '-1');
      const ponto = Number.isInteger(indice) && indice >= 0 ? pontos[indice] : null;
      const enderecoCalculado = [ponto?.endereco, ponto?.complemento]
        .map(v => String(v || '').trim())
        .filter(Boolean)
        .join(', ');
      const enderecoFallback = String(this.dataset.endereco || '').trim();
      abrirRotaPontoEspecifico(enderecoCalculado || enderecoFallback);
    });
  });

  lista.querySelectorAll('.ponto-foto-abrir').forEach(btn => {
    btn.addEventListener('click', function () {
      const imagem = this.querySelector('.ponto-foto-thumb');
      abrirModalFotoPonto({
        fotoId: this.dataset.fotoId,
        ordemId: this.dataset.ordemId,
        legenda: this.dataset.legenda || '',
        tipo: this.dataset.tipo || 'extra',
        criadoEm: this.dataset.criadoEm || '',
        src: imagem?.src || '',
      });
    });
  });
}

async function recarregarPontosModal(ordemId) {
  try {
    const r = await fetch(osApiUrl(`ordens/buscar/${ordemId}`), { headers: authHeaders() });
    const d = await r.json();
    if (r.ok && d.status === 'ok') {
      renderizarPontosModal(d.ordem.pontos || [], ordemId);
    }
  } catch (e) {
    console.error('Erro ao recarregar pontos do modal:', e);
  }
}

async function atualizarStatusPonto(pontoId, status) {
  try {
    const resp = await fetch(osApiUrl(`ordens/pontos/${pontoId}`), {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify({ status }),
    });
    const data = await resp.json();
    if (!resp.ok || data.status !== 'ok') {
      return {
        ok: false,
        mensagem: data.mensagem || 'Erro ao atualizar status do ponto.',
        faltantes: data.faltantes || [],
      };
    }
    return { ok: true };
  } catch (e) {
    console.error('Erro ao atualizar ponto:', e);
    return { ok: false, mensagem: 'Falha de comunicação ao atualizar o ponto.' };
  }
}

async function adicionarPontoModal(ordemId) {
  const idLocalInput = document.getElementById('novo-ponto-id-local');
  const idLocalTexto = String(idLocalInput?.value || '').trim();
  const idLocalValido = idLocalInput?.dataset.localValido === 'true';
  const idCliente = idLocalValido && idLocalTexto ? idLocalTexto : '';
  const endereco    = document.getElementById('novo-ponto-endereco')?.value.trim();
  const complemento = document.getElementById('novo-ponto-complemento')?.value.trim() || '';

  if (!endereco) { alert('Endereço é obrigatório.'); return; }

  try {
    const resp = await fetch(osApiUrl(`ordens/${ordemId}/pontos`), {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ endereco, complemento, id_cliente: idCliente }),
    });
    const data = await resp.json();
    if (resp.ok && data.status === 'ok') {
      // Limpa o form e recarrega pontos
      const idLocalEl = document.getElementById('novo-ponto-id-local');
      if (idLocalEl) idLocalEl.value = '';
      document.getElementById('novo-ponto-endereco').value    = '';
      document.getElementById('novo-ponto-complemento').value = '';
      document.getElementById('form-novo-ponto-modal').style.display = 'none';

      // Recarrega a lista do modal
      await recarregarPontosModal(ordemId);
    } else {
      alert(data.mensagem || 'Erro ao adicionar ponto.');
    }
  } catch (e) {
    console.error(e);
  }
}

function formularioNovoPontoVisivel() {
  const form = document.getElementById('form-novo-ponto-modal');
  if (!form) return false;
  return form.style.display !== 'none';
}

function obterDadosFormularioNovoPontoModal() {
  return {
    endereco: String(document.getElementById('novo-ponto-endereco')?.value || '').trim(),
    complemento: String(document.getElementById('novo-ponto-complemento')?.value || '').trim(),
    idLocal: String(document.getElementById('novo-ponto-id-local')?.value || '').trim(),
  };
}

async function salvarNovoPontoModalAutomaticamente() {
  if (salvandoNovoPontoModal || !formularioNovoPontoVisivel()) return;

  const form = document.getElementById('form-novo-ponto-modal');
  const ordemId = document.getElementById('edit-os-id')?.value;
  const dados = obterDadosFormularioNovoPontoModal();
  const possuiConteudo = Boolean(dados.endereco || dados.complemento || dados.idLocal);

  // Se não houve preenchimento, apenas fecha o formulário silenciosamente.
  if (!possuiConteudo) {
    if (form) form.style.display = 'none';
    return;
  }

  if (!dados.endereco || !ordemId) return;

  salvandoNovoPontoModal = true;
  try {
    await adicionarPontoModal(ordemId);
  } finally {
    salvandoNovoPontoModal = false;
  }
}

async function sairDaEdicaoComAutosave() {
  const modal = document.getElementById('modal-editar-os');
  if (!modal || modal.style.display === 'none' || salvandoSaidaEdicaoModal) return;

  if (osEdicaoSomenteVisualizacao) {
    modal.style.display = 'none';
    return;
  }

  salvandoSaidaEdicaoModal = true;
  try {
    await salvarNovoPontoModalAutomaticamente();
    await salvarEdicaoOS();
  } finally {
    salvandoSaidaEdicaoModal = false;
  }
}

async function salvarEdicaoOS() {
  const id = document.getElementById('edit-os-id').value;
  const statusAtual = document.getElementById('edit-os-status-atual')?.value || '';

  if (statusAtual === 'Finalizada' || statusAtual === 'Cancelada' || osEdicaoSomenteVisualizacao) {
    document.getElementById('modal-editar-os').style.display = 'none';
    return;
  }

  const statusEmAtendimento = STATUS_EM_ATENDIMENTO.includes(statusAtual);
  const podeSalvarDespacho = statusAtual === 'Aberta' || statusAtual === 'Aguardando Despacho de Equipamentos';

  try {
    const prioridade = document.getElementById('edit-os-prioridade').value;
    const descricao = document.getElementById('edit-os-descricao').value.trim();

    if (!statusEmAtendimento) {
      const resp = await fetch(osApiUrl(`ordens/atualizar/${id}`), {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify({
          prioridade,
          descricao,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || data.status !== 'ok') {
        alert(data.mensagem || 'Erro ao atualizar.');
        return;
      }
    }

    if (podeSalvarDespacho) {
      const respDespacho = await fetch(osApiUrl(`ordens/despacho/${id}`), {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify({
          acao: 'salvar',
          ...coletarDadosDespachoModal(),
        }),
      });
      const dataDespacho = await respDespacho.json();
      if (!respDespacho.ok || dataDespacho.status !== 'ok') {
        alert(dataDespacho.mensagem || 'Erro ao salvar despacho.');
        return;
      }

      const numeroOS = document.getElementById('edit-os-id')?.value || id;
      await salvarItensManualSomeRetiradas(id, numeroOS);
    }

    document.getElementById('modal-editar-os').style.display = 'none';
    await recarregarDadosOrdemModal(id);
    carregarDashboard();
    buscarOrdens();
  } catch (e) {
    console.error(e);
    alert('Falha ao atualizar a O.S.');
  }
}

async function confirmarExclusao(id) {
  if (!confirm('Deseja realmente excluir esta Ordem de Serviço?')) return;
  try {
    const resp = await fetch(osApiUrl(`ordens/excluir/${id}`), {
      method: 'DELETE', headers: authHeaders(),
    });
    const data = await resp.json();
    if (resp.ok && data.status === 'ok') {
      carregarDashboard();
      buscarOrdens();
    } else {
      alert(data.mensagem || 'Erro ao excluir.');
    }
  } catch (e) {
    console.error(e);
  }
}

// ============================================================
//  EXPORTAR EXCEL
// ============================================================

function exportarOSParaExcel() {
  const tabela = document.getElementById('tabela-busca-os');
  if (!tabela) return;
  const rows = [];
  const ths = tabela.querySelectorAll('thead th');
  const cabecalho = Array.from(ths).map(th => th.textContent.trim()).filter(t => t !== 'Ações');
  rows.push(cabecalho);
  tabela.querySelectorAll('tbody tr').forEach(tr => {
    if (tr.style.display === 'none') return;
    const tds = Array.from(tr.querySelectorAll('td')).slice(0, cabecalho.length);
    rows.push(tds.map(td => td.textContent.trim()));
  });
  const conteudo = rows.map(r => r.join('\t')).join('\n');
  const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/tab-separated-values;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ordens_servico_${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
//  INIT
// ============================================================

document.addEventListener('DOMContentLoaded', async function () {

  // Pré-carrega produtos para o datalist de despacho
  carregarProdutosParaDespacho();

  // ---- Navegação de abas ----
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', function () {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      const tabId = this.getAttribute('data-tab');
      const el = document.getElementById(tabId);
      if (el) el.classList.add('active');
      if (tabId === 'gerenciamento') carregarDashboard();
      if (tabId === 'busca') buscarOrdens();
      if (tabId === 'cronograma') carregarCronograma();
      if (tabId === 'bases') carregarTabelaBases();
    });
  });

  // ---- Botão Abrir Nova O.S. (gerenciamento) ----
  document.getElementById('btn-abrir-os-rapido')?.addEventListener('click', () => abrirCadastroOS('os-sub-nova'));
  inicializarCadastrosOS();

  // ---- Formulário nova O.S. ----
  document.getElementById('form-os')?.addEventListener('submit', abrirOrdem);
  document.getElementById('btn-limpar-os')?.addEventListener('click', () => {
    document.getElementById('form-os').reset();
    document.getElementById('os-pontos-container').innerHTML = '';
    atualizarMapaUnicoForm();
    const fb = document.getElementById('os-feedback');
    if (fb) fb.style.display = 'none';
  });

  document.getElementById('form-bases')?.addEventListener('submit', cadastrarBase);
  document.getElementById('btn-limpar-bases')?.addEventListener('click', limparCadastroBases);
  window.popularChecklistContratos(document.getElementById('base-contratos-lista'), []);
  renderizarMapaBasesGerenciamento().catch((error) => {
    console.error('Erro ao renderizar mapa de bases na inicialização:', error);
  });

  // ---- Adicionar ponto no formulário de abertura ----
  document.getElementById('btn-adicionar-ponto-form')?.addEventListener('click', adicionarPontoForm);
  // Atualiza mapa único quando endereço muda
  document.getElementById('os-pontos-container')?.addEventListener('input', (e) => {
    if (e.target.classList.contains('ponto-endereco') || e.target.classList.contains('ponto-complemento') || e.target.classList.contains('ponto-id-local')) {
      atualizarMapaUnicoForm();
    }
  });

  // ---- Cronograma de Serviço ----
  document.getElementById('btn-agendar')?.addEventListener('click', () => abrirPainelAgendamento(null));
  document.getElementById('btn-fechar-agendamento')?.addEventListener('click', fecharPainelAgendamento);
  document.getElementById('form-agendamento')?.addEventListener('submit', salvarAgendamento);
  document.getElementById('cronograma-filtro-data')?.addEventListener('change', carregarCronograma);
  document.getElementById('btn-ver-todas-datas')?.addEventListener('click', () => {
    const input = document.getElementById('cronograma-filtro-data');
    if (input) input.value = '';
    carregarCronograma();
  });

  // ---- Busca ----
  document.getElementById('btn-buscar-os')?.addEventListener('click', buscarOrdens);
  document.getElementById('btn-baixar-os')?.addEventListener('click', exportarOSParaExcel);

  // Filtros em tempo real
  ['filtro-os-numero', 'filtro-os-solicitante', 'filtro-os-tecnico'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', filtrarTabelaOS);
  });
  document.getElementById('filtro-os-tipo')?.addEventListener('change', filtrarTabelaOS);

  // ---- Modal de edição ----
  document.getElementById('modal-editar-os')?.addEventListener('click', async function (e) {
    if (e.target === this) {
      await sairDaEdicaoComAutosave();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const modal = document.getElementById('modal-editar-os');
    if (!modal || modal.style.display === 'none') return;
    event.preventDefault();
    void sairDaEdicaoComAutosave();
  });

  // ---- Modal: adicionar ponto ----
  document.getElementById('btn-adicionar-ponto-modal')?.addEventListener('click', async () => {
    const form = document.getElementById('form-novo-ponto-modal');
    if (!form) return;
    if (form.style.display !== 'none') {
      await salvarNovoPontoModalAutomaticamente();
      return;
    }
    form.style.display = 'block';
    document.getElementById('novo-ponto-id-local')?.focus();
  });
  document.getElementById('btn-buscar-local-modal')?.addEventListener('click', async () => {
    await buscarLocalPorId(
      document.getElementById('novo-ponto-id-local'),
      document.getElementById('novo-ponto-endereco'),
      document.getElementById('novo-ponto-complemento')
    );
  });
  document.getElementById('novo-ponto-id-local')?.addEventListener('input', (e) => {
    e.target.dataset.localValido = 'false';
  });
  document.getElementById('novo-ponto-id-local')?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await buscarLocalPorId(
        document.getElementById('novo-ponto-id-local'),
        document.getElementById('novo-ponto-endereco'),
        document.getElementById('novo-ponto-complemento')
      );
    }
  });

  document.addEventListener('mousedown', (e) => {
    const form = document.getElementById('form-novo-ponto-modal');
    if (!form || form.style.display === 'none') return;
    const alvo = e.target;
    if (form.contains(alvo)) return;
    if (alvo.closest('#btn-adicionar-ponto-modal')) return;
    void salvarNovoPontoModalAutomaticamente();
  });

  document.getElementById('btn-adicionar-responsavel')?.addEventListener('click', () => {
    adicionarItemLista('edit-despacho-responsavel-input', despachoResponsaveis, 'edit-despacho-responsavel-list');
  });
  document.getElementById('btn-adicionar-integrante')?.addEventListener('click', () => {
    adicionarItemLista('edit-despacho-integrante-input', despachoIntegrantes, 'edit-despacho-equipe-list');
  });

  document.getElementById('edit-despacho-responsavel-list')?.addEventListener('click', event => {
    if (!event.target.matches('.lista-item-remover')) return;
    const index = Number(event.target.dataset.index);
    removerItemLista(event.target.dataset.container, index);
  });
  document.getElementById('edit-despacho-equipe-list')?.addEventListener('click', event => {
    if (!event.target.matches('.lista-item-remover')) return;
    const index = Number(event.target.dataset.index);
    removerItemLista(event.target.dataset.container, index);
  });
  document.getElementById('btn-adicionar-veiculo')?.addEventListener('click', () => {
    adicionarItemLista('edit-despacho-veiculo-input', despachoVeiculos, 'edit-despacho-veiculos-list');
  });
  document.getElementById('edit-despacho-veiculos-list')?.addEventListener('click', event => {
    if (!event.target.matches('.lista-item-remover')) return;
    const index = Number(event.target.dataset.index);
    removerItemLista(event.target.dataset.container, index);
  });

  // Listeners para gerenciamento de itens de despacho
  document.getElementById('btn-adicionar-item-despacho')?.addEventListener('click', adicionarItemDespacho);
  document.getElementById('tabela-itens-despacho')?.addEventListener('click', event => {
    if (event.target.matches('.btn-remover-item-despacho')) {
      const index = Number(event.target.dataset.index);
      removerItemDespacho(index);
      return;
    }

    if (event.target.matches('.btn-retirar-grupo-despacho')) {
      const index = Number(event.target.dataset.index);
      retirarGrupoDespacho(index);
    }
  });

  // Listeners para carregamento de retirada
  document.getElementById('btn-buscar-retirada')?.addEventListener('click', () => {
    const idInput = document.getElementById('edit-despacho-id-retirada');
    if (idInput) {
      buscarItensRetirada(idInput.value);
    }
  });
  
  document.getElementById('edit-despacho-id-retirada')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      buscarItensRetirada(e.target.value);
    }
  });

  document.getElementById('btn-escanear-qr-retirada')?.addEventListener('click', iniciarEscaneamentoQR);

  document.getElementById('btn-adicionar-material')?.addEventListener('click', adicionarMaterialUtilizado);
  document.getElementById('fech-material-nome')?.addEventListener('keydown', e => { if (e.key === 'Enter') adicionarMaterialUtilizado(); });
  document.getElementById('btn-adicionar-base-material')?.addEventListener('click', adicionarMaterialBase);
  document.getElementById('base-material-nome')?.addEventListener('keydown', e => { if (e.key === 'Enter') adicionarMaterialBase(); });
  document.getElementById('base-fotos')?.addEventListener('change', e => {
    adicionarBaseFotos(e.target.files);
    e.target.value = '';
  });
  document.getElementById('base-documentos')?.addEventListener('change', e => {
    adicionarBaseDocumentos(e.target.files);
    e.target.value = '';
  });
  document.getElementById('base-materiais-lista')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-remove-base-idx]');
    if (!btn) return;
    const idx = parseInt(btn.getAttribute('data-remove-base-idx'), 10);
    if (!isNaN(idx)) {
      removerMaterialBase(idx);
    }
  });
  document.getElementById('base-fotos-preview')?.addEventListener('click', e => {
    const removeBtn = e.target.closest('[data-base-foto-index]');
    if (removeBtn) {
      const idx = parseInt(removeBtn.getAttribute('data-base-foto-index'), 10);
      if (!isNaN(idx)) removerBaseFoto(idx);
      return;
    }
    const item = e.target.closest('[data-base-foto-item-index]');
    if (!item) return;
    const idx = parseInt(item.getAttribute('data-base-foto-item-index'), 10);
    if (!isNaN(idx)) abrirModalBasePreview('foto', idx);
  });
  document.getElementById('base-docs-preview')?.addEventListener('click', e => {
    const removeBtn = e.target.closest('[data-base-doc-index]');
    if (removeBtn) {
      const idx = parseInt(removeBtn.getAttribute('data-base-doc-index'), 10);
      if (!isNaN(idx)) removerBaseDoc(idx);
      return;
    }
    const item = e.target.closest('[data-base-doc-item-index]');
    if (!item) return;
    const idx = parseInt(item.getAttribute('data-base-doc-item-index'), 10);
    if (!isNaN(idx)) abrirModalBasePreview('doc', idx);
  });
  document.getElementById('base-file-preview-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) fecharModalBasePreview();
  });
  document.getElementById('preview-close')?.addEventListener('click', fecharModalBasePreview);
  document.getElementById('preview-save-caption')?.addEventListener('click', salvarPreviewCaption);
  document.getElementById('preview-download')?.addEventListener('click', e => {
    e.preventDefault();
    baixarPreviewArquivo();
  });
  document.getElementById('preview-delete')?.addEventListener('click', excluirPreviewArquivo);
  document.getElementById('fech-situacao')?.addEventListener('change', atualizarEstadoBotaoSalvarFechamento);
  document.getElementById('fech-materiais-lista')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-remove-idx]');
    if (!btn) return;
    const idx = parseInt(btn.getAttribute('data-remove-idx'), 10);
    if (!isNaN(idx)) {
      materiaisAdicionados.splice(idx, 1);
      renderizarMateriaisLista();
    }
  });
  document.getElementById('btn-salvar-fechamento')?.addEventListener('click', () => salvarFechamentoOS('finalizar'));

  document.querySelectorAll('.modal-etapa-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      irParaEtapaModal(Number(pill.getAttribute('data-etapa') || '1'));
    });
  });

  // ---- Carga inicial ----
  carregarDashboard();
});

// ============================================================
//  CADASTROS x ABAS DE SERVIÇO
//  Cadastros só tem formulários (Nova O.S., Base, Agendamento). As
//  tabelas ficam nas abas do serviço; Editar abre o cadastro preenchido
//  e, ao salvar, a tela volta para a tabela.
// ============================================================
let basesTabelaCache = [];

function irParaAbaOS(tabId) {
  document.querySelector('.tab-btn[data-tab="' + tabId + '"]')?.click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function abrirSubabaOS(subId) {
  document.querySelectorAll('#cadastros .os-subabas .top-tab2').forEach(b => b.classList.toggle('active', b.dataset.subaba === subId));
  document.querySelectorAll('#cadastros .os-subaba').forEach(p => p.classList.toggle('ativa', p.id === subId));
}

function abrirCadastroOS(subId, focoId) {
  fecharDetalheOS();
  irParaAbaOS('cadastros');
  abrirSubabaOS(subId);
  if (focoId) setTimeout(() => document.getElementById(focoId)?.focus(), 150);
}

function avisoRapidoOS(mensagem, tipo) {
  let el = document.getElementById('os-aviso-rapido');
  if (!el) {
    el = document.createElement('div');
    el.id = 'os-aviso-rapido';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = mensagem;
  el.className = 'os-aviso-rapido visivel' + (tipo === 'erro' ? ' erro' : '');
  clearTimeout(avisoRapidoOS._t);
  avisoRapidoOS._t = setTimeout(() => el.classList.remove('visivel'), 3200);
}

function abrirDetalheOS(titulo, html) {
  const modal = document.getElementById('os-detalhe');
  if (!modal) return;
  document.getElementById('os-detalhe-titulo').textContent = titulo;
  document.getElementById('os-detalhe-corpo').innerHTML = html;
  modal.classList.add('ativo');
  modal.setAttribute('aria-hidden', 'false');
}

function fecharDetalheOS() {
  const modal = document.getElementById('os-detalhe');
  if (!modal) return;
  modal.classList.remove('ativo');
  modal.setAttribute('aria-hidden', 'true');
}

function linhaDetalheOS(rotulo, valor) {
  const texto = valor == null || valor === '' ? '-' : valor;
  return `<div class="os-detalhe-linha"><span>${escapeHtml(rotulo)}</span><strong>${texto}</strong></div>`;
}

async function carregarTabelaBases() {
  const tbody = document.querySelector('#tabela-bases tbody');
  if (tbody && window.htmlCarregandoLogo) tbody.innerHTML = `<tr><td colspan="5">${window.htmlCarregandoLogo('Carregando bases...')}</td></tr>`;
  basesTabelaCache = await listarBases();
  renderTabelaBases();
}

function renderTabelaBases() {
  const tbody = document.querySelector('#tabela-bases tbody');
  if (!tbody) return;
  const busca = (document.getElementById('bases-busca')?.value || '').trim().toLowerCase();
  const lista = basesTabelaCache.filter(b => !busca || [b.id, b.endereco, b.complemento, (b.contratos || []).join(' ')]
    .some(c => String(c || '').toLowerCase().includes(busca)));
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="cronograma-vazio">${basesTabelaCache.length ? 'Nenhuma base com essa busca.' : 'Nenhuma base cadastrada. Use "Cadastrar base".'}</td></tr>`;
    return;
  }
  tbody.innerHTML = lista.map(b => `
    <tr class="os-linha-clicavel" data-base-id="${escapeHtml(b.id)}" tabindex="0" title="Ver detalhes da base">
      <td><strong>${escapeHtml(b.id)}</strong></td>
      <td>${escapeHtml([b.endereco, b.complemento].filter(Boolean).join(' · '))}</td>
      <td>${(b.contratos || []).length ? (b.contratos || []).map(c => `<span class="os-tag">${escapeHtml(c)}</span>`).join(' ') : '<span class="os-texto-suave">Geral</span>'}</td>
      <td>${(b.materiais || []).length}</td>
      <td>${b.link_localizacao ? `<a href="${escapeHtml(b.link_localizacao)}" target="_blank" rel="noopener">Abrir mapa</a>` : '-'}</td>
    </tr>`).join('');
}

function abrirDetalheBase(id) {
  const b = basesTabelaCache.find(x => String(x.id) === String(id));
  if (!b) return;
  const materiais = (b.materiais || []).length
    ? '<ul class="os-detalhe-lista">' + b.materiais.map(m => `<li>${escapeHtml(m.nome)} · ${escapeHtml(m.quantidade)} ${escapeHtml(m.unidade || '')}</li>`).join('') + '</ul>'
    : '';
  abrirDetalheOS(`Base ${b.id}`, `
    <div class="os-detalhe-grade">
      ${linhaDetalheOS('Endereço', escapeHtml(b.endereco))}
      ${linhaDetalheOS('Complemento', escapeHtml(b.complemento))}
      ${linhaDetalheOS('Contratos', escapeHtml((b.contratos || []).join(', ') || 'Geral (todos os contratos)'))}
      ${linhaDetalheOS('Localização', b.link_localizacao ? `<a href="${escapeHtml(b.link_localizacao)}" target="_blank" rel="noopener">Abrir mapa</a>` : '')}
      ${linhaDetalheOS('Observações', escapeHtml(b.obs))}
    </div>
    <h4 class="os-detalhe-subtitulo">Materiais instalados</h4>
    ${materiais || '<p class="os-texto-suave">Nenhum material registrado.</p>'}
    <div class="os-detalhe-acoes" data-base-id="${escapeHtml(b.id)}">
      <button type="button" class="btn-secundario" data-base-acao="editar">Editar</button>
      <button type="button" class="btn-secundario" data-base-acao="excluir">Excluir</button>
    </div>`);
}

function preencherFormularioBase(b) {
  const definir = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  limparCadastroBases();
  definir('base-id', b.id);
  const baseIdInput = document.getElementById('base-id');
  if (baseIdInput) baseIdInput.readOnly = true;
  definir('base-link-localizacao', b.link_localizacao);
  definir('base-endereco', b.endereco);
  definir('base-complemento', b.complemento);
  definir('base-obs', b.obs);
  window.popularChecklistContratos(document.getElementById('base-contratos-lista'), b.contratos || []);
  materiaisBasesAdicionados = (b.materiais || []).map(m => ({ ...m }));
  renderizarBaseMateriaisLista();
}

function inicializarCadastrosOS() {
  document.querySelectorAll('#cadastros .os-subabas .top-tab2').forEach(b => {
    b.addEventListener('click', () => abrirSubabaOS(b.dataset.subaba));
  });
  document.querySelectorAll('#os-detalhe [data-fechar-detalhe]').forEach(el => el.addEventListener('click', fecharDetalheOS));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharDetalheOS(); });

  document.getElementById('btn-nova-os')?.addEventListener('click', () => abrirCadastroOS('os-sub-nova'));
  document.getElementById('btn-nova-base')?.addEventListener('click', () => {
    limparCadastroBases();
    abrirCadastroOS('os-sub-base', 'base-id');
  });
  document.getElementById('bases-busca')?.addEventListener('input', renderTabelaBases);

  const tbody = document.querySelector('#tabela-bases tbody');
  const abrir = e => {
    const linha = e.target.closest('tr[data-base-id]');
    if (linha && !e.target.closest('a') && (e.type === 'click' || e.key === 'Enter')) abrirDetalheBase(linha.dataset.baseId);
  };
  tbody?.addEventListener('click', abrir);
  tbody?.addEventListener('keydown', abrir);

  document.getElementById('os-detalhe-corpo')?.addEventListener('click', async e => {
    const botao = e.target.closest('[data-base-acao]');
    if (!botao) return;
    const id = botao.closest('[data-base-id]').dataset.baseId;
    const base = basesTabelaCache.find(x => String(x.id) === String(id));
    if (botao.dataset.baseAcao === 'editar' && base) {
      preencherFormularioBase(base);
      abrirCadastroOS('os-sub-base', 'base-endereco');
      return;
    }
    if (botao.dataset.baseAcao === 'excluir') {
      if (!confirm(`Excluir a base ${id}?`)) return;
      try {
        const resp = await fetch(osApiUrl(`bases/${encodeURIComponent(id)}`), { method: 'DELETE', headers: authHeaders() });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || data.status !== 'ok') throw new Error(data.mensagem || 'Falha ao excluir base.');
        fecharDetalheOS();
        await carregarTabelaBases();
        avisoRapidoOS('Base excluída.');
        renderizarMapaBasesGerenciamento().catch(() => {});
      } catch (err) {
        avisoRapidoOS(err.message, 'erro');
      }
    }
  });

  carregarTabelaBases();
}

// (o fechamento do bloco principal fica no fim do arquivo: os trechos
//  abaixo usam funções internas, como sairDaEdicaoComAutosave e badgeStatus)



// Leva o seletor de status do ponto ativo para o canto do cabeçalho do
// despacho (no lugar da legenda "Status: ...") enquanto a etapa Pontos
// estiver aberta. O seletor é movido, não copiado, então os eventos continuam.
(function () {
  let ocupado = false;

  function sincronizarStatusPontoCabecalho() {
    if (ocupado) return;
    const cabecalho = document.querySelector('#modal-editar-os .os-pontos-header');
    const lista = document.getElementById('modal-pontos-lista');
    if (!cabecalho || !lista) return;
    let slot = cabecalho.querySelector('.os-status-ponto-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'os-status-ponto-slot';
      cabecalho.appendChild(slot);
    }
    const blocoPontos = lista.closest('.modal-etapa');
    const etapaPontosVisivel = true; // vale em todas as etapas
    const linhaAtiva = lista.querySelector('.ponto-row-modal.ativo') || lista.querySelector('.ponto-row-modal');
    const idAtivo = linhaAtiva ? String(linhaAtiva.id || '').replace('ponto-row-', '') : '';
    const desejado = etapaPontosVisivel && idAtivo
      ? (linhaAtiva.querySelector('.ponto-status-select') || slot.querySelector('.ponto-status-select[data-ponto-id="' + idAtivo + '"]'))
      : null;
    const atual = slot.querySelector('.ponto-status-select');

    if (atual !== (desejado || null) || (desejado && desejado.parentNode !== slot)) {
      ocupado = true;
      if (atual && atual !== desejado) {
        if (atual._origem && atual._origem.isConnected) atual._origem.appendChild(atual);
        else atual.remove();
      }
      if (desejado && desejado.parentNode !== slot) {
        desejado._origem = desejado.parentNode;
        slot.appendChild(desejado);
      }
      ocupado = false;
    }
    cabecalho.classList.toggle('com-status-ponto', !!slot.querySelector('.ponto-status-select'));
  }

  document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('modal-editar-os');
    if (!modal || !window.MutationObserver) return;
    let agendado = false;
    new MutationObserver(() => {
      if (ocupado || agendado) return;
      agendado = true;
      requestAnimationFrame(() => { agendado = false; sincronizarStatusPontoCabecalho(); });
    }).observe(modal, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  });
})();

// Antes de enviar a foto do ponto: mostra a imagem e pede o tipo e a legenda.
// Resolve true se a pessoa confirmar (já com os valores gravados no formulário).
function confirmarFotoPonto(form, arquivo) {
  return new Promise(resolve => {
    const tipoForm = form.querySelector('.ponto-foto-tipo');
    const legendaForm = form.querySelector('.ponto-foto-legenda');
    const url = URL.createObjectURL(arquivo);

    const fundo = document.createElement('div');
    fundo.className = 'foto-confirma-fundo';
    fundo.innerHTML = `
      <div class="foto-confirma" role="dialog" aria-modal="true" aria-labelledby="foto-confirma-titulo">
        <h4 id="foto-confirma-titulo">Confirmar foto</h4>
        <div class="foto-confirma-imagem"><img alt="Pré-visualização da foto" /></div>
        <label class="foto-confirma-campo">
          <span>Tipo</span>
          <select class="foto-confirma-tipo"></select>
        </label>
        <label class="foto-confirma-campo">
          <span>Legenda</span>
          <input type="text" class="foto-confirma-legenda" maxlength="255" placeholder="Descreva a foto (opcional)" />
        </label>
        <div class="foto-confirma-acoes">
          <button type="button" class="foto-confirma-cancelar">Cancelar</button>
          <button type="button" class="foto-confirma-enviar">Enviar</button>
        </div>
      </div>`;
    fundo.querySelector('img').src = url;
    const tipo = fundo.querySelector('.foto-confirma-tipo');
    tipo.innerHTML = tipoForm ? tipoForm.innerHTML : '';
    if (tipoForm) tipo.value = tipoForm.value;
    const legenda = fundo.querySelector('.foto-confirma-legenda');
    legenda.value = legendaForm ? legendaForm.value : '';
    document.body.appendChild(fundo);
    requestAnimationFrame(() => fundo.classList.add('visivel'));
    legenda.focus();

    function fechar(ok) {
      if (ok) {
        if (tipoForm) tipoForm.value = tipo.value;
        if (legendaForm) legendaForm.value = legenda.value;
      }
      document.removeEventListener('keydown', teclas);
      URL.revokeObjectURL(url);
      fundo.remove();
      resolve(ok);
    }
    function teclas(e) {
      if (e.key === 'Escape') fechar(false);
      if (e.key === 'Enter' && e.target === legenda) fechar(true);
    }
    document.addEventListener('keydown', teclas);
    fundo.querySelector('.foto-confirma-cancelar').addEventListener('click', () => fechar(false));
    fundo.querySelector('.foto-confirma-enviar').addEventListener('click', () => fechar(true));
    fundo.addEventListener('click', e => { if (e.target === fundo) fechar(false); });
  });
}

// Campos antigos do relatório (diagnóstico separado, observação da análise,
// materiais em texto livre) ficam ocultos e só aparecem quando a O.S. já
// tem algo salvo neles, para não perder o que foi registrado antes.
(function () {
  function temConteudo(alvo) {
    if (!alvo) return false;
    if (alvo.tagName === 'TEXTAREA' || alvo.tagName === 'INPUT') return String(alvo.value || '').trim() !== '';
    return !!alvo.querySelector('table, li, tr, .material-item');
  }
  function atualizarCamposLegados() {
    document.querySelectorAll('#modal-editar-os .campo-legado').forEach(item => {
      const alvo = document.getElementById(item.dataset.campoLegado);
      item.classList.toggle('campo-legado-visivel', temConteudo(alvo));
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('modal-editar-os');
    if (!modal) return;
    modal.addEventListener('click', e => {
      if (e.target.closest('.modal-etapa-pill')) setTimeout(atualizarCamposLegados, 50);
    });
    setInterval(() => {
      if (getComputedStyle(modal).display !== 'none') atualizarCamposLegados();
    }, 1000);
  });
})();

// Novo ponto: botões explícitos para adicionar ou desistir depois de buscar.
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-confirmar-novo-ponto')?.addEventListener('click', async () => {
    const ordemId = document.getElementById('edit-os-id')?.value;
    if (!ordemId) return;
    await adicionarPontoModal(ordemId);
  });
  document.getElementById('btn-cancelar-novo-ponto')?.addEventListener('click', () => {
    ['novo-ponto-id-local', 'novo-ponto-endereco', 'novo-ponto-complemento'].forEach(id => {
      const campo = document.getElementById(id);
      if (campo) campo.value = '';
    });
    const form = document.getElementById('form-novo-ponto-modal');
    if (form) form.style.display = 'none';
  });
});

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-fechar-modal-os')?.addEventListener('click', () => {
    void sairDaEdicaoComAutosave();
  });
});

// Ao alocar equipe, veículo ou material, o servidor passa os pontos
// "Pendente" para "Em Preparo"; aqui o seletor é atualizado na hora.
(function () {
  if (!window.fetch) return;
  const fetchOriginal = window.fetch.bind(window);
  const ALOCACAO = /\/ordens\/(\d+)\/(funcionarios|veiculos|materiais|equipes-padrao)/;
  window.fetch = async function (recurso, opcoes) {
    const resposta = await fetchOriginal(recurso, opcoes);
    try {
      const url = typeof recurso === 'string' ? recurso : (recurso && recurso.url) || '';
      const metodo = String((opcoes && opcoes.method) || 'GET').toUpperCase();
      const achou = metodo === 'POST' && url.match(ALOCACAO);
      if (achou && resposta.ok) {
        const temPendente = document.querySelector('.ponto-status-select[data-status-atual="Pendente"]');
        if (temPendente) setTimeout(() => recarregarPontosModal(achou[1]), 300);
      }
    } catch (e) { /* nunca atrapalha a requisição original */ }
    return resposta;
  };
})();

// "Chegada no Local" continua sendo o valor gravado; na tela aparece como
// "Em Atuação no Local".
(function () {
  const ROTULO = { 'Chegada no Local': 'Em Atuação no Local' };
  const badgeOriginal = badgeStatus;
  const badgePontoOriginal = badgePontoStatus;
  badgeStatus = function (status) {
    return badgeOriginal(status).replace('>' + status + '<', '>' + (ROTULO[status] || status) + '<');
  };
  badgePontoStatus = function (status) {
    return badgePontoOriginal(status).replace('>' + status + '<', '>' + (ROTULO[status] || status) + '<');
  };
})();

// Chamado pela lista da equipe quando o responsável é escolhido no seletor
// redondo: mantém a lista antiga em sincronia para o salvamento do despacho
// não sobrescrever a escolha, e atualiza o resumo do topo.
window.definirResponsavelEquipeOS = function (nome) {
  despachoResponsaveis = nome ? [nome] : [];
  try { renderizarListaItens('edit-despacho-responsavel-list', despachoResponsaveis); } catch (e) { /* lista antiga oculta */ }
  atualizarResumoDadosOSModal();
};

})(); // fim IIFE
