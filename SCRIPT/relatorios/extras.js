//======================================================================================================
// RELATORIOS - abas Pontos Cronicos, Causas/Solucoes e Classificacao Pendente
// Compartilham o mesmo estado de filtro das demais abas (RelatoriosFiltros) e
// as mesmas primitivas de grafico e tabela.
//======================================================================================================
(function () {
  'use strict';

  const api = window.RelatoriosApi;
  const graficos = window.RelatoriosGraficos;
  const filtros = window.RelatoriosFiltros;
  const escapar = api.escaparHtml;
  const elemento = (id) => document.getElementById(id);

  let dimensaoAtual = 'causa';
  let motivoAtual = '';
  const paginas = { dimensao: 1, pendentes: 1 };

  const TITULO_DIMENSAO = {
    causa: 'Causas mais recorrentes',
    solucao: 'Soluções mais utilizadas',
    resultado: 'Resultados registrados',
    equipamento: 'Equipamentos mais afetados',
    categoria: 'Categorias mais recorrentes',
  };

  const ROTULO_DIMENSAO = {
    causa: 'Causa', solucao: 'Solução', resultado: 'Resultado',
    equipamento: 'Equipamento', categoria: 'Categoria',
  };

  function paginacao(alvo, total, pagina, limite, aoTrocar) {
    if (!alvo) return;
    const paginas_ = Math.ceil((total || 0) / limite);
    if (paginas_ <= 1) { alvo.innerHTML = ''; return; }
    alvo.innerHTML =
      '<button type="button" class="rel-btn rel-btn-secundario"'
      + (pagina <= 1 ? ' disabled' : '') + ' data-ir="anterior">Anterior</button>'
      + '<span>Página ' + pagina + ' de ' + paginas_ + ' · '
      + api.numero(total) + ' resultado(s)</span>'
      + '<button type="button" class="rel-btn rel-btn-secundario"'
      + (pagina >= paginas_ ? ' disabled' : '') + ' data-ir="proxima">Próxima</button>';
    alvo.querySelectorAll('[data-ir]').forEach((botao) => {
      botao.addEventListener('click', () =>
        aoTrocar(botao.dataset.ir === 'proxima' ? pagina + 1 : pagina - 1));
    });
  }

  function tabelaOuCards(alvo, itens, colunas, config) {
    if (!itens || !itens.length) {
      return api.estadoVazio(alvo, config.vazio, config.vazioDetalhe);
    }
    const clicavel = config.acao ? ' class="rel-linha-clicavel"' : '';
    const atributos = (item) => config.acao
      ? ' data-acao="' + config.acao + '" data-id="' + escapar(config.id(item)) + '"' : '';

    const tabela = '<table class="rel-tabela"><thead><tr>'
      + colunas.map((c) => '<th' + (c.numerica ? ' class="rel-num"' : '') + '>'
          + escapar(c.titulo) + '</th>').join('')
      + '</tr></thead><tbody>'
      + itens.map((i) => '<tr' + clicavel + atributos(i) + '>'
          + colunas.map((c) => '<td' + (c.numerica ? ' class="rel-num"' : '') + '>'
              + c.valor(i) + '</td>').join('') + '</tr>').join('')
      + '</tbody></table>';

    const cards = '<ul class="rel-cards">'
      + itens.map((i) => '<li class="rel-card"' + atributos(i) + '>'
          + '<div class="rel-card-topo">'
          + '<span class="rel-card-titulo">' + config.tituloCard(i) + '</span>'
          + '<strong class="rel-card-destaque">' + config.destaqueCard(i) + '</strong></div>'
          + '<dl class="rel-card-dados">'
          + colunas.filter((c) => !c.ocultarCard)
              .map((c) => '<div><dt>' + escapar(c.titulo) + '</dt><dd>'
                + c.valor(i) + '</dd></div>').join('')
          + '</dl></li>').join('') + '</ul>';

    alvo.innerHTML = '<div class="rel-so-desktop">' + tabela + '</div>'
      + '<div class="rel-so-celular">' + cards + '</div>';
  }

  //============================================================= CRONICOS
  async function carregarCronicos() {
    const alvo = elemento('rel-tabela-cronicos');
    api.estadoCarregando(alvo);
    try {
      const dados = await api.buscar('/analitico/pontos-cronicos',
        filtros.parametros({
          min_ocorrencias: elemento('cr-min').value || 3,
          intervalo_maximo: elemento('cr-intervalo').value || 30,
          limite: 50,
        }), 'cronicos');

      const texto = elemento('cr-criterio-texto');
      if (texto) {
        texto.textContent = 'Critério aplicado: ' + (dados.criterio || '')
          + '. Sem score composto — o cálculo é reproduzível na mão.';
      }

      tabelaOuCards(alvo, dados.itens, [
        { titulo: 'Ponto', ocultarCard: true,
          valor: (i) => '<strong>' + escapar(i.codigo) + '</strong><br><small>'
            + escapar(i.ponto_nome || i.endereco || '') + '</small>' },
        { titulo: 'Problema', ocultarCard: true, valor: (i) => escapar(i.problema) },
        { titulo: 'Região/Base', valor: (i) => escapar(i.regiao || i.base_id || '—') },
        { titulo: 'Chamados', numerica: true, valor: (i) => api.numero(i.ocorrencias) },
        { titulo: 'Reincidências', numerica: true,
          valor: (i) => api.numero(Math.max(0, (i.ocorrencias || 1) - 1)) },
        { titulo: 'Última', valor: (i) => api.dataCurta(i.ultima_ocorrencia) },
        { titulo: 'Intervalo médio', numerica: true,
          valor: (i) => api.dias(i.intervalo_medio_dias) },
        { titulo: 'Problemas diferentes', numerica: true,
          valor: (i) => api.numero(i.problemas_diferentes) },
      ], {
        acao: 'ponto', id: (i) => i.ponto_id,
        tituloCard: (i) => escapar(i.codigo) + ' · ' + escapar(i.problema),
        destaqueCard: (i) => api.numero(i.ocorrencias) + '×',
        vazio: 'Nenhum ponto crônico no período',
        vazioDetalhe: 'Nenhum par (ponto, problema) atingiu o critério configurado acima.',
      });
    } catch (erro) {
      api.estadoErro(alvo, erro.message);
    }
  }

  //============================================================ DIMENSOES
  async function carregarDimensao() {
    const alvoGrafico = elemento('rel-gr-dimensao');
    const alvoTabela = elemento('rel-tabela-dimensao');
    const titulo = elemento('rel-dimensao-titulo');
    if (titulo) titulo.textContent = TITULO_DIMENSAO[dimensaoAtual];

    api.estadoCarregando(alvoGrafico);
    api.estadoCarregando(alvoTabela);
    try {
      const dados = await api.buscar('/analitico/ranking/' + dimensaoAtual,
        filtros.parametros({ limite: 20, pagina: paginas.dimensao }), 'dimensao');

      graficos.barras(alvoGrafico, (dados.itens || []).slice(0, 8).map((item) => ({
        id: item.dimensao_id, rotulo: item.rotulo, valor: item.ocorrencias,
        detalhe: item.pontos_afetados + ' ponto(s)',
      })), {});

      tabelaOuCards(alvoTabela, dados.itens, [
        { titulo: '#', numerica: true, ocultarCard: true, valor: (i) => i.posicao },
        { titulo: ROTULO_DIMENSAO[dimensaoAtual], ocultarCard: true,
          valor: (i) => escapar(i.rotulo) },
        { titulo: 'Agrupador', valor: (i) => escapar(i.agrupador ?? '—') },
        { titulo: 'Ocorrências', numerica: true, valor: (i) => api.numero(i.ocorrencias) },
        { titulo: '% do total', numerica: true, valor: (i) => api.percentual(i.percentual) },
        { titulo: 'Pontos afetados', numerica: true,
          valor: (i) => api.numero(i.pontos_afetados) },
        { titulo: 'Última', valor: (i) => api.dataCurta(i.ultima_ocorrencia) },
      ], {
        tituloCard: (i) => '<b>' + i.posicao + 'º</b> ' + escapar(i.rotulo),
        destaqueCard: (i) => api.numero(i.ocorrencias),
        vazio: 'Nenhum registro classificado nesta dimensão',
        vazioDetalhe: 'Cadastre os itens em Cadastros → Cadastro de Parâmetros e '
          + 'classifique as O.S. para ver este ranking.',
      });

      if (dados.nao_informado) {
        alvoTabela.insertAdjacentHTML('afterbegin',
          '<div class="rel-aviso rel-aviso-inline">' + api.numero(dados.nao_informado)
          + ' ocorrência(s) sem esta informação ficaram fora do ranking.</div>');
      }

      paginacao(elemento('rel-paginacao-dimensao'), dados.total_classificadas,
        dados.pagina, dados.limite, (nova) => {
          paginas.dimensao = nova; carregarDimensao();
        });
    } catch (erro) {
      api.estadoErro(alvoGrafico, erro.message);
      api.estadoErro(alvoTabela, erro.message);
    }
  }

  //============================================================ PENDENTES
  function cartaoPendencia(rotulo, valor, motivo, tom) {
    return '<div class="painel-card rel-kpi rel-kpi-clicavel" data-motivo-kpi="'
      + motivo + '" role="button" tabindex="0">'
      + '<span class="painel-card-label">' + escapar(rotulo) + '</span>'
      + '<strong class="painel-card-valor rel-kpi-' + (tom || 'neutro') + '-texto">'
      + api.numero(valor) + '</strong></div>';
  }

  async function carregarPendentes() {
    const alvoKpis = elemento('rel-pendencias-kpis');
    const alvoTabela = elemento('rel-tabela-pendentes');
    api.estadoCarregando(alvoKpis);
    api.estadoCarregando(alvoTabela);

    try {
      const resumo = await api.buscar('/classificacao/resumo',
        filtros.parametros(), 'pend-resumo');

      alvoKpis.innerHTML = [
        cartaoPendencia('Pendentes', resumo.pendentes, '', 'erro'),
        cartaoPendencia('Sem problema', resumo.sem_problema, 'sem_problema', 'aviso'),
        cartaoPendencia('Sem causa', resumo.sem_causa, 'sem_causa', 'aviso'),
        cartaoPendencia('Sem solução', resumo.sem_solucao, 'sem_solucao', 'aviso'),
        cartaoPendencia('Sem resultado', resumo.sem_resultado, 'sem_resultado', 'aviso'),
        cartaoPendencia('Completas', resumo.completas, '', 'sucesso'),
      ].join('')
      + '<div class="rel-aviso rel-aviso-inline rel-pendencia-nota">'
      + api.percentual(resumo.percentual_completo) + ' das ocorrências do período '
      + 'estão com classificação completa. '
      + api.numero(resumo.sem_equipamento) + ' sem equipamento informado — '
      + 'isso <b>não</b> é pendência: equipamento pode não se aplicar.</div>';

      alvoKpis.querySelectorAll('[data-motivo-kpi]').forEach((cartao) => {
        cartao.addEventListener('click', () => {
          motivoAtual = cartao.dataset.motivoKpi;
          document.querySelectorAll('#rel-subabas-motivo .top-tab2')
            .forEach((b) => b.classList.toggle('ativo', b.dataset.motivo === motivoAtual));
          paginas.pendentes = 1;
          carregarLista();
        });
      });
    } catch (erro) {
      api.estadoErro(alvoKpis, erro.message);
    }

    carregarLista();
  }

  async function carregarLista() {
    const alvo = elemento('rel-tabela-pendentes');
    api.estadoCarregando(alvo);
    try {
      const dados = await api.buscar('/classificacao/pendentes',
        filtros.parametros({ motivo: motivoAtual, limite: 25,
                             pagina: paginas.pendentes }), 'pend-lista');

      const falta = (item) => {
        const faltas = [];
        if (item.falta_problema) faltas.push('problema');
        if (item.falta_causa) faltas.push('causa');
        if (item.falta_solucao) faltas.push('solução');
        if (item.falta_resultado) faltas.push('resultado');
        return faltas.length
          ? faltas.map((f) => '<span class="rel-tag rel-tag-erro">' + f + '</span>').join(' ')
          : '<span class="rel-tag">completa</span>';
      };

      tabelaOuCards(alvo, dados.itens, [
        { titulo: 'O.S.', ocultarCard: true,
          valor: (i) => '<strong>' + escapar(i.numero_os || i.ordem_id) + '</strong>'
            + '<br><small>' + escapar(i.status_os || '') + '</small>' },
        { titulo: 'Ponto', valor: (i) => escapar(i.ponto_codigo || '—') },
        { titulo: 'Data', valor: (i) => api.dataCurta(i.detectado_em) },
        { titulo: 'Problema', valor: (i) => escapar(i.problema || '—') },
        { titulo: 'Causa', valor: (i) => escapar(i.causa || '—') },
        { titulo: 'Solução', valor: (i) => escapar(i.solucao || '—') },
        { titulo: 'Resultado',
          valor: (i) => escapar(i.resultado_nome || i.resultado_texto || '—') },
        { titulo: 'Falta', valor: falta },
      ], {
        tituloCard: (i) => escapar(i.numero_os || ('O.S. ' + i.ordem_id)),
        destaqueCard: (i) => api.dataCurta(i.detectado_em),
        vazio: 'Nenhuma ocorrência pendente',
        vazioDetalhe: 'Todas as ocorrências do período estão classificadas.',
      });

      paginacao(elemento('rel-paginacao-pendentes'), dados.total,
        paginas.pendentes, 25, (nova) => {
          paginas.pendentes = nova; carregarLista();
        });
    } catch (erro) {
      api.estadoErro(alvo, erro.message);
    }
  }

  //======================================================== inicializacao
  document.addEventListener('DOMContentLoaded', function () {
    elemento('cr-aplicar')?.addEventListener('click', carregarCronicos);

    const subabasDimensao = elemento('rel-subabas-dimensao');
    if (subabasDimensao) {
      subabasDimensao.addEventListener('click', (evento) => {
        const botao = evento.target.closest('[data-dimensao]');
        if (!botao) return;
        subabasDimensao.querySelectorAll('.top-tab2')
          .forEach((b) => b.classList.remove('ativo'));
        botao.classList.add('ativo');
        dimensaoAtual = botao.dataset.dimensao;
        paginas.dimensao = 1;
        carregarDimensao();
      });
    }

    const subabasMotivo = elemento('rel-subabas-motivo');
    if (subabasMotivo) {
      subabasMotivo.addEventListener('click', (evento) => {
        const botao = evento.target.closest('[data-motivo]');
        if (!botao) return;
        subabasMotivo.querySelectorAll('.top-tab2').forEach((b) => b.classList.remove('ativo'));
        botao.classList.add('ativo');
        motivoAtual = botao.dataset.motivo;
        paginas.pendentes = 1;
        carregarLista();
      });
    }

    // Carga sob demanda por aba, no mesmo padrão das demais.
    const carregado = {};
    document.querySelectorAll('.tab-btn[data-tab]').forEach((botao) => {
      botao.addEventListener('click', () => setTimeout(() => {
        const aba = document.querySelector('.tab-content.active')?.id;
        if (!aba || carregado[aba]) return;
        if (aba === 'cronicos') { carregado[aba] = true; carregarCronicos(); }
        else if (aba === 'dimensoes') { carregado[aba] = true; carregarDimensao(); }
        else if (aba === 'pendentes') { carregado[aba] = true; carregarPendentes(); }
      }, 0));
    });

    if (filtros && typeof filtros.aoMudar === 'function') {
      filtros.aoMudar(() => {
        Object.keys(carregado).forEach((k) => { carregado[k] = false; });
        const aba = document.querySelector('.tab-content.active')?.id;
        if (aba === 'cronicos') { carregado[aba] = true; carregarCronicos(); }
        else if (aba === 'dimensoes') { carregado[aba] = true; carregarDimensao(); }
        else if (aba === 'pendentes') { carregado[aba] = true; carregarPendentes(); }
      });
    }

    // Deep-link vindo do Painel Geral da O.S.
    const parametros = new URLSearchParams(window.location.search);
    if (parametros.get('pendentes')) {
      const motivo = parametros.get('pendentes');
      motivoAtual = motivo === '1' ? '' : motivo;
      document.querySelector('.tab-btn[data-tab="pendentes"]')?.click();
      document.querySelectorAll('#rel-subabas-motivo .top-tab2')
        .forEach((b) => b.classList.toggle('ativo', b.dataset.motivo === motivoAtual));
      carregado.pendentes = true;
      carregarPendentes();
    }
  });
})();
