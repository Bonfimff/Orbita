//======================================================================================================
// RELATORIOS - indicadores, graficos, rankings e reincidencia
// Cada aba carrega sob demanda e so recarrega quando o filtro muda ou quando o
// usuario volta para ela - evita disparar seis consultas de uma vez na abertura
// da pagina, das quais o usuario ve apenas uma.
//======================================================================================================
(function () {
  'use strict';

  const api = window.RelatoriosApi;
  const graficos = window.RelatoriosGraficos;
  const filtros = window.RelatoriosFiltros;
  const escapar = api.escaparHtml;

  const elemento = (id) => document.getElementById(id);
  const paginas = { pontos: 1, problemas: 1, reincidencia: 1 };
  let granularidade = 'mes';
  const carregado = {};

  //================================================================== KPIs
  const ICONES = {
    chamados: '<path d="M4 5h16v11H7l-3 3z"/>',
    aberto: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5"/>',
    andamento: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    encerrado: '<circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    reincidencia: '<path d="M4 9a8 8 0 0 1 13-3l3 3"/><path d="M20 15a8 8 0 0 1-13 3l-3-3"/>',
    problema: '<path d="M12 4 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    relogio: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
    ponto: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  };

  function svgIcone(nome) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      + 'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" '
      + 'aria-hidden="true">' + (ICONES[nome] || ICONES.chamados) + '</svg>';
  }

  function cartao(config) {
    return '<div class="painel-card rel-kpi' + (config.acao ? ' rel-kpi-clicavel' : '') + '"'
      + (config.acao ? ' data-acao="' + config.acao + '" role="button" tabindex="0"' : '')
      + '>'
      + '<span class="painel-card-icone rel-kpi-icone rel-kpi-' + (config.tom || 'neutro')
      + '">' + svgIcone(config.icone) + '</span>'
      + '<span class="painel-card-label">' + escapar(config.rotulo) + '</span>'
      + '<strong class="painel-card-valor">' + config.valor + '</strong>'
      + (config.detalhe ? '<small class="rel-kpi-detalhe">' + escapar(config.detalhe)
         + '</small>' : '')
      + '</div>';
  }

  async function carregarResumo() {
    const alvo = elemento('rel-kpis');
    api.estadoCarregando(alvo, 'Calculando indicadores...');
    try {
      const dados = await api.buscar('/analitico/resumo', filtros.parametros(), 'resumo');

      alvo.innerHTML = [
        cartao({ rotulo: 'Total de chamados', valor: api.numero(dados.total_chamados),
                 icone: 'chamados', tom: 'primario',
                 detalhe: api.numero(dados.total_ocorrencias) + ' ocorrência(s)' }),
        cartao({ rotulo: 'Abertos', valor: api.numero(dados.abertos), icone: 'aberto',
                 tom: 'aviso', acao: 'status:Aberta' }),
        cartao({ rotulo: 'Em andamento', valor: api.numero(dados.em_andamento),
                 icone: 'andamento', tom: 'neutro' }),
        cartao({ rotulo: 'Encerrados', valor: api.numero(dados.encerrados),
                 icone: 'encerrado', tom: 'sucesso', acao: 'status:Finalizada' }),
        cartao({ rotulo: 'Pontos com reincidência',
                 valor: api.numero(dados.pontos_reincidentes), icone: 'reincidencia',
                 tom: dados.pontos_reincidentes > 0 ? 'erro' : 'neutro',
                 acao: 'aba:reincidencia' }),
        cartao({ rotulo: 'Problemas recorrentes',
                 valor: api.numero(dados.problemas_recorrentes), icone: 'problema',
                 tom: 'neutro', acao: 'aba:ranking-problemas' }),
        cartao({ rotulo: 'Tempo médio de resolução',
                 valor: api.horas(dados.horas_medias_resolucao), icone: 'relogio',
                 tom: 'neutro',
                 detalhe: dados.os_com_fechamento
                   ? 'base: ' + api.numero(dados.os_com_fechamento) + ' O.S. encerrada(s)'
                   : 'sem O.S. encerrada no período' }),
        cartao({ rotulo: 'Tempo médio até despacho',
                 valor: api.horas(dados.horas_medias_despacho), icone: 'relogio',
                 tom: 'neutro' }),
      ].join('');

      // Ocorrência sem problema classificado é contada no volume mas não pode
      // entrar nos rankings por problema. Avisar é mais honesto que omitir.
      // Contexto Operacional (painel lateral) reaproveita este mesmo resumo -
      // ja respeita os filtros atuais e evita uma segunda consulta identica.
      document.dispatchEvent(new CustomEvent('orbita:resumo-relatorio', { detail: dados }));

      const aviso = elemento('rel-aviso-classificacao');
      if (aviso) {
        const pendentes = Number(dados.sem_classificacao) || 0;
        aviso.hidden = pendentes === 0;
        if (pendentes) {
          aviso.innerHTML = '<strong>' + api.numero(pendentes)
            + ' ocorrência(s) sem problema classificado.</strong> '
            + 'Elas contam no volume total, mas ficam de fora dos rankings por '
            + 'problema. Classifique-as na O.S. para que entrem na análise.';
        }
      }

      if (dados.periodo && dados.periodo.ajustado) {
        alvo.insertAdjacentHTML('beforeend',
          '<div class="rel-aviso rel-aviso-inline">Período limitado a 24 meses.</div>');
      }
    } catch (erro) {
      api.estadoErro(alvo, erro.message);
    }
  }

  //=============================================================== GRAFICOS
  async function carregarGraficos() {
    const alvoEvolucao = elemento('rel-gr-evolucao');
    const alvoReincidencia = elemento('rel-gr-reincidencias');
    api.estadoCarregando(alvoEvolucao);
    api.estadoCarregando(alvoReincidencia);
    try {
      const dados = await api.buscar('/analitico/evolucao',
        filtros.parametros({ granularidade: granularidade }), 'evolucao');
      graficos.linhas(alvoEvolucao, dados.serie, [
        { campo: 'aberturas', nome: 'Aberturas', cor: graficos.CORES[0] },
        { campo: 'encerramentos', nome: 'Encerramentos', cor: graficos.CORES[1] },
      ]);
      graficos.linhas(alvoReincidencia, dados.serie, [
        { campo: 'reincidencias', nome: 'Reincidências', cor: graficos.CORES[5] },
      ]);
    } catch (erro) {
      api.estadoErro(alvoEvolucao, erro.message);
      api.estadoErro(alvoReincidencia, erro.message);
    }

    const alvoProblemas = elemento('rel-gr-problemas');
    api.estadoCarregando(alvoProblemas);
    try {
      const dados = await api.buscar('/analitico/ranking-problemas',
        filtros.parametros({ limite: 8 }), 'gr-problemas');
      graficos.barras(alvoProblemas, (dados.itens || []).map((item) => ({
        id: item.problema_id, rotulo: item.problema, valor: item.ocorrencias,
        detalhe: item.pontos_afetados + ' ponto(s)',
      })), { acao: 'problema' });
    } catch (erro) {
      api.estadoErro(alvoProblemas, erro.message);
    }

    const alvoPontos = elemento('rel-gr-pontos');
    api.estadoCarregando(alvoPontos);
    try {
      const dados = await api.buscar('/analitico/ranking-pontos',
        filtros.parametros({ limite: 8 }), 'gr-pontos');
      graficos.barras(alvoPontos, (dados.itens || []).map((item) => ({
        id: item.ponto_id, rotulo: item.codigo + ' — ' + (item.nome || item.endereco || ''),
        valor: item.ocorrencias, detalhe: item.problema_frequente || '',
      })), { acao: 'ponto' });
    } catch (erro) {
      api.estadoErro(alvoPontos, erro.message);
    }

    const alvoCategorias = elemento('rel-gr-categorias');
    api.estadoCarregando(alvoCategorias);
    try {
      const dados = await api.buscar('/analitico/categorias', filtros.parametros(), 'categorias');
      graficos.rosca(alvoCategorias, (dados || []).map((item) => ({
        rotulo: item.categoria, valor: item.ocorrencias,
      })));
    } catch (erro) {
      api.estadoErro(alvoCategorias, erro.message);
    }
  }

  //=============================================== TABELA / CARDS RESPONSIVOS
  // Em celular a mesma fonte de dados vira lista de cards: tabela de 7 colunas
  // com rolagem lateral e inutilizavel com o polegar.
  function renderizarColecao(alvo, itens, colunas, opcoes) {
    const config = opcoes || {};
    if (!itens || !itens.length) {
      return api.estadoVazio(alvo, config.vazio || 'Nenhum resultado no período',
        config.vazioDetalhe);
    }

    const clicavel = config.acao ? ' rel-linha-clicavel' : '';
    const atributos = (item) => config.acao
      ? ' data-acao="' + config.acao + '" data-id="' + escapar(config.id(item)) + '"'
      : '';

    const tabela = '<table class="rel-tabela"><thead><tr>'
      + colunas.map((c) => '<th' + (c.numerica ? ' class="rel-num"' : '') + '>'
          + escapar(c.titulo) + '</th>').join('')
      + '</tr></thead><tbody>'
      + itens.map((item) => '<tr class="' + clicavel.trim() + '"' + atributos(item) + '>'
          + colunas.map((c) => '<td' + (c.numerica ? ' class="rel-num"' : '') + '>'
              + c.valor(item) + '</td>').join('')
          + '</tr>').join('')
      + '</tbody></table>';

    const cards = '<ul class="rel-cards">'
      + itens.map((item) => '<li class="rel-card"' + atributos(item) + '>'
          + '<div class="rel-card-topo">'
          + '<span class="rel-card-titulo">' + config.tituloCard(item) + '</span>'
          + '<strong class="rel-card-destaque">' + config.destaqueCard(item) + '</strong>'
          + '</div>'
          + '<dl class="rel-card-dados">'
          + colunas.filter((c) => !c.ocultarCard)
              .map((c) => '<div><dt>' + escapar(c.titulo) + '</dt><dd>'
                + c.valor(item) + '</dd></div>').join('')
          + '</dl></li>').join('')
      + '</ul>';

    alvo.innerHTML = '<div class="rel-so-desktop">' + tabela + '</div>'
      + '<div class="rel-so-celular">' + cards + '</div>';
  }

  function renderizarPaginacao(alvo, total, pagina, limite, aoTrocar) {
    if (!alvo) return;
    const paginas_ = Math.ceil((total || 0) / limite);
    if (paginas_ <= 1) { alvo.innerHTML = ''; return; }
    alvo.innerHTML =
      '<button type="button" class="rel-btn rel-btn-secundario" '
      + (pagina <= 1 ? 'disabled' : '') + ' data-ir="anterior">Anterior</button>'
      + '<span>Página ' + pagina + ' de ' + paginas_ + ' · '
      + api.numero(total) + ' resultado(s)</span>'
      + '<button type="button" class="rel-btn rel-btn-secundario" '
      + (pagina >= paginas_ ? 'disabled' : '') + ' data-ir="proxima">Próxima</button>';

    alvo.querySelectorAll('[data-ir]').forEach((botao) => {
      botao.addEventListener('click', () => {
        aoTrocar(botao.dataset.ir === 'proxima' ? pagina + 1 : pagina - 1);
      });
    });
  }

  //======================================================= RANKING DE PONTOS
  async function carregarRankingPontos() {
    const alvo = elemento('rel-tabela-pontos');
    api.estadoCarregando(alvo);
    try {
      const dados = await api.buscar('/analitico/ranking-pontos',
        filtros.parametros({ limite: 20, pagina: paginas.pontos }), 'rk-pontos');

      renderizarColecao(alvo, dados.itens, [
        { titulo: '#', valor: (i) => i.posicao, numerica: true, ocultarCard: true },
        { titulo: 'Ponto', valor: (i) => '<strong>' + escapar(i.codigo) + '</strong><br>'
            + '<small>' + escapar(i.nome || i.endereco || '') + '</small>', ocultarCard: true },
        { titulo: 'Base / Região',
          valor: (i) => escapar(i.regiao || i.base_id || '—') },
        { titulo: 'Contrato', valor: (i) => escapar(i.contrato || '—') },
        { titulo: 'Chamados', valor: (i) => api.numero(i.ocorrencias), numerica: true },
        { titulo: 'Problema mais frequente',
          valor: (i) => escapar(i.problema_frequente || '— não classificado —') },
        { titulo: 'Última ocorrência', valor: (i) => api.dataCurta(i.ultima_ocorrencia) },
        { titulo: 'Índice de reincidência',
          valor: (i) => api.percentual(i.indice_reincidencia), numerica: true },
      ], {
        acao: 'ponto', id: (i) => i.ponto_id,
        tituloCard: (i) => '<b>' + i.posicao + 'º</b> ' + escapar(i.codigo),
        destaqueCard: (i) => api.numero(i.ocorrencias),
        vazio: 'Nenhum chamado com ponto identificado no período',
        vazioDetalhe: 'Ajuste o período ou verifique se as O.S. têm ponto vinculado.',
      });

      renderizarPaginacao(elemento('rel-paginacao-pontos'), dados.total,
        dados.pagina, dados.limite, (nova) => {
          paginas.pontos = nova; carregarRankingPontos();
        });
    } catch (erro) {
      api.estadoErro(alvo, erro.message);
    }
  }

  //==================================================== RANKING DE PROBLEMAS
  async function carregarRankingProblemas() {
    const alvo = elemento('rel-tabela-problemas');
    api.estadoCarregando(alvo);
    try {
      const dados = await api.buscar('/analitico/ranking-problemas',
        filtros.parametros({ limite: 20, pagina: paginas.problemas }), 'rk-problemas');

      renderizarColecao(alvo, dados.itens, [
        { titulo: '#', valor: (i) => i.posicao, numerica: true, ocultarCard: true },
        { titulo: 'Problema', valor: (i) => escapar(i.problema), ocultarCard: true },
        { titulo: 'Categoria', valor: (i) => escapar(i.categoria || '—') },
        { titulo: 'Criticidade', valor: (i) => escapar(i.criticidade || '—') },
        { titulo: 'Ocorrências', valor: (i) => api.numero(i.ocorrencias), numerica: true },
        { titulo: '% do total', valor: (i) => api.percentual(i.percentual), numerica: true },
        { titulo: 'Pontos afetados', valor: (i) => api.numero(i.pontos_afetados), numerica: true },
        { titulo: 'Última ocorrência', valor: (i) => api.dataCurta(i.ultima_ocorrencia) },
      ], {
        acao: 'problema', id: (i) => i.problema_id,
        tituloCard: (i) => '<b>' + i.posicao + 'º</b> ' + escapar(i.problema),
        destaqueCard: (i) => api.numero(i.ocorrencias),
        vazio: 'Nenhum problema classificado no período',
        vazioDetalhe: 'Cadastre problemas em Catálogos e classifique as O.S. para ver este ranking.',
      });

      const naoClassificadas = Number(dados.nao_classificadas) || 0;
      if (naoClassificadas) {
        alvo.insertAdjacentHTML('afterbegin',
          '<div class="rel-aviso rel-aviso-inline">' + api.numero(naoClassificadas)
          + ' ocorrência(s) sem problema classificado ficaram fora deste ranking.</div>');
      }

      renderizarPaginacao(elemento('rel-paginacao-problemas'), dados.total_classificadas,
        dados.pagina, dados.limite, (nova) => {
          paginas.problemas = nova; carregarRankingProblemas();
        });
    } catch (erro) {
      api.estadoErro(alvo, erro.message);
    }
  }

  //============================================================ REINCIDENCIA
  async function carregarReincidencia() {
    const alvo = elemento('rel-tabela-reincidencia');
    api.estadoCarregando(alvo);
    try {
      const dados = await api.buscar('/analitico/reincidencias',
        filtros.parametros({ limite: 20, pagina: paginas.reincidencia }), 'reincidencia');

      renderizarColecao(alvo, dados.itens, [
        { titulo: 'Ponto', valor: (i) => '<strong>' + escapar(i.codigo) + '</strong><br>'
            + '<small>' + escapar(i.ponto_nome || i.endereco || '') + '</small>',
          ocultarCard: true },
        { titulo: 'Problema', valor: (i) => escapar(i.problema)
            + (i.cronico ? ' <span class="rel-tag rel-tag-erro">crônico</span>' : ''),
          ocultarCard: true },
        { titulo: 'Categoria', valor: (i) => escapar(i.categoria || '—') },
        { titulo: 'Ocorrências', valor: (i) => api.numero(i.ocorrencias), numerica: true },
        { titulo: 'Primeira', valor: (i) => api.dataCurta(i.primeira_ocorrencia) },
        { titulo: 'Última', valor: (i) => api.dataCurta(i.ultima_ocorrencia) },
        { titulo: 'Intervalo médio', valor: (i) => api.dias(i.intervalo_medio_dias),
          numerica: true },
      ], {
        acao: 'ponto', id: (i) => i.ponto_id,
        tituloCard: (i) => escapar(i.codigo) + ' · ' + escapar(i.problema)
          + (i.cronico ? ' <span class="rel-tag rel-tag-erro">crônico</span>' : ''),
        destaqueCard: (i) => api.numero(i.ocorrencias) + '×',
        vazio: 'Nenhuma reincidência no período',
        vazioDetalhe: 'Reincidência = mesmo ponto e mesmo problema mais de uma vez.',
      });

      renderizarPaginacao(elemento('rel-paginacao-reincidencia'), dados.total,
        dados.pagina, dados.limite, (nova) => {
          paginas.reincidencia = nova; carregarReincidencia();
        });
    } catch (erro) {
      api.estadoErro(alvo, erro.message);
    }

    carregarSugestoes();
  }

  async function carregarSugestoes() {
    const alvo = elemento('rel-sugestoes');
    if (!alvo) return;
    api.estadoCarregando(alvo);
    try {
      const itens = await api.buscar('/reincidencias/pendentes', {}, 'sugestoes');
      if (!itens || !itens.length) {
        return api.estadoVazio(alvo, 'Nenhuma sugestão pendente',
          'O sistema avisa aqui quando detectar um problema que voltou no mesmo ponto.');
      }
      alvo.innerHTML = '<ul class="rel-sugestoes">' + itens.map((item) =>
        '<li class="rel-sugestao" data-vinculo="' + item.id + '">'
        + '<div class="rel-sugestao-texto">'
        + '<strong>' + escapar(item.ponto_codigo || 'Ponto') + ' · '
        + escapar(item.problema || 'Problema') + '</strong>'
        + '<small>' + escapar(item.os_atual) + ' pode ser reincidência de '
        + escapar(item.os_origem)
        + (item.intervalo_dias !== null && item.intervalo_dias !== undefined
           ? ' — ' + api.dias(item.intervalo_dias) + ' depois do encerramento' : '')
        + '</small></div>'
        + '<div class="rel-sugestao-acoes">'
        + '<button type="button" class="rel-btn rel-btn-primario" data-decisao="Confirmada">Confirmar</button>'
        + '<button type="button" class="rel-btn rel-btn-secundario" data-decisao="Descartada">Descartar</button>'
        + '</div></li>').join('') + '</ul>';

      alvo.querySelectorAll('[data-decisao]').forEach((botao) => {
        botao.addEventListener('click', async () => {
          const item = botao.closest('.rel-sugestao');
          const decisao = botao.dataset.decisao;
          let justificativa = null;
          if (decisao === 'Descartada') {
            justificativa = window.prompt(
              'Por que esta sugestão não é uma reincidência?');
            // Descarte sem justificativa é recusado pelo backend; abortar aqui
            // evita uma ida à API só para receber o erro de volta.
            if (!justificativa || !justificativa.trim()) return;
          }
          botao.disabled = true;
          try {
            await api.enviar('/reincidencias/' + item.dataset.vinculo + '/decisao',
              'PUT', { status: decisao, justificativa: justificativa });
            carregarSugestoes();
            carregarReincidencia();
          } catch (erro) {
            alert(erro.message);
            botao.disabled = false;
          }
        });
      });
    } catch (erro) {
      api.estadoErro(alvo, erro.message);
    }
  }

  //=========================================================== DRILL-DOWN
  async function abrirDetalhePonto(pontoId) {
    const painel = elemento('rel-detalhe');
    const overlay = elemento('rel-detalhe-overlay');
    const corpo = elemento('rel-detalhe-corpo');
    if (!painel) return;

    // Um modal de cada vez: com o bottom sheet de filtros aberto por baixo, o
    // botao Aplicar continuaria clicavel sem estar visivel.
    if (typeof filtros.fecharPainel === 'function') filtros.fecharPainel();

    painel.hidden = false;
    overlay.hidden = false;
    document.body.classList.add('rel-detalhe-aberto');
    api.estadoCarregando(corpo, 'Carregando histórico do ponto...');

    try {
      const dados = await api.buscar('/analitico/ponto/' + pontoId + '/historico', {},
        'detalhe-ponto');
      elemento('rel-detalhe-titulo').textContent =
        dados.ponto.codigo + (dados.ponto.nome ? ' · ' + dados.ponto.nome : '');

      const resumo = dados.resumo || {};
      corpo.innerHTML =
        '<section class="rel-detalhe-secao">'
        + '<h4>Resumo</h4>'
        + '<div class="rel-detalhe-resumo">'
        + '<div><span>Chamados</span><strong>' + api.numero(resumo.total_ocorrencias) + '</strong></div>'
        + '<div><span>Reincidências</span><strong>' + api.numero(resumo.reincidencias) + '</strong></div>'
        + '<div><span>Primeiro</span><strong>' + api.dataCurta(resumo.primeiro_chamado) + '</strong></div>'
        + '<div><span>Último</span><strong>' + api.dataCurta(resumo.ultimo_chamado) + '</strong></div>'
        + '</div>'
        + '<p class="rel-detalhe-endereco">' + escapar(dados.ponto.endereco || '')
        + (dados.ponto.contrato ? ' · <b>' + escapar(dados.ponto.contrato) + '</b>' : '')
        + '</p></section>'

        + '<section class="rel-detalhe-secao"><h4>Problemas recorrentes</h4>'
        + (dados.problemas && dados.problemas.length
           ? '<ul class="rel-detalhe-lista">' + dados.problemas.map((p) =>
               '<li><span>' + escapar(p.problema) + '</span>'
               + '<b>' + api.numero(p.ocorrencias) + '</b>'
               + (p.intervalo_medio_dias !== null && p.intervalo_medio_dias !== undefined
                  ? '<small>a cada ' + api.dias(p.intervalo_medio_dias) + '</small>' : '')
               + '</li>').join('') + '</ul>'
           : '<p class="rel-ajuda">Nenhum problema classificado neste ponto ainda.</p>')
        + '</section>'

        + '<section class="rel-detalhe-secao"><h4>Histórico</h4>'
        + (dados.historico && dados.historico.length
           ? '<ol class="rel-cronologia">' + dados.historico.map((h) =>
               '<li><span class="rel-cronologia-data">' + api.dataCurta(h.detectado_em) + '</span>'
               + '<div><strong>' + escapar(h.numero_os || ('O.S. ' + h.ordem_id)) + '</strong> '
               + escapar(h.problema || 'sem classificação')
               + '<small>' + escapar(h.status || '')
               + (h.resultado ? ' · ' + escapar(h.resultado) : '') + '</small></div></li>'
             ).join('') + '</ol>'
           : '<p class="rel-ajuda">Sem histórico registrado.</p>')
        + '</section>'

        + (dados.equipamentos && dados.equipamentos.length
           ? '<section class="rel-detalhe-secao"><h4>Equipamentos</h4>'
             + '<ul class="rel-detalhe-lista">' + dados.equipamentos.map((e) =>
                 '<li><span>' + escapar(e.codigo) + ' ' + escapar(e.nome || '')
                 + '</span><b>' + escapar(e.status || '') + '</b></li>').join('')
             + '</ul></section>'
           : '');
    } catch (erro) {
      api.estadoErro(corpo, erro.message);
    }
  }

  function fecharDetalhe() {
    const painel = elemento('rel-detalhe');
    const overlay = elemento('rel-detalhe-overlay');
    if (painel) painel.hidden = true;
    if (overlay) overlay.hidden = true;
    document.body.classList.remove('rel-detalhe-aberto');
  }

  //============================================================== NAVEGACAO
  function irParaAba(nomeAba) {
    const botao = document.querySelector('.tab-btn[data-tab="' + nomeAba + '"]');
    if (botao) botao.click();
  }

  function abaAtiva() {
    const ativa = document.querySelector('.tab-content.active');
    return ativa ? ativa.id : null;
  }

  function carregarAbaAtual(forcar) {
    const aba = abaAtiva();
    if (!aba) return;
    if (!forcar && carregado[aba]) return;
    carregado[aba] = true;

    if (aba === 'analise') { carregarResumo(); carregarGraficos(); }
    else if (aba === 'ranking-pontos') carregarRankingPontos();
    else if (aba === 'ranking-problemas') carregarRankingProblemas();
    else if (aba === 'reincidencia') carregarReincidencia();
  }

  //=========================================================== INICIALIZACAO
  document.addEventListener('DOMContentLoaded', function () {
    // Usa o alternador de abas compartilhado do geral.js em vez de reescrever
    // o mesmo laco pela quinta vez no projeto.
    if (typeof window.inicializarAbasPadrao === 'function') {
      window.inicializarAbasPadrao();
    }
    filtros.iniciar();

    filtros.aoMudar(function () {
      // O filtro invalida tudo, mas só a aba visível recarrega agora; as
      // outras recarregam quando o usuário chegar nelas.
      Object.keys(carregado).forEach((chave) => { carregado[chave] = false; });
      paginas.pontos = paginas.problemas = paginas.reincidencia = 1;
      carregarAbaAtual(true);
    });

    document.querySelectorAll('.tab-btn[data-tab]').forEach((botao) => {
      botao.addEventListener('click', () => setTimeout(() => carregarAbaAtual(false), 0));
    });

    const granularidades = elemento('rel-granularidade');
    if (granularidades) {
      granularidades.addEventListener('click', (evento) => {
        const botao = evento.target.closest('[data-granularidade]');
        if (!botao) return;
        granularidades.querySelectorAll('.rel-chip')
          .forEach((c) => c.classList.remove('rel-chip-ativo'));
        botao.classList.add('rel-chip-ativo');
        granularidade = botao.dataset.granularidade;
        carregarGraficos();
      });
    }

    // Delegação única para todo drill-down da página (tabelas, cards, KPIs
    // e barras dos gráficos usam o mesmo par data-acao/data-id).
    document.addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;
      const acao = alvo.dataset.acao;

      if (acao === 'ponto' && alvo.dataset.id) {
        abrirDetalhePonto(alvo.dataset.id);
      } else if (acao === 'problema' && alvo.dataset.id) {
        filtros.definir('problema_id', alvo.dataset.id);
        irParaAba('ranking-pontos');
      } else if (acao === 'aba:reincidencia') {
        irParaAba('reincidencia');
      } else if (acao === 'aba:ranking-problemas') {
        irParaAba('ranking-problemas');
      } else if (acao && acao.indexOf('status:') === 0) {
        filtros.definir('status', acao.split(':')[1]);
      }
    });

    const fechar = elemento('rel-detalhe-fechar');
    if (fechar) fechar.addEventListener('click', fecharDetalhe);
    const overlay = elemento('rel-detalhe-overlay');
    if (overlay) overlay.addEventListener('click', fecharDetalhe);
    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape') fecharDetalhe();
    });

    // Troca entre tabela e cards ao girar o aparelho / redimensionar.
    let redimensionando;
    window.addEventListener('resize', () => {
      clearTimeout(redimensionando);
      redimensionando = setTimeout(() => carregarAbaAtual(true), 250);
    });

    // Deep-link vindo do alerta do Painel Geral: abre direto o histórico do
    // ponto que gerou o alerta, sem obrigar o usuário a procurá-lo na lista.
    const parametros = new URLSearchParams(window.location.search);
    const pontoDireto = parametros.get('ponto_id');
    if (pontoDireto) {
      irParaAba('ranking-pontos');
      abrirDetalhePonto(pontoDireto);
    }

    carregarAbaAtual(false);
  });

  window.RelatoriosPainel = { abrirDetalhePonto: abrirDetalhePonto };
})();
