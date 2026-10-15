//======================================================================================================
// RELATORIOS - barra de filtros compartilhada
// Um unico estado de filtro serve todas as abas. Cada aba se inscreve com
// `aoMudar` e recarrega o proprio conteudo quando o filtro muda - assim o
// usuario nao precisa reaplicar o periodo ao trocar de aba.
//
// Em celular o formulario vira bottom sheet (ver relatorios.css); em desktop
// ele fica sempre visivel acima do conteudo.
//======================================================================================================
(function () {
  'use strict';

  const api = window.RelatoriosApi;
  const ouvintes = [];

  const estado = {
    periodo: '30d',
    inicio: '',
    fim: '',
    contrato_id: '',
    base_id: '',
    ponto_id: '',
    categoria_id: '',
    problema_id: '',
    causa_id: '',
    equipamento_id: '',
    status: '',
  };

  const elemento = (id) => document.getElementById(id);

  function parametros(extras) {
    const saida = {};
    if (estado.periodo === 'custom') {
      if (estado.inicio) saida.inicio = estado.inicio;
      if (estado.fim) saida.fim = estado.fim;
    } else {
      saida.periodo = estado.periodo;
    }
    ['contrato_id', 'base_id', 'ponto_id', 'categoria_id', 'problema_id',
     'causa_id', 'equipamento_id', 'status'].forEach((campo) => {
      if (estado[campo]) saida[campo] = estado[campo];
    });
    return Object.assign(saida, extras || {});
  }

  function contarAtivos() {
    return ['contrato_id', 'base_id', 'ponto_id', 'categoria_id', 'problema_id',
            'causa_id', 'equipamento_id', 'status']
      .filter((campo) => !!estado[campo]).length;
  }

  const ROTULOS_PERIODO = {
    hoje: 'Hoje', '7d': 'Últimos 7 dias', '30d': 'Últimos 30 dias',
    '90d': 'Últimos 90 dias', '12m': 'Últimos 12 meses', custom: 'Período personalizado',
  };

  function atualizarResumo() {
    const resumo = elemento('rel-periodo-resumo');
    if (resumo) {
      let texto = ROTULOS_PERIODO[estado.periodo] || '';
      if (estado.periodo === 'custom' && estado.inicio && estado.fim) {
        texto = api.dataCurta(estado.inicio) + ' a ' + api.dataCurta(estado.fim);
      }
      resumo.textContent = texto;
    }
    const contador = elemento('rel-filtros-contador');
    if (contador) {
      const total = contarAtivos();
      contador.textContent = total;
      contador.hidden = total === 0;
    }
  }

  function notificar() {
    atualizarResumo();
    ouvintes.forEach((funcao) => {
      try { funcao(); } catch (erro) { console.error('[relatorios] ouvinte:', erro); }
    });
  }

  //------------------------------------------- posicionar ao lado da legenda
  // A barra de filtros e o formulario sao elementos unicos compartilhados
  // por varias abas. Em vez de duplicar o botao (e o id) em cada aba,
  // movemos os mesmos nos do DOM para dentro do .aba-legenda-linha da aba
  // ativa - preserva os listeners ja ligados neles. O formulario fica logo
  // apos essa linha, ou seja, abre para BAIXO da legenda.
  function reposicionarBarra() {
    const barra = elemento('rel-filtros-barra');
    const formulario = elemento('rel-filtros');
    const ativa = document.querySelector('.content > .tab-content.active');
    const alvo = ativa && ativa.querySelector('.aba-legenda-linha');
    if (!alvo) return;
    if (barra) alvo.appendChild(barra);
    // Abaixo da trilha e das sub-abas (quando existirem) - preserva a ordem
    // legenda / trilha / sub-abas / filtros mesmo que esses outros blocos
    // (geral.js, gestao-nav.js) se reposicionem em outra ordem.
    const anchor = ativa.querySelector('.subnav-abas') || ativa.querySelector('.aba-trilha') || alvo;
    if (formulario) anchor.insertAdjacentElement('afterend', formulario);
  }

  //--------------------------------------------------------- bottom sheet
  function abrirPainel() {
    // Um modal de cada vez: se o detalhe do ponto estiver aberto, ele sai
    // primeiro - os dois compartilham a mesma camada de z-index.
    const detalhe = elemento('rel-detalhe');
    if (detalhe && !detalhe.hidden) {
      detalhe.hidden = true;
      const overlayDetalhe = elemento('rel-detalhe-overlay');
      if (overlayDetalhe) overlayDetalhe.hidden = true;
      document.body.classList.remove('rel-detalhe-aberto');
    }
    document.body.classList.add('rel-filtros-aberto');
    const overlay = elemento('rel-filtros-overlay');
    if (overlay) overlay.hidden = false;
  }

  function fecharPainel() {
    document.body.classList.remove('rel-filtros-aberto');
    const overlay = elemento('rel-filtros-overlay');
    if (overlay) overlay.hidden = true;
  }

  function alternarPainel() {
    if (document.body.classList.contains('rel-filtros-aberto')) fecharPainel();
    else abrirPainel();
  }

  //--------------------------------------------------- carga das listas
  async function preencherSelect(id, itens, mapear, rotuloVazio) {
    const campo = elemento(id);
    if (!campo) return;
    const selecionado = campo.value;
    campo.innerHTML = '<option value="">' + (rotuloVazio || 'Todos') + '</option>'
      + (itens || []).map((item) => {
        const par = mapear(item);
        return '<option value="' + api.escaparHtml(par.valor) + '">'
          + api.escaparHtml(par.texto) + '</option>';
      }).join('');
    if (selecionado) campo.value = selecionado;
  }

  async function carregarListas() {
    // Falha em uma lista nao pode derrubar as outras: cada uma resolve
    // isoladamente e o filtro correspondente simplesmente fica so com "Todos".
    const tarefas = [
      ['/contratos', 'rel-contrato', (c) => ({ valor: c.id, texto: c.nome }),
       'Todos', (dados) => dados.contratos || dados || []],
    ];

    for (const [caminho, campo, mapear, vazio, extrair] of tarefas) {
      try {
        const resposta = await fetch(api.urlApi(caminho), {
          headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
        });
        const corpo = await resposta.json();
        await preencherSelect(campo, extrair(corpo), mapear, vazio);
      } catch (erro) {
        console.warn('[relatorios] lista', caminho, 'indisponivel:', erro.message);
      }
    }

    try {
      const pontos = await api.buscar('/pontos-atendimento', { limite: 500 }, 'pontos-filtro');
      await preencherSelect('rel-ponto', pontos,
        (p) => ({ valor: p.id, texto: p.codigo + ' · ' + (p.nome || p.endereco) }), 'Todos');
    } catch (erro) {
      console.warn('[relatorios] pontos indisponiveis:', erro.message);
    }

    for (const [catalogo, campo, vazio] of [
      ['categorias', 'rel-categoria', 'Todas'],
      ['problemas', 'rel-problema', 'Todos'],
      ['causas', 'rel-causa', 'Todas'],
    ]) {
      try {
        const itens = await api.buscar('/catalogos/' + catalogo, {}, 'cat-' + catalogo);
        await preencherSelect(campo, itens, (i) => ({ valor: i.id, texto: i.nome }), vazio);
      } catch (erro) {
        console.warn('[relatorios] catalogo', catalogo, 'indisponivel:', erro.message);
      }
    }
  }

  //------------------------------------------------------------ inicializacao
  function iniciar() {
    const chips = elemento('rel-periodo-chips');
    if (chips) {
      chips.addEventListener('click', (evento) => {
        const botao = evento.target.closest('[data-periodo]');
        if (!botao) return;
        chips.querySelectorAll('.rel-chip').forEach((c) => c.classList.remove('rel-chip-ativo'));
        botao.classList.add('rel-chip-ativo');
        estado.periodo = botao.dataset.periodo;

        const personalizado = estado.periodo === 'custom';
        ['rel-campo-inicio', 'rel-campo-fim'].forEach((id) => {
          const campo = elemento(id);
          if (campo) campo.hidden = !personalizado;
        });
        // Só dispara quando o intervalo personalizado estiver completo -
        // consultar com meia data traria um resultado sem sentido.
        if (!personalizado || (estado.inicio && estado.fim)) notificar();
        else atualizarResumo();
      });
    }

    [['rel-inicio', 'inicio'], ['rel-fim', 'fim']].forEach(([id, campo]) => {
      const entrada = elemento(id);
      if (!entrada) return;
      entrada.addEventListener('change', () => {
        estado[campo] = entrada.value;
        if (estado.inicio && estado.fim) notificar();
      });
    });

    [['rel-contrato', 'contrato_id'],
     ['rel-ponto', 'ponto_id'], ['rel-categoria', 'categoria_id'],
     ['rel-problema', 'problema_id'], ['rel-causa', 'causa_id'],
     ['rel-equipamento', 'equipamento_id'], ['rel-status', 'status']]
      .forEach(([id, campo]) => {
        const entrada = elemento(id);
        if (!entrada) return;
        entrada.addEventListener('change', () => {
          estado[campo] = entrada.value;
          // Em desktop aplica na hora; em celular o usuario confirma no botao
          // Aplicar, senão o sheet recarregaria a cada toque.
          if (!window.matchMedia('(max-width: 767px)').matches) notificar();
          else atualizarResumo();
        });
      });

    const formulario = elemento('rel-filtros');
    if (formulario) {
      formulario.addEventListener('submit', (evento) => {
        evento.preventDefault();
        fecharPainel();
        notificar();
      });
    }

    const limpar = elemento('rel-limpar');
    if (limpar) {
      limpar.addEventListener('click', () => {
        ['contrato_id', 'ponto_id', 'categoria_id', 'problema_id',
         'causa_id', 'equipamento_id', 'status'].forEach((campo) => {
          estado[campo] = '';
        });
        ['rel-contrato', 'rel-ponto', 'rel-categoria', 'rel-problema',
         'rel-causa', 'rel-equipamento', 'rel-status'].forEach((id) => {
          const entrada = elemento(id);
          if (entrada) entrada.value = '';
        });
        notificar();
      });
    }

    const abrir = elemento('rel-filtros-abrir');
    if (abrir) abrir.addEventListener('click', alternarPainel);
    const fechar = elemento('rel-filtros-fechar');
    if (fechar) fechar.addEventListener('click', fecharPainel);
    const overlay = elemento('rel-filtros-overlay');
    if (overlay) overlay.addEventListener('click', fecharPainel);
    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape') fecharPainel();
    });

    const atualizar = elemento('rel-atualizar');
    if (atualizar) atualizar.addEventListener('click', notificar);

    reposicionarBarra();
    document.querySelectorAll('.menu .tab-btn[data-tab]').forEach((botao) => {
      botao.addEventListener('click', () => setTimeout(reposicionarBarra, 0));
    });

    atualizarResumo();
    carregarListas();
  }

  window.RelatoriosFiltros = {
    estado: estado,
    parametros: parametros,
    aoMudar: (funcao) => ouvintes.push(funcao),
    fecharPainel: fecharPainel,
    notificar: notificar,
    iniciar: iniciar,
    definir: function (campo, valor) {
      estado[campo] = valor;
      const mapa = {
        ponto_id: 'rel-ponto', problema_id: 'rel-problema',
        categoria_id: 'rel-categoria', contrato_id: 'rel-contrato',
        status: 'rel-status',
      };
      const entrada = elemento(mapa[campo]);
      if (entrada) entrada.value = valor;
      notificar();
    },
  };
})();
