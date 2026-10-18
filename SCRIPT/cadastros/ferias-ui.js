//======================================================================================================
// FÉRIAS DO FUNCIONÁRIO (componente)
// Períodos aquisitivos (calculados pela admissão), saldo, prazo para tirar,
// programar e cancelar férias. Usado na ficha do funcionário (Gestão ›
// Cadastros › Funcionários › Férias) e na janela de Gestão › Funcionários ›
// Férias, para consultar e programar sem sair da lista.
//
// Uso: FeriasUI.montar(elemento, { funcionarioId, aoMudar, aoPedirAdmissao })
//======================================================================================================
(function () {
  'use strict';

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const url = (c) => (typeof window.apiUrl === 'function' ? window.apiUrl(c) : c);
  const dataBr = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-');
  const SITUACAO_PERIODO = {
    em_aquisicao: ['Em aquisição', 'neutro'], disponivel: ['Disponível', 'ok'], vencendo: ['Vencendo', 'aviso'],
    vencida: ['Vencida', 'erro'], quitado: ['Quitado', 'neutro'],
  };
  const SITUACAO_FERIAS = { programada: 'Programada', em_gozo: 'Em férias', gozada: 'Tirada' };

  async function chamar(metodo, caminho, corpo) {
    const resp = await fetch(url(caminho), {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok || dados.status !== 'ok') throw new Error(dados.mensagem || 'Falha na requisição.');
    return dados;
  }

  function montar(raiz, opcoes) {
    const id = opcoes.funcionarioId;
    const podeEditar = typeof window.temPermissao !== 'function' || window.temPermissao('gestao_funcionarios', 'editar');
    raiz.innerHTML = `
      <div class="ficha-ferias-aviso" data-f="sem-admissao" hidden>
        Para calcular as férias, informe a data de admissão no cadastro do funcionário.
        ${opcoes.aoPedirAdmissao ? '<button type="button" class="ficha-link" data-f="ir-admissao">Informar admissão</button>' : ''}
      </div>
      <div data-f="conteudo" hidden>
        <h4 class="ficha-titulo">Períodos aquisitivos</h4>
        <div class="tabela-responsiva">
          <table class="estilo-tabela ficha-tabela">
            <thead><tr><th>Período</th><th>Direito</th><th>Programados</th><th>Saldo</th><th>Tirar até</th><th>Situação</th></tr></thead>
            <tbody data-f="periodos"></tbody>
          </table>
        </div>
        ${podeEditar ? `
        <h4 class="ficha-titulo">Programar férias</h4>
        <div class="ficha-ferias-form">
          <label class="ficha-campo"><span>Período aquisitivo</span><select data-f="periodo"></select></label>
          <label class="ficha-campo"><span>Início</span><input type="date" data-f="inicio"></label>
          <label class="ficha-campo"><span>Fim</span><input type="date" data-f="fim"></label>
          <label class="ficha-campo"><span>Abono (dias vendidos)</span><input type="number" data-f="abono" min="0" max="10" value="0"></label>
          <label class="ficha-campo ficha-campo-largo"><span>Observação</span><input type="text" data-f="obs" maxlength="200"></label>
          <div class="ficha-ferias-acoes">
            <span class="ficha-dias" data-f="dias"></span>
            <button type="button" class="btn-primario" data-f="salvar">Programar</button>
          </div>
        </div>` : ''}
        <div class="gestao-feedback" data-f="feedback" style="display:none;"></div>
        <h4 class="ficha-titulo">Férias programadas e tiradas</h4>
        <div class="tabela-responsiva">
          <table class="estilo-tabela ficha-tabela">
            <thead><tr><th>Período aquisitivo</th><th>Início</th><th>Fim</th><th>Dias</th><th>Abono</th><th>Situação</th></tr></thead>
            <tbody data-f="lista"></tbody>
          </table>
        </div>
      </div>
      <p class="ficha-vazio" data-f="carregando">Carregando...</p>`;
    const f = (nome) => raiz.querySelector(`[data-f="${nome}"]`);

    function feedback(texto, tipo) {
      const caixa = f('feedback');
      caixa.textContent = texto || '';
      caixa.className = 'gestao-feedback' + (tipo ? ' ' + tipo : '');
      caixa.style.display = texto ? '' : 'none';
    }

    function contarDias() {
      if (!f('inicio')) return;
      const i = f('inicio').value;
      const fim = f('fim').value;
      if (!i || !fim) { f('dias').textContent = ''; return; }
      const dias = Math.round((new Date(fim + 'T12:00') - new Date(i + 'T12:00')) / 86400000) + 1;
      f('dias').textContent = dias > 0 ? dias + ' dias de descanso' : 'Fim antes do início';
    }

    function desenhar(r) {
      f('carregando').hidden = true;
      const semAdmissao = !r.admissao.data_admissao;
      f('sem-admissao').hidden = !semAdmissao;
      f('conteudo').hidden = semAdmissao;
      if (semAdmissao) return;
      f('periodos').innerHTML = r.periodos.slice().reverse().map((p) => {
        const [rot, cls] = SITUACAO_PERIODO[p.situacao] || [p.situacao, 'neutro'];
        const prazo = p.situacao === 'em_aquisicao' ? '-' : dataBr(p.prazo) +
          (p.situacao === 'vencendo' ? ` <small>(${p.dias_para_prazo} dias)</small>` : '');
        return `<tr><td>${dataBr(p.inicio)} a ${dataBr(p.fim)}</td><td>${p.direito} dias</td><td>${p.programados}</td>
          <td><strong>${p.saldo}</strong></td><td>${prazo}</td><td><span class="ficha-selo ${cls}">${rot}</span></td></tr>`;
      }).join('') || '<tr><td colspan="6">Sem períodos.</td></tr>';
      if (f('periodo')) {
        const comSaldo = r.periodos.filter((p) => p.saldo > 0);
        f('periodo').innerHTML = comSaldo.map((p) =>
          `<option value="${p.inicio}">${dataBr(p.inicio)} a ${dataBr(p.fim)} (saldo ${p.saldo} dias${p.situacao === 'em_aquisicao' ? ', em aquisição' : ''})</option>`).join('') ||
          '<option value="">Sem saldo</option>';
      }
      ultimas = r.ferias;
      f('lista').innerHTML = r.ferias.slice().reverse().map((x) => `
        <tr class="linha-clicavel" data-ferias="${x.id}" tabindex="0"><td>${dataBr(x.periodo_inicio)}</td><td>${dataBr(x.inicio)}</td><td>${dataBr(x.fim)}</td><td>${x.dias}</td>
          <td>${x.abono_dias || '-'}</td><td><span class="ficha-selo ${x.situacao === 'em_gozo' ? 'ok' : 'neutro'}">${SITUACAO_FERIAS[x.situacao] || x.situacao}</span></td></tr>`).join('') ||
        '<tr><td colspan="6">Nenhuma férias registrada.</td></tr>';
      contarDias();
    }

    async function carregar() {
      try {
        const r = await chamar('GET', `/funcionarios/${id}/ferias`);
        desenhar(r);
        return r;
      } catch (e) {
        f('carregando').hidden = true;
        f('conteudo').hidden = false;
        feedback(e.message, 'erro');
        return null;
      }
    }

    if (f('salvar')) {
      ['inicio', 'fim'].forEach((n) => f(n).addEventListener('change', contarDias));
      f('salvar').addEventListener('click', async () => {
        feedback('');
        try {
          await chamar('POST', `/funcionarios/${id}/ferias`, {
            periodo_inicio: f('periodo').value, inicio: f('inicio').value, fim: f('fim').value,
            abono_dias: f('abono').value, observacao: f('obs').value.trim(),
          });
          ['inicio', 'fim', 'obs'].forEach((n) => { f(n).value = ''; });
          f('abono').value = 0;
          await carregar();
          feedback('Férias programadas.', 'sucesso');
          if (opcoes.aoMudar) opcoes.aoMudar();
        } catch (e) { feedback(e.message, 'erro'); }
      });
    }
    // Padrão das tabelas: clique abre a ficha das férias; Cancelar fica nela.
    let ultimas = [];
    window.FichaRegistro.ligarTabela(f('lista'), 'tr[data-ferias]', (linha) => {
      const x = ultimas.find((v) => String(v.id) === linha.dataset.ferias);
      if (!x) return;
      window.FichaRegistro.abrir({
        titulo: 'Férias de ' + dataBr(x.inicio) + ' a ' + dataBr(x.fim),
        subtitulo: SITUACAO_FERIAS[x.situacao] || x.situacao,
        campos: [
          ['Período aquisitivo', dataBr(x.periodo_inicio)], ['Dias de descanso', String(x.dias)],
          ['Abono (dias vendidos)', x.abono_dias ? String(x.abono_dias) : ''], ['Observação', x.observacao, { largo: true }],
        ],
        excluir: async () => {
          await chamar('DELETE', `/funcionarios/${id}/ferias/${x.id}`);
        },
        rotuloExcluir: 'Cancelar férias',
        podeExcluir: podeEditar && x.situacao === 'programada',
        confirmar: 'Cancelar estas férias programadas?',
        aoExcluir: async () => { await carregar(); if (opcoes.aoMudar) opcoes.aoMudar(); },
      });
    });
    raiz.querySelector('[data-f="ir-admissao"]')?.addEventListener('click', () => opcoes.aoPedirAdmissao());

    carregar();
    return { recarregar: carregar };
  }

  window.FeriasUI = { montar };
})();
