//============================================== cadastro de kit ===============================================================================

document.getElementById('btn-adicionar-item-kit')?.addEventListener('click', function (e) {
  e.preventDefault();

  // Obtém os valores dos campos
  const nomeKit = document.getElementById('nome-kit-cadastro')?.value.trim();
  const produto = document.getElementById('produto-kit-cadastro')?.value.trim();
  const quantidade = document.getElementById('quantidade-kit-cadastro')?.value.trim();
  const categoria = document.getElementById('categoria-kit-cadastro')?.value.trim();
  const observacao = document.getElementById('observacao-kit-cadastro')?.value.trim();

  // Validação simples
  if (!nomeKit || !produto || !quantidade) {
    alert('Preencha os campos obrigatórios: Nome do Kit, Produto e Quantidade.');
    return;
  }

  // Adiciona uma nova linha na tabela, incluindo a imagem do produto
  const tabela = document.getElementById('tabela-kits-lista-cadastro');
  if (!tabela) {
    alert('Tabela de itens do kit não encontrada!');
    return;
  }
  const tbody = tabela.querySelector('tbody') || tabela;
  const tr = document.createElement('tr');

  // Busca a imagem do produto já carregada no preview (padrão do sistema)
  let imagemSrc = '';
  const imgPreview = document.getElementById('preview-kit-cadastro');
  if (imgPreview && imgPreview.src) {
    imagemSrc = imgPreview.src;
  } else {
    imagemSrc = '../IMG/Sem_imagem.png';
  }


  tr.innerHTML = `
    <td>${nomeKit}</td>
    <td>${produto}</td>
    <td>${quantidade}</td>
    <td>${categoria}</td>
    <td>${observacao}</td>
    <td style="text-align:center;vertical-align:middle;">
      <img src="${imagemSrc}" alt="Imagem do Produto" style="max-width:60px;max-height:60px;border-radius:6px;box-shadow:0 1.5px 6px #0002;cursor:pointer;" onerror="this.onerror=null;this.src='../IMG/Sem_imagem.png';" onclick="expandirImagemProduto && expandirImagemProduto('${imagemSrc.replace(/'/g, '\'')}', '${produto}')">
    </td>
    <td style="text-align:center;vertical-align:middle;">
      <button class="btn-editar-kit-item" title="Editar" style="background:#475569;color:#222;border:none;border-radius:4px;padding:4px 8px;margin-right:4px;cursor:pointer;font-size:1em;"><svg class="icone-acao" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg></button>
      <button class="btn-excluir-kit-item" title="Excluir" style="background:#e53935;color:#fff;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:1em;"><svg class="icone-acao" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg></button>
    </td>
  `;
  tbody.appendChild(tr);

  // Adiciona listeners de ação para os botões recém-criados
  const btnEditar = tr.querySelector('.btn-editar-kit-item');
  const btnExcluir = tr.querySelector('.btn-excluir-kit-item');
  if (btnEditar) {
    btnEditar.onclick = function(e) {
      e.preventDefault();
      // Preenche os campos do formulário com os dados da linha
      document.getElementById('nome-kit-cadastro').value = tr.children[0].textContent;
      document.getElementById('produto-kit-cadastro').value = tr.children[1].textContent;
      document.getElementById('quantidade-kit-cadastro').value = tr.children[2].textContent;
      document.getElementById('categoria-kit-cadastro').value = tr.children[3].textContent;
      document.getElementById('observacao-kit-cadastro').value = tr.children[4].textContent;
      // Atualiza o preview da imagem
      const imgPreview = document.getElementById('preview-kit-cadastro');
      const imgTabela = tr.querySelector('img');
      if (imgPreview && imgTabela) {
        imgPreview.src = imgTabela.src;
        imgPreview.alt = imgTabela.alt;
        imgPreview.style.cursor = 'pointer';
        imgPreview.onclick = imgTabela.onclick;
      }
      // Remove a linha editada
      tr.remove();
    };
  }
  if (btnExcluir) {
    btnExcluir.onclick = function(e) {
      e.preventDefault();
      if (confirm('Deseja realmente excluir este item do kit?')) {
        tr.remove();
      }
    };
  }

  // Limpa os campos após adicionar (exceto categoria)
  document.getElementById('produto-kit-cadastro').value = '';
  document.getElementById('quantidade-kit-cadastro').value = '';
  // document.getElementById('categoria-kit-cadastro').value = '';
  document.getElementById('observacao-kit-cadastro').value = '';

  // Limpa a imagem do preview
  const imgPreviewLimpar = document.getElementById('preview-kit-cadastro');
  if (imgPreviewLimpar) {
    imgPreviewLimpar.src = '../IMG/Sem_imagem.png';
    imgPreviewLimpar.alt = 'Imagem do Produto';
    imgPreviewLimpar.style.cursor = 'default';
    imgPreviewLimpar.onclick = null;
  }
});

// Lógica para salvar o kit completo (todos os itens da tabela) no backend

document.getElementById('btn-salvar-kit')?.addEventListener('click', async function (e) {
  e.preventDefault();

  // Pega todos os itens da tabela
  const tabela = document.getElementById('tabela-kits-lista-cadastro');
  if (!tabela) {
    alert('Tabela de itens do kit não encontrada!');
    return;
  }
  const tbody = tabela.querySelector('tbody') || tabela;
  const linhas = tbody.querySelectorAll('tr');
  if (!linhas.length) {
    alert('Adicione ao menos um item ao kit antes de salvar.');
    return;
  }

  // Monta array de itens do kit, apenas com os campos compatíveis com o banco
  const itens = [];
  linhas.forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 7) return; // Garante que a linha tem todas as colunas
    itens.push({
      nome_do_kit: tds[0].textContent.trim(),
      produto: tds[1].textContent.trim(),
      quantidade: parseInt(tds[2].textContent.trim(), 10) || 0,
      categoria: tds[3].textContent.trim(),
      observacao: tds[4].textContent.trim()
      // id_produto pode ser adicionado aqui se necessário
    });
  });

  // Não é necessário validar o nome do kit aqui, pois cada item já possui o campo nome_do_kit
  // Se quiser validar, pode verificar se todos os itens possuem nome_do_kit preenchido
  if (!itens.length || itens.some(item => !item.nome_do_kit)) {
    alert('Preencha o nome do kit em todos os itens antes de salvar.');
    return;
  }

  // Monta o payload para o backend (formato esperado pelo backend)
  const payload = {
    kits: itens
  };

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(apiUrl('/kits/salvar'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (response.ok && data.status === 'ok') {
      alert('Kit salvo com sucesso!');
      // Limpa a tabela após salvar
      tbody.innerHTML = '';
      // Limpa campos do formulário
      document.getElementById('nome-kit-cadastro').value = '';
      document.getElementById('produto-kit-cadastro').value = '';
      document.getElementById('quantidade-kit-cadastro').value = '';
      document.getElementById('categoria-kit-cadastro').value = '';
      document.getElementById('observacao-kit-cadastro').value = '';
      const imgPreview = document.getElementById('preview-kit-cadastro');
      if (imgPreview) {
        imgPreview.src = '../IMG/Sem_imagem.png';
        imgPreview.alt = 'Imagem do Produto';
        imgPreview.style.cursor = 'default';
        imgPreview.onclick = null;
      }
    } else {
      alert('Erro ao salvar kit: ' + (data.mensagem || 'Erro desconhecido.'));
    }
  } catch (err) {
    alert('Erro ao conectar ao servidor.');
    console.error(err);
  }
});



//============================================== cadastro de fornecedor ===============================================================================

document.getElementById('btn-salvar-fornecedor-cadastro')?.addEventListener('click', async function (e) {
  e.preventDefault();

  const nome = document.getElementById('nome-fornecedor')?.value.trim();
  const representante = document.getElementById('nome-representante')?.value.trim();
  const cnpj = document.getElementById('cnpj-fornecedor')?.value.trim();
  const email = document.getElementById('email-fornecedor')?.value.trim();
  const telefone = document.getElementById('telefone-fornecedor')?.value.trim();
  const endereco = document.getElementById('endereco-fornecedor')?.value.trim();
  // O campo CEP não está no HTML, mas se existir, pode ser incluído:
  const cep = document.getElementById('cep-fornecedor')?.value.trim() || '';
  const cidade = document.getElementById('cidade-fornecedor')?.value.trim();
  const estado = document.getElementById('estado-fornecedor')?.value.trim();
  const observacoes = document.getElementById('observacoes-fornecedor')?.value.trim();
  // O campo status não existe no HTML, então envia vazio
  const status = '';

  if (!nome) {
    alert('O campo Nome é obrigatório.');
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(apiUrl('/fornecedores/salvar'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        nome, representante, cnpj, email, telefone, endereco, cep, cidade, estado, observacoes, status
      })
    });
    const data = await response.json();
    if (response.ok && data.status === 'ok') {
      alert('Fornecedor salvo com sucesso!');
      document.getElementById('form-fornecedores')?.reset();
    } else {
      alert('Erro ao salvar fornecedor: ' + (data.mensagem || 'Erro desconhecido.'));
    }
  } catch (err) {
    alert('Erro ao conectar ao servidor.');
    console.error(err);
  }
});
//============================================== cadastro de requisitante ===============================================================================

document.getElementById('btn-salvar-requisitante-cadastro')?.addEventListener('click', async function (e) {
  e.preventDefault();

  const nome = document.getElementById('nome-requisitante')?.value.trim();
  const departamento = document.getElementById('departamento-requisitante')?.value.trim();
  const email = document.getElementById('email-requisitante')?.value.trim();
  const telefone = document.getElementById('telefone-requisitante')?.value.trim();
  const cargo = document.getElementById('cargo-requisitante')?.value.trim();
  // O campo status não existe no HTML, então envia vazio
  const status = '';
  const observacoes = document.getElementById('observacoes-requisitante')?.value.trim();

  if (!nome) {
    alert('O campo Nome é obrigatório.');
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(apiUrl('/requisitantes/salvar'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        nome, departamento, email, telefone, cargo, status, observacoes
      })
    });
    const data = await response.json();
    if (response.ok && data.status === 'ok') {
      alert('Requisitante salvo com sucesso!');
      document.getElementById('form-requisitantes')?.reset();
    } else {
      alert('Erro ao salvar requisitante: ' + (data.mensagem || 'Erro desconhecido.'));
    }
  } catch (err) {
    alert('Erro ao conectar ao servidor.');
    console.error(err);
  }
});  

//============================================================================================================================
