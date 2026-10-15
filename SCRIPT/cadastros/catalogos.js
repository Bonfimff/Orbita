//======================================================================================================
// CADASTROS - Analise Operacional
// Categorias, problemas, causas, solucoes, resultados e tipos de equipamento.
// Toda a mecanica de painel/tabela vem de formulario.js: aqui so ficam a
// definicao dos campos de cada catalogo e as colunas da listagem.
//======================================================================================================
(function () {
  'use strict';

  const api = window.RelatoriosApi;
  const form = window.CadastrosForm;
  const escapar = api.escaparHtml;
  const elemento = (id) => document.getElementById(id);

  let catalogoAtual = 'categorias';
  let categorias = [];
  let solucoes = [];

  const ROTULOS = {
    categorias: 'categoria de problema',
    problemas: 'problema',
    causas: 'causa',
    solucoes: 'solução / procedimento',
    resultados: 'resultado da O.S.',
    'tipos-equipamento': 'tipo de equipamento',
  };

  const TIPOS_CAUSA = ['Desgaste natural', 'Falha de componente', 'Uso indevido',
    'Falta de manutencao', 'Fator externo', 'Instalacao incorreta',
    'Vandalismo', 'Nao identificada'];

  //---------------------------------------------------------------- campos
  const CAMPOS = {
    categorias: () => [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true, max: 120, largo: true },
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', largo: true },
      { nome: 'ordem', rotulo: 'Ordem de exibição', tipo: 'number', min: 0, padrao: 0,
        ajuda: 'Define a posição nas listas de seleção.' },
      { nome: 'ativo', rotulo: 'Ativo', tipo: 'checkbox', padrao: 1,
        ajuda: 'Inativo some das listas de seleção mas o histórico é preservado.' },
    ],
    problemas: () => [
      { nome: 'nome', rotulo: 'Nome do problema', obrigatorio: true, max: 150, largo: true },
      { nome: 'categoria_id', rotulo: 'Categoria', tipo: 'select', obrigatorio: true,
        opcoes: categorias.map((c) => ({ valor: c.id, texto: c.nome })),
        vazio: 'Selecione a categoria...' },
      { nome: 'codigo', rotulo: 'Código', max: 40,
        ajuda: 'Opcional. Código estável, mesmo se o nome mudar.' },
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', largo: true },
      { nome: 'criticidade', rotulo: 'Criticidade', tipo: 'select', padrao: 'Media',
        opcoes: [{ valor: 'Baixa', texto: 'Baixa' }, { valor: 'Media', texto: 'Média' },
                 { valor: 'Alta', texto: 'Alta' }], vazio: 'Média' },
      { nome: 'prazo_alvo_horas', rotulo: 'Prazo alvo (horas)', tipo: 'number', min: 1 },
      { nome: 'janela_reincidencia_dias', rotulo: 'Janela de reincidência (dias)',
        tipo: 'number', min: 1,
        ajuda: 'Se o problema voltar neste prazo após o encerramento, o sistema sugere reincidência. Padrão: 30 dias.' },
      { nome: 'solucao_padrao_id', rotulo: 'Solução sugerida', tipo: 'select',
        opcoes: solucoes.map((s) => ({ valor: s.id, texto: s.nome })),
        vazio: 'Nenhuma', ajuda: 'Apenas sugestão de preenchimento. A solução continua sendo escolhida por ocorrência.' },
      { nome: 'ativo', rotulo: 'Ativo', tipo: 'checkbox', padrao: 1 },
    ],
    causas: () => [
      { nome: 'nome', rotulo: 'Nome da causa', obrigatorio: true, max: 150, largo: true },
      { nome: 'categoria_causa', rotulo: 'Tipo da causa', tipo: 'select',
        padrao: 'Nao identificada',
        opcoes: TIPOS_CAUSA.map((t) => ({ valor: t, texto: t })), vazio: 'Não identificada',
        ajuda: 'Agrupador fixo usado nos gráficos executivos.' },
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', largo: true },
      { nome: 'ativo', rotulo: 'Ativo', tipo: 'checkbox', padrao: 1 },
    ],
    solucoes: () => [
      { nome: 'nome', rotulo: 'Nome da solução / procedimento', obrigatorio: true,
        max: 150, largo: true },
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', largo: true },
      { nome: 'ativo', rotulo: 'Ativo', tipo: 'checkbox', padrao: 1 },
    ],
    resultados: () => [
      { nome: 'nome', rotulo: 'Nome do resultado', obrigatorio: true, max: 120, largo: true,
        placeholder: 'Ex.: Resolvido, Necessita retorno...' },
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', largo: true },
      { nome: 'ordem', rotulo: 'Ordem de exibição', tipo: 'number', min: 0, padrao: 0 },
      { nome: 'considera_resolvido', rotulo: 'Conta como resolvido nos indicadores',
        tipo: 'checkbox', padrao: 1 },
      { nome: 'encerra_os', rotulo: 'Permite encerrar a O.S.', tipo: 'checkbox', padrao: 1 },
      { nome: 'exige_retorno', rotulo: 'Exige retorno ao local', tipo: 'checkbox', padrao: 0 },
      { nome: 'ativo', rotulo: 'Ativo', tipo: 'checkbox', padrao: 1 },
    ],
    'tipos-equipamento': () => [
      { nome: 'nome', rotulo: 'Nome do tipo', obrigatorio: true, max: 120, largo: true },
      { nome: 'categoria', rotulo: 'Categoria', max: 120 },
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', largo: true },
      { nome: 'ativo', rotulo: 'Ativo', tipo: 'checkbox', padrao: 1 },
    ],
  };

  //--------------------------------------------------------------- colunas
  function colunas() {
    const base = [{ titulo: 'Nome', ocultarCard: true,
      valor: (i) => '<strong>' + escapar(i.nome) + '</strong>'
        + (i.ativo ? '' : ' <span class="rel-tag">inativo</span>') }];

    if (catalogoAtual === 'problemas') {
      base.push(
        { titulo: 'Categoria', valor: (i) => escapar(i.categoria_nome || '—') },
        { titulo: 'Criticidade', valor: (i) => escapar(i.criticidade || '—') },
        { titulo: 'Janela', valor: (i) => (i.janela_reincidencia_dias || 30) + ' d',
          numerica: true },
        { titulo: 'Ocorrências', valor: (i) => api.numero(i.total_ocorrencias || 0),
          numerica: true });
    } else if (catalogoAtual === 'categorias') {
      base.push(
        { titulo: 'Problemas', valor: (i) => api.numero(i.total_problemas || 0),
          numerica: true },
        { titulo: 'Ocorrências', valor: (i) => api.numero(i.total_ocorrencias || 0),
          numerica: true });
    } else if (catalogoAtual === 'causas') {
      base.push({ titulo: 'Tipo', valor: (i) => escapar(i.categoria_causa || '—') });
    } else if (catalogoAtual === 'resultados') {
      base.push(
        { titulo: 'Resolvido?', valor: (i) => i.considera_resolvido ? 'Sim' : 'Não' },
        { titulo: 'Encerra O.S.?', valor: (i) => i.encerra_os ? 'Sim' : 'Não' },
        { titulo: 'Exige retorno?', valor: (i) => i.exige_retorno ? 'Sim' : 'Não' });
    } else if (catalogoAtual === 'tipos-equipamento') {
      base.push(
        { titulo: 'Categoria', valor: (i) => escapar(i.categoria || '—') },
        { titulo: 'Equipamentos', valor: (i) => api.numero(i.total_equipamentos || 0),
          numerica: true });
    }

    base.push({ titulo: 'Criado por', valor: (i) => escapar(i.criado_por_nome || '—') });
    return base;
  }

  //--------------------------------------------------------------- acoes
  async function salvar(dados, registro) {
    if (registro) {
      await api.enviar('/cadastros/' + catalogoAtual + '/' + registro.id, 'PUT', dados);
      form.feedback('cad-feedback', 'Registro atualizado.', 'ok');
    } else {
      await api.enviar('/cadastros/' + catalogoAtual, 'POST', dados);
      form.feedback('cad-feedback',
        ROTULOS[catalogoAtual].charAt(0).toUpperCase()
        + ROTULOS[catalogoAtual].slice(1) + ' cadastrado(a).', 'ok');
    }
    await carregarApoio();
    carregar();
  }

  function abrirFormulario(registro) {
    form.abrir({
      campos: CAMPOS[catalogoAtual],
      aoSalvar: salvar,
      feedback: 'cad-feedback',
      tituloNovo: 'Novo: ' + ROTULOS[catalogoAtual],
      tituloEdicao: 'Editar ' + ROTULOS[catalogoAtual],
    }, registro);
  }

  async function alternarStatus(item) {
    try {
      await api.enviar('/cadastros/' + catalogoAtual + '/' + item.id, 'PUT',
                       { ativo: item.ativo ? 0 : 1 });
      form.feedback('cad-feedback',
        item.ativo ? 'Registro desativado.' : 'Registro reativado.', 'ok');
      carregar();
    } catch (erro) {
      form.feedback('cad-feedback', erro.message, 'erro');
    }
  }

  async function remover(item) {
    if (!confirm('Excluir "' + item.nome + '"?\n\nSe já houver histórico usando '
               + 'este registro, ele será apenas desativado.')) return;
    try {
      const resposta = await api.enviar('/cadastros/' + catalogoAtual + '/' + item.id,
                                        'DELETE');
      form.feedback('cad-feedback', resposta.mensagem || 'Registro removido.', 'ok');
      await carregarApoio();
      carregar();
    } catch (erro) {
      form.feedback('cad-feedback', erro.message, 'erro');
    }
  }

  //------------------------------------------------------------- carga
  async function carregarApoio() {
    // Categorias e soluções alimentam os selects do formulário de problema.
    try {
      const dados = await api.buscar('/cadastros/categorias', {}, 'apoio-cat');
      categorias = dados.itens || [];
    } catch (erro) { categorias = []; }
    try {
      const dados = await api.buscar('/cadastros/solucoes', {}, 'apoio-sol');
      solucoes = dados.itens || [];
    } catch (erro) { solucoes = []; }

    const filtro = elemento('cad-filtro-categoria');
    if (filtro) {
      const atual = filtro.value;
      filtro.innerHTML = '<option value="">Todas as categorias</option>'
        + categorias.map((c) => '<option value="' + c.id + '">'
            + escapar(c.nome) + '</option>').join('');
      filtro.value = atual;
    }
  }

  async function carregar() {
    const alvo = elemento('cad-tabela');
    api.estadoCarregando(alvo);
    try {
      const dados = await api.buscar('/cadastros/' + catalogoAtual, {
        incluir_inativos: elemento('cad-incluir-inativos').checked ? 1 : '',
        busca: elemento('cad-busca').value || '',
        categoria_id: catalogoAtual === 'problemas'
          ? (elemento('cad-filtro-categoria').value || '') : '',
      }, 'cad-lista');

      form.renderizarLista(alvo, dados.itens, colunas(), {
        aoEditar: abrirFormulario,
        aoAlternar: alternarStatus,
        aoRemover: remover,
        tituloCard: (i) => '<strong>' + escapar(i.nome) + '</strong>',
        vazio: 'Nenhum(a) ' + ROTULOS[catalogoAtual] + ' cadastrado(a)',
        vazioDetalhe: catalogoAtual === 'problemas' && !categorias.length
          ? 'Cadastre primeiro uma Categoria — todo problema pertence a uma.'
          : 'Use o botão "+ Novo" para começar. Este catálogo é o vocabulário da sua operação.',
      });
    } catch (erro) {
      api.estadoErro(alvo, erro.message);
    }
  }

  //------------------------------------------------------- inicializacao
  document.addEventListener('DOMContentLoaded', function () {
    const subabas = elemento('cad-subabas');
    if (subabas) {
      subabas.addEventListener('change', () => {
        catalogoAtual = subabas.value;
        elemento('cad-filtro-categoria').hidden = catalogoAtual !== 'problemas';
        elemento('cad-busca').value = '';
        carregar();
      });
    }

    elemento('cad-novo')?.addEventListener('click', () => abrirFormulario(null));
    elemento('cad-incluir-inativos')?.addEventListener('change', carregar);
    elemento('cad-filtro-categoria')?.addEventListener('change', carregar);

    // Busca com atraso: consultar a cada tecla geraria uma requisição por
    // caractere digitado.
    let temporizador;
    elemento('cad-busca')?.addEventListener('input', () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(carregar, 350);
    });

    carregarApoio().then(carregar);
  });

  window.CadastrosCatalogos = { recarregar: carregar };
})();
