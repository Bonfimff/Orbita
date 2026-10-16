(function () {
  const FROTA_API_BASE = window.TUNNEL_API_URL || (window.API_BASE_URL + '/');
  const FROTA_LOCAL_KEY = 'svplus_frota_veiculos';
  const FROTA_VEICULOS_IMAGENS_LOCAL_KEY = 'svplus_frota_veiculos_imagens';
  const FROTA_ABAST_LOCAL_KEY = 'svplus_frota_abastecimentos';
  const FROTA_CARTOES_ABAST_LOCAL_KEY = 'svplus_frota_cartoes_abastecimento';
  const FROTA_CHECKLIST_LOCAL_KEY = 'svplus_frota_checklists';
  const FROTA_OFICINAS_LOCAL_KEY = 'svplus_frota_oficinas';
  const FROTA_MAPA_CENTRO = [-22.7856, -43.3117]; // Duque de Caxias - RJ
  const CHECKLIST_ETAPAS = ['frente', 'traseira', 'lateral_esquerda', 'lateral_direita', 'painel'];
  let frotaVeiculosCache = [];
  let frotaChecklistsCache = [];
  let frotaMapa = null;
  let frotaMapaCamada = null;
  let checklistImagens = {
    frente: null,
    traseira: null,
    lateral_esquerda: null,
    lateral_direita: null,
    painel: null,
    extras: [],
  };
  let veiculoEditandoPlaca = null;
  let checklistModalSelecao = null;
  let modalChecklistImagemEl = null;
  let listaEquipamentosVisivel = false;

  function frotaApiUrl(path) {
    let base = (window.TUNNEL_API_URL || FROTA_API_BASE);
    if (!base.endsWith('/')) base += '/';
    if (path.startsWith('/')) path = path.slice(1);
    return base + path;
  }

  function authHeaders(json = false) {
    const h = { 'Authorization': 'Bearer ' + localStorage.getItem('token') };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  function toIntOrNull(value) {
    if (value === '' || value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  function toFloatOrNull(value) {
    if (value === '' || value == null) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100) / 100;
  }

  function formatPlaca(value) {
    return String(value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 7);
  }

  function normalizarStatus(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('manuten')) return 'Em manutenção';
    if (s.includes('inativ')) return 'Inativo';
    return 'Ativo';
  }

  // Situação real do veículo: manutenção e inativo vêm do cadastro; em
  // operação vem da O.S. ativa em que ele está alocado (campo operacao da API).
  function situacaoOperacional(v) {
    const st = normalizarStatus(v && v.status);
    if (st === 'Em manutenção' || st === 'Inativo') return st;
    if (v && v.operacao && !v.operacao.reservado) return 'Em operação';
    return 'Disponível';
  }

  function situacaoBadge(v) {
    const sit = situacaoOperacional(v);
    const classe = {
      'Em operação': 'frota-status-operacao',
      'Em manutenção': 'frota-status-manutencao',
      'Inativo': 'frota-status-inativo',
    }[sit] || 'frota-status-ativo';
    const os = v && v.operacao;
    const extra = os
      ? `<small class="frota-texto-suave">${os.reservado ? 'Reservado para ' : ''}${escapeHtml(os.numero_os || 'O.S. #' + os.ordem_id)}</small>`
      : '';
    return `<span class="frota-status-badge ${classe}">${sit}</span>${extra}`;
  }

  function statusBadge(status) {
    const st = normalizarStatus(status);
    let classe = 'frota-status-ativo';
    if (st === 'Em manutenção') classe = 'frota-status-manutencao';
    if (st === 'Inativo') classe = 'frota-status-inativo';
    return `<span class="frota-status-badge ${classe}">${st}</span>`;
  }

  function escapeHtml(texto) {
    return String(texto || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizarTextoLista(valor) {
    return String(valor || '')
      .split(/\r?\n|,|;/)
      .map(item => item.trim())
      .filter(Boolean)
      .join('; ');
  }

  function obterListaItens(valor) {
    const bruto = String(valor || '')
      .split(/\r?\n|,|;/)
      .map(item => item.trim())
      .filter(Boolean);

    const vistos = new Set();
    const unicos = [];
    bruto.forEach(item => {
      const chave = item.toLowerCase();
      if (vistos.has(chave)) return;
      vistos.add(chave);
      unicos.push(item);
    });

    return unicos;
  }

  function renderListaTags(valor, vazioLabel) {
    const itens = obterListaItens(valor);
    if (!itens.length) {
      return `<span class="frota-lista-tag-vazia">${escapeHtml(vazioLabel || 'Não informado')}</span>`;
    }
    return `<div class="frota-lista-tags">${itens.map(item => `<span class="frota-lista-tag">${escapeHtml(item)}</span>`).join('')}</div>`;
  }

  function hashTexto(valor) {
    const texto = String(valor || 'SVPLUS');
    let hash = 0;
    for (let i = 0; i < texto.length; i += 1) {
      hash = ((hash << 5) - hash) + texto.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function coordenadaEstimativa(placa, indice) {
    const hash = hashTexto(`${placa || ''}-${indice}`);
    const deltaLat = ((hash % 900) / 10000) - 0.045;
    const deltaLng = (((Math.floor(hash / 1000)) % 900) / 10000) - 0.045;
    return [
      FROTA_MAPA_CENTRO[0] + deltaLat,
      FROTA_MAPA_CENTRO[1] + deltaLng,
    ];
  }

  function obterCoordenadasVeiculo(veiculo, indice) {
    const lat = Number(veiculo?.latitude ?? veiculo?.lat);
    const lng = Number(veiculo?.longitude ?? veiculo?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return [lat, lng];
    }
    return coordenadaEstimativa(veiculo?.placa, indice);
  }

  function corMarcador(situacao) {
    if (situacao === 'Em manutenção') return '#f39c12';
    if (situacao === 'Inativo') return '#8d99ae';
    if (situacao === 'Em operação') return '#3E6FB0';
    return '#1a9e55';
  }

  function atualizarResumoMapa(lista) {
    const resumo = document.getElementById('frota-mapa-resumo');
    if (!resumo) return;

    if (!Array.isArray(lista) || !lista.length) {
      resumo.innerHTML = '<div class="frota-mapa-item">Nenhum veículo disponível para exibição no mapa.</div>';
      return;
    }

    const itens = lista.slice(0, 8).map((veiculo, indice) => {
      const coords = obterCoordenadasVeiculo(veiculo, indice);
      const status = situacaoOperacional(veiculo);
      const localizacaoReal = Number.isFinite(Number(veiculo?.latitude ?? veiculo?.lat)) && Number.isFinite(Number(veiculo?.longitude ?? veiculo?.lng));

      return `
        <div class="frota-mapa-item">
          <strong>${escapeHtml(veiculo.placa || 'Sem placa')}</strong> · ${escapeHtml(veiculo.marca || '-')} ${escapeHtml(veiculo.modelo || '')}<br>
          Status: <em>${escapeHtml(status)}</em><br>
          ${localizacaoReal ? 'Posição real' : 'Posição estimada'}: ${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}
        </div>
      `;
    });

    resumo.innerHTML = itens.join('');
  }

  function renderMapaFrota(lista) {
    const mapaEl = document.getElementById('frota-mapa-regiao');
    const aviso = document.getElementById('frota-mapa-sem-biblioteca');
    if (!mapaEl) return;

    if (!window.L) {
      if (aviso) aviso.style.display = 'block';
      atualizarResumoMapa(lista);
      return;
    }

    if (aviso) aviso.style.display = 'none';

    if (!frotaMapa) {
      frotaMapa = L.map(mapaEl).setView(FROTA_MAPA_CENTRO, 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(frotaMapa);
      frotaMapaCamada = L.layerGroup().addTo(frotaMapa);
    }

    if (frotaMapaCamada) {
      frotaMapaCamada.clearLayers();
    }

    if (!Array.isArray(lista) || !lista.length) {
      frotaMapa.setView(FROTA_MAPA_CENTRO, 11);
      atualizarResumoMapa([]);
      setTimeout(() => {
        frotaMapa.invalidateSize();
      }, 40);
      return;
    }

    const bounds = [];
    lista.forEach((veiculo, indice) => {
      const coords = obterCoordenadasVeiculo(veiculo, indice);
      bounds.push(coords);
      const status = situacaoOperacional(veiculo);
      const marker = L.circleMarker(coords, {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: corMarcador(status),
        fillOpacity: 0.92,
      }).addTo(frotaMapaCamada);

      marker.bindPopup(`
        <strong>${escapeHtml(veiculo.placa || 'Sem placa')}</strong><br>
        ${escapeHtml([veiculo.marca, veiculo.modelo].filter(Boolean).join(' ') || 'Veículo')}<br>
        Status: ${escapeHtml(status)}
      `);
    });

    if (bounds.length === 1) {
      frotaMapa.setView(bounds[0], 12);
    } else {
      frotaMapa.fitBounds(bounds, { padding: [30, 30] });
    }

    atualizarResumoMapa(lista);
    setTimeout(() => {
      frotaMapa.invalidateSize();
    }, 40);
  }

  function carregarLocal() {
    try {
      const bruto = localStorage.getItem(FROTA_LOCAL_KEY);
      const lista = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (e) {
      console.warn('Falha ao ler cache local da frota:', e);
      return [];
    }
  }

  function salvarLocal(lista) {
    localStorage.setItem(FROTA_LOCAL_KEY, JSON.stringify(lista));
  }

  function mostrarFeedback(msg, tipo, elementoId = 'frota-feedback') {
    const el = document.getElementById(elementoId);
    if (!el) return;
    el.textContent = msg;
    el.className = tipo === 'erro' ? 'feedback-erro' : 'feedback-sucesso';
    el.style.display = 'block';
    clearTimeout(mostrarFeedback._timer);
    mostrarFeedback._timer = setTimeout(() => {
      el.style.display = 'none';
    }, 3500);
  }

  function atualizarCards(lista) {
    const total = lista.length;
    const contar = sit => lista.filter(v => situacaoOperacional(v) === sit).length;
    const operacao = contar('Em operação');
    const disponivel = contar('Disponível');
    const manutencao = contar('Em manutenção');

    const elTotal = document.getElementById('frota-total-veiculos');
    const elOperacao = document.getElementById('frota-total-operacao');
    const elDisponivel = document.getElementById('frota-total-disponivel');
    const elManutencao = document.getElementById('frota-total-manutencao');

    if (elTotal) elTotal.textContent = String(total);
    if (elOperacao) elOperacao.textContent = String(operacao);
    if (elDisponivel) elDisponivel.textContent = String(disponivel);
    if (elManutencao) elManutencao.textContent = String(manutencao);
  }

  function renderTabela(lista) {
    const tbody = document.querySelector('#frota-tabela-veiculos tbody');
    if (!tbody) {
      // A tabela de veículos mora na aba Veículos (gestão); aqui só os resumos.
      atualizarCards(lista || []);
      renderMapaFrota(lista || []);
      renderGestaoVeiculos();
      return;
    }

    if (!lista.length) {
      tbody.innerHTML = `<tr><td class="frota-vazio" colspan="13">Nenhum veículo cadastrado.</td></tr>`;
      atualizarCards([]);
      renderMapaFrota([]);
      return;
    }

    const linhas = lista.map(v => `
      <tr>
        <td>${escapeHtml(v.modelo)}</td>
        <td>${escapeHtml(v.marca)}</td>
        <td>${escapeHtml(v.placa)}</td>
        <td>${statusBadge(v.status)}</td>
        <td>${v.ano ?? '-'}</td>
        <td>${v.quilometragem ?? '-'}</td>
        <td>${escapeHtml(v.tipo_veiculo || '-')}</td>
        <td>${v.km_revisoes ?? '-'}</td>
        <td>${escapeHtml(v.tipo_combustivel || '-')}</td>
        <td>${v.km_por_litro ?? '-'}</td>
        <td>${renderListaTags(v.itens_checklist_especificos, 'Nenhum item específico')}</td>
        <td>${renderListaTags(v.equipamentos_ferramentas, 'Nenhum equipamento/ferramenta')}</td>
        <td>${escapeHtml(v.obs || '-')}</td>
      </tr>
    `);

    tbody.innerHTML = linhas.join('');
    tbody.querySelectorAll('tr').forEach(row => {
      const placa = row.querySelector('td:nth-child(3)')?.textContent.trim();
      if (!placa) return;
      row.addEventListener('dblclick', () => {
        const veiculo = buscarVeiculoPorPlaca(placa);
        if (veiculo) {
          preencherFormularioVeiculo(veiculo);
          const validacaoPlaca = document.getElementById('frota-placa');
          if (validacaoPlaca) validacaoPlaca.focus();
        }
      });
    });
    atualizarCards(lista);
    renderMapaFrota(lista);
  }

  async function listarVeiculos() {
    try {
      const resp = await fetch(frotaApiUrl('frota/veiculos'), { headers: authHeaders() });
      if (!resp.ok) throw new Error('Falha ao listar via API');
      const data = await resp.json();
      const lista = Array.isArray(data.veiculos) ? data.veiculos : [];
      salvarLocal(lista);
      frotaVeiculosCache = lista;
      preencherSelectPlacasAbastecimento(lista);
      preencherSelectPlacasChecklist(lista);
      preencherSelectPlacasManutencao(lista);
      renderGestaoVeiculos();
      return lista;
    } catch (err) {
      console.warn('API de frota indisponível, usando cache local:', err.message);
      const lista = carregarLocal();
      frotaVeiculosCache = lista;
      preencherSelectPlacasAbastecimento(lista);
      preencherSelectPlacasChecklist(lista);
      return lista;
    }
  }

  async function salvarVeiculo(payload) {
    try {
      const resp = await fetch(frotaApiUrl('frota/veiculos'), {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const dataErro = await resp.json().catch(() => ({}));
        throw new Error(dataErro.mensagem || 'Erro ao salvar veículo na API.');
      }

      return await resp.json();
    } catch (err) {
      const lista = carregarLocal();
      const placaExiste = lista.some(v => String(v.placa || '').toUpperCase() === payload.placa.toUpperCase());
      const placaComparada = veiculoEditandoPlaca ? veiculoEditandoPlaca.toUpperCase() : null;
      if (placaExiste && payload.placa.toUpperCase() !== placaComparada) {
        throw new Error('Já existe veículo com essa placa.');
      }

      if (placaComparada && payload.placa.toUpperCase() === placaComparada) {
        const index = lista.findIndex(v => String(v.placa || '').toUpperCase() === placaComparada);
        if (index >= 0) {
          lista[index] = { ...lista[index], ...payload };
          salvarLocal(lista);
          return { status: 'ok', veiculo: lista[index], local: true };
        }
      }

      const novo = {
        ...payload,
        id: Date.now(),
        created_at: new Date().toISOString(),
      };
      lista.unshift(novo);
      salvarLocal(lista);
      return { status: 'ok', veiculo: novo, local: true };
    }
  }

  function coletarFormulario() {
    const modelo = document.getElementById('frota-modelo').value.trim();
    const marca = document.getElementById('frota-marca').value.trim();
    const placa = formatPlaca(document.getElementById('frota-placa').value);
    const status = normalizarStatus(document.getElementById('frota-status').value);

    if (!modelo || !marca || !placa) {
      throw new Error('Preencha os campos obrigatórios: Modelo, Marca e Placa.');
    }

    return {
      modelo,
      marca,
      placa,
      status,
      ano: toIntOrNull(document.getElementById('frota-ano').value),
      quilometragem: toIntOrNull(document.getElementById('frota-quilometragem').value),
      tipo_veiculo: document.getElementById('frota-tipo').value || null,
      km_revisoes: toIntOrNull(document.getElementById('frota-km-revisoes').value),
      tipo_combustivel: document.getElementById('frota-combustivel').value || null,
      km_por_litro: toFloatOrNull(document.getElementById('frota-km-por-litro').value),
      itens_checklist_especificos: normalizarTextoLista(document.getElementById('frota-itens-checklist').value) || null,
      equipamentos_ferramentas: normalizarTextoLista(document.getElementById('frota-equipamentos').value) || null,
      obs: document.getElementById('frota-obs').value.trim() || null,
      contratos: window.coletarContratosSelecionados(document.getElementById('veiculo-contratos-lista')),
    };
  }

  function carregarImagensVeiculosLocal() {
    try {
      const bruto = localStorage.getItem(FROTA_VEICULOS_IMAGENS_LOCAL_KEY);
      const mapa = bruto ? JSON.parse(bruto) : {};
      return mapa && typeof mapa === 'object' ? mapa : {};
    } catch (e) {
      console.warn('Falha ao ler cache de imagens de veículos:', e);
      return {};
    }
  }

  function salvarImagensVeiculosLocal(mapa) {
    try {
      localStorage.setItem(FROTA_VEICULOS_IMAGENS_LOCAL_KEY, JSON.stringify(mapa));
    } catch (e) {
      console.warn('Falha ao salvar cache de imagens de veículos:', e);
    }
  }

  function obterImagemVeiculoPorPlaca(placa) {
    const placaFormatada = formatPlaca(placa);
    if (!placaFormatada) return null;
    const mapa = carregarImagensVeiculosLocal();
    return mapa[placaFormatada] || null;
  }

  function limparFormulario() {
    const form = document.getElementById('frota-veiculo-form');
    if (form) {
      form.reset();
    }
    sairModoEdicaoVeiculo();
    const preview = document.getElementById('frota-veiculo-imagem-preview');
    const placeholder = document.getElementById('frota-veiculo-imagem-placeholder');
    if (preview && placeholder) {
      preview.removeAttribute('src');
      preview.style.display = 'none';
      placeholder.style.display = 'block';
    }
    window.popularChecklistContratos(document.getElementById('veiculo-contratos-lista'), []);
  }

  function sairModoEdicaoVeiculo() {
    veiculoEditandoPlaca = null;
    const botaoSalvar = document.getElementById('frota-veiculo-salvar');
    if (botaoSalvar) {
      botaoSalvar.textContent = 'Cadastrar veículo';
    }
  }

  function preencherFormularioVeiculo(veiculo) {
    if (!veiculo) return;
    document.getElementById('frota-modelo').value = veiculo.modelo || '';
    document.getElementById('frota-marca').value = veiculo.marca || '';
    document.getElementById('frota-placa').value = formatPlaca(veiculo.placa || '');
    document.getElementById('frota-status').value = veiculo.status || 'Ativo';
    document.getElementById('frota-ano').value = veiculo.ano ?? '';
    document.getElementById('frota-quilometragem').value = veiculo.quilometragem ?? '';
    document.getElementById('frota-tipo').value = veiculo.tipo_veiculo || '';
    document.getElementById('frota-km-revisoes').value = veiculo.km_revisoes ?? '';
    document.getElementById('frota-combustivel').value = veiculo.tipo_combustivel || '';
    document.getElementById('frota-km-por-litro').value = veiculo.km_por_litro ?? '';
    document.getElementById('frota-itens-checklist').value = Array.isArray(veiculo.itens_checklist_especificos) ? veiculo.itens_checklist_especificos.join(', ') : veiculo.itens_checklist_especificos || '';
    document.getElementById('frota-equipamentos').value = Array.isArray(veiculo.equipamentos_ferramentas) ? veiculo.equipamentos_ferramentas.join(', ') : veiculo.equipamentos_ferramentas || '';
    document.getElementById('frota-obs').value = veiculo.obs || '';
    window.popularChecklistContratos(document.getElementById('veiculo-contratos-lista'), veiculo.contratos || []);
    veiculoEditandoPlaca = formatPlaca(veiculo.placa || '');
    const botaoSalvar = document.getElementById('frota-veiculo-salvar');
    if (botaoSalvar) {
      botaoSalvar.textContent = 'Atualizar veículo';
    }
    const imagem = obterImagemVeiculoPorPlaca(veiculo.placa);
    const preview = document.getElementById('frota-veiculo-imagem-preview');
    const placeholder = document.getElementById('frota-veiculo-imagem-placeholder');
    if (imagem && preview && placeholder) {
      preview.src = imagem;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
    }
  }

  function nowDataHora() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    const hora = String(agora.getHours()).padStart(2, '0');
    const minuto = String(agora.getMinutes()).padStart(2, '0');

    return {
      data: `${ano}-${mes}-${dia}`,
      hora: `${hora}:${minuto}`,
    };
  }

  function preencherDataHoraAbastecimento() {
    const dataInput = document.getElementById('frota-abast-data');
    const horaInput = document.getElementById('frota-abast-hora');
    if (!dataInput || !horaInput) return;

    const agora = nowDataHora();
    dataInput.value = agora.data;
    horaInput.value = agora.hora;
  }

  function preencherSelectPlacasAbastecimento(veiculos) {
    const select = document.getElementById('frota-abast-placa');
    if (!select) return;

    const valorAtual = select.value;
    const itens = Array.isArray(veiculos) ? veiculos : [];

    const opcoes = itens
      .map(v => {
        const placa = formatPlaca(v.placa || '');
        const descricao = [v.marca, v.modelo].filter(Boolean).join(' ');
        if (!placa) return '';
        return `<option value="${escapeHtml(placa)}">${escapeHtml(placa)}${descricao ? ` - ${escapeHtml(descricao)}` : ''}</option>`;
      })
      .filter(Boolean)
      .join('');

    select.innerHTML = `<option value="">Selecione o veículo...</option>${opcoes}`;
    if (valorAtual && Array.from(select.options).some(o => o.value === valorAtual)) {
      select.value = valorAtual;
    }
  }

  function preencherSelectPlacasChecklist(veiculos) {
    const select = document.getElementById('frota-checklist-placa');
    if (!select) return;

    const valorAtual = select.value;
    const itens = Array.isArray(veiculos) ? veiculos : [];

    const opcoes = itens
      .map(v => {
        const placa = formatPlaca(v.placa || '');
        const descricao = [v.marca, v.modelo].filter(Boolean).join(' ');
        if (!placa) return '';
        return `<option value="${escapeHtml(placa)}">${escapeHtml(placa)}${descricao ? ` - ${escapeHtml(descricao)}` : ''}</option>`;
      })
      .filter(Boolean)
      .join('');

    select.innerHTML = `<option value="">Selecione o veículo...</option>${opcoes}`;
    if (valorAtual && Array.from(select.options).some(o => o.value === valorAtual)) {
      select.value = valorAtual;
    }

    atualizarInfoChecklistVeiculo(select.value);
  }

  function preencherSelectPlacasCartoesAbastecimento(veiculos) {
    const select = document.getElementById('frota-cartao-abastecimento-placa');
    if (!select) return;

    const valorAtual = select.value;
    const itens = Array.isArray(veiculos) ? veiculos : [];

    const opcoes = itens
      .map(v => {
        const placa = formatPlaca(v.placa || '');
        const descricao = [v.marca, v.modelo].filter(Boolean).join(' ');
        if (!placa) return '';
        return `<option value="${escapeHtml(placa)}">${escapeHtml(placa)}${descricao ? ` - ${escapeHtml(descricao)}` : ''}</option>`;
      })
      .filter(Boolean)
      .join('');

    select.innerHTML = `<option value="">Sem vínculo</option>${opcoes}`;
    if (valorAtual && Array.from(select.options).some(o => o.value === valorAtual)) {
      select.value = valorAtual;
    }
  }

  function buscarCartaoAbastecimentoPorPlaca(placa) {
    const placaFormatada = formatPlaca(placa);
    if (!placaFormatada) return null;

    const lista = frotaCartoesCache || carregarCartoesAbastecimentoLocal();
    const cartoes = Array.isArray(lista) ? lista : [];
    const correspondentes = cartoes.filter(item => formatPlaca(item.placa) === placaFormatada);
    if (!correspondentes.length) return null;

    const ativo = correspondentes.find(item => String(item.status).toLowerCase() === 'ativo');
    return ativo || correspondentes[0] || null;
  }

  function preencherCartaoAbastecimentoPorPlaca(placa) {
    const inputCartao = document.getElementById('frota-abast-cartao');
    if (!inputCartao) return;

    const cartao = buscarCartaoAbastecimentoPorPlaca(placa);
    if (!cartao) return;

    const valorAtual = inputCartao.value.trim();
    if (!valorAtual || valorAtual !== cartao.numero) {
      inputCartao.value = cartao.numero || '';
    }
  }

  function buscarVeiculoPorPlaca(placa) {
    const placaFormatada = formatPlaca(placa);
    if (!placaFormatada || !Array.isArray(frotaVeiculosCache)) return null;
    return frotaVeiculosCache.find(v => formatPlaca(v.placa) === placaFormatada) || null;
  }

  function obterUltimoKmChecklistPorPlaca(placa) {
    const placaFormatada = formatPlaca(placa);
    if (!placaFormatada || !Array.isArray(frotaChecklistsCache)) return null;

    const registro = frotaChecklistsCache.find(item => formatPlaca(item?.placa) === placaFormatada);
    const km = toIntOrNull(registro?.km);
    return km == null ? null : km;
  }

  function preencherKmChecklistPorPlaca(placa) {
    const inputKm = document.getElementById('frota-checklist-km');
    if (!inputKm) return;

    const placaFormatada = formatPlaca(placa);
    if (!placaFormatada) {
      inputKm.value = '';
      return;
    }

    const ultimoKmChecklist = obterUltimoKmChecklistPorPlaca(placaFormatada);
    if (ultimoKmChecklist != null) {
      inputKm.value = String(ultimoKmChecklist);
      return;
    }

    const veiculo = buscarVeiculoPorPlaca(placaFormatada);
    const kmVeiculo = toIntOrNull(veiculo?.quilometragem);
    inputKm.value = kmVeiculo != null ? String(kmVeiculo) : '';
  }

  function atualizarInfoChecklistVeiculo(placa) {
    const wrap = document.getElementById('frota-checklist-veiculo-info');
    const itensEl = document.getElementById('frota-checklist-itens-obrigatorios');
    const equipamentosListaEl = document.getElementById('frota-checklist-equipamentos-lista');
    const imagemPreview = document.getElementById('frota-checklist-veiculo-imagem-preview');
    const imagemPlaceholder = document.getElementById('frota-checklist-veiculo-imagem-placeholder');
    const imagemBox = document.getElementById('frota-checklist-veiculo-imagem-box');
    if (!wrap || !itensEl || !equipamentosListaEl || !imagemPreview || !imagemPlaceholder || !imagemBox) return;

    const veiculo = buscarVeiculoPorPlaca(placa);
    const imagem = veiculo?.imagem_veiculo || obterImagemVeiculoPorPlaca(placa);
    if (imagem) {
      imagemPreview.src = imagem;
      imagemPreview.style.display = 'block';
      imagemPlaceholder.style.display = 'none';
    } else {
      imagemPreview.removeAttribute('src');
      imagemPreview.style.display = 'none';
      imagemPlaceholder.style.display = 'block';
    }

    if (!veiculo) {
      wrap.style.display = 'block';
      itensEl.innerHTML = '<li>Nenhum item específico configurado.</li>';
      equipamentosListaEl.innerHTML = '<li>Selecione um veículo para visualizar a lista.</li>';
      definirVisibilidadeListaEquipamentos(false);
      return;
    }

    const itensChecklist = obterListaItens(veiculo.itens_checklist_especificos);
    const equipamentos = obterListaItens(veiculo.equipamentos_ferramentas);

    wrap.style.display = 'block';
    itensEl.innerHTML = itensChecklist.length
      ? itensChecklist.map(item => `<li>${escapeHtml(item)}</li>`).join('')
      : '<li>Nenhum item específico configurado.</li>';
    equipamentosListaEl.innerHTML = equipamentos.length
      ? equipamentos.map(item => `<li>${escapeHtml(item)}</li>`).join('')
      : '<li>Nenhum equipamento/ferramenta associado.</li>';
    definirVisibilidadeListaEquipamentos(false);
  }

  function definirVisibilidadeListaEquipamentos(exibir) {
    const detalhes = document.getElementById('frota-checklist-veiculo-detalhes');
    const botao = document.getElementById('frota-checklist-toggle-lista-equipamentos');
    if (!detalhes || !botao) return;

    listaEquipamentosVisivel = !!exibir;
    detalhes.style.display = listaEquipamentosVisivel ? 'block' : 'none';
    botao.classList.toggle('ativo', listaEquipamentosVisivel);
    botao.setAttribute('aria-expanded', listaEquipamentosVisivel ? 'true' : 'false');
    botao.setAttribute('title', listaEquipamentosVisivel ? 'Ocultar lista de itens específicos e equipamentos/ferramentas' : 'Mostrar lista de itens específicos e equipamentos/ferramentas');
    botao.setAttribute('aria-label', listaEquipamentosVisivel ? 'Ocultar lista de itens específicos e equipamentos/ferramentas' : 'Mostrar lista de itens específicos e equipamentos/ferramentas');
  }

  function atualizarVisibilidadeObsChecklist() {
    const confItens = document.getElementById('frota-checklist-conf-itens')?.value;
    const confEquip = document.getElementById('frota-checklist-conf-equipamentos')?.value;
    const wrapObsItens = document.getElementById('frota-checklist-obs-itens-wrap');
    const wrapObsEquip = document.getElementById('frota-checklist-obs-equipamentos-wrap');
    const obsItens = document.getElementById('frota-checklist-obs-itens');
    const obsEquip = document.getElementById('frota-checklist-obs-equipamentos');

    const precisaObsItens = confItens === 'Não está conforme';
    const precisaObsEquip = confEquip === 'Não está conforme';

    if (wrapObsItens) wrapObsItens.style.display = precisaObsItens ? '' : 'none';
    if (wrapObsEquip) wrapObsEquip.style.display = precisaObsEquip ? '' : 'none';
    if (obsItens) obsItens.required = precisaObsItens;
    if (obsEquip) obsEquip.required = precisaObsEquip;

    if (!precisaObsItens && obsItens) obsItens.value = '';
    if (!precisaObsEquip && obsEquip) obsEquip.value = '';
  }

  function obterNomeUsuarioLogado() {
    function limparNome(raw) {
      let nome = String(raw || '').trim();
      nome = nome.replace(/^bem[-\s]*vindo\s*,?\s*/i, '').trim();
      nome = nome.replace(/[!.,;:\-\s]+$/g, '').trim();
      return nome;
    }

    const elLogged = document.getElementById('logged-user');
    const nomeTela = limparNome(elLogged?.textContent || '');
    if (nomeTela) return nomeTela;

    try {
      const usuarioObj = JSON.parse(localStorage.getItem('usuario') || '{}');
      const nomeObj = limparNome(usuarioObj.nome || usuarioObj.username || usuarioObj.usuario || '');
      if (nomeObj) return nomeObj;
    } catch (_) {
      // Ignora falha de parse e tenta outras fontes.
    }

    const nomeLocal = limparNome(localStorage.getItem('usuario_nome') || localStorage.getItem('username') || '');
    if (nomeLocal) return nomeLocal;

    try {
      const token = localStorage.getItem('token');
      if (token && token.includes('.')) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const nomeToken = limparNome(payload.username || payload.nome || payload.usuario || '');
        if (nomeToken) return nomeToken;
      }
    } catch (_) {
      // Ignora falha de leitura do token.
    }

    return 'Usuário do sistema';
  }

  function preencherMotoristaChecklist() {
    const input = document.getElementById('frota-checklist-motorista');
    if (!input) return;
    input.value = obterNomeUsuarioLogado();
  }

  function carregarOficinasLocal() {
    try {
      const bruto = localStorage.getItem(FROTA_OFICINAS_LOCAL_KEY);
      const lista = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (e) {
      console.warn('Falha ao ler cache local de oficinas:', e);
      return [];
    }
  }

  function salvarOficinasLocal(lista) {
    localStorage.setItem(FROTA_OFICINAS_LOCAL_KEY, JSON.stringify(lista));
  }

  function normalizarUrlLocalizacao(url) {
    const valor = String(url || '').trim();
    if (!valor) return null;
    if (/^https?:\/\//i.test(valor)) return valor;
    return `https://${valor}`;
  }

  function renderTabelaOficinas(lista) {
    const tbody = document.querySelector('#frota-tabela-oficinas tbody');
    if (!tbody) return;

    if (!Array.isArray(lista) || !lista.length) {
      tbody.innerHTML = '<tr><td class="frota-vazio" colspan="10">Nenhuma oficina cadastrada.</td></tr>';
      return;
    }

    const linhas = lista.map(item => {
      const link = item.url_localizacao
        ? `<a class="frota-link-localizacao" href="${escapeHtml(item.url_localizacao)}" target="_blank" rel="noopener">Abrir mapa</a>`
        : '-';

      return `
        <tr>
          <td>${escapeHtml(item.nome_oficina || '-')}</td>
          <td>${escapeHtml(item.endereco || '-')}</td>
          <td>${link}</td>
          <td>${escapeHtml(item.servicos || '-')}</td>
          <td>${escapeHtml(item.area_atendimento || '-')}</td>
          <td>${escapeHtml(item.horario_funcionamento || '-')}</td>
            <td>${escapeHtml(item.responsavel_tecnico || '-')}</td>
            <td>${escapeHtml(item.cnpj || '-')}</td>
          <td>${escapeHtml(item.numero_contato || '-')}</td>
          <td>${escapeHtml(item.obs || '-')}</td>
        </tr>
      `;
    });

    tbody.innerHTML = linhas.join('');
  }

  async function listarOficinas() {
    try {
      const resp = await fetch(frotaApiUrl('frota/oficinas'), { headers: authHeaders() });
      if (!resp.ok) throw new Error('Falha ao listar oficinas via API');
      const data = await resp.json();
      const lista = Array.isArray(data.oficinas) ? data.oficinas : [];
      salvarOficinasLocal(lista);
      return lista;
    } catch (err) {
      console.warn('API de oficinas indisponível, usando cache local:', err.message);
      return carregarOficinasLocal();
    }
  }

  async function salvarOficina(payload) {
    const idEdicao = document.getElementById('frota-oficina-id')?.value;
    if (idEdicao) return chamarApi(`frota/oficinas/${idEdicao}`, 'PUT', payload);
    try {
      const resp = await fetch(frotaApiUrl('frota/oficinas'), {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const dataErro = await resp.json().catch(() => ({}));
        throw new Error(dataErro.mensagem || 'Erro ao salvar oficina na API.');
      }

      return await resp.json();
    } catch (err) {
      const lista = carregarOficinasLocal();
      const novo = {
        ...payload,
        id: Date.now(),
        created_at: new Date().toISOString(),
      };
      lista.unshift(novo);
      salvarOficinasLocal(lista);
      return { status: 'ok', oficina: novo, local: true };
    }
  }

  function coletarFormularioOficina() {
    const nomeOficina = document.getElementById('frota-oficina-nome').value.trim();
    const endereco = document.getElementById('frota-oficina-endereco').value.trim();
    const urlLocalizacao = normalizarUrlLocalizacao(document.getElementById('frota-oficina-url').value);
    const servicos = document.getElementById('frota-oficina-servicos').value.trim();
    const areaAtendimento = document.getElementById('frota-oficina-area').value.trim() || null;
    const horarioFuncionamento = document.getElementById('frota-oficina-horario').value.trim();
    const numeroContato = document.getElementById('frota-oficina-contato').value.trim() || null;
    const obs = document.getElementById('frota-oficina-obs').value.trim() || null;

    if (!nomeOficina || !endereco || !servicos || !horarioFuncionamento) {
      throw new Error('Preencha os campos obrigatórios da oficina.');
    }

    return {
      nome_oficina: nomeOficina,
      endereco,
      url_localizacao: urlLocalizacao,
      servicos,
      area_atendimento: areaAtendimento,
      horario_funcionamento: horarioFuncionamento,
      numero_contato: numeroContato,
      obs,
        responsavel_tecnico: document.getElementById('frota-oficina-responsavel').value.trim() || null,
        cnpj: document.getElementById('frota-oficina-cnpj').value.trim() || null,
    };
  }

  function limparFormularioOficina() {
    const form = document.getElementById('frota-oficina-form');
    if (form) form.reset();
    const id = document.getElementById('frota-oficina-id');
    if (id) id.value = '';
    const botao = document.querySelector('#frota-oficina-form button[type="submit"]');
    if (botao) botao.textContent = 'Cadastrar oficina';
  }

  function carregarAbastecimentosLocal() {
    try {
      const bruto = localStorage.getItem(FROTA_ABAST_LOCAL_KEY);
      const lista = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (e) {
      console.warn('Falha ao ler cache local de abastecimentos:', e);
      return [];
    }
  }

  function salvarAbastecimentosLocal(lista) {
    localStorage.setItem(FROTA_ABAST_LOCAL_KEY, JSON.stringify(lista));
  }

  function arquivoParaDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Falha ao ler arquivo do comprovante.'));
      reader.readAsDataURL(file);
    });
  }

  function atualizarPreviewComprovante() {
    const input = document.getElementById('frota-abast-comprovante');
    const wrap = document.getElementById('frota-abast-preview-wrap');
    const img = document.getElementById('frota-abast-preview');

    if (!input || !wrap || !img) return;
    const file = input.files && input.files[0];
    if (!file) {
      img.removeAttribute('src');
      wrap.style.display = 'none';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    wrap.style.display = 'block';
    img.onload = () => URL.revokeObjectURL(objectUrl);
  }

  function atualizarPreviewImagemVeiculo() {
    const input = document.getElementById('frota-veiculo-imagem');
    const preview = document.getElementById('frota-veiculo-imagem-preview');
    const placeholder = document.getElementById('frota-veiculo-imagem-placeholder');

    if (!input || !preview || !placeholder) return;
    const file = input.files && input.files[0];
    if (!file) {
      preview.removeAttribute('src');
      preview.style.display = 'none';
      placeholder.style.display = 'block';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    preview.src = objectUrl;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    preview.onload = () => URL.revokeObjectURL(objectUrl);
  }

  async function listarAbastecimentos() {
    try {
      const resp = await fetch(frotaApiUrl('frota/abastecimentos'), { headers: authHeaders() });
      if (!resp.ok) throw new Error('Falha ao listar abastecimentos via API');
      const data = await resp.json();
      const lista = Array.isArray(data.abastecimentos) ? data.abastecimentos : [];
      salvarAbastecimentosLocal(lista);
      return lista;
    } catch (err) {
      console.warn('API de abastecimentos indisponível, usando cache local:', err.message);
      return carregarAbastecimentosLocal();
    }
  }

  async function salvarAbastecimento(payload) {
    try {
      const resp = await fetch(frotaApiUrl('frota/abastecimentos'), {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const dataErro = await resp.json().catch(() => ({}));
        throw new Error(dataErro.mensagem || 'Erro ao salvar abastecimento na API.');
      }

      return await resp.json();
    } catch (err) {
      const lista = carregarAbastecimentosLocal();
      const novo = {
        ...payload,
        id: Date.now(),
        created_at: new Date().toISOString(),
      };
      lista.unshift(novo);
      salvarAbastecimentosLocal(lista);
      return { status: 'ok', abastecimento: novo, local: true };
    }
  }

  function renderTabelaAbastecimentos(lista) {
    const tbody = document.querySelector('#frota-tabela-abastecimentos tbody');
    if (!tbody) return;

    if (!Array.isArray(lista) || !lista.length) {
      tbody.innerHTML = '<tr><td class="frota-vazio" colspan="6">Nenhum abastecimento cadastrado.</td></tr>';
      return;
    }

    const linhas = lista.map(item => {
      const comprovante = item.comprovante_foto
        ? `<a class="frota-link-comprovante" href="${item.comprovante_foto}" target="_blank" rel="noopener">Ver foto</a>`
        : '-';

      return `
        <tr>
          <td>${escapeHtml(item.data_abastecimento || '-')}</td>
          <td>${escapeHtml(item.hora_abastecimento || '-')}</td>
          <td>${escapeHtml(item.placa || '-')}</td>
          <td>${escapeHtml(item.numero_cartao || '-')}</td>
          <td>${escapeHtml(item.obs || '-')}</td>
          <td>${comprovante}</td>
        </tr>
      `;
    });

    tbody.innerHTML = linhas.join('');
  }

  function carregarCartoesAbastecimentoLocal() {
    try {
      const bruto = localStorage.getItem(FROTA_CARTOES_ABAST_LOCAL_KEY);
      const lista = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (e) {
      console.warn('Falha ao ler cache local de cartões de abastecimento:', e);
      return [];
    }
  }

  function salvarCartoesAbastecimentoLocal(lista) {
    localStorage.setItem(FROTA_CARTOES_ABAST_LOCAL_KEY, JSON.stringify(lista));
  }

  async function salvarCartaoAbastecimento(payload) {
    const idEdicao = document.getElementById('frota-cartao-abastecimento-id')?.value;
    if (idEdicao) return chamarApi(`frota/cartoes/${idEdicao}`, 'PUT', payload);
    try {
      const resp = await fetch(frotaApiUrl('frota/cartoes'), {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.status === 'ok') return data;
      if (resp.status === 400) throw Object.assign(new Error(data.mensagem || 'Dados inválidos.'), { validacao: true });
      throw new Error(data.mensagem || 'Erro ao salvar cartão na API.');
    } catch (err) {
      if (err.validacao) throw err;
      console.warn('API de cartões indisponível, salvando localmente:', err.message);
    }
    const lista = carregarCartoesAbastecimentoLocal();
    const novo = {
      id: Date.now(),
      created_at: new Date().toISOString(),
      ...payload,
    };
    lista.unshift(novo);
    salvarCartoesAbastecimentoLocal(lista);
    return { status: 'ok', cartao: novo, local: true };
  }

  function renderTabelaCartoesAbastecimento(lista) {
    const tbody = document.querySelector('#frota-tabela-cartoes-abastecimento tbody');
    if (!tbody) return;

    if (!Array.isArray(lista) || !lista.length) {
      tbody.innerHTML = '<tr><td class="frota-vazio" colspan="6">Nenhum cartão cadastrado.</td></tr>';
      return;
    }

    const linhas = lista.map(item => `
      <tr>
        <td>${escapeHtml(item.nome || '-')}</td>
        <td>${escapeHtml(item.numero || '-')}</td>
        <td>${escapeHtml(item.placa || '-')}</td>
        <td>${escapeHtml(item.bandeira || '-')}</td>
        <td>${escapeHtml(item.status || '-')}</td>
        <td>${escapeHtml(item.obs || '-')}</td>
      </tr>
    `);

    tbody.innerHTML = linhas.join('');
  }

  function coletarFormularioCartaoAbastecimento() {
    const nome = document.getElementById('frota-cartao-abastecimento-nome').value.trim();
    const numero = document.getElementById('frota-cartao-abastecimento-numero').value.trim();
    const placa = formatPlaca(document.getElementById('frota-cartao-abastecimento-placa').value);
    const bandeira = document.getElementById('frota-cartao-abastecimento-bandeira').value.trim() || null;
    const status = document.getElementById('frota-cartao-abastecimento-status').value;
    const obs = document.getElementById('frota-cartao-abastecimento-obs').value.trim() || null;

    if (!nome) throw new Error('Informe o nome do cartão de abastecimento.');
    if (!numero) throw new Error('Informe o número do cartão de abastecimento.');

    return { nome, numero, placa: placa || null, bandeira, status, obs };
  }

  function limparFormularioCartaoAbastecimento() {
    const form = document.getElementById('frota-cartoes-abastecimento-form');
    if (form) form.reset();
    const id = document.getElementById('frota-cartao-abastecimento-id');
    if (id) id.value = '';
    const botao = document.querySelector('#frota-cartoes-abastecimento-form button[type="submit"]');
    if (botao) botao.textContent = 'Salvar cartão';
  }

  async function coletarFormularioAbastecimento() {
    const placa = formatPlaca(document.getElementById('frota-abast-placa').value);
    const numeroCartao = document.getElementById('frota-abast-cartao').value.trim();
    const dataAbastecimento = document.getElementById('frota-abast-data').value;
    const horaAbastecimento = document.getElementById('frota-abast-hora').value;
    const obs = document.getElementById('frota-abast-obs').value.trim() || null;
    const comprovanteInput = document.getElementById('frota-abast-comprovante');
    const file = comprovanteInput?.files?.[0];

    if (!placa) throw new Error('Selecione a placa do veículo abastecido.');
    if (!numeroCartao) throw new Error('Informe o número do cartão de abastecimento.');
    if (!dataAbastecimento || !horaAbastecimento) throw new Error('Data e hora devem estar preenchidas automaticamente.');
    if (!file) throw new Error('Anexe a foto do comprovante.');
    if (file.size > 6 * 1024 * 1024) throw new Error('A imagem do comprovante deve ter no máximo 6MB.');

    const comprovanteFoto = await arquivoParaDataUrl(file);

    return {
      placa,
      numero_cartao: numeroCartao,
      data_abastecimento: dataAbastecimento,
      hora_abastecimento: horaAbastecimento,
      comprovante_foto: comprovanteFoto,
      obs,
    };
  }

  function limparFormularioAbastecimento() {
    const form = document.getElementById('frota-abastecimento-form');
    if (form) form.reset();
    preencherDataHoraAbastecimento();
    atualizarPreviewComprovante();
  }

  function carregarChecklistsLocal() {
    try {
      const bruto = localStorage.getItem(FROTA_CHECKLIST_LOCAL_KEY);
      const lista = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (e) {
      console.warn('Falha ao ler cache local de checklists:', e);
      return [];
    }
  }

  function salvarChecklistsLocal(lista) {
    localStorage.setItem(FROTA_CHECKLIST_LOCAL_KEY, JSON.stringify(lista));
  }

  function formatDataHoraChecklist(valor) {
    const d = valor ? new Date(valor) : new Date();
    const data = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${data} ${hora}`;
  }

  function legendaChecklistTexto(valor) {
    const legendaMap = {
      frente: 'Frente',
      traseira: 'Traseira',
      lateral_esquerda: 'Lateral esquerda',
      lateral_direita: 'Lateral direita',
      painel: 'Painel',
      extra: 'Foto extra',
    };
    return legendaMap[valor] || 'Imagem';
  }

  function parseFotosExtrasChecklist(valor) {
    if (!valor) return [];
    if (Array.isArray(valor)) return valor.filter(Boolean);
    if (typeof valor === 'string') {
      try {
        const parsed = JSON.parse(valor);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch (_) {
        return [];
      }
    }
    return [];
  }

  function resetChecklistImagens() {
    checklistImagens = {
      frente: null,
      traseira: null,
      lateral_esquerda: null,
      lateral_direita: null,
      painel: null,
      extras: [],
    };
  }

  function proximaLegendaChecklist() {
    const proxima = CHECKLIST_ETAPAS.find(etapa => !checklistImagens[etapa]);
    return proxima || 'extra';
  }

  function atualizarStatusChecklist() {
    const progresso = document.getElementById('frota-checklist-progresso');
    if (!progresso) return;
    progresso.textContent = '';
    progresso.style.display = 'none';
  }

  function obterItensPreviewChecklist() {
    const itens = [];

    CHECKLIST_ETAPAS.forEach(etapa => {
      const foto = checklistImagens[etapa];
      if (!foto) return;

      itens.push({
        tipo: 'obrigatoria',
        chave: etapa,
        legenda: legendaChecklistTexto(etapa),
        foto,
      });
    });

    checklistImagens.extras.forEach((foto, idx) => {
      itens.push({
        tipo: 'extra',
        indice: idx,
        legenda: `Extra ${idx + 1}`,
        foto,
      });
    });

    return itens;
  }

  function garantirModalChecklistImagem() {
    if (modalChecklistImagemEl) return modalChecklistImagemEl;

    const modal = document.createElement('div');
    modal.className = 'frota-checklist-modal';
    modal.innerHTML = `
      <div class="frota-checklist-modal-backdrop" data-acao="fechar"></div>
      <div class="frota-checklist-modal-card" role="dialog" aria-modal="true" aria-label="Visualização da imagem do checklist">
        <button type="button" class="frota-checklist-modal-fechar" data-acao="fechar" aria-label="Fechar visualização">×</button>
        <div class="frota-checklist-modal-corpo">
          <img class="frota-checklist-modal-img" src="" alt="Imagem ampliada do checklist">
          <div class="frota-checklist-modal-actions">
            <div class="frota-checklist-modal-tags">
              <span class="frota-checklist-modal-tipo"></span>
            </div>
            <div class="frota-checklist-modal-row">
              <label for="frota-checklist-modal-legenda">Editar legenda</label>
              <select id="frota-checklist-modal-legenda" class="frota-checklist-modal-select">
                <option value="frente">Frente</option>
                <option value="traseira">Traseira</option>
                <option value="lateral_esquerda">Lateral esquerda</option>
                <option value="lateral_direita">Lateral direita</option>
                <option value="painel">Painel</option>
                <option value="extra">Foto extra</option>
              </select>
            </div>
            <div class="frota-checklist-modal-row frota-checklist-modal-buttons">
              <button type="button" class="btn-secundario btn-sm frota-checklist-modal-excluir">Excluir</button>
              <button type="button" class="btn-primario btn-sm frota-checklist-modal-salvar">Salvar legenda</button>
            </div>
          </div>
        </div>
      </div>
    `;

    modal.addEventListener('click', (event) => {
      if (event.target?.dataset?.acao === 'fechar') {
        fecharModalChecklistImagem();
      }
    });

    modal.querySelector('.frota-checklist-modal-salvar')?.addEventListener('click', () => {
      const botaoSalvar = modal.querySelector('.frota-checklist-modal-salvar');
      const legendaModal = modal.querySelector('#frota-checklist-modal-legenda')?.value;
      if (botaoSalvar) botaoSalvar.disabled = true;

      try {
        editarLegendaImagemSelecionada(legendaModal);
        const legendaSelect = document.getElementById('frota-checklist-legenda');
        if (legendaSelect) legendaSelect.value = proximaLegendaChecklist();
        fecharModalChecklistImagem();
        atualizarPreviewChecklist();
        atualizarStatusChecklist();
      } catch (err) {
        mostrarFeedback(err.message || 'Falha ao alterar legenda da imagem.', 'erro', 'frota-checklist-feedback');
      } finally {
        if (botaoSalvar) botaoSalvar.disabled = false;
      }
    });

    modal.querySelector('.frota-checklist-modal-excluir')?.addEventListener('click', () => {
      if (!confirm('Excluir esta imagem?')) return;
      const botaoExcluir = modal.querySelector('.frota-checklist-modal-excluir');
      if (botaoExcluir) botaoExcluir.disabled = true;

      try {
        excluirImagemChecklistSelecionada();
      } catch (err) {
        mostrarFeedback(err.message || 'Falha ao excluir imagem.', 'erro', 'frota-checklist-feedback');
      } finally {
        if (botaoExcluir) botaoExcluir.disabled = false;
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('ativo')) {
        fecharModalChecklistImagem();
      }
    });

    document.body.appendChild(modal);
    modalChecklistImagemEl = modal;
    return modalChecklistImagemEl;
  }

  function fecharModalChecklistImagem() {
    if (!modalChecklistImagemEl) return;
    const img = modalChecklistImagemEl.querySelector('.frota-checklist-modal-img');
    if (img) img.removeAttribute('src');
    modalChecklistImagemEl.classList.remove('ativo');
    document.body.classList.remove('frota-checklist-modal-aberto');
    checklistModalSelecao = null;
  }

  function abrirModalChecklistImagem(tipo, chave, indice) {
    const modal = garantirModalChecklistImagem();
    const img = modal.querySelector('.frota-checklist-modal-img');
    const legendaSelect = modal.querySelector('#frota-checklist-modal-legenda');
    const tipoEl = modal.querySelector('.frota-checklist-modal-tipo');
    if (!modal || !img || !legendaSelect) return;

    let foto = null;
    let legenda = 'extra';

    if (tipo === 'obrigatoria') {
      foto = checklistImagens[chave] || null;
      legenda = chave;
    } else {
      foto = checklistImagens.extras[indice] || null;
      legenda = 'extra';
    }

    if (!foto) return;

    checklistModalSelecao = { tipo, chave, indice };
    img.src = foto;
    legendaSelect.value = legenda;
    if (tipoEl) tipoEl.textContent = tipo === 'extra' ? `Extra ${Number(indice) + 1}` : legendaChecklistTexto(chave);
    modal.classList.add('ativo');
    document.body.classList.add('frota-checklist-modal-aberto');
  }

  function excluirImagemChecklistSelecionada() {
    if (!checklistModalSelecao) return;

    if (checklistModalSelecao.tipo === 'obrigatoria') {
      checklistImagens[checklistModalSelecao.chave] = null;
    } else if (typeof checklistModalSelecao.indice === 'number') {
      checklistImagens.extras.splice(checklistModalSelecao.indice, 1);
    }

    const legendaSelect = document.getElementById('frota-checklist-legenda');
    if (legendaSelect) legendaSelect.value = proximaLegendaChecklist();

    fecharModalChecklistImagem();
    atualizarPreviewChecklist();
    atualizarStatusChecklist();
  }

  function editarLegendaImagemSelecionada(novaLegenda) {
    if (!checklistModalSelecao || !novaLegenda) return;

    const origemTipo = checklistModalSelecao.tipo;
    const origemChave = checklistModalSelecao.chave;
    const origemIndice = checklistModalSelecao.indice;

    let foto = null;
    if (origemTipo === 'obrigatoria') {
      foto = checklistImagens[origemChave] || null;
    } else if (typeof origemIndice === 'number') {
      foto = checklistImagens.extras[origemIndice] || null;
    }

    if (!foto) {
      throw new Error('Imagem selecionada não foi encontrada.');
    }

    if (novaLegenda === 'extra') {
      if (origemTipo === 'extra') return;
      checklistImagens.extras.push(foto);
      checklistImagens[origemChave] = null;
      return;
    }

    if (origemTipo === 'obrigatoria' && origemChave === novaLegenda) {
      return;
    }

    if (checklistImagens[novaLegenda]) {
      throw new Error(`A legenda ${legendaChecklistTexto(novaLegenda)} já possui imagem. Exclua ou altere a imagem atual antes.`);
    }

    checklistImagens[novaLegenda] = foto;
    if (origemTipo === 'obrigatoria') {
      checklistImagens[origemChave] = null;
    } else if (typeof origemIndice === 'number') {
      checklistImagens.extras.splice(origemIndice, 1);
    }
  }

  function montarLinksChecklist(item) {
    const links = [];
    if (item.foto_frente) links.push(`<a href="${item.foto_frente}" target="_blank" rel="noopener">Frente</a>`);
    if (item.foto_traseira) links.push(`<a href="${item.foto_traseira}" target="_blank" rel="noopener">Traseira</a>`);
    if (item.foto_lateral_esquerda) links.push(`<a href="${item.foto_lateral_esquerda}" target="_blank" rel="noopener">Lat. Esq.</a>`);
    if (item.foto_lateral_direita) links.push(`<a href="${item.foto_lateral_direita}" target="_blank" rel="noopener">Lat. Dir.</a>`);
    if (item.foto_painel) links.push(`<a href="${item.foto_painel}" target="_blank" rel="noopener">Painel</a>`);

    const extras = parseFotosExtrasChecklist(item.fotos_extras);
    extras.forEach((foto, idx) => {
      links.push(`<a href="${foto}" target="_blank" rel="noopener">Extra ${idx + 1}</a>`);
    });

    if (item.imagem_foto) {
      const legenda = legendaChecklistTexto(item.imagem_legenda);
      links.push(`<a href="${item.imagem_foto}" target="_blank" rel="noopener">${escapeHtml(legenda)}</a>`);
    }

    if (!links.length) return '-';
    return `<div class="frota-checklist-links">${links.join('')}</div>`;
  }

  function renderTabelaChecklist(lista) {
    const tbody = document.querySelector('#frota-tabela-checklist tbody');
    if (!tbody) return;

    if (!Array.isArray(lista) || !lista.length) {
      tbody.innerHTML = '<tr><td class="frota-vazio" colspan="11">Nenhum checklist cadastrado.</td></tr>';
      return;
    }

    const linhas = lista.map(item => `
      <tr>
        <td>${escapeHtml(formatDataHoraChecklist(item.created_at))}</td>
        <td>${escapeHtml(item.placa || '-')}</td>
        <td>${escapeHtml(item.motorista || '-')}</td>
        <td>${item.km ?? '-'}</td>
        <td>${escapeHtml(item.verificacao_estepe || '-')}</td>
        <td>${escapeHtml(item.confirmacao_itens_checklist || '-')}</td>
        <td>${escapeHtml(item.obs_itens_checklist || '-')}</td>
        <td>${escapeHtml(item.confirmacao_equipamentos || '-')}</td>
        <td>${escapeHtml(item.obs_equipamentos || '-')}</td>
        <td>${escapeHtml(item.obs || '-')}</td>
        <td>${montarLinksChecklist(item)}</td>
      </tr>
    `);

    tbody.innerHTML = linhas.join('');
  }

  async function listarChecklists() {
    try {
      const resp = await fetch(frotaApiUrl('frota/checklists'), { headers: authHeaders() });
      if (!resp.ok) throw new Error('Falha ao listar checklists via API');
      const data = await resp.json();
      const lista = Array.isArray(data.checklists) ? data.checklists : [];
      salvarChecklistsLocal(lista);
      frotaChecklistsCache = lista;
      return lista;
    } catch (err) {
      console.warn('API de checklist indisponível, usando cache local:', err.message);
      const lista = carregarChecklistsLocal();
      frotaChecklistsCache = lista;
      return lista;
    }
  }

  async function salvarChecklist(payload) {
    try {
      const resp = await fetch(frotaApiUrl('frota/checklists'), {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const dataErro = await resp.json().catch(() => ({}));
        throw new Error(dataErro.mensagem || 'Erro ao salvar checklist na API.');
      }

      return await resp.json();
    } catch (err) {
      const lista = carregarChecklistsLocal();
      const novo = {
        ...payload,
        id: Date.now(),
        created_at: new Date().toISOString(),
      };
      lista.unshift(novo);
      salvarChecklistsLocal(lista);
      return { status: 'ok', checklist: novo, local: true };
    }
  }

  function obterArquivoChecklist() {
    const input = document.getElementById('frota-checklist-foto');
    const file = input?.files?.[0];
    if (!file) throw new Error('Anexe uma imagem do checklist.');
    if (file.size > 6 * 1024 * 1024) throw new Error('A imagem do checklist deve ter no máximo 6MB.');
    return file;
  }

  async function adicionarImagemChecklistAtual() {
    const legendaSelect = document.getElementById('frota-checklist-legenda');
    const fotoInput = document.getElementById('frota-checklist-foto');
    if (!legendaSelect || !fotoInput || !fotoInput.files?.[0]) return;

    const legendaAtual = legendaSelect.value;
    if (!legendaAtual) throw new Error('Selecione a legenda da imagem antes de anexar o arquivo.');

    const arquivo = obterArquivoChecklist();
    const foto = await arquivoParaDataUrl(arquivo);

    if (legendaAtual === 'extra') {
      checklistImagens.extras.push(foto);
    } else {
      checklistImagens[legendaAtual] = foto;
    }

    fotoInput.value = '';
    legendaSelect.value = proximaLegendaChecklist();
    atualizarPreviewChecklist();
    atualizarStatusChecklist();
  }

  async function coletarFormularioChecklist() {
    const placa = formatPlaca(document.getElementById('frota-checklist-placa').value);
    const motorista = document.getElementById('frota-checklist-motorista').value.trim();
    const km = toIntOrNull(document.getElementById('frota-checklist-km').value);
    const verificacaoEstepe = document.getElementById('frota-checklist-estepe').value;
    const confirmacaoItensChecklist = document.getElementById('frota-checklist-conf-itens').value;
    const obsItensChecklist = document.getElementById('frota-checklist-obs-itens').value.trim() || null;
    const confirmacaoEquipamentos = document.getElementById('frota-checklist-conf-equipamentos').value;
    const obsEquipamentos = document.getElementById('frota-checklist-obs-equipamentos').value.trim() || null;
    const obs = document.getElementById('frota-checklist-obs').value.trim() || null;

    if (!placa) throw new Error('Selecione a placa do veículo no checklist.');
    if (!motorista) throw new Error('Motorista não identificado. Recarregue a página e tente novamente.');
    if (km == null) throw new Error('Informe a quilometragem (km).');
    if (!verificacaoEstepe) throw new Error('Informe a verificação do estepe.');
    if (!confirmacaoItensChecklist) throw new Error('Informe a confirmação de verificação dos itens específicos.');
    if (!confirmacaoEquipamentos) throw new Error('Informe a confirmação de verificação de equipamentos/ferramentas.');
    if (confirmacaoItensChecklist === 'Não está conforme' && !obsItensChecklist) {
      throw new Error('Descreva a observação dos itens específicos que não estão conforme.');
    }
    if (confirmacaoEquipamentos === 'Não está conforme' && !obsEquipamentos) {
      throw new Error('Descreva a observação dos equipamentos/ferramentas que não estão conforme.');
    }

    if (CHECKLIST_ETAPAS.some(etapa => !checklistImagens[etapa])) {
      throw new Error('Complete as imagens obrigatórias do checklist: frente, traseira, laterais e painel.');
    }

    return {
      placa,
      motorista,
      km,
      verificacao_estepe: verificacaoEstepe,
      confirmacao_itens_checklist: confirmacaoItensChecklist,
      obs_itens_checklist: obsItensChecklist,
      confirmacao_equipamentos: confirmacaoEquipamentos,
      obs_equipamentos: obsEquipamentos,
      foto_frente: checklistImagens.frente,
      foto_traseira: checklistImagens.traseira,
      foto_lateral_esquerda: checklistImagens.lateral_esquerda,
      foto_lateral_direita: checklistImagens.lateral_direita,
      foto_painel: checklistImagens.painel,
      fotos_extras: checklistImagens.extras,
      obs,
    };
  }

  function limparFormularioChecklist() {
    const form = document.getElementById('frota-checklist-form');
    if (form) form.reset();
    resetChecklistImagens();
    fecharModalChecklistImagem();
    const legendaSelect = document.getElementById('frota-checklist-legenda');
    if (legendaSelect) legendaSelect.value = 'frente';
    preencherMotoristaChecklist();
    atualizarPreviewChecklist();
    atualizarStatusChecklist();
  }

  function atualizarPreviewChecklist() {
    const previewGrid = document.getElementById('frota-checklist-preview-grid');
    if (!previewGrid) return;

    const itens = obterItensPreviewChecklist().map(item => {
      const attrs = item.tipo === 'obrigatoria'
        ? `data-preview-tipo="obrigatoria" data-preview-chave="${item.chave}"`
        : `data-preview-tipo="extra" data-preview-indice="${item.indice}"`;

      return `<div class="frota-checklist-preview-item" ${attrs}><strong>${escapeHtml(item.legenda)}</strong><img src="${item.foto}" alt="${escapeHtml(item.legenda)}"></div>`;
    });

    if (!itens.length) {
      previewGrid.innerHTML = '';
      previewGrid.style.display = 'none';
      return;
    }

    previewGrid.innerHTML = itens.join('');
    previewGrid.style.display = 'grid';
  }

  function inicializarAbas() {
    const legendaPrincipal = document.getElementById('legenda-principal');
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    const gerenciamentoTab = document.querySelector('.tab-btn[data-tab="gerenciamento"]');
    const gerenciamentoContent = document.getElementById('gerenciamento');
    if (gerenciamentoTab && gerenciamentoContent && legendaPrincipal) {
      gerenciamentoTab.classList.add('active');
      gerenciamentoContent.classList.add('active');
      legendaPrincipal.textContent = 'Painel Geral';
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', function () {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        this.classList.add('active');
        const tabId = this.getAttribute('data-tab');
        const contentToShow = document.getElementById(tabId);
        if (contentToShow) contentToShow.classList.add('active');

        if (tabId === 'abastecimento') {
          preencherDataHoraAbastecimento();
        }

        if (tabId === 'checklist') {
          preencherSelectPlacasChecklist(frotaVeiculosCache);
          preencherMotoristaChecklist();
          const placaChecklist = document.getElementById('frota-checklist-placa')?.value;
          atualizarInfoChecklistVeiculo(placaChecklist);
          preencherKmChecklistPorPlaca(placaChecklist);
        }

        if (tabId === 'gerenciamento' && frotaMapa) {
          setTimeout(() => {
            frotaMapa.invalidateSize();
          }, 60);
        }

        if (legendaPrincipal) legendaPrincipal.textContent = this.textContent.trim();
      });
    });
  }

  async function inicializarFrota() {
    inicializarAbas();

    const placaInput = document.getElementById('frota-placa');
    if (placaInput) {
      placaInput.addEventListener('input', () => {
        placaInput.value = formatPlaca(placaInput.value);
      });
    }

    const form = document.getElementById('frota-veiculo-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
          const payload = coletarFormulario();
          const result = await salvarVeiculo(payload);
          const fileInput = document.getElementById('frota-veiculo-imagem');
          const file = fileInput?.files?.[0];
          if (file) {
            const dataUrl = await arquivoParaDataUrl(file);
            const mapa = carregarImagensVeiculosLocal();
            mapa[payload.placa] = dataUrl;
            salvarImagensVeiculosLocal(mapa);
          }
          const editando = Boolean(veiculoEditandoPlaca);
          const lista = await listarVeiculos();
          renderTabela(lista);
          limparFormulario();
          voltarParaTabela('frota-sub-veiculos', result.local
            ? 'Veículo salvo só neste aparelho (servidor indisponível).'
            : (editando ? 'Veículo atualizado.' : 'Veículo cadastrado.'));
        } catch (err) {
          mostrarFeedback(err.message || 'Falha ao cadastrar veículo.', 'erro', 'frota-feedback');
        }
      });
    }

    const btnLimpar = document.getElementById('frota-btn-limpar');
    if (btnLimpar) {
      btnLimpar.addEventListener('click', limparFormulario);
    }

    const formOficina = document.getElementById('frota-oficina-form');
    if (formOficina) {
      formOficina.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const payload = coletarFormularioOficina();
          const editando = Boolean(document.getElementById('frota-oficina-id')?.value);
          const result = await salvarOficina(payload);
          await atualizarOficinas();
          limparFormularioOficina();
          voltarParaTabela('frota-sub-oficinas', result.local
            ? 'Oficina salva só neste aparelho (servidor indisponível).'
            : (editando ? 'Oficina atualizada.' : 'Oficina cadastrada.'));
        } catch (err) {
          mostrarFeedback(err.message || 'Falha ao cadastrar oficina.', 'erro', 'frota-oficina-feedback');
        }
      });
    }

    const btnOficinaLimpar = document.getElementById('frota-oficina-limpar');
    if (btnOficinaLimpar) {
      btnOficinaLimpar.addEventListener('click', limparFormularioOficina);
    }

    const inputComprovante = document.getElementById('frota-abast-comprovante');
    if (inputComprovante) {
      inputComprovante.addEventListener('change', atualizarPreviewComprovante);
    }

    const inputVeiculoImagem = document.getElementById('frota-veiculo-imagem');
    const veiculoImagemCard = document.getElementById('frota-veiculo-imagem-card');
    if (veiculoImagemCard && inputVeiculoImagem) {
      veiculoImagemCard.addEventListener('click', () => {
        inputVeiculoImagem.click();
      });
      inputVeiculoImagem.addEventListener('change', atualizarPreviewImagemVeiculo);
    }

    const btnAbastAgora = document.getElementById('frota-abast-agora');
    if (btnAbastAgora) {
      btnAbastAgora.addEventListener('click', preencherDataHoraAbastecimento);
    }

    const btnAbastLimpar = document.getElementById('frota-abast-limpar');
    if (btnAbastLimpar) {
      btnAbastLimpar.addEventListener('click', limparFormularioAbastecimento);
    }

    const selectPlacaAbast = document.getElementById('frota-abast-placa');
    if (selectPlacaAbast) {
      selectPlacaAbast.addEventListener('change', () => {
        preencherCartaoAbastecimentoPorPlaca(selectPlacaAbast.value);
      });
    }

    const formAbast = document.getElementById('frota-abastecimento-form');
    if (formAbast) {
      formAbast.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const payload = await coletarFormularioAbastecimento();
          const result = await salvarAbastecimento(payload);
          const listaAbastecimentos = await listarAbastecimentos();
          renderTabelaAbastecimentos(listaAbastecimentos);
          limparFormularioAbastecimento();

          if (result.local) {
            mostrarFeedback('Abastecimento salvo no modo local (sem API).', 'ok', 'frota-abast-feedback');
          } else {
            mostrarFeedback('Abastecimento registrado com sucesso.', 'ok', 'frota-abast-feedback');
          }
        } catch (err) {
          mostrarFeedback(err.message || 'Falha ao salvar abastecimento.', 'erro', 'frota-abast-feedback');
        }
      });
    }

    const btnCartaoLimpar = document.getElementById('frota-cartao-abastecimento-limpar');
    if (btnCartaoLimpar) {
      btnCartaoLimpar.addEventListener('click', limparFormularioCartaoAbastecimento);
    }

    const formCartoes = document.getElementById('frota-cartoes-abastecimento-form');
    if (formCartoes) {
      formCartoes.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const payload = coletarFormularioCartaoAbastecimento();
          const editando = Boolean(document.getElementById('frota-cartao-abastecimento-id')?.value);
          const result = await salvarCartaoAbastecimento(payload);
          await atualizarCartoes();
          limparFormularioCartaoAbastecimento();
          voltarParaTabela('frota-sub-cartoes', result.local
            ? 'Cartão salvo só neste aparelho (servidor indisponível).'
            : (editando ? 'Cartão atualizado.' : 'Cartão cadastrado.'));
        } catch (err) {
          mostrarFeedback(err.message || 'Falha ao salvar cartão de abastecimento.', 'erro', 'frota-cartoes-abastecimento-feedback');
        }
      });
    }

    const checklistFotoInput = document.getElementById('frota-checklist-foto');
    if (checklistFotoInput) {
      checklistFotoInput.addEventListener('change', async () => {
        try {
          await adicionarImagemChecklistAtual();
        } catch (err) {
          mostrarFeedback(err.message || 'Falha ao adicionar imagem do checklist.', 'erro', 'frota-checklist-feedback');
        }
      });
    }

    const checklistLegendaSelect = document.getElementById('frota-checklist-legenda');
    if (checklistLegendaSelect) {
      checklistLegendaSelect.value = 'frente';
      checklistLegendaSelect.addEventListener('change', atualizarStatusChecklist);
    }

    const checklistConfItens = document.getElementById('frota-checklist-conf-itens');
    if (checklistConfItens) {
      checklistConfItens.addEventListener('change', atualizarVisibilidadeObsChecklist);
    }

    const checklistConfEquip = document.getElementById('frota-checklist-conf-equipamentos');
    if (checklistConfEquip) {
      checklistConfEquip.addEventListener('change', atualizarVisibilidadeObsChecklist);
    }

    const checklistPlacaSelect = document.getElementById('frota-checklist-placa');
    if (checklistPlacaSelect) {
      checklistPlacaSelect.addEventListener('change', () => {
        atualizarInfoChecklistVeiculo(checklistPlacaSelect.value);
        preencherKmChecklistPorPlaca(checklistPlacaSelect.value);
      });
    }

    const checklistToggleListaEquip = document.getElementById('frota-checklist-toggle-lista-equipamentos');
    if (checklistToggleListaEquip) {
      checklistToggleListaEquip.addEventListener('click', () => {
        definirVisibilidadeListaEquipamentos(!listaEquipamentosVisivel);
      });
    }

    const checklistPreviewGrid = document.getElementById('frota-checklist-preview-grid');
    if (checklistPreviewGrid) {
      checklistPreviewGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.frota-checklist-preview-item');
        if (!card) return;

        const tipo = card.getAttribute('data-preview-tipo');
        if (tipo === 'obrigatoria') {
          abrirModalChecklistImagem('obrigatoria', card.getAttribute('data-preview-chave'), null);
          return;
        }

        const indice = Number(card.getAttribute('data-preview-indice'));
        if (tipo === 'extra' && Number.isFinite(indice)) {
          abrirModalChecklistImagem('extra', null, indice);
        }
      });
    }

    atualizarStatusChecklist();

    const btnChecklistLimpar = document.getElementById('frota-checklist-limpar');
    if (btnChecklistLimpar) {
      btnChecklistLimpar.addEventListener('click', limparFormularioChecklist);
    }

    const formChecklist = document.getElementById('frota-checklist-form');
    if (formChecklist) {
      formChecklist.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const payload = await coletarFormularioChecklist();
          const result = await salvarChecklist(payload);
          const listaChecklist = await listarChecklists();
          renderTabelaChecklist(listaChecklist);
          renderGestaoVeiculos();
          limparFormularioChecklist();

          if (result.local) {
            mostrarFeedback('Checklist salvo no modo local (sem API).', 'ok', 'frota-checklist-feedback');
          } else {
            mostrarFeedback('Checklist registrado com sucesso.', 'ok', 'frota-checklist-feedback');
          }
        } catch (err) {
          mostrarFeedback(err.message || 'Falha ao salvar checklist.', 'erro', 'frota-checklist-feedback');
        }
      });
    }

    const listaInicial = await listarVeiculos();
    renderTabela(listaInicial);
    window.popularChecklistContratos(document.getElementById('veiculo-contratos-lista'), []);

    preencherSelectPlacasAbastecimento(listaInicial);
    preencherSelectPlacasCartoesAbastecimento(listaInicial);
    preencherSelectPlacasChecklist(listaInicial);
    atualizarInfoChecklistVeiculo(document.getElementById('frota-checklist-placa')?.value);
    preencherKmChecklistPorPlaca(document.getElementById('frota-checklist-placa')?.value);
    preencherCartaoAbastecimentoPorPlaca(document.getElementById('frota-abast-placa')?.value);
    definirVisibilidadeListaEquipamentos(false);
    preencherMotoristaChecklist();
    atualizarVisibilidadeObsChecklist();
    preencherDataHoraAbastecimento();
    const listaAbastecimentos = await listarAbastecimentos();
    renderTabelaAbastecimentos(listaAbastecimentos);

    const listaChecklist = await listarChecklists();
    renderTabelaChecklist(listaChecklist);
    preencherKmChecklistPorPlaca(document.getElementById('frota-checklist-placa')?.value);
    await inicializarFrotaGestao();
  }

  //======================================================================================================
  // CARTÕES DE ABASTECIMENTO no servidor (antes ficavam só no navegador)
  //======================================================================================================
  let frotaCartoesCache = null;
  let frotaOficinasCache = [];
  let frotaManutencoesCache = [];
  let frotaAlertasCache = [];

  async function listarCartoesAbastecimento() {
    try {
      const resp = await fetch(frotaApiUrl('frota/cartoes'), { headers: authHeaders() });
      if (!resp.ok) throw new Error('Falha ao listar cartões via API');
      const data = await resp.json();
      const lista = Array.isArray(data.cartoes) ? data.cartoes : [];
      salvarCartoesAbastecimentoLocal(lista);
      frotaCartoesCache = lista;
      return lista;
    } catch (err) {
      console.warn('API de cartões indisponível, usando cache local:', err.message);
      frotaCartoesCache = carregarCartoesAbastecimentoLocal();
      return frotaCartoesCache;
    }
  }

  //======================================================================================================
  // UTILITÁRIOS: datas, chamadas à API, aviso rápido e janela de detalhes
  //======================================================================================================
  // Data de hoje no fuso do aparelho (toISOString usaria UTC e viraria o dia às 21h)
  function hojeLocalISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatarDataBR(valor) {
    if (!valor) return '-';
    const texto = String(valor).slice(0, 10);
    const partes = texto.split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : texto;
  }

  function formatarKm(valor) {
    return valor != null && valor !== '' ? Number(valor).toLocaleString('pt-BR') + ' km' : '-';
  }

  async function chamarApi(caminho, metodo, corpo) {
    const resp = await fetch(frotaApiUrl(caminho), {
      method: metodo || 'GET',
      headers: authHeaders(Boolean(corpo)),
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.status !== 'ok') throw new Error(data.mensagem || 'Falha na comunicação com o servidor.');
    return data;
  }

  function avisoRapido(mensagem, tipo) {
    let el = document.getElementById('frota-aviso-rapido');
    if (!el) {
      el = document.createElement('div');
      el.id = 'frota-aviso-rapido';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = mensagem;
    el.className = 'frota-aviso-rapido visivel' + (tipo === 'erro' ? ' erro' : '');
    clearTimeout(avisoRapido._timer);
    avisoRapido._timer = setTimeout(() => el.classList.remove('visivel'), 3200);
  }

  function linhaDetalhe(rotulo, valor) {
    const texto = valor == null || valor === '' ? '-' : valor;
    return `<div class="frota-detalhe-linha"><span>${escapeHtml(rotulo)}</span><strong>${texto}</strong></div>`;
  }

  function abrirDetalhe(titulo, html) {
    const modal = document.getElementById('frota-detalhe');
    if (!modal) return;
    document.getElementById('frota-detalhe-titulo').textContent = titulo;
    document.getElementById('frota-detalhe-corpo').innerHTML = html;
    modal.classList.add('ativo');
    modal.setAttribute('aria-hidden', 'false');
  }

  function fecharDetalhe() {
    const modal = document.getElementById('frota-detalhe');
    if (!modal) return;
    modal.classList.remove('ativo');
    modal.setAttribute('aria-hidden', 'true');
  }

  //======================================================================================================
  // NAVEGAÇÃO: abas, sub-abas do Cadastros e volta para a tabela depois de salvar
  //======================================================================================================
  // Cada cadastro, depois de salvo, volta para a aba onde a tabela dele mora.
  const ABA_DA_TABELA = {
    'frota-sub-veiculos': 'veiculos',
    'frota-sub-oficinas': 'manutencao',
    'frota-sub-cartoes': 'abastecimento',
    'frota-sub-manutencao': 'manutencao',
  };

  function abrirSubabaCadastro(subId) {
    document.querySelectorAll('#cadastros .frota-subabas .top-tab2').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subaba === subId);
    });
    document.querySelectorAll('#cadastros .frota-subaba').forEach(painel => {
      painel.classList.toggle('ativa', painel.id === subId);
    });
  }

  function irParaAba(tabId) {
    const botao = document.querySelector('.tab-btn[data-tab="' + tabId + '"]');
    if (botao) botao.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function abrirCadastro(subId, focoId) {
    fecharDetalhe();
    irParaAba('cadastros');
    abrirSubabaCadastro(subId);
    if (focoId) setTimeout(() => document.getElementById(focoId)?.focus(), 150);
  }

  function voltarParaTabela(subId, mensagem) {
    irParaAba(ABA_DA_TABELA[subId] || 'gerenciamento');
    if (mensagem) avisoRapido(mensagem);
  }

  function inicializarSubabasCadastro() {
    document.querySelectorAll('#cadastros .frota-subabas .top-tab2').forEach(btn => {
      btn.addEventListener('click', () => abrirSubabaCadastro(btn.dataset.subaba));
    });
    document.querySelectorAll('#frota-detalhe [data-fechar-detalhe]').forEach(el => el.addEventListener('click', fecharDetalhe));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharDetalhe(); });
  }

  //======================================================================================================
  // ALERTAS POR VEÍCULO (troca de óleo, filtro, revisões...)
  //======================================================================================================
  async function listarAlertas() {
    try {
      frotaAlertasCache = (await chamarApi('frota/alertas')).alertas || [];
    } catch (err) {
      console.warn('Falha ao listar alertas:', err.message);
      frotaAlertasCache = [];
    }
    return frotaAlertasCache;
  }

  function diasEntre(dataIso) {
    const alvo = new Date(String(dataIso).slice(0, 10) + 'T00:00:00');
    const hoje = new Date(hojeLocalISO() + 'T00:00:00');
    return Math.round((alvo - hoje) / 86400000);
  }

  // Situação do alerta pelo km atual do veículo e pela data: vale o que vencer primeiro.
  function situacaoAlerta(alerta, veiculo) {
    const kmAtual = veiculo && veiculo.quilometragem != null ? Number(veiculo.quilometragem) : null;
    let proximaKm = null;
    let faltamKm = null;
    let proximaData = null;
    let faltamDias = null;
    if (alerta.intervalo_km) {
      proximaKm = Number(alerta.ultima_km || 0) + Number(alerta.intervalo_km);
      if (kmAtual != null) faltamKm = proximaKm - kmAtual;
    }
    if (alerta.intervalo_dias && alerta.ultima_data) {
      const d = new Date(String(alerta.ultima_data).slice(0, 10) + 'T00:00:00');
      d.setDate(d.getDate() + Number(alerta.intervalo_dias));
      proximaData = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      faltamDias = diasEntre(proximaData);
    }
    let nivel = 'ok';
    if ((faltamKm != null && faltamKm <= 0) || (faltamDias != null && faltamDias <= 0)) nivel = 'vencido';
    else if ((faltamKm != null && faltamKm <= Number(alerta.antecedencia_km || 500))
      || (faltamDias != null && faltamDias <= Number(alerta.antecedencia_dias || 15))) nivel = 'perto';
    if (!alerta.ultima_km && !alerta.ultima_data) nivel = 'sem-base';
    return { nivel, proximaKm, faltamKm, proximaData, faltamDias };
  }

  function rotuloSituacao(nivel) {
    return { vencido: 'Vencido', perto: 'Próximo', ok: 'Em dia', 'sem-base': 'Sem referência' }[nivel] || nivel;
  }

  function alertasDaPlaca(placa) {
    return frotaAlertasCache.filter(a => formatPlaca(a.placa) === placa && Number(a.ativo) !== 0);
  }

  function resumoAlertasPlaca(placa) {
    const veiculo = buscarVeiculoPorPlaca(placa);
    const contagem = { vencido: 0, perto: 0 };
    alertasDaPlaca(placa).forEach(a => {
      const n = situacaoAlerta(a, veiculo).nivel;
      if (contagem[n] != null) contagem[n] += 1;
    });
    if (contagem.vencido) return `<span class="frota-alerta-tag vencido">${contagem.vencido} vencido${contagem.vencido > 1 ? 's' : ''}</span>`;
    if (contagem.perto) return `<span class="frota-alerta-tag perto">${contagem.perto} próximo${contagem.perto > 1 ? 's' : ''}</span>`;
    const total = alertasDaPlaca(placa).length;
    return total ? `<span class="frota-texto-suave">${total} em dia</span>` : '<span class="frota-texto-suave">Nenhum</span>';
  }

  function htmlListaAlertas(placa) {
    const veiculo = buscarVeiculoPorPlaca(placa);
    const lista = alertasDaPlaca(placa);
    if (!lista.length) return '<p class="frota-texto-suave">Nenhum alerta cadastrado para este veículo.</p>';
    return '<ul class="frota-alertas-lista">' + lista.map(a => {
      const s = situacaoAlerta(a, veiculo);
      const partes = [];
      if (s.proximaKm != null) partes.push(`${formatarKm(s.proximaKm)}${s.faltamKm != null ? ` (faltam ${formatarKm(Math.max(0, s.faltamKm))})` : ''}`);
      if (s.proximaData) partes.push(`${formatarDataBR(s.proximaData)} (${s.faltamDias >= 0 ? `faltam ${s.faltamDias} dias` : `${-s.faltamDias} dias atrasado`})`);
      const intervalo = [a.intervalo_km ? `a cada ${formatarKm(a.intervalo_km)}` : '', a.intervalo_dias ? `a cada ${a.intervalo_dias} dias` : ''].filter(Boolean).join(' ou ');
      return `
        <li class="frota-alerta-item ${s.nivel}" data-alerta-id="${a.id}">
          <div>
            <strong>${escapeHtml(a.tipo)}</strong>
            <span class="frota-alerta-tag ${s.nivel}">${rotuloSituacao(s.nivel)}</span>
            <small>${escapeHtml(intervalo)}${partes.length ? ' · próximo: ' + escapeHtml(partes.join(' ou ')) : ''}</small>
            <small>Último: ${a.ultima_km != null ? formatarKm(a.ultima_km) : '-'} em ${formatarDataBR(a.ultima_data)}</small>
          </div>
          <div class="frota-alerta-acoes">
            <button type="button" class="btn-secundario btn-sm" data-alerta-acao="feito">Marcar como feito</button>
            <button type="button" class="btn-secundario btn-sm" data-alerta-acao="excluir">Excluir</button>
          </div>
        </li>`;
    }).join('') + '</ul>';
  }

  function htmlFormAlerta(veiculo) {
    return `
      <form class="frota-alerta-form" id="frota-alerta-form">
        <h4>Novo alerta</h4>
        <div class="frota-alerta-form-grid">
          <label>Tipo
            <input type="text" id="frota-alerta-tipo" list="frota-alerta-tipos" placeholder="Ex.: Troca de óleo" required>
            <datalist id="frota-alerta-tipos">
              <option value="Troca de óleo"><option value="Troca de filtro de óleo"><option value="Troca de filtro de ar">
              <option value="Troca de filtro de combustível"><option value="Revisão geral"><option value="Revisão de freios">
              <option value="Rodízio e calibragem de pneus"><option value="Alinhamento e balanceamento"><option value="Troca de correia dentada">
              <option value="Licenciamento"><option value="Seguro">
            </datalist>
          </label>
          <label>A cada (km)
            <input type="number" id="frota-alerta-km" min="0" inputmode="numeric" placeholder="Ex.: 10000">
          </label>
          <label>A cada (dias)
            <input type="number" id="frota-alerta-dias" min="0" inputmode="numeric" placeholder="Ex.: 180">
          </label>
          <label>Último feito em (km)
            <input type="number" id="frota-alerta-ultima-km" min="0" inputmode="numeric" value="${veiculo && veiculo.quilometragem != null ? veiculo.quilometragem : ''}">
          </label>
          <label>Último feito em (data)
            <input type="date" id="frota-alerta-ultima-data" value="${hojeLocalISO()}">
          </label>
        </div>
        <button type="submit" class="btn-primario">Adicionar alerta</button>
      </form>`;
  }

  //======================================================================================================
  // ABA VEÍCULOS: tabela da frota e detalhes do veículo com alertas
  //======================================================================================================
  function proximaRevisaoTexto(v) {
    const intervalo = Number(v.km_revisoes);
    const km = Number(v.quilometragem);
    if (!intervalo || !Number.isFinite(km)) return '-';
    const proxima = Math.ceil((km + 1) / intervalo) * intervalo;
    const faltam = proxima - km;
    const alerta = faltam <= intervalo * 0.1 ? ' frota-revisao-perto' : '';
    return `<span class="frota-revisao${alerta}">${proxima.toLocaleString('pt-BR')} km<small>faltam ${faltam.toLocaleString('pt-BR')} km</small></span>`;
  }

  function manutencaoAbertaDaPlaca(placa) {
    return frotaManutencoesCache.find(m => formatPlaca(m.placa) === placa && (m.status === 'Agendada' || m.status === 'Em andamento')) || null;
  }

  function ultimoChecklistDaPlaca(placa) {
    const lista = (frotaChecklistsCache || []).filter(c => formatPlaca(c.placa) === placa);
    if (!lista.length) return null;
    return lista.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  }

  function renderGestaoVeiculos() {
    const tbody = document.querySelector('#frota-gestao-veiculos tbody');
    if (!tbody) return;
    const busca = (document.getElementById('frota-gestao-busca')?.value || '').trim().toLowerCase();
    const filtroStatus = document.getElementById('frota-gestao-status')?.value || '';

    const lista = (frotaVeiculosCache || []).filter(v => {
      if (filtroStatus && situacaoOperacional(v) !== filtroStatus) return false;
      if (!busca) return true;
      return [v.placa, v.modelo, v.marca].some(c => String(c || '').toLowerCase().includes(busca));
    });

    if (!lista.length) {
      tbody.innerHTML = `<tr><td class="frota-vazio" colspan="8">${frotaVeiculosCache.length ? 'Nenhum veículo encontrado com esse filtro.' : 'Nenhum veículo cadastrado. Use "Cadastrar veículo".'}</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(v => {
      const placa = formatPlaca(v.placa);
      const manut = manutencaoAbertaDaPlaca(placa);
      const check = ultimoChecklistDaPlaca(placa);
      const manutTexto = manut
        ? `<span class="frota-manut-tag">${escapeHtml(manut.tipo)} · ${escapeHtml(manut.status)}</span>`
        : '<span class="frota-texto-suave">Nenhuma aberta</span>';
      const checkTexto = check
        ? `${escapeHtml(formatDataHoraChecklist(check.created_at))}<small class="frota-texto-suave"> ${check.km ?? ''} km</small>`
        : '<span class="frota-texto-suave">Sem checklist</span>';
      return `
        <tr class="frota-linha-clicavel" data-placa="${escapeHtml(placa)}" tabindex="0" title="Ver detalhes do veículo">
          <td><strong>${escapeHtml(v.modelo || '-')}</strong><small class="frota-texto-suave"> ${escapeHtml(v.marca || '')}</small></td>
          <td>${escapeHtml(placa)}</td>
          <td>${situacaoBadge(v)}</td>
          <td>${formatarKm(v.quilometragem)}</td>
          <td>${proximaRevisaoTexto(v)}</td>
          <td>${resumoAlertasPlaca(placa)}</td>
          <td>${manutTexto}</td>
          <td>${checkTexto}</td>
        </tr>`;
    }).join('');
  }

  function abrirDetalheVeiculo(placa) {
    const v = buscarVeiculoPorPlaca(placa);
    if (!v) return;
    const manut = manutencaoAbertaDaPlaca(placa);
    const html = `
      <div class="frota-detalhe-grade">
        ${linhaDetalhe('Placa', escapeHtml(placa))}
        ${linhaDetalhe('Situação', situacaoBadge(v))}
        ${linhaDetalhe('Marca / modelo', escapeHtml([v.marca, v.modelo].filter(Boolean).join(' ')))}
        ${linhaDetalhe('Ano', escapeHtml(v.ano ?? ''))}
        ${linhaDetalhe('Quilometragem', formatarKm(v.quilometragem))}
        ${linhaDetalhe('Próxima revisão', proximaRevisaoTexto(v))}
        ${linhaDetalhe('Tipo', escapeHtml(v.tipo_veiculo || ''))}
        ${linhaDetalhe('Combustível', escapeHtml([v.tipo_combustivel, v.km_por_litro ? v.km_por_litro + ' km/L' : ''].filter(Boolean).join(' · ')))}
        ${linhaDetalhe('Manutenção aberta', manut ? escapeHtml(`${manut.tipo} · ${manut.status}`) : 'Nenhuma')}
        ${linhaDetalhe('Obs', escapeHtml(v.obs || ''))}
      </div>
      <h4 class="frota-detalhe-subtitulo">Status do veículo</h4>
      <div class="frota-status-rapido" role="group" aria-label="Status do veículo">
        ${['Ativo', 'Em manutenção', 'Inativo'].map(st => `<button type="button" data-status-rapido="${st}" class="${normalizarStatus(v.status) === st ? 'ativo' : ''}">${st}</button>`).join('')}
      </div>
      <div class="frota-detalhe-acoes">
        <button type="button" class="btn-secundario" data-detalhe-acao="editar-veiculo">Editar cadastro</button>
        <button type="button" class="btn-primario" data-detalhe-acao="agendar-manutencao">${manut ? 'Ver manutenção aberta' : 'Agendar manutenção'}</button>
      </div>
      <h4 class="frota-detalhe-subtitulo">Alertas de manutenção</h4>
      <div id="frota-detalhe-alertas">${htmlListaAlertas(placa)}</div>
      ${htmlFormAlerta(v)}`;
    abrirDetalhe(`${v.modelo || 'Veículo'} · ${placa}`, html);
    const corpo = document.getElementById('frota-detalhe-corpo');
    corpo.dataset.placa = placa;
  }

  async function aposMudarAlertas(placa) {
    await listarAlertas();
    const lista = document.getElementById('frota-detalhe-alertas');
    if (lista) lista.innerHTML = htmlListaAlertas(placa);
    renderGestaoVeiculos();
  }

  function inicializarDetalheVeiculo() {
    const corpo = document.getElementById('frota-detalhe-corpo');
    if (!corpo) return;

    corpo.addEventListener('click', async e => {
      const placa = corpo.dataset.placa;
      const botaoStatus = e.target.closest('[data-status-rapido]');
      if (botaoStatus) {
        if (botaoStatus.classList.contains('ativo')) return;
        const v = buscarVeiculoPorPlaca(placa);
        if (!v) return;
        const { operacao, id, ...dados } = v;
        const grupo = botaoStatus.parentElement;
        grupo.querySelectorAll('button').forEach(b => { b.disabled = true; });
        try {
          await chamarApi('frota/veiculos', 'POST', { ...dados, status: botaoStatus.dataset.statusRapido });
          await listarVeiculos();
          renderGestaoVeiculos();
          abrirDetalheVeiculo(placa);
          avisoRapido('Status alterado para ' + botaoStatus.dataset.statusRapido + '.');
        } catch (err) {
          grupo.querySelectorAll('button').forEach(b => { b.disabled = false; });
          avisoRapido(err.message || 'Não foi possível alterar o status.', 'erro');
        }
        return;
      }
      const acao = e.target.closest('[data-detalhe-acao]')?.dataset.detalheAcao;
      if (acao === 'editar-veiculo') {
        const v = buscarVeiculoPorPlaca(placa);
        abrirCadastro('frota-sub-veiculos', 'frota-modelo');
        preencherFormularioVeiculo(v);
        return;
      }
      if (acao === 'agendar-manutencao') {
        const aberta = manutencaoAbertaDaPlaca(placa);
        if (aberta) { abrirDetalheManutencao(aberta.id); return; }
        novaManutencaoPara(placa);
        return;
      }
      const botaoAlerta = e.target.closest('[data-alerta-acao]');
      if (!botaoAlerta) return;
      const id = botaoAlerta.closest('[data-alerta-id]')?.dataset.alertaId;
      try {
        if (botaoAlerta.dataset.alertaAcao === 'feito') {
          await chamarApi(`frota/alertas/${id}/realizado`, 'POST', {});
          avisoRapido('Serviço marcado como feito.');
        } else if (botaoAlerta.dataset.alertaAcao === 'excluir') {
          if (!confirm('Excluir este alerta?')) return;
          await chamarApi(`frota/alertas/${id}`, 'DELETE');
          avisoRapido('Alerta excluído.');
        }
        await aposMudarAlertas(placa);
      } catch (err) {
        avisoRapido(err.message, 'erro');
      }
    });

    corpo.addEventListener('submit', async e => {
      if (e.target.id !== 'frota-alerta-form') return;
      e.preventDefault();
      const placa = corpo.dataset.placa;
      const valor = id => document.getElementById(id)?.value || '';
      try {
        await chamarApi('frota/alertas', 'POST', {
          placa,
          tipo: valor('frota-alerta-tipo').trim(),
          intervalo_km: toIntOrNull(valor('frota-alerta-km')),
          intervalo_dias: toIntOrNull(valor('frota-alerta-dias')),
          ultima_km: toIntOrNull(valor('frota-alerta-ultima-km')),
          ultima_data: valor('frota-alerta-ultima-data') || null,
        });
        e.target.reset();
        document.getElementById('frota-alerta-ultima-data').value = hojeLocalISO();
        avisoRapido('Alerta cadastrado.');
        await aposMudarAlertas(placa);
      } catch (err) {
        avisoRapido(err.message, 'erro');
      }
    });
  }

  function inicializarGestaoVeiculos() {
    document.getElementById('frota-gestao-busca')?.addEventListener('input', renderGestaoVeiculos);
    document.getElementById('frota-gestao-status')?.addEventListener('change', renderGestaoVeiculos);
    document.getElementById('frota-gestao-novo')?.addEventListener('click', () => {
      limparFormulario();
      abrirCadastro('frota-sub-veiculos', 'frota-modelo');
    });
    const tbody = document.querySelector('#frota-gestao-veiculos tbody');
    const abrir = e => {
      const linha = e.target.closest('tr[data-placa]');
      if (linha && (e.type === 'click' || e.key === 'Enter')) abrirDetalheVeiculo(linha.dataset.placa);
    };
    tbody?.addEventListener('click', abrir);
    tbody?.addEventListener('keydown', abrir);
    inicializarDetalheVeiculo();
  }

  //======================================================================================================
  // ABA MANUTENÇÃO: tabela de manutenções e de oficinas
  //======================================================================================================
  function preencherSelectPlacasManutencao(veiculos) {
    const select = document.getElementById('frota-manut-placa');
    if (!select) return;
    const valorAtual = select.value;
    const opcoes = (veiculos || []).map(v => {
      const placa = formatPlaca(v.placa || '');
      if (!placa) return '';
      const descricao = [v.marca, v.modelo].filter(Boolean).join(' ');
      return `<option value="${escapeHtml(placa)}">${escapeHtml(placa)}${descricao ? ` - ${escapeHtml(descricao)}` : ''}</option>`;
    }).join('');
    select.innerHTML = `<option value="">Selecione o veículo</option>${opcoes}`;
    if (valorAtual) select.value = valorAtual;
  }

  function preencherSelectOficinasManutencao(oficinas) {
    const select = document.getElementById('frota-manut-oficina');
    if (!select) return;
    const valorAtual = select.value;
    const opcoes = (oficinas || [])
      .filter(o => o.id != null && Number(o.id) < 1e12)
      .map(o => `<option value="${o.id}">${escapeHtml(o.nome_oficina || 'Oficina')}</option>`)
      .join('');
    select.innerHTML = `<option value="">Sem oficina definida</option>${opcoes}`;
    if (valorAtual) select.value = valorAtual;
  }

  async function listarManutencoes() {
    try {
      frotaManutencoesCache = (await chamarApi('frota/manutencoes')).manutencoes || [];
    } catch (err) {
      console.warn('Falha ao listar manutenções:', err.message);
      frotaManutencoesCache = [];
    }
    return frotaManutencoesCache;
  }

  function classeStatusManutencao(status) {
    return {
      'Agendada': 'frota-manut-agendada',
      'Em andamento': 'frota-manut-andamento',
      'Concluída': 'frota-manut-concluida',
      'Cancelada': 'frota-manut-cancelada',
    }[status] || '';
  }

  function custoBR(valor) {
    return valor != null && valor !== '' ? Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
  }

  function renderTabelaManutencoes() {
    const tbody = document.querySelector('#frota-tabela-manutencoes tbody');
    if (!tbody) return;
    const filtro = document.getElementById('frota-manut-filtro-status')?.value || '';
    const lista = frotaManutencoesCache.filter(m => {
      if (!filtro) return true;
      if (filtro === 'abertas') return m.status === 'Agendada' || m.status === 'Em andamento';
      return m.status === filtro;
    });

    if (!lista.length) {
      tbody.innerHTML = `<tr><td class="frota-vazio" colspan="8">${frotaManutencoesCache.length ? 'Nenhuma manutenção com esse filtro.' : 'Nenhuma manutenção registrada. Use "Agendar manutenção".'}</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(m => `
      <tr class="frota-linha-clicavel" data-id="${m.id}" tabindex="0" title="Ver detalhes da manutenção">
        <td><strong>${escapeHtml(m.placa)}</strong><small class="frota-texto-suave"> ${escapeHtml([m.marca, m.modelo].filter(Boolean).join(' '))}</small></td>
        <td>${escapeHtml(m.tipo || '-')}</td>
        <td><span class="frota-manut-status ${classeStatusManutencao(m.status)}">${escapeHtml(m.status)}</span></td>
        <td>${escapeHtml(m.nome_oficina || '-')}</td>
        <td>${formatarDataBR(m.data_entrada)}</td>
        <td>${formatarDataBR(m.data_saida || m.previsao_saida)}${!m.data_saida && m.previsao_saida ? '<small class="frota-texto-suave"> previsão</small>' : ''}</td>
        <td>${escapeHtml(m.descricao || '-')}</td>
        <td>${custoBR(m.custo)}</td>
      </tr>`).join('');
  }

  function abrirDetalheManutencao(id) {
    const m = frotaManutencoesCache.find(x => x.id === Number(id));
    if (!m) return;
    const aberta = m.status === 'Agendada' || m.status === 'Em andamento';
    abrirDetalhe(`Manutenção · ${m.placa}`, `
      <div class="frota-detalhe-grade">
        ${linhaDetalhe('Veículo', escapeHtml([m.placa, m.marca, m.modelo].filter(Boolean).join(' · ')))}
        ${linhaDetalhe('Tipo', escapeHtml(m.tipo))}
        ${linhaDetalhe('Status', `<span class="frota-manut-status ${classeStatusManutencao(m.status)}">${escapeHtml(m.status)}</span>`)}
        ${linhaDetalhe('Oficina', escapeHtml(m.nome_oficina || ''))}
        ${linhaDetalhe('Entrada', formatarDataBR(m.data_entrada))}
        ${linhaDetalhe('Previsão de saída', formatarDataBR(m.previsao_saida))}
        ${linhaDetalhe('Saída', formatarDataBR(m.data_saida))}
        ${linhaDetalhe('Km na entrada', formatarKm(m.km_entrada))}
        ${linhaDetalhe('Custo', custoBR(m.custo))}
        ${linhaDetalhe('Responsável', escapeHtml(m.responsavel || ''))}
        ${linhaDetalhe('Problema / serviço', escapeHtml(m.descricao || ''))}
        ${linhaDetalhe('Serviços realizados', escapeHtml(m.servicos_realizados || ''))}
        ${linhaDetalhe('Peças trocadas', escapeHtml(m.pecas_trocadas || ''))}
        ${linhaDetalhe('Obs', escapeHtml(m.obs || ''))}
      </div>
      <div class="frota-detalhe-acoes" data-manut-id="${m.id}">
        <button type="button" class="btn-secundario" data-manut-acao="editar">Editar</button>
        ${aberta ? '<button type="button" class="btn-primario" data-manut-acao="concluir">Concluir</button>' : ''}
        <button type="button" class="btn-secundario" data-manut-acao="excluir">Excluir</button>
      </div>`);
  }

  function coletarFormularioManutencao() {
    const valor = id => (document.getElementById(id)?.value || '').trim();
    const payload = {
      placa: formatPlaca(valor('frota-manut-placa')),
      tipo: valor('frota-manut-tipo'),
      status: valor('frota-manut-status'),
      oficina_id: valor('frota-manut-oficina') || null,
      data_entrada: valor('frota-manut-entrada') || null,
      previsao_saida: valor('frota-manut-previsao') || null,
      data_saida: valor('frota-manut-saida') || null,
      km_entrada: toIntOrNull(valor('frota-manut-km')),
      custo: toFloatOrNull(valor('frota-manut-custo')),
      responsavel: valor('frota-manut-responsavel') || null,
      descricao: valor('frota-manut-descricao'),
      servicos_realizados: valor('frota-manut-servicos') || null,
      pecas_trocadas: valor('frota-manut-pecas') || null,
      obs: valor('frota-manut-obs') || null,
    };
    if (!payload.placa) throw new Error('Selecione o veículo da manutenção.');
    if (!payload.descricao) throw new Error('Descreva o problema ou serviço solicitado.');
    return payload;
  }

  function preencherFormularioManutencao(m) {
    const definir = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    definir('frota-manut-id', m.id);
    definir('frota-manut-placa', formatPlaca(m.placa));
    definir('frota-manut-tipo', m.tipo || 'Corretiva');
    definir('frota-manut-status', m.status || 'Agendada');
    definir('frota-manut-oficina', m.oficina_id || '');
    definir('frota-manut-entrada', m.data_entrada ? String(m.data_entrada).slice(0, 10) : '');
    definir('frota-manut-previsao', m.previsao_saida ? String(m.previsao_saida).slice(0, 10) : '');
    definir('frota-manut-saida', m.data_saida ? String(m.data_saida).slice(0, 10) : '');
    definir('frota-manut-km', m.km_entrada);
    definir('frota-manut-custo', m.custo);
    definir('frota-manut-responsavel', m.responsavel);
    definir('frota-manut-descricao', m.descricao);
    definir('frota-manut-servicos', m.servicos_realizados);
    definir('frota-manut-pecas', m.pecas_trocadas);
    definir('frota-manut-obs', m.obs);
    const botao = document.getElementById('frota-manut-salvar');
    if (botao) botao.textContent = 'Atualizar manutenção';
  }

  function limparFormularioManutencao() {
    document.getElementById('frota-manutencao-form')?.reset();
    const id = document.getElementById('frota-manut-id');
    if (id) id.value = '';
    const entrada = document.getElementById('frota-manut-entrada');
    if (entrada) entrada.value = hojeLocalISO();
    const botao = document.getElementById('frota-manut-salvar');
    if (botao) botao.textContent = 'Registrar manutenção';
  }

  function novaManutencaoPara(placa) {
    limparFormularioManutencao();
    if (placa) {
      const select = document.getElementById('frota-manut-placa');
      if (select) select.value = placa;
      const v = buscarVeiculoPorPlaca(placa);
      const km = document.getElementById('frota-manut-km');
      if (km && v && v.quilometragem != null) km.value = v.quilometragem;
    }
    abrirCadastro('frota-sub-manutencao', placa ? 'frota-manut-descricao' : 'frota-manut-placa');
  }

  async function recarregarManutencoesEVeiculos() {
    const fim = window.mostrarCarregandoLogo ? window.mostrarCarregandoLogo() : null;
    try {
      await listarManutencoes();
      const lista = await listarVeiculos();
      renderTabela(lista);
      renderTabelaManutencoes();
      renderGestaoVeiculos();
    } finally {
      if (fim) fim();
    }
  }

  function inicializarManutencoes() {
    limparFormularioManutencao();
    document.getElementById('frota-manut-limpar')?.addEventListener('click', limparFormularioManutencao);
    document.getElementById('frota-manut-filtro-status')?.addEventListener('change', renderTabelaManutencoes);
    document.getElementById('frota-manut-agendar')?.addEventListener('click', () => novaManutencaoPara(null));

    document.getElementById('frota-manut-status')?.addEventListener('change', e => {
      const saida = document.getElementById('frota-manut-saida');
      if (e.target.value === 'Concluída' && saida && !saida.value) saida.value = hojeLocalISO();
    });

    document.getElementById('frota-manutencao-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        const payload = coletarFormularioManutencao();
        const id = document.getElementById('frota-manut-id')?.value;
        await chamarApi(id ? `frota/manutencoes/${id}` : 'frota/manutencoes', id ? 'PUT' : 'POST', payload);
        limparFormularioManutencao();
        await recarregarManutencoesEVeiculos();
        voltarParaTabela('frota-sub-manutencao', id ? 'Manutenção atualizada.' : 'Manutenção registrada.');
      } catch (err) {
        mostrarFeedback(err.message || 'Falha ao salvar manutenção.', 'erro', 'frota-manut-feedback');
      }
    });

    const tbody = document.querySelector('#frota-tabela-manutencoes tbody');
    const abrir = e => {
      const linha = e.target.closest('tr[data-id]');
      if (linha && (e.type === 'click' || e.key === 'Enter')) abrirDetalheManutencao(linha.dataset.id);
    };
    tbody?.addEventListener('click', abrir);
    tbody?.addEventListener('keydown', abrir);

    document.getElementById('frota-detalhe-corpo')?.addEventListener('click', async e => {
      const botao = e.target.closest('[data-manut-acao]');
      if (!botao) return;
      const id = Number(botao.closest('[data-manut-id]')?.dataset.manutId);
      const manut = frotaManutencoesCache.find(m => m.id === id);
      if (!manut) return;
      try {
        if (botao.dataset.manutAcao === 'editar') {
          preencherFormularioManutencao(manut);
          abrirCadastro('frota-sub-manutencao', 'frota-manut-status');
          return;
        }
        if (botao.dataset.manutAcao === 'concluir') {
          if (!confirm(`Concluir a manutenção do veículo ${manut.placa}? Ele volta a ficar Ativo se não houver outra aberta.`)) return;
          await chamarApi(`frota/manutencoes/${id}`, 'PUT', { ...manut, status: 'Concluída', data_saida: manut.data_saida || hojeLocalISO() });
          fecharDetalhe();
          await recarregarManutencoesEVeiculos();
          avisoRapido('Manutenção concluída.');
          return;
        }
        if (botao.dataset.manutAcao === 'excluir') {
          if (!confirm(`Excluir a manutenção do veículo ${manut.placa}? Essa ação não pode ser desfeita.`)) return;
          await chamarApi(`frota/manutencoes/${id}`, 'DELETE');
          fecharDetalhe();
          await recarregarManutencoesEVeiculos();
          avisoRapido('Manutenção excluída.');
        }
      } catch (err) {
        avisoRapido(err.message || 'Falha na ação.', 'erro');
      }
    });
  }

  //======================================================================================================
  // OFICINAS (tabela na aba Manutenção) e CARTÕES (tabela na aba Abastecimento)
  //======================================================================================================
  function abrirDetalheOficina(id) {
    const o = frotaOficinasCache.find(x => String(x.id) === String(id));
    if (!o) return;
    const link = o.url_localizacao
      ? `<a class="frota-link-localizacao" href="${escapeHtml(o.url_localizacao)}" target="_blank" rel="noopener">Abrir mapa</a>` : '';
    const servicosFeitos = frotaManutencoesCache.filter(m => String(m.oficina_id) === String(o.id)).length;
    abrirDetalhe(o.nome_oficina || 'Oficina', `
      <div class="frota-detalhe-grade">
        ${linhaDetalhe('Endereço', escapeHtml(o.endereco || ''))}
        ${linhaDetalhe('Localização', link)}
        ${linhaDetalhe('Serviços', escapeHtml(o.servicos || ''))}
        ${linhaDetalhe('Área de atendimento', escapeHtml(o.area_atendimento || ''))}
        ${linhaDetalhe('Horário', escapeHtml(o.horario_funcionamento || ''))}
        ${linhaDetalhe('Responsável técnico', escapeHtml(o.responsavel_tecnico || ''))}
        ${linhaDetalhe('CNPJ', escapeHtml(o.cnpj || ''))}
        ${linhaDetalhe('Contato', escapeHtml(o.numero_contato || ''))}
        ${linhaDetalhe('Manutenções registradas', String(servicosFeitos))}
        ${linhaDetalhe('Obs', escapeHtml(o.obs || ''))}
      </div>
      <div class="frota-detalhe-acoes" data-oficina-id="${o.id}">
        <button type="button" class="btn-secundario" data-oficina-acao="editar">Editar</button>
        <button type="button" class="btn-secundario" data-oficina-acao="excluir">Excluir</button>
      </div>`);
  }

  function preencherFormularioOficina(o) {
    const definir = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    definir('frota-oficina-id', o.id);
    definir('frota-oficina-nome', o.nome_oficina);
    definir('frota-oficina-endereco', o.endereco);
    definir('frota-oficina-url', o.url_localizacao);
    definir('frota-oficina-servicos', o.servicos);
    definir('frota-oficina-area', o.area_atendimento);
    definir('frota-oficina-horario', o.horario_funcionamento);
    definir('frota-oficina-responsavel', o.responsavel_tecnico);
    definir('frota-oficina-cnpj', o.cnpj);
    definir('frota-oficina-contato', o.numero_contato);
    definir('frota-oficina-obs', o.obs);
    const botao = document.querySelector('#frota-oficina-form button[type="submit"]');
    if (botao) botao.textContent = 'Atualizar oficina';
  }

  function abrirDetalheCartao(id) {
    const lista = frotaCartoesCache || [];
    const c = lista.find(x => String(x.id) === String(id));
    if (!c) return;
    abrirDetalhe(c.nome || 'Cartão', `
      <div class="frota-detalhe-grade">
        ${linhaDetalhe('Número', escapeHtml(c.numero || ''))}
        ${linhaDetalhe('Veículo', escapeHtml(c.placa || 'Sem vínculo'))}
        ${linhaDetalhe('Bandeira', escapeHtml(c.bandeira || ''))}
        ${linhaDetalhe('Status', escapeHtml(c.status || ''))}
        ${linhaDetalhe('Obs', escapeHtml(c.obs || ''))}
      </div>
      <div class="frota-detalhe-acoes" data-cartao-id="${c.id}">
        <button type="button" class="btn-secundario" data-cartao-acao="editar">Editar</button>
        <button type="button" class="btn-secundario" data-cartao-acao="excluir">Excluir</button>
      </div>`);
  }

  function preencherFormularioCartao(c) {
    const definir = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    definir('frota-cartao-abastecimento-id', c.id);
    definir('frota-cartao-abastecimento-nome', c.nome);
    definir('frota-cartao-abastecimento-numero', c.numero);
    definir('frota-cartao-abastecimento-placa', c.placa || '');
    definir('frota-cartao-abastecimento-bandeira', c.bandeira);
    definir('frota-cartao-abastecimento-status', c.status || 'Ativo');
    definir('frota-cartao-abastecimento-obs', c.obs);
    const botao = document.querySelector('#frota-cartoes-abastecimento-form button[type="submit"]');
    if (botao) botao.textContent = 'Atualizar cartão';
  }

  function marcarLinhasClicaveis(tbodySeletor, atributo, lista) {
    const tbody = document.querySelector(tbodySeletor);
    if (!tbody) return;
    const linhas = tbody.querySelectorAll('tr');
    (lista || []).forEach((item, i) => {
      const tr = linhas[i];
      if (!tr || item.id == null) return;
      tr.dataset[atributo] = item.id;
      tr.classList.add('frota-linha-clicavel');
      tr.tabIndex = 0;
      tr.title = 'Ver detalhes';
    });
  }

  function inicializarOficinasECartoes() {
    document.getElementById('frota-oficina-nova')?.addEventListener('click', () => {
      limparFormularioOficina();
      abrirCadastro('frota-sub-oficinas', 'frota-oficina-nome');
    });
    document.getElementById('frota-cartao-novo')?.addEventListener('click', () => {
      limparFormularioCartaoAbastecimento();
      abrirCadastro('frota-sub-cartoes', 'frota-cartao-abastecimento-nome');
    });

    const ligar = (seletor, atributo, abrirFn) => {
      const tbody = document.querySelector(seletor);
      const abrir = e => {
        const linha = e.target.closest('tr');
        const id = linha && linha.dataset[atributo];
        if (id && !e.target.closest('a') && (e.type === 'click' || e.key === 'Enter')) abrirFn(id);
      };
      tbody?.addEventListener('click', abrir);
      tbody?.addEventListener('keydown', abrir);
    };
    ligar('#frota-tabela-oficinas tbody', 'oficinaId', abrirDetalheOficina);
    ligar('#frota-tabela-cartoes-abastecimento tbody', 'cartaoId', abrirDetalheCartao);

    document.getElementById('frota-detalhe-corpo')?.addEventListener('click', async e => {
      const botaoOficina = e.target.closest('[data-oficina-acao]');
      const botaoCartao = e.target.closest('[data-cartao-acao]');
      try {
        if (botaoOficina) {
          const id = botaoOficina.closest('[data-oficina-id]').dataset.oficinaId;
          const o = frotaOficinasCache.find(x => String(x.id) === String(id));
          if (botaoOficina.dataset.oficinaAcao === 'editar' && o) {
            preencherFormularioOficina(o);
            abrirCadastro('frota-sub-oficinas', 'frota-oficina-nome');
          } else if (botaoOficina.dataset.oficinaAcao === 'excluir') {
            if (!confirm('Excluir esta oficina? As manutenções já registradas continuam no histórico.')) return;
            await chamarApi(`frota/oficinas/${id}`, 'DELETE');
            fecharDetalhe();
            await atualizarOficinas();
            avisoRapido('Oficina excluída.');
          }
        }
        if (botaoCartao) {
          const id = botaoCartao.closest('[data-cartao-id]').dataset.cartaoId;
          const c = (frotaCartoesCache || []).find(x => String(x.id) === String(id));
          if (botaoCartao.dataset.cartaoAcao === 'editar' && c) {
            preencherFormularioCartao(c);
            abrirCadastro('frota-sub-cartoes', 'frota-cartao-abastecimento-nome');
          } else if (botaoCartao.dataset.cartaoAcao === 'excluir') {
            if (!confirm('Excluir este cartão de abastecimento?')) return;
            await chamarApi(`frota/cartoes/${id}`, 'DELETE');
            fecharDetalhe();
            await atualizarCartoes();
            avisoRapido('Cartão excluído.');
          }
        }
      } catch (err) {
        avisoRapido(err.message || 'Falha na ação.', 'erro');
      }
    });
  }

  async function atualizarOficinas() {
    frotaOficinasCache = await listarOficinas();
    renderTabelaOficinas(frotaOficinasCache);
    marcarLinhasClicaveis('#frota-tabela-oficinas tbody', 'oficinaId', frotaOficinasCache);
    preencherSelectOficinasManutencao(frotaOficinasCache);
  }

  async function atualizarCartoes() {
    const lista = await listarCartoesAbastecimento();
    renderTabelaCartoesAbastecimento(lista);
    marcarLinhasClicaveis('#frota-tabela-cartoes-abastecimento tbody', 'cartaoId', lista);
  }

  async function inicializarFrotaGestao() {
    inicializarSubabasCadastro();
    inicializarGestaoVeiculos();
    inicializarManutencoes();
    inicializarOficinasECartoes();
    preencherSelectPlacasManutencao(frotaVeiculosCache);
    await Promise.all([atualizarOficinas(), atualizarCartoes(), listarManutencoes(), listarAlertas()]);
    renderTabelaManutencoes();
    renderGestaoVeiculos();
  }

  document.addEventListener('DOMContentLoaded', inicializarFrota);
})();