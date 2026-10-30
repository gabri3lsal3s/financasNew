import type {
  TourTrackCategory,
  TourTrackGroup,
  TourTrackId,
  TourTrackMeta,
} from "./types";

/**
 * Catálogo canônico de metadados para todas as trilhas e micro-tours suportados.
 */
export const TOUR_TRACK_METAS: Record<TourTrackId, TourTrackMeta> = {
  // Trilha 0: Recursos Nativos (Exclusivo APK Android)
  app_native_apk: {
    id: "app_native_apk",
    title: "Recursos Nativos do APK Android",
    shortTitle: "App Nativo",
    description:
      "Aceleração nativa, leitor de notificações bancárias em tempo real e proteção biométrica.",
    category: "native",
    stepsCount: 3,
    iconName: "smartphone",
    startRoute: "/",
    badgeLabel: "3 passos",
    isNativeOnly: true,
  },

  // Trilha 1: Finanças Diárias & Cartões
  finances_overview: {
    id: "finances_overview",
    title: "Visão Geral Finanças & Saldo Livre",
    shortTitle: "Visão Geral",
    description:
      "Monitore o saldo livre real, ritmo de gastos do mês e indicadores consolidados.",
    category: "finances",
    stepsCount: 3,
    iconName: "wallet",
    startRoute: "/",
    badgeLabel: "3 passos",
  },
  finances_wizard: {
    id: "finances_wizard",
    title: "Botão Wizard (+) e Lançamento Rápido",
    shortTitle: "Wizard (+)",
    description:
      "Lançamento ultra-rápido de despesas, receitas, Pix e parcelamento inteligente.",
    category: "finances",
    stepsCount: 3,
    iconName: "plus-circle",
    startRoute: "/",
    badgeLabel: "3 passos",
  },
  finances_cards: {
    id: "finances_cards",
    title: "Cartões, Faturas e Limites",
    shortTitle: "Cartões & Faturas",
    description:
      "Faturas abertas, limite disponível, melhor dia de compra e parcelas futuras.",
    category: "finances",
    stepsCount: 3,
    iconName: "credit-card",
    startRoute: "/cartoes",
    badgeLabel: "3 passos",
  },
  finances_budgets: {
    id: "finances_budgets",
    title: "Categorias e Tetos de Gastos",
    shortTitle: "Tetos & Orçamentos",
    description:
      "Definição de tetos por categoria e alertas automáticos de ritmo de consumo.",
    category: "finances",
    stepsCount: 3,
    iconName: "pie-chart",
    startRoute: "/orcamentos",
    badgeLabel: "3 passos",
  },
  finances_insights: {
    id: "finances_insights",
    title: "Smart Advisor e Relatórios",
    shortTitle: "Advisor & Insights",
    description:
      "Recomendações automáticas de economia, radar de assinaturas e fechamento mensal.",
    category: "finances",
    stepsCount: 3,
    iconName: "lightbulb",
    startRoute: "/relatorios",
    badgeLabel: "3 passos",
  },

  // Trilha 2: Investimentos & Rebalanceamento
  investments_overview: {
    id: "investments_overview",
    title: "Visão Geral da Carteira",
    shortTitle: "Visão Patrimonial",
    description:
      "Distribuição global entre classes de ativos e evolução patrimonial consolidada.",
    category: "investments",
    stepsCount: 3,
    iconName: "trending-up",
    startRoute: "/investments",
    badgeLabel: "3 passos",
  },
  investments_assets: {
    id: "investments_assets",
    title: "Cadastro de Ativos / Nova Operação",
    shortTitle: "Nova Operação",
    description:
      "Como cadastrar novos ativos, registrar compras, vendas e controlar o saldo em caixa.",
    category: "investments",
    stepsCount: 2,
    iconName: "briefcase",
    startRoute: "/investments",
    badgeLabel: "2 passos",
  },
  investments_targets: {
    id: "investments_targets",
    title: "Metas por Classe e Ativo",
    shortTitle: "Metas de Alocação",
    description:
      "Percentuais ideais de alocação por classe e ativo para guiar seus aportes.",
    category: "investments",
    stepsCount: 2,
    iconName: "target",
    startRoute: "/investments?tab=metas",
    badgeLabel: "2 passos",
  },
  investments_aporte: {
    id: "investments_aporte",
    title: "Calculadora de Aporte Inteligente",
    shortTitle: "Aporte Inteligente",
    description:
      "Motor matemático de rebalanceamento que indica onde alocar cada centavo.",
    category: "investments",
    stepsCount: 2,
    iconName: "calculator",
    startRoute: "/investments?tab=aporte",
    badgeLabel: "2 passos",
  },

  // Trilha 3: Personalização, Visual & Suporte
  settings_support: {
    id: "settings_support",
    title: "Personalização, Privacidade e Suporte",
    shortTitle: "Privacidade & Ajuda",
    description:
      "Ocultação de saldos em público, alternância de tema e canal direto de atendimento.",
    category: "settings",
    stepsCount: 2,
    iconName: "settings",
    startRoute: "/",
    badgeLabel: "2 passos",
  },

  // Trilhas Originais (Compatibilidade Retroativa)
  finances: {
    id: "finances",
    title: "Finanças Diárias & Cartões",
    shortTitle: "Finanças Completo",
    description:
      "Tour consolidado com visão geral, transações, faturas de cartões e tetos de gastos.",
    category: "finances",
    stepsCount: 4,
    iconName: "wallet",
    startRoute: "/",
    badgeLabel: "4 passos",
  },
  investments: {
    id: "investments",
    title: "Investimentos & Rebalanceamento",
    shortTitle: "Investimentos Completo",
    description:
      "Tour consolidado com visão patrimonial, metas de alocação e cálculo de aporte.",
    category: "investments",
    stepsCount: 3,
    iconName: "trending-up",
    startRoute: "/investments",
    badgeLabel: "3 passos",
  },
};

/**
 * Estrutura de grupos de trilhas com metadados para exibição hierárquica no Hub de Tours.
 */
export const TOUR_TRACK_GROUPS: readonly TourTrackGroup[] = [
  {
    category: "native",
    title: "App Nativo Android",
    description:
      "Recursos acelerados e inteligência bancária exclusivos para smartphones.",
    iconName: "smartphone",
    badgeLabel: "Exclusivo APK",
    isNativeOnly: true,
    tracks: [TOUR_TRACK_METAS.app_native_apk],
  },
  {
    category: "finances",
    title: "Finanças Diárias & Cartões",
    description:
      "Gestão de despesas, receitas, faturas de cartões e tetos de gastos.",
    iconName: "wallet",
    badgeLabel: "5 micro-tours",
    tracks: [
      TOUR_TRACK_METAS.finances_overview,
      TOUR_TRACK_METAS.finances_wizard,
      TOUR_TRACK_METAS.finances_cards,
      TOUR_TRACK_METAS.finances_budgets,
      TOUR_TRACK_METAS.finances_insights,
    ],
  },
  {
    category: "investments",
    title: "Investimentos & Rebalanceamento",
    description:
      "Distribuição patrimonial, metas de alocação e cálculo matemático de aportes.",
    iconName: "trending-up",
    badgeLabel: "4 micro-tours",
    tracks: [
      TOUR_TRACK_METAS.investments_overview,
      TOUR_TRACK_METAS.investments_assets,
      TOUR_TRACK_METAS.investments_targets,
      TOUR_TRACK_METAS.investments_aporte,
    ],
  },
  {
    category: "settings",
    title: "Personalização & Suporte",
    description:
      "Controle de privacidade, personalização visual e canal de suporte ao usuário.",
    iconName: "settings",
    badgeLabel: "1 micro-tour",
    tracks: [TOUR_TRACK_METAS.settings_support],
  },
] as const;

/**
 * Retorna os metadados de uma trilha específica.
 */
export function getTourTrackMeta(trackId: TourTrackId): TourTrackMeta | undefined {
  return TOUR_TRACK_METAS[trackId];
}

/**
 * Retorna os grupos de trilhas filtrando itens nativos de acordo com a plataforma.
 */
export function getTourTrackGroups(isNativeApp: boolean = false): TourTrackGroup[] {
  if (isNativeApp) {
    return [...TOUR_TRACK_GROUPS];
  }

  return TOUR_TRACK_GROUPS.filter((group) => !group.isNativeOnly).map((group) => ({
    ...group,
    tracks: group.tracks.filter((track) => !track.isNativeOnly),
  }));
}

/**
 * Retorna as trilhas pertencentes a uma categoria específica.
 */
export function getTourTracksByCategory(category: TourTrackCategory): TourTrackMeta[] {
  const group = TOUR_TRACK_GROUPS.find((g) => g.category === category);
  return group ? [...group.tracks] : [];
}
