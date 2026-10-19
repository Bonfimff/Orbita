  // Função para atualizar o cabeçalho e colunas da tabela conforme seleção do campo "Buscar em:"
  function atualizarTabelaPorContextoBusca() {
    // Função agora não faz mais nada para o contexto "kits".
    // Toda a exibição de kits é feita exclusivamente pela tabela de kits.
    // Se necessário, pode-se restaurar o cabeçalho padrão da tabela de produtos aqui para outros contextos.
    const selectBusca = document.getElementById('contexto-busca') || document.getElementById('buscar-em');
    if (!selectBusca) return;
    const valor = selectBusca.value?.toLowerCase?.() || '';
    if (valor === 'kits' || valor.includes('kit')) {
      // Não faz nada: exibição de kits é exclusiva da tabela de kits
      return;
    }
    // Aqui pode-se restaurar o cabeçalho padrão da tabela de produtos, se necessário
  }

  // Adiciona listener ao select de contexto de busca
  document.getElementById('contexto-busca')?.addEventListener('change', atualizarTabelaPorContextoBusca);
  document.getElementById('buscar-em')?.addEventListener('change', atualizarTabelaPorContextoBusca);

  // Chama ao carregar a página para garantir consistência
  atualizarTabelaPorContextoBusca();

if (!window.TUNNEL_API_URL) {
  window.TUNNEL_API_URL = 'http://127.0.0.1:5000';
}

function apiUrl(path) {
  let base = window.TUNNEL_API_URL;
  if (!base.endsWith('/')) base += '/';
  if (path.startsWith('/')) path = path.slice(1);
  return base + path;
}

// ======================================================================================================
// FUNÇÃO: Carregar Datalist de IDs de Retirada para o input de devolução
// Preenche automaticamente o datalist do input devolucao-id com os IDs vindos do backend
// ======================================================================================================
function carregarDatalistRetiradas() {
  // Garante que a função só rode se o input existir
  const inputDevolucao = document.getElementById('devolucao-id');
  if (!inputDevolucao) return;

  // Cria o datalist se não existir
  let datalist = document.getElementById('lista-retiradas');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'lista-retiradas';
    document.body.appendChild(datalist);
  }
  inputDevolucao.setAttribute('list', 'lista-retiradas');

  // Limpa opções antigas
  datalist.innerHTML = '';

  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('Não foi possível carregar as retiradas para devolução: token de autenticação ausente.');
    return;
  }

  // Busca os IDs de retirada do backend
  fetch(apiUrl('retiradas/ids'), {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
    },
  })
    .then(response => {
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Falha ao carregar retiradas: 401 (sessão expirada ou token inválido)');
        }
        throw new Error(`Falha ao carregar retiradas: ${response.status}`);
      }
      return response.json();
    })
    .then(dados => {
      const listaIds = Array.isArray(dados) ? dados : (Array.isArray(dados?.ids) ? dados.ids : []);

      datalist.innerHTML = '';
      listaIds.forEach(item => {
        const valor = typeof item === 'string' ? item : String(item?.id ?? item?.valor ?? item ?? '');
        if (!valor) return;
        const option = document.createElement('option');
        option.value = valor;
        datalist.appendChild(option);
      });
    })
    .catch(error => {
      console.warn('Não foi possível carregar as retiradas para devolução:', error);
    });
}

const RASCUNHO_RETIRADA_KEY = 'almoxarifado:retirada:rascunho:v1';

function obterDadosRascunhoRetirada() {
  const camposIds = [
    'retirada-id',
    'retirada-data',
    'retirada-requisitante',
    'retirada-responsavel',
    'retirada-local',
    'retirada-outro-local',
    'retirada-finalidade',
    'retirada-observacoes',
  ];

  const campos = {};
  camposIds.forEach(id => {
    const elemento = document.getElementById(id);
    if (elemento) campos[id] = elemento.value;
  });

  return {
    campos,
    itensHtml: document.getElementById('itens-retirada')?.innerHTML || '',
  };
}

function salvarRascunhoRetirada() {
  try {
    localStorage.setItem(RASCUNHO_RETIRADA_KEY, JSON.stringify(obterDadosRascunhoRetirada()));
  } catch (error) {
    console.warn('Não foi possível salvar o rascunho da retirada:', error);
  }
}

function limparRascunhoRetirada() {
  try {
    localStorage.removeItem(RASCUNHO_RETIRADA_KEY);
  } catch (error) {
    console.warn('Não foi possível limpar o rascunho da retirada:', error);
  }
}

function carregarRascunhoRetirada() {
  try {
    const bruto = localStorage.getItem(RASCUNHO_RETIRADA_KEY);
    if (!bruto) return false;

    const rascunho = JSON.parse(bruto);
    if (!rascunho || typeof rascunho !== 'object') return false;

    Object.entries(rascunho.campos || {}).forEach(([id, valor]) => {
      const elemento = document.getElementById(id);
      if (elemento && typeof valor === 'string') {
        elemento.value = valor;
      }
    });

    const tabelaItens = document.getElementById('itens-retirada');
    if (tabelaItens && typeof rascunho.itensHtml === 'string') {
      tabelaItens.innerHTML = rascunho.itensHtml;
    }

    if (rascunho.campos?.['retirada-id']) {
      idRetiradaGerado = rascunho.campos['retirada-id'];
    }

    return true;
  } catch (error) {
    console.warn('Não foi possível carregar o rascunho da retirada:', error);
    return false;
  }
}

// Baixar planilha: ícone no cabeçalho de cada tabela da Busca (SCRIPT/exportar-tabela.js).
if (window.ExportarTabela) {
  [['#Lista-dos-produtos', 'Produtos do estoque', 'produtos_estoque'],
   ['#tabela-kits-lista', 'Kits', 'kits_estoque'],
   ['#tabela-retiradas-lista', 'Retiradas', 'retiradas_estoque'],
   ['#tabela-devolucoes-lista', 'Devoluções', 'devolucoes_estoque'],
   ['#tabela-fornecedores-lista', 'Fornecedores', 'fornecedores'],
   ['#tabela-requisitantes-lista', 'Requisitantes', 'requisitantes'],
  ].forEach(([sel, titulo, arquivo]) => window.ExportarTabela.ligar(sel, { titulo, arquivo }));
}
// Controla qual bloco de busca é exibido conforme o tipo selecionado
document.addEventListener('DOMContentLoaded', function() {
  const selectTipoBusca = document.getElementById('tipo-busca');

  // Mapa: valor do select → ID do bloco
  const blocosBusca = {
    produtos:      'busca-bloco-produtos',
    kits:          'busca-bloco-kits',
    retiradas:     'busca-bloco-retiradas',
    devolucoes:    'busca-bloco-devolucoes',
    fornecedores:  'busca-bloco-fornecedores',
    requisitantes: 'busca-bloco-requisitantes',
  };

  function mostrarBlocoAtivo(tipo) {
    // Oculta todos os blocos
    Object.values(blocosBusca).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    // Exibe o bloco do tipo selecionado
    const blocoId = blocosBusca[tipo];
    const blocoAtivo = blocoId ? document.getElementById(blocoId) : null;
    if (blocoAtivo) blocoAtivo.style.display = 'block';
  }

  function carregarDadosTipo(tipo) {
    switch(tipo) {
      case 'produtos':
        if (typeof carregarTodosProdutos === 'function') carregarTodosProdutos();
        break;
      case 'kits':
        if (typeof carregarTodosKits === 'function') carregarTodosKits();
        break;
      case 'retiradas':
        if (typeof carregarTodasRetiradas === 'function') carregarTodasRetiradas();
        break;
      case 'devolucoes':
        if (typeof carregarTodasDevolucoes === 'function') carregarTodasDevolucoes();
        break;
      case 'fornecedores':
        if (typeof carregarTodosFornecedores === 'function') carregarTodosFornecedores();
        break;
      case 'requisitantes':
        if (typeof carregarTodosRequisitantes === 'function') carregarTodosRequisitantes();
        break;
    }
  }

  function atualizarBusca() {
    if (!selectTipoBusca) return;
    const tipo = selectTipoBusca.value;
    mostrarBlocoAtivo(tipo);
    carregarDadosTipo(tipo);
  }

  if (selectTipoBusca) {
    selectTipoBusca.addEventListener('change', atualizarBusca);
    atualizarBusca(); // Executa ao carregar para exibir o bloco inicial
  }

  // Filtros em tempo real para Retiradas
  document.getElementById('filtro-retirada-requisitante')?.addEventListener('input', () => filtrarTabelaGenerica('tabela-retiradas-lista'));
  document.getElementById('filtro-retirada-produto')?.addEventListener('input', () => filtrarTabelaGenerica('tabela-retiradas-lista'));

  // Filtros em tempo real para Devoluções
  document.getElementById('filtro-devolucao-requisitante')?.addEventListener('input', () => filtrarTabelaGenerica('tabela-devolucoes-lista'));
  document.getElementById('filtro-devolucao-produto')?.addEventListener('input', () => filtrarTabelaGenerica('tabela-devolucoes-lista'));

  // Filtros em tempo real para Fornecedores
  document.getElementById('filtro-fornecedor-nome')?.addEventListener('input', () => filtrarTabelaGenerica('tabela-fornecedores-lista'));

  // Filtros em tempo real para Requisitantes
  document.getElementById('filtro-requisitante-nome')?.addEventListener('input', () => filtrarTabelaGenerica('tabela-requisitantes-lista'));
});
document.addEventListener('DOMContentLoaded', function () {
  // Carrega o datalist de IDs de retirada para o input de devolução
  carregarDatalistRetiradas();

  // Código existente do almoxarifado.js
  const sidebarContent = document.getElementById('sidebar-content'); 
  const tbodyItens = document.getElementById('itens-retirada');
  const tabs = document.querySelectorAll('.tab-btn'); 
  const tabContents = document.querySelectorAll('.tab-content'); 

  

  //======================================================================================================
  // FUNÇÃO AUXILIAR: Atualizar Preview no Painel Lateral
  // Atualiza o preview do cupom no painel lateral com os itens de retirada selecionados.
  //======================================================================================================
  function atualizarPreviewCupom() {
    const itensRetirada = document.querySelectorAll('#itens-retirada tr');

    if (!sidebarContent) return;

    // Verifica se está na aba Retiradas
    const abaRetiradasAtiva = document.getElementById('retiradas')?.classList.contains('active');
    if (abaRetiradasAtiva) {
      if (itensRetirada.length === 0) {
        // Exibe mensagem padrão se não houver itens na lista
        sidebarContent.innerHTML = `
          <h4>Status do Sistema</h4>
          <p>Notificação: Nenhum item adicionado para retirada.</p>
        `;
        return;
      }

      // Coleta os dados para exibir o preview
      const campos = {
        id: document.getElementById('retirada-id')?.value || '-',
        data: document.getElementById('retirada-data')?.value || '-',
        requisitante: document.getElementById('retirada-requisitante')?.value || '-',
        responsavel: document.getElementById('retirada-responsavel')?.value || '-',
        local: document.getElementById('retirada-local')?.value === 'Outro'
          ? (document.getElementById('retirada-outro-local')?.value || '-')
          : (document.getElementById('retirada-local')?.value || '-'),
        finalidade: document.getElementById('retirada-finalidade')?.value || '-',
        obs: document.getElementById('retirada-observacoes')?.value || '-'
      };

      const itensHtml = Array.from(itensRetirada).map(tr => {
        const nomeItem = tr.children[0].textContent;
        const quantidadeItem = tr.children[1].textContent;
        const idItem = tr.children[4]?.dataset.id || '-';

        return `
          <div style="margin-bottom: 8px;">
            <b>${nomeItem}</b><br>
            <span style="font-size: 12px; color: #555;">Qtde: ${quantidadeItem} | ID: ${idItem}</span>
          </div>
        `;
      }).join('');

      // Exibe o preview da nota com a linha de assinatura
      sidebarContent.innerHTML = gerarHtmlPreviewCupom(campos, itensHtml);
    } else {
      renderSidebar();
    }
  }

  //======================================================================================================
  // FUNÇÃO AUXILIAR: Gerar HTML do Preview
  // Gera o HTML do preview do cupom a partir dos campos e itens informados.
  //======================================================================================================
  function gerarHtmlPreviewCupom(campos, itensHtml) {
    const qrRetiradaUrl = campos.id && campos.id !== '-'
      ? `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(`ID: ${campos.id}`)}`
      : '';

    return `
      <div style="margin-bottom: 16px;">
        <h4 style="margin-bottom: 8px;">Nota de Retirada</h4>
        <div style="
          background: #fff;
          border: 1px dashed #888;
          border-radius: 8px;
          padding: 16px;
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          color: #222;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          max-width: 260px;
          text-align: left;
        ">
          <div style="text-align:center; font-weight:bold; margin-bottom:8px; font-size:15px;">
            *** SINAL VIDA PLUS ***
          </div>
          <div style="font-size:12px; margin-bottom:8px; line-height:1.4;">
            <b>ID:</b> ${campos.id}<br>
            <b>Data:</b> ${campos.data}<br>
            <b>Requisitante:</b> ${campos.requisitante}<br>
            <b>Responsável:</b> ${campos.responsavel}<br>
            <b>Local:</b> ${campos.local}<br>
            <b>Finalidade:</b> ${campos.finalidade}<br>
            <b>Observações:</b> ${campos.obs || 'Nenhuma'}
          </div>
          <div style="border-bottom:1px dashed #bbb; margin-bottom:8px;"></div>
          <div style="margin-bottom: 8px;"><b>Itens:</b></div>
          ${itensHtml}
          <div style="border-top:1px dashed #bbb; margin-top:8px; font-size:11px; text-align:center;">
          </div>
          <div style="margin-top: 16px; text-align: center;">
            <hr style="border: none; border-top: 1.4px solid #888; margin: 16px 0;margin-top: 40px; width: 100%;">
            <span style="font-size: 12px; color: #888;">Assinatura do Requisitante</span>
            <div style="border-top:1px dashed #bbb; margin-top:8px; font-size:11px; text-align:center;">
            <br>Retirada registrada
            ${qrRetiradaUrl ? `<div style="margin-top: 10px;"><img src="${qrRetiradaUrl}" alt="QR Code da retirada" style="width: 110px; height: 110px; display: block; margin: 0 auto;" /></div>` : ''}
          </div>
          </div>
        </div>
      </div>
    `;
  }

  //======================================================================================================
  // FUNÇÃO AUXILIAR: Renderizar Conteúdo Padrão na Barra Lateral
  // Renderiza o conteúdo padrão na barra lateral do sistema.
  //======================================================================================================
  function renderSidebar() {
    if (sidebarContent) {
      sidebarContent.innerHTML = `
        <div class="sidebar-section">
          <h3>Status do Sistema</h3>
          <ul>
            <li>Notificação: Novo produto salvo com sucesso!</li>
            <li>Estoque crítico: Parafuso M10 - Qtde: 2</li>
          </ul>
        </div>
        <div class="sidebar-section">
          <h3>Resumo</h3>
          <ul>
            <li>Total Produtos: 245</li>
            <li>Vencendo em 30 dias: 12</li>
            <li>Média Estoque: 38 unid</li>
          </ul>
        </div>
      `;
    }
  }

  // Adiciona eventos para atualizar o preview ao alterar os campos
  const camposParaMonitorar = [
    'retirada-id',
    'retirada-data',
    'retirada-requisitante',
    'retirada-responsavel',
    'retirada-observacoes',
    'retirada-finalidade',
    'retirada-local',
    'retirada-outro-local',
    'retirada-produto',
    'retirada-quantidade'
  ];

  camposParaMonitorar.forEach(campoId => {
    const campo = document.getElementById(campoId);
    if (campo) {
      campo.addEventListener('input', () => {
        atualizarPreviewCupom();
        salvarRascunhoRetirada();
      });
      campo.addEventListener('change', () => {
        atualizarPreviewCupom();
        salvarRascunhoRetirada();
      });
    }
  });

  // Adiciona item à tabela ao clicar no botão "Acrescentar Item"
  const btnAcrescentarItem = document.getElementById('btn-acrescentar-item');
  if (btnAcrescentarItem) {
    btnAcrescentarItem.addEventListener('click', function () {
      const produto = document.getElementById('retirada-produto').value;
      const quantidade = document.getElementById('retirada-quantidade').value;
      const local = document.getElementById('retirada-local').value === 'Outro'
        ? document.getElementById('retirada-outro-local').value
        : document.getElementById('retirada-local').value;
      const finalidade = document.getElementById('retirada-finalidade').value;

      const faltando = [[produto, 'Produto'], [quantidade, 'Quantidade'], [local, 'Local de destino'], [finalidade, 'Finalidade']]
        .filter(([v]) => !v).map(([, nome]) => nome);
      if (faltando.length) {
        alert('Falta preencher: ' + faltando.join(', ') + '.');
        return;
      }

      // Adiciona item à tabela
      const newRow = document.createElement('tr');
      newRow.innerHTML = `
        <td>${produto}</td>
        <td>${quantidade}</td>
        <td>${local}</td>
        <td>${finalidade}</td>
        <td data-id="ID_AQUI">
          <button class="acao-btn editar-item">Editar</button>
          <button class="acao-btn remover-item">Remover</button>
        </td>
      `;
      tbodyItens.appendChild(newRow);

      // Limpa os campos do produto
      document.getElementById('retirada-produto').value = '';
      document.getElementById('retirada-quantidade').value = '';

      // Atualiza o preview no painel lateral
      atualizarPreviewCupom();
      salvarRascunhoRetirada();
    });
  }

  // Remover ou editar item da tabela
  tbodyItens.addEventListener('click', function (e) {
    if (e.target.classList.contains('remover-item')) {
      e.target.closest('tr').remove();
      atualizarPreviewCupom();
      salvarRascunhoRetirada();
    }
    if (e.target.classList.contains('editar-item')) {
      const row = e.target.closest('tr');
      document.getElementById('retirada-produto').value = row.cells[0].textContent;
      document.getElementById('retirada-quantidade').value = row.cells[1].textContent;
      row.remove();
      atualizarPreviewCupom();
      salvarRascunhoRetirada();
    }
  });

  // Atualiza o preview ao acessar a aba Retiradas
  tabs.forEach(tab => {
    tab.addEventListener('click', function () {
      const tabId = this.getAttribute('data-tab'); // Obtém o ID da aba
      tabContents.forEach(content => content.classList.remove('active'));
      document.getElementById(tabId)?.classList.add('active');

      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');

      atualizarPreviewCupom();
    });
  });

  // Atualiza o preview ao carregar a página
  atualizarPreviewCupom();

  // Função para carregar TODOS os produtos do banco
  async function carregarTodosProdutos() {
    try {
      const response = await fetch(apiUrl('produtos/consultar'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify({
          nome_produto_consulta: '',
          codigo_produto_consulta: '',
          categoria_produto_consulta: '',
        }),
      });
      const data = await response.json();
      if (response.ok && data.status === 'ok') {
        const tabelaProdutos = document.querySelector('#Lista-dos-produtos tbody');
        tabelaProdutos.innerHTML = '';
        data.produtos.forEach(produto => {
          const row = document.createElement('tr');
          function colunaVisivel(coluna) {
            const grupo = getGrupoColunasAtivo();
            if (!grupo.checkboxes || !grupo.checkboxes.length) return true;
            const checkbox = Array.from(grupo.checkboxes).find(cb => cb.value === coluna);
            return checkbox ? checkbox.checked : true;
          }
          if (colunaVisivel('id')) row.innerHTML += `<td data-coluna="id">${produto.id}</td>`;
          if (colunaVisivel('nome-produto')) row.innerHTML += `<td data-coluna="nome-produto">${produto.nome_produto}</td>`;
          if (colunaVisivel('codigo')) row.innerHTML += `<td data-coluna="codigo">${produto.codigo || ''}</td>`;
          if (colunaVisivel('marca')) row.innerHTML += `<td data-coluna="marca">${produto.marca || ''}</td>`;
          if (colunaVisivel('categoria')) row.innerHTML += `<td data-coluna="categoria">${produto.categoria || ''}</td>`;
          if (colunaVisivel('unidade-medida')) row.innerHTML += `<td data-coluna="unidade-medida">${produto.unidade_medida || ''}</td>`;
          if (colunaVisivel('numero-serie')) row.innerHTML += `<td data-coluna="numero-serie">${produto.numero_serie || ''}</td>`;
          if (colunaVisivel('patrimonio')) row.innerHTML += `<td data-coluna="patrimonio">${produto.patrimonio || ''}</td>`;
          if (colunaVisivel('local')) row.innerHTML += `<td data-coluna="local">${produto.local || ''}</td>`;
          if (colunaVisivel('estoque')) row.innerHTML += `<td data-coluna="estoque">${produto.estoque || ''}</td>`;
          if (colunaVisivel('quantidade')) row.innerHTML += `<td data-coluna="quantidade">${produto.quantidade || ''}</td>`;
          if (colunaVisivel('estoque-minimo')) row.innerHTML += `<td data-coluna="estoque-minimo">${produto.estoque_minimo || ''}</td>`;
          if (colunaVisivel('custo')) row.innerHTML += `<td data-coluna="custo">${produto.custo || ''}</td>`;
          if (colunaVisivel('data-compra')) row.innerHTML += `<td data-coluna="data-compra">${produto.data_compra || ''}</td>`;
          if (colunaVisivel('numero-nota')) row.innerHTML += `<td data-coluna="numero-nota">${produto.numero_nota || ''}</td>`;
          if (colunaVisivel('fornecedor')) row.innerHTML += `<td data-coluna="fornecedor">${produto.fornecedor || ''}</td>`;
          if (colunaVisivel('data-validade')) row.innerHTML += `<td data-coluna="data-validade">${produto.data_validade || ''}</td>`;
          if (colunaVisivel('termino-garantia')) row.innerHTML += `<td data-coluna="termino-garantia">${produto.termino_garantia || ''}</td>`;
          if (colunaVisivel('outras-informacoes')) row.innerHTML += `<td data-coluna="outras-informacoes">${produto.outras_informacoes || ''}</td>`;
          if (colunaVisivel('imagem')) row.innerHTML += `<td data-coluna="imagem">${produto.imagem_base64 ? `<img src='data:image/png;base64,${produto.imagem_base64}' style='max-width:60px;max-height:60px;object-fit:contain;display:block;margin:auto;cursor:pointer;' />` : ''}</td>`;
          tabelaProdutos.appendChild(row);
        });
        // Exibe a tabela de produtos
        document.getElementById('produtos-tabela-bloco').style.display = '';
        // Aplica qualquer filtro que esteja nos campos
        filtrarTabelaProdutos();
      } else {
        console.error('Erro ao buscar produtos:', data.mensagem);
      }
    } catch (error) {
      console.error('Erro ao conectar ao servidor:', error);
    }
  }

  // ===== FILTRO GENÉRICO PARA QUALQUER TABELA =====
  // Filtra as linhas de uma tabela pelo texto digitado nos campos do bloco visível
  // tabelaId: ID da <table>
  function filtrarTabelaGenerica(tabelaId) {
    const tbody = document.querySelector(`#${tabelaId} tbody`);
    if (!tbody) return;

    // Descobre o bloco pai da tabela para limitar os filtros ao bloco ativo
    const tabela = document.getElementById(tabelaId);
    const bloco = tabela ? tabela.closest('.busca-bloco') : null;

    // Coleta os valores dos inputs de filtro do bloco ativo
    const filtros = [];
    if (bloco) {
      bloco.querySelectorAll('input[id^="filtro-"]').forEach(input => {
        const val = input.value?.trim().toLowerCase();
        if (val) {
          const partes = input.id.split('-');
          const coluna = partes[partes.length - 1];
          filtros.push({ coluna, val });
        }
      });
    }

    tbody.querySelectorAll('tr').forEach(linha => {
      const passa = filtros.every(({ coluna, val }) => {
        const cell = linha.querySelector(`[data-coluna="${coluna}"]`);
        return !cell || cell.textContent.trim().toLowerCase().includes(val);
      });
      linha.style.display = passa ? '' : 'none';
    });
  }

  // ===== FILTRO EM TEMPO REAL NA TABELA DE PRODUTOS =====
  // Função para filtrar a tabela conforme o usuário digita nos campos
  function filtrarTabelaProdutos() {
    const nomeFiltro = document.getElementById('nome-produto-consulta')?.value.trim().toLowerCase() || '';
    const codigoFiltro = document.getElementById('codigo-produto-consulta')?.value.trim().toLowerCase() || '';
    const categoriaFiltro = document.getElementById('categoria-produto-consulta')?.value.toLowerCase() || '';
    
    const tabelaProdutos = document.querySelector('#Lista-dos-produtos tbody');
    if (!tabelaProdutos) return;
    
    const linhas = tabelaProdutos.querySelectorAll('tr');
    let totalVisivel = 0;
    
    linhas.forEach(linha => {
      const id = linha.querySelector('[data-coluna="id"]')?.textContent.trim().toLowerCase() || '';
      const nome = linha.querySelector('[data-coluna="nome-produto"]')?.textContent.trim().toLowerCase() || '';
      const codigo = linha.querySelector('[data-coluna="codigo"]')?.textContent.trim().toLowerCase() || '';
      const categoria = linha.querySelector('[data-coluna="categoria"]')?.textContent.trim().toLowerCase() || '';
      
      // Verifica se a linha corresponde a TODOS os filtros preenchidos
      const passaNome = !nomeFiltro || nome.includes(nomeFiltro);
      const passaCodigo = !codigoFiltro || codigo.includes(codigoFiltro);
      const passaCategoria = !categoriaFiltro || categoria === categoriaFiltro || categoriaFiltro === '';
      
      const correspondente = passaNome && passaCodigo && passaCategoria;
      
      if (correspondente) {
        linha.style.display = '';
        totalVisivel++;
      } else {
        linha.style.display = 'none';
      }
    });
    
    // Se nenhuma linha corresponder, mostra mensagem
    if (totalVisivel === 0 && (nomeFiltro || codigoFiltro || categoriaFiltro)) {
      const mensagem = document.getElementById('mensagem-filtro-vazio') || document.createElement('div');
      if (!document.getElementById('mensagem-filtro-vazio')) {
        mensagem.id = 'mensagem-filtro-vazio';
        mensagem.style.cssText = 'text-align: center; padding: 20px; color: #888; font-style: italic;';
        tabelaProdutos.parentElement.appendChild(mensagem);
      }
      mensagem.textContent = 'Nenhum produto encontrado com esses filtros.';
      mensagem.style.display = 'block';
    } else {
      const mensagem = document.getElementById('mensagem-filtro-vazio');
      if (mensagem) mensagem.style.display = 'none';
    }
  }

  // Adiciona listeners aos campos de filtro para filtrar em tempo real
  document.getElementById('nome-produto-consulta')?.addEventListener('input', filtrarTabelaProdutos);
  document.getElementById('codigo-produto-consulta')?.addEventListener('input', filtrarTabelaProdutos);
  document.getElementById('categoria-produto-consulta')?.addEventListener('change', filtrarTabelaProdutos);

  // Lógica unificada de busca para o formulário principal
  const formBusca = document.getElementById('form-busca') || document.getElementById('form-produtos-consulta');
  if (formBusca) {
    formBusca.addEventListener('submit', async function (event) {
      event.preventDefault();
      const tipoBusca = document.getElementById('tipo-busca').value;
      // Campos fixos de produto
      const nomeProduto = document.getElementById('nome-produto-consulta').value.trim();
      const codigoProduto = document.getElementById('codigo-produto-consulta').value.trim();
      const categoriaProduto = document.getElementById('categoria-produto-consulta').value;

      if (tipoBusca === 'produtos') {
        try {
          const response = await fetch(apiUrl('produtos/consultar'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + localStorage.getItem('token'),
            },
            body: JSON.stringify({
              nome_produto_consulta: nomeProduto,
              codigo_produto_consulta: codigoProduto,
              categoria_produto_consulta: categoriaProduto,
            }),
          });
          const data = await response.json();
          if (response.ok && data.status === 'ok') {
            const tabelaProdutos = document.querySelector('#Lista-dos-produtos tbody');
            tabelaProdutos.innerHTML = '';
            data.produtos.forEach(produto => {
              const row = document.createElement('tr');
              function colunaVisivel(coluna) {
                const grupo = getGrupoColunasAtivo();
                if (!grupo.checkboxes || !grupo.checkboxes.length) return true;
                const checkbox = Array.from(grupo.checkboxes).find(cb => cb.value === coluna);
                return checkbox ? checkbox.checked : true;
              }
              if (colunaVisivel('id')) row.innerHTML += `<td data-coluna="id">${produto.id}</td>`;
              if (colunaVisivel('nome-produto')) row.innerHTML += `<td data-coluna="nome-produto">${produto.nome_produto}</td>`;
              if (colunaVisivel('codigo')) row.innerHTML += `<td data-coluna="codigo">${produto.codigo || ''}</td>`;
              if (colunaVisivel('marca')) row.innerHTML += `<td data-coluna="marca">${produto.marca || ''}</td>`;
              if (colunaVisivel('categoria')) row.innerHTML += `<td data-coluna="categoria">${produto.categoria || ''}</td>`;
              if (colunaVisivel('unidade-medida')) row.innerHTML += `<td data-coluna="unidade-medida">${produto.unidade_medida || ''}</td>`;
              if (colunaVisivel('numero-serie')) row.innerHTML += `<td data-coluna="numero-serie">${produto.numero_serie || ''}</td>`;
              if (colunaVisivel('patrimonio')) row.innerHTML += `<td data-coluna="patrimonio">${produto.patrimonio || ''}</td>`;
              if (colunaVisivel('local')) row.innerHTML += `<td data-coluna="local">${produto.local || ''}</td>`;
              if (colunaVisivel('estoque')) row.innerHTML += `<td data-coluna="estoque">${produto.estoque || ''}</td>`;
              if (colunaVisivel('quantidade')) row.innerHTML += `<td data-coluna="quantidade">${produto.quantidade || ''}</td>`;
              if (colunaVisivel('estoque-minimo')) row.innerHTML += `<td data-coluna="estoque-minimo">${produto.estoque_minimo || ''}</td>`;
              if (colunaVisivel('custo')) row.innerHTML += `<td data-coluna="custo">${produto.custo || ''}</td>`;
              if (colunaVisivel('data-compra')) row.innerHTML += `<td data-coluna="data-compra">${produto.data_compra || ''}</td>`;
              if (colunaVisivel('numero-nota')) row.innerHTML += `<td data-coluna="numero-nota">${produto.numero_nota || ''}</td>`;
              if (colunaVisivel('fornecedor')) row.innerHTML += `<td data-coluna="fornecedor">${produto.fornecedor || ''}</td>`;
              if (colunaVisivel('data-validade')) row.innerHTML += `<td data-coluna="data-validade">${produto.data_validade || ''}</td>`;
              if (colunaVisivel('termino-garantia')) row.innerHTML += `<td data-coluna="termino-garantia">${produto.termino_garantia || ''}</td>`;
              if (colunaVisivel('outras-informacoes')) row.innerHTML += `<td data-coluna="outras-informacoes">${produto.outras_informacoes || ''}</td>`;
              tabelaProdutos.appendChild(row);
            });
            // Exibe a tabela de produtos
            document.getElementById('produtos-tabela-bloco').style.display = '';
            // Aplica qualquer filtro que esteja nos campos
            filtrarTabelaProdutos();
          } else {
            alert('Erro ao buscar produtos: ' + data.mensagem);
          }
        } catch (error) {
          console.error('Erro ao conectar ao servidor:', error);
          alert('Erro ao buscar produtos. Verifique o console para mais detalhes.');
        }
      } else {
        // Lógica para outros tipos de busca (exemplo: mostrar mensagem)
        document.getElementById('produtos-tabela-bloco').style.display = 'none';
        document.getElementById('resultado-busca').innerHTML = `<div style="margin-top:20px;color:#888;">Busca para o contexto <b>${tipoBusca}</b> ainda não implementada.</div>`;
      }
    });
  }
//======================================================================================================
// FUNÇÃO PRINCIPAL: Edição de Produto
// Esta função trata o evento de duplo clique na tabela de produtos, abrindo o modal de edição
// e preenchendo os dados do produto selecionado para edição ou exclusão.
//======================================================================================================
          
const tabelaProdutos = document.getElementById('Lista-dos-produtos');

tabelaProdutos.addEventListener('click', function(event) {
  if (event.target.closest('button, a, input')) return;
  const row = event.target.closest('tr');
  
  // Verifica se é uma linha do tbody (não do thead)
  if (row && row.parentElement.tagName === 'TBODY') {
    const cells = row.querySelectorAll('td');

    if (cells.length > 0) {
      const dadosProduto = {
        id: cells[0]?.textContent || '',
        nome: cells[1]?.textContent || '',
        codigo: cells[2]?.textContent || ''
      };

      // Ficha do produto (todas as colunas); Editar e Excluir ficam nela.
      abrirFichaProduto(dadosProduto, row, cells);
    }
  }
});

//======================================================================================================
// FUNÇÃO AUXILIAR: Criar Modal de Escolha de Ação
// Cria e exibe um modal com as opções de Editar e Excluir para o produto selecionado.
//======================================================================================================
function abrirFichaProduto(dados, row, cells) {
  const F = window.FichaRegistro;
  const tabela = row.closest('table');
  const cab = Array.from(tabela.tHead ? tabela.tHead.rows[0].cells : []);
  const campos = Array.from(cells)
    .map((td, i) => { const th = (td.dataset.coluna && cab.find((h) => h.dataset.coluna === td.dataset.coluna)) || cab[i]; return [th ? th.textContent.trim() : '', td.style.display === 'none' ? '' : td.innerHTML.trim(), { html: true }]; })
    .filter((c) => c[0] && c[1] && c[1] !== '-');
  F.abrir({
    titulo: (dados.nome || 'Produto').trim(),
    subtitulo: 'Produto ' + String(dados.id).trim(),
    campos: campos,
    editar: () => editarProdutoComBusca(dados.id),
    podeEditar: F.pode('estoque_produtos', 'editar'),
    rotuloEditar: 'Editar produto',
    excluir: async () => { F.fechar(); await excluirProduto(row, cells); },
    podeExcluir: F.pode('estoque_produtos', 'excluir'),
    confirmar: false,
  });
}

function criarModalEscolhaAcao(dados, row, cells) {
  // Remove modal existente se houver
  const modalExistente = document.getElementById('modal-escolha-acao');
  if (modalExistente) {
    modalExistente.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'modal-escolha-acao';
  modal.className = 'acao-modal-fundo';

  const esc = (v) => String(v ?? '').trim().replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const codigo = esc(dados.codigo) || '<span class="acao-modal-vazio">sem código</span>';

  modal.innerHTML = `
    <div class="acao-modal" role="dialog" aria-modal="true" aria-labelledby="acao-modal-titulo">
      <header class="acao-modal-topo">
        <span class="acao-modal-rotulo">Produto #${esc(dados.id)}</span>
        <h3 id="acao-modal-titulo" class="acao-modal-titulo">${esc(dados.nome)}</h3>
      </header>

      <dl class="acao-modal-dados">
        <div><dt>ID</dt><dd>${esc(dados.id)}</dd></div>
        <div><dt>Código</dt><dd>${codigo}</dd></div>
      </dl>

      <footer class="acao-modal-acoes">
        <button type="button" id="btn-excluir-produto" class="acao-btn acao-btn-perigo">Excluir</button>
        <span class="acao-modal-espaco"></span>
        <button type="button" id="btn-cancelar-acao" class="acao-btn acao-btn-neutro">Cancelar</button>
        <button type="button" id="btn-editar-produto" class="acao-btn acao-btn-principal">Editar produto</button>
      </footer>
    </div>
  `;

  // Eventos dos botões
  modal.querySelector('#btn-editar-produto').addEventListener('click', function() {
    modal.remove();
    editarProdutoComBusca(dados.id);
  });

  modal.querySelector('#btn-excluir-produto').addEventListener('click', function() {
    modal.remove();
    excluirProduto(row, cells);
  });

  modal.querySelector('#btn-cancelar-acao').addEventListener('click', function() {
    modal.remove();
  });

  // Fecha o modal ao clicar fora dele
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Fecha o modal com a tecla ESC
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.getElementById('modal-escolha-acao')) {
      modal.remove();
    }
  });

  document.body.appendChild(modal);
  modal.querySelector('#btn-editar-produto').focus();
}

//======================================================================================================
// FUNÇÃO PRINCIPAL: Edição de Produto (com busca no backend)
// Busca os dados reais do produto no backend e preenche o formulário de edição.
//======================================================================================================
async function editarProdutoComBusca(produtoId) {
  if (!produtoId) {
    alert('ID do produto não encontrado.');
    return;
  }

  try {
    // Mostra loading
    criarModalLoading('Carregando dados do produto...');

    // Busca os dados do produto no backend
    const response = await fetch(apiUrl(`produtos/buscar/${produtoId}`), {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token'),
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    // Remove modal de loading
    removerModalLoading();

    if (response.ok && data.status === 'ok') {
      const produto = data.produto;
      
      // Preenche os campos do formulário com os dados do backend
      preencherFormularioEdicao(produto);
      
      // Muda para a aba de cadastro
      mudarParaAbaCadastro();
      
     // criarModalSucesso(`Produto "${produto.nome_produto}" carregado para edição!`);
      
    } else {
      alert('Erro ao carregar produto: ' + data.mensagem);
    }

  } catch (error) {
    removerModalLoading();
    console.error('Erro ao buscar produto:', error);
    alert('Erro ao conectar com o servidor. Verifique sua conexão.');
  }
}

//======================================================================================================
// FUNÇÃO PRINCIPAL: Preenchimento do Formulário de Edição
// Preenche o formulário de edição de produto com os dados fornecidos.
//======================================================================================================
function preencherFormularioEdicao(produto) {
  try {
    // Limpa o formulário de cadastro antes de preencher
    const form = document.getElementById('form-cadastro-produto');
    if (form) {
      form.reset();
    }

    // Preenche os campos com os dados do backend
    const campos = [
      { id: 'nome-produto', valor: produto.nome_produto },
      { id: 'codigo', valor: produto.codigo },
      { id: 'marca-cadastro', valor: produto.marca },
      { id: 'categoria', valor: produto.categoria },
      { id: 'quantidade', valor: produto.quantidade },
      { id: 'numero-serie', valor: produto.numero_serie },
      { id: 'unid-medida', valor: produto.unidade_medida },
      { id: 'estoque-minimo', valor: produto.estoque_minimo },
      { id: 'numero-nota', valor: produto.numero_nota },
      { id: 'fornecedor', valor: produto.fornecedor },
      { id: 'patrimonio-cadastro', valor: produto.patrimonio },
      { id: 'local-estoque-cadastro', valor: produto.local },
      { id: 'custo', valor: produto.custo },
      { id: 'observacoes-cadastro', valor: produto.outras_informacoes }
    ];

    campos.forEach(campo => {
      const elemento = document.getElementById(campo.id);
      if (elemento) {
        const valor = campo.valor != null ? String(campo.valor) : '';
        elemento.value = valor;
      }
    });

// Preencher os campos de data corretamente usando a função formatarDataParaInput
const camposDataEspecificos = [
  { id: 'data-compra', valor: produto.data_compra },
  { id: 'data-validade', valor: produto.data_validade },
  { id: 'garantia', valor: produto.termino_garantia }
];

camposDataEspecificos.forEach(campo => {
  const elemento = document.getElementById(campo.id);
  if (elemento) {
    const dataFormatada = formatarDataParaInput(campo.valor);
    elemento.value = dataFormatada;
  }
const valorOriginalCompra = produto.data_compra;
const valorOriginalValidae = produto.data_validade;
const valorOriginalGarantia= produto.termino_garantia;

const dataObj = new Date(valorOriginalCompra);
if (!isNaN(dataObj.getTime())) {
  const ano = dataObj.getFullYear();
  const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
  const dia = String(dataObj.getDate()+1 ).padStart(2, '0');

  const dataFormatada = `${ano}-${mes}-${dia}`;
  document.getElementById('data-compra').value = dataFormatada;
}

const dataObj2 = new Date(valorOriginalValidae);
if (!isNaN(dataObj2.getTime())) {
  const ano = dataObj2.getFullYear();
  const mes = String(dataObj2.getMonth() + 1).padStart(2, '0');
  const dia = String(dataObj2.getDate()+1 ).padStart(2, '0');

  const dataFormatada = `${ano}-${mes}-${dia}`;
  document.getElementById('data-validade').value = dataFormatada;
}

const dataObj3 = new Date(valorOriginalGarantia);
if (!isNaN(dataObj3.getTime())) {
  const ano = dataObj3.getFullYear();
  const mes = String(dataObj3.getMonth() + 1).padStart(2, '0');
  const dia = String(dataObj3.getDate()+1 ).padStart(2, '0');

  const dataFormatada = `${ano}-${mes}-${dia}`;
  document.getElementById('garantia').value = dataFormatada;
}

});




    // Adiciona um campo oculto com o ID para identificar que é uma edição
    let idField = document.getElementById('produto-id-edicao');
    if (!idField) {
      idField = document.createElement('input');
      idField.type = 'hidden';
      idField.id = 'produto-id-edicao';
      idField.name = 'produto-id-edicao';
      if (form) {
        form.appendChild(idField);
      }
    }
    idField.value = produto.id || '';
    const campoOutrosNomes = document.getElementById('outros-nomes-produto');
    if (campoOutrosNomes) campoOutrosNomes.value = (produto.outros_nomes || []).join(', ');

    // Muda o texto do botão para indicar que é uma edição
    const btnSalvar = document.getElementById('btn-novoProduto');
    if (btnSalvar) {
      btnSalvar.textContent = 'Atualizar Produto';
      btnSalvar.style.backgroundColor = '#28a745';
      btnSalvar.style.color = 'white';
    }

    // Resumo final
    setTimeout(() => {
      
      camposDataEspecificos.forEach(campo => {
        const elemento = document.getElementById(campo.id);
        const valorFinal = elemento ? elemento.value : 'ELEMENTO NÃO ENCONTRADO';
        console.log(`${campo.nome}: "${valorFinal}"`);
      });
     
    }, 100);

    console.log('✅ Formulário preenchido com sucesso!');

  } catch (error) {
    console.error('Erro ao preencher o formulário de edição:', error);
    alert('Não foi possível carregar os dados do produto no formulário.');
  }
}




//======================================================================================================
// FUNÇÃO PRINCIPAL: Mudança para Aba de Cadastro
// Alterna a interface para a aba de cadastro de produtos.
//======================================================================================================
function mudarParaAbaCadastro() {
  const abaCadastro = document.getElementById('cadastro-produto');
  const botaoCadastro = document.querySelector('.top-tab2[data-tab="cadastro-produto"]');
  
  if (abaCadastro && botaoCadastro) {
    // Remove active de todas as abas
    document.querySelectorAll('.tab-content').forEach(aba => aba.classList.remove('active'));
    document.querySelectorAll('.top-tab2').forEach(btn => btn.classList.remove('active'));
    
    // Ativa a aba de cadastro
    abaCadastro.classList.add('active');
    botaoCadastro.classList.add('active');
  }
}

//======================================================================================================
// FUNÇÃO PRINCIPAL: Criação de Modal de Loading
// Cria e exibe um modal de carregamento com mensagem personalizada.
//======================================================================================================
function criarModalLoading(mensagem) {
  // Mesma animação do logo usada ao abrir uma O.S. (geral.js)
  removerModalLoading();
  if (typeof window.mostrarCarregandoLogo === 'function') {
    window.__fimModalLoading = window.mostrarCarregandoLogo();
  }
}

//======================================================================================================
// FUNÇÃO PRINCIPAL: Remoção de Modal de Loading
// Remove o modal de carregamento da tela.
//======================================================================================================
function removerModalLoading() {
  if (typeof window.__fimModalLoading === 'function') {
    window.__fimModalLoading();
    window.__fimModalLoading = null;
  }
}

//======================================================================================================
// FUNÇÃO AUXILIAR: Formatação de Data para Input
// Converte datas em diferentes formatos para o padrão yyyy-mm-dd aceito por inputs.
//======================================================================================================

// Substitua as linhas 844-849 por esta versão corrigida:
function formatarDataParaInput(data) {

  // Verifica se a data é null, undefined, string vazia ou "N/A"
  if (!data || data === null || data === 'null' || data === 'N/A' || data === 'undefined') {
    return '';
  }

  const dataStr = String(data).trim();

  if (dataStr === '' || dataStr === 'null' || dataStr === 'undefined') {
    return '';
  }

  try {
    // 1. GMT/UTC - CORRIGIDO COM MÉTODOS UTC
    if (dataStr.includes('GMT') || dataStr.includes('UTC')) {

      
      const dataObj = new Date(dataStr);

      
      if (!isNaN(dataObj.getTime())) {
        //  USAR MÉTODOS UTC PARA EVITAR PROBLEMAS DE TIMEZONE
        const ano = dataObj.getUTCFullYear();
        const mes = String(dataObj.getUTCMonth() + 1).padStart(2, '0');
        const dia = String(dataObj.getUTCDate()).padStart(2, '0');
        const resultado = `${ano}-${mes}-${dia}`;
        
        
        return resultado;
      } else {
        console.error('❌ Data GMT inválida');
      }
    }

    // Resto do código permanece igual...
    // 2. datetime.date()
    if (dataStr.includes('datetime.date(')) {
      const match = dataStr.match(/datetime\.date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)/);
      if (match) {
        const [, ano, mes, dia] = match;
        const resultado = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        return resultado;
      }
    }

    // 3. yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
      return dataStr;
    }

    // 4. dd/mm/yyyy
    if (dataStr.includes('/')) {
      const partes = dataStr.split('/');
      if (partes.length === 3) {
        const [dia, mes, ano] = partes;
        if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
          const resultado = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
          return resultado;
        }
      }
    }

    // 5. ISO (com T)
    if (dataStr.includes('T')) {
      const dataObj = new Date(dataStr);
      if (!isNaN(dataObj.getTime())) {
        const ano = dataObj.getUTCFullYear();
        const mes = String(dataObj.getUTCMonth() + 1).padStart(2, '0');
        const dia = String(dataObj.getUTCDate()).padStart(2, '0');
        const resultado = `${ano}-${mes}-${dia}`;
        return resultado;
      }
    }

    // 6. Fallback para new Date
    const dataObj = new Date(dataStr);
    if (!isNaN(dataObj.getTime())) {
      const ano = dataObj.getUTCFullYear();
      const mes = String(dataObj.getUTCMonth() + 1).padStart(2, '0');
      const dia = String(dataObj.getUTCDate()).padStart(2, '0');
      const resultado = `${ano}-${mes}-${dia}`;
      return resultado;
    }

  } catch (error) {
    console.error(`❌ Erro ao processar data "${dataStr}":`, error);
  }

  console.warn(`⚠️ Formato de data não reconhecido: "${dataStr}"`);
  return '';
}
//======================================================================================================
// FUNÇÃO PRINCIPAL: Exclusão de Produto
// Esta função trata a exclusão de um produto selecionado na tabela, realizando a confirmação,
// chamada à API e remoção da linha correspondente em caso de sucesso.
//======================================================================================================



//======================================================================================================
// FUNÇÃO PRINCIPAL: Exclusão de Produto
// Esta função trata a exclusão de um produto selecionado na tabela, realizando a confirmação,
// chamada à API e remoção da linha correspondente em caso de sucesso.
//======================================================================================================
async function excluirProduto(row, cells) {
  // Extrai o ID corretamente da primeira célula
  const produtoId = cells[0]?.textContent?.trim();
  const produtoNome = cells[1]?.textContent?.trim();
  
  console.log('🗑️ Dados para exclusão:', {
    id: produtoId,
    nome: produtoNome,
    row: row
  });

  // Valida se o ID foi extraído corretamente
  if (!produtoId || produtoId === '' || isNaN(produtoId)) {
    alert('❌ Erro: ID do produto não encontrado ou inválido.');
    console.error('ID inválido:', produtoId);
    return;
  }
  
  const dadosProduto = {
    id: produtoId,
    nome: produtoNome || 'Nome não encontrado'
  };
  
  // Confirma a exclusão
  const confirmar = confirm(`⚠️ CONFIRMAÇÃO FINAL!\n\nTem certeza que deseja EXCLUIR o produto?\n\nID: ${dadosProduto.id}\nNome: ${dadosProduto.nome}\n\nEsta ação não pode ser desfeita!`);
  
  if (confirmar) {
    try {
      console.log('🔄 Iniciando exclusão do produto ID:', dadosProduto.id);
      criarModalLoading('Excluindo produto...');

      // Fazer requisição para excluir no backend - USANDO APENAS O ID
      const response = await fetch(apiUrl(`produtos/excluir/${dadosProduto.id}`), {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('token'),
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Resposta da API:', response);
      const data = await response.json();
      console.log('📋 Dados da resposta:', data);
      
      removerModalLoading();

      if (response.ok && data.status === 'ok') {
        console.log('✅ Produto excluído com sucesso');
        
        // Remove a linha da tabela
        row.remove();
        
        // Mostra mensagem de sucesso
       // criarModalSucesso(`Produto "${dadosProduto.nome}" foi excluído com sucesso!`);
        
      } else {
        console.error('❌ Erro na exclusão:', data);
        alert('Erro ao excluir produto: ' + (data.mensagem || 'Erro desconhecido'));
      }

    } catch (error) {
      removerModalLoading();
      console.error('❌ Erro de conexão:', error);
      alert('Erro ao conectar com o servidor. Verifique sua conexão.');
    }
  } else {
    console.log('❌ Exclusão cancelada pelo usuário');
  }
}
//==================================================================================================================================
//======================================================================================================
// FUNÇÃO PRINCIPAL: Envio de Retirada para o Banco de Dados
// Envia todos os itens da tabela de retiradas para o backend, realizando as validações necessárias.
//======================================================================================================
async function enviarRetirada() {
  try {
    // Coletar dados básicos da retirada
    const dadosRetirada = {
      data: document.getElementById('retirada-data').value,
      requisitante: document.getElementById('retirada-requisitante').value,
      responsavel: document.getElementById('retirada-responsavel').value,
      local_destino: document.getElementById('retirada-local').value === 'Outro' 
        ? document.getElementById('retirada-outro-local').value 
        : document.getElementById('retirada-local').value,
      finalidade: document.getElementById('retirada-finalidade').value,
      observacoes: document.getElementById('retirada-observacoes').value,
      itens: []
    };

    // Validar campos obrigatórios
    const faltando = [[dadosRetirada.data, 'Data'], [dadosRetirada.requisitante, 'Requisitante'], [dadosRetirada.responsavel, 'Responsável'],
      [dadosRetirada.local_destino, 'Local de destino'], [dadosRetirada.finalidade, 'Finalidade']].filter(([v]) => !v).map(([, nome]) => nome);
    if (faltando.length) {
      alert('Falta preencher: ' + faltando.join(', ') + '.');
      return;
    }

    // Coletar itens da tabela de retirada
    const linhasItens = document.querySelectorAll('#itens-retirada tr');
    
    if (linhasItens.length === 0) {
      alert('Adicione pelo menos um item à retirada.');
      return;
    }

    linhasItens.forEach(linha => {
      const celulas = linha.cells;
      dadosRetirada.itens.push({
        produto: celulas[0].textContent.trim(),
        quantidade: celulas[1].textContent.trim(),
        local_destino: celulas[2].textContent.trim(),
        finalidade: celulas[3].textContent.trim(),
        produto_id: celulas[4].dataset.id || null
      });
    });

    // Enviar para o backend
    criarModalLoading('Enviando retirada...');
    
    const response = await fetch(apiUrl('retiradas/salvar'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify(dadosRetirada)
    });

    const data = await response.json();
    removerModalLoading();

    if (response.ok && data.status === 'ok') {
      alert('Retirada registrada com sucesso! ID: ' + data.id_retirada);
      // Limpar formulário após sucesso
      document.getElementById('form-retirada').reset();
      document.getElementById('itens-retirada').innerHTML = '';
      // Gerar novo ID de retirada e preencher o campo
      setTimeout(() => {
        // Gera novo ID manualmente e preenche o campo
        const campoId = document.getElementById('retirada-id');
        if (campoId && typeof gerarIdRetirada8Digitos === 'function') {
          const novoId = gerarIdRetirada8Digitos();
          campoId.value = novoId;
          // Atualiza variável global se necessário
          if (typeof idRetiradaGerado !== 'undefined') {
            idRetiradaGerado = novoId;
          }
        }
      }, 100);
      atualizarPreviewCupom();
    } else {
      alert('Erro ao registrar retirada: ' + (data.mensagem || 'Erro desconhecido'));
    }

  } catch (error) {
    removerModalLoading();
    console.error('Erro ao enviar retirada:', error);
    alert('Erro ao conectar com o servidor. Verifique sua conexão.');
  }
}


//==================================================================================================================================

  // Função para alternar entre abas
  function alternarAba(event) {
    const todasAbas = document.querySelectorAll('.tab-content');
    const todosBotoes = document.querySelectorAll('.top-tab2');

    // Remove a classe 'active' de todas as abas e botões
    todasAbas.forEach(aba => aba.classList.remove('active'));
    todosBotoes.forEach(botao => botao.classList.remove('active'));

    // Identifica a aba correspondente ao botão clicado
    const abaId = event.target.getAttribute('data-tab');
    const abaSelecionada = document.getElementById(abaId);

    // Adiciona a classe 'active' à aba e ao botão selecionados
    if (abaSelecionada) {
      abaSelecionada.classList.add('active');
    }
    event.target.classList.add('active');
  }

  // Função para inicializar a aba ativa
  function inicializarAbaAtiva() {
    // Remove qualquer aba ou botão marcado como ativo
    const abasAtivas = document.querySelectorAll('.tab-content.active');
    const botoesAtivos = document.querySelectorAll('.top-tab2.active');

    abasAtivas.forEach(aba => aba.classList.remove('active'));
    botoesAtivos.forEach(botao => botao.classList.remove('active'));

    // Ativa a aba "Gerenciamento" por padrão
    const abaGerenciamento = document.getElementById('gerenciamento');
    const botaoGerenciamento = document.querySelector('.tab-btn[data-tab="gerenciamento"]');

    if (abaGerenciamento) {
      abaGerenciamento.classList.add('active');
    }
    if (botaoGerenciamento) {
      botaoGerenciamento.classList.add('active');
    }
  }

  // Adiciona o evento de clique a todos os botões de troca de aba
  document.querySelectorAll('.top-tab2').forEach(button => {
    button.addEventListener('click', alternarAba);
  });

  // Inicializa a aba ativa ao carregar a página
  document.addEventListener('DOMContentLoaded', function () {
    inicializarAbaAtiva();
  });

  // Garante que o botão "Requisitantes" seja selecionado ao abrir a aba "Requisitantes"
  const abaRequisitantes = document.getElementById('requisitantes');
  if (abaRequisitantes) {
    abaRequisitantes.addEventListener('click', function () {
      const botaoRequisitantes = document.querySelector('.top-tab2[data-tab="requisitantes"]');
      if (botaoRequisitantes) {
        botaoRequisitantes.classList.add('active');
      }
    });
  }

  const todasAbas = document.querySelectorAll('.tab-content'); 
  const todosBotoes = document.querySelectorAll('.top-tab2'); 


 
  todosBotoes.forEach(botao => botao.classList.remove('active'));

   // ------------ evento abertura aba Entrada ------------
  const botaoEntrada1 = document.getElementById('btn-entrada1'); 
  const botaoEntrada2 = document.getElementById('btn-entrada2'); 
  const botaoEntrada3 = document.getElementById('btn-entrada3'); 
  const botaoEntrada4 = document.getElementById('btn-entrada4'); 
  const botaoEntrada5 = document.getElementById('btn-entrada5'); 
  const abaMovimentacoes = document.getElementById('movimentacoes'); 
  
  if (botaoEntrada1 || botaoEntrada2 || botaoEntrada3|| botaoEntrada4|| botaoEntrada5) {
    botaoEntrada1.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaMovimentacoes.classList.add('active');
    });
    botaoEntrada2.addEventListener('click', function () { 
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaMovimentacoes.classList.add('active');
    });
    botaoEntrada3.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaMovimentacoes.classList.add('active');
    });
        botaoEntrada4.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaMovimentacoes.classList.add('active');
    });
        botaoEntrada5.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaMovimentacoes.classList.add('active');
    });
  }

   // ------------ evento abertura aba tranferencia ------------
  const botaoTransferencia1 = document.getElementById('btn-transferencia1'); 
  const botaoTransferencia2 = document.getElementById('btn-transferencia2'); 
  const botaoTransferencia3 = document.getElementById('btn-transferencia3'); 
  const botaoTransferencia4 = document.getElementById('btn-transferencia4'); 
  const botaoTransferencia5 = document.getElementById('btn-transferencia5');
  const abaTransferencia = document.getElementById('transferencia'); 

  if (botaoTransferencia1||botaoTransferencia2||botaoTransferencia3||botaoTransferencia4||botaoTransferencia5) {
    botaoTransferencia1.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaTransferencia.classList.add('active');
    });
        botaoTransferencia2.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaTransferencia.classList.add('active');
    });
        botaoTransferencia3.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaTransferencia.classList.add('active');
    });
        botaoTransferencia4.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaTransferencia.classList.add('active');
    });
        botaoTransferencia5.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaTransferencia.classList.add('active');
    });

  }

    // ------------ evento abertura aba Kits ------------
  const abaKits = document.getElementById('consultas-kits');
  const botaoKits1 = document.getElementById('btn-kits1');
  const botaoKits2 = document.getElementById('btn-kits2');
  const botaoKits3 = document.getElementById('btn-kits3');
  const botaoKits4 = document.getElementById('btn-kits4');
  const botaoKits5 = document.getElementById('btn-kits5');
  if (botaoKits1 || botaoKits2 || botaoKits3 || botaoKits4 || botaoKits5) {
    if (botaoKits1) botaoKits1.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      if (abaKits) abaKits.classList.add('active');
    });
    if (botaoKits2) botaoKits2.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      if (abaKits) abaKits.classList.add('active');
    });
    if (botaoKits3) botaoKits3.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      if (abaKits) abaKits.classList.add('active');
    });
    if (botaoKits4) botaoKits4.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      if (abaKits) abaKits.classList.add('active');
    });
    if (botaoKits5) botaoKits5.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      if (abaKits) abaKits.classList.add('active');
    });
  }
   
   // ------------ evento abertura aba baixa ------------
  const abaBaixa = document.getElementById('baixa');
  const botaoBaixa1 = document.getElementById('btn-baixa1');
  const botaoBaixa2 = document.getElementById('btn-baixa2');
  const botaoBaixa3 = document.getElementById('btn-baixa3');
  const botaoBaixa4 = document.getElementById('btn-baixa4');
  const botaoBaixa5 = document.getElementById('btn-baixa5');
  if (botaoBaixa1||botaoBaixa2||botaoBaixa3||botaoBaixa4||botaoBaixa5) {
    botaoBaixa1.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaBaixa.classList.add('active');
      });
 
      botaoBaixa2.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaBaixa.classList.add('active');
    }); 
  
    botaoBaixa3.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaBaixa.classList.add('active');
    });
    botaoBaixa4.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaBaixa.classList.add('active');
    });

    botaoBaixa5.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaBaixa.classList.add('active');
    });

  }


   // ------------ evento abertura aba devolução ------------
  const abaDevolucao = document.getElementById('devolucao');
  const botaoDdevolucao1 = document.getElementById('btn-devolucao1');
  const botaoDdevolucao2 = document.getElementById('btn-devolucao2');
  const botaoDdevolucao3 = document.getElementById('btn-devolucao3');
  const botaoDdevolucao4 = document.getElementById('btn-devolucao4');
  const botaoDdevolucao5 = document.getElementById('btn-devolucao5');
  if (botaoDdevolucao1||botaoDdevolucao2||botaoDdevolucao3||botaoDdevolucao4||botaoDdevolucao5) {
    botaoDdevolucao1.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaDevolucao.classList.add('active');
      });
 
      botaoDdevolucao2.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaDevolucao.classList.add('active');
    }); 
  
    botaoDdevolucao3.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaDevolucao.classList.add('active');
    });
    botaoDdevolucao4.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaDevolucao.classList.add('active');
    });

    botaoDdevolucao5.addEventListener('click', function () {
      todasAbas.forEach(aba => aba.classList.remove('active'));
      abaDevolucao.classList.add('active');
    });

  }


   // ------------ evento abertura aba Retirada ------------
  const abaRetiradas = document.getElementById('retiradas');
  const botaoRetiradas1 = document.getElementById('btn-retirada1');
  const botaoRetiradas2 = document.getElementById('btn-retirada2');
  const botaoRetiradas3 = document.getElementById('btn-retirada3');
  const botaoRetiradas4 = document.getElementById('btn-retirada4');
  const botaoRetiradas5 = document.getElementById('btn-retirada5');

  function abrirAbaRetiradaComId() {
    todasAbas.forEach(aba => aba.classList.remove('active'));
    abaRetiradas.classList.add('active');
    // Gera e preenche o campo de ID ao abrir a aba
    if (typeof carregarIdRetiradaAoIniciar === 'function') {
      carregarIdRetiradaAoIniciar();
    }
    // Preenche o campo responsável com o nome do usuário (se disponível)
    const campoResponsavel = document.getElementById('retirada-responsavel');
    let nomeUsuario = '';
    try {
      // Tenta pegar o objeto completo do localStorage
      let usuario = localStorage.getItem('usuario');
      if (usuario) {
        // Se for um JSON válido, extrai o username ou nome
        try {
          const obj = JSON.parse(usuario);
          if (obj && obj.username) {
            nomeUsuario = obj.username;
          } else if (obj && obj.nome) {
            nomeUsuario = obj.nome;
          } else {
            nomeUsuario = usuario;
          }
        } catch (e) {
          // Se não for JSON, usa direto
          nomeUsuario = usuario;
        }
      } else {
        // Fallback para outros campos
        nomeUsuario = localStorage.getItem('usuario_nome') || localStorage.getItem('username') || '';
      }
    } catch (e) {
      nomeUsuario = '';
    }
    if (campoResponsavel && nomeUsuario) {
      campoResponsavel.value = nomeUsuario;
    }
    // Preenche a data com a data/hora atual e permite edição
    const campoData = document.getElementById('retirada-data');
    if (campoData) {
      const agora = new Date();
      const ano = agora.getFullYear();
      const mes = String(agora.getMonth() + 1).padStart(2, '0');
      const dia = String(agora.getDate()).padStart(2, '0');
      const horas = String(agora.getHours()).padStart(2, '0');
      const minutos = String(agora.getMinutes()).padStart(2, '0');
      campoData.value = `${ano}-${mes}-${dia}T${horas}:${minutos}`;
      campoData.readOnly = false;
      campoData.removeAttribute('readonly');
      campoData.removeAttribute('disabled');
    }
  }

  if (botaoRetiradas1) botaoRetiradas1.addEventListener('click', abrirAbaRetiradaComId);
  if (botaoRetiradas2) botaoRetiradas2.addEventListener('click', abrirAbaRetiradaComId);
  if (botaoRetiradas3) botaoRetiradas3.addEventListener('click', abrirAbaRetiradaComId);
  if (botaoRetiradas4) botaoRetiradas4.addEventListener('click', abrirAbaRetiradaComId);
  if (botaoRetiradas5) botaoRetiradas5.addEventListener('click', abrirAbaRetiradaComId);


   
  // Evento para carregar a nota de cadastro
  const btnCarregarNota = document.getElementById('btn-carregar-nota-cadastro');
  const inputCarregarNota = document.getElementById('input-carregar-nota-cadastro');

  if (btnCarregarNota && inputCarregarNota) {
    // Evento para abrir o seletor de arquivos
    btnCarregarNota.addEventListener('click', function () {
      inputCarregarNota.click(); // Simula o clique no campo de entrada de arquivo
    });

    // Evento para processar o arquivo XML selecionado
    inputCarregarNota.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) {
        alert('Nenhum arquivo selecionado.');
        return;
      }

      // Verifica se o arquivo é um XML
      if (!file.name.endsWith('.xml')) {
        alert('Por favor, selecione um arquivo XML válido.');
        return;
      }

      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const xmlText = e.target.result;
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, "application/xml");

          // Verifica se houve erro no parsing do XML
          if (xmlDoc.querySelector('parsererror')) {
            alert('Erro ao processar o arquivo XML. Verifique o formato do arquivo.');
            return;
          }

          const tabelaBody = document.querySelector("#tabelaProdutos tbody");

          // Limpa o conteúdo anterior da tabela
          tabelaBody.innerHTML = "";

          // Detecta o tipo de nota com base na estrutura do XML
          if (xmlDoc.querySelector("NFe")) {
            processarNFe(xmlDoc, tabelaBody);
          } else if (xmlDoc.querySelector("InfNfse")) {
            processarNFSe(xmlDoc, tabelaBody);
          } else {
            alert("Tipo de nota não reconhecido.");
          }
        } catch (error) {
          console.error('Erro ao processar o arquivo:', error);
          alert('Ocorreu um erro ao processar o arquivo. Verifique o console para mais detalhes.');
        }
      };

      reader.readAsText(file);
    });
  } else {
    console.error('Erro: Elementos de botão ou input para carregar nota não encontrados no DOM.');
  }

  // Função para processar NF-e
  function processarNFe(xmlDoc, tabelaBody) {
    const dets = xmlDoc.querySelectorAll("det");
    const dataEmissaoRaw = xmlDoc.querySelector("ide > dhEmi")?.textContent || "N/A";
    const numeroNota = xmlDoc.querySelector("ide > nNF")?.textContent || "N/A";
    const fornecedor = xmlDoc.querySelector("emit > xNome")?.textContent || "N/A";

    const dataEmissao = formatarData(dataEmissaoRaw);

    dets.forEach((det, index) => {
      const prod = det.querySelector("prod");
      const nomeProd = prod?.querySelector("xProd")?.textContent || "N/A";
      let codigo = prod?.querySelector("cProd")?.textContent || "N/A"; 

      // Remove os zeros à esquerda do código
      codigo = codigo.replace(/^0+/, ''); 

      const marca = prod?.querySelector("xMarca")?.textContent || "N/A";
      const unidadeMedida = prod?.querySelector("uCom")?.textContent || "N/A";
      const quantidadeRaw = prod?.querySelector("qCom")?.textContent || "N/A";
      const custoUnitarioRaw = prod?.querySelector("vUnCom")?.textContent || "N/A";

      // Formata os valores
      const quantidade = formatarQuantidade(quantidadeRaw);
      const custoUnitario = formatarValor(custoUnitarioRaw);

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${nomeProd}</td>
        <td>${codigo}</td>
        <td>${marca}</td>
        <td>${unidadeMedida}</td>
        <td>${quantidade}</td>
        <td>${custoUnitario}</td>
        <td>${dataEmissao}</td>
        <td>${numeroNota}</td>
        <td>${fornecedor}</td>
        <td>
          <button class="btn-editar" data-index="${index}">⮵</button>
        </td>
      `;
      tabelaBody.appendChild(row);
    });
  }

  // Função para processar NFS-e
  function processarNFSe(xmlDoc, tabelaBody) {
    const numeroNota = xmlDoc.querySelector("InfNfse > Numero")?.textContent || "N/A";
    const dataEmissaoRaw = xmlDoc.querySelector("InfNfse > DataEmissao")?.textContent || "N/A";
    const fornecedor = xmlDoc.querySelector("PrestadorServico > RazaoSocial")?.textContent || "N/A";

    const dataEmissao = formatarData(dataEmissaoRaw);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>1</td>
      <td>Serviço</td>
      <td>N/A</td>
      <td>N/A</td>
      <td>N/A</td>
      <td>N/A</td>
      <td>N/A</td>
      <td>${dataEmissao}</td>
      <td>${numeroNota}</td>
      <td>${fornecedor}</td>
      <td>
        <button class="btn-editar" data-index="0">Editar</button>
      </td>
    `;
    tabelaBody.appendChild(row);
  }

  // Função para formatar valores monetários (R$)
  function formatarValor(valor) {
    if (valor === "N/A") return "N/A";
    const numero = parseFloat(valor);
    if (isNaN(numero)) return "N/A";
    return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  // Função para formatar quantidade
  function formatarQuantidade(quantidade) {
    if (quantidade === "N/A") return "N/A";
    const numero = parseFloat(quantidade);
    if (isNaN(numero)) return "N/A";
    return numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Função para formatar a data no formato dd/mm/yyyy
  function formatarData(dataISO) {
    if (dataISO === "N/A") return "N/A";
    const data = new Date(dataISO);
    if (isNaN(data)) return "N/A"; // Verifica se a data é inválida
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0'); // Mês começa em 0
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }
// Evento para editar produtos na tabela (botão editar)
document.querySelector("#tabelaProdutos").addEventListener("click", function (event) {
  if (event.target.classList.contains("btn-editar")) {
    const row = event.target.closest("tr");
    const ths = Array.from(document.querySelectorAll("#tabelaProdutos thead th"));
    const getColIndex = (label) => ths.findIndex(th => th.textContent.trim().toLowerCase().includes(label));
    const idxNome = getColIndex("nome");
    // const idxCodigo = getColIndex("código");
    const nomeProduto = idxNome >= 0 ? row.cells[idxNome].textContent.trim() : "";
    if (nomeProduto && nomeProduto !== "N/A") document.getElementById("nome-produto").value = nomeProduto;
    document.getElementById("codigo").value = "";

  }
});

// Evento para seleção simples de produto na tabela (clique simples)
document.querySelector("#Lista-dos-produtos").addEventListener("click", function (event) {
  const row = event.target.closest("tr");
  if (!row || row.parentElement.tagName !== 'TBODY') return;

});

  // Função para converter a data no formato dd/MM/yyyy para yyyy-MM-dd
  function formatarDataParaInput(data) {
    const [dia, mes, ano] = data.split("/");
    return `${ano}-${mes}-${dia}`;
  }

 // Substitua o evento do botão (linhas 1185-1230) por esta versão:
document.getElementById("btn-novoProduto").addEventListener("click", async function (event) {
  event.preventDefault();

  // Verifica se é uma edição (campo oculto com ID existe)
  const produtoIdEdicao = document.getElementById('produto-id-edicao')?.value;
  const ehEdicao = produtoIdEdicao && produtoIdEdicao.trim() !== '';

  console.log('🔍 Modo detectado:', ehEdicao ? 'EDIÇÃO' : 'CRIAÇÃO');
  if (ehEdicao) {
    console.log('📝 ID do produto para editar:', produtoIdEdicao);
  }

  // Captura os valores dos campos
  const nomeProduto = document.getElementById("nome-produto").value;
  const codigo = document.getElementById("codigo").value;
  const categoria = document.getElementById("categoria").value;
  const quantidade = document.getElementById("quantidade").value;
  const numeroSerie = document.getElementById("numero-serie").value;
  const unidadeMedida = document.getElementById("unid-medida").value;
  const estoqueMinimo = document.getElementById("estoque-minimo").value;
  const numeroNota = document.getElementById("numero-nota").value;
  const fornecedor = document.getElementById("fornecedor").value;
  const patrimonio = document.getElementById("patrimonio-cadastro").value;
  const local_estoque = document.getElementById("local-estoque-cadastro").value;
  const marca = document.getElementById("marca-cadastro").value;
   
  let custo = document.getElementById("custo").value.trim();
  custo = custo.replace(/[R$\s]/g, "").replace(".", "").replace(",", ".");

  const dataCompra = document.getElementById("data-compra").value;
  const dataValidade = document.getElementById("data-validade").value;
  const terminoGarantia = document.getElementById("garantia").value;
  const outras_informacoes = document.getElementById("observacoes-cadastro").value;

  // Monta o objeto com os dados
  const produto = {
    nome_produto: nomeProduto,
    codigo: codigo,
    marca: marca,
    categoria: categoria,
    quantidade: quantidade,
    numero_serie: numeroSerie,
    unid_medida: unidadeMedida,
    estoque_minimo: estoqueMinimo,
    numero_nota: numeroNota,
    fornecedor: fornecedor,
    patrimonio: patrimonio,
    local_estoque: local_estoque,
    custo: custo,
    data_compra: dataCompra,
    data_validade: dataValidade,
    garantia: terminoGarantia,
    outras_informacoes: outras_informacoes,
    outros_nomes: document.getElementById('outros-nomes-produto')?.value || '',
  };

  try {
    let response;
    let mensagemSucesso;

    if (ehEdicao) {
      // ===== MODO EDIÇÃO =====
      console.log('🔄 Enviando atualização do produto...');
      
      // Adiciona o ID do produto ao objeto
      produto.id = produtoIdEdicao;
      
      response = await fetch(apiUrl(`/produtos/atualizar/${produtoIdEdicao}`), {
        method: "PUT", // ✅ PUT para atualizar
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify(produto),
      });
      
      mensagemSucesso = "Produto atualizado com sucesso!";
      
    } else {
      // ===== MODO CRIAÇÃO =====
      console.log('🔄 Enviando criação de novo produto...');
      
      response = await fetch(apiUrl("/produtos/salvar"), {
        method: "POST", // ✅ POST para criar
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify(produto),
      });
      
      mensagemSucesso = "Produto salvo com sucesso!";
    }

    const data = await response.json();

    if (response.ok && data.status === "ok") {
      if (Array.isArray(data.outros_nomes_conflito) && data.outros_nomes_conflito.length) {
        mensagemSucesso += '\n\nEstes nomes não foram salvos porque já pertencem a outro item: ' + data.outros_nomes_conflito.join(', ');
      }
      alert(mensagemSucesso);
      
      // Limpa os campos do formulário
      document.getElementById("form-cadastro-produto").reset();
      
      // Remove o campo de edição e restaura o botão
      const campoEdicao = document.getElementById('produto-id-edicao');
      if (campoEdicao) {
        campoEdicao.remove();
      }
      
      // Restaura o botão para o estado original
      const btnSalvar = document.getElementById('btn-novoProduto');
      if (btnSalvar) {
        btnSalvar.textContent = 'Salvar Produto';
        btnSalvar.style.backgroundColor = '';
        btnSalvar.style.color = '';
      }
      
      console.log('✅ Operação concluída com sucesso!');
      
    } else {
      alert(`Erro ao ${ehEdicao ? 'atualizar' : 'salvar'} produto: ` + data.mensagem);
    }
    
  } catch (error) {
    console.error("Erro ao conectar ao servidor:", error);
    alert(`Erro ao ${ehEdicao ? 'atualizar' : 'salvar'} produto. Verifique o console para mais detalhes.`);
  }
});

  const previewImg = document.getElementById('preview');
  const inputImagem = document.getElementById('input-carregar-img-cadastro'); // ID corrigido

  if (previewImg && inputImagem) {
    // Evento de clique na imagem para abrir o seletor de arquivos
    previewImg.addEventListener('click', function () {
      inputImagem.click(); // Simula o clique no input de arquivo
    });

    // Evento para exibir a imagem selecionada
    inputImagem.addEventListener('change', function (event) {
      const file = event.target.files[0]; 
      if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          previewImg.src = e.target.result; 
        };
        reader.readAsDataURL(file); 
      }
    });
  } else {
    console.error('Erro: Elementos de imagem ou input não encontrados no DOM.');
  }

  // Referências às abas e botões
const todasAbasMovimentacoes = document.querySelectorAll('.tab-content');

const botaoDevolucao1 = document.getElementById('btn-devolucao1');
const botaoRetirada1 = document.getElementById('btn-retirada1');
//const conteudoMovimentacoes = document.getElementById('conteudo-movimentacoes');


// Referências específicas para a aba "Entrada de Produtos"
const previewImgEntrada = document.querySelector('#entrada-produtos #preview'); // ID específico para a aba
const inputImagemEntrada = document.querySelector('#entrada-produtos #input-carregar-nota-cadastro'); // ID específico para a aba

if (previewImgEntrada && inputImagemEntrada) {
  // Evento de clique na imagem para abrir o seletor de arquivos
  previewImgEntrada.addEventListener('click', function () {
    inputImagemEntrada.click(); 
  });

  // Evento para exibir a imagem selecionada
  inputImagemEntrada.addEventListener('change', function (event) {
    const file = event.target.files[0]; 
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        previewImgEntrada.src = e.target.result; 
      };
      reader.readAsDataURL(file); 
    }
  });
}

// Novos códigos para a funcionalidade de parâmetros
// Parâmetros (Cadastros): SCRIPT/parametros-estoque.js grava no banco e atualiza as listas.

  // ===== GERADOR DE CHECKBOXES PARA COLUNAS DE PRODUTOS =====
  const colunasProdutos = [
    { id: 'id', label: 'ID' },
    { id: 'nome-produto', label: 'Nome do Produto' },
    { id: 'codigo', label: 'Código' },
    { id: 'marca', label: 'Marca' },
    { id: 'categoria', label: 'Categoria' },
    { id: 'unidade-medida', label: 'Unidade de Medida' },
    { id: 'numero-serie', label: 'Número de Série' },
    { id: 'patrimonio', label: 'Patrimônio' },
    { id: 'local', label: 'Local' },
    { id: 'estoque', label: 'Estoque' },
    { id: 'quantidade', label: 'Quantidade' },
    { id: 'estoque-minimo', label: 'Estoque Mínimo' },
    { id: 'custo', label: 'Custo' },
    { id: 'data-compra', label: 'Data de Compra' },
    { id: 'numero-nota', label: 'Número da Nota' },
    { id: 'fornecedor', label: 'Fornecedor' },
    { id: 'data-validade', label: 'Data de Validade' },
    { id: 'termino-garantia', label: 'Término da Garantia' },
    { id: 'outras-informacoes', label: 'Outras Informações' },
    { id: 'imagem', label: 'Imagem' }
  ];

  // Função para montar os checkboxes de colunas de produtos
  function montarColunasSelector() {
    const container = document.getElementById('colunas-visiveis-busca');
    if (!container) return;
    container.innerHTML = '';
    colunasProdutos.forEach(col => {
      const label = document.createElement('label');
      label.style.marginRight = '12px';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = col.id;
      checkbox.checked = true; // Marca todas como visíveis por padrão
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' ' + col.label));
      container.appendChild(label);
    });
  }

  // Função utilitária para obter o grupo correto de checkboxes conforme a aba ativa
  function getGrupoColunasAtivo() {
    // Verifica se a aba Busca está ativa
    const buscaAba = document.getElementById('busca');
    const produtosAba = document.getElementById('consultas-produtos');
    if (buscaAba && buscaAba.classList.contains('active')) {
      return {
        toggleBtn: document.querySelector('#busca #toggle-colunas'),
        colunasDiv: document.getElementById('colunas-visiveis-busca'),
        checkboxes: document.querySelectorAll('#colunas-visiveis-busca input[type="checkbox"]')
      };
    } else if (produtosAba && produtosAba.classList.contains('active')) {
      return {
        toggleBtn: document.querySelector('#consultas-produtos #toggle-colunas'),
        colunasDiv: document.getElementById('colunas-visiveis-produtos'),
        checkboxes: document.querySelectorAll('#colunas-visiveis-produtos input[type="checkbox"]')
      };
    }
    // fallback: retorna nulls
    return { toggleBtn: null, colunasDiv: null, checkboxes: [] };
  }

  // Inicialização dinâmica conforme a aba ativa
  function inicializarColunasVisiveis() {
    const grupo = getGrupoColunasAtivo();
    if (!grupo.toggleBtn || !grupo.colunasDiv) return;
    
    // Remove o painel ao iniciar
    grupo.colunasDiv.parentElement.classList.remove('ativo');
    grupo.toggleBtn.classList.remove('ativo');

    grupo.toggleBtn.addEventListener("click", function (e) {
      e.preventDefault();
      const container = grupo.colunasDiv.parentElement;
      
      // Toggle da classe 'ativo'
      if (container.classList.contains('ativo')) {
        container.classList.remove('ativo');
        grupo.toggleBtn.classList.remove('ativo');
      } else {
        container.classList.add('ativo');
        grupo.toggleBtn.classList.add('ativo');
      }
    });
  }

  // Chama ao carregar a página e ao trocar de aba
  montarColunasSelector(); // Cria os checkboxes de colunas de produtos
  inicializarColunasVisiveis();
  // Se você já tem um listener de troca de abas, chame inicializarColunasVisiveis() dentro dele também

  // (Removido: código antigo que causava erro ao acessar colunasVisiveisDiv/toggleColunasBtn)

  // Atualizar visibilidade das colunas
  function atualizarColunas() {
    const tabela = document.getElementById('Lista-dos-produtos');
    const thead = tabela ? tabela.querySelector('thead') : null;
    const tbody = tabela ? tabela.querySelector('tbody') : null;
    const grupo = getGrupoColunasAtivo();
    const checkboxes = grupo.checkboxes;
    if (!tabela || !thead || !tbody) return;

    // Sempre exibe as colunas conforme a checagem dos checkboxes, independente do contexto
    if (!checkboxes.length) return;
    // Mapeia quais colunas devem estar visíveis (case-insensitive e trim)
    const colunasVisiveis = {};
    checkboxes.forEach(checkbox => {
      const valor = (checkbox.value || '').trim().toLowerCase();
      colunasVisiveis[valor] = checkbox.checked;
    });

    // Atualiza visibilidade dos <th> e <td> de cada coluna
    let algumaColunaVisivel = false;
    // Garante que todos os <th> de qualquer <tr> do thead sejam alterados corretamente
    const ths = thead.querySelectorAll('th[data-coluna]');
    ths.forEach((th, idx) => {
      const coluna = (th.getAttribute('data-coluna') || '').trim().toLowerCase();
      const visivel = !!colunasVisiveis[coluna];
      th.style.display = visivel ? '' : 'none';
      if (visivel) algumaColunaVisivel = true;
      // Todas as células dessa coluna
      Array.from(tbody.rows).forEach(row => {
        const td = row.cells[idx];
        if (td) td.style.display = visivel ? '' : 'none';
      });
    });

    // Exibe ou oculta o thead e tbody (estrutura da tabela) junto com as colunas
    thead.style.display = algumaColunaVisivel ? '' : 'none';
    tbody.style.display = algumaColunaVisivel ? '' : 'none';
    tabela.style.display = algumaColunaVisivel ? '' : 'none';

    // Exibe ou oculta a aba da tabela se existir
    const abaTabela = document.getElementById('aba-tabela-produtos') || document.querySelector('.tab-content.tabela-produtos');
    if (abaTabela) abaTabela.style.display = algumaColunaVisivel ? '' : 'none';
  }

  // ===== FUNÇÕES PARA SALVAR/CARREGAR PREFERÊNCIAS DE COLUNAS NO LOCALSTORAGE =====
  
  // Salva quais colunas devem ser exibidas no localStorage
  function salvarPreferenciaColunas() {
    const grupo = getGrupoColunasAtivo();
    const colunasSelecionadas = {};
    grupo.checkboxes.forEach(checkbox => {
      colunasSelecionadas[checkbox.value] = checkbox.checked;
    });
    const abaBuscaAtiva = document.getElementById('busca')?.classList.contains('active');
    const chaveArmazenamento = abaBuscaAtiva ? 'coluna-visiveis-busca' : 'coluna-visiveis-produtos';
    localStorage.setItem(chaveArmazenamento, JSON.stringify(colunasSelecionadas));
  }

  // Carrega as preferências de colunas do localStorage
  function carregarPreferenciaColunas() {
    const grupo = getGrupoColunasAtivo();
    const abaBuscaAtiva = document.getElementById('busca')?.classList.contains('active');
    const chaveArmazenamento = abaBuscaAtiva ? 'coluna-visiveis-busca' : 'coluna-visiveis-produtos';
    const preferencias = localStorage.getItem(chaveArmazenamento);
    
    if (preferencias) {
      const colunasSelecionadas = JSON.parse(preferencias);
      grupo.checkboxes.forEach(checkbox => {
        // Se existe preferência, usa ela; se não, mantém o padrão do checkbox
        if (colunasSelecionadas.hasOwnProperty(checkbox.value)) {
          checkbox.checked = colunasSelecionadas[checkbox.value];
        }
      });
    }
  }

  // Função para adicionar listeners aos checkboxes do grupo ativo
  function adicionarListenersCheckboxes() {
    const grupo = getGrupoColunasAtivo();
    const tabela = document.getElementById('Lista-dos-produtos');
    grupo.checkboxes.forEach(checkbox => {
      checkbox.addEventListener("change", function() {
        salvarPreferenciaColunas(); // Salva ao mudar qualquer checkbox
        atualizarColunas();
        if (tabela && tabela.style.display === "none") {
          const abaTabela = document.getElementById('aba-tabela-produtos') || document.querySelector('.tab-content.tabela-produtos');
          if (abaTabela) abaTabela.style.display = 'none';
        } else {
          const abaTabela = document.getElementById('aba-tabela-produtos') || document.querySelector('.tab-content.tabela-produtos');
          if (abaTabela) abaTabela.style.display = '';
        }
      });
    });
  }

  // Adiciona listeners ao carregar a página
  carregarPreferenciaColunas(); // Carrega preferências antes de tudo
  adicionarListenersCheckboxes();

  // Adiciona listeners ao trocar de aba (reexecuta para o grupo correto)
  document.querySelectorAll('.tab-btn, .top-tab, .top-tab2').forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeout(() => {
        carregarPreferenciaColunas(); // Carrega preferências da aba ativa
        inicializarColunasVisiveis();
        adicionarListenersCheckboxes();
        atualizarColunas();
        
        // Carrega todos os produtos se a aba "Busca" for ativada
        if (btn.getAttribute('data-tab') === 'busca') {
          carregarTodosProdutos();
        }
      }, 100);
    });
  });

  // Atualizar colunas ao carregar a página
  atualizarColunas();
  
  // Carrega produtos na aba de busca se ela estiver ativa ao carregar a página
  const abaBuscaAtiva = document.getElementById('busca')?.classList.contains('active');
  if (abaBuscaAtiva) {
    carregarTodosProdutos();
  }

  function adicionarLinhaTabela(dados) {
    const tabelaBody = document.querySelector("#Lista-dos-produtos tbody");
    const novaLinha = document.createElement("tr");

    // Itera sobre os dados e verifica se a coluna correspondente está visível
    Object.keys(dados).forEach(coluna => {
      const th = document.querySelector(`thead th[data-coluna="${coluna}"]`);
      if (th && th.style.display !== "none") {
        const novaCelula = document.createElement("td");
        novaCelula.setAttribute("data-coluna", coluna);
        novaCelula.textContent = dados[coluna];
        novaLinha.appendChild(novaCelula);
      }
    });

    tabelaBody.appendChild(novaLinha);
  }
  //=========================================================  =============================================

  // CONFIGURAÇÃO DOS CAMPOS
  const camposRetirada = [
    'retirada-data',
    'retirada-requisitante', 
    'retirada-responsavel',
    'retirada-local',
    'retirada-finalidade',
    'retirada-observacoes'
  ];

  // REFERÊNCIAS AOS ELEMENTOS
  let btnFinalizarRetirada = null;
  let tabelaItensRetirada = null;
  let btnAcrescentarItemRetirada = null;
  let campoIdRetirada = null;
  let idRetiradaGerado = null;
  let abaRetirada = null;

  // FUNÇÃO PARA ENCONTRAR ELEMENTOS
  function encontrarElementosRetirada() {
    btnFinalizarRetirada = document.getElementById('btn-enviar-retirada');
    btnAcrescentarItemRetirada = document.getElementById('btn-acrescentar-item');
    campoIdRetirada = document.getElementById('retirada-id');
    abaRetirada = document.getElementById('retiradas') || document.querySelector('[id*="retirada"]');
    
    tabelaItensRetirada = document.getElementById('itens-retirada') || 
                         document.querySelector('#tabela-retiradas tbody') ||
                         document.querySelector('.tabela-produtos tbody');

    return !!btnFinalizarRetirada;
  }

  // FUNÇÃO PARA GERAR ID ÚNICO DA RETIRADA (8 DÍGITOS)
  function gerarIdRetirada8Digitos() {
    try {
      const agora = new Date();
      const timestamp = agora.getTime().toString(36).slice(-4);
      const random = Math.random().toString(36).substr(2, 4);
      return `${timestamp}${random}`.substr(0, 8).toUpperCase();
    } catch (error) {
      console.error('Erro ao gerar ID:', error);
      return `RET${Date.now().toString().slice(-8)}`;
    }
  }

  // FUNÇÃO PARA OBTER DATA ATUAL
  function obterDataAtualRetirada() {
    return new Date().toISOString().slice(0, 16);
  }

  // FUNÇÃO PARA PREENCHER APENAS A DATA
  function preencherDataRetirada() {
    try {
      const campoData = document.getElementById('retirada-data');
      if (campoData && !campoData.value) {
        campoData.value = obterDataAtualRetirada();
      }
    } catch (error) {
      console.error('Erro ao preencher data:', error);
    }
  }

  // FUNÇÃO PARA VALIDAR CAMPOS OBRIGATÓRIOS
  function validarCamposRetirada() {
    const camposObrigatorios = [
      { id: 'retirada-requisitante', nome: 'Requisitante' },
      { id: 'retirada-responsavel', nome: 'Responsável' },
      { id: 'retirada-local', nome: 'Local de Destino' },
      { id: 'retirada-finalidade', nome: 'Finalidade' }
    ];

    const camposVazios = [];
    
    camposObrigatorios.forEach(campo => {
      const elemento = document.getElementById(campo.id);
      if (!elemento || !elemento.value.trim()) {
        camposVazios.push(campo.nome);
        if (elemento) elemento.style.borderColor = '#dc3545';
      } else {
        elemento.style.borderColor = '#28a745';
      }
    });

    setTimeout(() => {
      camposObrigatorios.forEach(campo => {
        const elemento = document.getElementById(campo.id);
        if (elemento) elemento.style.borderColor = '';
      });
    }, 3000);

    return camposVazios;
  }

  // FUNÇÃO PARA COLETAR DADOS DA RETIRADA
  function coletarDadosRetirada() {
    const dados = {};
    
    camposRetirada.forEach(campoId => {
      const elemento = document.getElementById(campoId);
      if (elemento) {
        let valor = elemento.value.trim();
        
        if (campoId === 'retirada-local') {
          if (valor === 'Outro' || valor === 'outro') {
            const outroLocal = document.getElementById('retirada-outro-local');
            if (outroLocal && outroLocal.value.trim()) {
              valor = outroLocal.value.trim();
            } else {
              valor = 'Outro (não especificado)';
            }
          }
        }
        
        const nomeCampo = campoId.replace('retirada-', '');
        dados[nomeCampo] = valor || '';
      }
    });

    return dados;
  }

  // FUNÇÃO PARA COLETAR ITENS DA TABELA DE RETIRADA
  function coletarItensRetirada() {
    const dadosFormulario = coletarDadosRetirada();
    const destinoFormulario = dadosFormulario.local || '';
    
    if (!tabelaItensRetirada) {
      console.warn('Tabela de itens não encontrada');
      return [];
    }

    const linhas = tabelaItensRetirada.querySelectorAll('tr');
    const itens = [];

    linhas.forEach((linha, index) => {
      const celulas = linha.querySelectorAll('td');
      if (celulas.length >= 5) {
        const produto = celulas[0]?.textContent?.trim() || '';
        const quantidade = celulas[1]?.textContent?.trim() || '1';
        const destinoTabela = celulas[2]?.textContent?.trim() || '';
        const finalidadeTabela = celulas[3]?.textContent?.trim() || '';

        if (produto && produto !== '' && produto !== '-' && produto !== 'N/A') {
          const destinoFinal = destinoTabela && destinoTabela !== '' ? destinoTabela : destinoFormulario;
          
          itens.push({
            produto: produto,
            quantidade: quantidade,
            destino: destinoFinal || 'Não especificado',
            finalidade: finalidadeTabela || dadosFormulario.finalidade || 'Não especificada'
          });
        }
      }
    });

    return itens;
  }

  // FUNÇÃO PARA CONSULTAR ESTOQUE
  async function consultarEstoqueProduto(nomeProduto) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/produtos/estoque'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ produto: nomeProduto })
      });
      if (response.ok) {
        const resultado = await response.json();
        return resultado.quantidade !== undefined ? parseInt(resultado.quantidade, 10) : null;
      }
      return null;
    } catch (error) {
      console.error('Erro ao consultar estoque:', error);
      return null;
    }
  }

  // FUNÇÃO PRINCIPAL PARA FINALIZAR RETIRADA
  async function finalizarRetiradaAdaptada(event) {
    try {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (btnFinalizarRetirada) {
        btnFinalizarRetirada.disabled = true;
        btnFinalizarRetirada.innerHTML = '⏳ Processando...';
      }

      preencherDataRetirada();
      await new Promise(resolve => setTimeout(resolve, 300));

      const camposVazios = validarCamposRetirada();
      if (camposVazios.length > 0) {
        alert(`Preencha os campos obrigatórios:\n\n${camposVazios.map(c => `• ${c}`).join('\n')}`);
        reabilitarBotaoRetirada();
        return false;
      }

      const itens = coletarItensRetirada();
      if (itens.length === 0) {
        alert('Adicione pelo menos um item antes de finalizar.');
        reabilitarBotaoRetirada();
        return false;
      }

      // Verifica estoque de cada item
      for (let i = 0; i < itens.length; i++) {
        const item = itens[i];
        const estoqueAtual = await consultarEstoqueProduto(item.produto);
        const quantidadeSolicitada = parseInt(item.quantidade, 10) || 0;
        if (estoqueAtual !== null && estoqueAtual < quantidadeSolicitada) {
          alert(`O item "${item.produto}" só tem ${estoqueAtual} em estoque. Não é possível retirar ${quantidadeSolicitada}.`);
          reabilitarBotaoRetirada();
          return false;
        }
      }

      const dadosBase = coletarDadosRetirada();
      const idRetiradaUnico = obterIdRetiradaAdaptada();
      mostrarLoadingRetirada();

      const resultados = [];
      for (let i = 0; i < itens.length; i++) {
        const item = itens[i];
        const dadosItem = {
          id_retirada: idRetiradaUnico,
          ...dadosBase,
          produto: item.produto,
          quantidade: item.quantidade,
          local: item.destino || dadosBase.local,
          finalidade: item.finalidade || dadosBase.finalidade
        };
        
        const sucesso = await salvarItemAPIRetirada(dadosItem, i + 1, itens.length);
        resultados.push({
          produto: item.produto,
          quantidade: item.quantidade,
          id_retirada: idRetiradaUnico,
          sucesso: sucesso
          
        });
        await new Promise(resolve => setTimeout(resolve, 300));
              esconderLoadingRetirada();
      reabilitarBotaoRetirada();
      }

      processarResultadosRetirada(resultados, idRetiradaUnico);
      return false;

    } catch (error) {
      console.error('Erro:', error);

     // alert('Erro ao processar. Tente novamente.');
      return false;
    }
  }

  // FUNÇÕES AUXILIARES PARA RETIRADA
  function mostrarLoadingRetirada() {
    // Implementação do loading
  }

  function esconderLoadingRetirada() {
    // Implementação para esconder loading
  }

  function reabilitarBotaoRetirada() {
    if (btnFinalizarRetirada) {
      btnFinalizarRetirada.disabled = false;
      btnFinalizarRetirada.innerHTML = 'Finalizar Retirada';
    }
  }

  async function salvarItemAPIRetirada(dadosItem, itemAtual, totalItens) {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('Token não encontrado');
        return false;
      }

      const response = await fetch(apiUrl('/retiradas/salvar'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(dadosItem)
      });

      if (response.ok) {
        const resultado = await response.json();
        if (resultado.status === 'ok') {
          return {
            sucesso: true,
            id: resultado.retirada?.id_retirada || dadosItem.id_retirada,
            dados: resultado
          };
        }
      }
      return false;
    } catch (error) {
      console.error('Erro na API:', error);
      return false;
    }
  }

  function processarResultadosRetirada(resultados, idRetiradaUnico) {
    const sucessos = resultados.filter(r => r.sucesso);
    const falhas = resultados.filter(r => !r.sucesso);
    
    esconderLoadingRetirada();
    
    if (falhas.length === 0) {
      alert(
        `Retirada processada com sucesso!\n\n` +
        `ID da Retirada: ${idRetiradaUnico}\n` +
        `Total de itens: ${sucessos.length}`
      );
      // Limpa o formulário após sucesso
      //document.getElementById('form-retirada').reset();
      document.getElementById('itens-retirada').innerHTML = '';
      // Limpa também o campo requisitante
      const campoRequisitante = document.getElementById('retirada-requisitante');
      if (campoRequisitante) campoRequisitante.value = '';
      atualizarPreviewCupom();
      salvarRascunhoRetirada();
      // Gera novo ID de retirada e preenche o campo
      setTimeout(() => {
        const campoId = document.getElementById('retirada-id');
        if (campoId && typeof gerarIdRetirada8Digitos === 'function') {
          const novoId = gerarIdRetirada8Digitos();
          campoId.value = novoId;
          if (typeof idRetiradaGerado !== 'undefined') {
            idRetiradaGerado = novoId;
          }
          salvarRascunhoRetirada();
        }
      }, 100);
    } else {
      alert(
        `Processamento parcial!\n\n` +
        `Itens processados: ${sucessos.length}\n` +
        `Itens com erro: ${falhas.length}\n\n` +
        `Os itens com erro serão sincronizados quando houver conexão.`
      );
    }
  }

  //  FUNÇÃO PARA OBTER ID DA RETIRADA
  function obterIdRetiradaAdaptada() {
    if (idRetiradaGerado) {
      return idRetiradaGerado;
    }
    return carregarIdRetiradaAoIniciar();
  }

  //  FUNÇÃO PARA CARREGAR ID NA INICIALIZAÇÃO
  function carregarIdRetiradaAoIniciar() {
    if (campoIdRetirada && campoIdRetirada.value.trim()) {
      idRetiradaGerado = campoIdRetirada.value.trim();
      return idRetiradaGerado;
    }
    
    idRetiradaGerado = gerarIdRetirada8Digitos();
    
    if (campoIdRetirada) {
      campoIdRetirada.value = idRetiradaGerado;
      campoIdRetirada.style.backgroundColor = '#e8f5e8';
      campoIdRetirada.style.fontWeight = 'bold';
      campoIdRetirada.readOnly = true;
    }
    
    return idRetiradaGerado;
  }

  //  INICIALIZAÇÃO DA RETIRADA
  function inicializarRetirada() {
    if (!encontrarElementosRetirada()) {
      console.warn('Elementos essenciais não encontrados');
      return;
    }

    const rascunhoCarregado = carregarRascunhoRetirada();
    if (!rascunhoCarregado) {
      carregarIdRetiradaAoIniciar();
    }

    if (btnFinalizarRetirada) {
      btnFinalizarRetirada.addEventListener('click', finalizarRetiradaAdaptada);
    }
    
    // Carrega ID imediatamente se a aba estiver visível
    setTimeout(() => {
      if (campoIdRetirada && campoIdRetirada.offsetParent !== null) {
        carregarIdRetiradaAoIniciar();
      }
    }, 500);
    
    // Preenche data inicial
    setTimeout(() => {
      preencherDataRetirada();
      salvarRascunhoRetirada();
    }, 1000);
  }

  // Inicializa o sistema de retirada
  inicializarRetirada();

  // Tenta novamente após 3 segundos se não encontrou elementos
  setTimeout(() => {
    if (!btnFinalizarRetirada) {
      inicializarRetirada();
    }
  }, 3000);

  
  //======================================================================================================


async function buscarDevolucoesPorId() {
  const idInput = document.getElementById('devolucao-id'); // usa o id correto!
  const tabela = document.getElementById('tabela-devolucoes');
  if (!idInput || !tabela) return;

  const idRetirada = idInput.value.trim();
  if (!idRetirada) {
    alert('Digite o código da retirada para buscar.');
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(apiUrl('/retiradas/por-id'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ id_retirada: idRetirada })
    });

    if (!response.ok) {
      alert('Erro ao buscar devoluções.');
      return;
    }

    const data = await response.json();
    // Ajuste aqui conforme o retorno real do backend:
    const devolucoes = Array.isArray(data.devolucoes) ? data.devolucoes : [];

    // Limpa a tabela (mantendo apenas o cabeçalho)
    const tbody = tabela.tBodies[0] || tabela.createTBody();
    tbody.innerHTML = '';

    if (devolucoes.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7; // número de colunas da sua tabela
      td.textContent = 'Nenhum registro encontrado para este código de retirada.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    devolucoes.forEach(item => {
      const tr = document.createElement('tr');
      // Adapte os campos conforme o retorno do backend
      const tdId = document.createElement('td');
      const tdProduto = document.createElement('td');
      const tdQuantidade = document.createElement('td');
      const tdRequisitante = document.createElement('td');
      const tdResponsavel = document.createElement('td');
      const tdObservacao = document.createElement('td');
      const tdData = document.createElement('td');
      tdId.textContent = item.id_retirada || idRetirada;
      tdProduto.textContent = item.produto || '';
      tdQuantidade.textContent = item.quantidade || '';
      tdRequisitante.textContent = item.requisitante || '';
      tdResponsavel.textContent = item.responsavel || '';
      tdObservacao.textContent = item.observacao || '';
      tdData.textContent = item.data ? formatarDataCurta(item.data) : '';
      tr.appendChild(tdId);
      tr.appendChild(tdProduto);
      tr.appendChild(tdQuantidade);
      tr.appendChild(tdRequisitante);
      tr.appendChild(tdResponsavel);
      tr.appendChild(tdObservacao);
      tr.appendChild(tdData);
      tbody.appendChild(tr);
    });
  } catch (error) {
    alert('Erro ao buscar devoluções.');
  }
}

// 1. Adicionar item na tabela localmente, validando se o produto pertence à retirada
document.getElementById('btn-adicionar-item-devolucao')?.addEventListener('click', async function () {
  const idRetirada = document.getElementById('devolucao-id')?.value.trim();
  const produto = document.getElementById('devolucao-produto')?.value.trim();
  const quantidade = document.getElementById('devolucao-quantidade')?.value.trim();
  const requisitante = document.getElementById('devolucao-requisitante')?.value.trim();
  const responsavel = document.getElementById('devolucao-responsavel')?.value.trim();
  const observacao = document.getElementById('devolucao-observacao')?.value.trim();
  const data = new Date().toISOString();

  if (!idRetirada || !produto || !quantidade) {
    alert('Preencha o ID da retirada, produto e quantidade.');
    return;
  }

  // Busca os itens da retirada no backend para validar o produto
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(apiUrl('/retiradas/por-id'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ id_retirada: idRetirada })
    });
    if (!response.ok) {
      alert('Erro ao validar retirada.');
      return;
    }
    const dataRetorno = await response.json();
    const itensRetirada = Array.isArray(dataRetorno.devolucoes) ? dataRetorno.devolucoes : [];
    const itemRetirada = itensRetirada.find(item => item.produto === produto);
    if (!itemRetirada) {
      alert(`O item "${produto}" não existe na retirada ${idRetirada}.`);
      return;
    }
  } catch (error) {
    alert('Erro ao validar retirada.');
    return;
  }

  const tabela = document.getElementById('tabela-devolucoes');
  const tbody = tabela.tBodies[0] || tabela.createTBody();
  // Verifica se já existe uma linha com o mesmo produto
  let linhaExistente = null;
  for (let linha of tbody.rows) {
    if (linha.cells[1] && linha.cells[1].textContent === produto) {
      linhaExistente = linha;
      break;
    }
  }
  if (linhaExistente) {
    // Soma a quantidade
    const quantidadeAtual = parseInt(linhaExistente.cells[2].textContent, 10) || 0;
    const novaQuantidade = quantidadeAtual + (parseInt(quantidade, 10) || 0);
    linhaExistente.cells[2].textContent = novaQuantidade;
    // Atualiza outros campos se desejar (opcional)
    linhaExistente.cells[3].textContent = requisitante;
    linhaExistente.cells[4].textContent = responsavel;
    linhaExistente.cells[5].textContent = observacao;
    linhaExistente.cells[6].textContent = formatarDataCurta(data);
  } else {
    // Cria nova linha normalmente
    const tr = document.createElement('tr');
    [idRetirada, produto, quantidade, requisitante, responsavel, observacao, formatarDataCurta(data)].forEach(valor => {
      const td = document.createElement('td');
      td.textContent = valor;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
});

// 2. Registrar devolução com validação
document.getElementById('btn-registro-devolucao')?.addEventListener('click', async function (e) {
  e.preventDefault();

  const idRetirada = document.getElementById('devolucao-id')?.value.trim();
  if (!idRetirada) {
    alert('Informe o ID da retirada.');
    return;
  }

  // Coleta os itens da tabela de devoluções
  const tabela = document.getElementById('tabela-devolucoes');
  const linhas = tabela.tBodies[0]?.rows || [];
  if (linhas.length === 0) {
    alert('Adicione pelo menos um item para devolução.');
    return;
  }

  // Busca os itens da retirada no backend
  const token = localStorage.getItem('token');
  const response = await fetch(apiUrl('/retiradas/por-id'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ id_retirada: idRetirada })
  });

  if (!response.ok) {
    alert('Erro ao validar retirada.');
    return;
  }

  const dataRetorno = await response.json();
  const itensRetirada = Array.isArray(dataRetorno.devolucoes) ? dataRetorno.devolucoes : [];

  // Validação dos itens
  for (let linha of linhas) {
    const produto = linha.cells[1].textContent;
    const quantidadeDevolucao = parseInt(linha.cells[2].textContent, 10);

    const itemRetirada = itensRetirada.find(item => item.produto === produto);
    if (!itemRetirada) {
      alert(`O item "${produto}" não existe na retirada ${idRetirada}.`);
      return;
    }
    const quantidadeRetirada = parseInt(itemRetirada.quantidade, 10);
    if (quantidadeDevolucao > quantidadeRetirada) {
      alert(`A quantidade devolvida do item "${produto}" (${quantidadeDevolucao}) é maior que a retirada (${quantidadeRetirada}).`);
      return;
    }
  }

  // Se passou por todas as validações, pode registrar a devolução no backend
  // Monta os dados para envio
  const itens = [];
  for (let linha of linhas) {
    itens.push({
      produto: linha.cells[1].textContent,
      quantidade: parseInt(linha.cells[2].textContent, 10),
      requisitante: linha.cells[3].textContent,
      responsavel: linha.cells[4].textContent,
      observacao: linha.cells[5].textContent,
      data: linha.cells[6].textContent // já formatada
    });
  }
  const responsavel = document.getElementById('devolucao-responsavel')?.value.trim() || '';
  const observacao = document.getElementById('devolucao-observacao')?.value.trim() || '';
  const requisitante = document.getElementById('devolucao-requisitante')?.value.trim() || '';
  const data = new Date().toISOString();
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(apiUrl('/devolucao/salvar'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        id_retirada: idRetirada,
        itens,
        responsavel,
        observacao,
        requisitante,
        data
      })
    });
    if (response.ok) {
      alert('Devolução registrada com sucesso!');
      // Limpa a tabela e campos, se desejar
      if (tabela.tBodies[0]) tabela.tBodies[0].innerHTML = '';
    } else {
      alert('Erro ao registrar devolução.');
    }
  } catch (error) {
    alert('Erro ao registrar devolução.');
  }
});

// Função auxiliar para formatar a data (ex: 2025-07-02 para 02/07/2025)
function formatarDataCurta(dataISO) {
  if (!dataISO) return '';
  const d = new Date(dataISO);
  if (isNaN(d.getTime())) return dataISO;
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

// Adicione o evento ao botão de busca
document.getElementById('btn-buscar-devolucao')?.addEventListener('click', buscarDevolucoesPorId);

// Verificação ao perder o foco do campo de código de retirada
document.getElementById('devolucao-id')?.addEventListener('blur', async function () {
  const idInput = document.getElementById('devolucao-id');
  const campoRequisitante = document.getElementById('devolucao-requisitante');
  if (!idInput || !campoRequisitante) return;
  const idRetirada = idInput.value.trim();
  if (!idRetirada) return;
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(apiUrl('/retiradas/por-id'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ id_retirada: idRetirada })
    });
    if (!response.ok) {
      campoRequisitante.value = '';
      return;
    }
    const data = await response.json();
    const devolucoes = Array.isArray(data.devolucoes) ? data.devolucoes : [];
    if (devolucoes.length > 0 && devolucoes[0].requisitante) {
      campoRequisitante.value = devolucoes[0].requisitante;
    } else {
      campoRequisitante.value = '';
    }
  } catch (error) {
    campoRequisitante.value = '';
  }
});


//======================================================================================================
// FUNÇÃO PRINCIPAL: Inicialização dos Eventos de Kit
// Adiciona item do formulário de kit na tabela de kits e salva todos os itens no backend.
//======================================================================================================
document.addEventListener('DOMContentLoaded', function () {
  // Evento para salvar todos os itens do kit na tabela do backend
  const btnSalvarKit = document.getElementById('btn-salvar-kit');
  if (btnSalvarKit) {
    btnSalvarKit.addEventListener('click', async function (e) {
      e.preventDefault();
      try {
        const tabelaKit = document.getElementById('tabela-kit');
        if (!tabelaKit) {
          alert('Tabela de kits não encontrada!');
          return;
        }
        const tbody = tabelaKit.tBodies[0];
        if (!tbody || tbody.rows.length === 0) {
          alert('Adicione pelo menos um item ao kit antes de salvar!');
          return;
        }
        // Monta array de objetos
        const kits = [];
        for (let i = 0; i < tbody.rows.length; i++) {
          const row = tbody.rows[i];
          const cells = row.cells;
          kits.push({
            nome_do_kit: cells[0].textContent.trim(),
            produto: cells[1].textContent.trim(),
            quantidade: cells[2].textContent.trim(),
            categoria: cells[3].textContent.trim(),
            observacao: cells[4].textContent.trim()
          });
        }
        // Envia para o backend
        const token = localStorage.getItem('token');
        const response = await fetch(apiUrl('/kits/salvar'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ kits })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'ok') {
            alert('Kits salvos com sucesso!');
            // Limpa a tabela após salvar
            tbody.innerHTML = '';
            // Limpa todos os campos do formulário do kit
            const nomeKitInput = document.getElementById('nome-do-kit');
            const produtoInput = document.getElementById('nome-produto-kit');
            const quantidadeInput = document.getElementById('quantidade-kit');
            const categoriaInput = document.getElementById('categoria-kit');
            const observacaoInput = document.getElementById('observacao-kit');
            if (nomeKitInput) nomeKitInput.value = '';
            if (produtoInput) produtoInput.value = '';
            if (quantidadeInput) quantidadeInput.value = '';
            if (categoriaInput) categoriaInput.value = '';
            if (observacaoInput) observacaoInput.value = '';
            // Volta a imagem para o padrão
            const imgKit = document.getElementById('preview-produto-kit') || document.getElementById('preview-kit') || document.getElementById('imagem-kit');
            if (imgKit) {
              imgKit.src = '../IMG/Sem_imagem.png';
              imgKit.alt = 'Imagem do Produto';
              imgKit.style.cursor = 'default';
              imgKit.title = 'Clique para selecionar uma imagem';
              imgKit.onclick = null;
            }
          } else {
            alert('Erro ao salvar kits: ' + (data.mensagem || 'Erro desconhecido.'));
          }
        } else {
          alert('Erro ao salvar kits: ' + response.status + ' ' + response.statusText);
        }
      } catch (err) {
        alert('Erro ao salvar kits: ' + err.message);
        console.error(err);
      }
    });
  }
  // ...imagem do produto não será mais carregada automaticamente...
  const btnAdicionar = document.getElementById('btn-adicionar-item-kit');
  if (!btnAdicionar) return;
  btnAdicionar.addEventListener('click', function (e) {
    e.preventDefault();
    try {
      // Lógica dinâmica para adaptação dos campos do formulário de kit
      const camposKit = [
        { id: 'nome-do-kit', obrigatorio: true },
        { id: 'nome-produto-kit', obrigatorio: true },
        { id: 'quantidade-kit', obrigatorio: true },
        { id: 'categoria-kit', obrigatorio: true },
        { id: 'observacao-kit', obrigatorio: false }
      ];

      let camposInvalidos = [];
      let valoresCampos = {};
      camposKit.forEach(campo => {
        const el = document.getElementById(campo.id);
        if (!el) {
          camposInvalidos.push(campo.id);
        } else {
          valoresCampos[campo.id] = el.value.trim();
          if (campo.obrigatorio && !el.value.trim()) {
            camposInvalidos.push(campo.id);
          }
        }
      });

      if (camposInvalidos.length > 0) {
        alert('Preencha todos os campos obrigatórios do kit!');
        return;
      }

      // Adiciona o item na nova tabela dedicada de exibição dos kits
      const tabelaKitsLista = document.getElementById('tabela-kits-lista');
      if (!tabelaKitsLista) {
        alert('Tabela de exibição de kits não encontrada!');
        return;
      }
      // Garante que o tbody existe
      let tbodyKits = tabelaKitsLista.querySelector('tbody');
      if (!tbodyKits) {
        tbodyKits = document.createElement('tbody');
        tabelaKitsLista.appendChild(tbodyKits);
      }
      // Cria a linha e adiciona as células com o atributo data-coluna correto
      const novaLinhaKits = document.createElement('tr');
      const colunas = [
        { id: 'nome-do-kit', valor: valoresCampos['nome-do-kit'] },
        { id: 'produto', valor: valoresCampos['nome-produto-kit'] },
        { id: 'quantidade', valor: valoresCampos['quantidade-kit'] },
        { id: 'categoria', valor: valoresCampos['categoria-kit'] },
        { id: 'observacao', valor: valoresCampos['observacao-kit'] },
        { id: 'imagens', valor: '' }
      ];
      colunas.forEach(col => {
        const td = document.createElement('td');
        td.setAttribute('data-coluna', col.id);
        td.textContent = col.valor;
        novaLinhaKits.appendChild(td);
      });
      tbodyKits.appendChild(novaLinhaKits);

      // Atualiza colunas se função existir
      if (typeof atualizarColunasKits === 'function') {
        atualizarColunasKits();
      }

      // Limpa os campos Produto e Quantidade
      const produtoInput = document.getElementById('nome-produto-kit');
      const quantidadeInput = document.getElementById('quantidade-kit');
      if (produtoInput) produtoInput.value = '';
      if (quantidadeInput) quantidadeInput.value = '';
      // Volta a imagem para o padrão
      const imgKit = document.getElementById('preview-produto-kit') || document.getElementById('preview-kit') || document.getElementById('imagem-kit');
      if (imgKit) {
        imgKit.src = '../IMG/Sem_imagem.png';
        imgKit.alt = 'Imagem do Produto';
        imgKit.style.cursor = 'default';
        imgKit.title = 'Clique para selecionar uma imagem';
        imgKit.onclick = null;
      }
    } catch (err) {
      alert('Erro ao adicionar item: ' + err.message);
      console.error('[KITS] Erro ao adicionar item:', err);
    }
  });
// Exibe componentes proprietários dos kits ao selecionar "kits" no campo de busca
document.addEventListener('DOMContentLoaded', function () {
  const campoBuscarEm = document.querySelector('#busca select[name="buscar-em"], #busca #buscar-em');
  const divKits = document.getElementById('consultas-kits');
  if (campoBuscarEm && divKits) {
    campoBuscarEm.addEventListener('change', function () {
      if (campoBuscarEm.value === 'kits') {
        divKits.style.display = '';
        // Se quiser esconder outros componentes, faça aqui
      } else {
        divKits.style.display = 'none';
      }
    });
  }
});
});

// ===================== CONTROLE DE TABELA DE KITS =====================

// IDs das colunas possíveis para kits
const colunasKits = [
  { id: 'nome-do-kit', label: 'Nome do Kit' },
  { id: 'produto', label: 'Produto' },
  { id: 'quantidade', label: 'Quantidade' },
  { id: 'categoria', label: 'Categoria' },
  { id: 'observacao', label: 'Observação' },
  { id: 'imagens', label: 'Imagens' }
];

// Função para montar o seletor de colunas dos kits
function montarColunasKitsSelector() {
  const container = document.getElementById('colunas-visiveis-kits');
  if (!container) return;
  container.innerHTML = '';
  colunasKits.forEach(col => {
    const label = document.createElement('label');
    label.style.marginRight = '12px';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = col.id;
    checkbox.checked = true;
    // Adiciona listener para salvar preferências
    checkbox.addEventListener('change', function() {
      salvarPreferenciaColunasKits();
      atualizarColunasKits();
    });
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' ' + col.label));
    container.appendChild(label);
  });
  // Carrega preferências salvas
  carregarPreferenciaColunasKits();
}

// Salva preferências de colunas de kits
function salvarPreferenciaColunasKits() {
  const checkboxes = document.querySelectorAll('#colunas-visiveis-kits input[type="checkbox"]');
  const colunasSelecionadas = {};
  checkboxes.forEach(checkbox => {
    colunasSelecionadas[checkbox.value] = checkbox.checked;
  });
  localStorage.setItem('coluna-visiveis-kits', JSON.stringify(colunasSelecionadas));
}

// Carrega preferências de colunas de kits
function carregarPreferenciaColunasKits() {
  const preferencias = localStorage.getItem('coluna-visiveis-kits');
  if (preferencias) {
    const colunasSelecionadas = JSON.parse(preferencias);
    const checkboxes = document.querySelectorAll('#colunas-visiveis-kits input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      if (colunasSelecionadas.hasOwnProperty(checkbox.value)) {
        checkbox.checked = colunasSelecionadas[checkbox.value];
      }
    });
  }
}

// Função para atualizar a visibilidade das colunas da tabela de kits
function atualizarColunasKits() {
  const tabela = document.getElementById('tabela-kits-lista');
  if (!tabela) return;
  const thead = tabela.querySelector('thead');
  const tbody = tabela.querySelector('tbody');
  const checkboxes = document.querySelectorAll('#colunas-visiveis-kits input[type="checkbox"]');
  if (!thead || !tbody) return;

  // Mapeia colunas visíveis
  const colunasVisiveis = {};
  checkboxes.forEach(cb => {
    colunasVisiveis[cb.value] = cb.checked;
  });

  // Atualiza <th>
  const ths = thead.querySelectorAll('th[data-coluna]');
  ths.forEach((th, idx) => {
    const coluna = th.getAttribute('data-coluna');
    const visivel = !!colunasVisiveis[coluna];
    th.style.display = visivel ? '' : 'none';
    // Atualiza todas as linhas do tbody
    Array.from(tbody.rows).forEach(row => {
      const td = row.cells[idx];
      if (td) td.style.display = visivel ? '' : 'none';
    });
  });
}

// ===== CARREGAR TODOS OS KITS =====
async function carregarTodosKits() {
  const tabelaKits = document.querySelector('#tabela-kits-lista tbody');
  if (!tabelaKits) return;

  tabelaKits.innerHTML = '';

  try {
    // 1) Busca a lista de nomes de kits
    const nomesResp = await fetch(apiUrl('kits/sugestoes-nomes'), {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token'),
      },
    });
    if (!nomesResp.ok) {
      throw new Error(`Falha ao listar nomes de kits (${nomesResp.status})`);
    }

    const nomesData = await nomesResp.json();
    const nomesKits = Array.isArray(nomesData?.nomes)
      ? nomesData.nomes.map(n => n?.nome_do_kit).filter(Boolean)
      : [];

    // 2) Para cada nome de kit, busca os itens em /kits/itens
    for (const nomeKit of nomesKits) {
      const itensResp = await fetch(apiUrl('kits/itens'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify({ nome_do_kit: nomeKit }),
      });

      if (!itensResp.ok) {
        continue;
      }

      const itensData = await itensResp.json();
      const itens = Array.isArray(itensData?.itens) ? itensData.itens : [];

      itens.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td data-coluna="nome-do-kit">${nomeKit}</td>
          <td data-coluna="produto">${item.produto || item.nome_produto || ''}</td>
          <td data-coluna="quantidade">${item.quantidade || ''}</td>
          <td data-coluna="categoria">${item.categoria || ''}</td>
          <td data-coluna="observacao">${item.observacao || ''}</td>
          <td data-coluna="imagens">${item.imagem_base64 ? `<img src='data:image/png;base64,${item.imagem_base64}' style='max-width:60px;max-height:60px;object-fit:contain;display:block;margin:auto;cursor:pointer;' />` : ''}</td>
        `;
        tabelaKits.appendChild(row);
      });
    }

    // Aplica filtro se houver algum texto no campo de busca
    filtrarTabelaKits();
  } catch (error) {
    console.error('Erro ao carregar kits:', error);
    // Mantém a UI estável em caso de erro de rede/CORS
    tabelaKits.innerHTML = '';
  }
}

// Adiciona listener ao dropdown para carregar dados quando selecionado
document.getElementById('tipo-busca')?.addEventListener('change', function() {
  if (this.value === 'kits') {
    carregarTodosKits();
  } else if (this.value === 'retiradas') {
    carregarTodasRetiradas();
  } else if (this.value === 'devolucoes') {
    carregarTodasDevolucoes();
  } else if (this.value === 'fornecedores') {
    carregarTodosFornecedores();
  }
});

// ===== CARREGAR TODAS AS RETIRADAS =====
async function carregarTodasRetiradas() {
  try {
    const response = await fetch(apiUrl('retiradas/listar'), {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
    });
    const data = await response.json();
    const tbody = document.querySelector('#tabela-retiradas-lista tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const lista = (response.ok && (data.retiradas || data.itens || data.data || data)) || [];
    const items = Array.isArray(lista) ? lista : (Array.isArray(lista.retiradas) ? lista.retiradas : []);
    items.forEach(item => {
      const row = document.createElement('tr');
      const idRetirada = item.id_retirada || item.id || '';
      row.dataset.idRetirada = idRetirada;
      row.innerHTML = `
        <td data-coluna="id">${item.id || ''}</td>
        <td data-coluna="data">${item.data || item.data_retirada || ''}</td>
        <td data-coluna="requisitante">${item.requisitante || item.nome_requisitante || ''}</td>
        <td data-coluna="produto">${item.produto || item.nome_produto || ''}</td>
        <td data-coluna="quantidade">${item.quantidade || ''}</td>
        <td data-coluna="local">${item.local || ''}</td>
        <td data-coluna="observacao">${item.observacao || ''}</td>
      `;
      tbody.appendChild(row);
    });
    
  } catch (error) {
    console.error('Erro ao carregar retiradas:', error);
  }
}

// ===== PROCESSAR RETIRADA COMPLETA =====
async function processarRetiradaCompleta(idRetirada) {
  try {
    // Busca todos os itens com este ID de retirada
    const response = await fetch(apiUrl('retiradas/listar'), {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
    });
    const data = await response.json();
    const lista = (response.ok && (data.retiradas || data.itens || data.data || data)) || [];
    const items = Array.isArray(lista) ? lista : (Array.isArray(lista.retiradas) ? lista.retiradas : []);
    
    // Filtra itens com o mesmo ID de retirada
    const itensRetirada = items.filter(item => 
      (item.id_retirada || item.id) === idRetirada
    );
    
    if (itensRetirada.length === 0) {
      alert('❌ Nenhum item encontrado para esta retirada.');
      return;
    }
    
    // Cria modal de confirmação com informações dos itens
    criarModalConfirmarRetirada(idRetirada, itensRetirada);
  } catch (error) {
    console.error('Erro ao processar retirada:', error);
    alert('❌ Erro ao carregar dados da retirada. Verifique o console.');
  }
}

// ===== CRIAR MODAL DE CONFIRMAÇÃO DE RETIRADA =====
function criarModalConfirmarRetirada(idRetirada, itensRetirada) {
  const modalExistente = document.getElementById('modal-confirmacao-retirada');
  if (modalExistente) {
    modalExistente.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'modal-confirmacao-retirada';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1001;
    font-family: Arial, sans-serif;
  `;

  // Cria lista de itens
  const listaItensHTML = itensRetirada.map((item, idx) => {
    return `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px; text-align: left;">${idx + 1}</td>
        <td style="padding: 8px; text-align: left; font-weight: bold;">${item.produto || item.nome_produto || '-'}</td>
        <td style="padding: 8px; text-align: center;">${item.quantidade || '-'}</td>
        <td style="padding: 8px; text-align: left;">${item.requisitante || item.nome_requisitante || '-'}</td>
      </tr>
    `;
  }).join('');

  modal.innerHTML = `
    <div style="
      background: white;
      padding: 30px;
      border-radius: 12px;
      max-width: 600px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    ">
      <h2 style="margin-top: 0; color: #e74c3c; font-size: 22px; text-align: center;">
        ⚠️ Retirada Completa
      </h2>
      
      <div style="background-color: #fff3cd; border: 1px solid #f5d38a; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #856404; font-weight: bold;">
          ⚡ ATENÇÃO: Todos os itens desta retirada serão retirados juntos!
        </p>
      </div>
      
      <div style="margin: 20px 0;">
        <p style="color: #333; font-size: 16px; margin-bottom: 10px;">
          <strong>ID da Retirada:</strong> <span style="font-family: monospace; background: #f0f0f0; padding: 4px 8px; border-radius: 3px;">${escapeHtml(idRetirada)}</span>
        </p>
        <p style="color: #333; font-size: 16px;">
          <strong>Total de itens:</strong> <span style="color: #e74c3c; font-weight: bold; font-size: 18px;">${itensRetirada.length}</span>
        </p>
      </div>

      <div style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead style="background: #f8f9fa; position: sticky; top: 0;">
            <tr>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd; font-weight: bold;">#</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd; font-weight: bold;">Produto</th>
              <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold;">Qtd</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd; font-weight: bold;">Requisitante</th>
            </tr>
          </thead>
          <tbody>
            ${listaItensHTML}
          </tbody>
        </table>
      </div>

      <p style="color: #666; font-size: 14px; margin: 20px 0;">
        Clique em <strong>"Confirmar Retirada"</strong> para processar a retirada de todos estes itens de uma só vez.
      </p>

      <div style="display: flex; gap: 15px; justify-content: center;">
        <button id="btn-confirmar-retirada-completa" style="
          background: linear-gradient(45deg, #27ae60, #229954);
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 15px;
          font-weight: bold;
          transition: all 0.3s;
          box-shadow: 0 3px 12px rgba(39, 174, 96, 0.3);
        ">
          Confirmar Retirada
        </button>
        
        <button id="btn-cancelar-retirada-completa" style="
          background: #95a5a6;
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 15px;
          font-weight: bold;
          transition: all 0.3s;
          box-shadow: 0 3px 12px rgba(149, 165, 166, 0.3);
        ">
          ❌ Cancelar
        </button>
      </div>
    </div>
  `;

  // Eventos dos botões
  modal.querySelector('#btn-confirmar-retirada-completa').addEventListener('click', function() {
    modal.remove();
    executarRetiradaCompleta(idRetirada, itensRetirada);
  });

  modal.querySelector('#btn-cancelar-retirada-completa').addEventListener('click', function() {
    modal.remove();
  });

  // Fecha ao clicar fora
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Fecha com ESC
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.getElementById('modal-confirmacao-retirada')) {
      document.getElementById('modal-confirmacao-retirada').remove();
    }
  });

  document.body.appendChild(modal);
}

// ===== EXECUTAR RETIRADA COMPLETA =====
async function executarRetiradaCompleta(idRetirada, itensRetirada) {
  try {
    console.log(`📤 Processando retirada completa: ${idRetirada}`);
    console.log(`📦 Total de itens: ${itensRetirada.length}`);
    
    // Remove as linhas da tabela que correspondem a esta retirada
    const tbody = document.querySelector('#tabela-retiradas-lista tbody');
    if (!tbody) {
      alert('❌ Tabela não encontrada.');
      return;
    }

    let removidos = 0;
    const linhas = tbody.querySelectorAll('tr');
    
    for (const linha of linhas) {
      const idDaLinha = linha.querySelector('[data-coluna="id"]')?.textContent.trim();
      
      // Verifica se esta linha pertence à retirada
      if (idDaLinha === idRetirada) {
        console.log(`🗑️ Removendo: ${linha.querySelector('[data-coluna="produto"]')?.textContent}`);
        linha.remove();
        removidos++;
      }
    }

    console.log(`✓ Processamento concluído: ${removidos} item(ns) removido(s)`);
    
    if (removidos > 0) {
      alert(`Retirada concluída!\n\n${removidos} item(ns) foram retirados com sucesso.`);
    } else {
      alert(`⚠️ Nenhum item foi encontrado para remover.`);
    }
    
  } catch (error) {
    console.error('Erro geral na retirada:', error);
    alert(`❌ Erro ao processar retirada: ${error.message}`);
  }
}

// ===== CARREGAR TODAS AS DEVOLUÇÕES =====
async function carregarTodasDevolucoes() {
  try {
    const response = await fetch(apiUrl('devolucao/listar'), {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
    });
    const data = await response.json();
    const tbody = document.querySelector('#tabela-devolucoes-lista tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const items = Array.isArray(data.devolucoes || data) ? (data.devolucoes || data) : [];
    items.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td data-coluna="id">${item.id || ''}</td>
        <td data-coluna="data">${item.data || item.data_devolucao || ''}</td>
        <td data-coluna="requisitante">${item.requisitante || item.nome_requisitante || ''}</td>
        <td data-coluna="produto">${item.produto || item.nome_produto || ''}</td>
        <td data-coluna="quantidade">${item.quantidade || ''}</td>
        <td data-coluna="observacao">${item.observacao || ''}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Erro ao carregar devoluções:', error);
  }
}

// ===== CARREGAR TODOS OS FORNECEDORES =====
async function carregarTodosFornecedores() {
  try {
    const response = await fetch(apiUrl('fornecedores/listar'), {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
    });
    const data = await response.json();
    const tbody = document.querySelector('#tabela-fornecedores-lista tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const items = Array.isArray(data.fornecedores || data) ? (data.fornecedores || data) : [];
    items.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td data-coluna="id">${item.id || ''}</td>
        <td data-coluna="nome">${item.nome || ''}</td>
        <td data-coluna="cnpj">${item.cnpj || ''}</td>
        <td data-coluna="telefone">${item.telefone || ''}</td>
        <td data-coluna="email">${item.email || ''}</td>
        <td data-coluna="endereco">${item.endereco || ''}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Erro ao carregar fornecedores:', error);
  }
}

// ===== CARREGAR TODOS OS REQUISITANTES =====
async function carregarTodosRequisitantes() {
  try {
    const response = await fetch(apiUrl('requisitantes/listar'), {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
    });
    const data = await response.json();
    const tbody = document.querySelector('#tabela-requisitantes-lista tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const items = Array.isArray(data.requisitantes || data) ? (data.requisitantes || data) : [];
    items.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td data-coluna="id">${item.id || ''}</td>
        <td data-coluna="nome">${item.nome || ''}</td>
        <td data-coluna="setor">${item.setor || ''}</td>
        <td data-coluna="cargo">${item.cargo || ''}</td>
        <td data-coluna="telefone">${item.telefone || ''}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Erro ao carregar requisitantes:', error);
  }
}

// ===== FILTRO EM TEMPO REAL PARA KITS =====
function filtrarTabelaKits() {
  const nomeFiltro = document.getElementById('nome-kit-busca')?.value.trim().toLowerCase() || '';
  const tabelaKits = document.querySelector('#tabela-kits-lista tbody');
  if (!tabelaKits) return;
  
  const linhas = tabelaKits.querySelectorAll('tr');
  let totalVisivel = 0;
  
  linhas.forEach(linha => {
    const nomeKit = linha.querySelector('[data-coluna="nome-do-kit"]')?.textContent.trim().toLowerCase() || '';
    const correspondente = !nomeFiltro || nomeKit.includes(nomeFiltro);
    
    if (correspondente) {
      linha.style.display = '';
      totalVisivel++;
    } else {
      linha.style.display = 'none';
    }
  });
  
  // Se nenhuma linha corresponder, mostra mensagem
  if (totalVisivel === 0 && nomeFiltro && linhas.length > 0) {
    const mensagem = document.getElementById('mensagem-filtro-kits-vazio') || document.createElement('div');
    if (!document.getElementById('mensagem-filtro-kits-vazio')) {
      mensagem.id = 'mensagem-filtro-kits-vazio';
      mensagem.style.cssText = 'text-align: center; padding: 20px; color: #888; font-style: italic;';
      tabelaKits.parentElement.appendChild(mensagem);
    }
    mensagem.textContent = 'Nenhum kit encontrado com esse nome.';
    mensagem.style.display = 'block';
  } else {
    const mensagem = document.getElementById('mensagem-filtro-kits-vazio');
    if (mensagem) mensagem.style.display = 'none';
  }
}

// Adiciona listener ao campo de filtro para filtrar em tempo real
document.getElementById('nome-kit-busca')?.addEventListener('input', filtrarTabelaKits);

// Chame isso ao carregar a aba de kits:
document.addEventListener('DOMContentLoaded', function () {
  montarColunasKitsSelector();
  atualizarColunasKits();

  // Inicializa o botão de toggle de colunas para kits
  const btnToggleColunasKits = document.getElementById('toggle-colunas-kits-busca');
  if (btnToggleColunasKits) {
    btnToggleColunasKits.addEventListener('click', function(e) {
      e.preventDefault();
      const container = this.parentElement.nextElementSibling;
      if (container && container.classList.contains('colunas-selector-container')) {
        if (container.classList.contains('ativo')) {
          container.classList.remove('ativo');
          this.classList.remove('ativo');
        } else {
          container.classList.add('ativo');
          this.classList.add('ativo');
        }
      }
    });
  }

  // Lógica robusta para adicionar item ao kit (sem interferência de outros elementos)
  // Lógica robusta e isolada para adicionar item ao kit e controle de colunas
  const btnAdicionar = document.getElementById('btn-adicionar-item-kit');
  if (btnAdicionar) {
    btnAdicionar.type = 'button';
    // Remove todos os event listeners antigos (substitui o nó)
    const btnClone = btnAdicionar.cloneNode(true);
    btnAdicionar.parentNode.replaceChild(btnClone, btnAdicionar);
    btnClone.type = 'button';
    btnClone.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      try {
        // Validação dos campos do formulário do kit
        const camposKit = [
          { id: 'nome-do-kit', obrigatorio: true },
          { id: 'nome-produto-kit', obrigatorio: true },
          { id: 'quantidade-kit', obrigatorio: true },
          { id: 'categoria-kit', obrigatorio: true },
          { id: 'observacao-kit', obrigatorio: false }
        ];
        let camposInvalidos = [];
        let valoresCampos = {};
        camposKit.forEach(campo => {
          const el = document.getElementById(campo.id);
          if (!el) {
            camposInvalidos.push(campo.id);
          } else {
            valoresCampos[campo.id] = el.value.trim();
            if (campo.obrigatorio && !el.value.trim()) {
              camposInvalidos.push(campo.id);
              el.style.borderColor = '#dc3545';
            } else if (el) {
              el.style.borderColor = '';
            }
          }
        });
        if (camposInvalidos.length > 0) {
          alert('Preencha todos os campos obrigatórios do kit!');
          return;
        }

        // Adiciona o item na tabela de cadastro de kits
        const tabelaKitsCadastro = document.getElementById('tabela-kits-lista-cadastro');
        if (!tabelaKitsCadastro) {
          alert('Tabela de cadastro de kits não encontrada!');
          return;
        }
        let tbodyKits = tabelaKitsCadastro.querySelector('tbody');
        if (!tbodyKits) {
          tbodyKits = document.createElement('tbody');
          tabelaKitsCadastro.appendChild(tbodyKits);
        }
        // Cria a linha e adiciona as células
        const novaLinhaKits = document.createElement('tr');
        const colunas = [
          { id: 'nome-do-kit', valor: valoresCampos['nome-do-kit'] },
          { id: 'produto', valor: valoresCampos['nome-produto-kit'] },
          { id: 'quantidade', valor: valoresCampos['quantidade-kit'] },
          { id: 'categoria', valor: valoresCampos['categoria-kit'] },
          { id: 'observacao', valor: valoresCampos['observacao-kit'] },
          { id: 'imagens', valor: '' }
        ];
        colunas.forEach(col => {
          const td = document.createElement('td');
          td.setAttribute('data-coluna', col.id);
          td.textContent = col.valor;
          novaLinhaKits.appendChild(td);
        });
        tbodyKits.appendChild(novaLinhaKits);

        // Limpa campos e imagem
        ['nome-produto-kit', 'quantidade-kit'].forEach(id => {
          const input = document.getElementById(id);
          if (input) input.value = '';
        });
        const imgKit = document.getElementById('preview-produto-kit') || document.getElementById('preview-kit') || document.getElementById('imagem-kit');
        if (imgKit) {
          imgKit.src = '../IMG/Sem_imagem.png';
          imgKit.alt = 'Imagem do Produto';
          imgKit.style.cursor = 'default';
          imgKit.title = 'Clique para selecionar uma imagem';
          imgKit.onclick = null;
        }
      } catch (err) {
        alert('Erro ao adicionar item ao kit: ' + (err && err.message ? err.message : err));
        console.error('[KITS] Erro ao adicionar item:', err);
      }
    });
  }
});

// =================================== FINAL DO SCRIPT =====================================
});

//======================================================================================================
// PADRÃO DAS TABELAS: clique na linha abre a ficha do registro (só ver).
// As ações do registro ficam dentro da ficha (ex.: concluir a retirada).
//======================================================================================================
document.addEventListener('DOMContentLoaded', () => {
  const F = window.FichaRegistro;
  if (!F) return;
  const tab = (id) => document.getElementById(id);
  F.ligarConsulta(tab('tabela-retiradas-lista'), {
    titulo: (tr, c) => 'Retirada ' + (c[0] ? c[0].textContent.trim() : ''),
    acoes: (tr) => [{
      rotulo: 'Concluir retirada', classe: 'fr-primario',
      fn: (fechar) => { fechar(); processarRetiradaCompleta(tr.dataset.idRetirada); },
    }],
  });
  F.ligarConsulta(tab('tabela-devolucoes-lista'), { titulo: (tr, c) => 'Devolução ' + (c[0] ? c[0].textContent.trim() : '') });
  F.ligarConsulta(tab('tabela-fornecedores-lista'), { titulo: (tr, c) => (c[1] ? c[1].textContent.trim() : 'Fornecedor'), subtitulo: 'Fornecedor' });
  F.ligarConsulta(tab('tabela-requisitantes-lista'), { titulo: (tr, c) => (c[1] ? c[1].textContent.trim() : 'Requisitante'), subtitulo: 'Requisitante' });
  F.ligarConsulta(tab('tabela-kits-lista'), { subtitulo: 'Kit' });
});
