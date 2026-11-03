import type { TourTrackCategory, TourTrackId } from "./types";

/**
 * Opções de formatação para rótulos de trilhas de demonstração.
 */
export interface TourTrackLabelOptions {
  /**
   * Se verdadeiro, retorna subtítulo contextual específico (ex.: "Finanças · Cartões")
   * em vez do nome da macro-categoria ("Finanças Diárias").
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
} as const;

/**
 * Mapeamento estrito e canônico de cada TourTrackId para seu rótulo semântico de macro-categoria.
 * Garante que micro-tours de finanças (cartões, orçamentos, wizard, overview, insights)
 * sempre exibam "Finanças Diárias", nunca "Investimentos".
 */
export const TOUR_TRACK_CATEGORY_LABELS: Record<TourTrackId, string> = {
  // Finanças Diárias e Pessoais
  finances: "Finanças Diárias",
  finances_overview: "Finanças Diárias",
  finances_wizard: "Finanças Diárias",
  finances_cards: "Finanças Diárias",
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
} as const;

/**
 * Subtítulos contextuais detalhados para cada trilha de demonstração.
 */
export const TOUR_TRACK_CONTEXTUAL_LABELS: Record<TourTrackId, string> = {
  // Finanças Diárias e Pessoais
  finances: "Finanças Diárias",
  finances_overview: "Finanças · Visão Geral",
  finances_wizard: "Finanças · Lançamentos",
  finances_cards: "Finanças · Cartões",
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
} as const;

/**
 * Retorna a macro-categoria semântica de uma trilha ativa.
 */
export function getTourTrackCategory(
  trackId: TourTrackId | string | null | undefined,
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
  }

  return "finances";
}

/**
 * Retorna o rótulo semântico canônico da categoria da trilha ativa para exibição em badges e cabeçalhos.
 *
 * @param trackId - Identificador único da trilha ou micro-tour ativo.
 * @param options - Configurações opcionais de formatação (ex: contextual para subtítulo).
 * @returns Rótulo formatado em pt-BR (ex: "Finanças Diárias", "Investimentos", "Configurações", "App Nativo").
 */
export function getTourTrackCategoryLabel(
  trackId: TourTrackId | string | null | undefined,
  options?: TourTrackLabelOptions,
): string {
  if (!trackId) {
    return "Finanças Diárias";
  }

  if (options?.contextual && trackId in TOUR_TRACK_CONTEXTUAL_LABELS) {
    return TOUR_TRACK_CONTEXTUAL_LABELS[trackId as TourTrackId];
  }

  if (trackId in TOUR_TRACK_CATEGORY_LABELS) {
    return TOUR_TRACK_CATEGORY_LABELS[trackId as TourTrackId];
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
  }

  return "Finanças Diárias";
}

/**
 * Retorna o rótulo contextual detalhado da trilha ativa (ex.: "Finanças · Cartões").
 */
export function getTourTrackContextualLabel(
  trackId: TourTrackId | string | null | undefined,
): string {
  return getTourTrackCategoryLabel(trackId, { contextual: true });
}
