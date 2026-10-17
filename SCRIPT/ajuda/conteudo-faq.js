//======================================================================================================
// CONTEUDO: Perguntas frequentes
// Respostas curtas; quando o assunto e maior, aponta para o topico do Manual.
//======================================================================================================
window.OrbitaAjuda.registrarSecao({
  id: 'perguntas',
  rotulo: 'Perguntas frequentes',
  ordem: 2,
  topicos: [
    {
      id: 'faq-sem-botao',
      grupo: 'Acesso',
      titulo: 'Não aparece um botão ou uma aba para mim',
      corpo: [{ tipo: 'paragrafo', texto: 'Seu perfil não libera essa ação. Peça a quem administra a Gestão para ajustar o perfil ou as suas permissões.' }],
      relacionados: ['acesso'],
    },
    {
      id: 'faq-sem-registro',
      grupo: 'Acesso',
      titulo: 'Não vejo uma O.S. ou um veículo que existe',
      corpo: [{ tipo: 'paragrafo', texto: 'Ele provavelmente pertence a um contrato que não está liberado para você. Quem administra pode marcar o contrato no seu usuário.' }],
      relacionados: ['gestao-contratos'],
    },
    {
      id: 'faq-sessao',
      grupo: 'Acesso',
      titulo: 'Fui desconectado sozinho',
      corpo: [{ tipo: 'paragrafo', texto: 'A sessão expirou. Entre de novo e continue de onde parou.' }],
    },
    {
      id: 'faq-erro-quantidade',
      grupo: 'Estoque',
      titulo: 'Lancei uma quantidade errada',
      corpo: [{ tipo: 'paragrafo', texto: 'Se o material da O.S. ainda está planejado, edite ou remova. Se já foi confirmado, use o estorno: ele devolve a quantidade e mantém o registro original.' }],
      relacionados: ['os-atendimento'],
    },
    {
      id: 'faq-veiculo-bloqueado',
      grupo: 'Frota',
      titulo: 'Não consigo colocar um veículo na O.S.',
      corpo: [{ tipo: 'paragrafo', texto: 'Ele está em manutenção, inativo ou já está em outra O.S. aberta. A mensagem mostra o motivo. Libere o veículo ou escolha outro.' }],
      relacionados: ['frota-veiculos'],
    },
    {
      id: 'faq-status-veiculo',
      grupo: 'Frota',
      titulo: 'Como mudo o status de um veículo rápido?',
      corpo: [{ tipo: 'paragrafo', texto: 'Clique no veículo na aba Veículos. Nos detalhes há três botões: Ativo, Em manutenção e Inativo.' }],
    },
    {
      id: 'faq-funcionario-ocupado',
      grupo: 'Ordens de Serviço',
      titulo: 'O sistema não deixa alocar um funcionário',
      corpo: [{ tipo: 'paragrafo', texto: 'Ele já está em outra O.S. aberta. Remova-o daquela O.S. ou finalize-a antes.' }],
    },
    {
      id: 'faq-finalizar',
      grupo: 'Ordens de Serviço',
      titulo: 'Não consigo finalizar uma O.S.',
      corpo: [{ tipo: 'paragrafo', texto: 'Seu perfil pode permitir finalizar só as O.S. em que você está na equipe. Entre na equipe ou peça a alguém com essa permissão.' }],
      relacionados: ['os-atendimento'],
    },
    {
      id: 'faq-relatorio-vazio',
      grupo: 'Relatórios',
      titulo: 'O relatório aparece vazio ou incompleto',
      corpo: [{ tipo: 'paragrafo', texto: 'Confira o período escolhido. Nos relatórios de chamados, O.S. sem classificação ficam de fora; veja a aba Classificação Pendente.' }],
    },
  ],
});
