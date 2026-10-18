//======================================================================================================
// BLOCO DE CAPACITAÇÕES (componente dos cadastros de usuário e de funcionário)
// Lista as capacitações com a situação da validade, adiciona novas, remove e
// anexa/abre o PDF do certificado. `base` é a rota do dono, por exemplo
// '/usuarios/2' ou '/funcionarios/5'.
//
// Uso: const caps = CapacitacoesUI.montar(elemento); caps.carregar('/usuarios/2');
//======================================================================================================
(function () {
  'use strict';

  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const auth = (json) => {
    const h = { Authorization: 'Bearer ' + localStorage.getItem('token') };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  };

  function montar(raiz) {
    let base = null;
    raiz.innerHTML = `
      <div class="gestao-caps-lista" data-caps-lista></div>
      <div class="gestao-caps-nova">
        <input type="text" data-cap="nome" placeholder="Capacitação (ex.: NR-10)" list="cap-sugestoes-comum" maxlength="80">
        <input type="text" data-cap="certificado" placeholder="Nº do certificado" maxlength="80">
        <label>Emissão <input type="date" data-cap="emissao"></label>
        <label>Validade <input type="date" data-cap="validade"></label>
        <button type="button" class="btn-secundario" data-cap-adicionar>Adicionar</button>
      </div>`;
    if (!document.getElementById('cap-sugestoes-comum')) {
      const lista = document.createElement('datalist');
      lista.id = 'cap-sugestoes-comum';
      lista.innerHTML = ['NR-10', 'NR-10 SEP', 'NR-35', 'NR-33', 'NR-12', 'NR-06', 'Primeiros socorros'].map((n) => `<option>${n}</option>`).join('');
      document.body.appendChild(lista);
    }
    const listaEl = raiz.querySelector('[data-caps-lista]');
    const campo = (n) => raiz.querySelector(`[data-cap="${n}"]`);

    function render(dados) {
      const pend = (dados.pendencias || []).map((p) => `<div class="gestao-caps-pendencia">${esc(p.motivo)}</div>`).join('');
      const itens = (dados.capacitacoes || []).map((c) => `
        <div class="gestao-caps-item">
          <span><strong>${esc(c.nome)}</strong>${c.certificado ? ' · ' + esc(c.certificado) : ''}
            <small>${c.validade ? 'válida até ' + c.validade.split('-').reverse().join('/') : 'sem validade'}</small></span>
          <span class="gestao-caps-selo ${esc(c.situacao)}">${esc(c.rotulo)}</span>
          ${c.tem_arquivo ? `<button type="button" class="gestao-caps-link" data-cap-ver="${c.id}">Ver PDF</button>` : ''}
          <label class="gestao-caps-link">${c.tem_arquivo ? 'Trocar PDF' : 'Anexar PDF'}<input type="file" accept="application/pdf" data-cap-arquivo="${c.id}" hidden></label>
          <button type="button" class="gestao-btn-icone" data-cap-excluir="${c.id}" title="Remover" aria-label="Remover ${esc(c.nome)}">&times;</button>
        </div>`).join('');
      listaEl.innerHTML = pend + (itens || '<p class="gestao-ajuda-texto">Nenhuma capacitação cadastrada.</p>');
    }

    async function carregar(novaBase) {
      if (novaBase) base = novaBase;
      if (!base) return;
      listaEl.innerHTML = '<p class="gestao-ajuda-texto">Carregando...</p>';
      try {
        const resp = await fetch(window.apiUrl(base + '/capacitacoes'), { headers: auth() });
        const dados = await resp.json();
        if (dados.status !== 'ok') throw new Error(dados.mensagem);
        render(dados);
      } catch (e) {
        listaEl.innerHTML = `<p class="gestao-ajuda-texto">${esc(e.message || 'Não foi possível carregar.')}</p>`;
      }
    }

    function limpar() {
      ['nome', 'certificado', 'emissao', 'validade'].forEach((n) => { campo(n).value = ''; });
    }

    raiz.addEventListener('click', async (e) => {
      if (!base) return;
      if (e.target.closest('[data-cap-adicionar]')) {
        const corpo = { nome: campo('nome').value, certificado: campo('certificado').value, emissao: campo('emissao').value, validade: campo('validade').value };
        const resp = await fetch(window.apiUrl(base + '/capacitacoes'), { method: 'POST', headers: auth(true), body: JSON.stringify(corpo) });
        const dados = await resp.json().catch(() => ({}));
        if (dados.status !== 'ok') { alert(dados.mensagem || 'Não foi possível adicionar.'); return; }
        limpar();
        render(dados);
        return;
      }
      const ver = e.target.closest('[data-cap-ver]');
      if (ver) {
        const resp = await fetch(window.apiUrl(`${base}/capacitacoes/${ver.dataset.capVer}/arquivo`), { headers: auth() });
        if (!resp.ok) { alert('Não foi possível abrir o PDF.'); return; }
        window.open(URL.createObjectURL(await resp.blob()), '_blank');
        return;
      }
      const excluir = e.target.closest('[data-cap-excluir]');
      if (excluir) {
        if (!confirm('Remover esta capacitação?')) return;
        await fetch(window.apiUrl(`${base}/capacitacoes/${excluir.dataset.capExcluir}`), { method: 'DELETE', headers: auth() });
        carregar();
      }
    });

    raiz.addEventListener('change', async (e) => {
      const arquivo = e.target.closest('[data-cap-arquivo]');
      if (!arquivo || !arquivo.files.length || !base) return;
      const formulario = new FormData();
      formulario.append('arquivo', arquivo.files[0]);
      const resp = await fetch(window.apiUrl(`${base}/capacitacoes/${arquivo.dataset.capArquivo}/arquivo`), { method: 'POST', headers: auth(), body: formulario });
      const dados = await resp.json().catch(() => ({}));
      if (dados.status !== 'ok') alert(dados.mensagem || 'Não foi possível anexar.');
      carregar();
    });

    return { carregar, limpar };
  }

  window.CapacitacoesUI = { montar };
})();
