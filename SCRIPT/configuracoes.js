//======================================================================================================
// CONFIGURAÇÕES (engrenagem no rodapé do menu)
// Minha conta (nome, e-mail), troca de senha, aparência e previsão do tempo.
// Conta e senha vão para a API (/conta, /conta/senha), que confere a
// permissão da matriz (Minha conta). As preferências de tela ficam neste
// navegador (localStorage) e são aplicadas logo no carregamento da página.
//======================================================================================================
(function () {
  'use strict';

  const PREF = {
    texto: 'kernel.pref.texto',        // 'normal' | 'grande'
    animacoes: 'kernel.pref.animacoes', // 'sim' | 'nao'
    clima: 'kernel.pref.clima',         // 'sim' | 'nao'
  };

  function lerPref(chave, padrao) {
    try { return localStorage.getItem(chave) || padrao; } catch (e) { return padrao; }
  }
  function gravarPref(chave, valor) {
    try { localStorage.setItem(chave, valor); } catch (e) { /* navegador sem armazenamento */ }
  }

  // Aplica já no carregamento (antes do resto da página montar).
  function aplicarPreferencias() {
    document.documentElement.classList.toggle('texto-grande', lerPref(PREF.texto, 'normal') === 'grande');
    document.documentElement.classList.toggle('sem-animacoes', lerPref(PREF.animacoes, 'sim') === 'nao');
  }
  aplicarPreferencias();
  window.KernelPreferencias = {
    animacoes: () => lerPref(PREF.animacoes, 'sim') !== 'nao',
    clima: () => lerPref(PREF.clima, 'sim') !== 'nao',
  };

  const url = (caminho) => (typeof window.apiUrl === 'function' ? window.apiUrl(caminho) : caminho);
  const cabecalhos = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') });
  const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let janela = null;

  function construir() {
    janela = document.createElement('div');
    janela.className = 'config-overlay';
    janela.setAttribute('role', 'dialog');
    janela.setAttribute('aria-modal', 'true');
    janela.setAttribute('aria-label', 'Configurações');
    janela.innerHTML = `
      <div class="config-painel">
        <header class="config-cabecalho">
          <span>Configurações</span>
          <button type="button" class="config-fechar" data-fechar-flutuante aria-label="Fechar">&times;</button>
        </header>
        <div class="config-corpo">
          <section class="config-bloco">
            <h3>Minha conta</h3>
            <form id="config-conta" autocomplete="off">
              <div class="config-linha-info" id="config-usuario"></div>
              <label>Nome <input type="text" id="config-nome" maxlength="150" required></label>
              <label>E-mail <input type="email" id="config-email" maxlength="150"></label>
              <label>Tipo sanguíneo
                <select id="config-sangue">
                  <option value="">Não informado</option>
                  ${['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((t) => `<option>${t}</option>`).join('')}
                </select>
              </label>
              <button type="submit" class="btn-primario">Salvar dados</button>
              <p class="config-retorno" id="config-conta-retorno" role="status"></p>
            </form>
          </section>

          <section class="config-bloco">
            <h3>Trocar senha</h3>
            <form id="config-senha" autocomplete="off">
              <label>Senha atual <input type="password" id="config-senha-atual" autocomplete="current-password" required></label>
              <label>Nova senha <input type="password" id="config-senha-nova" autocomplete="new-password" minlength="6" required></label>
              <label>Repita a nova senha <input type="password" id="config-senha-repete" autocomplete="new-password" minlength="6" required></label>
              <label class="config-check"><input type="checkbox" id="config-senha-ver"> Mostrar senhas</label>
              <button type="submit" class="btn-primario">Trocar senha</button>
              <p class="config-retorno" id="config-senha-retorno" role="status"></p>
            </form>
          </section>

          <section class="config-bloco">
            <h3>Sessão</h3>
            <form id="config-sessao" autocomplete="off">
              <div class="config-linha-info">Sua sessão expira em <strong id="config-sessao-tempo">-</strong>.</div>
              <label>Senha <input type="password" id="config-sessao-senha" autocomplete="current-password" required></label>
              <button type="submit" class="btn-primario">Renovar sessão</button>
              <p class="config-retorno" id="config-sessao-retorno" role="status"></p>
            </form>
          </section>

          <section class="config-bloco">
            <h3>Aparência</h3>
            <label class="config-check"><input type="checkbox" id="config-texto-grande"> Texto maior</label>
            <label class="config-check"><input type="checkbox" id="config-sem-animacoes"> Reduzir animações</label>
          </section>

          <section class="config-bloco">
            <h3>Previsão do tempo</h3>
            <label class="config-check"><input type="checkbox" id="config-clima"> Mostrar no painel lateral</label>
            <p class="config-nota">A mudança vale ao recarregar a página.</p>
          </section>
        </div>
      </div>`;
    document.body.appendChild(janela);

    janela.addEventListener('click', (e) => {
      if (e.target === janela || e.target.closest('.config-fechar')) fechar();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && janela.classList.contains('aberta')) fechar(); });

    // Preferências: aplicam na hora.
    const texto = janela.querySelector('#config-texto-grande');
    const anim = janela.querySelector('#config-sem-animacoes');
    const clima = janela.querySelector('#config-clima');
    texto.addEventListener('change', () => { gravarPref(PREF.texto, texto.checked ? 'grande' : 'normal'); aplicarPreferencias(); });
    anim.addEventListener('change', () => { gravarPref(PREF.animacoes, anim.checked ? 'nao' : 'sim'); aplicarPreferencias(); });
    clima.addEventListener('change', () => gravarPref(PREF.clima, clima.checked ? 'sim' : 'nao'));

    janela.querySelector('#config-senha-ver').addEventListener('change', (e) => {
      janela.querySelectorAll('#config-senha input[type="password"], #config-senha input[data-era-senha]').forEach((campo) => {
        campo.dataset.eraSenha = '1';
        campo.type = e.target.checked ? 'text' : 'password';
      });
    });

    janela.querySelector('#config-conta').addEventListener('submit', async (e) => {
      e.preventDefault();
      const retorno = janela.querySelector('#config-conta-retorno');
      await enviar('/conta', {
        nome: janela.querySelector('#config-nome').value,
        email: janela.querySelector('#config-email').value,
        tipo_sanguineo: janela.querySelector('#config-sangue').value,
      }, retorno);
    });

    janela.querySelector('#config-sessao').addEventListener('submit', async (e) => {
      e.preventDefault();
      const retorno = janela.querySelector('#config-sessao-retorno');
      mostrarRetorno(retorno, 'Renovando...', false);
      try {
        const resp = await fetch(url('/conta/renovar'), {
          method: 'POST', headers: cabecalhos(),
          body: JSON.stringify({ senha: janela.querySelector('#config-sessao-senha').value }),
        });
        const dados = await resp.json().catch(() => ({}));
        if (!resp.ok || dados.status !== 'ok' || !dados.token) throw new Error(dados.mensagem || 'Não foi possível renovar.');
        localStorage.setItem('token', dados.token);
        window.dispatchEvent(new CustomEvent('kernel:token-renovado', { detail: dados.token }));
        e.target.reset();
        atualizarTempoSessao();
        mostrarRetorno(retorno, 'Sessão renovada.', false);
      } catch (erro) {
        mostrarRetorno(retorno, erro.message, true);
      }
    });

    janela.querySelector('#config-senha').addEventListener('submit', async (e) => {
      e.preventDefault();
      const retorno = janela.querySelector('#config-senha-retorno');
      const nova = janela.querySelector('#config-senha-nova').value;
      if (nova !== janela.querySelector('#config-senha-repete').value) {
        mostrarRetorno(retorno, 'As duas novas senhas não são iguais.', true);
        return;
      }
      const ok = await enviar('/conta/senha', { atual: janela.querySelector('#config-senha-atual').value, nova }, retorno);
      if (ok) e.target.reset();
    });
  }

  function mostrarRetorno(el, texto, erro) {
    el.textContent = texto;
    el.classList.toggle('erro', Boolean(erro));
  }

  async function enviar(caminho, corpo, retorno) {
    mostrarRetorno(retorno, 'Salvando...', false);
    try {
      const resp = await fetch(url(caminho), { method: 'PUT', headers: cabecalhos(), body: JSON.stringify(corpo) });
      const dados = await resp.json().catch(() => ({}));
      if (!resp.ok || dados.status !== 'ok') throw new Error(dados.mensagem || 'Não foi possível salvar.');
      mostrarRetorno(retorno, dados.mensagem || 'Salvo.', false);
      return true;
    } catch (erro) {
      mostrarRetorno(retorno, erro.message, true);
      return false;
    }
  }

  async function carregarConta() {
    const usuario = janela.querySelector('#config-usuario');
    try {
      const resp = await fetch(url('/conta'), { headers: cabecalhos() });
      const dados = await resp.json();
      if (dados.status !== 'ok') throw new Error(dados.mensagem);
      const c = dados.conta;
      usuario.innerHTML = `Usuário: <strong>${escapar(c.usuario)}</strong>${c.cargo ? ' · ' + escapar(c.cargo) : ''}`;
      janela.querySelector('#config-nome').value = c.nome;
      janela.querySelector('#config-email').value = c.email;
      janela.querySelector('#config-sangue').value = c.tipo_sanguineo || '';
      bloquear('#config-conta', !c.pode_editar_dados, 'Seu perfil não permite alterar estes dados.');
      bloquear('#config-senha', !c.pode_trocar_senha, 'Seu perfil não permite trocar a senha. Fale com o administrador.');
    } catch (e) {
      usuario.textContent = 'Não foi possível carregar seus dados.';
    }
  }

  function bloquear(seletor, bloquear, aviso) {
    const form = janela.querySelector(seletor);
    form.querySelectorAll('input, select, button').forEach((c) => { c.disabled = bloquear; });
    const retorno = form.querySelector('.config-retorno');
    if (bloquear) mostrarRetorno(retorno, aviso, true);
    else if (retorno.classList.contains('erro') && retorno.textContent === aviso) mostrarRetorno(retorno, '', false);
  }

  // Tempo até a sessão expirar, lido do próprio token.
  let relogio = null;
  function atualizarTempoSessao() {
    const alvo = janela && janela.querySelector('#config-sessao-tempo');
    if (!alvo) return;
    try {
      const corpo = JSON.parse(atob(localStorage.getItem('token').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const resta = Math.max(0, corpo.exp - Math.floor(Date.now() / 1000));
      const h = Math.floor(resta / 3600);
      const m = Math.floor((resta % 3600) / 60);
      alvo.textContent = resta ? (h ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min`) : 'expirada';
    } catch (e) {
      alvo.textContent = '-';
    }
  }

  function abrir() {
    if (!janela) construir();
    atualizarTempoSessao();
    clearInterval(relogio);
    relogio = setInterval(atualizarTempoSessao, 15000);
    janela.querySelector('#config-texto-grande').checked = lerPref(PREF.texto, 'normal') === 'grande';
    janela.querySelector('#config-sem-animacoes').checked = lerPref(PREF.animacoes, 'sim') === 'nao';
    janela.querySelector('#config-clima').checked = lerPref(PREF.clima, 'sim') !== 'nao';
    janela.querySelectorAll('.config-retorno').forEach((r) => mostrarRetorno(r, '', false));
    janela.classList.add('aberta');
    if (window.travarRolagemFundo) window.travarRolagemFundo(true);
    carregarConta();
  }

  function fechar() {
    if (!janela || !janela.classList.contains('aberta')) return;
    janela.classList.remove('aberta');
    clearInterval(relogio);
    if (window.travarRolagemFundo) window.travarRolagemFundo(false);
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-config')) {
      e.preventDefault();
      // No celular, fecha o menu antes de abrir.
      const menuAberto = document.querySelector('.menu.aberto');
      if (menuAberto) document.querySelector('.menu-toggle')?.click();
      abrir();
    }
  });

  window.KernelConfiguracoes = { abrir, fechar };
})();
