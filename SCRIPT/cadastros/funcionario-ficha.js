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

  const estado = { id: null };

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
  function carregarFerias() {
    if (!estado.id || !window.FeriasUI) return;
    window.FeriasUI.montar(el('func-ferias'), {
      funcionarioId: estado.id,
      aoPedirAdmissao: () => mostrar('admissao'),
    });
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
