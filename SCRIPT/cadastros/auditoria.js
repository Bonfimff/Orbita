//======================================================================================================
// CADASTROS - Auditoria
// Lista somente leitura da trilha de alteracoes. Nao ha acao de edicao nem de
// exclusao aqui de proposito: corrigir um registro de auditoria destruiria
// justamente aquilo que ele existe para provar.
//======================================================================================================
(function () {
  'use strict';

  const api = window.RelatoriosApi;
  const escapar = api.escaparHtml;
  const elemento = (id) => document.getElementById(id);

  let pagina = 1;
  const POR_PAGINA = 50;
  let carregado = false;

  const ROTULO_ACAO = {
    criar: 'Criou', editar: 'Alterou', ativar: 'Ativou', desativar: 'Desativou',
    excluir: 'Excluiu', classificar: 'Classificou', reclassificar: 'Reclassificou',
    decidir_reincidencia: 'Decidiu reincidência',
  };

  const ROTULO_ENTIDADE = {
    categorias_problema: 'Categoria', problemas: 'Problema',
    causas_problema: 'Causa', solucoes_problema: 'Solução',
    resultados_os: 'Resultado', tipos_equipamento: 'Tipo de equipamento',
    equipamentos: 'Equipamento', pontos_atendimento: 'Ponto',
    regioes: 'Região', ordens_ocorrencias: 'Ocorrência de O.S.',
  };

  function resumirMudanca(registro) {
    const antes = registro.dados_antes || {};
    const depois = registro.dados_depois || {};

    if (registro.acao === 'criar') {
      return escapar(depois.nome || depois.codigo || '-');
    }
    if (registro.acao === 'excluir') {
      return escapar(antes.nome || antes.codigo || '-');
    }

    // Mostra só o que mudou: a trilha já guarda apenas o delta, então listar
    // tudo aqui seria repetir o próprio banco na tela.
    const campos = Object.keys(depois).length ? depois : antes;
    const partes = Object.keys(campos).slice(0, 4).map((campo) => {
      const de = antes[campo];
      const para = depois[campo];
      return '<span class="aud-campo"><b>' + escapar(campo) + '</b>: '
        + escapar(de === null || de === undefined ? '-' : de) + ' → '
        + escapar(para === null || para === undefined ? '-' : para) + '</span>';
    });
    return partes.length ? partes.join('') : '-';
  }

  async function carregar() {
    const alvo = elemento('aud-tabela');
    api.estadoCarregando(alvo);
    try {
      const dados = await api.buscar('/auditoria', {
        entidade: elemento('aud-entidade').value || '',
        limite: POR_PAGINA,
        offset: (pagina - 1) * POR_PAGINA,
      }, 'auditoria');

      if (!dados.itens || !dados.itens.length) {
        elemento('aud-paginacao').innerHTML = '';
        return api.estadoVazio(alvo, 'Nenhum registro de auditoria',
          'As alterações feitas nos cadastros e nas classificações aparecerão aqui.');
      }

      const linhas = dados.itens.map((r) =>
        '<tr><td>' + api.dataCurta(r.criado_em)
        + '<br><small>' + escapar(String(r.criado_em || '').slice(11, 16)) + '</small></td>'
        + '<td>' + escapar(r.usuario_nome || 'sistema') + '</td>'
        + '<td><strong>' + escapar(ROTULO_ACAO[r.acao] || r.acao) + '</strong></td>'
        + '<td>' + escapar(ROTULO_ENTIDADE[r.entidade] || r.entidade)
        + ' <small>#' + escapar(r.entidade_id || '') + '</small></td>'
        + '<td class="aud-mudanca">' + resumirMudanca(r)
        + (r.observacao ? '<small class="aud-obs">' + escapar(r.observacao) + '</small>' : '')
        + '</td></tr>').join('');

      const cards = dados.itens.map((r) =>
        '<li class="rel-card"><div class="rel-card-topo">'
        + '<span class="rel-card-titulo"><strong>'
        + escapar(ROTULO_ACAO[r.acao] || r.acao) + '</strong> '
        + escapar(ROTULO_ENTIDADE[r.entidade] || r.entidade) + '</span>'
        + '<small>' + api.dataCurta(r.criado_em) + '</small></div>'
        + '<div class="aud-card-corpo">' + resumirMudanca(r) + '</div>'
        + '<small class="aud-autor">por ' + escapar(r.usuario_nome || 'sistema')
        + '</small></li>').join('');

      alvo.innerHTML =
        '<div class="rel-so-desktop"><table class="rel-tabela"><thead><tr>'
        + '<th>Data</th><th>Usuário</th><th>Ação</th><th>Registro</th><th>Mudança</th>'
        + '</tr></thead><tbody>' + linhas + '</tbody></table></div>'
        + '<div class="rel-so-celular"><ul class="rel-cards">' + cards + '</ul></div>';

      const paginas = Math.ceil(dados.total / POR_PAGINA);
      const paginacao = elemento('aud-paginacao');
      if (paginas <= 1) {
        paginacao.innerHTML = '';
      } else {
        paginacao.innerHTML =
          '<button type="button" class="rel-btn rel-btn-secundario"'
          + (pagina <= 1 ? ' disabled' : '') + ' data-ir="anterior">Anterior</button>'
          + '<span>Página ' + pagina + ' de ' + paginas + ' · '
          + api.numero(dados.total) + ' registro(s)</span>'
          + '<button type="button" class="rel-btn rel-btn-secundario"'
          + (pagina >= paginas ? ' disabled' : '') + ' data-ir="proxima">Próxima</button>';
        paginacao.querySelectorAll('[data-ir]').forEach((botao) => {
          botao.addEventListener('click', () => {
            pagina += botao.dataset.ir === 'proxima' ? 1 : -1;
            carregar();
          });
        });
      }
    } catch (erro) {
      elemento('aud-paginacao').innerHTML = '';
      api.estadoErro(alvo, erro.message);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    elemento('aud-entidade')?.addEventListener('change', () => { pagina = 1; carregar(); });
    elemento('aud-atualizar')?.addEventListener('click', carregar);

    document.querySelector('.tab-btn[data-tab="auditoria"]')?.addEventListener('click', () => {
      if (carregado) return;
      carregado = true;
      carregar();
    });
  });
})();
