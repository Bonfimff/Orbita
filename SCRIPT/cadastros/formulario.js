//======================================================================================================
// CADASTROS - motor de formulario e tabela
// As quatro telas de cadastro (catalogos, equipamentos, pontos, regioes) tem a
// mesma mecanica: listar, abrir painel, validar, salvar, ativar/desativar.
// Escrever isso quatro vezes multiplicaria o lugar onde uma validacao pode ser
// esquecida - entao aqui fica a mecanica, e cada tela declara apenas os campos.
//======================================================================================================
(function () {
  'use strict';

  const api = window.RelatoriosApi;
  const escapar = api.escaparHtml;
  const elemento = (id) => document.getElementById(id);

  let contextoAtual = null;   // { campos, aoSalvar, titulo }
  let registroAtual = null;

  //--------------------------------------------------------------- painel
  function abrirPainel(titulo) {
    elemento('cad-form-titulo').textContent = titulo;
    elemento('cad-form-painel').hidden = false;
    elemento('cad-form-overlay').hidden = false;
    document.body.classList.add('rel-detalhe-aberto');
  }

  function fecharPainel() {
    const tipoContexto = contextoAtual && contextoAtual.tipoContexto;
    elemento('cad-form-painel').hidden = true;
    elemento('cad-form-overlay').hidden = true;
    document.body.classList.remove('rel-detalhe-aberto');
    contextoAtual = null;
    registroAtual = null;
    if (tipoContexto) {
      document.dispatchEvent(new CustomEvent('orbita:registro-selecionado',
        { detail: { tipo: tipoContexto, id: null } }));
    }
  }

  //--------------------------------------------------------------- campos
  function renderizarCampo(campo, valor) {
    const id = 'cf-' + campo.nome;
    const obrigatorio = campo.obrigatorio ? ' <span class="cad-obrigatorio">*</span>' : '';
    // Texto de ajuda do campo: (i) com a dica ao passar o mouse; o clique abre o manual.
    const ajuda = campo.ajuda
      ? ' <button type="button" class="ajuda-contextual" data-ajuda="' + escapar(campo.topico || 'cadastros-campos')
        + '" title="' + escapar(campo.ajuda) + '" aria-label="' + escapar(campo.ajuda) + '">i</button>' : '';

    let controle;
    if (campo.tipo === 'select') {
      const opcoes = (campo.opcoes || []).map((o) =>
        '<option value="' + escapar(o.valor) + '"'
        + (String(o.valor) === String(valor ?? '') ? ' selected' : '') + '>'
        + escapar(o.texto) + '</option>').join('');
      controle = '<select id="' + id + '"' + (campo.obrigatorio ? ' required' : '') + '>'
        + '<option value="">' + escapar(campo.vazio || 'Selecione...') + '</option>'
        + opcoes + '</select>';
    } else if (campo.tipo === 'textarea') {
      controle = '<textarea id="' + id + '" rows="3" maxlength="' + (campo.max || 500) + '">'
        + escapar(valor ?? '') + '</textarea>';
    } else if (campo.tipo === 'checkbox') {
      return '<label class="cad-campo cad-campo-checkbox" for="' + id + '">'
        + '<input type="checkbox" id="' + id + '"' + (valor ? ' checked' : '') + '>'
        + '<span>' + escapar(campo.rotulo) + '</span>' + ajuda + '</label>';
    } else {
      controle = '<input type="' + (campo.tipo || 'text') + '" id="' + id + '"'
        + (campo.obrigatorio ? ' required' : '')
        + (campo.max ? ' maxlength="' + campo.max + '"' : '')
        + (campo.min !== undefined ? ' min="' + campo.min + '"' : '')
        + (campo.placeholder ? ' placeholder="' + escapar(campo.placeholder) + '"' : '')
        + ' value="' + escapar(valor ?? '') + '" autocomplete="off">';
    }

    return '<div class="cad-campo' + (campo.largo ? ' cad-campo-largo' : '') + '">'
      + '<label for="' + id + '">' + escapar(campo.rotulo) + obrigatorio + ajuda + '</label>'
      + controle + '</div>';
  }

  function coletar(campos) {
    const dados = {};
    campos.forEach((campo) => {
      const controle = elemento('cf-' + campo.nome);
      if (!controle) return;
      if (campo.tipo === 'checkbox') {
        dados[campo.nome] = controle.checked ? 1 : 0;
      } else if (campo.tipo === 'number') {
        dados[campo.nome] = controle.value === '' ? null : Number(controle.value);
      } else {
        dados[campo.nome] = controle.value.trim() === '' ? null : controle.value.trim();
      }
    });
    return dados;
  }

  function validar(campos) {
    for (const campo of campos) {
      if (!campo.obrigatorio) continue;
      const controle = elemento('cf-' + campo.nome);
      if (controle && !String(controle.value || '').trim()) {
        controle.focus();
        return 'Preencha o campo "' + campo.rotulo + '".';
      }
    }
    return null;
  }

  //---------------------------------------------------- metadados de autoria
  function blocoAutoria(registro) {
    if (!registro) return '';
    const partes = [];
    if (registro.criado_em) {
      partes.push('Criado em ' + api.dataCurta(registro.criado_em)
        + (registro.criado_por_nome ? ' por ' + escapar(registro.criado_por_nome) : ''));
    }
    if (registro.atualizado_por_nome) {
      partes.push('Última alteração por ' + escapar(registro.atualizado_por_nome)
        + (registro.atualizado_em ? ' em ' + api.dataCurta(registro.atualizado_em) : ''));
    }
    if (registro.vinculos) {
      partes.push('<b>' + registro.vinculos + ' registro(s)</b> do histórico usam este item, '
        + 'por isso ele não pode ser excluído, apenas desativado.');
    }
    return partes.length ? partes.map((p) => '<span>' + p + '</span>').join('') : '';
  }

  //--------------------------------------------------------------- abrir
  function abrir(contexto, registro) {
    contextoAtual = contexto;
    registroAtual = registro || null;
    if (contexto.tipoContexto) {
      document.dispatchEvent(new CustomEvent('orbita:registro-selecionado',
        { detail: { tipo: contexto.tipoContexto, id: registro ? registro.id : null } }));
    }

    const campos = typeof contexto.campos === 'function'
      ? contexto.campos(registro) : contexto.campos;
    contextoAtual.camposResolvidos = campos;

    elemento('cad-form-campos').innerHTML = campos
      .map((campo) => renderizarCampo(campo, registro ? registro[campo.nome] : campo.padrao))
      .join('');

    const meta = elemento('cad-form-meta');
    const html = blocoAutoria(registro);
    meta.innerHTML = html;
    meta.hidden = !html;

    abrirPainel(registro
      ? (contexto.tituloEdicao || 'Editar registro')
      : (contexto.tituloNovo || 'Novo registro'));

    const primeiro = elemento('cf-' + campos[0].nome);
    if (primeiro) setTimeout(() => primeiro.focus(), 80);
  }

  //--------------------------------------------------------------- tabela
  function renderizarLista(alvo, itens, colunas, opcoes) {
    const config = opcoes || {};
    if (!itens || !itens.length) {
      return api.estadoVazio(alvo, config.vazio || 'Nenhum registro cadastrado',
        config.vazioDetalhe);
    }

    const acoes = (item) =>
      '<div class="cad-acoes">'
      + '<button type="button" class="rel-btn-mini" data-editar="' + item.id + '">Editar</button>'
      + '<button type="button" class="rel-btn-mini" data-alternar="' + item.id + '">'
      + (item.ativo ? 'Desativar' : 'Ativar') + '</button>'
      + '<button type="button" class="rel-btn-mini rel-btn-mini-perigo" data-remover="'
      + item.id + '">Excluir</button></div>';

    const tabela = '<table class="rel-tabela"><thead><tr>'
      + colunas.map((c) => '<th' + (c.numerica ? ' class="rel-num"' : '') + '>'
          + escapar(c.titulo) + '</th>').join('')
      + '<th>Ações</th></tr></thead><tbody>'
      + itens.map((item) => '<tr' + (item.ativo ? '' : ' class="rel-linha-inativa"') + '>'
          + colunas.map((c) => '<td' + (c.numerica ? ' class="rel-num"' : '') + '>'
              + c.valor(item) + '</td>').join('')
          + '<td>' + acoes(item) + '</td></tr>').join('')
      + '</tbody></table>';

    const cards = '<ul class="rel-cards">'
      + itens.map((item) => '<li class="rel-card' + (item.ativo ? '' : ' rel-card-inativo') + '">'
          + '<div class="rel-card-topo">'
          + '<span class="rel-card-titulo">' + config.tituloCard(item) + '</span>'
          + (item.ativo ? '' : '<span class="rel-tag">inativo</span>')
          + '</div>'
          + '<dl class="rel-card-dados">'
          + colunas.filter((c) => !c.ocultarCard)
              .map((c) => '<div><dt>' + escapar(c.titulo) + '</dt><dd>'
                + c.valor(item) + '</dd></div>').join('')
          + '</dl>' + acoes(item) + '</li>').join('')
      + '</ul>';

    alvo.innerHTML = '<div class="rel-so-desktop">' + tabela + '</div>'
      + '<div class="rel-so-celular">' + cards + '</div>';

    // Delegação por container: as ações existem duas vezes na página (tabela e
    // cards) e ligar uma por uma duplicaria todos os handlers.
    alvo.querySelectorAll('[data-editar]').forEach((botao) => {
      botao.addEventListener('click', () => {
        const item = itens.find((i) => String(i.id) === botao.dataset.editar);
        if (item) config.aoEditar(item);
      });
    });
    alvo.querySelectorAll('[data-alternar]').forEach((botao) => {
      botao.addEventListener('click', () => {
        const item = itens.find((i) => String(i.id) === botao.dataset.alternar);
        if (item) config.aoAlternar(item);
      });
    });
    alvo.querySelectorAll('[data-remover]').forEach((botao) => {
      botao.addEventListener('click', () => {
        const item = itens.find((i) => String(i.id) === botao.dataset.remover);
        if (item) config.aoRemover(item);
      });
    });
  }

  function feedback(id, mensagem, tipo) {
    const caixa = elemento(id);
    if (!caixa) return;
    caixa.hidden = false;
    caixa.className = 'rel-feedback rel-feedback-' + (tipo || 'ok');
    caixa.textContent = mensagem;
    clearTimeout(caixa._temporizador);
    caixa._temporizador = setTimeout(() => { caixa.hidden = true; }, 7000);
  }

  //--------------------------------------------------------- inicializacao
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof window.inicializarAbasPadrao === 'function') {
      window.inicializarAbasPadrao();
    }

    const formulario = elemento('cad-form');
    if (formulario) {
      formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        if (!contextoAtual) return;

        const erro = validar(contextoAtual.camposResolvidos);
        if (erro) {
          return feedback(contextoAtual.feedback || 'cad-feedback', erro, 'erro');
        }

        const botao = elemento('cad-form-salvar');
        botao.disabled = true;
        try {
          await contextoAtual.aoSalvar(coletar(contextoAtual.camposResolvidos),
                                       registroAtual);
          fecharPainel();
        } catch (falha) {
          feedback(contextoAtual.feedback || 'cad-feedback', falha.message, 'erro');
        } finally {
          botao.disabled = false;
        }
      });
    }

    elemento('cad-form-fechar')?.addEventListener('click', fecharPainel);
    elemento('cad-form-cancelar')?.addEventListener('click', fecharPainel);
    elemento('cad-form-overlay')?.addEventListener('click', fecharPainel);
    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape') fecharPainel();
    });
  });

  window.CadastrosForm = {
    abrir: abrir,
    fechar: fecharPainel,
    renderizarLista: renderizarLista,
    feedback: feedback,
  };
})();
