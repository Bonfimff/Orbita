//======================================================================================================
// CONTEUDO: Guia Rapido
//
// Orientado a TAREFA: passos curtos para fazer uma coisa especifica, sem ler o
// manual inteiro. So procedimentos que correspondem ao comportamento atual.
//======================================================================================================
window.OrbitaAjuda.registrarSecao({
  id: 'guia',
  rotulo: 'Guia Rápido',
  ordem: 2,
  descricao: 'Passo a passo das tarefas mais comuns. Para entender um módulo por inteiro, use o **Manual do Usuário**.',
  topicos: [
    {
      id: 'guia-entrar',
      titulo: 'Como entrar e sair da plataforma',
      modulo: 'Geral',
      corpo: [
        { tipo: 'subtitulo', texto: 'Entrar' },
        { tipo: 'passos', itens: [
          'Abra o KERNEL no navegador.',
          'Informe usuário e senha.',
          'Clique em **Entrar**.',
        ] },
        { tipo: 'subtitulo', texto: 'Sair' },
        { tipo: 'passos', itens: [
          'No rodapé do menu lateral, clique no ícone **Sair**.',
          'A sessão é encerrada e você volta para a tela de login.',
        ] },
      ],
      relacionados: ['primeiro-acesso'],
    },
    {
      id: 'guia-cadastrar-usuario',
      titulo: 'Como cadastrar um usuário',
      modulo: 'Gestão',
      corpo: [
        { tipo: 'passos', itens: [
          'No menu principal, clique em **Gestão**.',
          'No menu lateral, escolha **Usuários**.',
          'Clique em **+ Novo Usuário**.',
          'Preencha os dados da conta.',
          'Defina o acesso: escolha um **perfil** ou marque **permissões customizadas** para ajustar módulo a módulo.',
          'Marque os contratos em **Contratos com acesso liberado**, se a pessoa deve ver apenas alguns contratos.',
          'Salve.',
        ] },
        { tipo: 'nota', texto: 'Sem marcar nenhum contrato e sem restrição, o usuário enxerga todos os contratos.' },
      ],
      relacionados: ['gestao-usuarios', 'guia-perfil'],
    },
    {
      id: 'guia-editar-usuario',
      titulo: 'Como editar um usuário',
      modulo: 'Gestão',
      corpo: [
        { tipo: 'passos', itens: [
          'Vá em **Gestão › Usuários**.',
          'Localize a conta na lista.',
          'Clique em **Editar** na linha correspondente.',
          'Altere o que for necessário — perfil, permissões customizadas ou contratos liberados.',
          'Salve.',
        ] },
        { tipo: 'aviso', texto: 'Alterar o perfil muda o acesso imediatamente. Se a pessoa estiver com a sessão aberta, o novo acesso vale na próxima vez que a tela consultar as permissões.' },
      ],
      relacionados: ['gestao-usuarios'],
    },
    {
      id: 'guia-perfil',
      titulo: 'Como configurar um perfil de acesso',
      modulo: 'Gestão',
      corpo: [
        { tipo: 'passos', itens: [
          'Vá em **Gestão › Perfis de Acesso**.',
          'Clique em **+ Novo Perfil** (ou edite um existente).',
          'Dê um nome ao perfil.',
          'Marque, para cada módulo, se o perfil pode **ver** e/ou **executar**.',
          'Marque as restrições adicionais que se aplicarem.',
          'Salve. O perfil já pode ser vinculado a usuários.',
        ] },
        { tipo: 'nota', texto: '**ver** libera consultar; **executar** libera criar e alterar. Um perfil com "ver" e sem "executar" enxerga o módulo em modo consulta.' },
      ],
      relacionados: ['gestao-perfis', 'guia-cadastrar-usuario'],
    },
    {
      id: 'guia-contrato',
      titulo: 'Como cadastrar um contrato',
      modulo: 'Gestão',
      corpo: [
        { tipo: 'passos', itens: [
          'Vá em **Gestão › Contratos**.',
          'Preencha **Nome do contrato** (obrigatório), CNPJ e especificações.',
          'Clique em **Salvar Contrato**.',
          'Com o contrato salvo, use **Arquivos do contrato** para anexar documentos.',
        ] },
        { tipo: 'aviso', texto: 'Os anexos só podem ser enviados após salvar — antes disso a tela exibe um aviso.' },
        { tipo: 'nota', texto: 'Para dar acesso ao contrato, edite o **usuário** e marque o contrato em "Contratos com acesso liberado".' },
      ],
      relacionados: ['gestao-contratos'],
    },
    {
      id: 'guia-cadastrar-item',
      titulo: 'Como cadastrar um item (produto)',
      modulo: 'Estoque',
      corpo: [
        { tipo: 'passos', itens: [
          'No menu principal, clique em **Estoque**.',
          'No menu lateral, vá em **Cadastros**.',
          'Escolha a aba **Produtos**.',
          'Preencha os dados do item (nome, código, categoria, unidade, quantidade, estoque mínimo, custo, fornecedor e o que mais se aplicar).',
          'Salve.',
        ] },
        { tipo: 'nota', texto: 'O **estoque mínimo** serve para sinalizar reposição; a **quantidade** é o saldo atual do item.' },
      ],
      relacionados: ['almoxarifado', 'guia-consultar-estoque'],
    },
    {
      id: 'guia-movimentacao',
      titulo: 'Como realizar uma movimentação',
      modulo: 'Estoque',
      corpo: [
        { tipo: 'paragrafo', texto: 'Movimentação é a saída ou o retorno de material do estoque.' },
        { tipo: 'passos', itens: [
          'Vá em **Estoque › Movimentações**.',
          'Escolha **Retirada** (saída de material) ou **Devolução** (retorno).',
          'Informe o produto, a quantidade e os dados da movimentação (requisitante, responsável, destino, finalidade e observações).',
          'Confirme o registro.',
        ] },
        { tipo: 'nota', texto: 'Material usado em uma O.S. também pode sair pelo próprio módulo de O.S.: ao confirmar a utilização, o desconto no estoque e a retirada são registrados automaticamente.' },
      ],
      relacionados: ['almoxarifado', 'guia-material-os', 'faq-almox-corrigir'],
    },
    {
      id: 'guia-consultar-estoque',
      titulo: 'Como consultar o estoque',
      modulo: 'Estoque',
      corpo: [
        { tipo: 'passos', itens: [
          'Vá em **Estoque**.',
          'Use **Busca** para procurar um item específico, ou **Produtos** para ver a lista completa.',
          'Para números consolidados, use **Painel Geral**; para extrair dados, use **Relatório**.',
        ] },
      ],
      relacionados: ['almoxarifado'],
    },
    {
      id: 'guia-abrir-os',
      titulo: 'Como abrir uma O.S.',
      modulo: 'O.S.',
      corpo: [
        { tipo: 'passos', itens: [
          'No menu principal, clique em **Ordens de Serviço**.',
          'No menu lateral, escolha **Nova O.S.**',
          'Preencha solicitante, tipo de serviço, prioridade e descrição.',
          'Informe o contrato e o(s) ponto(s) de atendimento.',
          'Salve. A O.S. nasce com status **Aberta**.',
        ] },
        { tipo: 'nota', texto: 'Alguns perfis têm a abertura de nova O.S. bloqueada por restrição. Se o botão não funcionar para você, confira seu perfil de acesso.' },
      ],
      relacionados: ['ordens', 'guia-acessar-os'],
    },
    {
      id: 'guia-acessar-os',
      titulo: 'Como acessar uma O.S. existente',
      modulo: 'O.S.',
      corpo: [
        { tipo: 'passos', itens: [
          'Vá em **Ordens de Serviço**.',
          'Use **Busca** para localizar pela informação que você tem, ou veja as **Ordens Recentes** no Painel Geral.',
          'Clique na ordem para abrir os detalhes.',
          'Nos detalhes você acompanha status, pontos de atendimento, equipe, veículos e materiais.',
        ] },
      ],
      relacionados: ['ordens', 'os-status'],
    },
    {
      id: 'guia-material-os',
      titulo: 'Como registrar material usado numa O.S.',
      modulo: 'O.S.',
      corpo: [
        { tipo: 'passos', itens: [
          'Abra a O.S. desejada.',
          'Na seção de materiais, adicione o produto e a quantidade prevista — ele entra como **planejado** e ainda não afeta o estoque.',
          'Quando o material for realmente usado, clique em **confirmar utilização**: aí sim o estoque é debitado.',
        ] },
        { tipo: 'subtitulo', texto: 'Errei a quantidade' },
        { tipo: 'lista', itens: [
          'Ainda **planejado**: basta alterar a quantidade ou remover.',
          'Já **utilizado**: use o **estorno**, que devolve a quantidade ao estoque e registra a correção.',
        ] },
        { tipo: 'aviso', texto: 'Um lançamento confirmado nunca é apagado. A correção sempre entra como um novo registro ligado ao original.' },
      ],
      relacionados: ['os-materiais', 'faq-almox-corrigir'],
    },
    {
      id: 'guia-equipe-os',
      titulo: 'Como montar a equipe de uma O.S.',
      modulo: 'O.S.',
      corpo: [
        { tipo: 'passos', itens: [
          'Abra a O.S.',
          'Na seção de equipe, escolha o funcionário.',
          'Escolha a **função** que ele exerce nesta O.S. (Responsável, Técnico, Auxiliar, Motorista, Eletricista, Supervisor).',
          'Confirme a inclusão.',
        ] },
        { tipo: 'nota', texto: 'Se o sistema recusar informando outra O.S., é porque aquele funcionário ainda está alocado numa ordem em aberto. Remova-o de lá ou finalize aquela O.S.' },
      ],
      relacionados: ['os-equipe', 'faq-os-conflito'],
    },
    {
      id: 'guia-veiculo-os',
      titulo: 'Como alocar um veículo numa O.S.',
      modulo: 'O.S.',
      corpo: [
        { tipo: 'passos', itens: [
          'Abra a O.S.',
          'Na seção de frota, escolha o veículo.',
          'Se houver, informe o motorista.',
          'Confirme.',
        ] },
        { tipo: 'nota', texto: 'Veículo e motorista já ocupados em outra O.S. aberta são recusados, com a indicação de qual ordem está em conflito.' },
      ],
      relacionados: ['os-veiculos', 'frota'],
    },
    {
      id: 'guia-jornada',
      titulo: 'Como registrar sua jornada',
      modulo: 'Gestão',
      corpo: [
        { tipo: 'passos', itens: [
          'Vá em **Gestão › Jornadas**, seção **Meu Painel**.',
          'Clique em **Iniciar Jornada**. O cartão passa a mostrar **EM JORNADA** com o tempo decorrido.',
          'Para uma parada, clique em **Pausar**; para voltar, **Retomar**.',
          'Ao fim do expediente, clique em **Finalizar Jornada**.',
        ] },
        { tipo: 'nota', texto: 'Só aparecem as ações válidas para o seu estado atual. Se já houver uma jornada aberta, o botão Iniciar não é oferecido.' },
      ],
      relacionados: ['jornadas', 'faq-jornada-duas'],
    },
    {
      id: 'guia-relatorio',
      titulo: 'Como consultar um relatório',
      modulo: 'Gestão',
      corpo: [
        { tipo: 'passos', itens: [
          'Vá em **Gestão › Relatórios**.',
          'Ajuste os filtros na barra superior (em celular, toque em **Filtros**).',
          'Escolha o relatório no menu lateral.',
          'O conteúdo é recarregado conforme os filtros aplicados.',
        ] },
        { tipo: 'nota', texto: 'Se um relatório vier com pouca informação, verifique **Classificação Pendente**: chamados sem classificação não entram nas análises por problema, causa ou solução.' },
      ],
      relacionados: ['relatorios', 'cadastros'],
    },
    {
      id: 'guia-configuracoes',
      titulo: 'Como alterar configurações da plataforma',
      modulo: 'Geral',
      corpo: [
        { tipo: 'aviso', texto: 'A área de Configurações (ícone de engrenagem) **ainda não está implementada**. Não há, hoje, tela de configuração geral da plataforma.' },
        { tipo: 'paragrafo', texto: 'O que já é configurável está distribuído nas áreas correspondentes: acessos em **Gestão › Perfis de Acesso** e **Usuários**, contratos em **Gestão › Contratos**, e catálogos em **Gestão › Cadastros**.' },
      ],
      relacionados: ['configuracoes', 'gestao-perfis'],
    },
  ],
});
