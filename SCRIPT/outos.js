document.addEventListener('DOMContentLoaded', async function() {
    // Sugestão de nomes de kits para o campo de cadastro de kit
    async function carregarNomesKitsCadastro() {
        const input = document.getElementById('nome-kit-cadastro');
        if (!input) return;
        let datalist = document.getElementById('datalist-nome-kit-cadastro');
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = 'datalist-nome-kit-cadastro';
            document.body.appendChild(datalist);
        }
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const resp = await fetch(apiUrl('/kits/sugestoes-nomes'), {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.status === 'ok' && Array.isArray(data.nomes)) {
                    datalist.innerHTML = '';
                    data.nomes.forEach(kit => {
                        if (kit.nome_do_kit) {
                            const option = document.createElement('option');
                            option.value = kit.nome_do_kit;
                            datalist.appendChild(option);
                        }
                    });
                    input.setAttribute('list', 'datalist-nome-kit-cadastro');
                }
            }
        } catch (e) {
            console.warn('Erro ao carregar nomes dos kits para cadastro:', e);
        }
    }
    // Função para carregar nomes dos kits no select de busca de kits
    async function carregarNomesKitsBusca() {
        const input = document.getElementById('nome-kit-busca');
        if (!input) return;
        // Cria datalist se não existir
        let datalist = document.getElementById('datalist-nome-kit-busca');
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = 'datalist-nome-kit-busca';
            document.body.appendChild(datalist);
        }
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const resp = await fetch(apiUrl('/kits/sugestoes-nomes'), {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.status === 'ok' && Array.isArray(data.nomes)) {
                    datalist.innerHTML = '';
                    data.nomes.forEach(kit => {
                        if (kit.nome_do_kit) {
                            const option = document.createElement('option');
                            option.value = kit.nome_do_kit;
                            datalist.appendChild(option);
                        }
                    });
                    input.setAttribute('list', 'datalist-nome-kit-busca');
                }
            }
        } catch (e) {
            console.warn('Erro ao carregar nomes dos kits para busca:', e);
        }
    }
    
    // Lista de todos os IDs de campos de categoria encontrados no HTML
    // ATENÇÃO: 'categoria-kit-cadastro' é <input type="text">, os demais são <select>
    const seletoresCategorias = [
        'categoria-produto-consulta',   // select
        'categoria-entrada',            // select
        'categoria',                    // select
        'categoria-kit',                // select
        'categoria-kit-cadastro'        // input text (Kits)
    ];

    // Lista de todos os IDs de select de patrimônio
    const seletoresPatrimonio = [
        'patrimonio-entrada', 
        'patrimonio',
        'patrimonio-cadastro',
        'patrimonio-consulta'
    ];

    // Lista de todos os IDs de select de local de estoque
    const seletoresLocalEstoque = [
        'local-estoque',
        'local-estoque-cadastro',
        'local-estoque-entrada'
    ];

    // Lista de todos os IDs de select de finalidade
    const seletoresFinalidade = [
        'retirada-finalidade',          
        'finalidade',                   
        'finalidade-entrada',           
        'finalidade-consulta'           
    ];



    // LISTA DE SELECTS DE REQUISITANTE PARA TODAS AS ABAS
    const seletoresRequisitante = [
        'retirada-requisitante',
        'requisitante',
        'requisitante-entrada',
        'requisitante-consulta',
        'devolucao-requisitante',
        'requisitante-kit'
    ];

    // LISTA DE SELECTS DE RESPONSÁVEL PARA TODAS AS ABAS
    const seletoresResponsavel = [
        'retirada-responsavel',
        'responsavel',
        'responsavel-entrada',
        'responsavel-consulta',
        'devolucao-responsavel',
        'responsavel-kit'
    ];

    // LISTA COMPLETA DE INPUTS DE NOME DE PRODUTO PARA TODAS AS ABAS
    // ATENÇÃO: 'nome-kit-cadastro' deve receber apenas nomes de kits, não produtos!
    const seletoresNomeProduto = [
        // Abas principais
        'nome-produto',                 
        'nome-produto-consulta',        
        'nome-produto-entrada',         
        'nome-produto-kit',             
        'retirada-produto',             
        'devolucao-produto',            
        'produto-nome',                 
        'nome-item',                    
        'produto',                      
        'nome-kit',
        'produto-kit-cadastro'          // Corrige autocomplete na aba de cadastro de kits
        // 'nome-kit-cadastro' removido daqui para não receber produtos
    ];


   
    //======================================================================================================
    // FUNÇÃO PRINCIPAL: Carregar Requisitantes e Responsáveis
    // Busca requisitantes no backend e preenche os selects de requisitante e responsável em todas as abas.
    //======================================================================================================
    async function carregarRequisitantes() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('❌ Token não encontrado');
                return;
            }
            const response = await fetch(apiUrl('/requisitantes'), {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                const data = await response.json();
                if (data && Array.isArray(data.requisitantes)) {
                    // Preenche selects de requisitante
                    seletoresRequisitante.forEach(seletorId => {
                        const select = document.getElementById(seletorId);
                        if (select) {
                            select.innerHTML = '';
                            const placeholder = document.createElement('option');
                            placeholder.value = '';
                            placeholder.textContent = 'Selecione um requisitante';
                            select.appendChild(placeholder);
                            data.requisitantes.forEach(req => {
                                if (req && req.nome) {
                                    const option = document.createElement('option');
                                    option.value = req.nome;
                                    option.textContent = req.nome;
                                    select.appendChild(option);
                                }
                            });
                        }
                    });
                    // Preenche selects de responsável (mesma lógica)
                    seletoresResponsavel.forEach(seletorId => {
                        const select = document.getElementById(seletorId);
                        if (select) {
                            select.innerHTML = '';
                            const placeholder = document.createElement('option');
                            placeholder.value = '';
                            placeholder.textContent = 'Selecione um responsável';
                            select.appendChild(placeholder);
                            data.requisitantes.forEach(req => {
                                if (req && req.nome) {
                                    const option = document.createElement('option');
                                    option.value = req.nome;
                                    option.textContent = req.nome;
                                    select.appendChild(option);
                                }
                            });
                        }
                    });

                    // Seleciona automaticamente o responsável na aba devolução, se possível
                    const selectDevolucaoResponsavel = document.getElementById('devolucao-responsavel');
                    if (selectDevolucaoResponsavel) {
                        // Tenta obter o nome do usuário logado do localStorage (ajuste conforme seu sistema)
                        let usuarioLogado = localStorage.getItem('usuario') || localStorage.getItem('user') || '';
                        // Tenta também pegar do token JWT se não encontrar
                        if (!usuarioLogado) {
                            const token = localStorage.getItem('token');
                            if (token) {
                                try {
                                    const payload = JSON.parse(atob(token.split('.')[1]));
                                    usuarioLogado = payload.usuario || payload.name || payload.sub || '';
                                } catch (e) {}
                            }
                        }
                        if (usuarioLogado && selectDevolucaoResponsavel.options && selectDevolucaoResponsavel.options.length) {
                            // Procura uma opção que corresponda ao usuário logado (case insensitive)
                            let found = false;
                            for (let i = 0; i < selectDevolucaoResponsavel.options.length; i++) {
                                if (
                                    selectDevolucaoResponsavel.options[i].value &&
                                    selectDevolucaoResponsavel.options[i].value.trim().toLowerCase() === usuarioLogado.trim().toLowerCase()
                                ) {
                                    selectDevolucaoResponsavel.selectedIndex = i;
                                    found = true;
                                    break;
                                }
                            }
                            // Se não encontrou, tenta selecionar a primeira opção válida
                            if (!found && selectDevolucaoResponsavel.options.length > 1) {
                                selectDevolucaoResponsavel.selectedIndex = 1;
                            }
                        }
                    }
                } else {
                    console.warn('⚠️ Nenhum requisitante retornado do backend ou estrutura inesperada:', data);
                }
            } else {
                console.error('❌ Erro ao buscar requisitantes:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar requisitantes:', error);
        }
    }

    //======================================================================================================
    // FUNÇÃO PRINCIPAL: Carregar Sugestões de ID de Retirada
    // Busca e preenche sugestões de IDs de retirada para a aba de devolução.
    //======================================================================================================
    async function carregarSugestoesIdRetirada() {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const response = await fetch(apiUrl('/retiradas/ids'), {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'ok' && Array.isArray(data.ids)) {
                    let datalist = document.getElementById('datalist-ids-retirada');
                    if (!datalist) {
                        datalist = document.createElement('datalist');
                        datalist.id = 'datalist-ids-retirada';
                        document.body.appendChild(datalist);
                    }
                    datalist.innerHTML = '';
                    data.ids.forEach(id => {
                        const option = document.createElement('option');
                        option.value = id;
                        datalist.appendChild(option);
                    });
                    // Vincula ao input imediatamente se existir
                    const vincularInput = () => {
                        const inputId = document.getElementById('devolucao-id');
                        if (inputId) {
                            inputId.setAttribute('list', 'datalist-ids-retirada');
                            // Debug visual
                            inputId.style.backgroundColor = '#e0f7fa';
                            setTimeout(() => { inputId.style.backgroundColor = ''; }, 800);
                            console.log('[DEVOLUÇÃO] Datalist de IDs de retirada vinculado ao input devolucao-id');
                        } else {
                            // Tenta novamente após um tempo se o input não existir ainda
                            setTimeout(vincularInput, 1000);
                        }
                    };
                    vincularInput();
                } else {
                    console.warn('[DEVOLUÇÃO] Nenhum id_retirada retornado do backend.');
                }
            } else {
                console.error('[DEVOLUÇÃO] Erro ao buscar ids de retirada:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('[DEVOLUÇÃO] Erro ao carregar sugestões de id_retirada:', error);
        }
    }

    // MAPEAMENTO COMPLETO DE ABAS COM SEUS COMPONENTES
    const mapeamentoCompleto = {
        // Aba Consulta de Produtos
        'nome-produto-consulta': {
            img: 'preview-produto-consulta',
            info: '.produtos-coluna-direita div[style*="text-align: center"]',
            tipo: 'consulta',
            cor: '#2196F3'
        },
        
        // Aba Cadastro de Produtos
        'nome-produto': {
            img: 'preview-produto-cadastro',
            info: '.cadastro-coluna-direita div[style*="text-align: center"]',
            tipo: 'cadastro',
            cor: '#4CAF50'
        },
        
        // Aba Entrada de Produtos
        'nome-produto-entrada': {
            img: ['preview-entrada', 'preview-produto-entrada', 'imagem-entrada'],
            info: '.entrada-coluna-direita div[style*="text-align: center"]',
            tipo: 'entrada',
            cor: '#ff4444'
        },
        

        // Aba Kits
        'nome-produto-kit': {
            img: ['preview-produto-kit', 'preview-kit', 'imagem-kit'],
            info: '.kit-coluna-direita div[style*="text-align: center"]',
            tipo: 'kit',
            cor: '#9C27B0'
        },

        // Aba Cadastro de Kit (produto do kit)
        'produto-kit-cadastro': {
            img: ['preview-kit-cadastro'],
            info: '', // Se quiser exibir info, adicione o seletor correto
            tipo: 'kit-cadastro',
            cor: '#475569'
        },
        
        // Aba Retirada
        'retirada-produto': {
            img: ['retirada-produto-img', 'preview-retirada', 'preview-produto-retirada', 'imagem-retirada'],
            info: '.retirada-coluna-direita div[style*="text-align: center"]',
            tipo: 'retirada',
            cor: '#ff6600'
        },
        
        // Aba Devolução
        'devolucao-produto': {
            img: ['devolucao-produto-img', 'preview-devolucao', 'preview-produto-devolucao', 'imagem-devolucao'],
            info: '.devolucao-coluna-direita div[style*="text-align: center"]',
            tipo: 'devolucao',
            cor: '#0066cc'
        }
    };
    

    //======================================================================================================
    // FUNÇÃO PRINCIPAL: Atualizar Select Genérico
    // Atualiza um elemento select com opções e placeholder fornecidos.
    //======================================================================================================
    function atualizarSelect(elementId, opcoes, placeholder) {
        const select = document.getElementById(elementId);
        if (!select) return false;
        
        const fragment = document.createDocumentFragment();
        
        // Adiciona placeholder
        const opcaoPlaceholder = document.createElement('option');
        opcaoPlaceholder.value = '';
        opcaoPlaceholder.textContent = placeholder;
        fragment.appendChild(opcaoPlaceholder);
        
        // Adiciona opções
        opcoes.forEach(opcao => {
            const option = document.createElement('option');
            option.value = opcao.valor;
            option.textContent = opcao.valor;
            fragment.appendChild(option);
        });
        
        select.innerHTML = '';
        select.appendChild(fragment);
        return true;
    }
    

    //======================================================================================================
    // FUNÇÃO PRINCIPAL: Carregar Categorias
    // Busca categorias do backend e preenche os selects de categoria.
    //======================================================================================================
    async function carregarCategorias() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('❌ Token não encontrado');
                return;
            }

            const response = await fetch(apiUrl('/parametros/categoria'), {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'ok' && data.categorias) {
                    seletoresCategorias.forEach(seletorId => {
                        // Campo de categoria da aba de cadastro de kits é input text, os outros são select
                        if (seletorId === 'categoria-kit-cadastro') {
                            const input = document.getElementById('categoria-kit-cadastro');
                            if (input) {
                                // Cria datalist se não existir
                                let datalist = document.getElementById('datalist-categoria-kit-cadastro');
                                if (!datalist) {
                                    datalist = document.createElement('datalist');
                                    datalist.id = 'datalist-categoria-kit-cadastro';
                                    document.body.appendChild(datalist);
                                }
                                datalist.innerHTML = '';
                                data.categorias.forEach(cat => {
                                    if (cat.valor) {
                                        const option = document.createElement('option');
                                        option.value = cat.valor;
                                        datalist.appendChild(option);
                                    }
                                });
                                input.setAttribute('list', 'datalist-categoria-kit-cadastro');
                            }
                        } else {
                            // Preenche selects normalmente
                            atualizarSelect(seletorId, data.categorias, 'Selecione uma categoria');
                        }
                    });
                }
            } else {
                console.error('❌ Erro na requisição de categorias:', response.status, response.statusText);
            }

        } catch (error) {
            console.error('❌ Erro ao carregar categorias:', error);
        }
    }


    //======================================================================================================
    // FUNÇÃO PRINCIPAL: Carregar Patrimônios
    // Busca patrimônios do backend e preenche os selects de patrimônio.
    //======================================================================================================
    async function carregarPatrimonios() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('❌ Token não encontrado');
                return;
            }

            const response = await fetch(apiUrl('/parametros/patrimonio'), {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                if (data.status === 'ok' && data.parametros) {
                    seletoresPatrimonio.forEach(seletorId => {
                        atualizarSelect(seletorId, data.parametros, 'Selecione um patrimônio');
                    });
                }
            } else {
                console.error('❌ Erro na requisição de patrimônio:', response.status, response.statusText);
            }

        } catch (error) {
            console.error('❌ Erro ao carregar patrimônios:', error);
        }
    }

    //======================================================================================================
    // FUNÇÃO PRINCIPAL: Carregar Locais de Estoque
    // Busca locais de estoque do backend e preenche os selects de local de estoque.
    //======================================================================================================
    async function carregarLocaisEstoque() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('❌ Token não encontrado');
                return;
            }

            const response = await fetch(apiUrl('/parametros/localEstoque'), {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                if (data.status === 'ok' && data.parametros) {
                    seletoresLocalEstoque.forEach(seletorId => {
                        atualizarSelect(seletorId, data.parametros, 'Selecione um local de estoque');
                    });
                }
            } else {
                console.error('❌ Erro na requisição de local de estoque:', response.status, response.statusText);
            }

        } catch (error) {
            console.error('❌ Erro ao carregar locais de estoque:', error);
        }
    }


    //======================================================================================================
    // FUNÇÃO PRINCIPAL: Carregar Finalidades
    // Busca finalidades do backend e preenche os selects de finalidade.
    //======================================================================================================
    async function carregarFinalidades() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('❌ Token não encontrado');
                return;
            }

            const response = await fetch(apiUrl('/parametros/finalidade'), {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                if (data.status === 'ok' && data.parametros) {
                    seletoresFinalidade.forEach(seletorId => {
                        atualizarSelect(seletorId, data.parametros, 'Selecione uma finalidade');
                    });
                }
            } else {
                console.error('❌ Erro na requisição de finalidade:', response.status, response.statusText);
            }

        } catch (error) {
            console.error('❌ Erro ao carregar finalidades:', error);
        }
    }

    //======================================================================================================
    // FUNÇÃO PRINCIPAL: Atualizar Select de Local de Destino
    // Atualiza um select com os locais de destino disponíveis.
    //======================================================================================================
    function atualizarSelectLocalDestino(elementId, locaisDestino, placeholder) {
        const select = document.getElementById(elementId);
        if (!select) {
            return false;
        }
        
        const fragment = document.createDocumentFragment();
        
        // Adiciona placeholder
        const opcaoPlaceholder = document.createElement('option');
        opcaoPlaceholder.value = '';
        opcaoPlaceholder.textContent = placeholder;
        fragment.appendChild(opcaoPlaceholder);
        
        // ADICIONA OPÇÕES USANDO A COLUNA "valor" DOS REGISTROS
        locaisDestino.forEach(local => {
            const option = document.createElement('option');
            option.value = local.valor;  // USA A COLUNA "valor"
            option.textContent = local.valor;  // USA A COLUNA "valor"
            
            // Adiciona atributos de dados opcionais
            if (local.id) option.setAttribute('data-id', local.id);
            if (local.nome) option.setAttribute('data-nome', local.nome);
            
            fragment.appendChild(option);
        });
        
        select.innerHTML = '';
        select.appendChild(fragment);
        
        console.log(`Select ${elementId} atualizado com ${locaisDestino.length} locais de destino`);
        return true;
    }


    //======================================================================================================
    // FUNÇÃO PRINCIPAL: Buscar Locais de Destino Alternativo
    // Busca locais de destino por variações de nome caso não encontre pelo nome padrão.
    //======================================================================================================
    async function buscarLocaisDestinoAlternativo(todosParametros) {
        console.log('🔄 Tentando busca alternativa para locais de destino...');
        
        // BUSCA POR VARIAÇÕES DO NOME
        const variacoes = [
            'localDestino',
            'local-destino', 
            'local_destino',
            'localdestino',
            'destino',
            'local'
        ];
        
        let locaisEncontrados = [];
        
        for (const variacao of variacoes) {
            const encontrados = todosParametros.filter(param => 
                param.nome === variacao && param.valor && param.valor.trim() !== ''
            );
            
            if (encontrados.length > 0) {
                console.log(`Encontrados ${encontrados.length} registros para nome = "${variacao}"`);
                locaisEncontrados = encontrados;
                break;
            }
        }

        if (locaisEncontrados.length > 0) {
            console.log('📦 Locais de destino encontrados na busca alternativa:', locaisEncontrados);
            
            const seletoresLocalDestino = [
                'retirada-local', 'local-destino', 'destino-local', 'local-retirada',
                'devolucao-local', 'transferencia-destino', 'local-transferencia',
                'destino-transferencia', 'local-destino-entrada', 'local-destino-cadastro',
                'local-destino-consulta', 'destino-entrada', 'destino-cadastro', 'destino-consulta'
            ];

            seletoresLocalDestino.forEach(seletorId => {
                atualizarSelectLocalDestino(seletorId, locaisEncontrados, 'Selecione um local de destino');
            });
        } else {
            console.warn('⚠️ Nenhum local de destino encontrado, criando dados de exemplo');
            criarDadosExemploLocalDestino();
        }
    }


    //======================================================================================================
    // FUNÇÃO PRINCIPAL: Criar Dados de Exemplo de Local de Destino
    // Cria dados simulados para locais de destino caso não haja dados reais.
    //======================================================================================================
    function criarDadosExemploLocalDestino() {
        console.log('🔧 Criando dados de exemplo para locais de destino...');
        
        // SIMULA REGISTROS ONDE nome = "localDestino" COM VALORES NA COLUNA "valor"
        const locaisExemplo = [
            { id: 1, nome: 'localDestino', valor: 'Almoxarifado Central' },
            { id: 2, nome: 'localDestino', valor: 'Setor Administrativo' },
            { id: 3, nome: 'localDestino', valor: 'Setor Operacional' },
            { id: 4, nome: 'localDestino', valor: 'Departamento de Manutenção' },
            { id: 5, nome: 'localDestino', valor: 'Escritório Principal' },
            { id: 6, nome: 'localDestino', valor: 'Depósito Secundário' },
            { id: 7, nome: 'localDestino', valor: 'Sala de Reuniões' },
            { id: 8, nome: 'localDestino', valor: 'Recepção' }
        ];

        console.log('📦 Dados de exemplo criados para locais de destino:', locaisExemplo);
        
        const seletoresLocalDestino = [
            'retirada-local', 'local-destino', 'destino-local', 'local-retirada',
            'devolucao-local', 'transferencia-destino', 'local-transferencia',
            'destino-transferencia', 'local-destino-entrada', 'local-destino-cadastro',
            'local-destino-consulta', 'destino-entrada', 'destino-cadastro', 'destino-consulta'
        ];

        seletoresLocalDestino.forEach(seletorId => {
            atualizarSelectLocalDestino(seletorId, locaisExemplo, 'Selecione um local de destino');
        });
    }

    //======================================================================================================
    // FUNÇÃO PRINCIPAL: Debug de Locais de Destino
    // Realiza debug completo dos parâmetros de locais de destino, exibindo logs detalhados.
    //======================================================================================================
    async function debugLocaisDestino() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('❌ Token não encontrado');
                return;
            }

            console.log('🧪 DEBUG COMPLETO - LOCAIS DE DESTINO');
            
            const response = await fetch(apiUrl('/parametros'), {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📋 Estrutura completa da resposta:', data);
                
                if (data.parametros && data.parametros.length > 0) {
                    console.log('📊 Total de parâmetros:', data.parametros.length);
                    
                    // MOSTRA TODOS OS VALORES ÚNICOS DA COLUNA "nome"
                    const nomesUnicos = [...new Set(data.parametros.map(p => p.nome).filter(Boolean))];
                    console.log('🏷️ Valores únicos da coluna "nome":', nomesUnicos);
                    
                    // BUSCA ESPECÍFICA POR nome = "localDestino"
                    const localDestinoExatos = data.parametros.filter(p => p.nome === 'localDestino');
                    
                    console.log('🎯 Registros onde nome = "localDestino":', localDestinoExatos);
                    
                    if (localDestinoExatos.length > 0) {
                        console.log('📝 Valores da coluna "valor" para nome = "localDestino":');
                        localDestinoExatos.forEach((param, index) => {
                            console.log(`  ${index + 1}. ID: ${param.id}, Nome: "${param.nome}", Valor: "${param.valor}"`);
                        });
                    } else {
                        console.warn('⚠️ Nenhum registro encontrado onde nome = "localDestino"');
                        
                        // Tenta busca alternativa
                        await buscarLocaisDestinoAlternativo(data.parametros);
                    }
                } else {
                    console.warn('⚠️ Nenhum parâmetro encontrado');
                }
            } else {
                console.error('❌ Erro na requisição de parâmetros:', response.status, response.statusText);
            }

        } catch (error) {
            console.error('❌ Erro ao executar debug de locais de destino:', error);
        }
    }

    //======================================================================================================
    // FUNÇÃO PRINCIPAL: Carregar Sugestões de Produtos
    // Busca sugestões de nomes de produtos e kits para autocomplete em todas as abas.
    //======================================================================================================
    async function carregarSugestoesProdutos() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('❌ Token não encontrado');
                return;
            }

            // Busca produtos normalmente
            const response = await fetch(apiUrl('/produtos/sugestoes-nomes'), {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });

            // Busca nomes de kits para incluir nas opções da aba retirada
            let kitsNomes = [];
            try {
                const kitsResp = await fetch(apiUrl('/kits/sugestoes-nomes'), {
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    }
                });
                if (kitsResp.ok) {
                    const kitsData = await kitsResp.json();
                    if (kitsData.status === 'ok' && Array.isArray(kitsData.nomes)) {
                        kitsNomes = kitsData.nomes.map(kit => ({ nome: kit.nome_do_kit, id: 'KIT_' + kit.nome_do_kit }));
                    }
                }
            } catch (e) {
                console.warn('⚠️ Não foi possível carregar nomes de kits:', e);
            }

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'ok' && data.nomes && data.nomes.length > 0) {
                    // Armazena os dados dos produtos globalmente
                    window.produtosData = {};
                    data.nomes.forEach(produto => {
                        window.produtosData[produto.nome] = produto.id;
                    });
                    // Inclui os nomes dos kits na lista de produtos apenas para a aba retirada
                    const nomesComKits = [...data.nomes];
                    if (kitsNomes.length > 0) {
                        nomesComKits.push(...kitsNomes);
                        // Também adiciona os kits ao produtosData para autocomplete
                        kitsNomes.forEach(kit => {
                            window.produtosData[kit.nome] = kit.id;
                        });
                    }
                    seletoresNomeProduto.forEach(seletorId => {
                        const inputNome = document.getElementById(seletorId);
                        if (inputNome) {
                            // Só inclui kits na aba retirada
                            if (seletorId === 'retirada-produto') {
                                configurarInputProdutoUniversal(inputNome, seletorId, nomesComKits);
                            } else {
                                configurarInputProdutoUniversal(inputNome, seletorId, data.nomes);
                            }
                        }
                    });
                    // Corrige: campo nome-kit-cadastro deve receber apenas nomes de kits
                    const inputNomeKitCadastro = document.getElementById('nome-kit-cadastro');
                    if (inputNomeKitCadastro) {
                        // Busca nomes de kits diretamente do endpoint de kits
                        fetch(apiUrl('/kits/sugestoes-nomes'), {
                            method: 'GET',
                            headers: {
                                'Authorization': 'Bearer ' + localStorage.getItem('token'),
                                'Content-Type': 'application/json'
                            }
                        })
                        .then(resp => resp.ok ? resp.json() : null)
                        .then(dataKits => {
                            if (dataKits && dataKits.status === 'ok' && Array.isArray(dataKits.nomes)) {
                                const nomesKits = dataKits.nomes.map(kit => ({ nome: kit.nome_do_kit }));
                                configurarInputProdutoUniversal(inputNomeKitCadastro, 'nome-kit-cadastro', nomesKits);
                            }
                        })
                        .catch(e => {
                            console.warn('Erro ao carregar nomes dos kits para nome-kit-cadastro:', e);
                        });
                    }
                } else {
                    console.error('❌ Nenhuma sugestão de produto encontrada');
                }
            } else {
                console.error('❌ Erro na requisição de sugestões de produtos:', response.status, response.statusText);
            }

        } catch (error) {
            console.error('❌ Erro ao carregar sugestões de produtos:', error);
        }
    }


    //======================================================================================================
    // FUNÇÃO PRINCIPAL: Configurar Input Universal de Produto
    // Configura autocomplete, eventos e datalist para inputs de produto em todas as abas.
    //======================================================================================================
    function configurarInputProdutoUniversal(inputNome, seletorId, nomes) {
        // Cria datalist otimizado
        let datalistId = `${seletorId}-sugestoes`;
        let datalist = document.getElementById(datalistId);
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = datalistId;
            document.body.appendChild(datalist);
        }
        const fragment = document.createDocumentFragment();
        nomes.forEach(nomeProduto => {
            const option = document.createElement('option');
            option.value = nomeProduto.nome;
            fragment.appendChild(option);
        });
        datalist.innerHTML = '';
        datalist.appendChild(fragment);
        inputNome.setAttribute('list', datalistId);

        // Remove event listeners anteriores
        if (inputNome._handleInput) {
            inputNome.removeEventListener('input', inputNome._handleInput);
        }
        if (inputNome._handleChange) {
            inputNome.removeEventListener('change', inputNome._handleChange);
        }
        if (inputNome._handleBlur) {
            inputNome.removeEventListener('blur', inputNome._handleBlur);
        }
        if (inputNome._handleKeydown) {
            inputNome.removeEventListener('keydown', inputNome._handleKeydown);
        }


        // Handler para input (digitação/autocomplete)
        inputNome._handleInput = debounce((e) => {
            const valor = e.target.value.trim();
            console.log('[DEBUG input] Evento input:', { valor, seletorId });
            let produtoId = null;
            if (window.produtosData && window.produtosData[valor]) {
                produtoId = window.produtosData[valor];
                console.log('[DEBUG input] Produto encontrado:', { produtoId, valor, seletorId });
                atualizarImagemProdutoUniversal(produtoId, valor, seletorId);
                // Se for um kit, mostrar os itens do kit
                if (seletorId === 'retirada-produto' && produtoId && typeof produtoId === 'string' && produtoId.startsWith('KIT_')) {
                    // Validação dos campos obrigatórios antes de mostrar o kit
                    if (!validarCamposObrigatoriosRetirada()) {
                        esconderDivItensKit();
                        e.target.value = '';
                        atualizarImagemProdutoUniversal(null, '', seletorId);
                        return;
                    }
                    mostrarItensDoKit(valor);
                } else {
                    esconderDivItensKit();
                }
            } else if (valor === '') {
                atualizarImagemProdutoUniversal(null, '', seletorId);
                esconderDivItensKit();
            }

            // Atualiza imagem do produto na aba de cadastro de kit
            if (seletorId === 'produto-kit-cadastro') {
                if (!produtoId && window.produtosData && window.produtosData[valor]) {
                    produtoId = window.produtosData[valor];
                }
                atualizarImagemProdutoUniversal(produtoId, valor, seletorId);
            }
        }, 300);

        // Handler para change (seleção via mouse/teclado)
        inputNome._handleChange = (e) => {
            const valor = e.target.value.trim();
            console.log('[DEBUG change] Evento change:', { valor, seletorId });
            let produtoId = null;
            if (window.produtosData && window.produtosData[valor]) {
                produtoId = window.produtosData[valor];
                console.log('[DEBUG change] Produto encontrado:', { produtoId, valor, seletorId });
                atualizarImagemProdutoUniversal(produtoId, valor, seletorId);
                if (seletorId === 'retirada-produto' && produtoId && typeof produtoId === 'string' && produtoId.startsWith('KIT_')) {
                    // Validação dos campos obrigatórios antes de mostrar o kit
                    if (!validarCamposObrigatoriosRetirada()) {
                        esconderDivItensKit();
                        e.target.value = '';
                        atualizarImagemProdutoUniversal(null, '', seletorId);
                        return;
                    }
                    mostrarItensDoKit(valor);
                } else {
                    esconderDivItensKit();
                }
            } else if (valor === '') {
                atualizarImagemProdutoUniversal(null, '', seletorId);
                esconderDivItensKit();
            }

            // Atualiza imagem do produto na aba de cadastro de kit
            if (seletorId === 'produto-kit-cadastro') {
                if (!produtoId && window.produtosData && window.produtosData[valor]) {
                    produtoId = window.produtosData[valor];
                }
                atualizarImagemProdutoUniversal(produtoId, valor, seletorId);
            }
        };
//======================================================================================================
// FUNÇÃO PRINCIPAL: Validar Campos Obrigatórios da Retirada
// Valida se todos os campos obrigatórios da aba Retirada estão preenchidos antes de permitir seleção de kit.
//======================================================================================================
function validarCamposObrigatoriosRetirada() {
    // IDs/Names possíveis dos campos obrigatórios
    const campos = [
        { id: 'retirada-data', name: 'data' },
        { id: 'retirada-requisitante', name: 'requisitante' },
        { id: 'retirada-responsavel', name: 'responsavel' },
        { id: 'retirada-local', name: 'local' },
        { id: 'retirada-finalidade', name: 'finalidade' }
    ];
    // Busca campo de implantação por id ou name contendo 'implant'
    let campoImplant = document.querySelector('[id*="implant" i], [name*="implant" i]');
    // Monta lista de campos a validar
    let camposValidar = [...campos];
    if (campoImplant) {
        camposValidar.push({ id: campoImplant.id, name: campoImplant.name });
    }
    let faltando = [];
    for (let campo of camposValidar) {
        let el = null;
        if (campo.id) el = document.getElementById(campo.id);
        if (!el && campo.name) el = document.querySelector(`[name="${campo.name}"]`);
        if (!el || !el.value || el.value.trim() === '') {
            faltando.push(campo.id || campo.name);
        }
    }
    if (faltando.length > 0) {
        alert('Preencha todos os campos obrigatórios antes de selecionar um kit!');
        return false;
    }
    return true;
}

//======================================================================================================
// FUNÇÃO PRINCIPAL: Mostrar Itens do Kit
// Exibe em modal flutuante os itens do kit selecionado na aba Retirada.
//======================================================================================================
        async function mostrarItensDoKit(nomeDoKit) {
            esconderDivItensKit();
            if (!nomeDoKit) return;
            // Overlay escuro
            let overlay = document.createElement('div');
            overlay.id = 'overlay-itens-kit-retirada';
            overlay.style.cssText = `
                position: fixed;
                top: 0; left: 0; width: calc(100vw / var(--zv, 1)); height: calc(100vh / var(--zv, 1));
                background: rgba(0,0,0,0.35);
                z-index: 9998;
            `;
            document.body.appendChild(overlay);
            // Div flutuante com estilo do sistema
            let div = document.createElement('div');
            div.id = 'div-itens-kit-retirada';
            div.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #fff;
                border: 2px solid rgb(60, 60, 60);
                padding: 28px 32px 20px 32px;
                border-radius: 16px;
                box-shadow: 0 8px 32px #06060622, 0 1.5px 0 #bdbdbd;
                z-index: 9999;
                min-width: 340px;
                max-width: calc(90vw / var(--zv, 1));
                max-height: calc(80vh / var(--zv, 1));
                overflow-y: auto;
                font-size: 1.08em;
                color: #060606;
            `;
            document.body.appendChild(div);
            div.innerHTML = window.htmlCarregandoLogo ? window.htmlCarregandoLogo('Carregando itens do kit...') : '<span style="color:#292929;font-weight:bold;">Carregando itens do kit...</span>';
            try {
                const token = localStorage.getItem('token');
                const resp = await fetch(apiUrl('/kits/itens'), {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ nome_do_kit: nomeDoKit })
                });
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.status === 'ok' && Array.isArray(data.itens) && data.itens.length > 0) {
                        let html = `<div style="margin-bottom:10px;"><span style='color:#292929;font-size:1.15em;'>Itens do Kit <span style=\"color:#475569\">${nomeDoKit}</span>:</span></div>`;
                        html += `<ul style='margin-bottom:14px;list-style:none;padding:0;'>`;
                        data.itens.forEach(item => {
                            html += `<li style='margin-bottom:10px;background:#fff;color:#060606;padding:7px 12px 2px 12px;border-radius:6px;display:block;border:1px solid #e0e0e0;'>` +
                                `<div style='font-weight:normal;color:#060606;font-size:1.08em;'>${item.produto}</div>` +
                                `<div style='color:#292929;font-size:0.98em;margin-top:2px;'>Qtd: <span style='color:#475569;font-weight:normal;'>${item.quantidade}</span></div>` +
                                (item.categoria && !item.categoria.includes('EPC') ? `<div style='color:#bdbdbd;font-size:0.95em;margin-top:1px;'>(${item.categoria})</div>` : '') +
                            `</li>`;
                        });
                        html += '</ul>';
                        // Campo para multiplicar o kit
                        html += `<div style='margin-bottom:12px;text-align:center;'>`;
                        html += `<label for='multiplicador-kit' style='font-weight:normal;margin-right:8px;color:#292929;'>Multiplicar kit:</label>`;
                        html += `<input id='multiplicador-kit' type='number' min='1' value='1' style='width:60px;padding:4px 6px;border:1.5px solid #475569;border-radius:4px;font-size:1em;text-align:center;background:#fff;color:#292929;'>`;
                        html += `</div>`;
                        html += `<div style='display:flex;gap:12px;justify-content:center;margin-top:10px;'>`;
                        html += `<button id='btn-adicionar-itens-kit-retirada' style='background:#fff;color:#292929;border:2px solid #475569;padding:10px 22px;border-radius:6px;cursor:pointer;font-weight:normal;font-size:1em;box-shadow:none;transition:background 0.2s;'>Adicionar à tabela de retirada</button>`;
                        html += `<button id='btn-cancelar-itens-kit-retirada' style='background:#fff;color:#292929;border:2px solid #475569;padding:10px 22px;border-radius:6px;cursor:pointer;font-size:1em;font-weight:normal;transition:background 0.2s;'>Cancelar</button>`;
                        html += `</div>`;
                        div.innerHTML = html;
                        // Remover qualquer hover laranja dos botões e usar apenas as cores do sistema
                        document.getElementById('btn-adicionar-itens-kit-retirada').onmouseover = function(){
                            this.style.background = '#f7f7f7';
                            this.style.color = '#292929';
                            this.style.borderColor = '#475569';
                        };
                        document.getElementById('btn-adicionar-itens-kit-retirada').onmouseout = function(){
                            this.style.background = '#fff';
                            this.style.color = '#292929';
                            this.style.borderColor = '#475569';
                        };
                        document.getElementById('btn-cancelar-itens-kit-retirada').onmouseover = function(){
                            this.style.background = '#f7f7f7';
                            this.style.color = '#292929';
                            this.style.borderColor = '#475569';
                        };
                        document.getElementById('btn-cancelar-itens-kit-retirada').onmouseout = function(){
                            this.style.background = '#fff';
                            this.style.color = '#292929';
                            this.style.borderColor = '#475569';
                        };
                        document.getElementById('btn-adicionar-itens-kit-retirada').onclick = () => {
                            let multiplicador = parseInt(document.getElementById('multiplicador-kit').value, 10);
                            if (isNaN(multiplicador) || multiplicador < 1) multiplicador = 1;
                            let itensMultiplicados = [];
                            for (let i = 0; i < data.itens.length; i++) {
                                const item = data.itens[i];
                                itensMultiplicados.push({
                                    ...item,
                                    quantidade: parseInt(item.quantidade, 10) * multiplicador
                                });
                            }
                            if (typeof window.adicionarItensKitNaRetirada === 'function') {
                                window.adicionarItensKitNaRetirada(itensMultiplicados, nomeDoKit);
                                esconderDivItensKit();
                                // Limpa o campo de produto após adicionar
                                if (seletorId === 'retirada-produto') {
                                    inputNome.value = '';
                                    atualizarImagemProdutoUniversal(null, '', seletorId);
                                }
                            } else {
                                alert('Função de adicionar itens do kit não implementada!');
                            }
                        };
                        document.getElementById('btn-cancelar-itens-kit-retirada').onclick = () => {
                            esconderDivItensKit();
                            // Limpa o campo de produto ao cancelar
                            if (seletorId === 'retirada-produto') {
                                inputNome.value = '';
                                atualizarImagemProdutoUniversal(null, '', seletorId);
                            }
                        };
                    } else {
                        div.innerHTML = `<span style='color:#b71c1c;'>Nenhum item encontrado para este kit.</span><br><br><button onclick='esconderDivItensKit()' style='background:#fff;color:#292929;border:2px solid #475569;padding:10px 22px;border-radius:6px;cursor:pointer;font-size:1em;font-weight:bold;margin-top:10px;'>Fechar</button>`;
                    }
                } else {
                    div.innerHTML = `<span style='color:#b71c1c;'>Erro ao buscar itens do kit.</span><br><br><button onclick='esconderDivItensKit()' style='background:#fff;color:#292929;border:2px solid #475569;padding:10px 22px;border-radius:6px;cursor:pointer;font-size:1em;font-weight:bold;margin-top:10px;'>Fechar</button>`;
                }
            } catch (e) {
                div.innerHTML = `<span style='color:#b71c1c;'>Erro ao buscar itens do kit.</span><br><br><button onclick='esconderDivItensKit()' style='background:#fff;color:#292929;border:2px solid #475569;padding:10px 22px;border-radius:6px;cursor:pointer;font-size:1em;font-weight:bold;margin-top:10px;'>Fechar</button>`;
            }
        }

//======================================================================================================
// FUNÇÃO PRINCIPAL: Esconder Div de Itens do Kit
// Remove o modal flutuante e o overlay dos itens do kit.
//======================================================================================================
        function esconderDivItensKit() {
            const div = document.getElementById('div-itens-kit-retirada');
            if (div) div.remove();
            const overlay = document.getElementById('overlay-itens-kit-retirada');
            if (overlay) overlay.remove();
        }

        // Handler para blur (validação visual e fallback para autocomplete)
        inputNome._handleBlur = (e) => {
            const valor = e.target.value.trim();
            console.log('[DEBUG blur] Evento blur:', { valor, seletorId });
            if (valor !== '' && (!window.produtosData || !window.produtosData[valor])) {
                e.target.style.borderColor = '#ff4444';
                setTimeout(() => {
                    e.target.style.borderColor = '';
                }, 3000);
            } else if (window.produtosData && window.produtosData[valor]) {
                // Garante atualização da imagem ao sair do campo
                const produtoId = window.produtosData[valor];
                console.log('[DEBUG blur] Produto encontrado:', { produtoId, valor, seletorId });
                atualizarImagemProdutoUniversal(produtoId, valor, seletorId);
            }
        };

        // Handler para Enter (seleção via teclado no autocomplete)
        inputNome._handleKeydown = (e) => {
            if (e.key === 'Enter') {
                const valor = e.target.value.trim();
                console.log('[DEBUG keydown] Evento keydown Enter:', { valor, seletorId });
                if (window.produtosData && window.produtosData[valor]) {
                    const produtoId = window.produtosData[valor];
                    console.log('[DEBUG keydown] Produto encontrado:', { produtoId, valor, seletorId });
                    atualizarImagemProdutoUniversal(produtoId, valor, seletorId);
                } else if (valor === '') {
                    atualizarImagemProdutoUniversal(null, '', seletorId);
                }
            }
        };

        inputNome.addEventListener('input', inputNome._handleInput);
        inputNome.addEventListener('change', inputNome._handleChange);
        inputNome.addEventListener('blur', inputNome._handleBlur);
        inputNome.addEventListener('keydown', inputNome._handleKeydown);
    }

   
//======================================================================================================
// FUNÇÃO PRINCIPAL: Debounce
// Função utilitária para otimizar performance de eventos, evitando execuções excessivas.
//======================================================================================================
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Funções para recarga externa
    window.recarregarCategorias = carregarCategorias;
    window.recarregarPatrimonios = carregarPatrimonios;
    window.recarregarLocaisEstoque = carregarLocaisEstoque;
    window.recarregarFinalidades = carregarFinalidades;
    window.recarregarSugestoesProdutos = carregarSugestoesProdutos;
    
    window.recarregarTodosParametros = async function() {
        await Promise.all([
            carregarCategorias(),
            carregarPatrimonios(),      
            carregarLocaisEstoque(),
            carregarFinalidades(),
            carregarSugestoesProdutos(), 
           
        ]);
    };

    // Carrega todas as funções automaticamente ao inicializar
    await Promise.all([
        carregarCategorias(),
        carregarPatrimonios(),      
        carregarLocaisEstoque(),
        carregarFinalidades(),
        carregarSugestoesProdutos(),
        carregarSugestoesIdRetirada(), 
        carregarRequisitantes(), 
        carregarNomesKitsBusca(),
        carregarNomesKitsCadastro(), // Chama sugestão de nomes de kit para o campo de cadastro
    ]);
});


//======================================================================================================
// FUNÇÃO PRINCIPAL: Atualizar Imagem Universal do Produto
// Atualiza a imagem do produto em qualquer aba do sistema.
//======================================================================================================
function atualizarImagemProdutoUniversal(produtoId, nomeProduto = '', inputId = '') {
    // DEBUG: Verifica se a função está sendo chamada corretamente
    console.log('[DEBUG atualizarImagemProdutoUniversal] inputId:', inputId, 'produtoId:', produtoId, 'nomeProduto:', nomeProduto);
    if (!inputId) return;

    // MAPEAMENTO COMPLETO DE TODAS AS ABAS
    const mapeamentoCompleto = {
        'nome-produto-consulta': {
            img: ['preview-produto-consulta'],
            info: '.produtos-coluna-direita div[style*="text-align: center"]',
            tipo: 'consulta',
            cor: '#2196F3'
        },
        'nome-produto': {
            img: ['preview-produto-cadastro'],
            info: '.cadastro-coluna-direita div[style*="text-align: center"]',
            tipo: 'cadastro',
            cor: '#4CAF50'
        },
        'nome-produto-entrada': {
            img: ['preview-entrada', 'preview-produto-entrada', 'imagem-entrada'],
            info: '.entrada-coluna-direita div[style*="text-align: center"]',
            tipo: 'entrada',
            cor: '#ff4444'
        },
        'nome-produto-kit': {
            img: ['preview-produto-kit', 'preview-kit', 'imagem-kit'],
            info: '.kit-coluna-direita div[style*="text-align: center"]',
            tipo: 'kit',
            cor: '#9C27B0'
        },
        'produto-kit-cadastro': {
            img: ['preview-kit-cadastro'],
            info: '', // Se quiser exibir info, adicione o seletor correto
            tipo: 'kit-cadastro',
            cor: '#475569'
        },
        'retirada-produto': {
            img: ['retirada-produto-img', 'preview-retirada', 'preview-produto-retirada', 'imagem-retirada'],
            info: '.retirada-coluna-direita div[style*="text-align: center"]',
            tipo: 'retirada',
            cor: '#ff6600'
        },
        'devolucao-produto': {
            img: ['devolucao-produto-img', 'preview-devolucao', 'preview-produto-devolucao', 'imagem-devolucao'],
            info: '.devolucao-coluna-direita div[style*="text-align: center"]',
            tipo: 'devolucao',
            cor: '#0066cc'
        }
    };

    const config = mapeamentoCompleto[inputId];
    if (!config) {
        console.warn('[DEBUG atualizarImagemProdutoUniversal] Campo não mapeado:', inputId);
        return;
    }

    // Busca o elemento de imagem (tenta vários IDs)
    let imgElement = null;
    for (const imgId of config.img) {
        imgElement = document.getElementById(imgId);
        if (imgElement) break;
    }
    if (!imgElement) {
        console.warn('[DEBUG atualizarImagemProdutoUniversal] Elemento de imagem não encontrado para inputId:', inputId, 'ids possíveis:', config.img);
        return;
    }

    if (!produtoId || produtoId === 'undefined' || produtoId === null) {
        imgElement.src = '../IMG/Sem_imagem.png';
        imgElement.alt = 'Imagem do Produto';
        imgElement.style.cursor = 'default';
        imgElement.onclick = null;
        
        const infoElement = document.querySelector(config.info);
        if (infoElement) {
            infoElement.innerHTML = `
                <p><strong>Imagem do Produto</strong></p>
                <p><em>Selecione um produto para visualizar sua imagem</em></p>
            `;
        }
        return;
    }
    
    // Atualiza info do produto
    let infoElement = null;
    if (config.info && typeof config.info === 'string' && config.info.trim() !== '') {
        infoElement = document.querySelector(config.info);
        if (infoElement) {
            infoElement.innerHTML = `
                <p><strong>Produto ID: ${produtoId}</strong></p>
                <p><strong>${nomeProduto || 'Carregando...'}</strong></p>
                <p><em>Clique na imagem para expandir</em></p>
            `;
        }
    }
    
    buscarImagemProdutoUniversal(produtoId, nomeProduto, config.tipo, imgElement);
}

//======================================================================================================
// FUNÇÃO PRINCIPAL: Buscar Imagem Universal do Produto
// Busca a imagem do produto no backend e atualiza o elemento de imagem correspondente.
//======================================================================================================
async function buscarImagemProdutoUniversal(produtoId, nomeProduto, tipo, imgElement) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('❌ Token não encontrado');
            return;
        }

        // Verifica cache específico por tipo
        const imagemCacheKey = `imagem_produto_${tipo}_${produtoId}`;
        const imagemCachedUrl = localStorage.getItem(imagemCacheKey);
        
        if (imagemCachedUrl) {
            mostrarImagemUniversal(imagemCachedUrl, produtoId, nomeProduto, tipo, imgElement);
            return;
        }

        // URLs para tentar
        const urls = [
            apiUrl(`/produtos/${produtoId}/imagem`)
        ];

        // LOG DE DEBUG: Veja se a função está sendo chamada e com qual produtoId
        console.log('[DEBUG buscarImagemProdutoUniversal] Buscando imagem para produtoId:', produtoId, 'nomeProduto:', nomeProduto, 'tipo:', tipo);

        for (const url of urls) {
            try {
                console.log('[DEBUG buscarImagemProdutoUniversal] Fazendo requisição GET para:', url);
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('[DEBUG buscarImagemProdutoUniversal] Resposta recebida:', data);
                    if (data.status === 'ok' && data.imagem) {
                        const imagemSrc = `data:image/${data.tipo || 'jpeg'};base64,${data.imagem}`;
                        localStorage.setItem(imagemCacheKey, imagemSrc);
                        mostrarImagemUniversal(imagemSrc, produtoId, nomeProduto, tipo, imgElement);
                        return;
                    } else {
                        console.warn('[DEBUG buscarImagemProdutoUniversal] Produto encontrado, mas sem imagem ou status diferente de ok:', data);
                    }
                } else {
                    console.warn('[DEBUG buscarImagemProdutoUniversal] Resposta não OK:', response.status, response.statusText);
                }
            } catch (error) {
                console.error('[DEBUG buscarImagemProdutoUniversal] Erro na requisição:', error);
                continue;
            }
        }
        
        mostrarImagemUniversal(null, produtoId, nomeProduto, tipo, imgElement);

    } catch (error) {
        console.error(`❌ Erro geral ao buscar imagem do produto ${produtoId} na aba ${tipo}:`, error);
        mostrarImagemUniversal(null, produtoId, nomeProduto, tipo, imgElement);
    }
}


//======================================================================================================
// FUNÇÃO PRINCIPAL: Mostrar Imagem Universal do Produto
// Exibe a imagem do produto e configura o evento para expandir a imagem.
//======================================================================================================
function mostrarImagemUniversal(imagemSrc, produtoId, nomeProduto, tipo, imgElement) {
    if (imagemSrc) {
        imgElement.onerror = () => {
            imgElement.onerror = null;
            imgElement.src = '../IMG/Sem_imagem.png';
        };
        imgElement.src = imagemSrc;
        imgElement.alt = `Imagem do Produto ${produtoId} - ${nomeProduto}`;
        imgElement.style.cursor = 'pointer';
        imgElement.title = `Clique para expandir - ${nomeProduto}`;
        imgElement.onclick = () => expandirImagemUniversal(imagemSrc, produtoId, nomeProduto, tipo);
    } else {
        imgElement.src = '../IMG/Sem_imagem.png';
        imgElement.alt = `Produto ${produtoId} sem imagem`;
        imgElement.style.cursor = 'default';
        imgElement.title = nomeProduto || 'Produto sem imagem';
        imgElement.onclick = null;
    }
}

// FUNÇÃO UNIVERSAL PARA EXPANDIR IMAGEM
function expandirImagemUniversal(imagemSrc, produtoId, nomeProduto, tipo) {
    const modalId = `modal-imagem-${tipo}`;
    
    // Remove modal existente
    const modalExistente = document.getElementById(modalId);
    if (modalExistente) {
        modalExistente.remove();
    }

    // Cores por tipo
    const cores = {
        consulta: '#2196F3',
        cadastro: '#4CAF50',
        entrada: '#ff4444',
        kit: '#9C27B0',
        retirada: '#ff6600',
        devolucao: '#0066cc',
        generico: '#757575'
    };

    // Nomes das abas
    const nomesAbas = {
        consulta: 'Consulta de Produtos',
        cadastro: 'Cadastro de Produtos',
        entrada: 'Entrada de Produtos',
        kit: 'Gestão de Kits',
        retirada: 'Retirada de Produtos',
        devolucao: 'Devolução de Produtos',
        generico: 'Visualização de Produto'
    };

    // Cria modal
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 3000;
        animation: fadeIn 0.3s ease;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
        position: relative;
        max-width: 90%;
        max-height: 90%;
        text-align: center;
        background: white;
        border-radius: 10px;
        padding: 20px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    `;

    const imagem = document.createElement('img');
    imagem.src = imagemSrc;
    imagem.style.cssText = `
        max-width: 100%;
        max-height: calc(70vh / var(--zv, 1));
        border-radius: 5px;
        margin-bottom: 15px;
    `;

    const btnFechar = document.createElement('button');
    btnFechar.innerHTML = '✕';
    btnFechar.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        width: 30px;
        height: 30px;
        border: none;
        border-radius: 50%;
        background-color: ${cores[tipo] || '#757575'};
        color: white;
        font-size: 16px;
        cursor: pointer;
        font-weight: bold;
    `;

    const info = document.createElement('div');
    info.style.cssText = `
        color: #333;
        font-size: 16px;
        margin-top: 10px;
        text-align: center;
    `;
    info.innerHTML = `
        <strong>Produto ID: ${produtoId}</strong><br>
        <strong>${nomeProduto || 'Carregando...'}</strong><br>
        <em>Aba: ${nomesAbas[tipo] || 'Visualização de Produto'}</em>
    `;

    // Eventos para fechar
    btnFechar.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    const fecharComEsc = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', fecharComEsc);
        }
    };
    document.addEventListener('keydown', fecharComEsc);

    // Monta o modal
    container.appendChild(imagem);
    container.appendChild(btnFechar);
    container.appendChild(info);
    modal.appendChild(container);
    document.body.appendChild(modal);
}

//======================================================================================================
// FUNÇÃO AUXILIAR: Preencher Campos Automáticos por Aba
// Preenche automaticamente campos de formulários conforme a aba ativa, usando dados do produto.
//======================================================================================================
function preencherCamposAutomaticos(produtoId, nomeProduto, inputId) {
    // Mapeamento de campos por aba
    const camposPorAba = {
        'nome-produto-entrada': {
            codigo: 'codigo-entrada',
            categoria: 'categoria-entrada',
            unidade: 'unid-medida-entrada'
        },
        'retirada-produto': {
            quantidade: 'retirada-quantidade',
            local: 'retirada-local'
        },
        'devolucao-produto': {
            quantidade: 'devolucao-quantidade',
            motivo: 'devolucao-motivo'
        }
    };

    const campos = camposPorAba[inputId];
    if (!campos) return;

    // Busca informações adicionais do produto
    buscarInformacoesProduto(produtoId).then(infoProduto => {
        if (infoProduto) {
            // Preenche campos específicos baseado nas informações do produto
            Object.entries(campos).forEach(([tipo, campoId]) => {
                const campo = document.getElementById(campoId);
                if (campo && !campo.value && infoProduto[tipo]) {
                    campo.value = infoProduto[tipo];
                }
            });
        }
    });
}



//  FUNÇÕES DE DEBUG UNIVERSAIS
function debugTodosOsCampos() {
    const campos = [
        'nome-produto-consulta',
        'nome-produto',
        'nome-produto-entrada',
        'nome-produto-kit',
        'retirada-produto',
        'devolucao-produto'
    ];

    campos.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (!campo) {
            console.error(`❌ Campo ${campoId} não encontrado`);
        }
    });

    if (!window.produtosData) {
        console.error('❌ Dados de produtos não carregados');
    } else {
        console.log(` ${Object.keys(window.produtosData).length} produtos carregados`);
    }
}

// FUNÇÃO GENÉRICA PARA EXPANDIR IMAGEM (COMPATIBILIDADE)
function expandirImagemProduto(imagemSrc, produtoId) {
    expandirImagemUniversal(imagemSrc, produtoId, '', 'generico');
}

// DISPONIBILIZA FUNÇÕES GLOBALMENTE
window.atualizarImagemProdutoUniversal = atualizarImagemProdutoUniversal;
window.debugTodosOsCampos = debugTodosOsCampos;
window.expandirImagemProduto = expandirImagemProduto;
window.preencherCamposAutomaticos = preencherCamposAutomaticos;


//======================================================================================================
// FUNÇÃO PRINCIPAL: Adicionar Itens do Kit na Tabela de Retirada
// Adiciona os itens de um kit selecionado diretamente na tabela de retirada, somando quantidades se já existir o produto.
//======================================================================================================
window.adicionarItensKitNaRetirada = function(itens, nomeDoKit) {
    // Seleciona a tabela de retirada pelo id correto
    const tabela = document.getElementById('tabela-retiradas');
    if (!tabela) {
        alert('Tabela de retirada não encontrada!');
        return;
    }
    // Seleciona o tbody correto
    let tbody = document.getElementById('itens-retirada');
    if (!tbody) {
        tbody = tabela.querySelector('tbody');
        if (!tbody) {
            tbody = document.createElement('tbody');
            tabela.appendChild(tbody);
        }
    }

    // Pega os valores atuais do formulário de retirada
    const destino = (document.getElementById('retirada-local') && document.getElementById('retirada-local').value) || '';
    const finalidade = (document.getElementById('retirada-finalidade') && document.getElementById('retirada-finalidade').value) || '';

    // Função para verificar se já existe o produto na tabela (pelo nome)
    function encontrarLinhaPorNomeProduto(nomeProduto) {
        const linhas = tbody.querySelectorAll('tr');
        for (let linha of linhas) {
            // Nome do produto está na primeira coluna
            const celulas = linha.querySelectorAll('td');
            if (celulas.length >= 1 && celulas[0].textContent.trim() === nomeProduto) {
                return linha;
            }
        }
        return null;
    }

    itens.forEach(item => {
        // Verifica se já existe o produto na tabela
        let linhaExistente = encontrarLinhaPorNomeProduto(item.produto);
        if (linhaExistente) {
            // Se já existe, soma a quantidade
            const celulas = linhaExistente.querySelectorAll('td');
            if (celulas.length >= 2) {
                let qtdAtual = parseInt(celulas[1].textContent.trim(), 10) || 0;
                let qtdNova = qtdAtual + (parseInt(item.quantidade, 10) || 0);
                celulas[1].textContent = qtdNova;
                // Atualiza destino e finalidade se estiverem vazios
                if (celulas[2] && !celulas[2].textContent.trim()) celulas[2].textContent = destino;
                if (celulas[3] && !celulas[3].textContent.trim()) celulas[3].textContent = finalidade;
            }
        } else {
            // Cria nova linha
            const tr = document.createElement('tr');
            // Colunas: Produto, Quantidade, Destino, Finalidade, Ações
            tr.innerHTML = `
                <td>${item.produto}</td>
                <td>${item.quantidade}</td>
                <td>${destino}</td>
                <td>${finalidade}</td>
                <td>
                    <button class="btn-editar-item" title="Editar" style="background:none;border:none;outline:none;box-shadow:none;padding:0 6px;cursor:pointer;"><img src="../IMG/editar.png" alt="Editar" style="width:18px;height:18px;vertical-align:middle;"></button>
                    <button class="btn-excluir-item" title="Excluir" style="background:none;border:none;outline:none;box-shadow:none;padding:0 6px;cursor:pointer;"><img src="../IMG/excluir.png" alt="Excluir" style="width:18px;height:18px;vertical-align:middle;"></button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });

    // Reaplica eventos de editar/excluir para os novos itens
    reaplicarEventosTabelaRetirada();
};

//======================================================================================================
// FUNÇÃO PRINCIPAL: Reaplicar Eventos na Tabela de Retirada
// Reaplica os eventos de clique para editar e excluir itens na tabela de retirada, garantindo que novos itens adicionados tenham os eventos corretamente configurados.
//======================================================================================================

window.editarItemRetirada = function(tr) {
    if (!tr) return;
    const tds = tr.querySelectorAll('td');
    if (tds.length < 4) return;

    // Extrai os valores das células
    const produto = tds[0].textContent.trim();
    const quantidade = tds[1].textContent.trim();
    const destino = tds[2].textContent.trim();
    const finalidade = tds[3].textContent.trim();

    // Preenche os campos do formulário de retirada
    document.getElementById('retirada-produto').value = produto;
    document.getElementById('retirada-quantidade').value = quantidade;
    document.getElementById('retirada-local').value = destino;
    document.getElementById('retirada-finalidade').value = finalidade;

    tr.remove();
};
function reaplicarEventosTabelaRetirada() {
    const tbody = document.getElementById('itens-retirada');
    if (!tbody) return;
    tbody.querySelectorAll('.btn-editar-item').forEach(btn => {
        btn.onclick = function(e) {
            e.preventDefault();
            // Aqui você pode chamar a função de edição já usada no sistema
            if (typeof window.editarItemRetirada === 'function') {
                window.editarItemRetirada(this.closest('tr'));
            } else {
                alert('Função de editar item não implementada!');
            }
        };
    });
    tbody.querySelectorAll('.btn-excluir-item').forEach(btn => {
        btn.onclick = function(e) {
            e.preventDefault();
            // Aqui você pode chamar a função de exclusão já usada no sistema
            if (typeof window.excluirItemRetirada === 'function') {
                window.excluirItemRetirada(this.closest('tr'));
            } else {
                // Remove a linha diretamente se não houver função global
                const tr = this.closest('tr');
                if (tr) tr.remove();
            }
        };
    });
}

//======================================================================================================
// FUNÇÃO PRINCIPAL: Configurar Clique nas Linhas da Tabela de Produtos
// Configura eventos de clique e hover nas linhas da tabela de produtos para seleção e exibição de detalhes.
//======================================================================================================
function configurarTabelaProdutos() {
    // Aguarda um pouco para garantir que a tabela foi carregada
    setTimeout(() => {
        const tabelaProdutos = document.querySelector('#tabela-produtos tbody') || 
                              document.querySelector('.tabela-produtos tbody') ||
                              document.querySelector('table tbody') ||
                              document.querySelector('#produtos-tabela tbody');
        
        if (tabelaProdutos) {
            // Remove event listeners anteriores para evitar duplicação
            if (tabelaProdutos._clickHandlerConfigured) {
                return;
            }
            
            // Marca como configurado
            tabelaProdutos._clickHandlerConfigured = true;
            
            // Adiciona event listener delegado para cliques na tabela
            tabelaProdutos.addEventListener('click', function(e) {
                // Encontra a linha clicada (tr)
                const linha = e.target.closest('tr');
                if (!linha) return;
                
                // Extrai informações da linha
                const dadosLinha = extrairDadosLinhaProduto(linha);
                if (dadosLinha) {
                    carregarImagemNaAbaProdutos(dadosLinha);
                }
            });
            
            // Também configura hover para indicar que é clicável
            tabelaProdutos.addEventListener('mouseover', function(e) {
                const linha = e.target.closest('tr');
                if (linha && linha.querySelector('td')) {
                    linha.style.backgroundColor = '#f5f5f5';
                    linha.style.cursor = 'pointer';
                }
            });
            
            tabelaProdutos.addEventListener('mouseout', function(e) {
                const linha = e.target.closest('tr');
                if (linha && linha.querySelector('td')) {
                    linha.style.backgroundColor = '';
                    linha.style.cursor = '';
                }
            });
            
        } else {
            // Tenta novamente após um tempo se a tabela não foi encontrada
            setTimeout(configurarTabelaProdutos, 2000);
        }
    }, 1000);
}

//======================================================================================================
// FUNÇÃO AUXILIAR: Extrair Dados da Linha da Tabela
// Extrai os dados de uma linha da tabela de produtos, identificando ID, nome e código do produto.
//======================================================================================================
function extrairDadosLinhaProduto(linha) {
    try {
        const celulas = linha.querySelectorAll('td');
        if (celulas.length === 0) return null;
        
        // Tenta diferentes estruturas de tabela
        let produtoId = null;
        let nomeProduto = null;
        let codigo = null;
        
// MÉTODO 1: Busca por atributos data-*
        produtoId = linha.getAttribute('data-produto-id') || 
                   linha.getAttribute('data-id') ||
                   linha.getAttribute('id');
        
// MÉTODO 2: Busca por estrutura comum de tabelas
        // Assume que: primeira coluna = ID, segunda = código, terceira = nome
        if (celulas.length >= 3) {
            if (!produtoId) {
                const primeiraColuna = celulas[0].textContent.trim();
                if (primeiraColuna && !isNaN(primeiraColuna)) {
                    produtoId = primeiraColuna;
                }
            }
            
            codigo = celulas[1].textContent.trim();
            nomeProduto = celulas[2].textContent.trim();
        }
        
// MÉTODO 3: Busca por classes específicas
        if (!produtoId) {
            const celulaId = linha.querySelector('.produto-id, .id, [data-field="id"]');
            if (celulaId) {
                produtoId = celulaId.textContent.trim();
            }
        }
        
        if (!nomeProduto) {
            const celulaNome = linha.querySelector('.produto-nome, .nome, [data-field="nome"]');
            if (celulaNome) {
                nomeProduto = celulaNome.textContent.trim();
            }
        }
        
// MÉTODO 4: Busca em todas as células por padrões
        if (!produtoId || !nomeProduto) {
            celulas.forEach((celula, index) => {
                const texto = celula.textContent.trim();
                
                // Se é um número e ainda não temos ID, pode ser o ID
                if (!produtoId && !isNaN(texto) && texto.length <= 10) {
                    produtoId = texto;
                }
                
                // Se é texto longo e ainda não temos nome, pode ser o nome
                if (!nomeProduto && texto.length > 3 && isNaN(texto)) {
                    nomeProduto = texto;
                }
            });
        }
        
        // Valida se conseguimos extrair dados mínimos
        if (produtoId && nomeProduto) {
            return {
                id: produtoId,
                nome: nomeProduto,
                codigo: codigo || ''
            };
        }
        
        return null;
        
    } catch (error) {
        console.error('❌ Erro ao extrair dados da linha da tabela:', error);
        return null;
    }
}

//======================================================================================================
// FUNÇÃO AUXILIAR: Carregar Imagem na Aba Produtos
// Atualiza campos e exibe a imagem do produto selecionado na aba de consulta de produtos.
//======================================================================================================
function carregarImagemNaAbaProdutos(dadosProduto) {
    try {
        // Atualiza o campo nome do produto na aba consulta/produtos
        const campoNomeProduto = document.getElementById('nome-produto-consulta');
        if (campoNomeProduto) {
            campoNomeProduto.value = dadosProduto.nome;
            
            // Dispara evento para atualizar a imagem
            const evento = new Event('change', { bubbles: true });
            campoNomeProduto.dispatchEvent(evento);
        }
        
        // Também atualiza outros campos se existirem
        const campoCodigo = document.getElementById('codigo-consulta') || 
                           document.getElementById('codigo-produto-consulta');
        if (campoCodigo && dadosProduto.codigo) {
            campoCodigo.value = dadosProduto.codigo;
        }
        
        // Chama diretamente a função de atualização de imagem
        atualizarImagemProdutoUniversal(dadosProduto.id, dadosProduto.nome, 'nome-produto-consulta');
        
        // Scroll suave para a área da imagem
        const imagemElemento = document.getElementById('preview-produto-consulta');
        if (imagemElemento) {
            imagemElemento.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            // Efeito visual de destaque
            imagemElemento.style.transform = 'scale(1.05)';
            imagemElemento.style.transition = 'transform 0.3s ease';
            setTimeout(() => {
                imagemElemento.style.transform = 'scale(1)';
            }, 500);
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar imagem na aba produtos:', error);
    }
}

//======================================================================================================
// FUNÇÃO AUXILIAR: Configurar Múltiplas Tabelas de Produtos
// Configura eventos de clique e hover para todas as tabelas de produtos existentes na página.
//======================================================================================================
function configurarTodasTabelasProdutos() {
    // Lista de possíveis seletores de tabelas
    const seletoresTabelas = [
        '#tabela-produtos tbody',
        '.tabela-produtos tbody',
        '#produtos-tabela tbody',
        '.produtos-tabela tbody',
        '#lista-produtos tbody',
        '.lista-produtos tbody',
        'table tbody',
        '.table tbody'
    ];
    
    seletoresTabelas.forEach(seletor => {
        const tabela = document.querySelector(seletor);
        if (tabela && !tabela._clickHandlerConfigured) {
            configurarTabelaEspecifica(tabela);
        }
    });
}

//======================================================================================================
// FUNÇÃO AUXILIAR: Configurar Tabela Específica de Produtos
// Configura eventos de clique e hover para uma tabela de produtos específica.
//======================================================================================================
function configurarTabelaEspecifica(tabelaBody) {
    try {
        // Marca como configurado
        tabelaBody._clickHandlerConfigured = true;
        
        // Event listener para cliques
        tabelaBody.addEventListener('click', function(e) {
            const linha = e.target.closest('tr');
            if (!linha) return;
            
            const dadosLinha = extrairDadosLinhaProduto(linha);
            if (dadosLinha) {
                carregarImagemNaAbaProdutos(dadosLinha);
                
                // Feedback visual
                linha.style.backgroundColor = '#e3f2fd';
                setTimeout(() => {
                    linha.style.backgroundColor = '';
                }, 1000);
            }
        });
        
        // Efeitos de hover
        tabelaBody.addEventListener('mouseover', function(e) {
            const linha = e.target.closest('tr');
            if (linha && linha.querySelector('td')) {
                linha.style.backgroundColor = '#f5f5f5';
                linha.style.cursor = 'pointer';
                linha.title = 'Clique para carregar a imagem do produto';
            }
        });
        
        tabelaBody.addEventListener('mouseout', function(e) {
            const linha = e.target.closest('tr');
            if (linha && linha.querySelector('td')) {
                linha.style.backgroundColor = '';
                linha.style.cursor = '';
                linha.title = '';
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao configurar tabela específica:', error);
    }
}

// ✅ OBSERVER PARA DETECTAR QUANDO TABELAS SÃO CARREGADAS DINAMICAMENTE
function observarTabelasProdutos() {
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            // Verifica se foram adicionados novos nós
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(function(node) {
                    // Se é um elemento HTML
                    if (node.nodeType === 1) {
                        // Verifica se é uma tabela ou contém tabelas
                        const tabelas = node.matches?.('table') ? [node] : 
                                       node.querySelectorAll?.('table') || [];
                        
                        tabelas.forEach(tabela => {
                            const tbody = tabela.querySelector('tbody');
                            if (tbody && !tbody._clickHandlerConfigured) {
                                setTimeout(() => configurarTabelaEspecifica(tbody), 500);
                            }
                        });
                    }
                });
            }
        });
    });
    
    // Observa mudanças no documento
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    return observer;
}

//======================================================================================================
// FUNÇÃO AUXILIAR: Debug de Tabelas de Produtos
// Exibe informações de debug sobre as tabelas de produtos presentes na página.
//======================================================================================================
function debugTabelasProdutos() {
    const seletoresTabelas = [
        '#tabela-produtos',
        '.tabela-produtos',
        '#produtos-tabela',
        '.produtos-tabela',
        'table'
    ];
    
    console.log('🔍 Debug Tabelas de Produtos:');
    
    seletoresTabelas.forEach(seletor => {
        const tabelas = document.querySelectorAll(seletor);
        console.log(`${seletor}: ${tabelas.length} encontrada(s)`);
        
        tabelas.forEach((tabela, index) => {
            const tbody = tabela.querySelector('tbody');
            const linhas = tbody ? tbody.querySelectorAll('tr') : [];
            console.log(`  Tabela ${index + 1}: ${linhas.length} linhas`);
            
            if (linhas.length > 0) {
                const primeiraLinha = linhas[0];
                const celulas = primeiraLinha.querySelectorAll('td');
                console.log(`  Primeira linha: ${celulas.length} colunas`);
                
                celulas.forEach((celula, colIndex) => {
                    console.log(`    Coluna ${colIndex}: "${celula.textContent.trim()}"`);
                });
            }
        });
    });
    
    if (!window.produtosData) {
        console.error('❌ Dados de produtos não carregados');
    }
}

// ATUALIZAR O EVENT LISTENER PRINCIPAL PARA INCLUIR CONFIGURAÇÃO DAS TABELAS
// Adicione esta linha no DOMContentLoaded existente:

// Dentro do DOMContentLoaded, adicione:
document.addEventListener('DOMContentLoaded', function() {
    // Configura tabelas após carregamento inicial
    setTimeout(() => {
        configurarTodasTabelasProdutos();
        observarTabelasProdutos();
    }, 2000);
});

// FUNÇÕES PARA INICIALIZAÇÃO MANUAL (caso necessário)
function inicializarTabelasProdutos() {
    configurarTodasTabelasProdutos();
    observarTabelasProdutos();
}

function reconfigurarTabelasProdutos() {
    // Remove configurações anteriores
    const tabelas = document.querySelectorAll('tbody');
    tabelas.forEach(tabela => {
        tabela._clickHandlerConfigured = false;
    });
    
    // Reconfigura
    setTimeout(() => {
        configurarTodasTabelasProdutos();
    }, 500);
}

// ADICIONAR ÀS FUNÇÕES GLOBAIS EXISTENTES
window.configurarTabelaProdutos = configurarTabelaProdutos;
window.configurarTodasTabelasProdutos = configurarTodasTabelasProdutos;
window.debugTabelasProdutos = debugTabelasProdutos;
window.inicializarTabelasProdutos = inicializarTabelasProdutos;
window.reconfigurarTabelasProdutos = reconfigurarTabelasProdutos;
window.carregarImagemNaAbaProdutos = carregarImagemNaAbaProdutos;