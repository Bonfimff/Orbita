//======================================================================================================
// O.S. › BASES E EQUIPAMENTOS › Equipamentos (consulta e ficha)
// Lista os equipamentos com busca e filtros por tipo e base. Um clique abre a
// ficha: base, dados, Composição (materiais que formam o equipamento),
// Arquivos (explorador com pastas livres), O.S. da base e Histórico.
// Materiais e arquivos são mantidos direto na ficha; "Editar" leva só às
// características, em O.S. › Cadastros › Equipamentos.
//======================================================================================================
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const url = (c) => (typeof window.apiUrl === 'function' ? window.apiUrl(c) : c);
  const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });
  const dataBr = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '');
  const tamanho = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  const STATUS = { Ativo: 'ok', Inativo: 'neutro', 'Em Manutencao': 'aviso', Descartado: 'neutro' };
  const statusTexto = (s) => String(s || '').replace('Manutencao', 'Manutenção');
  const ICONE = {
    baixar: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    excluir: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9 7V4h6v3"/></svg>',
    editar: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
    cadeado: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  };

  let itens = [];
  let bases = {};
  let carregado = false;
  let atual = null;

  async function pedir(metodo, caminho, corpo) {
    const resp = await fetch(url(caminho), {
      method: metodo,
      headers: Object.assign(corpo instanceof FormData ? {} : { 'Content-Type': 'application/json' }, auth()),
      body: corpo ? (corpo instanceof FormData ? corpo : JSON.stringify(corpo)) : undefined,
    });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok || dados.status !== 'ok') throw new Error(dados.mensagem || (resp.status === 413 ? 'Arquivo grande demais.' : 'Não foi possível concluir.'));
    return dados.dados;
  }

  // ---------------------------------------------------------- lista
  async function carregar() {
    const corpo = el('eqi-tabela').querySelector('tbody');
    try {
      const [dados, respBases] = await Promise.all([
        pedir('GET', '/equipamentos?limite=500&incluir_inativos=1'),
        fetch(url('/bases'), { headers: auth() }).then((r) => r.json()).catch(() => ({})),
      ]);
      itens = (dados && dados.itens) || [];
      bases = {};
      (respBases.bases || []).forEach((b) => { bases[b.id] = b; });
    } catch (e) {
      corpo.innerHTML = `<tr><td colspan="6">${esc(e.message)}</td></tr>`;
      return;
    }
    preencherFiltros();
    desenhar();
  }

  function preencherFiltros() {
    const tipo = el('eqi-tipo').value;
    const base = el('eqi-local').value;
    const tipos = Array.from(new Set(itens.map((i) => i.tipo_nome).filter(Boolean))).sort();
    el('eqi-tipo').innerHTML = '<option value="">Todos os tipos</option>' + tipos.map((v) => `<option>${esc(v)}</option>`).join('');
    el('eqi-local').innerHTML = '<option value="">Todas as bases</option>' +
      Object.keys(bases).sort().map((id) => `<option value="${esc(id)}">${esc(id)}</option>`).join('') +
      (itens.some((i) => !i.base_id) ? '<option value="__sem">Sem base</option>' : '');
    el('eqi-tipo').value = tipo;
    el('eqi-local').value = base;
  }

  function desenhar() {
    const termo = el('eqi-busca').value.trim().toLowerCase();
    const tipo = el('eqi-tipo').value;
    const base = el('eqi-local').value;
    const lista = itens.filter((i) => (!tipo || i.tipo_nome === tipo) &&
      (!base || (base === '__sem' ? !i.base_id : i.base_id === base)) &&
      (!termo || [i.codigo, i.nome, i.numero_serie, i.patrimonio, i.modelo, i.fabricante, i.base_id].some((v) => String(v || '').toLowerCase().includes(termo))));
    el('eqi-tabela').querySelector('tbody').innerHTML = lista.map((i) => `
      <tr class="linha-clicavel${i.ativo ? '' : ' eqi-inativo'}" data-eqi="${i.id}" tabindex="0">
        <td><strong>${esc(i.codigo)}</strong>${i.nome ? `<small class="eqi-sub">${esc(i.nome)}</small>` : ''}</td>
        <td>${esc(i.tipo_nome || '-')}</td>
        <td>${i.base_id ? esc(i.base_id) + (i.base_endereco ? `<small class="eqi-sub">${esc(i.base_endereco)}</small>` : '') : '<span class="eqi-alerta">Sem base</span>'}</td>
        <td>${esc(i.modelo || '-')}${i.numero_serie ? `<small class="eqi-sub">Série ${esc(i.numero_serie)}</small>` : ''}</td>
        <td><small class="eqi-contagem">${Number(i.total_materiais || 0)} materiais · ${Number(i.total_arquivos || 0)} arquivos</small></td>
        <td><span class="eqi-selo ${STATUS[i.status] || 'neutro'}">${esc(statusTexto(i.status) || '-')}</span></td>
      </tr>`).join('') || `<tr><td colspan="6">${itens.length ? 'Nenhum equipamento com esse filtro.' : 'Nenhum equipamento cadastrado.'}</td></tr>`;
  }

  // ---------------------------------------------------------- ficha
  function msg(texto, tipo) {
    el('eqi-msg').textContent = texto || '';
    el('eqi-msg').className = 'eqi-msg' + (tipo ? ' ' + tipo : '');
  }

  async function abrirDetalhe(id, aba) {
    el('eqi-titulo').textContent = 'Carregando...';
    el('eqi-sub').textContent = '';
    el('eqi-base').innerHTML = '';
    el('eqi-info').innerHTML = '';
    msg('');
    el('eqi-detalhe').hidden = false;
    if (window.travarRolagemFundo) window.travarRolagemFundo(true);
    try {
      atual = await pedir('GET', '/equipamentos/' + id);
    } catch (err) {
      el('eqi-titulo').textContent = 'Equipamento';
      msg(err.message, 'erro');
      return;
    }
    desenharFicha();
    mostrarAba(aba || 'composicao');
  }

  function desenharFicha() {
    const e = atual;
    el('eqi-titulo').textContent = e.codigo + (e.nome ? ' · ' + e.nome : '');
    el('eqi-sub').textContent = [e.tipo_nome, statusTexto(e.status)].filter(Boolean).join(' · ');
    const b = bases[e.base_id];
    el('eqi-base').innerHTML = e.base_id
      ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
         <span><strong>${esc(e.base_id)}</strong>${(e.base_endereco || (b && b.endereco)) ? ' · ' + esc(e.base_endereco || b.endereco) : ''}</span>`
      : '<span class="eqi-alerta">Sem base definida. Use "Editar" para escolher a base.</span>';
    const item = (r, v) => (v ? `<div><dt>${r}</dt><dd>${v}</dd></div>` : '');
    el('eqi-info').innerHTML =
      item('Fabricante', esc(e.fabricante || '')) +
      item('Modelo', esc(e.modelo || '')) +
      item('Número de série', esc(e.numero_serie || '')) +
      item('Patrimônio', esc(e.patrimonio || '')) +
      item('Instalação', esc(dataBr(e.data_instalacao))) +
      item('Contrato', esc(e.contrato_nome || '')) +
      item('Ponto de atendimento', esc(e.ponto_codigo || '')) +
      item('Observação', esc(e.observacao || ''));
    el('eqi-mat-form').hidden = !e.pode_alterar;
    // Sugestões: materiais registrados na base do equipamento.
    el('eqi-mat-sugestoes').innerHTML = ((b && b.materiais) || [])
      .map((m) => `<option value="${esc(m.nome)}">${esc(m.quantidade || '')} ${esc(m.unidade || '')} na base</option>`).join('');
    desenharMateriais();
    montarExplorador();
    desenharOS();
    el('eqi-historico').innerHTML = (e.alocacoes || []).map((a) => `
      <li${a.fim || a.data_fim ? '' : ' class="atual"'}>
        <strong>${esc(a.ponto_codigo || 'Ponto não informado')}</strong>
        <small>${dataBr(a.inicio || a.data_inicio) || '?'} até ${(a.fim || a.data_fim) ? dataBr(a.fim || a.data_fim) : 'hoje'}${a.motivo ? ' · ' + esc(a.motivo) : ''}</small>
      </li>`).join('') || '<li>Sem histórico de pontos de atendimento.</li>';
  }

  function mostrarAba(aba) {
    document.querySelectorAll('#eqi-abas [data-eqi-aba]').forEach((b) => b.classList.toggle('active', b.dataset.eqiAba === aba));
    document.querySelectorAll('[data-eqi-painel]').forEach((p) => { p.hidden = p.dataset.eqiPainel !== aba; });
  }

  // ---- O.S. da base (resumo; detalhes e fotos ficam na O.S. e no relatório)
  function desenharOS() {
    const r = atual.os || { total: 0, itens: [] };
    el('eqi-n-os').textContent = r.total || '';
    const kpi = (rot, n, cls) => `<div class="eqi-os-kpi ${cls || ''}"><strong>${n}</strong><span>${rot}</span></div>`;
    el('eqi-os-resumo').innerHTML = r.total
      ? kpi('na base', r.total) + kpi('abertas', r.abertas, r.abertas ? 'aviso' : '') +
        kpi('concluídas', r.concluidas) + kpi('com este equipamento', r.do_equipamento, r.do_equipamento ? 'destaque' : '')
      : '';
    el('eqi-os-lista').innerHTML = (r.itens || []).map((o) => `
      <li><button type="button" class="eqi-os-item" data-os-abrir="${o.id}">
        <span class="eqi-os-topo"><strong>${esc(o.numero_os)}</strong>
          <span class="eqi-selo ${/finaliz|conclu/i.test(o.status) ? 'ok' : (/cancel/i.test(o.status) ? 'neutro' : 'aviso')}">${esc(o.status)}</span>
          ${o.do_equipamento ? '<span class="eqi-selo destaque">Este equipamento</span>' : ''}</span>
        <span class="eqi-os-desc">${esc(o.descricao || o.tipo_servico)}</span>
        <small>${esc(dataBr(o.data_abertura))} · ${esc(o.tipo_servico)}${o.pontos ? ' · ' + esc(o.pontos) : ''}</small>
      </button></li>`).join('') || `<li class="eqi-vazio">Nenhuma O.S. registrada ${atual.base_id ? 'nesta base' : 'para este equipamento'}.</li>`;
    const rel = 'relatorios.html?periodo=12m&';
    el('eqi-os-links').innerHTML = (r.total > (r.itens || []).length ? `<small>Mostrando as ${r.itens.length} mais recentes de ${r.total}.</small>` : '') +
      (atual.base_id ? `<a class="eqi-os-link" href="${rel}base_id=${encodeURIComponent(atual.base_id)}">Relatório completo da base ${esc(atual.base_id)}</a>` : '') +
      `<a class="eqi-os-link" href="${rel}equipamento_id=${atual.id}">Relatório deste equipamento</a>`;
  }

  // ---- composição
  function desenharMateriais() {
    const mats = atual.materiais || [];
    el('eqi-n-mat').textContent = mats.length || '';
    el('eqi-materiais').innerHTML = mats.map((m) => `
      <li>
        <span class="eqi-qtd">${esc(m.quantidade)}${m.unidade ? ' ' + esc(m.unidade) : ''}</span>
        <span class="eqi-mat-nome"><strong>${esc(m.nome)}</strong>${m.observacao ? `<small>${esc(m.observacao)}</small>` : ''}</span>
        ${atual.pode_alterar ? `<button type="button" class="eqi-acao" data-mat-editar="${m.id}" title="Alterar" aria-label="Alterar">${ICONE.editar}</button>
        <button type="button" class="eqi-acao perigo" data-mat-excluir="${m.id}" title="Remover" aria-label="Remover">${ICONE.excluir}</button>` : ''}
      </li>`).join('') || '<li class="eqi-vazio">Nenhum material na composição.</li>';
    limparFormMaterial();
  }

  function limparFormMaterial() {
    el('eqi-mat-id').value = '';
    el('eqi-mat-nome').value = '';
    el('eqi-mat-qtd').value = '1';
    el('eqi-mat-un').value = '';
    el('eqi-mat-obs').value = '';
    el('eqi-mat-salvar').textContent = 'Adicionar';
    el('eqi-mat-cancelar').hidden = true;
  }

  async function salvarMaterial(ev) {
    ev.preventDefault();
    const id = el('eqi-mat-id').value;
    try {
      const r = await pedir(id ? 'PUT' : 'POST', `/equipamentos/${atual.id}/materiais${id ? '/' + id : ''}`, {
        nome: el('eqi-mat-nome').value, quantidade: el('eqi-mat-qtd').value,
        unidade: el('eqi-mat-un').value, observacao: el('eqi-mat-obs').value,
      });
      atual.materiais = r.materiais;
      desenharMateriais();
      msg('');
      tocarLista();
    } catch (e) { msg(e.message, 'erro'); }
  }

  // ---- arquivos: explorador no estilo Windows (SCRIPT/operacional/explorador.js)
  function montarExplorador() {
    const dados = atual.explorador || { pastas: [], arquivos: [] };
    el('eqi-n-arq').textContent = dados.arquivos.length || '';
    window.Explorador.montar(el('eqi-explorador'), {
      base: '/equipamentos/' + atual.id,
      podeAlterar: atual.pode_alterar,
      dados,
      raizNome: atual.codigo,
      aoMudar: (novos) => {
        atual.explorador = novos;
        el('eqi-n-arq').textContent = novos.arquivos.length || '';
        tocarLista();
      },
    });
  }

  function tocarLista() {
    const i = itens.find((x) => x.id === atual.id);
    if (i) {
      i.total_materiais = (atual.materiais || []).length;
      i.total_arquivos = ((atual.explorador || {}).arquivos || []).length;
      desenhar();
    }
  }

  function fechar() {
    if (el('eqi-detalhe').hidden) return;
    el('eqi-detalhe').hidden = true;
    if (window.travarRolagemFundo) window.travarRolagemFundo(false);
  }

  function irParaCadastro(acao) {
    fechar();
    if (typeof window.abrirCadastroOS === 'function') window.abrirCadastroOS('os-sub-equipamento');
    if (window.EquipamentosCadastro) acao(window.EquipamentosCadastro);
  }

  function mostrarVista(qual) {
    document.querySelectorAll('#bases-seletor [data-bases-ver]').forEach((b) => b.classList.toggle('active', b.dataset.basesVer === qual));
    el('bases-vista-bases').hidden = qual !== 'bases';
    el('bases-vista-equipamentos').hidden = qual !== 'equipamentos';
    if (qual === 'equipamentos' && !carregado) { carregado = true; carregar(); }
  }

  function iniciar() {
    if (!el('bases-seletor')) return;
    el('bases-seletor').addEventListener('click', (e) => {
      const b = e.target.closest('[data-bases-ver]');
      if (b) mostrarVista(b.dataset.basesVer);
    });
    // Aba de abertura: Equipamentos.
    mostrarVista('equipamentos');
    el('eqi-busca').addEventListener('input', desenhar);
    el('eqi-tipo').addEventListener('change', desenhar);
    el('eqi-local').addEventListener('change', desenhar);
    el('eqi-tabela').addEventListener('click', (e) => {
      const linha = e.target.closest('[data-eqi]');
      if (linha) abrirDetalhe(linha.dataset.eqi);
    });
    el('eqi-tabela').addEventListener('keydown', (e) => {
      const linha = e.target.closest('[data-eqi]');
      if (linha && e.key === 'Enter') abrirDetalhe(linha.dataset.eqi);
    });
    el('eqi-detalhe').addEventListener('click', (e) => {
      if (e.target === el('eqi-detalhe') || e.target.closest('[data-eqi-fechar]')) fechar();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
    el('eqi-abas').addEventListener('click', (e) => {
      const b = e.target.closest('[data-eqi-aba]');
      if (b) mostrarAba(b.dataset.eqiAba);
    });
    el('eqi-mat-form').addEventListener('submit', salvarMaterial);
    el('eqi-mat-cancelar').addEventListener('click', limparFormMaterial);
    el('eqi-materiais').addEventListener('click', async (e) => {
      const ed = e.target.closest('[data-mat-editar]');
      if (ed) {
        const m = atual.materiais.find((x) => String(x.id) === ed.dataset.matEditar);
        el('eqi-mat-id').value = m.id;
        el('eqi-mat-nome').value = m.nome;
        el('eqi-mat-qtd').value = m.quantidade;
        el('eqi-mat-un').value = m.unidade || '';
        el('eqi-mat-obs').value = m.observacao || '';
        el('eqi-mat-salvar').textContent = 'Salvar';
        el('eqi-mat-cancelar').hidden = false;
        el('eqi-mat-nome').focus();
        return;
      }
      const ex = e.target.closest('[data-mat-excluir]');
      if (ex && confirm('Remover este material da composição?')) {
        try {
          const r = await pedir('DELETE', `/equipamentos/${atual.id}/materiais/${ex.dataset.matExcluir}`);
          atual.materiais = r.materiais;
          desenharMateriais();
          tocarLista();
        } catch (err) { msg(err.message, 'erro'); }
      }
    });
    el('eqi-editar').addEventListener('click', () => { const r = atual; irParaCadastro((c) => c.editar(r)); });
    el('eqi-excluir').addEventListener('click', async () => {
      const r = atual;
      if (!r || !confirm('Excluir o equipamento "' + r.codigo + '"?\n\nSe houver ocorrências registradas, ele será apenas desativado.')) return;
      try {
        const d = await window.FichaRegistro.apagar('/equipamentos/' + r.id);
        fechar();
        alert(d.mensagem || 'Equipamento removido.');
        carregar();
      } catch (err) { msg(err.message, 'erro'); }
    });
    el('eqi-os-lista').addEventListener('click', (e) => {
      const b = e.target.closest('[data-os-abrir]');
      if (!b || typeof window.abrirFichaOS !== 'function') return;
      fechar();
      window.abrirFichaOS(b.dataset.osAbrir);
    });
    // Link do mapa (ordens.html#equipamento-<id>): abre a ficha direto.
    const peloEndereco = () => {
      const m = (location.hash || '').match(/^#equipamento-(\d+)$/);
      if (!m) return;
      document.querySelector('.tab-btn[data-tab="bases"]')?.click();
      mostrarVista('equipamentos');
      abrirDetalhe(m[1]);
      history.replaceState(null, '', location.pathname + location.search + '#bases');
    };
    window.addEventListener('hashchange', peloEndereco);
    setTimeout(peloEndereco, 400);
    el('eqi-cadastrar').addEventListener('click', () => irParaCadastro((c) => c.novo()));
    document.addEventListener('orbita:equipamentos-alterados', () => { if (carregado) carregar(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
