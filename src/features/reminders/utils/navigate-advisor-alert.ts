import type { NavigateFunction } from "react-router";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";

interface AdvisorIncomePayload {
  name?: string;
  categoryId?: string;
  date?: string;
  valueCents?: number;
}

interface AdvisorExpensePayload {
  name?: string;
  valueCents?: number;
  categoryId?: string;
  date?: string;
  forma?: string;
  cardId?: string;
}

export function navigateAdvisorAlert(
  item: SmartAdvisorInsight,
  navigate: NavigateFunction,
  currentSearch?: string,
): void {
  const payload = item.primaryAction?.payload as Record<string, unknown> | undefined;

  if (item.primaryAction?.kind === "navigate_aporte" || item.themeKey.startsWith("aporte:")) {
    const valor = typeof payload?.valorCents === "number" ? payload.valorCents : undefined;
    navigate(valor && valor > 0 ? `/investments?tab=aporte&valor=${valor}` : "/investments?tab=aporte");
    return;
  }

  if (
    item.primaryAction?.kind === "set_category_budget" ||
    Boolean(payload?.isHabit) ||
    item.themeKey.startsWith("habit:")
  ) {
    const catId =
      typeof payload?.categoryId === "string" ? payload.categoryId : item.metadata?.categoryId;
    navigate(
      catId
        ? `/orcamentos?tab=limits&categoria=${encodeURIComponent(catId)}&definirLimite=1`
        : "/orcamentos?tab=limits",
    );
    return;
  }

  if (
    item.primaryAction?.kind === "cut_subscription" ||
    item.id.startsWith("dup:") ||
    item.id.startsWith("price_adj:") ||
    item.id.startsWith("savings:")
  ) {
    const rawKey = typeof payload?.key === "string" ? payload.key : undefined;
    const itemKey = rawKey ?? item.themeKey.replace(/^(dup:|savings:|price_adj:)/, "");
    navigate(`/insights?aba=recurrences&item=${encodeURIComponent(itemKey)}`);
    return;
  }

  const baseSearch =
    currentSearch ?? (typeof window !== "undefined" ? window.location.search : "");
  const params = new URLSearchParams(baseSearch);

  if (
    item.category === "income" ||
    item.primaryAction?.kind === "open_income" ||
    item.primaryAction?.kind === "confirm_income"
  ) {
    const p = item.primaryAction?.payload as AdvisorIncomePayload | undefined;
    params.set("novo", "receita");
    params.set("modo", "rapido");
    if (p?.name) params.set("descricao", p.name);
    if (p?.categoryId) params.set("categoria", p.categoryId);
    if (p?.date) params.set("data", p.date);
    if (p?.valueCents) params.set("valor", String(p.valueCents));
    else if (item.metadata?.valueCents) params.set("valor", String(item.metadata.valueCents));

    navigate(`?${params.toString()}`);
    return;
  }

  const p = item.primaryAction?.payload as AdvisorExpensePayload | undefined;
  params.set("novo", "despesa");
  params.set("modo", "rapido");

  const name = p?.name ?? item.title;
  const valueCents = p?.valueCents ?? item.metadata?.valueCents;
  const categoryId = p?.categoryId ?? item.metadata?.categoryId;
  const date = p?.date ?? item.metadata?.expectedDate;
  const forma = p?.forma;
  const cardId = p?.cardId ?? item.metadata?.cardId ?? item.cardContext?.cardId;

  if (name) params.set("descricao", name);
  if (valueCents) params.set("valor", String(valueCents));
  if (categoryId) params.set("categoria", categoryId);
  if (date) params.set("data", date);
  if (forma) params.set("forma", forma);
  if (cardId) params.set("cartao", cardId);

  navigate(`?${params.toString()}`);
}
