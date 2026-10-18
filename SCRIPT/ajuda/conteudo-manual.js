//======================================================================================================
// CONTEUDO: Manual
//
// Organizado por pagina (campo `pagina`): a Central abre direto no topico da
// pagina em que a pessoa esta. Texto curto e direto; so descreve o que existe.
//======================================================================================================
window.OrbitaAjuda.META = {
  produto: 'KERNEL',
  versao: 'versão 1.0',
  atualizadoEm: '18/10/2026',
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
        { tipo: 'paragrafo', texto: 'Os módulos ficam na barra de cima: Ordens de Serviço, Estoque, Frota, Ponto e Gestão. Passe o mouse sobre um módulo para ver as subabas dele e ir direto para uma delas; no celular, toque na seta ao lado do módulo, no menu. Ao entrar, o sistema abre o módulo escolhido no cadastro do usuário (campo **Abrir ao entrar**) ou, se não houver escolha, o primeiro que a pessoa pode ver. O menu da esquerda mostra as abas do módulo aberto. No celular, esse menu abre pelo botão de três traços.' },
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
      id: 'tabelas',
      grupo: 'Geral',
      titulo: 'Tabelas: ver, editar e excluir',
      corpo: [
        { tipo: 'paragrafo', texto: 'Todas as tabelas funcionam igual: um clique (ou Enter) no registro abre a ficha dele, só para ver. Nenhuma linha tem botão de editar ou excluir.' },
        { tipo: 'paragrafo', texto: 'As ações ficam dentro da ficha: **Editar** leva para a edição e **Excluir** (ou Desativar, Cancelar) aparece só para quem tem permissão. Na O.S., o botão **Abrir atendimento** abre a tela de despacho, pontos e fechamento.' },
        { tipo: 'paragrafo', texto: 'Listas de itens dentro de um formulário que está sendo preenchido (itens de uma retirada, materiais do despacho) continuam com o botão de remover ao lado, porque fazem parte da edição.' },
      ],
    },
    {
      id: 'acesso-contratos',
      grupo: 'Geral',
      titulo: 'Contratos com acesso',
      corpo: [
        { tipo: 'paragrafo', texto: 'Usuários, bases e veículos podem ser ligados a contratos. Quem está ligado a contratos só vê o que pertence a eles.' },
        { tipo: 'paragrafo', texto: '**Usuário:** marque os contratos que ele pode ver. Sem nenhum marcado, vale o padrão do perfil vinculado; sem perfil, ele vê tudo.' },
        { tipo: 'paragrafo', texto: '**Base:** sem nenhum contrato marcado, a base fica visível para todos que têm acesso a Ordens de Serviço.' },
        { tipo: 'paragrafo', texto: '**Veículo:** sem nenhum contrato marcado, o veículo fica visível para todos que têm acesso à Frota.' },
      ],
      relacionados: ['acesso', 'gestao-contratos'],
    },
    {
      id: 'configuracoes',
      grupo: 'Geral',
      titulo: 'Configurações e troca de senha',
      corpo: [
        { tipo: 'paragrafo', texto: 'Abra pela engrenagem, no rodapé do menu. Em **Minha conta** você corrige nome e e-mail.' },
        { tipo: 'paragrafo', texto: 'Em **Previsão do tempo** você liga ou desliga o clima no painel lateral. A mudança vale ao recarregar a página.' },
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
        { tipo: 'paragrafo', texto: 'Certificados com PDF anexado mostram o botão Ver certificado. As informações de emergência (alergias, contraindicações, medicamentos e contato) ficam recolhidas e abrem ao tocar; a pessoa escolhe se aparecem no QR.' },
        { tipo: 'paragrafo', texto: 'Para mudar tipo sanguíneo e informações de emergência, use o lápis no alto do crachá. Clicar no QR abre a página do crachá numa nova aba.' },
        { tipo: 'paragrafo', texto: 'Esses dados são do funcionário: o administrador edita tipo sanguíneo, emergência, certificados e PDFs em Gestão › Cadastros › Funcionários. O crachá de quem tem login mostra os dados do funcionário ligado a ele.' },
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
    {
      id: 'explorador',
      grupo: 'Geral',
      titulo: 'Pastas e arquivos',
      corpo: [
        { tipo: 'paragrafo', texto: 'Equipamentos, contratos e funcionários guardam arquivos num explorador parecido com o do Windows. Organize em pastas como preferir (ex.: Admissão, Folhas de ponto, Contracheques, Fichas técnicas).' },
        { tipo: 'paragrafo', texto: '**Nova pasta** e **Enviar** ficam na barra de cima. Também dá para arrastar arquivos do computador para dentro da janela.' },
        { tipo: 'paragrafo', texto: 'Clique com o botão direito num item (ou no espaço vazio) para abrir, baixar, renomear, copiar, recortar, colar, excluir ou proteger. Atalhos: Ctrl+C, Ctrl+X, Ctrl+V, Delete, F2 para renomear e Backspace para subir de pasta.' },
        { tipo: 'paragrafo', texto: 'Pastas copiadas podem ser coladas em outro equipamento, contrato ou funcionário do mesmo tipo.' },
        { tipo: 'paragrafo', texto: 'O botão ao lado do (i) alterna entre ícones e detalhes (nome, data, tipo e tamanho).' },
        { tipo: 'paragrafo', texto: '**Pastas protegidas** (cadeado) dependem da permissão "Pastas protegidas" do perfil: com Ver a pessoa enxerga a pasta fechada; com Editar ela abre o conteúdo. Sem permissão o conteúdo nem é carregado.' },
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
        { tipo: 'paragrafo', texto: 'O **Painel** mostra os totais da frota e o mapa com a posição dos veículos. As outras abas são de consulta e trabalho: Veículos, Manutenções, Abastecimentos, Checklists e Relatórios.' },
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
        { tipo: 'paragrafo', texto: 'Na ficha da manutenção dá para trocar o status com um clique (Agendada, Em andamento, Cancelada). Ao clicar em **Concluída**, abre a finalização só com os campos a preencher: serviços realizados, peças, resultado final, custo, data e km de saída, garantia do serviço e notas.' },
        { tipo: 'paragrafo', texto: 'Ao finalizar, o veículo volta a ficar Ativo, o km dele é atualizado e o relatório em PDF é gerado sozinho na pasta do veículo, em **Manutenções finalizadas** (ficha do veículo › Arquivos do veículo). Abra o arquivo para ver ou imprimir. **Cancelar finalização** volta a manutenção para Em andamento e retira o relatório da pasta.' },
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
        { tipo: 'paragrafo', texto: 'Em **Bases e Equipamentos** um seletor alterna entre as bases e os equipamentos. Todo equipamento fica numa base. Um clique no equipamento abre a ficha: a base, os dados, a **Composição** (os materiais que formam o equipamento, de um único item a um conjunto), os **Arquivos** (um explorador como o do Windows: crie pastas, envie ou arraste arquivos, e use o botão direito para abrir, baixar, recortar, copiar, colar, renomear, excluir ou proteger uma pasta; F2, Delete e Ctrl+C/X/V também funcionam, e o que for copiado ou recortado num equipamento pode ser colado no explorador de outro; no celular, toque longo abre o menu), as **O.S.** da base (resumo com as mais recentes, destacando as que citam o equipamento, e links para o relatório completo da base ou do equipamento) e o histórico. No mapa, clicar numa base mostra os equipamentos dela, e cada um abre a ficha. Quando uma O.S. é finalizada, o sistema gera um PDF com os dados do atendimento, ocorrências, materiais, pontos e fotos, e guarda na pasta **O.S. finalizadas** de cada equipamento citado nas ocorrências (se nenhum for citado, nos equipamentos da base atendida). Se a O.S. for alterada depois, o PDF é refeito; se for reaberta ou excluída, ele é retirado. Fotos e documentos ficam nos equipamentos, não no cadastro da base. Materiais e arquivos são incluídos, abertos e baixados ali mesmo. **Editar** muda só as características, e o cadastro de equipamentos fica em **O.S. › Cadastros › Equipamentos**. Pasta protegida (cadeado) serve para informações sensíveis, como credenciais. Quem vê e quem abre essas pastas é definido no perfil, no item **Pastas protegidas**: Ver mostra a pasta fechada, Editar abre o conteúdo. O conteúdo só é carregado para quem tem acesso.' },
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
        { tipo: 'paragrafo', texto: 'Um clique numa O.S. (na Busca ou em Ordens Recentes) abre a ficha dela: base de atendimento, técnico, responsável e equipe, pontos, diagnóstico e fechamento. Na O.S. finalizada, **Ver relatório (PDF)** abre o relatório completo, com fotos, numa nova guia do navegador, sem precisar de programa instalado.' },
      ],
      relacionados: ['os-bases', 'estoque-movimentacoes'],
    },
    {
      id: 'equipamentos',
      grupo: 'Ordens de Serviço',
      pagina: 'ordens',
      aba: 'bases',
      titulo: 'Bases e equipamentos',
      corpo: [
        { tipo: 'paragrafo', texto: 'Em **O.S. › Bases e Equipamentos**, o seletor troca entre o mapa das bases e a lista de equipamentos. Clicar numa base no mapa mostra os equipamentos dela; clicar num equipamento abre a ficha.' },
        { tipo: 'paragrafo', texto: 'Todo equipamento pertence a uma base. Um equipamento pode ser um único material ou um conjunto de materiais (ex.: nobreak com baterias); a lista fica na aba **Composição** da ficha.' },
        { tipo: 'paragrafo', texto: 'Fotos, documentos e fichas técnicas ficam na aba **Arquivos** do equipamento, não na base. Quando uma O.S. é finalizada, o relatório em PDF é gerado sozinho na pasta "O.S. finalizadas" de cada equipamento envolvido, e é refeito se a O.S. mudar.' },
        { tipo: 'paragrafo', texto: 'A aba **O.S.** da ficha resume os atendimentos da base, com link para o relatório completo.' },
        { tipo: 'paragrafo', texto: 'Equipamento nunca é obrigatório numa O.S. Cadastre (em **O.S. › Cadastros › Equipamentos**) apenas os ativos que a operação realmente identifica em campo.' },
      ],
      relacionados: ['explorador', 'os-bases'],
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
        { tipo: 'paragrafo', texto: 'A aba **Usuários** lista as contas. **+ Novo Usuário** e o lápis de editar abrem o formulário em **Cadastros › Usuários**; ao salvar, você volta para a lista. Cada conta usa um perfil de acesso ou permissões próprias.' },
        { tipo: 'paragrafo', texto: 'Um perfil é um conjunto de permissões reaproveitável. A tela mostra uma lista por área (Minha conta, Início, Frota, Estoque, O.S., Análise, Ponto e Gestão), e cada linha tem as colunas Ver, Editar e Criar/Excluir. O botão "todos" marca a coluna inteira do grupo.' },
        { tipo: 'paragrafo', texto: 'Marcar Editar ou Criar/Excluir marca Ver junto. O servidor confere a permissão em toda ação, então esconder um botão não é a única proteção.' },
        { tipo: 'paragrafo', texto: 'Tipo sanguíneo, informações de emergência e certificados (NR-10, NR-35 e outros, com PDF) ficam no cadastro do funcionário. O formulário do usuário tem um atalho para abrir o funcionário ligado a ele.' },
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
        { tipo: 'paragrafo', texto: 'A aba **Contratos** lista os contratos; um clique abre a ficha com as especificações, quem tem acesso e os arquivos (explorador com pastas, igual ao dos equipamentos). **+ Novo contrato** e **Editar** abrem o formulário em **Gestão › Cadastros › Contratos**.' },
        { tipo: 'paragrafo', texto: 'A aba **Funcionários** lista quem trabalha em campo. **+ Novo funcionário** e um clique na linha abrem o formulário em **Cadastros › Funcionários**, com tipo sanguíneo, informações de emergência e capacitações. O crachá do usuário ligado a ele mostra esses mesmos dados.' },
        { tipo: 'paragrafo', texto: 'A ficha do funcionário tem as abas **Dados**, **Admissão** (data de admissão, tipo de contrato, desligamento e tempo de casa), **Documentos** e **Férias**. Documentos e Férias aparecem depois que o cadastro é salvo.' },
        { tipo: 'paragrafo', texto: 'Em **Documentos** fica o explorador de arquivos, o mesmo dos equipamentos: crie as pastas que quiser (ex.: Admissão, Folhas de ponto, Contracheques), envie ou arraste arquivos e use o botão direito para renomear, copiar, mover, excluir ou proteger.' },
        { tipo: 'paragrafo', texto: 'Em **Férias** o sistema calcula os períodos aquisitivos pela data de admissão (30 dias por ano), mostra o saldo e até quando cada período precisa ser tirado. Ao programar, informe o período, o início, o fim e, se houver, os dias vendidos (abono). Os dias de férias aparecem na folha de ponto e no calendário do funcionário. A subaba **Férias** em Gestão › Controle de Ponto mostra todos de uma vez, com as vencidas e as que vencem em até 90 dias primeiro.' },
        { tipo: 'paragrafo', texto: 'Em **Gestão › Funcionários**, um clique no funcionário abre a ficha ali mesmo, com **Documentos** (enviar, baixar, mover e ver arquivos) e **Férias** (consultar e programar). Só o lápis ou **Editar** leva ao cadastro, para mudar os dados.' },
      ],
    },
    {
      id: 'funcionario-ficha',
      grupo: 'Gestão',
      pagina: 'cadastros',
      titulo: 'Ficha do funcionário',
      corpo: [
        { tipo: 'paragrafo', texto: 'A ficha tem **Dados**, **Admissão**, **Documentos** e **Férias**. O tempo de casa é calculado pela data de admissão e, se houver, pela de desligamento.' },
        { tipo: 'paragrafo', texto: 'Contrato assinado, documentos pessoais, ASO e demais papéis da admissão ficam em **Documentos**, no explorador de pastas.' },
        { tipo: 'paragrafo', texto: 'As capacitações aparecem no crachá com a situação da validade. Cargo de eletricista exige NR-10 válida.' },
      ],
      relacionados: ['explorador', 'cracha'],
    },

    //------------------------------------------------- Cadastros / Relatórios / Ponto
    {
      id: 'cadastros',
      grupo: 'Cadastros',
      pagina: 'cadastros',
      titulo: 'Cadastros de análise',
      corpo: [
        { tipo: 'paragrafo', texto: 'Aqui ficam os catálogos usados para classificar os chamados (categorias, problemas, causas, soluções e resultados), as bases de atendimento e os formulários de usuário e de funcionário.' },
        { tipo: 'paragrafo', texto: 'Os catálogos começam vazios, para usar o vocabulário da sua operação. Um item em uso não é apagado: ele é desativado e some das listas novas, mas continua no histórico.' },
      ],
    },
    {
      id: 'cadastros-campos',
      grupo: 'Cadastros',
      titulo: 'Campos dos cadastros',
      corpo: [
        { tipo: 'paragrafo', texto: '**Código:** deixe em branco para gerar automaticamente (EQ-0001 nos equipamentos, P-0001 nas bases). É estável, mesmo se o nome mudar.' },
        { tipo: 'paragrafo', texto: '**Ordem:** define a posição nas listas de seleção.' },
        { tipo: 'paragrafo', texto: '**Ativo:** um item inativo some das listas de seleção, mas o histórico é preservado.' },
        { tipo: 'paragrafo', texto: '**Prazo de reincidência:** se o problema voltar dentro desse prazo depois do encerramento, o sistema sugere reincidência. Padrão: 30 dias.' },
        { tipo: 'paragrafo', texto: '**Solução sugerida:** apenas sugestão de preenchimento. A solução continua sendo escolhida em cada ocorrência.' },
        { tipo: 'paragrafo', texto: '**Grupo:** agrupador fixo usado nos gráficos executivos.' },
        { tipo: 'paragrafo', texto: '**Base do equipamento:** onde ele está instalado. Materiais e arquivos ficam na ficha do equipamento. Mudar o ponto abre um novo período no histórico de alocação; o passado não é reescrito.' },
        { tipo: 'paragrafo', texto: '**Contrato da base:** define quem enxerga a base nos relatórios.' },
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
      id: 'relatorios-reincidencia',
      grupo: 'Relatórios',
      pagina: 'relatorios',
      aba: 'reincidencia',
      titulo: 'Reincidência',
      corpo: [
        { tipo: 'paragrafo', texto: 'A lista de pontos com problemas repetidos vem do histórico: mesmo ponto e mesmo problema mais de uma vez no período.' },
        { tipo: 'paragrafo', texto: 'As sugestões de reincidência vinculada são só sugestões do sistema. Apenas as confirmadas entram nos indicadores.' },
      ],
    },
    {
      id: 'relatorios-cronicos',
      grupo: 'Relatórios',
      pagina: 'relatorios',
      aba: 'cronicos',
      titulo: 'Pontos crônicos',
      corpo: [
        { tipo: 'paragrafo', texto: 'Um ponto é crônico quando teve pelo menos o mínimo de ocorrências escolhido, com intervalo médio entre elas abaixo do máximo informado. Ajuste os dois campos e clique em Aplicar.' },
        { tipo: 'paragrafo', texto: 'Não há nota composta: o critério aparece abaixo dos filtros e o cálculo pode ser conferido na mão.' },
      ],
    },
    {
      id: 'relatorios-pendentes',
      grupo: 'Relatórios',
      pagina: 'relatorios',
      aba: 'pendentes',
      titulo: 'Classificações pendentes',
      corpo: [
        { tipo: 'paragrafo', texto: 'Mostra as ocorrências que ainda não têm todos os campos de análise preenchidos.' },
        { tipo: 'paragrafo', texto: 'Falta de equipamento não conta como pendência nem como erro: o equipamento pode não se aplicar ao atendimento.' },
      ],
    },
    {
      id: 'relatorios-auditoria',
      grupo: 'Relatórios',
      pagina: 'relatorios',
      aba: 'auditoria',
      titulo: 'Auditoria',
      corpo: [
        { tipo: 'paragrafo', texto: 'Registro permanente de quem criou, alterou, ativou ou desativou cada cadastro, e de cada classificação de O.S. Nada é apagado desta lista.' },
      ],
    },
    {
      id: 'jornada',
      grupo: 'Ponto',
      pagina: 'jornada',
      titulo: 'Ponto',
      corpo: [
        { tipo: 'paragrafo', texto: 'Ponto fica no topo, ao lado de Gestão. Em **Meu Ponto** você registra a entrada, o intervalo e a saída. A tela só mostra os botões possíveis no momento.' },
        { tipo: 'paragrafo', texto: 'O cartão **Hoje** diz se o dia é de trabalho ou folga na sua escala e qual é o próximo feriado. **Ver calendário** mostra os dias da sua escala e os feriados nacionais e municipais deste ano e do próximo. A escala de cada funcionário é montada em **Gestão › Controle de Ponto › Escalas**: escolha o funcionário, o tipo (5x2, 6x1, personalizada com os dias da semana, 12x36, 24x48 ou 24x72) o horário padrão e o intervalo. Em **Horário por dia da semana** você muda só o dia diferente (ex.: sexta saindo às 16:00).' },
        { tipo: 'paragrafo', texto: 'No **Calendário da escala**, um clique num dia ajusta só aquela data: **Trabalho** (dia extra, outro horário, saída mais cedo ou feriado trabalhado), **Folga**, **Folga com banco de horas** (desconta as horas do dia) **Trabalho para banco de horas** (as horas viram crédito) ou **Justificado** (atestado, declaração, licença: o dia é abonado, sem falta nem desconto). Feriado não é trabalhado, a não ser que o dia seja marcado como Trabalho. **Seguir a escala** desfaz o ajuste. Nos calendários, trabalho tem fundo dourado, folga fica sem borda, feriado tem borda verde, banco de horas borda lilás, justificado borda âmbar e horário ajustado um pontinho no canto.' },
        { tipo: 'paragrafo', texto: 'Com horário definido, a **Folha de Ponto** mostra as horas previstas, o saldo de cada dia e o saldo do mês (banco de horas).' },
        { tipo: 'paragrafo', texto: 'Em **Gestão › Controle de Ponto**, quem tem a permissão "Ponto da equipe" vê a **Folha de Ponto** de cada funcionário por mês (entrada, intervalo, saída, horas, faltas e feriados), quem está em expediente agora e o histórico. Um clique numa linha abre a jornada com a linha do tempo, onde dá para corrigir a entrada ou a saída informando o motivo.' },
        { tipo: 'paragrafo', texto: '**+ Lançar jornada** registra um dia que o funcionário não conseguiu marcar. O lançamento pede um motivo e aparece na folha com a marca "ajuste". A folha pode ser impressa com espaço para as assinaturas.' },
      ],
    },
    {
      id: 'ponto-escalas',
      grupo: 'Ponto',
      pagina: 'gestao',
      titulo: 'Montar a escala',
      corpo: [
        { tipo: 'paragrafo', texto: 'Em **Gestão › Controle de Ponto › Escalas**, escolha o funcionário e o tipo de escala, o horário padrão e o intervalo.' },
        { tipo: 'paragrafo', texto: 'Nas escalas de revezamento (12x36, 24x48, 24x72), informe **um dia de trabalho**: a partir dele o sistema conta os dias seguintes.' },
        { tipo: 'paragrafo', texto: 'Em **Horário por dia da semana**, mude só o dia que for diferente (ex.: sexta saindo às 16:00).' },
        { tipo: 'paragrafo', texto: 'No **Calendário da escala**, clique num dia para mudar só aquela data: folga, trabalho extra, outro horário, feriado trabalhado, banco de horas ou dia justificado (atestado).' },
      ],
    },
    {
      id: 'ponto-lancar',
      grupo: 'Ponto',
      pagina: 'gestao',
      titulo: 'Lançar jornada',
      corpo: [
        { tipo: 'paragrafo', texto: 'Use quando o funcionário não conseguiu registrar o ponto. Informe o dia, a entrada, a saída, o intervalo e o motivo; o dia aparece na folha com a marca "ajuste".' },
        { tipo: 'paragrafo', texto: 'Saída antes da entrada conta como o dia seguinte (turno da noite).' },
      ],
    },
  ],
});
