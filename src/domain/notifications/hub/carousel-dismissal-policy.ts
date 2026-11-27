/**
 * Catálogo canônico de identidades, políticas de dispensa e aliases legados
 * dos carrosséis da Home e de Investimentos (Onda 1 · Fase 1).
 *
 * 100% puro — zero dependências de UI, DOM ou Supabase.
 */

export type CarouselDismissPreset = "7d" | "1m" | "6m";

export type CarouselDismissalStage = "completed" | "open";

export interface CarouselDismissalRecord {
  preset: CarouselDismissPreset;
  dismissedAt: number;
  dismissedUntil: number;
  revokedAt?: number;
  stage?: CarouselDismissalStage;
}

export type CarouselDismissalsMap = Record<string, CarouselDismissalRecord>;

export type CarouselCardCategory =
  | "p0_mandatory"
  | "tactical"
  | "structural_long"
  | "advisor";

export interface CarouselCardPolicy {
  canonicalId: string;
  category: CarouselCardCategory;
  allowedPresets: readonly CarouselDismissPreset[];
  displayName: string;
  module: string;
}

export interface CarouselPolicyContext {
  trialDaysRemaining?: number;
  goalStage?: "completed" | "final_stretch" | "has_surplus" | "regular";
}

const TACTICAL_PRESETS: readonly CarouselDismissPreset[] = ["7d", "1m"];
const LONG_PRESETS: readonly CarouselDismissPreset[] = ["7d", "1m", "6m"];
const NO_PRESETS: readonly CarouselDismissPreset[] = [];

/**
 * Resolve a política de dispensa para qualquer ID canônico de card.
 * Garante presets determinísticos por família e regras P0 explícitas.
 */
export function resolveCarouselCardPolicy(
  canonicalId: string,
  context?: CarouselPolicyContext,
): CarouselCardPolicy {
  if (canonicalId === "billing.past_due") {
    return {
      canonicalId,
      category: "p0_mandatory",
      allowedPresets: NO_PRESETS,
      displayName: "Assinatura em atraso",
      module: "Assinatura",
    };
  }

  if (canonicalId === "billing.trial_ending") {
    const isFinalWindow =
      typeof context?.trialDaysRemaining === "number" &&
      Number.isFinite(context.trialDaysRemaining) &&
      context.trialDaysRemaining <= 3;
    return {
      canonicalId,
      category: isFinalWindow ? "p0_mandatory" : "tactical",
      allowedPresets: isFinalWindow ? NO_PRESETS : TACTICAL_PRESETS,
      displayName: "Fim do período de teste",
      module: "Assinatura",
    };
  }

  if (
    canonicalId.startsWith("goals.progress.") ||
    canonicalId.startsWith("goal.progress.")
  ) {
    const isUrgentGoal =
      context?.goalStage === "completed" || context?.goalStage === "final_stretch";
    return {
      canonicalId,
      category: isUrgentGoal ? "tactical" : "structural_long",
      allowedPresets: isUrgentGoal ? TACTICAL_PRESETS : LONG_PRESETS,
      displayName: "Progresso de meta",
      module: "Orçamentos e Metas",
    };
  }

  if (canonicalId.startsWith("advisor.")) {
    return {
      canonicalId,
      category: "advisor",
      allowedPresets: LONG_PRESETS,
      displayName: "Insight do Assistente",
      module: "Assistente",
    };
  }

  if (
    canonicalId === "portfolio.reviews_overdue" ||
    canonicalId === "portfolio.governance_review" ||
    canonicalId === "portfolio.reviews_upcoming" ||
    canonicalId === "portfolio.unscored" ||
    canonicalId === "portfolio.low_conviction" ||
    canonicalId === "portfolio.quarantine" ||
    canonicalId === "portfolio.drift" ||
    canonicalId === "portfolio.allocation_drift" ||
    canonicalId === "portfolio.idle_cash" ||
    canonicalId.startsWith("portfolio.risk.")
  ) {
    return {
      canonicalId,
      category: "structural_long",
      allowedPresets: LONG_PRESETS,
      displayName: resolvePortfolioDisplayName(canonicalId),
      module: "Investimentos",
    };
  }

  if (
    canonicalId === "bridge.debt_vs_invest" ||
    canonicalId.startsWith("bridge.debt_vs_invest.")
  ) {
    return {
      canonicalId,
      category: "structural_long",
      allowedPresets: LONG_PRESETS,
      displayName: "Dívida cara vs. aporte",
      module: "Dívidas & Investimentos",
    };
  }

  if (canonicalId === "data.hygiene_review") {
    return {
      canonicalId,
      category: "structural_long",
      allowedPresets: LONG_PRESETS,
      displayName: "Revisão de classificação",
      module: "Transações",
    };
  }

  if (
    canonicalId === "bridge.combined_contribution" ||
    canonicalId === "bridge.monthly_contribution_consistency"
  ) {
    return {
      canonicalId,
      category: "tactical",
      allowedPresets: TACTICAL_PRESETS,
      displayName:
        canonicalId === "bridge.combined_contribution"
          ? "Aporte combinado"
          : "Consistência de aporte mensal",
      module:
        canonicalId === "bridge.combined_contribution"
          ? "Visão Geral & Investimentos"
          : "Investimentos",
    };
  }

  if (
    canonicalId === "cashflow.bill_impact" ||
    canonicalId.startsWith("cashflow.bill_impact.")
  ) {
    return {
      canonicalId,
      category: "tactical",
      allowedPresets: TACTICAL_PRESETS,
      displayName: "Impacto de fatura no caixa",
      module: "Cartões",
    };
  }

  if (
    canonicalId === "budget.category_pace" ||
    canonicalId.startsWith("budget.category_pace.")
  ) {
    return {
      canonicalId,
      category: "tactical",
      allowedPresets: TACTICAL_PRESETS,
      displayName: "Ritmo de orçamento por categoria",
      module: "Orçamentos",
    };
  }

  if (
    canonicalId === "trip.settlement_pending" ||
    canonicalId.startsWith("trip.settlement_pending.")
  ) {
    return {
      canonicalId,
      category: "tactical",
      allowedPresets: TACTICAL_PRESETS,
      displayName: "Acerto pendente de viagem",
      module: "Viagens",
    };
  }

  if (
    canonicalId === "onboarding.progress" ||
    canonicalId === "device.alerts_invite" ||
    canonicalId.startsWith("device.permissions.")
  ) {
    return {
      canonicalId,
      category: "structural_long",
      allowedPresets: LONG_PRESETS,
      displayName: canonicalId === "onboarding.progress"
        ? "Configuração inicial"
        : canonicalId === "device.alerts_invite"
          ? "Lembretes no dispositivo"
          : "Permissões do dispositivo",
      module: "Dispositivo e Conta",
    };
  }

  if (
    canonicalId === "portfolio.dividends_available" ||
    canonicalId === "portfolio.dividends_projected" ||
    canonicalId === "portfolio.discount"
  ) {
    return {
      canonicalId,
      category: "tactical",
      allowedPresets: TACTICAL_PRESETS,
      displayName:
        canonicalId === "portfolio.dividends_available"
          ? "Proventos a conferir"
          : canonicalId === "portfolio.dividends_projected"
            ? "Proventos previstos no mês"
            : "Oportunidade com desconto",
      module: "Investimentos",
    };
  }

  if (canonicalId.startsWith("household.")) {
    return {
      canonicalId,
      category: "tactical",
      allowedPresets: TACTICAL_PRESETS,
      displayName: canonicalId.includes("ceiling")
        ? "Teto familiar"
        : "Acerto familiar",
      module: "Família",
    };
  }

  if (canonicalId.startsWith("trip.active.")) {
    return {
      canonicalId,
      category: "tactical",
      allowedPresets: TACTICAL_PRESETS,
      displayName: "Viagem ativa",
      module: "Viagens",
    };
  }

  if (canonicalId === "split.pending") {
    return {
      canonicalId,
      category: "tactical",
      allowedPresets: TACTICAL_PRESETS,
      displayName: "Rachas pendentes",
      module: "Rachas",
    };
  }

  if (
    canonicalId === "cashflow.pace" ||
    canonicalId === "cashflow.surplus_aporte" ||
    canonicalId === "cashflow.surplus" ||
    canonicalId === "cashflow.cash_gap"
  ) {
    return {
      canonicalId,
      category: "tactical",
      allowedPresets: TACTICAL_PRESETS,
      displayName:
        canonicalId === "cashflow.pace"
          ? "Ritmo de gastos"
          : canonicalId === "cashflow.surplus_aporte" || canonicalId === "cashflow.surplus"
            ? "Capacidade de aporte"
            : "Furo de caixa previsto",
      module: "Visão Geral",
    };
  }

  // Fallback seguro para futuras chaves táticas
  return {
    canonicalId,
    category: "tactical",
    allowedPresets: TACTICAL_PRESETS,
    displayName: "Alerta",
    module: "Sistema",
  };
}

function resolvePortfolioDisplayName(canonicalId: string): string {
  if (
    canonicalId === "portfolio.reviews_overdue" ||
    canonicalId === "portfolio.governance_review"
  ) {
    return "Revisão de teses vencida";
  }
  if (canonicalId === "portfolio.reviews_upcoming") return "Revisão de teses próxima";
  if (canonicalId === "portfolio.unscored") return "Ativos sem nota";
  if (canonicalId === "portfolio.low_conviction") return "Nota baixa com sobrepeso";
  if (canonicalId === "portfolio.quarantine") return "Ativos em quarentena";
  if (canonicalId === "portfolio.drift" || canonicalId === "portfolio.allocation_drift") {
    return "Desvio de alocação";
  }
  if (canonicalId === "portfolio.idle_cash") return "Caixa disponível na corretora";
  if (canonicalId.startsWith("portfolio.risk.single_asset.")) return "Concentração em ativo único";
  if (canonicalId.startsWith("portfolio.risk.private_issuer.")) return "Exposição a emissor privado";
  if (canonicalId.startsWith("portfolio.risk.macro_sector.")) return "Concentração em macrosetor";
  if (canonicalId.startsWith("portfolio.risk.low_diversification")) return "Baixa diversificação efetiva";
  if (canonicalId.startsWith("portfolio.risk.benchmark_overlap.")) return "ETFs sobrepostos";
  return "Risco estrutural da carteira";
}

export interface LegacyAliasResolution {
  dashboardCardKeys: readonly string[];
  portfolioKeys: readonly string[];
  advisorThemeKeys: readonly string[];
  dashboardPace?: boolean;
  dashboardSurplus?: boolean;
  dashboardGovernance?: boolean;
  goalShareId?: string;
  permissionCapability?: "pushDue" | "passiveBankListener";
}

/**
 * Mapeia um ID canônico para todos os aliases legados equivalentes da §3 do Plano Mestre.
 */
export function resolveLegacyAliasesForCanonicalId(
  canonicalId: string,
): LegacyAliasResolution {
  if (canonicalId === "billing.trial_ending") {
    return { dashboardCardKeys: ["trial-ending"], portfolioKeys: [], advisorThemeKeys: [] };
  }
  if (canonicalId === "cashflow.pace") {
    return { dashboardCardKeys: [], portfolioKeys: [], advisorThemeKeys: [], dashboardPace: true };
  }
  if (
    canonicalId === "cashflow.surplus_aporte" ||
    canonicalId === "cashflow.surplus"
  ) {
    return { dashboardCardKeys: [], portfolioKeys: [], advisorThemeKeys: [], dashboardSurplus: true };
  }
  if (canonicalId === "cashflow.cash_gap") {
    return { dashboardCardKeys: ["cash-gap-alert"], portfolioKeys: [], advisorThemeKeys: [] };
  }
  if (
    canonicalId.startsWith("household.ceiling.") ||
    canonicalId === "household.ceiling_exceeded"
  ) {
    return {
      dashboardCardKeys: ["household-ceiling-exceeded"],
      portfolioKeys: [],
      advisorThemeKeys: ["household:ceiling_exceeded", "household:ceiling_warning"],
    };
  }
  if (
    canonicalId.startsWith("household.settlement.") ||
    canonicalId === "household.settlement_pending"
  ) {
    return {
      dashboardCardKeys: ["household-settlement-pending"],
      portfolioKeys: [],
      advisorThemeKeys: ["household:settlement_pending"],
    };
  }
  if (canonicalId.startsWith("goals.progress.")) {
    return {
      dashboardCardKeys: [],
      portfolioKeys: [],
      advisorThemeKeys: [],
      goalShareId: canonicalId.slice("goals.progress.".length),
    };
  }
  if (canonicalId.startsWith("goal.progress.")) {
    return {
      dashboardCardKeys: [],
      portfolioKeys: [],
      advisorThemeKeys: [],
      goalShareId: canonicalId.slice("goal.progress.".length),
    };
  }
  if (canonicalId.startsWith("trip.active.")) {
    const tripId = canonicalId.slice("trip.active.".length);
    return {
      dashboardCardKeys: [`active-trip-${tripId}`],
      portfolioKeys: [],
      advisorThemeKeys: [],
    };
  }
  if (canonicalId === "split.pending") {
    return { dashboardCardKeys: ["split-pending-banner"], portfolioKeys: [], advisorThemeKeys: [] };
  }
  if (
    canonicalId === "portfolio.reviews_overdue" ||
    canonicalId === "portfolio.governance_review"
  ) {
    return {
      dashboardCardKeys: [],
      portfolioKeys: ["overdue-reviews-alert"],
      advisorThemeKeys: [],
      dashboardGovernance: true,
    };
  }
  if (canonicalId === "portfolio.reviews_upcoming") {
    return { dashboardCardKeys: [], portfolioKeys: ["upcoming-reviews-alert"], advisorThemeKeys: [] };
  }
  if (canonicalId === "portfolio.unscored") {
    return { dashboardCardKeys: [], portfolioKeys: ["unscored-assets-alert"], advisorThemeKeys: [] };
  }
  if (canonicalId === "portfolio.low_conviction") {
    return { dashboardCardKeys: [], portfolioKeys: ["low-score-risk-alert"], advisorThemeKeys: [] };
  }
  if (canonicalId === "portfolio.quarantine") {
    return { dashboardCardKeys: [], portfolioKeys: ["quarantine-governance-alert"], advisorThemeKeys: [] };
  }
  if (canonicalId === "portfolio.discount") {
    return { dashboardCardKeys: [], portfolioKeys: ["discount-opportunity-alert"], advisorThemeKeys: [] };
  }
  if (canonicalId === "portfolio.drift" || canonicalId === "portfolio.allocation_drift") {
    return { dashboardCardKeys: [], portfolioKeys: ["allocation-drift-alert"], advisorThemeKeys: [] };
  }
  if (canonicalId === "portfolio.idle_cash") {
    return { dashboardCardKeys: [], portfolioKeys: ["idle-cash-alert"], advisorThemeKeys: [] };
  }
  if (canonicalId === "portfolio.dividends_available") {
    return {
      dashboardCardKeys: ["corporate-dividends-alert"],
      portfolioKeys: ["available-dividends-alert"],
      advisorThemeKeys: [],
    };
  }
  if (canonicalId === "portfolio.dividends_projected") {
    return {
      dashboardCardKeys: ["corporate-dividends-alert"],
      portfolioKeys: ["projected-dividends-alert"],
      advisorThemeKeys: [],
    };
  }
  if (canonicalId.startsWith("portfolio.risk.single_asset.")) {
    const entity = canonicalId.slice("portfolio.risk.single_asset.".length);
    return { dashboardCardKeys: [], portfolioKeys: [`single-asset-${entity}`], advisorThemeKeys: [] };
  }
  if (canonicalId.startsWith("portfolio.risk.private_issuer.")) {
    const entity = canonicalId.slice("portfolio.risk.private_issuer.".length);
    return { dashboardCardKeys: [], portfolioKeys: [`private-issuer-${entity}`], advisorThemeKeys: [] };
  }
  if (canonicalId.startsWith("portfolio.risk.macro_sector.")) {
    const entity = canonicalId.slice("portfolio.risk.macro_sector.".length);
    return { dashboardCardKeys: [], portfolioKeys: [`macro-sector-${entity}`], advisorThemeKeys: [] };
  }
  if (canonicalId.startsWith("portfolio.risk.low_diversification")) {
    return { dashboardCardKeys: [], portfolioKeys: ["low-diversification-nef-stocks"], advisorThemeKeys: [] };
  }
  if (canonicalId.startsWith("portfolio.risk.benchmark_overlap.")) {
    const entity = canonicalId.slice("portfolio.risk.benchmark_overlap.".length);
    return { dashboardCardKeys: [], portfolioKeys: [`benchmark-overlap-${entity}`], advisorThemeKeys: [] };
  }
  if (canonicalId.startsWith("advisor.")) {
    return {
      dashboardCardKeys: [],
      portfolioKeys: [],
      advisorThemeKeys: [canonicalId.slice("advisor.".length)],
    };
  }
  if (canonicalId === "onboarding.progress") {
    return { dashboardCardKeys: ["onboarding-progress-banner"], portfolioKeys: [], advisorThemeKeys: [] };
  }
  if (canonicalId === "device.alerts_invite") {
    return { dashboardCardKeys: ["jit-device-alerts-invite"], portfolioKeys: [], advisorThemeKeys: [] };
  }
  if (
    canonicalId === "device.permissions.push_due" ||
    canonicalId === "device.permissions.pushDue"
  ) {
    return {
      dashboardCardKeys: [],
      portfolioKeys: [],
      advisorThemeKeys: [],
      permissionCapability: "pushDue",
    };
  }
  if (
    canonicalId === "device.permissions.bank_listener" ||
    canonicalId === "device.permissions.passiveBankListener"
  ) {
    return {
      dashboardCardKeys: [],
      portfolioKeys: [],
      advisorThemeKeys: [],
      permissionCapability: "passiveBankListener",
    };
  }

  return { dashboardCardKeys: [], portfolioKeys: [], advisorThemeKeys: [] };
}

/**
 * Resolve IDs canônicos irmãos emitidos na Onda 1 para garantir paridade estrita
 * quando uma superfície grava a forma curta/singular e outra consulta a longa.
 */
export function resolveCanonicalDismissalAliases(canonicalId: string): readonly string[] {
  if (canonicalId === "portfolio.reviews_overdue") {
    return ["portfolio.governance_review"];
  }
  if (canonicalId === "portfolio.governance_review") {
    return ["portfolio.reviews_overdue"];
  }
  if (canonicalId === "portfolio.drift") {
    return ["portfolio.allocation_drift"];
  }
  if (canonicalId === "portfolio.allocation_drift") {
    return ["portfolio.drift"];
  }
  if (canonicalId === "cashflow.surplus_aporte") {
    return ["cashflow.surplus"];
  }
  if (canonicalId === "cashflow.surplus") {
    return ["cashflow.surplus_aporte"];
  }
  if (canonicalId.startsWith("goals.progress.")) {
    const shareId = canonicalId.slice("goals.progress.".length);
    return [`goal.progress.${shareId}`];
  }
  if (canonicalId.startsWith("goal.progress.")) {
    const shareId = canonicalId.slice("goal.progress.".length);
    return [`goals.progress.${shareId}`];
  }
  if (canonicalId.startsWith("household.ceiling.")) {
    return ["household.ceiling_exceeded"];
  }
  if (canonicalId.startsWith("household.settlement.")) {
    return ["household.settlement_pending"];
  }
  return [];
}
