import type { FixedIncomeMetadata } from "@/types";
import {
  countCalendarDays,
  getFixedIncomeTaxRatePct,
  isFixedIncomeClass,
} from "@/domain/portfolio";

const round2 = (v: number): number => Math.round(v * 100) / 100;

export interface PeriodRedemptionItem {
  id: string;
  assetId: string;
  ticker: string;
  name?: string | null;
  assetClass: string;
  sector?: string | null;
  currency: string;
  redemptionDate: string;
  quantity: number;
  appliedCostBRL: number;
  grossRedeemedValueBRL: number;
  taxAmountBRL: number;
  taxRatePct: number | null;
  redeemedValueBRL: number; // Líquido após dedução de IR (quando houver)
  realizedPnlBRL: number; // Lucro líquido após dedução de IR (quando houver)
  finalReturnPct: number | null; // Rentabilidade líquida final
}

export interface PeriodRedemptionTxInput {
  id: string;
  asset_id: string;
  type: string;
  date: string;
  quantity: number;
  price: number;
  total: number;
}

export interface PeriodRedemptionAssetInput {
  id: string;
  ticker: string;
  name?: string | null;
  asset_class?: string | null;
  sector?: string | null;
  currency?: string | null;
  average_price?: number | null;
  fixed_income_metadata?: FixedIncomeMetadata | null;
}

export interface FilterPeriodRedemptionsParams {
  transactions: readonly PeriodRedemptionTxInput[];
  assets: readonly PeriodRedemptionAssetInput[];
  mode?: "month" | "year" | "custom";
  month?: string;
  year?: number;
  startDate?: string;
  endDate?: string;
  usdRate?: number;
}

/**
 * Filtra as transações de venda/resgate ocorridas no período selecionado
 * e concilia o valor resgatado líquido e o lucro realizado deduzido de IR (quando houver).
 */
export function filterPeriodRedemptions(
  params: FilterPeriodRedemptionsParams,
): PeriodRedemptionItem[] {
  const {
    transactions,
    assets,
    mode = "month",
    month,
    year,
    startDate,
    endDate,
    usdRate = 1,
  } = params;

  const assetMap = new Map<string, PeriodRedemptionAssetInput>();
  for (const a of assets) {
    assetMap.set(a.id, a);
  }

  const redemptions: PeriodRedemptionItem[] = [];

  for (const tx of transactions) {
    if (tx.type !== "sell") continue;

    // Filtro temporal por período
    let inPeriod: boolean;
    if (mode === "month" && month) {
      inPeriod = tx.date.startsWith(month);
    } else if (mode === "year" && year) {
      inPeriod = tx.date.startsWith(String(year));
    } else if (mode === "custom" && startDate && endDate) {
      inPeriod = tx.date >= startDate && tx.date <= endDate;
    } else if (month) {
      inPeriod = tx.date.startsWith(month);
    } else {
      inPeriod = true;
    }

    if (!inPeriod) continue;

    const asset = assetMap.get(tx.asset_id);
    const ticker = asset?.ticker ?? "ATIVO";
    const name = asset?.name ?? ticker;
    const assetClass = asset?.asset_class ?? "Outros";
    const sector = asset?.sector ?? null;
    const currency = asset?.currency ?? "BRL";
    const rate = currency === "USD" && usdRate > 0 ? usdRate : 1;

    const redeemedNative = tx.total > 0 ? tx.total : tx.quantity * tx.price;
    const grossRedeemedValueBRL = round2(redeemedNative * rate);

    let appliedNative = 0;
    if (asset?.fixed_income_metadata?.initial_investment_value) {
      appliedNative = asset.fixed_income_metadata.initial_investment_value;
    } else if (asset?.average_price && asset.average_price > 0) {
      appliedNative = tx.quantity * asset.average_price;
    } else if (tx.price > 0 && tx.quantity > 0) {
      appliedNative = tx.quantity * tx.price;
    }

    const appliedCostBRL = round2(appliedNative * rate);
    const grossProfitBRL = round2(grossRedeemedValueBRL - appliedCostBRL);

    // Inteligência Fiscal: cálculo e dedução de IR para Renda Fixa tributável
    let taxAmountBRL = 0;
    let taxRatePct: number | null = null;

    const isFixedIncome =
      isFixedIncomeClass(assetClass) || Boolean(asset?.fixed_income_metadata);

    if (isFixedIncome && grossProfitBRL > 0) {
      const isTaxExempt = Boolean(asset?.fixed_income_metadata?.is_tax_exempt);
      if (!isTaxExempt) {
        let daysPassed = 0;
        if (asset?.fixed_income_metadata?.initial_investment_date && tx.date) {
          daysPassed = countCalendarDays(
            asset.fixed_income_metadata.initial_investment_date,
            tx.date,
          );
        }
        taxRatePct = getFixedIncomeTaxRatePct(
          daysPassed,
          false,
          asset?.fixed_income_metadata?.manual_tax_rate_pct,
        );
        taxAmountBRL = round2(grossProfitBRL * (taxRatePct / 100));
      }
    }

    const redeemedValueBRL = round2(grossRedeemedValueBRL - taxAmountBRL);
    const realizedPnlBRL = round2(grossProfitBRL - taxAmountBRL);
    const finalReturnPct =
      appliedCostBRL > 0 ? round2((realizedPnlBRL / appliedCostBRL) * 100) : null;

    redemptions.push({
      id: tx.id,
      assetId: tx.asset_id,
      ticker,
      name,
      assetClass,
      sector,
      currency,
      redemptionDate: tx.date,
      quantity: tx.quantity,
      appliedCostBRL,
      grossRedeemedValueBRL,
      taxAmountBRL,
      taxRatePct,
      redeemedValueBRL,
      realizedPnlBRL,
      finalReturnPct,
    });
  }

  // Ordena decrescente por data de resgate
  return redemptions.sort((a, b) => b.redemptionDate.localeCompare(a.redemptionDate));
}
