//======================================================================================================
// ANALISE DA OCORRENCIA dentro da O.S.
// Liga os catalogos ao fluxo de atendimento. Carregado pela pagina de O.S.
//
// MOMENTO DO PREENCHIMENTO (nada aqui e obrigatorio)
//   abertura     - descricao e ponto, como ja era
//   atendimento  - problema e equipamento
//   encerramento - causa, solucao e resultado
// O que nao puder ser determinado fica pendente e aparece na fila de
// classificacao. Obrigar tudo de uma vez faria o campo ser preenchido com
// qualquer coisa, que e pior do que ficar vazio.
//
// Este arquivo NUNCA derruba a tela de O.S.: se o modulo de analise estiver
// indisponivel ou o usuario nao tiver permissao, a secao some e o fluxo antigo
// segue funcionando igual.
//======================================================================================================
(function () {
  'use strict';

  const elemento = (id) => document.getElementById(id);

  let ordemAtual = null;
  let ocorrenciaAtual = null;
  let catalogosCarregados = false;

  function urlApi(caminho) {
    return (typeof window.apiUrl === 'function') ? window.apiUrl(caminho) : caminho;
  }

  function cabecalhos() {
    const token = localStorage.getItem('token');
    const base = { 'Content-Type': 'application/json' };
    if (token) base.Authorization = 'Bearer ' + token;
    return base;
  }

  function escapar(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function dataCurta(valor) {
    if (!valor) return '-';
    const data = new Date(String(valor).replace(' ', 'T'));
    return isNaN(data.getTime()) ? '-' : data.toLocaleDateString('pt-BR');
  }

  async function buscar(caminho) {
    const resposta = await fetch(urlApi(caminho), { headers: cabecalhos() });
    if (!resposta || !resposta.ok) throw new Error('indisponivel');
    const corpo = await resposta.json();
    if (!corpo || corpo.status !== 'ok') throw new Error(corpo?.mensagem || 'erro');
    return corpo.dados;
  }

  function feedback(mensagem, tipo) {
    const caixa = elemento('an-feedback');
    if (!caixa) return;
    caixa.hidden = false;
    caixa.className = 'os-analise-feedback os-analise-feedback-' + (tipo || 'ok');
    caixa.textContent = mensagem;
    clearTimeout(caixa._t);
    caixa._t = setTimeout(() => { caixa.hidden = true; }, 6000);
  }

  function preencherSelect(id, itens, rotuloVazio, mapear) {
    const campo = elemento(id);
    if (!campo) return;
    campo.innerHTML = '<option value="">' + escapar(rotuloVazio) + '</option>'
      + (itens || []).map((item) => {
        const par = mapear(item);
        return '<option value="' + par.valor + '">' + escapar(par.texto) + '</option>';
      }).join('');
  }

  async function carregarCatalogos() {
    if (catalogosCarregados) return;
    // Cada catálogo resolve isolado: se um estiver vazio ou indisponível, os
    // outros continuam utilizáveis.
    const tarefas = [
      ['/catalogos/problemas', 'an-problema', 'Não classificado',
        (p) => ({ valor: p.id, texto: p.nome })],
      ['/catalogos/causas', 'an-causa', 'Não identificada',
        (c) => ({ valor: c.id, texto: c.nome })],
      ['/catalogos/solucoes', 'an-solucao', 'Não informada',
        (s) => ({ valor: s.id, texto: s.nome })],
      ['/catalogos/resultados', 'an-resultado', 'Não informado',
        (r) => ({ valor: r.id, texto: r.nome })],
    ];
    for (const [caminho, campo, vazio, mapear] of tarefas) {
      try {
        preencherSelect(campo, await buscar(caminho), vazio, mapear);
      } catch (erro) {
        console.warn('[analise-os]', caminho, erro.message);
      }
    }
    try {
      const dados = await buscar('/equipamentos?limite=300');
      preencherSelect('an-equipamento', dados.itens, 'Nenhum',
        (e) => ({ valor: e.id, texto: e.codigo + (e.nome ? ' · ' + e.nome : '') }));
    } catch (erro) {
      console.warn('[analise-os] equipamentos', erro.message);
    }
    catalogosCarregados = true;
  }

  function atualizarStatus(ocorrencia) {
    const alvo = elemento('os-analise-status');
    if (!alvo) return;
    if (!ocorrencia) { alvo.textContent = ''; return; }

    const faltas = [];
    if (!ocorrencia.problema_id) faltas.push('problema');
    if (!ocorrencia.causa_id) faltas.push('causa');
    if (!ocorrencia.solucao_id) faltas.push('solução');
    if (!ocorrencia.resultado_id && !ocorrencia.resultado) faltas.push('resultado');

    if (!faltas.length) {
      alvo.className = 'os-analise-status os-analise-status-ok';
      alvo.textContent = 'Classificação completa';
    } else {
      alvo.className = 'os-analise-status os-analise-status-pendente';
      alvo.textContent = 'Pendente: ' + faltas.join(', ');
    }
  }

  function mostrarReincidencia(ocorrencia) {
    const alvo = elemento('os-analise-reincidencia');
    if (!alvo) return;
    const sugestoes = (ocorrencia && ocorrencia.reincidencias) || [];
    const pendentes = sugestoes.filter((s) => s.status === 'Sugerida');
    const confirmadas = sugestoes.filter((s) => s.status === 'Confirmada');

    if (!pendentes.length && !confirmadas.length) {
      alvo.hidden = true;
      return;
    }
    alvo.hidden = false;

    const bloco = (item, confirmada) =>
      '<div class="os-reincidencia-item" data-vinculo="' + item.id + '">'
      + '<div class="os-reincidencia-texto">'
      + '<strong>' + (confirmada ? 'Reincidência confirmada' : 'Possível reincidência')
      + '</strong>'
      + '<span>Este ponto já apresentou este problema anteriormente.</span>'
      + '<small>O.S. anterior: <b>' + escapar(item.numero_os || '-') + '</b>'
      + ' · Data: ' + dataCurta(item.origem_detectado_em)
      + (item.intervalo_dias !== null && item.intervalo_dias !== undefined
         ? ' · Intervalo: <b>' + item.intervalo_dias + ' dias</b>' : '')
      + '</small></div>'
      + (confirmada ? ''
         : '<div class="os-reincidencia-acoes">'
           + '<button type="button" class="btn-primario btn-sm" data-decisao="Confirmada">Confirmar</button>'
           + '<button type="button" class="btn-secundario btn-sm" data-decisao="Descartada">Descartar</button>'
           + '</div>')
      + '</div>';

    alvo.innerHTML = confirmadas.map((i) => bloco(i, true)).join('')
      + pendentes.map((i) => bloco(i, false)).join('');

    alvo.querySelectorAll('[data-decisao]').forEach((botao) => {
      botao.addEventListener('click', async () => {
        const item = botao.closest('.os-reincidencia-item');
        const decisao = botao.dataset.decisao;
        let justificativa = null;
        if (decisao === 'Descartada') {
          justificativa = window.prompt('Por que esta sugestão não é uma reincidência?');
          // O backend recusa descarte sem justificativa; abortar aqui evita
          // uma ida à API só para receber o erro de volta.
          if (!justificativa || !justificativa.trim()) return;
        }
        botao.disabled = true;
        try {
          const resposta = await fetch(
            urlApi('/reincidencias/' + item.dataset.vinculo + '/decisao'),
            { method: 'PUT', headers: cabecalhos(),
              body: JSON.stringify({ status: decisao, justificativa: justificativa }) });
          if (!resposta.ok) throw new Error('não foi possível registrar a decisão');
          feedback(decisao === 'Confirmada'
            ? 'Reincidência confirmada.' : 'Sugestão descartada.', 'ok');
          carregar(ordemAtual);
        } catch (erro) {
          feedback(erro.message, 'erro');
          botao.disabled = false;
        }
      });
    });
  }

  function preencherFormulario(ocorrencia) {
    const definir = (id, valor) => {
      const campo = elemento(id);
      if (campo) campo.value = valor || '';
    };
    definir('an-problema', ocorrencia?.problema_id);
    definir('an-causa', ocorrencia?.causa_id);
    definir('an-solucao', ocorrencia?.solucao_id);
    definir('an-resultado', ocorrencia?.resultado_id);
    definir('an-equipamento', ocorrencia?.equipamento_id);
    const observacao = elemento('an-observacao');
    if (observacao) observacao.value = ocorrencia?.observacao || '';
    const naoAplicavel = elemento('an-equipamento-na');
    if (naoAplicavel) naoAplicavel.checked = !!ocorrencia?.equipamento_nao_aplicavel;
    const externo = elemento('an-evento-externo');
    if (externo) externo.checked = !!ocorrencia?.evento_externo;
  }

  async function carregar(ordemId) {
    const secao = elemento('os-analise-ocorrencia');
    if (!secao || !ordemId) return;
    ordemAtual = ordemId;

    try {
      await carregarCatalogos();
      const ocorrencias = await buscar('/ordens/' + ordemId + '/ocorrencias');
      // Uma O.S. pode ter várias ocorrências (uma por ponto). Esta tela trata a
      // primeira; o detalhamento por ponto vive no módulo de Relatórios.
      ocorrenciaAtual = (ocorrencias && ocorrencias[0]) || null;
      secao.hidden = false;
      preencherFormulario(ocorrenciaAtual);
      atualizarStatus(ocorrenciaAtual);
      mostrarReincidencia(ocorrenciaAtual);
    } catch (erro) {
      // Sem permissão ou módulo indisponível: some sem quebrar a O.S.
      secao.hidden = true;
      console.warn('[analise-os] indisponivel:', erro.message);
    }
  }

  let salvando = false;
  let salvarDeNovo = false;

  async function salvar() {
    if (salvando) { salvarDeNovo = true; return; }
    if (!ocorrenciaAtual) {
      return feedback('Esta O.S. ainda não tem ocorrência registrada. '
                    + 'Salve os pontos de atendimento primeiro.', 'erro');
    }
    const valor = (id) => elemento(id)?.value || null;
    salvando = true;
    feedback('Salvando...', 'ok');
    try {
      const resposta = await fetch(
        urlApi('/ocorrencias/' + ocorrenciaAtual.id + '/classificar'),
        { method: 'PUT', headers: cabecalhos(), body: JSON.stringify({
            problema_id: valor('an-problema'),
            causa_id: valor('an-causa'),
            solucao_id: valor('an-solucao'),
            resultado_id: valor('an-resultado'),
            equipamento_id: valor('an-equipamento'),
            equipamento_nao_aplicavel: elemento('an-equipamento-na')?.checked ? 1 : 0,
            evento_externo: elemento('an-evento-externo')?.checked ? 1 : 0,
            observacao: elemento('an-observacao')?.value || null,
          }) });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok || !corpo || corpo.status !== 'ok') {
        throw new Error((corpo && corpo.mensagem) || 'Não foi possível salvar a análise.');
      }
      feedback('Salvo automaticamente.', 'ok');
      // Recarrega o resumo de pendências só se a pessoa não estiver
      // digitando em outro campo da análise (para não apagar o que digita).
      const secao = elemento('an-salvar')?.closest('section') || document.getElementById('os-analise-ocorrencia');
      if (!secao || !secao.contains(document.activeElement)) await carregar(ordemAtual);
    } catch (erro) {
      feedback(erro.message, 'erro');
    } finally {
      salvando = false;
      if (salvarDeNovo) { salvarDeNovo = false; salvar(); }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    elemento('an-salvar')?.addEventListener('click', salvar);

    // Salva sozinho: listas e caixas ao mudar; observação ao sair do campo.
    ['an-problema', 'an-causa', 'an-solucao', 'an-resultado', 'an-equipamento',
     'an-equipamento-na', 'an-evento-externo'].forEach((id) => {
      elemento(id)?.addEventListener('change', () => setTimeout(salvar, 0));
    });
    const observacao = elemento('an-observacao');
    if (observacao) {
      let valorAoEntrar = '';
      observacao.addEventListener('focus', () => { valorAoEntrar = observacao.value; });
      observacao.addEventListener('blur', () => { if (observacao.value !== valorAoEntrar) salvar(); });
    }

    // Equipamento "não se aplica" e equipamento escolhido são excludentes:
    // marcar os dois deixaria a pendência num estado ambíguo.
    elemento('an-equipamento-na')?.addEventListener('change', (evento) => {
      const campo = elemento('an-equipamento');
      if (evento.target.checked && campo) campo.value = '';
      if (campo) campo.disabled = evento.target.checked;
    });
  });

  // A tela de O.S. chama isto ao abrir uma ordem (ver ordens.js).
  window.AnaliseOS = { carregar: carregar };
})();
