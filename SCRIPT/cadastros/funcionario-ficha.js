//======================================================================================================
// FICHA DO FUNCIONÁRIO (Gestão › Cadastros › Funcionários)
// Subabas do formulário: Dados (cadastro, emergência, capacitações), Admissão,
// Documentos (explorador de arquivos com pastas livres) e Férias
// (períodos aquisitivos calculados pela admissão, saldo, prazo e programação).
// Documentos e Férias só existem para funcionário já salvo.
//
// Uso (por gestao-funcionarios.js): FichaFuncionario.definir(funcionario|null)
//======================================================================================================
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });
  const url = (c) => (typeof window.apiUrl === 'function' ? window.apiUrl(c) : c);
  const dataBr = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-');
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const competenciaBr = (c) => (c ? MESES[Number(c.slice(5, 7)) - 1] + '/' + c.slice(0, 4) : '');
  const tamanho = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  const SITUACAO_PERIODO = {
    em_aquisicao: ['Em aquisição', 'neutro'], disponivel: ['Disponível', 'ok'], vencendo: ['Vencendo', 'aviso'],
    vencida: ['Vencida', 'erro'], quitado: ['Quitado', 'neutro'],
  };
  const SITUACAO_FERIAS = { programada: 'Programada', em_gozo: 'Em férias', gozada: 'Tirada' };

  async function chamar(metodo, caminho, corpo) {
    const resp = await fetch(url(caminho), {
      method: metodo,
      headers: Object.assign({ 'Content-Type': 'application/json' }, auth()),
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok || dados.status !== 'ok') throw new Error(dados.mensagem || 'Falha na requisição.');
    return dados;
  }

  const estado = { id: null, ferias: null };

  // ---------------------------------------------------------- subabas
  function mostrar(secao) {
    document.querySelectorAll('#func-abas [data-fsec]').forEach((b) => b.classList.toggle('ativo', b.dataset.fsec === secao));
    document.querySelectorAll('[data-fsec-painel]').forEach((p) => { p.hidden = p.dataset.fsecPainel !== secao; });
    // Salvar vale para Dados e Admissão (os dois vão no mesmo cadastro).
    el('func-acoes-salvar').hidden = secao === 'documentos' || secao === 'ferias';
    if (secao === 'documentos') carregarDocumentos();
    if (secao === 'ferias') carregarFerias();
  }

  function definir(f) {
    estado.id = f ? f.id : null;
    estado.ferias = null;
    document.querySelectorAll('#func-abas [data-so-salvo]').forEach((b) => { b.hidden = !f; });
    el('func-admissao').value = (f && f.data_admissao) || '';
    el('func-contrato').value = (f && f.tipo_contrato) || '';
    el('func-desligamento').value = (f && f.data_desligamento) || '';
    atualizarTempoCasa();
    const secao = (location.hash.match(/^#funcionario-\d+-(\w+)/) || [])[1];
    mostrar(f && ['admissao', 'documentos', 'ferias'].includes(secao) ? secao : 'dados');
  }

  function atualizarTempoCasa() {
    const ini = el('func-admissao').value;
    if (!ini) { el('func-tempo-casa').textContent = '-'; return; }
    const fim = el('func-desligamento').value ? new Date(el('func-desligamento').value + 'T12:00') : new Date();
    const a = new Date(ini + 'T12:00');
    let meses = (fim.getFullYear() - a.getFullYear()) * 12 + fim.getMonth() - a.getMonth() - (fim.getDate() < a.getDate() ? 1 : 0);
    if (meses < 0) { el('func-tempo-casa').textContent = '-'; return; }
    const anos = Math.floor(meses / 12);
    meses %= 12;
    el('func-tempo-casa').textContent = [anos ? anos + (anos > 1 ? ' anos' : ' ano') : '', meses ? meses + (meses > 1 ? ' meses' : ' mês') : '']
      .filter(Boolean).join(' e ') || 'menos de 1 mês';
  }

  // ---------------------------------------------------------- documentos
  // Explorador de arquivos com pastas livres (SCRIPT/operacional/explorador.js),
  // o mesmo dos equipamentos e contratos.
  async function carregarDocumentos() {
    if (!estado.id) return;
    const alvo = el('ficha-explorador');
    const id = estado.id;
    alvo.innerHTML = '<p class="ficha-vazio">Carregando...</p>';
    try {
      const r = await chamar('GET', `/explorador/funcionarios/${id}/arquivos`);
      if (id !== estado.id) return;
      window.Explorador.montar(alvo, {
        base: '/explorador/funcionarios/' + id,
        podeAlterar: typeof window.temPermissao !== 'function' || window.temPermissao('gestao_funcionarios', 'editar'),
        dados: r.dados,
        raizNome: (el('func-nome').value || 'Funcionário'),
      });
    } catch (e) {
      alvo.innerHTML = `<p class="ficha-vazio">${esc(e.message)}</p>`;
    }
  }

  // ---------------------------------------------------------- férias
  async function carregarFerias() {
    if (!estado.id) return;
    try {
      estado.ferias = await chamar('GET', `/funcionarios/${estado.id}/ferias`);
    } catch (e) {
      feedbackFerias(e.message, 'erro');
      return;
    }
    desenharFerias();
  }

  function feedbackFerias(texto, tipo) {
    const f = el('ferias-feedback');
    f.textContent = texto || '';
    f.className = 'gestao-feedback' + (tipo ? ' ' + tipo : '');
    f.style.display = texto ? '' : 'none';
  }

  function desenharFerias() {
    const r = estado.ferias;
    const semAdmissao = !r.admissao.data_admissao;
    el('ferias-sem-admissao').hidden = !semAdmissao;
    el('ferias-conteudo').hidden = semAdmissao;
    if (semAdmissao) return;
    el('ferias-periodos').querySelector('tbody').innerHTML = r.periodos.slice().reverse().map((p) => {
      const [rot, cls] = SITUACAO_PERIODO[p.situacao] || [p.situacao, 'neutro'];
      const prazo = p.situacao === 'em_aquisicao' ? '-' : dataBr(p.prazo) +
        (p.situacao === 'vencendo' ? ` <small>(${p.dias_para_prazo} dias)</small>` : '');
      return `<tr><td>${dataBr(p.inicio)} a ${dataBr(p.fim)}</td><td>${p.direito} dias</td><td>${p.programados}</td>
        <td><strong>${p.saldo}</strong></td><td>${prazo}</td><td><span class="ficha-selo ${cls}">${rot}</span></td></tr>`;
    }).join('') || '<tr><td colspan="6">Sem períodos.</td></tr>';
    const comSaldo = r.periodos.filter((p) => p.saldo > 0);
    el('ferias-periodo').innerHTML = comSaldo.map((p) =>
      `<option value="${p.inicio}">${dataBr(p.inicio)} a ${dataBr(p.fim)} (saldo ${p.saldo} dias${p.situacao === 'em_aquisicao' ? ', em aquisição' : ''})</option>`).join('') ||
      '<option value="">Sem saldo</option>';
    el('ferias-lista').querySelector('tbody').innerHTML = r.ferias.slice().reverse().map((f) => `
      <tr><td>${dataBr(f.periodo_inicio)}</td><td>${dataBr(f.inicio)}</td><td>${dataBr(f.fim)}</td><td>${f.dias}</td>
        <td>${f.abono_dias || '-'}</td><td><span class="ficha-selo ${f.situacao === 'em_gozo' ? 'ok' : 'neutro'}">${SITUACAO_FERIAS[f.situacao] || f.situacao}</span>
        ${f.observacao ? `<small>${esc(f.observacao)}</small>` : ''}</td>
        <td>${f.situacao === 'programada' ? `<button type="button" class="ficha-acao perigo" data-cancelar-ferias="${f.id}" title="Cancelar" aria-label="Cancelar férias" data-permissao="gestao_funcionarios:editar">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : ''}</td></tr>`).join('') ||
      '<tr><td colspan="7">Nenhuma férias registrada.</td></tr>';
    contarDias();
  }

  function contarDias() {
    const i = el('ferias-inicio').value;
    const f = el('ferias-fim').value;
    if (!i || !f) { el('ferias-dias').textContent = ''; return; }
    const dias = Math.round((new Date(f + 'T12:00') - new Date(i + 'T12:00')) / 86400000) + 1;
    el('ferias-dias').textContent = dias > 0 ? dias + ' dias de descanso' : 'Fim antes do início';
  }

  async function programar() {
    feedbackFerias('');
    try {
      await chamar('POST', `/funcionarios/${estado.id}/ferias`, {
        periodo_inicio: el('ferias-periodo').value,
        inicio: el('ferias-inicio').value,
        fim: el('ferias-fim').value,
        abono_dias: el('ferias-abono').value,
        observacao: el('ferias-obs').value.trim(),
      });
      ['ferias-inicio', 'ferias-fim', 'ferias-obs'].forEach((id) => { el(id).value = ''; });
      el('ferias-abono').value = 0;
      await carregarFerias();
      feedbackFerias('Férias programadas.', 'sucesso');
    } catch (e) { feedbackFerias(e.message, 'erro'); }
  }

  // ---------------------------------------------------------- ligações
  function iniciar() {
    if (!el('func-abas')) return;
    el('func-abas').addEventListener('click', (e) => {
      const b = e.target.closest('[data-fsec]');
      if (b) mostrar(b.dataset.fsec);
    });
    document.addEventListener('click', (e) => {
      const ir = e.target.closest('[data-ir-fsec]');
      if (!ir) return;
      mostrar(ir.dataset.irFsec);
    });
    ['func-admissao', 'func-desligamento'].forEach((id) => el(id).addEventListener('change', atualizarTempoCasa));
    ['ferias-inicio', 'ferias-fim'].forEach((id) => el(id).addEventListener('change', contarDias));
    el('ferias-salvar').addEventListener('click', programar);
    el('ferias-lista').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-cancelar-ferias]');
      if (!b || !confirm('Cancelar estas férias programadas?')) return;
      try { await chamar('DELETE', `/funcionarios/${estado.id}/ferias/${b.dataset.cancelarFerias}`); await carregarFerias(); } catch (err) { feedbackFerias(err.message, 'erro'); }
    });
  }

  window.FichaFuncionario = {
    definir,
    mostrar,
    dadosAdmissao: () => ({
      data_admissao: el('func-admissao').value,
      tipo_contrato: el('func-contrato').value,
      data_desligamento: el('func-desligamento').value,
    }),
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
