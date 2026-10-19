//======================================================================================================
// IMAGEM DO ITEM (cadastro de produto e onde mais o item puder ter imagem)
// Clicar na imagem abre: Carregar/Trocar imagem (com o editor: cortar, formato, retirar fundo),
// Ampliar e Desfazer troca. A imagem escolhida fica pendente e vai para o servidor depois que o
// item é salvo: ImagemItem.enviarPendente(idDaImagem, produtoId).
// Uso: ImagemItem.ligar('preview');  // id do <img>
//======================================================================================================
(function () {
  'use strict';

  const SEM = /Sem_imagem/;
  const pendentes = {};   // id do img -> { nova, anterior }

  function ligar(idImg, opcoes) {
    const img = document.getElementById(idImg);
    if (!img || img.dataset.imagemItem) return;
    img.dataset.imagemItem = '1';
    const caixa = img.closest('.image-preview-container') || img.parentElement;
    const somenteAmpliar = opcoes && opcoes.somenteAmpliar;
    caixa.classList.add(somenteAmpliar ? 'mov-imagem-ampliavel' : 'mov-imagem-editavel');
    if (somenteAmpliar) {
      img.addEventListener('click', () => { if (!SEM.test(img.getAttribute('src') || '') && window.EditorImagem) window.EditorImagem.ampliar(img.src, img.alt); });
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    caixa.appendChild(input);
    caixa.setAttribute('role', 'button');
    caixa.tabIndex = 0;
    caixa.title = 'Carregar ou trocar a imagem';
    let menu = null;
    const fechar = () => { if (menu) { menu.remove(); menu = null; } };
    const tem = () => !SEM.test(img.getAttribute('src') || '');
    const abrir = () => {
      fechar();
      menu = document.createElement('div');
      menu.className = 'mov-imagem-menu';
      menu.innerHTML = '<button type="button" data-img="carregar">' + (tem() ? 'Trocar imagem' : 'Carregar imagem') + '</button>' +
        (tem() ? '<button type="button" data-img="ampliar">Ampliar</button>' : '') +
        (pendentes[idImg] ? '<button type="button" data-img="desfazer">Desfazer troca</button>' : '');
      caixa.appendChild(menu);
    };
    caixa.addEventListener('click', (e) => {
      const b = e.target.closest('[data-img]');
      if (b) {
        e.stopPropagation();
        fechar();
        if (b.dataset.img === 'carregar') input.click();
        else if (b.dataset.img === 'ampliar' && window.EditorImagem) window.EditorImagem.ampliar(img.src, img.alt);
        else if (b.dataset.img === 'desfazer') { img.src = pendentes[idImg].anterior; delete pendentes[idImg]; }
        return;
      }
      if (e.target === input) return;
      menu ? fechar() : abrir();
    });
    caixa.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
    document.addEventListener('click', (e) => { if (menu && !caixa.contains(e.target)) fechar(); });
    input.addEventListener('change', async () => {
      const arq = input.files[0];
      input.value = '';
      if (!arq || !window.EditorImagem) return;
      try {
        const pronta = await window.EditorImagem.abrir(arq);
        if (!pronta) return;
        pendentes[idImg] = { nova: pronta, anterior: (pendentes[idImg] && pendentes[idImg].anterior) || img.getAttribute('src') };
        img.src = pronta;
      } catch (err) {
        alert(err.message);
      }
    });
  }

  function temPendente(idImg) { return !!pendentes[idImg]; }
  function descartar(idImg) { delete pendentes[idImg]; }

  async function enviarPendente(idImg, produtoId) {
    const p = pendentes[idImg];
    if (!p || !produtoId) return null;
    const resp = await fetch(apiUrl('/produtos/' + produtoId + '/imagem/enviar'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
      body: JSON.stringify({ imagem_base64: p.nova }),
    });
    const d = await resp.json().catch(() => ({}));
    if (!resp.ok || d.status !== 'ok') throw new Error(d.mensagem || 'Não foi possível salvar a imagem.');
    delete pendentes[idImg];
    return d;
  }

  window.ImagemItem = { ligar, enviarPendente, temPendente, descartar };
})();
