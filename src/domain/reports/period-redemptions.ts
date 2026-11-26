import type { FixedIncomeMetadata } from "@/types";
import { countCalendarDays } from "@/domain/portfolio/business-days";
import { getFixedIncomeTaxRatePct } from "@/domain/portfolio/fixed-income";
import { isFixedIncomeClass } from "@/domain/portfolio/valuation";
import { parseFixedIncomeSellNotes } from "@/domain/portfolio/fixed-income-redemption-preview";

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
  grossProfitBRL?: number;
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
  total_cost_brl?: number | null;
  notes?: string | null;
}

export interface PeriodRedemptionAssetInput {
  id: string;
  ticker: string;
  name?: string | null;
  asset_class?: string | null;
  sector?: string | null;
  currency?: string | null;
  quantity?: number | null;
  average_price?: number | null;
  fixed_income_metadata?: Partial<FixedIncomeMetadata> | null;
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

    const isFixedIncome =
      isFixedIncomeClass(assetClass) || Boolean(asset?.fixed_income_metadata);

    const txRealized = tx as unknown as {
      cost_basis_realized?: number | null;
      gross_realized_pnl?: number | null;
      ir_withheld?: number | null;
      net_realized_pnl?: number | null;
    };

    const parsedNotes = parseFixedIncomeSellNotes(tx.notes);
    let appliedNative = 0;
    let appliedCostBRL: number;
    let grossProfitBRL: number;
    let taxAmountBRL = 0;
    let taxRatePct: number | null = null;

    if (txRealized.cost_basis_realized != null && txRealized.net_realized_pnl != null) {
      appliedCostBRL = round2(txRealized.cost_basis_realized);
      grossProfitBRL = round2(
        txRealized.gross_realized_pnl ?? (grossRedeemedValueBRL - appliedCostBRL),
      );
      taxAmountBRL = round2(txRealized.ir_withheld ?? 0);
      taxRatePct =
        grossProfitBRL > 0 && taxAmountBRL > 0
          ? round2((taxAmountBRL / grossProfitBRL) * 100)
          : null;
    } else if (parsedNotes) {
      appliedCostBRL = round2(parsedNotes.appliedCost);
      grossProfitBRL = round2(parsedNotes.realizedProfit);
      taxAmountBRL = round2(parsedNotes.taxAmount);
      taxRatePct = parsedNotes.taxRatePct;
    } else if (
      tx.total_cost_brl != null &&
      tx.total_cost_brl > 0 &&
      (!isFixedIncome || tx.total_cost_brl < grossRedeemedValueBRL)
    ) {
      appliedNative = rate > 0 ? tx.total_cost_brl / rate : tx.total_cost_brl;
      appliedCostBRL = round2(appliedNative * rate);
      grossProfitBRL = round2(grossRedeemedValueBRL - appliedCostBRL);
    } else if (isFixedIncome) {
      const fiMeta = asset?.fixed_income_metadata;
      const initialCost =
        fiMeta?.initial_investment_value ??
        (asset?.average_price && asset.average_price > 0 ? asset.average_price : 0);
      const currentGross =
        fiMeta?.base_value ??
        (asset?.quantity && asset.quantity > 0 && asset.average_price
          ? asset.quantity * asset.average_price
          : 0);

      if (initialCost > 0 && currentGross > 0) {
        // Reconstrução Algébrica Canônica sem Duplo Desconto (Auditoria v8 / Gate v8.1):
        // Posição parcialmente aberta: C_baixado = V_resgate * min(1, custo_atual / saldo_atual)
        const costRatio = Math.min(1, initialCost / currentGross);
        appliedNative = round2(redeemedNative * costRatio);
      } else if (initialCost > 0) {
        // Posição totalmente liquidada (saldo residual = 0): custo baixado é o custo inicial registrado
        appliedNative = Math.min(redeemedNative, initialCost);
      } else {
        appliedNative = redeemedNative;
      }
      appliedCostBRL = round2(appliedNative * rate);
      grossProfitBRL = round2(grossRedeemedValueBRL - appliedCostBRL);
    } else if (asset?.average_price && asset.average_price > 0) {
      appliedNative = tx.quantity * asset.average_price;
      appliedCostBRL = round2(appliedNative * rate);
      grossProfitBRL = round2(grossRedeemedValueBRL - appliedCostBRL);
    } else if (tx.price > 0 && tx.quantity > 0) {
      appliedNative = tx.quantity * tx.price;
      appliedCostBRL = round2(appliedNative * rate);
      grossProfitBRL = round2(grossRedeemedValueBRL - appliedCostBRL);
    } else {
      appliedCostBRL = round2(appliedNative * rate);
      grossProfitBRL = round2(grossRedeemedValueBRL - appliedCostBRL);
    }

    if (isFixedIncome && grossProfitBRL > 0 && taxRatePct === null) {
      const isTaxExempt = Boolean(asset?.fixed_income_metadata?.is_tax_exempt);
      if (!isTaxExempt) {
        const sortedBuyTxs = transactions
          .filter(
            (t) =>
              t.asset_id === tx.asset_id &&
              (t.type === "buy" || t.type === "compra" || t.type === "asset_buy") &&
              t.date <= tx.date,
          )
          .sort((a, b) => a.date.localeCompare(b.date));
        const earliestBuyTx = sortedBuyTxs[0];

        const hasExplicitAssetDate = Boolean(
          asset?.fixed_income_metadata?.initial_investment_date,
        );
        const explicitDate =
          asset?.fixed_income_metadata?.initial_investment_date ||
          (tx as unknown as { acquisition_date?: string }).acquisition_date ||
          (tx as unknown as { application_date?: string }).application_date ||
          earliestBuyTx?.date;

        const isEstimatedFallbackDate = !hasExplicitAssetDate && !explicitDate;
        const startDate =
          explicitDate ||
          asset?.fixed_income_metadata?.base_date ||
          (asset as unknown as { created_at?: string }).created_at?.slice(0, 10);

        let daysPassed = 0;
        if (startDate && tx.date) {
          daysPassed = countCalendarDays(startDate, tx.date);
        }

        // Salvaguarda econômica regressiva (Bloco 2 v6 / Bloco 1 v7 / Bloco 1 v8):
        // Quando a data de aquisição for estimada ou ausente (ex.: Marco Zero), mas a rentabilidade acumulada
        // for característica de longo prazo, calibra a alíquota pelo retorno histórico do ativo:
        if (isEstimatedFallbackDate && appliedCostBRL > 0) {
          const retRatio = grossProfitBRL / appliedCostBRL;
          if (retRatio >= 0.15) {
            daysPassed = 721; // > 720 dias -> 15,0%
          } else if (retRatio >= 0.08) {
            daysPassed = 181; // 181-360 dias -> 20,0%
          }
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
      grossProfitBRL,
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
