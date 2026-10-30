import type { TourStep, TourTrackId } from "./types";

export const TOUR_STEPS: Record<TourTrackId, TourStep[]> = {
  // Trilha Original / Legado 1: Finanças Diárias Consolidado (4 passos)
  finances: [
    {
      id: "finances-overview",
      track: "finances",
      order: 1,
      title: "Visão Geral & Fluxo Consolidado",
      description:
        "Monitore seu saldo livre real, ritmo de gastos e fluxo diário do mês corrente com total clareza.",
      targetRoute: "/",
      targetSelector: '[data-tour="overview-kpis"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 4",
      actionLabel: "Explorar Dashboard",
    },
    {
      id: "finances-transactions",
      track: "finances",
      order: 2,
      title: "Lançamentos & Categorização",
      description:
        "Acompanhe receitas e despesas organizadas por categoria, com suporte a parcelas e conciliação.",
      targetRoute: "/transacoes",
      targetSelector: '[data-tour="transactions-feed-card"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 4",
      actionLabel: "Ver Transações",
    },
    {
      id: "finances-cards",
      track: "finances",
      order: 3,
      title: "Cartões & Faturas Inteligentes",
      description:
        "Visualize faturas abertas, limite disponível e parcelas futuras organizadas por competência.",
      targetRoute: "/cartoes",
      targetSelector: '[data-tour="cards-content"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 4",
      actionLabel: "Ver Cartões",
    },
    {
      id: "finances-budgets",
      track: "finances",
      order: 4,
      title: "Orçamentos & Metas de Gastos",
      description:
        "Defina tetos por categoria e receba alertas de ritmo antes de estourar seu orçamento mensal.",
      targetRoute: "/orcamentos",
      targetSelector: '[data-tour="budgets-content"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 4 de 4",
      actionLabel: "Ver Orçamentos",
    },
  ],

  // Trilha Original / Legado 2: Investimentos & Rebalanceamento Consolidado (3 passos)
  investments: [
    {
      id: "investments-overview",
      track: "investments",
      order: 1,
      title: "Visão Patrimonial Consolidada",
      description:
        "Acompanhe a distribuição global do seu patrimônio entre renda fixa, ações, fundos imobiliários e cripto.",
      targetRoute: "/investments",
      targetSelector: '[data-tour="investments-summary"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Ver Carteira",
    },
    {
      id: "investments-targets",
      track: "investments",
      order: 2,
      title: "Metas de Alocação por Classe & Ativo",
      description:
        "Defina os percentuais ideais para cada classe e ativo para guiar seus aportes sem viés emocional.",
      targetRoute: "/investments?tab=metas",
      targetSelector: '[data-tour="investments-targets"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Metas",
    },
    {
      id: "investments-rebalance",
      track: "investments",
      order: 3,
      title: "Calculadora de Aporte Inteligente",
      description:
        "Informe quanto deseja investir e o motor matemático calcula exatamente onde alocar para rebalancear.",
      targetRoute: "/investments?tab=aporte",
      targetSelector: '[data-tour="investments-rebalance"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Calcular Aporte",
    },
  ],

  // Micro-Tour 1.0: Visão Geral Finanças & Saldo Livre (3 passos)
  finances_overview: [
    {
      id: "finances-overview-kpis",
      track: "finances_overview",
      order: 1,
      title: "Saldo Livre Real & Indicadores",
      description:
        "Monitore o saldo livre real descontando as faturas de cartões e despesas já comprometidas no mês.",
      targetRoute: "/",
      targetSelector: '[data-tour="overview-kpis"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Próximo",
    },
    {
      id: "finances-overview-transactions",
      track: "finances_overview",
      order: 2,
      title: "Lançamentos e Ritmo Financeiro",
      description:
        "Acompanhe despesas e receitas organizadas por categoria para manter o orçamento equilibrado.",
      targetRoute: "/transacoes",
      targetSelector: '[data-tour="transactions-feed-card"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Lançamentos",
    },
    {
      id: "finances-overview-budgets",
      track: "finances_overview",
      order: 3,
      title: "Tetos e Metas Mensais",
      description:
        "Defina limites por categoria e receba alertas proativos antes de ultrapassar o valor estipulado.",
      targetRoute: "/orcamentos",
      targetSelector: '[data-tour="budgets-content"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 1.1: O Botão Wizard (+) e Lançamento Rápido (3 passos)
  finances_wizard: [
    {
      id: "wizard-bottom-btn",
      track: "finances_wizard",
      order: 1,
      title: "Acesso Rápido com o Botão Central (+)",
      description:
        "O botão de destaque central na barra inferior permite registrar despesas, receitas ou transferências com apenas um toque.",
      targetRoute: "/",
      targetSelector: '[data-tour="bottom-nav-wizard"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Próximo",
    },
    {
      id: "wizard-flow-selection",
      track: "finances_wizard",
      order: 2,
      title: "Lançamento de Despesa, Receita e Pix",
      description:
        "Selecione a categoria com preenchimento preditivo e anexe comprovantes ou anotações com facilidade.",
      targetRoute: "/transacoes",
      targetSelector: '[data-tour="transactions-feed-card"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Parcelas",
    },
    {
      id: "wizard-installments",
      track: "finances_wizard",
      order: 3,
      title: "Parcelamento Inteligente",
      description:
        "Divida compras no cartão ou parcelamentos fixos em até 60x com recálculo automático de competência e datas de vencimento.",
      targetRoute: "/cartoes",
      targetSelector: '[data-tour="cards-content"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 1.2: Cartões, Faturas e Limites (3 passos)
  finances_cards: [
    {
      id: "cards-overview",
      track: "finances_cards",
      order: 1,
      title: "Fatura Aberta & Limite Disponível",
      description:
        "Visualize o total acumulado na fatura atual, limite de crédito disponível e previsão de fechamento.",
      targetRoute: "/cartoes",
      targetSelector: '[data-tour="cards-content"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Próximo",
    },
    {
      id: "cards-best-day",
      track: "finances_cards",
      order: 2,
      title: "Melhor Dia de Compra",
      description:
        "Otimize suas compras utilizando a data de fechamento para ganhar até 40 dias sem juros.",
      targetRoute: "/cartoes",
      targetSelector: '[data-tour="cards-content"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Futuras",
    },
    {
      id: "cards-future-installments",
      track: "finances_cards",
      order: 3,
      title: "Comprometimento com Parcelas Futuras",
      description:
        "Acompanhe as parcelas dos próximos meses para planejar seus gastos sem surpresas na fatura.",
      targetRoute: "/cartoes",
      targetSelector: '[data-tour="cards-content"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 1.3: Categorias e Tetos de Gastos (3 passos)
  finances_budgets: [
    {
      id: "budgets-overview",
      track: "finances_budgets",
      order: 1,
      title: "Planejamento por Categoria",
      description:
        "Estabeleça limites máximos mensais para moradia, alimentação, transporte, lazer e outras despesas.",
      targetRoute: "/orcamentos",
      targetSelector: '[data-tour="budgets-content"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Próximo",
    },
    {
      id: "budgets-pacing-alert",
      track: "finances_budgets",
      order: 2,
      title: "Ritmo de Consumo e Alertas de Estouro",
      description:
        "Barras de progresso e indicadores visuais alertam quando o ritmo diário estiver acima do planejado.",
      targetRoute: "/orcamentos",
      targetSelector: '[data-tour="budgets-content"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Ajustes",
    },
    {
      id: "budgets-proportional-adjust",
      track: "finances_budgets",
      order: 3,
      title: "Ajuste Inteligente de Orçamento",
      description:
        "Realoque sobras de categorias para absorver desvios pontuais mantendo o equilíbrio mensal.",
      targetRoute: "/orcamentos",
      targetSelector: '[data-tour="budgets-content"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 1.4: Smart Advisor e Relatórios (3 passos)
  finances_insights: [
    {
      id: "insights-smart-advisor",
      track: "finances_insights",
      order: 1,
      title: "Smart Advisor & Diagnóstico Financeiro",
      description:
        "Receba insights contextuais no Dashboard com oportunidades de corte de gastos supérfluos e otimização do fluxo.",
      targetRoute: "/",
      targetSelector: '[data-tour="overview-kpis"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Próximo",
    },
    {
      id: "insights-recurring-radar",
      track: "finances_insights",
      order: 2,
      title: "Radar de Assinaturas e Recorrências",
      description:
        "Identifique cobranças recorrentes e assinaturas ativas na sua fatura para evitar gastos esquecidos.",
      targetRoute: "/cartoes",
      targetSelector: '[data-tour="cards-content"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Relatórios",
    },
    {
      id: "insights-monthly-report",
      track: "finances_insights",
      order: 3,
      title: "Fechamento Mensal Consolidado",
      description:
        "Gráficos de evolução histórica, fluxo líquido e comparativo com meses anteriores na tela de Relatórios.",
      targetRoute: "/relatorios",
      targetSelector: '[data-tour="reports-content"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 2.0: Visão Geral da Carteira (3 passos)
  investments_overview: [
    {
      id: "invest-overview-summary",
      track: "investments_overview",
      order: 1,
      title: "Patrimônio Consolidado",
      description:
        "Acompanhe o valor total investido, saldo em caixa e distribuição global por classe de ativos.",
      targetRoute: "/investments",
      targetSelector: '[data-tour="investments-summary"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Próximo",
    },
    {
      id: "invest-overview-targets",
      track: "investments_overview",
      order: 2,
      title: "Alocação Estratégica de Ativos",
      description:
        "Compare a posição atual da sua carteira com a meta desejada para cada classe de investimento.",
      targetRoute: "/investments?tab=metas",
      targetSelector: '[data-tour="investments-targets"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Ver Aportes",
    },
    {
      id: "invest-overview-rebalance",
      track: "investments_overview",
      order: 3,
      title: "Rebalanceamento Automático",
      description:
        "Calcule como direcionar novos aportes para recompor as metas sem necessidade de resgatar ativos.",
      targetRoute: "/investments?tab=aporte",
      targetSelector: '[data-tour="investments-rebalance"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 2.1: Cadastro de Ativos / Nova Operação (2 passos)
  investments_assets: [
    {
      id: "invest-assets-new-op",
      track: "investments_assets",
      order: 1,
      title: "Botão Nova Operação",
      description:
        "Cadastre novos investimentos em Renda Fixa, Ações, FIIs ou Cripto informando quantidade, preço médio e corretora.",
      targetRoute: "/investments",
      targetSelector: '[data-tour="investments-new-op"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 2",
      actionLabel: "Próximo",
    },
    {
      id: "invest-assets-cash",
      track: "investments_assets",
      order: 2,
      title: "Saldo em Caixa de Corretora",
      description:
        "Controle o dinheiro parado na conta da corretora pronto para ser direcionado aos próximos aportes.",
      targetRoute: "/investments",
      targetSelector: '[data-tour="investments-summary"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 2",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 2.2: Metas por Classe e Ativo (2 passos)
  investments_targets: [
    {
      id: "invest-targets-classes",
      track: "investments_targets",
      order: 1,
      title: "Metas por Classe de Ativos",
      description:
        "Defina a porcentagem ideal para Renda Fixa, Fundos Imobiliários, Ações Brasil e Ativos Internacionais.",
      targetRoute: "/investments?tab=metas",
      targetSelector: '[data-tour="investments-targets"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 2",
      actionLabel: "Próximo",
    },
    {
      id: "invest-targets-individual",
      track: "investments_targets",
      order: 2,
      title: "Metas por Ativo Individual",
      description:
        "Ajuste o peso relativo de cada papel dentro da classe para calibrar a exposição ao risco da carteira.",
      targetRoute: "/investments?tab=metas",
      targetSelector: '[data-tour="investments-targets"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 2",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 2.3: Calculadora de Aporte Inteligente (2 passos)
  investments_aporte: [
    {
      id: "invest-aporte-input",
      track: "investments_aporte",
      order: 1,
      title: "Valor do Novo Aporte",
      description:
        "Informe o valor em reais disponível para investir no mês atual ou no período desejado.",
      targetRoute: "/investments?tab=aporte",
      targetSelector: '[data-tour="investments-rebalance"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 2",
      actionLabel: "Próximo",
    },
    {
      id: "invest-aporte-recommendation",
      track: "investments_aporte",
      order: 2,
      title: "Alocação Otimizada pelo Motor",
      description:
        "O algoritmo calcula a distribuição exata entre os ativos mais distantes da meta sem vender posições.",
      targetRoute: "/investments?tab=aporte",
      targetSelector: '[data-tour="investments-rebalance"]',
      preferredPlacement: "top",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 2",
      actionLabel: "Concluir",
    },
  ],

  // Micro-Tour 3.1: Personalização, Privacidade e Suporte (2 passos)
  settings_support: [
    {
      id: "settings-privacy-theme",
      track: "settings_support",
      order: 1,
      title: "Modo Privacidade & Tema Visual",
      description:
        "Oculte seus saldos ao usar o app em público com o botão de olho e alterne entre os temas claro e escuro no topo da tela.",
      targetRoute: "/",
      targetSelector: '[data-tour="header-privacy-theme"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 2",
      actionLabel: "Próximo",
    },
    {
      id: "settings-support-channel",
      track: "settings_support",
      order: 2,
      title: "Canal Direto de Suporte & Ajustes",
      description:
        "Acesse a central de ajuda, tire dúvidas e configure suas preferências de conta no menu de Configurações.",
      targetRoute: "/configuracoes",
      targetSelector: '[data-tour="overview-kpis"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 2",
      actionLabel: "Concluir",
    },
  ],

  // Trilha 0: Recursos Nativos do APK Android (3 passos)
  app_native_apk: [
    {
      id: "native-apk-welcome",
      track: "app_native_apk",
      order: 1,
      title: "Experiência Nativa de Alto Desempenho",
      description:
        "Aplicativo nativo Android compilado com aceleração de hardware, transições fluidas e inicialização instantânea.",
      targetRoute: "/",
      targetSelector: '[data-tour="overview-kpis"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 1 de 3",
      actionLabel: "Próximo",
    },
    {
      id: "native-apk-notifications",
      track: "app_native_apk",
      order: 2,
      title: "Leitor Inteligente de Notificações Bancárias",
      description:
        "Captura automática de compras de cartões e comprovantes Pix em tempo real, sem necessidade de digitação manual.",
      targetRoute: "/transacoes",
      targetSelector: '[data-tour="transactions-feed-card"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 2 de 3",
      actionLabel: "Conhecer Captura",
    },
    {
      id: "native-apk-security",
      track: "app_native_apk",
      order: 3,
      title: "Biometria & Escudo de Privacidade",
      description:
        "Proteja seus dados patrimoniais com desbloqueio por impressão digital e ocultação automática de valores ao alternar aplicativos.",
      targetRoute: "/",
      targetSelector: '[data-tour="header-privacy-theme"]',
      preferredPlacement: "bottom",
      spotlightPadding: 10,
      badgeLabel: "Passo 3 de 3",
      actionLabel: "Concluir",
    },
  ],
};

/** Retorna os passos ordenados da trilha selecionada. */
export function getTourSteps(track: TourTrackId): TourStep[] {
  return TOUR_STEPS[track] ?? [];
}
