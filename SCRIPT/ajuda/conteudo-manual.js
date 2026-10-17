//======================================================================================================
// CONTEUDO: Manual
//
// Organizado por pagina (campo `pagina`): a Central abre direto no topico da
// pagina em que a pessoa esta. Texto curto e direto; so descreve o que existe.
//======================================================================================================
window.OrbitaAjuda.META = {
  produto: 'KERNEL',
  versao: 'versão 1.0',
  atualizadoEm: '16/10/2026',
};

window.OrbitaAjuda.registrarSecao({
  id: 'manual',
  rotulo: 'Manual',
  ordem: 1,
  topicos: [
    //------------------------------------------------------------------ Geral
    {
      id: 'comecar',
      grupo: 'Geral',
      titulo: 'Entrar e navegar',
      corpo: [
        { tipo: 'paragrafo', texto: 'Entre com o usuário e a senha que o administrador criou para você. Não existe cadastro próprio: contas novas são feitas em Gestão, na aba Usuários.' },
        { tipo: 'paragrafo', texto: 'Os módulos ficam na barra de cima: Estoque, Frota, Ordens de Serviço e Gestão. O menu da esquerda mostra as abas do módulo aberto. No celular, esse menu abre pelo botão de três traços.' },
        { tipo: 'paragrafo', texto: 'No rodapé do menu ficam a engrenagem (Configurações), o **(i)**, que abre esta ajuda, e o botão de sair.' },
        { tipo: 'paragrafo', texto: 'A sessão expira depois de um tempo sem uso. O sistema avisa e volta para o login; é só entrar de novo.' },
      ],
      relacionados: ['acesso'],
    },
    {
      id: 'acesso',
      grupo: 'Geral',
      titulo: 'O que você vê e pode fazer',
      corpo: [
        { tipo: 'paragrafo', texto: 'Cada pessoa tem permissões definidas no perfil de acesso ou ajustadas só para ela. Para cada parte do sistema existem três níveis: **Ver**, **Editar** e **Criar/Excluir**.' },
        { tipo: 'paragrafo', texto: 'Sem permissão, o botão nem aparece. Se aparecer e a ação for recusada, a mensagem diz o que falta.' },
        { tipo: 'paragrafo', texto: 'O contrato também limita o acesso. Quem está ligado a contratos só vê os veículos, bases e O.S. desses contratos. O que não tem contrato é geral e aparece para todos.' },
      ],
      relacionados: ['gestao-usuarios', 'gestao-contratos'],
    },
    {
      id: 'configuracoes',
      grupo: 'Geral',
      titulo: 'Configurações e troca de senha',
      corpo: [
        { tipo: 'paragrafo', texto: 'Abra pela engrenagem, no rodapé do menu. Em **Minha conta** você corrige nome, e-mail e tipo sanguíneo.' },
        { tipo: 'passos', itens: [
          'Em **Trocar senha**, digite a senha atual.',
          'Digite a nova senha duas vezes. Ela precisa ter pelo menos 6 caracteres e ser diferente da atual.',
          'Clique em Trocar senha. Na próxima vez que entrar, use a nova.',
        ] },
        { tipo: 'paragrafo', texto: 'Em **Sessão** você vê quanto tempo falta para a sessão expirar. Para renovar, digite só a senha: não precisa sair nem recarregar a página.' },
        { tipo: 'paragrafo', texto: 'Em **Aparência** você aumenta o texto ou reduz as animações. Em **Previsão do tempo** escolhe se ela aparece no painel lateral. Essas escolhas valem só neste navegador.' },
      ],
    },
    {
      id: 'cracha',
      grupo: 'Geral',
      titulo: 'Crachá digital e capacitações',
      corpo: [
        { tipo: 'paragrafo', texto: 'Clique na sua foto, no topo (no celular, no alto do menu), para abrir o crachá. Ele mostra nome, cargo, matrícula, perfil, tipo sanguíneo e as capacitações.' },
        { tipo: 'paragrafo', texto: 'Cada capacitação aparece como válida, vencendo (até 30 dias) ou vencida. Quem tem cargo de eletricista precisa de NR-10 válida; sem ela, o crachá mostra um alerta.' },
        { tipo: 'paragrafo', texto: 'O QR do crachá abre uma página de verificação com a identificação e as capacitações, sem precisar de login. Ela não mostra e-mail nem permissões.' },
        { tipo: 'paragrafo', texto: 'O tipo sanguíneo é preenchido pela própria pessoa em Configurações. As capacitações são cadastradas em Gestão, na edição do usuário.' },
      ],
      relacionados: ['configuracoes', 'gestao-usuarios'],
    },
    {
      id: 'painel-lateral',
      grupo: 'Geral',
      titulo: 'Painel lateral e previsão do tempo',
      corpo: [
        { tipo: 'paragrafo', texto: 'No computador, o painel da direita mostra informações da página e, no topo, a logo alternando com a previsão do tempo. As bolinhas embaixo trocam na hora; com o mouse em cima, a troca automática para.' },
        { tipo: 'paragrafo', texto: 'No celular, esse painel abre pelo sino, no canto de cima. Lá a previsão fica fixa no topo.' },
        { tipo: 'nota', texto: 'Por enquanto a previsão usa dados de teste.' },
      ],
    },

    //---------------------------------------------------------------- Estoque
    {
      id: 'estoque',
      grupo: 'Estoque',
      pagina: 'almoxarifado',
      titulo: 'Estoque',
      corpo: [
        { tipo: 'paragrafo', texto: 'Controla os produtos e o saldo de cada um. O **Painel Geral** resume o estoque e mostra as entradas agendadas e os itens usados em O.S. que aguardam confirmação. Em **Busca** você encontra um produto pelo nome, código ou outros dados.' },
        { tipo: 'paragrafo', texto: 'O saldo é um só para todo o sistema. Retiradas feitas pelo Estoque ou por uma O.S. descontam do mesmo lugar.' },
      ],
      relacionados: ['estoque-movimentacoes', 'estoque-cadastros'],
    },
    {
      id: 'estoque-movimentacoes',
      grupo: 'Estoque',
      pagina: 'almoxarifado',
      titulo: 'Retirada, devolução e entrada',
      corpo: [
        { tipo: 'passos', itens: [
          'Abra **Movimentações** e escolha o tipo: retirada, devolução ou entrada.',
          'Informe o produto e a quantidade. Na retirada, preencha também quem pediu e para onde vai.',
          'Salve. O saldo é atualizado na hora.',
        ] },
        { tipo: 'paragrafo', texto: 'Um lançamento confirmado não é apagado. Se houve erro, faça o movimento contrário (uma devolução, por exemplo) para o histórico continuar correto.' },
      ],
      relacionados: ['estoque', 'os-atendimento'],
    },
    {
      id: 'estoque-cadastros',
      grupo: 'Estoque',
      pagina: 'almoxarifado',
      titulo: 'Produtos, kits e fornecedores',
      corpo: [
        { tipo: 'paragrafo', texto: 'Em **Cadastros** ficam os requisitantes, os fornecedores, os produtos, os parâmetros e os kits (grupos de produtos retirados juntos).' },
        { tipo: 'paragrafo', texto: 'Para editar ou excluir um produto, encontre-o na **Busca** e clique na linha. Em Editar produto, os campos já vêm preenchidos; altere o que precisar e salve.' },
      ],
    },

    //------------------------------------------------------------------ Frota
    {
      id: 'frota',
      grupo: 'Frota',
      pagina: 'frota',
      titulo: 'Frota',
      corpo: [
        { tipo: 'paragrafo', texto: 'O **Painel** mostra os totais da frota e o mapa com a posição dos veículos. As outras abas são de consulta e trabalho: Veículos, Manutenção, Abastecimento, Checklist e Relatórios.' },
        { tipo: 'paragrafo', texto: 'Todos os formulários ficam em **Cadastros**: veículos, oficinas, cartões de abastecimento e manutenção. As tabelas ficam nas abas de trabalho. Clicar numa linha abre os detalhes, e o botão Editar leva ao cadastro já preenchido.' },
      ],
      relacionados: ['frota-veiculos', 'frota-manutencao'],
    },
    {
      id: 'frota-veiculos',
      grupo: 'Frota',
      pagina: 'frota',
      titulo: 'Veículos',
      corpo: [
        { tipo: 'paragrafo', texto: 'A aba **Veículos** lista a frota com a situação de cada um: disponível, em operação, em manutenção ou inativo. Um veículo alocado numa O.S. em andamento aparece como em operação automaticamente.' },
        { tipo: 'paragrafo', texto: 'Ao clicar num veículo, os detalhes mostram os dados principais. Ali mesmo dá para trocar o status (Ativo, Em manutenção, Inativo) e criar alertas de troca de óleo, filtro e revisão, por quilometragem ou por data.' },
        { tipo: 'paragrafo', texto: 'Para cadastrar, use **Cadastros › Veículos**. A placa não pode se repetir. Se o veículo tiver contrato, só quem tem acesso a esse contrato o vê.' },
      ],
      relacionados: ['frota-manutencao', 'os-atendimento'],
    },
    {
      id: 'frota-manutencao',
      grupo: 'Frota',
      pagina: 'frota',
      titulo: 'Manutenção, abastecimento e checklist',
      corpo: [
        { tipo: 'paragrafo', texto: 'Uma manutenção pode ser agendada ou já começar em andamento. Enquanto está em andamento, o veículo fica "em manutenção" e não pode ir para uma O.S. Ao concluir ou cancelar, ele volta a ficar ativo.' },
        { tipo: 'paragrafo', texto: 'O abastecimento registra placa, cartão, data e comprovante. O checklist registra a quilometragem, a conferência de itens e as fotos; uma quilometragem maior que a atual atualiza o veículo.' },
      ],
      relacionados: ['frota-veiculos', 'frota-relatorio'],
    },
    {
      id: 'frota-relatorio',
      grupo: 'Frota',
      pagina: 'frota',
      titulo: 'Relatório da frota',
      corpo: [
        { tipo: 'paragrafo', texto: 'Escolha o período e, se quiser, filtre por veículo, contrato ou tipo de manutenção. O relatório mostra disponibilidade, custo de manutenção, uso em O.S., abastecimentos e alertas vencidos, com gráficos e um resumo por veículo.' },
        { tipo: 'paragrafo', texto: 'O botão **Baixar tabela** gera um arquivo que abre no Excel.' },
      ],
    },

    //------------------------------------------------------- Ordens de Serviço
    {
      id: 'os',
      grupo: 'Ordens de Serviço',
      pagina: 'ordens',
      titulo: 'Ordens de Serviço',
      corpo: [
        { tipo: 'paragrafo', texto: 'O **Painel** mostra as O.S. por situação e o mapa com bases e veículos. **Bases** lista os locais atendidos, **Cronograma** mostra os agendamentos e **Busca** encontra qualquer O.S. por número, período, status, solicitante ou técnico.' },
        { tipo: 'paragrafo', texto: 'Os formulários ficam em **Cadastros**: Nova O.S., Base e Agendamento.' },
      ],
      relacionados: ['os-abrir', 'os-atendimento'],
    },
    {
      id: 'os-abrir',
      grupo: 'Ordens de Serviço',
      pagina: 'ordens',
      titulo: 'Abrir uma O.S.',
      corpo: [
        { tipo: 'passos', itens: [
          'Vá em **Cadastros › Nova O.S.** (ou use o botão Nova O.S. na Busca).',
          'Preencha solicitante, tipo de serviço, prioridade, descrição e contrato.',
          'Adicione os pontos de atendimento. Digite o ID da base e clique em Buscar para o endereço ser preenchido.',
          'Salve. A O.S. nasce como Aberta e aparece na Busca.',
        ] },
      ],
      relacionados: ['os-atendimento'],
    },
    {
      id: 'os-atendimento',
      grupo: 'Ordens de Serviço',
      pagina: 'ordens',
      titulo: 'Atender e finalizar',
      corpo: [
        { tipo: 'paragrafo', texto: 'Abra a O.S. pela Busca. Na janela dela você faz o despacho: equipe, veículos e materiais. Um funcionário ou veículo que já está em outra O.S. aberta não pode ser alocado de novo; a mensagem diz em qual está.' },
        { tipo: 'paragrafo', texto: 'Os materiais ficam planejados até a utilização ser confirmada. Ao confirmar, o estoque é descontado. Para corrigir depois disso, use o estorno, que devolve a quantidade sem apagar o registro.' },
        { tipo: 'paragrafo', texto: 'Ao finalizar, a O.S. fecha, o agendamento ligado a ela é concluído e os veículos voltam a ficar disponíveis. Dependendo do seu perfil, você só finaliza O.S. em que está na equipe.' },
      ],
      relacionados: ['os-bases', 'estoque-movimentacoes'],
    },
    {
      id: 'os-bases',
      grupo: 'Ordens de Serviço',
      pagina: 'ordens',
      titulo: 'Bases e cronograma',
      corpo: [
        { tipo: 'paragrafo', texto: 'Uma base é um local atendido, com endereço, contratos e materiais instalados. Cadastre em **Cadastros › Base**. Na aba Bases, clicar numa linha abre os detalhes, com Editar e Excluir. Uma base com pontos de atendimento ligados não pode ser excluída.' },
        { tipo: 'paragrafo', texto: 'No Cronograma, o botão **+ Agendar** abre o formulário de agendamento. Um agendamento ligado a uma O.S. acompanha a situação dela.' },
      ],
    },

    //----------------------------------------------------------------- Gestão
    {
      id: 'gestao-painel',
      grupo: 'Gestão',
      pagina: 'gestao',
      titulo: 'Painel da Gestão',
      corpo: [
        { tipo: 'paragrafo', texto: 'Resume a operação: indicadores, evolução das O.S., situação das atividades e as últimas atividades.' },
        { tipo: 'paragrafo', texto: 'O **Mapa da operação** mostra bases (quadrados) e veículos (bolinhas coloridas pela situação). Os botões Bases e Veículos ligam e desligam cada camada.' },
      ],
      relacionados: ['gestao-usuarios'],
    },
    {
      id: 'gestao-usuarios',
      grupo: 'Gestão',
      pagina: 'gestao',
      aba: 'usuarios',
      titulo: 'Usuários e perfis de acesso',
      corpo: [
        { tipo: 'paragrafo', texto: 'Em **Usuários** você cria, edita e exclui contas. Cada conta usa um perfil de acesso ou permissões próprias.' },
        { tipo: 'paragrafo', texto: 'Um perfil é um conjunto de permissões reaproveitável. A tela mostra uma lista por área (Minha conta, Início, Frota, Estoque, O.S., Análise, Jornada e Gestão), e cada linha tem as colunas Ver, Editar e Criar/Excluir. O botão "todos" marca a coluna inteira do grupo.' },
        { tipo: 'paragrafo', texto: 'Marcar Editar ou Criar/Excluir marca Ver junto. O servidor confere a permissão em toda ação, então esconder um botão não é a única proteção.' },
        { tipo: 'paragrafo', texto: 'Ao editar um usuário existente, a seção **Capacitações** registra NR-10, NR-35 e outras, com certificado e validade.' },
      ],
      relacionados: ['acesso', 'gestao-contratos'],
    },
    {
      id: 'gestao-contratos',
      grupo: 'Gestão',
      pagina: 'gestao',
      aba: 'contratos',
      titulo: 'Contratos e funcionários',
      corpo: [
        { tipo: 'paragrafo', texto: 'O contrato separa os dados entre clientes. Para limitar uma pessoa, edite o usuário e marque os contratos que ela pode ver. Sem nenhum marcado, vale o que o perfil dela define; sem perfil, ela vê tudo.' },
        { tipo: 'paragrafo', texto: 'Arquivos do contrato só podem ser anexados depois que ele for salvo.' },
        { tipo: 'paragrafo', texto: 'Em **Funcionários** fica o cadastro de quem trabalha em campo.' },
      ],
    },

    //------------------------------------------------- Cadastros / Relatórios / Jornada
    {
      id: 'cadastros',
      grupo: 'Cadastros',
      pagina: 'cadastros',
      titulo: 'Cadastros de análise',
      corpo: [
        { tipo: 'paragrafo', texto: 'Aqui ficam os catálogos usados para classificar os chamados: categorias, problemas, causas, soluções e resultados. Também ficam os equipamentos e as bases de atendimento.' },
        { tipo: 'paragrafo', texto: 'Os catálogos começam vazios, para usar o vocabulário da sua operação. Um item em uso não é apagado: ele é desativado e some das listas novas, mas continua no histórico.' },
      ],
    },
    {
      id: 'relatorios',
      grupo: 'Relatórios',
      pagina: 'relatorios',
      titulo: 'Relatórios de chamados',
      corpo: [
        { tipo: 'paragrafo', texto: 'Analisa as O.S. pelo período e pelos filtros escolhidos: chamados por problema, pontos que mais se repetem, reincidência, pontos crônicos e causas.' },
        { tipo: 'paragrafo', texto: 'Os números dependem de as O.S. estarem classificadas. A aba **Classificação Pendente** mostra o que falta preencher.' },
      ],
    },
    {
      id: 'jornada',
      grupo: 'Jornada',
      pagina: 'jornada',
      titulo: 'Jornada de trabalho',
      corpo: [
        { tipo: 'paragrafo', texto: 'Em **Meu Painel** você inicia, pausa, retoma e encerra a sua jornada. A tela só mostra as ações possíveis no momento.' },
        { tipo: 'paragrafo', texto: 'Em **Administração**, quem tem permissão vê quem está em jornada, consulta o histórico e pode corrigir, encerrar ou cancelar uma jornada.' },
      ],
    },
  ],
});
