//======================================================================================================
// CADASTROS - Equipamentos
// Equipamento NUNCA e obrigatorio numa O.S.: so faz sentido cadastrar os ativos
// que a operacao realmente identifica em campo.
//======================================================================================================
(function () {
  'use strict';

  const api = window.RelatoriosApi;
  const form = window.CadastrosForm;
  const escapar = api.escaparHtml;
  const elemento = (id) => document.getElementById(id);

  let tipos = [];
  let pontos = [];
  let contratos = [];
  let carregado = false;

  const STATUS = ['Ativo', 'Inativo', 'Em Manutencao', 'Descartado'];

  function campos() {
    return [
      { nome: 'codigo', rotulo: 'Código', max: 60,
        ajuda: 'Deixe em branco para gerar automaticamente (EQ-0001).' },
      { nome: 'nome', rotulo: 'Nome / descrição curta', max: 150, largo: true },
      { nome: 'tipo_equipamento_id', rotulo: 'Tipo de equipamento', tipo: 'select',
        opcoes: tipos.map((t) => ({ valor: t.id, texto: t.nome })),
        vazio: tipos.length ? 'Selecione...' : 'Cadastre um tipo primeiro' },
      { nome: 'fabricante', rotulo: 'Fabricante', max: 120 },
      { nome: 'modelo', rotulo: 'Modelo', max: 120 },
      { nome: 'numero_serie', rotulo: 'Número de série', max: 120 },
      { nome: 'patrimonio', rotulo: 'Patrimônio', max: 120 },
      { nome: 'ponto_id', rotulo: 'Ponto / local', tipo: 'select',
        opcoes: pontos.map((p) => ({ valor: p.id,
          texto: p.codigo + ' · ' + (p.nome || p.endereco || '') })),
        vazio: 'Sem local definido',
        ajuda: 'Mudar o ponto abre um novo período no histórico de alocação, o passado não é reescrito.' },
      { nome: 'contrato_id', rotulo: 'Contrato', tipo: 'select',
        opcoes: contratos.map((c) => ({ valor: c.id, texto: c.nome })),
        vazio: 'Sem contrato (visível para todos)' },
      { nome: 'data_instalacao', rotulo: 'Data de instalação', tipo: 'date' },
      { nome: 'status', rotulo: 'Status', tipo: 'select', padrao: 'Ativo',
        opcoes: STATUS.map((s) => ({ valor: s, texto: s.replace('Manutencao', 'Manutenção') })),
        vazio: 'Ativo' },
      { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea', largo: true },
      { nome: 'ativo', rotulo: 'Ativo', tipo: 'checkbox', padrao: 1 },
    ];
  }

  const COLUNAS = [
    { titulo: 'Código', ocultarCard: true,
      valor: (i) => '<strong>' + escapar(i.codigo) + '</strong>'
        + (i.nome ? '<br><small>' + escapar(i.nome) + '</small>' : '') },
    { titulo: 'Tipo', valor: (i) => escapar(i.tipo_nome || '-') },
    { titulo: 'Modelo', valor: (i) => escapar(i.modelo || '-') },
    { titulo: 'Série', valor: (i) => escapar(i.numero_serie || '-') },
    { titulo: 'Ponto', valor: (i) => escapar(i.ponto_codigo || '-') },
    { titulo: 'Status', valor: (i) => escapar((i.status || '').replace('Manutencao', 'Manutenção')) },
    { titulo: 'Ocorrências', numerica: true,
      valor: (i) => api.numero(i.total_ocorrencias || 0) },
  ];

  async function salvar(dados, registro) {
    if (registro) {
      await api.enviar('/equipamentos/' + registro.id, 'PUT', dados);
      form.feedback('eq-feedback', 'Equipamento atualizado.', 'ok');
    } else {
      await api.enviar('/equipamentos', 'POST', dados);
      form.feedback('eq-feedback', 'Equipamento cadastrado.', 'ok');
    }
    carregar();
  }

  async function abrirFormulario(registro) {
    let completo = registro;
    if (registro) {
      // Recarrega para trazer os vínculos e o histórico de alocação, que a
      // listagem não devolve.
      try {
        completo = await api.buscar('/equipamentos/' + registro.id, {}, 'eq-item');
      } catch (erro) { completo = registro; }
    }
    form.abrir({
      campos: campos,
      aoSalvar: salvar,
      feedback: 'eq-feedback',
      tituloNovo: 'Novo equipamento',
      tituloEdicao: 'Editar equipamento',
      tipoContexto: 'equipamento',
    }, completo);
  }

  async function alternarStatus(item) {
    try {
      await api.enviar('/equipamentos/' + item.id, 'PUT', { ativo: item.ativo ? 0 : 1 });
      form.feedback('eq-feedback',
        item.ativo ? 'Equipamento desativado.' : 'Equipamento reativado.', 'ok');
      carregar();
    } catch (erro) {
      form.feedback('eq-feedback', erro.message, 'erro');
    }
  }

  async function remover(item) {
    if (!confirm('Excluir o equipamento "' + item.codigo + '"?\n\nSe houver '
               + 'ocorrências registradas, ele será apenas desativado.')) return;
    try {
      const resposta = await api.enviar('/equipamentos/' + item.id, 'DELETE');
      form.feedback('eq-feedback', resposta.mensagem || 'Equipamento removido.', 'ok');
      carregar();
    } catch (erro) {
      form.feedback('eq-feedback', erro.message, 'erro');
    }
  }

  async function carregarApoio() {
    try {
      const dados = await api.buscar('/cadastros/tipos-equipamento', {}, 'eq-tipos');
      tipos = dados.itens || [];
    } catch (erro) { tipos = []; }
    try {
      pontos = await api.buscar('/pontos-atendimento', { limite: 500 }, 'eq-pontos') || [];
    } catch (erro) { pontos = []; }
    try {
      const resposta = await fetch(api.urlApi('/contratos'), {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
      const corpo = await resposta.json();
      contratos = corpo.contratos || [];
    } catch (erro) { contratos = []; }

    const filtroTipo = elemento('eq-filtro-tipo');
    if (filtroTipo) {
      filtroTipo.innerHTML = '<option value="">Todos os tipos</option>'
        + tipos.map((t) => '<option value="' + t.id + '">' + escapar(t.nome)
            + '</option>').join('');
    }
    const filtroPonto = elemento('eq-filtro-ponto');
    if (filtroPonto) {
      filtroPonto.innerHTML = '<option value="">Todos os pontos</option>'
        + pontos.map((p) => '<option value="' + p.id + '">' + escapar(p.codigo)
            + '</option>').join('');
    }
  }

  async function carregar() {
    const alvo = elemento('eq-tabela');
    api.estadoCarregando(alvo);
    try {
      const dados = await api.buscar('/equipamentos', {
        busca: elemento('eq-busca').value || '',
        tipo_id: elemento('eq-filtro-tipo').value || '',
        ponto_id: elemento('eq-filtro-ponto').value || '',
        incluir_inativos: elemento('eq-incluir-inativos').checked ? 1 : '',
        limite: 200,
      }, 'eq-lista');

      form.renderizarLista(alvo, dados.itens, COLUNAS, {
        aoEditar: abrirFormulario,
        aoAlternar: alternarStatus,
        aoRemover: remover,
        tituloCard: (i) => '<strong>' + escapar(i.codigo) + '</strong> '
          + escapar(i.nome || ''),
        vazio: 'Nenhum equipamento cadastrado',
        vazioDetalhe: tipos.length
          ? 'Use "+ Novo equipamento" para cadastrar os ativos identificáveis em campo.'
          : 'Cadastre primeiro um Tipo de equipamento em Cadastro de Parâmetros.',
      });
    } catch (erro) {
      api.estadoErro(alvo, erro.message);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    elemento('eq-novo')?.addEventListener('click', () => abrirFormulario(null));
    elemento('eq-incluir-inativos')?.addEventListener('change', carregar);
    elemento('eq-filtro-tipo')?.addEventListener('change', carregar);
    elemento('eq-filtro-ponto')?.addEventListener('change', carregar);

    let temporizador;
    elemento('eq-busca')?.addEventListener('input', () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(carregar, 350);
    });

    // Carga sob demanda: quem nunca abre a aba de Equipamentos não paga por ela.
    document.querySelector('.tab-btn[data-tab="ativos"]')?.addEventListener('click', () => {
      if (carregado) return;
      carregado = true;
      carregarApoio().then(carregar);
    });
  });
})();
