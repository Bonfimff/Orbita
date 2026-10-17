//======================================================================================================
// CONTEUDO: Manual
//
// Organizado por pagina (campo `pagina`): a Central abre direto no topico da
// pagina em que a pessoa esta. Texto curto e direto; so descreve o que existe.
//======================================================================================================
window.OrbitaAjuda.META = {
  produto: 'KERNEL',
  versao: 'versão 1.0',
  atualizadoEm: '17/10/2026',
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
      id: 'configuracoes',
      grupo: 'Geral',
      titulo: 'Configurações e troca de senha',
      corpo: [
        { tipo: 'paragrafo', texto: 'Abra pela engrenagem, no rodapé do menu. Em **Minha conta** você corrige nome e e-mail.' },
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
        { tipo: 'paragrafo', texto: 'Em **Bases e Equipamentos** um seletor alterna entre as bases e os equipamentos. Todo equipamento fica numa base. Um clique no equipamento abre a ficha: a base, os dados, a **Composição** (os materiais que formam o equipamento, de um único item a um conjunto), os **Arquivos** (um explorador como o do Windows: crie pastas, envie ou arraste arquivos, e use o botão direito para abrir, baixar, recortar, copiar, colar, renomear, excluir ou proteger uma pasta; F2, Delete e Ctrl+C/X/V também funcionam; no celular, toque longo abre o menu), as **O.S.** da base (resumo com as mais recentes, destacando as que citam o equipamento, e links para o relatório completo da base ou do equipamento) e o histórico. No mapa, clicar numa base mostra os equipamentos dela, e cada um abre a ficha. Materiais e arquivos são incluídos, abertos e baixados ali mesmo. **Editar** muda só as características, e o cadastro de equipamentos fica em **O.S. › Cadastros › Equipamentos**. Pasta protegida (cadeado) só abre para quem pode alterar equipamentos; use para credenciais e acessos.' },
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
        { tipo: 'paragrafo', texto: 'Arquivos do contrato só podem ser anexados depois que ele for salvo.' },
        { tipo: 'paragrafo', texto: 'A aba **Funcionários** lista quem trabalha em campo. **+ Novo funcionário** e um clique na linha abrem o formulário em **Cadastros › Funcionários**, com tipo sanguíneo, informações de emergência e capacitações. O crachá do usuário ligado a ele mostra esses mesmos dados.' },
        { tipo: 'paragrafo', texto: 'A ficha do funcionário tem as abas **Dados**, **Admissão** (data de admissão, tipo de contrato, desligamento e tempo de casa), **Documentos** e **Férias**. Documentos e Férias aparecem depois que o cadastro é salvo.' },
        { tipo: 'paragrafo', texto: 'Em **Documentos** os arquivos ficam em pastas: documentos admissionais, folhas de ponto assinadas, contracheques assinados, férias, atestados e outros. Folha de ponto e contracheque pedem o mês de referência e aparecem agrupados por mês. Dá para escolher ou arrastar vários arquivos de uma vez (PDF, JPG ou PNG, até 10 MB cada).' },
        { tipo: 'paragrafo', texto: 'Em **Férias** o sistema calcula os períodos aquisitivos pela data de admissão (30 dias por ano), mostra o saldo e até quando cada período precisa ser tirado. Ao programar, informe o período, o início, o fim e, se houver, os dias vendidos (abono). Os dias de férias aparecem na folha de ponto e no calendário do funcionário. A subaba **Férias** em Gestão › Funcionários mostra todos de uma vez, com as vencidas e as que vencem em até 90 dias primeiro.' },
      ],
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
  ],
});
