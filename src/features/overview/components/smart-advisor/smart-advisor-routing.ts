import type { SmartAdvisorInsight } from "@/domain/insights/advisor";

export type AdvisorIconKind =
  | "household"
  | "aporte"
  | "critical"
  | "income"
  | "savings"
  | "calibration"
  | "celebration";

export interface SmartAdvisorPresentation {
  iconKind: AdvisorIconKind;
  badgeVariant: "critical" | "muted" | "portfolio" | "positive" | "warning";
  badgeLabel: string;
}

/**
 * Resolve metadados visuais (categoria, selo e ícone) para o insight ativo.
 */
export function resolveSmartAdvisorPresentation(
  insight: SmartAdvisorInsight,
): SmartAdvisorPresentation {
  if (insight.themeKey === "household:ceiling_exceeded") {
    return {
      iconKind: "household",
      badgeVariant: "critical",
      badgeLabel: "Teto Familiar",
    };
  }

  if (insight.themeKey === "household:settlement_pending") {
    const isReceiver = insight.category === "income";
    return {
      iconKind: "household",
      badgeVariant: isReceiver ? "positive" : "warning",
      badgeLabel: isReceiver ? "A Receber · Família" : "Acerto Familiar",
    };
  }

  if (insight.themeKey.startsWith("household:")) {
    return {
      iconKind: "household",
      badgeVariant: "muted",
      badgeLabel: "Família",
    };
  }

  if (insight.primaryAction?.kind === "navigate_aporte" || insight.themeKey.startsWith("aporte:")) {
    return {
      iconKind: "aporte",
      badgeVariant: "portfolio",
      badgeLabel: "Aporte",
    };
  }

  if (insight.primaryAction?.kind === "navigate_cards" || insight.themeKey.startsWith("charges:")) {
    return {
      iconKind: "critical",
      badgeVariant: "critical",
      badgeLabel: "Juros & Multas",
    };
  }

  if (insight.themeKey.startsWith("income_goal:")) {
    return {
      iconKind: "income",
      badgeVariant: "warning",
      badgeLabel: "Meta de Receita",
    };
  }

  if (insight.themeKey.startsWith("annual:")) {
    return {
      iconKind: "critical",
      badgeVariant: "warning",
      badgeLabel: "Compromisso Anual",
    };
  }

  if (insight.themeKey.startsWith("missing_expense:")) {
    return {
      iconKind: "critical",
      badgeVariant: "warning",
      badgeLabel: "Conta Pendente",
    };
  }

  if (insight.themeKey.startsWith("due_today:")) {
    return {
      iconKind: "critical",
      badgeVariant: "warning",
      badgeLabel: "Vence hoje",
    };
  }

  if (insight.themeKey.startsWith("dup:")) {
    return {
      iconKind: "critical",
      badgeVariant: "critical",
      badgeLabel: "Crítico",
    };
  }

  if (insight.themeKey.startsWith("calib_tx:")) {
    return {
      iconKind: "calibration",
      badgeVariant: "muted",
      badgeLabel: "Calibração Rápida",
    };
  }

  switch (insight.category) {
    case "celebration":
      return { iconKind: "celebration", badgeVariant: "positive", badgeLabel: "Conquista" };
    case "critical":
      return {
        iconKind: "critical",
        badgeVariant: insight.priority === 1 ? "critical" : "warning",
        badgeLabel: insight.priority === 1 ? "Crítico" : "Atenção",
      };
    case "income":
      return { iconKind: "income", badgeVariant: "positive", badgeLabel: "Entrada Prevista" };
    case "savings":
      return { iconKind: "savings", badgeVariant: "warning", badgeLabel: "Economia" };
    case "calibration":
    default:
      return { iconKind: "calibration", badgeVariant: "muted", badgeLabel: "Calibração" };
  }
}

/**
 * Resolve a rota de navegação contextual da ação primária do SmartAdvisor.
 */
export function resolveSmartAdvisorActionRoute(
  insight: SmartAdvisorInsight,
  currentSearch: string,
): string | null {
  if (
    insight.primaryAction?.kind === "navigate_family" ||
    insight.primaryAction?.kind === "open_family_settlement" ||
    insight.themeKey.startsWith("household:")
  ) {
    return "/familia";
  }

  if (
    insight.primaryAction?.kind === "open_income_goals" ||
    insight.themeKey.startsWith("income_goal:")
  ) {
    const payload = insight.primaryAction?.payload as { categoryId?: string } | undefined;
    return payload?.categoryId
      ? `/orcamentos?tab=goals&categoria=${encodeURIComponent(payload.categoryId)}`
      : "/orcamentos?tab=goals";
  }

  if (insight.primaryAction?.kind === "navigate_aporte" || insight.themeKey.startsWith("aporte:")) {
    const p = insight.primaryAction?.payload as { valorCents?: number } | undefined;
    return p?.valorCents && p.valorCents > 0
      ? `/investments?tab=aporte&valor=${p.valorCents}`
      : "/investments?tab=aporte";
  }

  if (insight.primaryAction?.kind === "navigate_cards" || insight.themeKey.startsWith("charges:")) {
    return "/cartoes";
  }

  if (
    insight.primaryAction?.kind === "set_category_budget" ||
    (insight.primaryAction?.payload as { isHabit?: boolean } | undefined)?.isHabit ||
    insight.themeKey.startsWith("habit:")
  ) {
    const p = insight.primaryAction?.payload as { categoryId?: string } | undefined;
    const catId = p?.categoryId ?? insight.metadata?.categoryId;
    return catId
      ? `/orcamentos?tab=limits&categoria=${encodeURIComponent(catId)}&definirLimite=1`
      : "/orcamentos?tab=limits";
  }

  if (
    insight.primaryAction?.kind === "cut_subscription" ||
    insight.id.startsWith("dup:") ||
    insight.id.startsWith("price_adj:") ||
    insight.id.startsWith("savings:")
  ) {
    const p = insight.primaryAction?.payload as { key?: string } | undefined;
    const itemKey = p?.key ?? insight.themeKey.replace(/^(dup:|savings:|price_adj:)/, "");
    return `/insights?aba=recurrences&item=${encodeURIComponent(itemKey)}`;
  }

  if (
    insight.category === "income" ||
    insight.primaryAction?.kind === "open_income" ||
    insight.primaryAction?.kind === "confirm_income"
  ) {
    const p = insight.primaryAction?.payload as
      | { name?: string; categoryId?: string; date?: string; valueCents?: number }
      | undefined;
    const params = new URLSearchParams(currentSearch);
    params.set("novo", "receita");
    params.set("modo", "rapido");
    if (p?.name) params.set("descricao", p.name);
    if (p?.categoryId) params.set("categoria", p.categoryId);
    if (p?.date) params.set("data", p.date);
    const valueCents = p?.valueCents ?? insight.metadata?.valueCents;
    if (valueCents) params.set("valor", String(valueCents));
    return `?${params.toString()}`;
  }

  if (
    insight.primaryAction?.kind === "register_expense" ||
    insight.primaryAction?.kind === "confirm_expense" ||
    insight.category === "critical"
  ) {
    const p = insight.primaryAction?.payload as
      | {
          name?: string;
          valueCents?: number;
          categoryId?: string;
          date?: string;
          forma?: string;
          cardId?: string;
        }
      | undefined;

    const params = new URLSearchParams(currentSearch);
    params.set("novo", "despesa");
    params.set("modo", "rapido");
    const name = p?.name ?? insight.title;
    const valueCents = p?.valueCents ?? insight.metadata?.valueCents;
    const categoryId = p?.categoryId ?? insight.metadata?.categoryId;
    const date = p?.date ?? insight.metadata?.expectedDate;
    const cardId = p?.cardId ?? insight.metadata?.cardId ?? insight.cardContext?.cardId;
    if (valueCents) params.set("valor", String(valueCents));
    if (name) params.set("descricao", name);
    if (categoryId) params.set("categoria", categoryId);
    if (date) params.set("data", date);
    if (p?.forma) params.set("forma", p.forma);
    if (cardId) params.set("cartao", cardId);
    return `?${params.toString()}`;
  }

  if (insight.themeKey === "celebration:dividends_cover_fixed") {
    return "/investments?tab=dividends";
  }

  if (insight.category === "celebration") {
    return "/transacoes";
  }

  return null;
}
