import { numberToCents } from "@/domain/money";
import { isCashAssetClass } from "@/domain/portfolio";
import { formatDateBR } from "@/lib/date";
import type { PortfolioAsset } from "@/types";
import { calculateFreedomIndex } from "./freedom-index";
import type { WealthPositionRow } from "./tear-sheet-types";
import type { CategoryTotal, PaymentMethodTotal } from "./index";

export type ReportPeriodMode = "month" | "year" | "custom";

export interface ReportContributionLike {
  date: string;
  amount: number;
}

export interface WealthSourceRowLike {
  assetId?: string;
  ticker: string;
  assetClass: string | null;
  sector?: string | null;
  currency?: string | null;
  quantity: number;
  averageCost: number;
  totalCost?: number | null;
  totalCostBRL?: number | null;
  priceQuote?: number | null;
  priceBRL: number;
  usdRate?: number | null;
  valueBRL: number;
  unrealizedPnl: number;
  unrealizedPct?: number | null;
  totalReturnPnl?: number | null;
  totalReturnPct?: number | null;
  dividends?: number | null;
  dividendsNative?: number | null;
  score?: number | null;
  allocationStatus?: string | null;
  isCash?: boolean;
  pricingMode?: string | null;
  notes?: string | null;
  fixedIncomeMetadata?: unknown;
  canonicalSource?: string | null;
  avgPriceUSD?: number | null;
  totalCostUSD?: number | null;
  impliedHistoricalFxRate?: number | null;
  pricePnlPctUSD?: number | null;
  fxPnlPct?: number | null;
  pricePnlPctBRL?: number | null;
  source?: string | null;
  isEstimate?: boolean;
  marketPriceAt?: string | null;
  fetchedAt?: string | null;
  provider?: string | null;
}

/** Formata o rótulo legível do período selecionado em pt-BR (sem datas ISO cruas). */
export function buildReportPeriodLabel(params: {
  mode: ReportPeriodMode;
  month: string;
  year: number;
  customStart?: string;
  customEnd?: string;
}): string {
  const { mode, month, year, customStart, customEnd } = params;
  if (mode === "month") {
    const [y, m] = month.split("-");
    if (y && m) {
      const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      const monthName = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      return monthName.charAt(0).toUpperCase() + monthName.slice(1);
    }
    return month;
  }
  if (mode === "year") {
    return `Exercício de ${year}`;
  }
  if (customStart && customEnd) {
    return `${formatDateBR(customStart)} a ${formatDateBR(customEnd)}`;
  }
  return "Período Personalizado";
}

/** Soma aportes de carteira filtrados estritamente pela competência/intervalo ativo. */
export function sumContributionsInPeriod(params: {
  contributions: readonly ReportContributionLike[];
  mode: ReportPeriodMode;
  month: string;
  year: number;
  customValid: boolean;
  startDate?: string;
  endDate?: string;
}): number {
  const { contributions, mode, month, year, customValid, startDate, endDate } = params;
  return contributions
    .filter((c) => {
      if (mode === "month") return c.date.startsWith(month);
      if (mode === "year") return c.date.startsWith(String(year));
      if (customValid && startDate && endDate) {
        return c.date >= startDate && c.date <= endDate;
      }
      return c.date.startsWith(month);
    })
    .reduce((acc, c) => acc + c.amount, 0);
}

/** Constrói a DRE Pessoal consolidada do período em centavos. */
export function buildFinancialDRE(params: {
  currentIncomeCents: number;
  currentExpenseCents: number;
  grossIncomeBrutoCents: number;
  totalExpensesBrutoCents: number;
  periodContributionsBRL: number;
}) {
  const {
    currentIncomeCents,
    currentExpenseCents,
    grossIncomeBrutoCents,
    totalExpensesBrutoCents,
    periodContributionsBRL,
  } = params;

  const operationalSavingsCents = currentIncomeCents - currentExpenseCents;
  const savingsRatePct =
    currentIncomeCents > 0 ? (operationalSavingsCents / currentIncomeCents) * 100 : 0;
  const investedAporteCents = numberToCents(periodContributionsBRL);
  const netCashFlowCents = operationalSavingsCents - investedAporteCents;

  return {
    grossIncomeCents: currentIncomeCents,
    totalExpensesCents: currentExpenseCents,
    operationalSavingsCents,
    savingsRatePct,
    investedAporteCents,
    netCashFlowCents,
    grossIncomeBrutoCents,
    totalExpensesBrutoCents,
  };
}

/** Mapeia categorias agregadas + limites de orçamento para o Dossiê de Fechamento. */
export function mapCategoriesForCloseReport(params: {
  byCategory: readonly CategoryTotal[];
  grossExpenseBrutoCents: number;
  targetMonth: string | null;
  resolveCategoryLimit: (categoryId: string, month: string) => number;
}) {
  const { byCategory, grossExpenseBrutoCents, targetMonth, resolveCategoryLimit } = params;
  return byCategory.map((c) => {
    const limitCents = targetMonth ? resolveCategoryLimit(c.categoryId, targetMonth) : 0;
    const variancePct =
      limitCents > 0 ? Math.round(((c.brutoCents - limitCents) / limitCents) * 100) : null;

    return {
      name: c.name,
      brutoCents: c.brutoCents,
      ponderadoCents: c.ponderadoCents,
      totalCents: c.brutoCents,
      pct: grossExpenseBrutoCents > 0 ? (c.brutoCents / grossExpenseBrutoCents) * 100 : 0,
      budgetLimitCents: limitCents > 0 ? limitCents : null,
      variancePct,
    };
  });
}

/** Mapeia formas de pagamento agregadas para o Dossiê de Fechamento. */
export function mapPaymentMethodsForCloseReport(params: {
  byMethod: readonly PaymentMethodTotal[];
  grossExpenseBrutoCents: number;
  resolveMethodLabel: (method: string) => string;
}) {
  const { byMethod, grossExpenseBrutoCents, resolveMethodLabel } = params;
  return byMethod.map((m) => ({
    method: m.method,
    label: resolveMethodLabel(m.method),
    brutoCents: m.brutoCents,
    ponderadoCents: m.ponderadoCents,
    totalCents: m.brutoCents,
    pct: grossExpenseBrutoCents > 0 ? (m.brutoCents / grossExpenseBrutoCents) * 100 : 0,
  }));
}

/** Converte linhas de posição da carteira para o modelo do Tear Sheet patrimonial. */
export function mapPositionRowsToWealthRows(
  positionRows: readonly WealthSourceRowLike[],
): WealthPositionRow[] {
  return positionRows.map((r) => {
    const isUsd = r.currency === "USD";
    const rate = r.usdRate && r.usdRate > 0 ? r.usdRate : 0;
    const divs = r.dividends ?? 0;
    const effectiveDivs = isUsd ? (r.dividendsNative ?? (rate > 0 ? divs / rate : divs)) : divs;
    const effectiveCostNative =
      (isUsd
        ? (r.totalCost ?? (rate > 0 && r.totalCostBRL ? r.totalCostBRL / rate : r.totalCostBRL))
        : r.totalCostBRL) ?? 0;
    const effectiveCostBRL =
      (isUsd
        ? (r.totalCostBRL ?? (rate > 0 && r.totalCost ? r.totalCost * rate : r.totalCost))
        : r.totalCostBRL) ?? r.valueBRL - (r.unrealizedPnl ?? 0);
    const yoc =
      effectiveCostNative > 0 && effectiveDivs > 0 ? (effectiveDivs / effectiveCostNative) * 100 : 0;

    return {
      assetId: r.assetId,
      ticker: r.ticker,
      name: r.ticker,
      assetClass: r.assetClass ?? "outros",
      sector: r.sector,
      currency: r.currency ?? "BRL",
      quantity: r.quantity,
      averagePrice: r.averageCost,
      currentPrice: r.priceQuote ?? r.priceBRL,
      valueBRL: r.valueBRL,
      totalCostBRL: effectiveCostBRL,
      unrealizedPnlBRL: r.unrealizedPnl,
      unrealizedPnlPct: r.unrealizedPct ?? 0,
      totalReturnPnlBRL: r.totalReturnPnl ?? undefined,
      totalReturnPct: r.totalReturnPct ?? (r.unrealizedPct ?? 0),
      dividendsBRL: divs,
      yearDividendsBRL: divs,
      yocPct: yoc,
      isCash: Boolean(r.isCash || isCashAssetClass(r.assetClass) || r.ticker.toUpperCase() === "CAIXA"),
      pricingMode: r.pricingMode ?? null,
      notes: r.notes ?? null,
      fixedIncomeMetadata: r.fixedIncomeMetadata ?? null,
      canonicalSource: r.canonicalSource ?? null,
      score: r.score ?? null,
      allocationStatus: r.allocationStatus ?? null,
      avgPriceUSD: r.avgPriceUSD,
      totalCostUSD: r.totalCostUSD,
      impliedHistoricalFxRate: r.impliedHistoricalFxRate,
      pricePnlPctUSD: r.pricePnlPctUSD,
      fxPnlPct: r.fxPnlPct,
      pricePnlPctBRL: r.pricePnlPctBRL,
      usdRate: rate > 0 ? rate : undefined,
      source: r.source ?? null,
      isEstimate: r.isEstimate,
      marketPriceAt: r.marketPriceAt ?? null,
      fetchedAt: r.fetchedAt ?? null,
      provider: r.provider ?? null,
      priceBRL: r.priceBRL,
    };
  });
}

/** Calcula o índice de liberdade financeira sem inventar despesa mensal fictícia quando vazia. */
export function buildReportFreedomAnalysis(params: {
  yearDividendsBRL: number;
  monthlyExpenses: readonly { value: number }[] | undefined;
  reserveTotalCents: number;
  cashBalanceBRL: number;
  assets: readonly PortfolioAsset[];
  usdRate: number;
}) {
  const { yearDividendsBRL, monthlyExpenses, reserveTotalCents, cashBalanceBRL, assets, usdRate } = params;
  const monthlyDivs = yearDividendsBRL > 0 ? yearDividendsBRL / 12 : 0;
  const monthlyExp =
    monthlyExpenses && monthlyExpenses.length > 0
      ? monthlyExpenses.reduce((acc, e) => acc + e.value, 0)
      : 0;
  const liquidReservesBRL = reserveTotalCents > 0 ? reserveTotalCents / 100 : cashBalanceBRL;

  return calculateFreedomIndex(
    monthlyDivs,
    monthlyExp,
    liquidReservesBRL,
    assets.map((a) => {
      const rate = a.currency === "USD" ? usdRate : 1;
      const avgPrice = a.quantity > 0 && a.average_price > 0 ? a.average_price : 10;
      return {
        ticker: a.ticker,
        currentPriceBRL: avgPrice * rate,
        monthlyDividendPerShareBRL: (a.estimated_monthly_dividend_per_share ?? 0) * rate,
        quantity: a.quantity,
      };
    }),
  );
}

