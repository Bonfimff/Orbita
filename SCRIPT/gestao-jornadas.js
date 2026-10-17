//======================================================================================================
// GESTÃO › CONTROLE DE JORNADAS
// Quem está em jornada agora, histórico com filtros e ações administrativas
// (encerrar, cancelar). Só aparece para quem tem a permissão "Jornadas da
// equipe"; a API faz o bloqueio real.
//======================================================================================================
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);

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

  async function chamar(metodo, caminho, corpo) {
    const resposta = await fetch(urlApi(caminho), {
      method: metodo, headers: cabecalhos(), body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok || !dados || dados.status !== 'ok') {
      const erro = new Error((dados && dados.mensagem) || 'Falha na requisição');
      erro.codigo = resposta.status;
      throw erro;
    }
    return dados;
  }

  function formatarDataHora(valor) {
    if (!valor) return '-';
    const d = new Date(String(valor).replace(' ', 'T'));
    if (isNaN(d.getTime())) return valor;
    return d.toLocaleString('pt-BR');
  }

  function formatarDuracao(minutos) {
    if (minutos === null || minutos === undefined) return '-';
    const h = Math.floor(minutos / 60);
    const m = Math.round(minutos % 60);
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }

  function badge(status) {
    const rotulos = { aberta: 'Aberta', pausada: 'Pausada', encerrada: 'Encerrada', cancelada: 'Cancelada' };
    return `<span class="jor-badge jor-badge-${status}">${rotulos[status] || status}</span>`;
  }

  function mostrarMensagem(elemento, texto, tipo) {
    elemento.textContent = texto;
    elemento.className = 'jor-mensagem' + (tipo ? ' ' + tipo : '');
    if (texto) setTimeout(() => { if (elemento.textContent === texto) elemento.textContent = ''; }, 6000);
  }

  // ---------------------------------------------------------- ADMINISTRACAO
  async function carregarPainelAdmin() {
    try {
      const resp = await chamar('GET', '/jornada/painel');
      const tbody = document.querySelector('#jor-tabela-painel tbody');
      tbody.innerHTML = (resp.dados || []).map((j) => `
        <tr>
          <td>${escapar(j.usuario_nome || ('#' + j.usuario_id))}</td>
          <td>${escapar(j.contrato_nome || '-')}</td>
          <td>${badge(j.status)}</td>
          <td>${formatarDataHora(j.iniciado_em)}</td>
          <td>
            <button class="jor-btn jor-btn-admin" data-acao="encerrar" data-id="${j.id}">Encerrar</button>
            <button class="jor-btn jor-btn-admin" data-acao="cancelar" data-id="${j.id}">Cancelar</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="5">Nenhum funcionário em jornada no momento.</td></tr>';
    } catch (e) {
      if (e.codigo !== 403) console.error('[jornada] painel admin', e);
    }
  }

  async function buscarHistoricoAdmin() {
    const params = new URLSearchParams();
    const usuarioId = el('jor-filtro-usuario').value.trim();
    if (usuarioId) params.set('usuario_id', usuarioId);
    if (el('jor-filtro-status').value) params.set('status', el('jor-filtro-status').value);
    if (el('jor-filtro-inicio').value) params.set('inicio', el('jor-filtro-inicio').value);
    if (el('jor-filtro-fim').value) params.set('fim', el('jor-filtro-fim').value);
    params.set('limite', '100');

    try {
      const resp = await chamar('GET', '/jornada/buscar?' + params.toString());
      const tbody = document.querySelector('#jor-tabela-busca tbody');
      tbody.innerHTML = (resp.dados || []).map((j) => `
        <tr>
          <td>${escapar(j.usuario_nome || ('#' + j.usuario_id))}</td>
          <td>${escapar(j.contrato_nome || '-')}</td>
          <td>${formatarDataHora(j.iniciado_em)}</td>
          <td>${formatarDataHora(j.finalizado_em)}</td>
          <td>${formatarDuracao(j.duracao_minutos)}</td>
          <td>${badge(j.status)}</td>
          <td>
            ${(j.status === 'aberta' || j.status === 'pausada')
              ? `<button class="jor-btn jor-btn-admin" data-acao="encerrar" data-id="${j.id}">Encerrar</button>
                 <button class="jor-btn jor-btn-admin" data-acao="cancelar" data-id="${j.id}">Cancelar</button>`
              : '-'}
          </td>
        </tr>`).join('') || '<tr><td colspan="7">Nenhum resultado.</td></tr>';
    } catch (e) {
      mostrarMensagem(el('jor-admin-mensagem'), e.message, 'erro');
    }
  }

  function ligarAcoesAdmin() {
    el('jor-btn-buscar').addEventListener('click', buscarHistoricoAdmin);

    el('jornadas').addEventListener('click', async (ev) => {
      const botao = ev.target.closest('[data-acao]');
      if (!botao) return;
      const acao = botao.dataset.acao;
      const id = botao.dataset.id;
      if (acao === 'encerrar') {
        if (!confirm('Encerrar administrativamente esta jornada?')) return;
        try {
          await chamar('POST', `/jornada/${id}/encerrar-administrativo`, {});
          mostrarMensagem(el('jor-admin-mensagem'), 'Jornada encerrada.', 'sucesso');
          await carregarPainelAdmin();
          await buscarHistoricoAdmin();
        } catch (e) { mostrarMensagem(el('jor-admin-mensagem'), e.message, 'erro'); }
      } else if (acao === 'cancelar') {
        const motivo = prompt('Motivo do cancelamento:');
        if (!motivo) return;
        try {
          await chamar('POST', `/jornada/${id}/cancelar`, { motivo });
          mostrarMensagem(el('jor-admin-mensagem'), 'Jornada cancelada.', 'sucesso');
          await carregarPainelAdmin();
          await buscarHistoricoAdmin();
        } catch (e) { mostrarMensagem(el('jor-admin-mensagem'), e.message, 'erro'); }
      }
    });
  }

  function inicializar() {
    if (!localStorage.getItem('token') || !el('jornadas')) return;
    const iniciar = (info) => {
      const matriz = info && info.modulos && info.modulos.permissoes;
      if (matriz && !(matriz.jornada_admin || {}).ver) return;
      ligarAcoesAdmin();
      let carregado = false;
      const carregar = () => {
        if (carregado) return;
        carregado = true;
        carregarPainelAdmin();
        buscarHistoricoAdmin();
      };
      document.querySelectorAll('.tab-btn[data-tab="jornadas"]').forEach((botao) => botao.addEventListener('click', carregar));
      if (el('jornadas').classList.contains('active')) carregar();
      new MutationObserver(() => { if (el('jornadas').classList.contains('active')) carregar(); })
        .observe(el('jornadas'), { attributes: true, attributeFilter: ['class'] });
    };
    if (typeof window.obterModulos === 'function') window.obterModulos().then(iniciar, () => iniciar(null));
    else iniciar(null);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializar);
  else inicializar();
})();
