//======================================================================================================
// CADASTROS - Pontos de atendimento e Regioes
// O ponto e a entidade que torna possivel perguntar "quantas vezes ESTE lugar
// deu problema". A regiao e o agrupador geografico usado nos relatorios.
//======================================================================================================
(function () {
  'use strict';

  const api = window.RelatoriosApi;
  const form = window.CadastrosForm;
  const escapar = api.escaparHtml;
  const elemento = (id) => document.getElementById(id);

  let telaAtual = 'pontos';
  let regioes = [];
  let contratos = [];
  let carregado = false;

  //---------------------------------------------------------------- campos
  function camposPonto() {
    return [
      { nome: 'codigo', rotulo: 'Código', max: 50,
        ajuda: 'Deixe em branco para gerar automaticamente (P-0001).' },
      { nome: 'nome', rotulo: 'Nome da base', max: 150, largo: true },
      { nome: 'endereco', rotulo: 'Endereço', obrigatorio: true, max: 255, largo: true },
      { nome: 'complemento', rotulo: 'Complemento', max: 255, largo: true },
      { nome: 'regiao_id', rotulo: 'Região', tipo: 'select',
        opcoes: regioes.map((r) => ({ valor: r.id, texto: r.nome })),
        vazio: regioes.length ? 'Sem região' : 'Cadastre uma região primeiro' },
      { nome: 'contrato_id', rotulo: 'Contrato', tipo: 'select',
        opcoes: contratos.map((c) => ({ valor: c.id, texto: c.nome })),
        vazio: 'Sem contrato (visível para todos)',
        ajuda: 'Define quem enxerga esta base nos relatórios.' },
      { nome: 'link_localizacao', rotulo: 'Link do mapa', max: 512, largo: true },
      { nome: 'latitude', rotulo: 'Latitude', tipo: 'number' },
      { nome: 'longitude', rotulo: 'Longitude', tipo: 'number' },
      { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea', largo: true },
      { nome: 'ativo', rotulo: 'Ativo', tipo: 'checkbox', padrao: 1 },
    ];
  }

  const CAMPOS_REGIAO = [
    { nome: 'nome', rotulo: 'Nome da região', obrigatorio: true, max: 120, largo: true },
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', largo: true },
    { nome: 'ativo', rotulo: 'Ativo', tipo: 'checkbox', padrao: 1 },
  ];

  const COLUNAS_PONTO = [
    { titulo: 'Código', ocultarCard: true,
      valor: (i) => '<strong>' + escapar(i.codigo) + '</strong>'
        + (i.nome ? '<br><small>' + escapar(i.nome) + '</small>' : '') },
    { titulo: 'Endereço', valor: (i) => escapar(i.endereco || '—') },
    { titulo: 'Região', valor: (i) => escapar(i.regiao || '—') },
    { titulo: 'Contrato', valor: (i) => escapar(i.contrato || '—') },
    { titulo: 'Chamados', numerica: true,
      valor: (i) => api.numero(i.total_ocorrencias || 0) },
    { titulo: 'Último', valor: (i) => api.dataCurta(i.ultima_ocorrencia) },
  ];

  const COLUNAS_REGIAO = [
    { titulo: 'Nome', ocultarCard: true,
      valor: (i) => '<strong>' + escapar(i.nome) + '</strong>' },
    { titulo: 'Descrição', valor: (i) => escapar(i.descricao || '—') },
  ];

  //---------------------------------------------------------------- acoes
  async function salvarPonto(dados, registro) {
    if (registro) {
      await api.enviar('/pontos-atendimento/' + registro.id, 'PUT', dados);
      form.feedback('loc-feedback', 'Ponto atualizado.', 'ok');
    } else {
      await api.enviar('/pontos-atendimento', 'POST', dados);
      form.feedback('loc-feedback', 'Ponto cadastrado.', 'ok');
    }
    carregar();
  }

  async function salvarRegiao(dados, registro) {
    // Regiao usa a rota generica de cadastros: e um catalogo simples.
    if (registro) {
      await api.enviar('/cadastros/regioes/' + registro.id, 'PUT', dados);
      form.feedback('loc-feedback', 'Região atualizada.', 'ok');
    } else {
      await api.enviar('/cadastros/regioes', 'POST', dados);
      form.feedback('loc-feedback', 'Região cadastrada.', 'ok');
    }
    await carregarApoio();
    carregar();
  }

  function abrirFormulario(registro) {
    if (telaAtual === 'pontos') {
      form.abrir({
        campos: camposPonto, aoSalvar: salvarPonto, feedback: 'loc-feedback',
        tituloNovo: 'Nova base de atendimento', tituloEdicao: 'Editar base de atendimento',
        tipoContexto: 'base',
      }, registro);
    } else {
      form.abrir({
        campos: CAMPOS_REGIAO, aoSalvar: salvarRegiao, feedback: 'loc-feedback',
        tituloNovo: 'Nova região', tituloEdicao: 'Editar região',
        tipoContexto: 'regiao',
      }, registro);
    }
  }

  async function alternarStatus(item) {
    const caminho = telaAtual === 'pontos'
      ? '/pontos-atendimento/' + item.id : '/cadastros/regioes/' + item.id;
    try {
      await api.enviar(caminho, 'PUT', { ativo: item.ativo ? 0 : 1 });
      form.feedback('loc-feedback', item.ativo ? 'Desativado.' : 'Reativado.', 'ok');
      carregar();
    } catch (erro) {
      form.feedback('loc-feedback', erro.message, 'erro');
    }
  }

  async function remover(item) {
    // Base nao tem DELETE proprio: desativar preserva todo o historico de
    // chamados que aponta para ela, que e justamente o valor do cadastro.
    if (telaAtual === 'pontos') {
      if (!confirm('Desativar a base "' + item.codigo + '"?\n\nO histórico de '
                 + 'chamados é preservado.')) return;
      return alternarStatus(Object.assign({}, item, { ativo: 1 }));
    }
    if (!confirm('Excluir a região "' + item.nome + '"?')) return;
    try {
      const resposta = await api.enviar('/cadastros/regioes/' + item.id, 'DELETE');
      form.feedback('loc-feedback', resposta.mensagem || 'Região removida.', 'ok');
      await carregarApoio();
      carregar();
    } catch (erro) {
      form.feedback('loc-feedback', erro.message, 'erro');
    }
  }

  //---------------------------------------------------------------- carga
  async function carregarApoio() {
    try {
      const dados = await api.buscar('/cadastros/regioes', {}, 'loc-regioes');
      regioes = dados.itens || [];
    } catch (erro) { regioes = []; }
    try {
      const resposta = await fetch(api.urlApi('/contratos'), {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
      contratos = (await resposta.json()).contratos || [];
    } catch (erro) { contratos = []; }
  }

  async function carregar() {
    const alvo = elemento('loc-tabela');
    api.estadoCarregando(alvo);
    try {
      let itens;
      if (telaAtual === 'pontos') {
        itens = await api.buscar('/pontos-atendimento', {
          busca: elemento('loc-busca').value || '', limite: 500, incluir_inativos: 1,
        }, 'loc-lista') || [];
      } else {
        const dados = await api.buscar('/cadastros/regioes',
          { incluir_inativos: 1, busca: elemento('loc-busca').value || '' }, 'loc-lista');
        itens = dados.itens || [];
      }

      form.renderizarLista(alvo, itens,
        telaAtual === 'pontos' ? COLUNAS_PONTO : COLUNAS_REGIAO, {
        aoEditar: abrirFormulario,
        aoAlternar: alternarStatus,
        aoRemover: remover,
        tituloCard: (i) => '<strong>' + escapar(i.codigo || i.nome) + '</strong>',
        vazio: telaAtual === 'pontos'
          ? 'Nenhuma base cadastrada' : 'Nenhuma região cadastrada',
        vazioDetalhe: telaAtual === 'pontos'
          ? 'Bases também são criadas automaticamente quando uma O.S. é aberta num endereço novo.'
          : 'Regiões agrupam bases de atendimento nos relatórios (problemas por região).',
      });
    } catch (erro) {
      api.estadoErro(alvo, erro.message);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const subabas = elemento('loc-subabas');
    if (subabas) {
      subabas.addEventListener('click', (evento) => {
        const botao = evento.target.closest('[data-loc]');
        if (!botao) return;
        subabas.querySelectorAll('.top-tab2').forEach((b) => b.classList.remove('ativo'));
        botao.classList.add('ativo');
        telaAtual = botao.dataset.loc;
        elemento('loc-busca').value = '';
        carregar();
      });
    }

    elemento('loc-novo')?.addEventListener('click', () => abrirFormulario(null));

    let temporizador;
    elemento('loc-busca')?.addEventListener('input', () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(carregar, 350);
    });

    document.querySelector('.tab-btn[data-tab="locais"]')?.addEventListener('click', () => {
      if (carregado) return;
      carregado = true;
      carregarApoio().then(carregar);
    });
  });
})();
