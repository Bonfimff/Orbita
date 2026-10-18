//======================================================================================================
// BAIXAR TABELA (padrão do sistema inteiro)
// Ícone discreto de download no cabeçalho da tabela, ao lado do funil dos filtros.
// Gera planilha .xlsx organizada: título, data de geração, cabeçalho destacado, linhas zebradas,
// bordas, números e datas como valores de verdade, largura de coluna ajustada e filtro no cabeçalho.
//
// Uso: ExportarTabela.ligar('#minha-tabela', { titulo: 'Ordens de serviço', arquivo: 'ordens' });
//      opcional: dados: () => ({ colunas: [...], linhas: [[...]] }) para exportar dados próprios.
//======================================================================================================
(function () {
  'use strict';

  const LIB = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
  const ICONE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>';
  const ligados = [];
  let carregando = null;

  function carregarLib() {
    // A versão com estilo (xlsx-js-style) substitui a comum quando presente.
    if (window.XLSX && window.XLSX.__estilo) return Promise.resolve(window.XLSX);
    if (carregando) return carregando;
    carregando = new Promise((ok, erro) => {
      const anterior = window.XLSX;
      const s = document.createElement('script');
      s.src = LIB;
      s.onload = () => { const lib = window.XLSX; lib.__estilo = true; if (anterior) window.XLSX = anterior; window.XLSX_ESTILO = lib; ok(lib); };
      s.onerror = () => { carregando = null; erro(new Error('Não foi possível carregar o gerador de planilhas.')); };
      document.head.appendChild(s);
    });
    return carregando;
  }

  function visivel(el) {
    return el && el.style.display !== 'none' && !el.hidden && !el.classList.contains('tf-oculta') && getComputedStyle(el).display !== 'none';
  }

  // Lê a tabela como está na tela: colunas e linhas visíveis, sem colunas de ação.
  function lerTabela(tabela) {
    const cab = tabela.tHead && tabela.tHead.rows[tabela.tHead.rows.length - 1];
    if (!cab) return { colunas: [], linhas: [] };
    const indices = [];
    const colunas = [];
    Array.from(cab.cells).forEach((th, i) => {
      if (!visivel(th)) return;
      const nome = Array.from(th.childNodes).filter((n) => !(n.nodeType === 1 && n.matches('button, .tf-icone, .et-icone'))).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
      if (!nome || /^a[çc][õo]es$/i.test(nome) || th.dataset.coluna === 'acao') return;
      indices.push(i);
      colunas.push(nome);
    });
    const linhas = [];
    Array.from(tabela.tBodies).forEach((tb) => Array.from(tb.rows).forEach((tr) => {
      if (!visivel(tr) || tr.cells.length < indices.length || (tr.cells.length === 1 && tr.cells[0].colSpan > 1)) return;
      linhas.push(indices.map((i) => (tr.cells[i] ? tr.cells[i].innerText.replace(/\s+/g, ' ').trim() : '')));
    }));
    return { colunas, linhas };
  }

  // Data como número de série do Excel (formatado como data na célula).
  function serial(d) { return (d.getTime() - Date.UTC(1899, 11, 30)) / 86400000; }

  // Converte o texto da tela em valor de planilha (número, moeda, data).
  function valorDe(v) {
    if (v === null || v === undefined) return { v: '', t: 's' };
    if (typeof v === 'number') return { v, t: 'n', z: Number.isInteger(v) ? '#,##0' : '#,##0.00' };
    if (v instanceof Date) return { v: serial(v), t: 'n', z: 'dd/mm/yyyy', data: true };
    const s = String(v).trim();
    if (!s || s === '-' || s === '—') return { v: s === '-' ? '' : s, t: 's' };
    let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,]+(\d{2}):(\d{2}))?$/);
    if (m) {
      const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0));
      return { v: serial(d), t: 'n', z: m[4] ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy', data: true };
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (m && s.length <= 25) {
      const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0));
      return { v: serial(d), t: 'n', z: m[4] ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy', data: true };
    }
    m = s.match(/^(-?)R\$\s?(-?[\d.]+(?:,\d+)?)$/);
    if (m) return { v: Number((m[1] + m[2]).replace(/\./g, '').replace(',', '.')), t: 'n', z: '"R$" #,##0.00' };
    // Números no padrão brasileiro; códigos com zero à esquerda continuam texto.
    if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s) || /^-?\d+(,\d+)?$/.test(s)) {
      if (/^0\d/.test(s)) return { v: s, t: 's' };
      const n = Number(s.replace(/\./g, '').replace(',', '.'));
      return { v: n, t: 'n', z: s.includes(',') ? '#,##0.00' : '#,##0' };
    }
    m = s.match(/^(-?[\d.]+(?:,\d+)?)\s?%$/);
    if (m) return { v: Number(m[1].replace(/\./g, '').replace(',', '.')) / 100, t: 'n', z: '0.0%' };
    return { v: s, t: 's' };
  }

  const BORDA = { style: 'thin', color: { rgb: 'D5D9DE' } };
  const BORDAS = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };
  const FONTE = 'Calibri';

  function montar(XLSX, titulo, colunas, linhas, subtitulo) {
    const ws = {};
    const n = Math.max(colunas.length, 1);
    const larguras = colunas.map((c) => Math.min(Math.max(String(c).length + 4, 10), 50));
    const celula = (r, c, cel) => { ws[XLSX.utils.encode_cell({ r, c })] = cel; };

    celula(0, 0, { v: titulo, t: 's', s: { font: { name: FONTE, sz: 14, bold: true, color: { rgb: '1F2D3D' } } } });
    const gerado = 'Gerado em ' + new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + ' · ' + linhas.length + ' registro(s)' + (subtitulo ? ' · ' + subtitulo : '');
    celula(1, 0, { v: gerado, t: 's', s: { font: { name: FONTE, sz: 10, color: { rgb: '6B7280' } } } });

    const L0 = 3; // linha do cabeçalho
    colunas.forEach((c, j) => celula(L0, j, {
      v: c, t: 's',
      s: {
        font: { name: FONTE, sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '262626' } },
        alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
        border: BORDAS,
      },
    }));

    linhas.forEach((linha, i) => {
      const zebra = i % 2 === 1;
      colunas.forEach((_, j) => {
        const cel = valorDe(linha[j]);
        const texto = cel.data ? cel.z : (cel.z ? String(linha[j]) : String(cel.v));
        delete cel.data;
        larguras[j] = Math.min(Math.max(larguras[j], texto.length + 2), 60);
        cel.s = {
          font: { name: FONTE, sz: 11, color: { rgb: '1F2D3D' } },
          fill: zebra ? { patternType: 'solid', fgColor: { rgb: 'F4F5F7' } } : undefined,
          alignment: { vertical: 'center', horizontal: cel.t === 's' ? 'left' : (cel.z && cel.z.startsWith('dd') ? 'center' : 'right'), wrapText: texto.length > 60 },
          border: BORDAS,
          numFmt: cel.z,
        };
        if (!cel.s.fill) delete cel.s.fill;
        celula(L0 + 1 + i, j, cel);
      });
    });

    const ultima = L0 + Math.max(linhas.length, 0);
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: ultima, c: n - 1 } });
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: n - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: n - 1 } }];
    ws['!cols'] = larguras.map((w) => ({ wch: w }));
    ws['!rows'] = [{ hpt: 22 }, { hpt: 16 }, { hpt: 6 }, { hpt: 24 }];
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: L0, c: 0 }, e: { r: ultima, c: n - 1 } }) };
    return ws;
  }

  function nomeArquivo(base) {
    const limpo = String(base || 'tabela').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').toLowerCase();
    return limpo + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
  }

  async function baixar({ titulo, arquivo, colunas, linhas, subtitulo }) {
    if (!colunas || !colunas.length) { avisar('Não há colunas para baixar.'); return; }
    const XLSX = await carregarLib();
    const ws = montar(XLSX, titulo || 'Tabela', colunas, linhas || [], subtitulo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, String(titulo || 'Tabela').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
    XLSX.writeFile(wb, nomeArquivo(arquivo || titulo), { cellStyles: true });
  }

  function avisar(msg) {
    if (window.mostrarToast) window.mostrarToast(msg, 'erro');
    else if (window.mostrarMensagem) window.mostrarMensagem(msg, 'erro');
    else alert(msg);
  }

  async function executar(cfg, botao) {
    const tabela = document.querySelector(cfg.seletor);
    try {
      botao && botao.classList.add('et-carregando');
      const d = cfg.dados ? cfg.dados() : lerTabela(tabela.tagName === 'TABLE' ? tabela : tabela.querySelector('table'));
      if (!d || !d.linhas || !d.linhas.length) { avisar('A tabela está vazia. Faça uma busca antes de baixar.'); return; }
      await baixar(Object.assign({ titulo: cfg.titulo, arquivo: cfg.arquivo, subtitulo: cfg.subtitulo && cfg.subtitulo() }, d));
    } catch (e) {
      avisar(e.message || 'Não foi possível gerar a planilha.');
    } finally {
      botao && botao.classList.remove('et-carregando');
    }
  }

  function colocar(cfg) {
    const alvo = document.querySelector(cfg.seletor);
    const tabela = alvo && (alvo.tagName === 'TABLE' ? alvo : alvo.querySelector('table'));
    if (!tabela || !tabela.tHead || !tabela.tHead.rows.length) return;
    const linha = tabela.tHead.rows[0];
    colocarNaBarra(cfg, tabela);
    if (linha.querySelector('.et-icone')) return;
    const th = Array.from(linha.cells).find((c) => c.style.display !== 'none');
    if (!th) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tf-icone tf-icone-th et-icone';
    b.title = 'Baixar planilha';
    b.setAttribute('aria-label', 'Baixar planilha');
    b.innerHTML = ICONE;
    b.addEventListener('click', (e) => { e.stopPropagation(); executar(cfg, b); });
    th.classList.add('tf-th', 'et-th');
    th.appendChild(b);
  }

  // No celular o cabeçalho some (tabela vira cartões): botão "Baixar" ao lado de "Filtros".
  function colocarNaBarra(cfg, tabela) {
    const ancora = tabela.closest('.tabela-responsiva, .tabela-produtos, .frota-tabela-wrap, .rel-tabela-area') || tabela;
    let filtros = null;
    for (let el = ancora.previousElementSibling; el; el = el.previousElementSibling) {
      if (el.classList.contains('tf-barra') && !el.classList.contains('et-propria')) { filtros = el; break; }
      if (!el.classList.contains('tf-painel') && !el.classList.contains('et-propria')) break;
    }
    let propria = cfg._propria && cfg._propria.isConnected ? cfg._propria : null;
    let b = cfg._botao;
    if (!b) {
      b = cfg._botao = document.createElement('button');
      b.type = 'button';
      b.className = 'tf-icone et-barra';
      b.title = 'Baixar planilha';
      b.innerHTML = ICONE + '<span>Baixar</span>';
      b.addEventListener('click', () => executar(cfg, b));
    }
    if (filtros) {
      if (b.parentNode !== filtros) filtros.appendChild(b);
      if (propria) { propria.remove(); cfg._propria = null; }
      return;
    }
    if (!propria) {
      propria = cfg._propria = document.createElement('div');
      propria.className = 'tf-barra tf-com-th et-propria';
      ancora.parentNode.insertBefore(propria, ancora);
    }
    if (b.parentNode !== propria) propria.appendChild(b);
  }

  function ligar(seletor, cfg) {
    const c = Object.assign({ seletor }, cfg || {});
    ligados.push(c);
    colocar(c);
    return c;
  }

  // Cabeçalhos redesenhados ganham o ícone de novo.
  let t = null;
  new MutationObserver(() => { if (t) return; t = setTimeout(() => { t = null; ligados.forEach(colocar); }, 80); })
    .observe(document.documentElement, { childList: true, subtree: true });

  window.ExportarTabela = { ligar, baixar, lerTabela };
})();
