import type { AnyTourTrackId, TourTrackCategory } from "./types";

export type { AnyTourTrackId };

/**
 * Opções de formatação para rótulos de trilhas de demonstração.
 */
export interface TourTrackLabelOptions {
  /**
   * Se verdadeiro, retorna subtítulo contextual específico (ex.: "Finanças · Cartões", "Compartilhadas · Racha com Pix")
   * em vez do nome da macro-categoria ("Finanças Diárias", "Compartilhadas").
   */
  contextual?: boolean;
}

/**
 * Rótulos semânticos canônicos para cada macro-categoria de trilhas do tour.
 */
export const TOUR_CATEGORY_LABELS: Record<TourTrackCategory, string> = {
  finances: "Finanças Diárias",
  investments: "Investimentos",
  settings: "Configurações",
  native: "App Nativo",
  shared: "Compartilhadas",
} as const;

/**
 * Descrições amigáveis em pt-BR para cada macro-categoria do tour de demonstração.
 */
export const TOUR_CATEGORY_DESCRIPTIONS: Record<TourTrackCategory, string> = {
  finances:
    "Gestão de despesas, receitas, faturas de cartões e tetos de gastos.",
  investments:
    "Distribuição patrimonial, metas de alocação e cálculo matemático de aportes.",
  settings:
    "Controle de privacidade, personalização visual e canal de suporte ao usuário.",
  native:
    "Recursos acelerados e inteligência bancária exclusivos para smartphones.",
  shared:
    "Racha de despesas com Pix, vaquinha coletiva e gestão colaborativa familiar.",
} as const;

/**
 * Mapeamento estrito e canônico de cada trilha/micro-tour para seu rótulo semântico de macro-categoria.
 * Garante que micro-tours de finanças sempre exibam "Finanças Diárias", investimentos "Investimentos", etc.
 */
export const TOUR_TRACK_CATEGORY_LABELS: Record<AnyTourTrackId, string> = {
  // Finanças Diárias e Pessoais
  finances: "Finanças Diárias",
  finances_overview: "Finanças Diárias",
  finances_wizard: "Finanças Diárias",
  finances_cards: "Finanças Diárias",
  finances_debts: "Finanças Diárias",
  finances_budgets: "Finanças Diárias",
  finances_insights: "Finanças Diárias",

  // Investimentos e Rebalanceamento
  investments: "Investimentos",
  investments_overview: "Investimentos",
  investments_assets: "Investimentos",
  investments_targets: "Investimentos",
  investments_aporte: "Investimentos",

  // Configurações, Privacidade e Suporte
  settings_support: "Configurações",

  // App Nativo Android
  app_native_apk: "App Nativo",

  // Finanças Compartilhadas, Família e Metas Coletivas
  shared_finances: "Compartilhadas",
  finances_split: "Compartilhadas",
  finances_family: "Compartilhadas",
  finances_goals: "Compartilhadas",
} as const;

/**
 * Subtítulos contextuais detalhados para cada trilha de demonstração.
 */
export const TOUR_TRACK_CONTEXTUAL_LABELS: Record<AnyTourTrackId, string> = {
  // Finanças Diárias e Pessoais
  finances: "Finanças Diárias",
  finances_overview: "Finanças · Visão Geral",
  finances_wizard: "Finanças · Lançamentos",
  finances_cards: "Finanças · Cartões",
  finances_debts: "Finanças · Contas & Dívidas",
  finances_budgets: "Finanças · Orçamentos",
  finances_insights: "Finanças · Insights",

  // Investimentos e Rebalanceamento
  investments: "Investimentos",
  investments_overview: "Investimentos · Visão Geral",
  investments_assets: "Investimentos · Ativos",
  investments_targets: "Investimentos · Metas",
  investments_aporte: "Investimentos · Aporte",

  // Configurações, Privacidade e Suporte
  settings_support: "Configurações",

  // App Nativo Android
  app_native_apk: "App Nativo",

  // Finanças Compartilhadas, Família e Metas Coletivas
  shared_finances: "Compartilhadas",
  finances_split: "Compartilhadas · Racha com Pix",
  finances_family: "Compartilhadas · Modo Família",
  finances_goals: "Compartilhadas · Metas Coletivas",
} as const;

/**
 * Títulos canônicos em pt-BR para cada trilha e micro-tour do tour guiado.
 */
export const TOUR_TRACK_TITLES: Record<AnyTourTrackId, string> = {
  // Finanças Diárias e Pessoais
  finances: "Finanças Diárias & Cartões",
  finances_overview: "Visão Geral Finanças & Saldo Livre",
  finances_wizard: "Botão Wizard (+) e Lançamento Rápido",
  finances_cards: "Cartões, Faturas e Limites",
  finances_debts: "Contas, Dívidas e Contratos",
  finances_budgets: "Categorias e Tetos de Gastos",
  finances_insights: "Smart Advisor e Relatórios",

  // Investimentos e Rebalanceamento
  investments: "Investimentos & Rebalanceamento",
  investments_overview: "Visão Geral da Carteira",
  investments_assets: "Cadastro de Ativos / Nova Operação",
  investments_targets: "Metas por Classe e Ativo",
  investments_aporte: "Calculadora de Aporte Inteligente",

  // Configurações, Privacidade e Suporte
  settings_support: "Personalização, Modos Visuais e Suporte",

  // App Nativo Android
  app_native_apk: "Recursos Nativos do APK Android",

  // Finanças Compartilhadas, Família e Metas Coletivas
  shared_finances: "Finanças Compartilhadas & Modo Família",
  finances_split: "Racha de Despesas com Pix",
  finances_family: "Modo Família Multi-Contas",
  finances_goals: "Metas Coletivas & Vaquinha Pix",
} as const;

/**
 * Títulos curtos para badges e cards compactos de cada trilha.
 */
export const TOUR_TRACK_SHORT_TITLES: Record<AnyTourTrackId, string> = {
  // Finanças Diárias e Pessoais
  finances: "Finanças Completo",
  finances_overview: "Visão Geral",
  finances_wizard: "Wizard (+)",
  finances_cards: "Cartões & Faturas",
  finances_debts: "Contas & Dívidas",
  finances_budgets: "Tetos & Orçamentos",
  finances_insights: "Advisor & Insights",

  // Investimentos e Rebalanceamento
  investments: "Investimentos Completo",
  investments_overview: "Visão Patrimonial",
  investments_assets: "Nova Operação",
  investments_targets: "Metas de Alocação",
  investments_aporte: "Aporte Inteligente",

  // Configurações, Privacidade e Suporte
  settings_support: "Personalização & Ajuda",

  // App Nativo Android
  app_native_apk: "App Nativo",

  // Finanças Compartilhadas, Família e Metas Coletivas
  shared_finances: "Compartilhadas Completo",
  finances_split: "Racha com Pix",
  finances_family: "Modo Família",
  finances_goals: "Metas Coletivas",
} as const;

/**
 * Descrições amigáveis em pt-BR dos objetivos de cada trilha e micro-tour do aplicativo.
 */
export const TOUR_TRACK_DESCRIPTIONS: Record<AnyTourTrackId, string> = {
  // Finanças Diárias e Pessoais
  finances:
    "Jornada sequencial completa com saldo livre, botão wizard, lançamentos, extrato, faturas, parcelamentos, tetos e relatórios.",
  finances_overview:
    "Monitore o saldo livre real, ritmo de gastos do mês e indicadores consolidados.",
  finances_wizard:
    "Lançamento ultra-rápido de despesas, receitas, Pix e parcelamento inteligente.",
  finances_cards:
    "Faturas abertas, limite disponível, melhor dia de compra e parcelas futuras.",
  finances_debts:
    "Controle de contas a pagar, recebíveis pendentes e simulação de contratos de crédito.",
  finances_budgets:
    "Definição de tetos por categoria e alertas automáticos de ritmo de consumo.",
  finances_insights:
    "Recomendações automáticas de economia, radar de assinaturas e fechamento mensal.",

  // Investimentos e Rebalanceamento
  investments:
    "Jornada patrimonial completa com visão geral, nova operação, metas de alocação, cálculo de aportes e proventos.",
  investments_overview:
    "Distribuição global entre classes de ativos e evolução patrimonial consolidada.",
  investments_assets:
    "Como cadastrar novos ativos, registrar compras, vendas e controlar o saldo em caixa.",
  investments_targets:
    "Percentuais ideais de alocação por classe e ativo para guiar seus aportes.",
  investments_aporte:
    "Motor matemático de rebalanceamento que indica onde alocar cada centavo.",

  // Configurações, Privacidade e Suporte
  settings_support:
    "Atalhos de privacidade, modos de experiência, identidade visual, notificações e canal direto de atendimento.",

  // App Nativo Android
  app_native_apk:
    "O Tripé de Plataformas, leitor passivo de notificações bancárias, biometria física e escudo anti-print.",

  // Finanças Compartilhadas, Família e Metas Coletivas
  shared_finances:
    "Jornada completa de finanças colaborativas, divisão de despesas via Pix, termômetro de metas e orçamento familiar unificado.",
  finances_split:
    "Divisão inteligente de contas e eventos com amigos, cobrança por Pix e recibos automáticos via WhatsApp.",
  finances_family:
    "Gestão orçamentária para casais e famílias com cartões independentes, teto conjunto e equilíbrio sem atrito.",
  finances_goals:
    "Vaquinha colaborativa com termômetro em tempo real, chave Pix para arrecadação e prestação de contas pública.",
} as const;

/**
 * Retorna a macro-categoria semântica de uma trilha ativa.
 */
export function getTourTrackCategory(
  trackId: AnyTourTrackId | string | null | undefined,
): TourTrackCategory {
  if (!trackId) {
    return "finances";
  }

  if (typeof trackId === "string") {
    if (trackId.startsWith("investments")) {
      return "investments";
    }
    if (trackId.startsWith("settings")) {
      return "settings";
    }
    if (trackId.startsWith("app_native") || trackId.startsWith("native")) {
      return "native";
    }
    if (
      trackId.startsWith("shared") ||
      trackId === "finances_split" ||
      trackId === "finances_family" ||
      trackId === "finances_goals"
    ) {
      return "shared";
    }
  }

  return "finances";
}

/**
 * Retorna o rótulo semântico canônico da categoria da trilha ativa para exibição em badges e cabeçalhos.
 *
 * @param trackId - Identificador único da trilha ou micro-tour ativo.
 * @param options - Configurações opcionais de formatação (ex: contextual para subtítulo).
 * @returns Rótulo formatado em pt-BR (ex: "Finanças Diárias", "Investimentos", "Configurações", "App Nativo", "Compartilhadas").
 */
export function getTourTrackCategoryLabel(
  trackId: AnyTourTrackId | string | null | undefined,
  options?: TourTrackLabelOptions,
): string {
  if (!trackId) {
    return "Finanças Diárias";
  }

  if (options?.contextual && trackId in TOUR_TRACK_CONTEXTUAL_LABELS) {
    return TOUR_TRACK_CONTEXTUAL_LABELS[trackId as AnyTourTrackId];
  }

  if (trackId in TOUR_TRACK_CATEGORY_LABELS) {
    return TOUR_TRACK_CATEGORY_LABELS[trackId as AnyTourTrackId];
  }

  // Fallback seguro baseado em prefixo
  if (typeof trackId === "string") {
    if (trackId.startsWith("investments")) {
      return "Investimentos";
    }
    if (trackId.startsWith("settings")) {
      return "Configurações";
    }
    if (trackId.startsWith("app_native") || trackId.startsWith("native")) {
      return "App Nativo";
    }
    if (
      trackId.startsWith("shared") ||
      trackId === "finances_split" ||
      trackId === "finances_family" ||
      trackId === "finances_goals"
    ) {
      return "Compartilhadas";
    }
  }

  return "Finanças Diárias";
}

/**
 * Retorna o rótulo contextual detalhado da trilha ativa (ex.: "Finanças · Cartões", "Compartilhadas · Racha com Pix").
 */
export function getTourTrackContextualLabel(
  trackId: AnyTourTrackId | string | null | undefined,
): string {
  return getTourTrackCategoryLabel(trackId, { contextual: true });
}

/**
 * Retorna a descrição amigável da macro-categoria informada.
 */
export function getTourCategoryDescription(
  category: TourTrackCategory | string | null | undefined,
): string {
  if (!category || !(category in TOUR_CATEGORY_DESCRIPTIONS)) {
    return TOUR_CATEGORY_DESCRIPTIONS.finances;
  }
  return TOUR_CATEGORY_DESCRIPTIONS[category as TourTrackCategory];
}

/**
 * Retorna a descrição amigável em pt-BR de uma trilha ou micro-tour.
 */
export function getTourTrackDescription(
  trackId: AnyTourTrackId | string | null | undefined,
): string {
  if (!trackId || !(trackId in TOUR_TRACK_DESCRIPTIONS)) {
    return TOUR_TRACK_DESCRIPTIONS.finances;
  }
  return TOUR_TRACK_DESCRIPTIONS[trackId as AnyTourTrackId];
}

/**
 * Retorna o título formatado em pt-BR de uma trilha ou micro-tour.
 */
export function getTourTrackTitle(
  trackId: AnyTourTrackId | string | null | undefined,
): string {
  if (!trackId || !(trackId in TOUR_TRACK_TITLES)) {
    return TOUR_TRACK_TITLES.finances;
  }
  return TOUR_TRACK_TITLES[trackId as AnyTourTrackId];
}

/**
 * Retorna o título curto em pt-BR de uma trilha ou micro-tour.
 */
export function getTourTrackShortTitle(
  trackId: AnyTourTrackId | string | null | undefined,
): string {
  if (!trackId || !(trackId in TOUR_TRACK_SHORT_TITLES)) {
    return TOUR_TRACK_SHORT_TITLES.finances;
  }
  return TOUR_TRACK_SHORT_TITLES[trackId as AnyTourTrackId];
}
