//======================================================================================================
// CONTEXTO OPERACIONAL - provedor da pagina Gestão (gestao.html)
// Um contexto por sub-tela: Painel Geral, Usuários, Perfis de Acesso,
// Contratos. So chama a API quando a secao correspondente fica visivel.
//======================================================================================================
(function () {
  'use strict';

  const CP = window.ContextPanel;
  const api = window.RelatoriosApi;
  if (!CP || !api) return;

  function numero(valor) {
    return api.numero(valor || 0);
  }

  async function contextoPainelGeral() {
    CP.carregando('Contexto Operacional');
    try {
      const dados = await CP.buscar('/contexto/painel-geral');
      const kpis = dados.kpis || {};
      const blocos = [{ tipo: 'titulo', texto: 'Sistema operacional' }];
      const rotulos = [
        ['abertas', 'O.S. abertas'], ['em_execucao', 'Em execução'],
        ['pendentes', 'Pendentes'], ['encerradas_30d', 'Encerradas (30d)'],
        ['problemas_recorrentes', 'Problemas recorrentes'],
      ];
      let algumIndicador = false;
      rotulos.forEach(([campo, rotulo]) => {
        if (kpis[campo] === undefined || kpis[campo] === null) return;
        algumIndicador = true;
        blocos.push({ tipo: 'kpi', rotulo: rotulo, valor: numero(kpis[campo]) });
      });

      if (dados.alertas && dados.alertas.length) {
        blocos.push({ tipo: 'separador' });
        blocos.push({ tipo: 'titulo', texto: 'Atenção' });
        dados.alertas.forEach((a) => {
          if (a.tipo === 'bases_com_alerta') {
            blocos.push({ tipo: 'alerta', texto: numero(a.total) + ' base(s) com equipamento em atenção' });
          } else if (a.tipo === 'os_atrasada') {
            blocos.push({ tipo: 'alerta', texto: numero(a.total) + ' O.S. aberta(s) há mais de 24h' });
          }
        });
      }

      if (algumIndicador) {
        blocos.push({ tipo: 'separador' });
        blocos.push({ tipo: 'titulo', texto: 'Atalhos' });
        blocos.push({ tipo: 'atalho', texto: 'Ver O.S. abertas', href: 'ordens.html' });
      }

      CP.render({ titulo: 'Contexto Operacional', blocos: algumIndicador || (dados.alertas || []).length ? blocos : [] });
    } catch (erro) {
      CP.erro('Contexto Operacional', 'Contexto ainda não disponível para o seu perfil.');
    }
  }

  async function contextoUsuarios() {
    CP.carregando('Contexto Operacional');
    try {
      const d = await CP.buscar('/contexto/usuarios');
      const blocos = [
        { tipo: 'titulo', texto: 'Usuários' },
        { tipo: 'kpi', rotulo: 'Cadastrados', valor: numero(d.total) },
        { tipo: 'kpi', rotulo: 'Administradores', valor: numero(d.administradores) },
        { tipo: 'kpi', rotulo: 'Demais usuários', valor: numero(d.demais) },
      ];
      const alertas = [];
      if (d.sem_perfil) alertas.push(numero(d.sem_perfil) + ' usuário(s) sem perfil');
      if (d.sem_contrato) alertas.push(numero(d.sem_contrato) + ' usuário(s) sem contrato vinculado');
      if (alertas.length) {
        blocos.push({ tipo: 'separador' });
        blocos.push({ tipo: 'titulo', texto: 'Atenção' });
        alertas.forEach((texto) => blocos.push({ tipo: 'alerta', texto }));
      }
      CP.render({ titulo: 'Contexto Operacional', blocos });
    } catch (erro) {
      CP.erro('Contexto Operacional', 'Contexto ainda não disponível para o seu perfil.');
    }
  }

  async function contextoPerfis() {
    CP.carregando('Contexto Operacional');
    try {
      const d = await CP.buscar('/contexto/perfis');
      const blocos = [
        { tipo: 'titulo', texto: 'Permissões' },
        { tipo: 'kpi', rotulo: 'Perfis cadastrados', valor: numero((d.perfis || []).length) },
      ];
      (d.perfis || []).forEach((p) => {
        blocos.push({ tipo: 'kpi', rotulo: p.nome, valor: numero(p.total_usuarios) + ' usuário(s)' });
      });
      if (d.sem_perfil) {
        blocos.push({ tipo: 'separador' });
        blocos.push({ tipo: 'alerta', texto: numero(d.sem_perfil) + ' usuário(s) sem perfil' });
        blocos.push({ tipo: 'atalho', texto: 'Revisar acessos', href: '#' });
      }
      CP.render({ titulo: 'Contexto Operacional', blocos });
    } catch (erro) {
      CP.erro('Contexto Operacional', 'Contexto ainda não disponível para o seu perfil.');
    }
  }

  async function contextoContrato(id) {
    if (!id) {
      CP.render({
        titulo: 'Contexto Operacional',
        blocos: [{ tipo: 'texto', texto: 'Selecione um contrato para ver o resumo da estrutura vinculada.' }],
      });
      return;
    }
    CP.carregando('Contexto Operacional');
    try {
      const d = await CP.buscar('/contexto/contrato/' + id);
      const blocos = [{ tipo: 'titulo', texto: 'Contrato selecionado' }];
      if (d.bases_vinculadas !== null) blocos.push({ tipo: 'kpi', rotulo: 'Bases vinculadas', valor: numero(d.bases_vinculadas) });
      if (d.usuarios_autorizados !== null) blocos.push({ tipo: 'kpi', rotulo: 'Usuários autorizados', valor: numero(d.usuarios_autorizados) });
      if (d.equipamentos !== null && d.equipamentos !== undefined) blocos.push({ tipo: 'kpi', rotulo: 'Equipamentos', valor: numero(d.equipamentos) });
      if (d.os_periodo_30d !== null) blocos.push({ tipo: 'kpi', rotulo: 'O.S. (30 dias)', valor: numero(d.os_periodo_30d) });
      if (d.bases_sem_regiao) {
        blocos.push({ tipo: 'separador' });
        blocos.push({ tipo: 'titulo', texto: 'Atenção' });
        blocos.push({ tipo: 'alerta', texto: numero(d.bases_sem_regiao) + ' base(s) sem região' });
      }
      CP.render({ titulo: 'Contexto Operacional', blocos });
    } catch (erro) {
      CP.erro('Contexto Operacional', 'Contexto ainda não disponível para o seu perfil.');
    }
  }

  function iniciar() {
    const abaAtiva = document.querySelector('.menu-gestao .tab-btn.active[data-tab]');
    const tabAtiva = abaAtiva ? abaAtiva.dataset.tab : 'painel-geral';
    if (tabAtiva === 'usuarios') contextoUsuarios(); else contextoPainelGeral();

    document.querySelectorAll('.menu-gestao .tab-btn[data-tab]').forEach((botao) => {
      botao.addEventListener('click', () => {
        const tabId = botao.dataset.tab;
        if (tabId === 'painel-geral') contextoPainelGeral();
        else if (tabId === 'usuarios') contextoUsuarios();
        else if (tabId === 'contratos') contextoContrato(null);
      });
    });

    document.getElementById('usuarios-subabas')?.addEventListener('click', (evento) => {
      const botao = evento.target.closest('[data-usu]');
      if (!botao) return;
      if (botao.dataset.usu === 'perfis') contextoPerfis();
      else contextoUsuarios();
    });

    document.addEventListener('orbita:contrato-selecionado', (evento) => {
      contextoContrato(evento.detail && evento.detail.id);
    });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
