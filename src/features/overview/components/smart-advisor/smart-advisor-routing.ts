import type { SmartAdvisorInsight } from "@/domain/insights/advisor";

export type AdvisorIconKind =
  | "household"
  | "aporte"
  | "critical"
  | "income"
  | "savings"
  | "calibration";

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
  if (insight.themeKey.startsWith("household:")) {
    return {
      iconKind: "household",
      badgeVariant: insight.category === "critical" ? "critical" : "muted",
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

  switch (insight.category) {
    case "critical":
      return { iconKind: "critical", badgeVariant: "critical", badgeLabel: "Atenção" };
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
    insight.primaryAction?.kind === "register_expense" ||
    (insight.category === "critical" && !insight.id.startsWith("dup:"))
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
    if (p?.valueCents) params.set("valor", String(p.valueCents));
    if (p?.name) params.set("descricao", p.name);
    if (p?.categoryId) params.set("categoria", p.categoryId);
    if (p?.date) params.set("data", p.date);
    if (p?.forma) params.set("forma", p.forma);
    if (p?.cardId) params.set("cartao", p.cardId);
    return `?${params.toString()}`;
  }

  if (insight.category === "income" && insight.primaryAction?.kind === "open_income") {
    const p = insight.primaryAction?.payload as
      | { name?: string; categoryId?: string; date?: string; valueCents?: number }
      | undefined;
    const params = new URLSearchParams(currentSearch);
    params.set("novo", "receita");
    params.set("modo", "rapido");
    if (p?.name) params.set("descricao", p.name);
    if (p?.categoryId) params.set("categoria", p.categoryId);
    if (p?.date) params.set("data", p.date);
    if (p?.valueCents) params.set("valor", String(p.valueCents));
    return `?${params.toString()}`;
  }

  if (insight.primaryAction?.kind === "navigate_aporte" || insight.themeKey.startsWith("aporte:")) {
    const p = insight.primaryAction?.payload as { valorCents?: number } | undefined;
    return p?.valorCents && p.valorCents > 0
      ? `/investments?tab=aporte&valor=${p.valorCents}`
      : "/investments?tab=aporte";
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
    insight.primaryAction?.kind === "navigate_family" ||
    insight.primaryAction?.kind === "open_family_settlement"
  ) {
    return "/familia";
  }

  if (insight.primaryAction?.kind === "open_income_goals") {
    const payload = insight.primaryAction?.payload as { categoryId?: string } | undefined;
    return payload?.categoryId
      ? `/orcamentos?tab=goals&categoria=${encodeURIComponent(payload.categoryId)}`
      : "/orcamentos?tab=goals";
  }

  return null;
}
