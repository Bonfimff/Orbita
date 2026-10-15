//======================================================================================================
// CONTEUDO: Sobre o KERNEL + metadados da documentacao
//
// ATENCAO - INFORMACAO INSTITUCIONAL
//   O projeto nao possui hoje nenhum arquivo com dados institucionais
//   (desenvolvedor, licenca, canal de suporte). O unico dado de versao que
//   existia na plataforma era o texto "Versao de desenvolvimento: 1.0.0" do
//   antigo balao de informacoes, e e ele que esta refletido aqui.
//   Os campos ainda nao definidos aparecem como "a definir" DE PROPOSITO -
//   preenche-los com nomes inventados seria pior do que deixa-los em branco.
//   Para configurar, basta editar o objeto META abaixo: e o unico lugar.
//======================================================================================================
window.OrbitaAjuda.META = {
  produto: 'KERNEL',
  versao: 'Versão 1.0.0 (desenvolvimento)',
  atualizadoEm: '26/08/2026',
  // Campos institucionais ainda nao definidos no projeto.
  desenvolvedor: null,
  suporte: null,
  licenca: null,
};

window.OrbitaAjuda.registrarSecao({
  id: 'sobre',
  rotulo: 'Sobre o KERNEL',
  ordem: 4,
  descricao: 'Informações da plataforma e desta documentação.',
  topicos: [
    {
      id: 'sobre-plataforma',
      titulo: 'A plataforma',
      modulo: 'Institucional',
      corpo: [
        { tipo: 'paragrafo', texto: '**KERNEL** é uma plataforma de gestão operacional. Ela reúne, num só lugar, o controle de almoxarifado, a gestão da frota, as ordens de serviço e a administração da operação — usuários, perfis de acesso, contratos, cadastros, relatórios e jornadas.' },
        { tipo: 'subtitulo', texto: 'O que ela se propõe a fazer' },
        { tipo: 'lista', itens: [
          'Manter o estoque e a operação ligados: material usado numa O.S. sai do mesmo saldo do almoxarifado.',
          'Preservar o histórico: mudanças de status, alocações e movimentações de estoque não são apagadas — correções entram como novos registros.',
          'Separar os dados por contrato, de modo que cada usuário enxergue apenas o que lhe cabe.',
          'Registrar quem fez cada alteração relevante, e quando.',
        ] },
      ],
      relacionados: ['sobre-versao', 'visao-geral'],
    },
    {
      id: 'sobre-versao',
      titulo: 'Versão e documentação',
      modulo: 'Institucional',
      corpo: [
        { tipo: 'tabela', cabecalho: ['Informação', 'Valor'], linhas: [
          ['Produto', 'KERNEL'],
          ['Versão', 'Versão 1.0.0 (desenvolvimento)'],
          ['Documentação atualizada em', '26/08/2026'],
        ] },
        { tipo: 'paragrafo', texto: 'Esta Central acompanha a evolução da plataforma. Sempre que um módulo muda, o tópico correspondente é atualizado — e recursos que ainda não existem são identificados como tal, em vez de descritos como prontos.' },
        { tipo: 'nota', texto: 'A versão e a data exibidas no topo da Central vêm de um único ponto de configuração, no arquivo de conteúdo institucional.' },
      ],
      relacionados: ['sobre-plataforma', 'sobre-roadmap'],
    },
    {
      id: 'sobre-institucional',
      titulo: 'Desenvolvedor, suporte e licença',
      modulo: 'Institucional',
      corpo: [
        { tipo: 'tabela', cabecalho: ['Informação', 'Situação'], linhas: [
          ['Desenvolvedor', 'A definir'],
          ['Canal de suporte', 'A definir'],
          ['Licença / copyright', 'A definir'],
        ] },
        { tipo: 'aviso', texto: 'Estes dados **ainda não estão definidos no projeto**. Eles aparecem em branco de propósito: preenchê-los com informação inventada seria pior do que deixá-los pendentes. Assim que forem definidos, basta configurá-los num único ponto para que apareçam aqui.' },
      ],
      relacionados: ['sobre-versao'],
    },
    {
      id: 'sobre-tecnico',
      titulo: 'Informações técnicas',
      modulo: 'Institucional',
      corpo: [
        { tipo: 'paragrafo', texto: 'O KERNEL é uma aplicação web: a interface roda no navegador e conversa com uma API própria, que concentra as regras de negócio e o acesso ao banco de dados.' },
        { tipo: 'subtitulo', texto: 'Onde as regras são aplicadas' },
        { tipo: 'paragrafo', texto: 'As permissões e o isolamento por contrato são verificados **no servidor**, a cada operação. A interface esconde o que você não pode usar, mas não é ela que garante a segurança.' },
        { tipo: 'subtitulo', texto: 'Sessão' },
        { tipo: 'paragrafo', texto: 'O acesso é feito com um token gerado no login, guardado no navegador e enviado a cada requisição. Quando ele expira, a plataforma avisa e retorna à tela de login.' },
        { tipo: 'subtitulo', texto: 'Navegadores' },
        { tipo: 'paragrafo', texto: 'A interface é responsiva e funciona em desktop, notebook, tablet e celular, com navegadores atualizados.' },
      ],
      relacionados: ['sobre-plataforma', 'faq-acesso-negado'],
    },
    {
      id: 'sobre-roadmap',
      titulo: 'O que ainda está em construção',
      modulo: 'Institucional',
      corpo: [
        { tipo: 'paragrafo', texto: 'Para que a documentação seja confiável, vale registrar o que **ainda não existe** na plataforma. Estes itens não devem ser considerados disponíveis:' },
        { tipo: 'tabela', cabecalho: ['Recurso', 'Situação atual'], linhas: [
          ['Configurações da plataforma', 'O botão existe no rodapé, mas nenhuma tela está ligada a ele.'],
          ['Controle de transições da O.S.', 'O status ainda pode ser escolhido livremente; não há validação de etapas nem pré-condições.'],
          ['Jornada como pré-requisito da O.S.', 'A verificação de aptidão já existe, mas ainda não bloqueia a alocação.'],
          ['Equipes padrão', 'O mecanismo existe no sistema, mas a tela para gerenciar os moldes não foi construída.'],
          ['Quilometragem do veículo na O.S.', 'Os campos existem, mas o fluxo de preenchimento pela tela não foi implementado.'],
        ] },
        { tipo: 'nota', texto: 'Conforme cada um desses recursos for concluído, o tópico correspondente do Manual passa a descrever o funcionamento real, e este quadro é reduzido.' },
      ],
      relacionados: ['configuracoes', 'os-status', 'jornadas'],
    },
  ],
});
