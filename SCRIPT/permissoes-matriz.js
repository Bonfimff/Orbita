//======================================================================================================
// MATRIZ DE PERMISSÕES (componente compartilhado)
// Usada no cadastro de usuário (página Cadastros) e nos perfis de acesso
// (página Gestão). A lista vem da API (services/permissoes.py), a mesma que
// bloqueia as rotas. Colunas: Ver, Editar e Criar/Excluir.
//======================================================================================================
(function () {
  'use strict';

  function authHeaders() {
    return { 'Authorization': 'Bearer ' + localStorage.getItem('token') };
  }

  const COLUNAS = [
    { acao: 'ver', rotulo: 'Ver' },
    { acao: 'editar', rotulo: 'Editar' },
    { acao: 'excluir', rotulo: 'Criar/Excluir' },
  ];
  let catalogoPermissoes = null;

  async function carregarCatalogoPermissoes() {
    if (catalogoPermissoes) return catalogoPermissoes;
    const resp = await fetch(window.apiUrl('/permissoes/catalogo'), { headers: authHeaders() });
    const dados = await resp.json();
    if (dados.status !== 'ok') throw new Error(dados.mensagem || 'Não foi possível carregar a lista de permissões.');
    catalogoPermissoes = dados.catalogo;
    return catalogoPermissoes;
  }

  // ===== Matriz de permissões (usada no form de usuário e de perfil) =====
  async function renderMatrizPermissoes(containerId, valoresAtuais) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const v = valoresAtuais || {};
    container.innerHTML = '<div class="gestao-matriz-linha"><span>Carregando permissões...</span></div>';
    let catalogo;
    try {
      catalogo = await carregarCatalogoPermissoes();
    } catch (e) {
      container.innerHTML = `<div class="gestao-matriz-linha"><span>${e.message}</span></div>`;
      return;
    }
    container.innerHTML = `
      <div class="gestao-matriz-linha gestao-matriz-cabecalho">
        <span>Permissão</span>
        ${COLUNAS.map(c => `<span>${c.rotulo.replace('/', '/<wbr>')}</span>`).join('')}
      </div>
      ${catalogo.map(g => `
        <div class="gestao-matriz-grupo" data-grupo="${g.grupo}">
          <span>${g.grupo}</span>
          ${COLUNAS.map(c => g.itens.some(i => i.acoes.includes(c.acao))
            ? `<button type="button" class="gestao-matriz-todos" data-acao="${c.acao}" title="Marcar ou desmarcar a coluna inteira deste grupo">todos</button>`
            : '<span></span>').join('')}
        </div>
        ${g.itens.map(item => {
          const atual = v[item.chave] || {};
          return `
            <div class="gestao-matriz-linha" data-modulo="${item.chave}" data-grupo="${g.grupo}">
              <span>${item.rotulo}</span>
              ${COLUNAS.map(c => item.acoes.includes(c.acao)
                ? `<input type="checkbox" class="gestao-perm" data-acao="${c.acao}" aria-label="${c.rotulo}: ${item.rotulo}" ${atual[c.acao] ? 'checked' : ''}>`
                : '<span class="gestao-matriz-vazio" aria-hidden="true"></span>').join('')}
            </div>`;
        }).join('')}
      `).join('')}
    `;
  }

  // Editar ou criar sem poder ver não faz sentido: marca "Visualizar" junto.
  // O botão "todos" do grupo marca/desmarca a coluna inteira.
  document.addEventListener('change', e => {
    const caixa = e.target.closest('.gestao-perm');
    if (!caixa || !caixa.checked || caixa.dataset.acao === 'ver') return;
    const ver = caixa.closest('.gestao-matriz-linha').querySelector('.gestao-perm[data-acao="ver"]');
    if (ver) ver.checked = true;
  });
  document.addEventListener('click', e => {
    const botao = e.target.closest('.gestao-matriz-todos');
    if (!botao) return;
    const matriz = botao.closest('.gestao-matriz-permissoes');
    const grupo = botao.closest('.gestao-matriz-grupo').dataset.grupo;
    const caixas = Array.from(matriz.querySelectorAll(`.gestao-matriz-linha[data-grupo="${grupo}"] .gestao-perm[data-acao="${botao.dataset.acao}"]`));
    const marcar = caixas.some(c => !c.checked);
    caixas.forEach(c => {
      c.checked = marcar;
      if (marcar && c.dataset.acao !== 'ver') {
        const ver = c.closest('.gestao-matriz-linha').querySelector('.gestao-perm[data-acao="ver"]');
        if (ver) ver.checked = true;
      }
    });
  });

  function coletarMatrizPermissoes(containerId) {
    const container = document.getElementById(containerId);
    const resultado = {};
    if (!container) return resultado;
    container.querySelectorAll('.gestao-matriz-linha[data-modulo]').forEach(linha => {
      const permissoes = {};
      linha.querySelectorAll('.gestao-perm').forEach(campo => {
        permissoes[campo.dataset.acao] = campo.checked ? 1 : 0;
      });
      resultado[linha.dataset.modulo] = permissoes;
    });
    return resultado;
  }

  function resumoPermissoesPerfil(permissoes) {
    if (!catalogoPermissoes) return '';
    return catalogoPermissoes.map(g => {
      let total = 0;
      let liberadas = 0;
      g.itens.forEach(item => item.acoes.forEach(acao => {
        total += 1;
        if ((permissoes[item.chave] || {})[acao]) liberadas += 1;
      }));
      const texto = liberadas === 0 ? 'Sem acesso' : (liberadas === total ? 'Completo' : `${liberadas} de ${total}`);
      return `<div class="gestao-perfil-modulo-linha"><span>${g.grupo}</span><span>${texto}</span></div>`;
    }).join('');
  }

  window.MatrizPermissoes = {
    carregar: carregarCatalogoPermissoes,
    render: renderMatrizPermissoes,
    coletar: coletarMatrizPermissoes,
    resumo: resumoPermissoesPerfil,
  };
})();
