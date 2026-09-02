import { useEffect, useRef } from "react";
import {
  useAllPortfolioTransactions,
  usePortfolioAssets,
  usePortfolioContributions,
  usePortfolioDividends,
  usePortfolioSnapshots,
  useUpsertPortfolioSnapshot,
} from "./use-portfolio";
import { useAssetPrices } from "./use-asset-prices";
import { useMacroIndicators } from "./use-macro-indicators";
import {
  buildPortfolioMonthlySeries,
  calculatePortfolioTotalReturn,
  calculatePositionSummary,
  fallbackPriceFor,
  isCashAssetClass,
  resolvePrice,
  usdRateFromPrices,
  type AssetPricingMode,
  type FixedIncomeBalanceResult,
  type PortfolioMonthlySeriesPoint,
  type PriceSource,
} from "@/domain/portfolio";
import { todayISO } from "@/domain/debts";
import { currentMonth } from "@/lib/date";
import type { AssetCurrency, FixedIncomeMetadata } from "@/types";

const round2 = (value: number): number => Math.round(value * 100) / 100;

export interface PortfolioPositionRow {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  sector?: string | null;
  currency: AssetCurrency;
  quantity: number;
  /** Custo médio na moeda nativa do ativo (USD ou BRL). */
  averageCost: number;
  /** Custo total na moeda nativa do ativo (USD ou BRL). */
  totalCost: number;
  /** Custo total convertido para BRL (para PnL e relatórios consolidados). */
  totalCostBRL: number;
  /** Custo médio convertido para BRL. */
  averageCostBRL: number;
  /** Total de proventos recebidos em BRL (dividendos + jcp + rendimentos + acumulados históricos). */
  dividends: number;
  /** Preço unitário na moeda nativa do ativo (USD ou BRL). */
  priceQuote: number;
  /** Preço unitário em BRL (caixa = 1). */
  priceBRL: number;
  /** Taxa de câmbio USD/BRL utilizada. */
  usdRate: number;
  /** Fonte do preço usado (manual / api / fallback). */
  source: PriceSource;
  /** Valor de mercado em BRL (caixa = quantidade × 1). */
  valueBRL: number;
  /** % do patrimônio (0–100). */
  pct: number;
  /** Lucro/prejuízo de capital não realizado em BRL (valor − custo; F14). */
  unrealizedPnl: number;
  /** Variação da cotação % sobre o custo (null quando não há custo — caixa; F14). */
  unrealizedPct: number | null;
  /** Resultado total em BRL ((valor − custo) + proventos). */
  totalReturnPnl: number;
  /** Retorno Total % sobre o custo (null quando não há custo — caixa). */
  totalReturnPct: number | null;
  /** Custo histórico total aplicado no ativo (mesmo para posições encerradas). */
  historicalCostBRL?: number;
  /** Total bruto histórico já resgatado/vendido do ativo. */
  historicalRedeemedBRL?: number;
  /** Rentabilidade final realizada % (para posições encerradas). */
  finalReturnPct?: number | null;
  isCash: boolean;
  pricingMode: AssetPricingMode;
  notes?: string | null;
  fixedIncomeMetadata?: FixedIncomeMetadata | null;
  fixedIncomeResult?: FixedIncomeBalanceResult | null;
  isMatured?: boolean;
  maturityDate?: string | null;
  netValueBRL?: number;
  taxAmountBRL?: number;
  taxRatePct?: number;
}

export interface PortfolioPosition {
  rows: PortfolioPositionRow[];
  /** Patrimônio total = soma das posições em BRL. */
  totalBRL: number;
  /** Custo total da carteira em BRL. */
  totalCostBRL: number;
  /** Caixa derivado/alocado (valor dos ativos com classe caixa/reserva). */
  cashBRL: number;
  /** Proventos totais recebidos na carteira em BRL. */
  totalDividendsBRL: number;
  /** Resultado total consolidado em BRL ((patrimônio − custo) + proventos). */
  totalReturnPnlBRL: number;
  /** Retorno Total % consolidado da carteira (com proventos). */
  totalReturnPct: number | null;
  /** Ganho de capital não realizado consolidado em BRL (patrimônio − custo). */
  unrealizedPnlBRL: number;
  /** Variação da cotação % consolidada da carteira (sem proventos). */
  unrealizedPct: number | null;
  /**
   * Série mensal a partir de snapshots com proventos integrados (F36 & F37).
   */
  monthlySeries: PortfolioMonthlySeriesPoint[];
  /**
   * Aporte líquido do mês corrente em centavos (F19 & F36).
   */
  monthlyContributionCents: number;
  isLoading: boolean;
  error: unknown;
  /** Reexecuta as consultas. */
  refetch: () => void;
}

export function usePortfolioPosition(): PortfolioPosition {
  const assetsQuery = usePortfolioAssets();
  const pricesQuery = useAssetPrices();
  const macroQuery = useMacroIndicators();
  const contributionsQuery = usePortfolioContributions();
  const dividendsQuery = usePortfolioDividends();
  const snapshotsQuery = usePortfolioSnapshots();
  const transactionsQuery = useAllPortfolioTransactions();
  const upsertSnapshot = useUpsertPortfolioSnapshot();

  const prices = pricesQuery.data ?? [];
  const usdRate = usdRateFromPrices(prices);
  const priceByTicker = new Map(prices.map((p) => [p.ticker.trim().toUpperCase(), p]));
  const annualCdiRate = macroQuery.data?.annualCdiRate;
  const today = todayISO();

  // Agrupa compras e vendas históricas por ativo a partir do ledger
  const boughtByAsset = new Map<string, number>();
  const soldByAsset = new Map<string, number>();
  for (const t of transactionsQuery.data ?? []) {
    const amount = t.total > 0 ? t.total : (t.quantity > 0 && t.price > 0 ? t.quantity * t.price : 0);
    if (t.type === "buy" || t.type === "subscription") {
      boughtByAsset.set(t.asset_id, (boughtByAsset.get(t.asset_id) ?? 0) + amount);
    } else if (t.type === "sell") {
      soldByAsset.set(t.asset_id, (soldByAsset.get(t.asset_id) ?? 0) + amount);
    }
  }

  // Agrega também aportes financeiros direcionados ao ativo (evitando duplicar se já estiver no ledger)
  for (const c of contributionsQuery.data ?? []) {
    if (c.asset_id && c.amount > 0) {
      const alreadyInTx = (transactionsQuery.data ?? []).some(
        (t) => t.asset_id === c.asset_id && (t.type === "buy" || t.type === "subscription") && t.date === c.date && Math.abs(t.total - c.amount) < 0.01,
      );
      if (!alreadyInTx) {
        boughtByAsset.set(c.asset_id, (boughtByAsset.get(c.asset_id) ?? 0) + c.amount);
      }
    }
  }

  // Agrupa proventos periódicos por ativo (lançamentos em portfolio_dividends)
  const dividendsByAsset = new Map<string, number>();
  for (const d of dividendsQuery.data ?? []) {
    if (d.asset_id) {
      dividendsByAsset.set(d.asset_id, (dividendsByAsset.get(d.asset_id) ?? 0) + d.amount);
    }
  }
  // Soma proventos acumulados históricos (anteriores ao extrato periódico).
  // Alimentam YoC e Bola de Neve sem distorcer o calendário/extrato mensal.
  for (const a of assetsQuery.data ?? []) {
    const acc = a.accumulated_dividends ?? 0;
    if (acc > 0) {
      dividendsByAsset.set(a.id, (dividendsByAsset.get(a.id) ?? 0) + acc);
    }
  }

  let totalBRL = 0;
  let totalCostBRL = 0;
  let cashBRL = 0;
  const rawRows: Array<Omit<PortfolioPositionRow, "pct">> = [];

  for (const asset of assetsQuery.data ?? []) {
    const isCash = isCashAssetClass(asset.asset_class);
    const quantity = Number(asset.quantity ?? 0);
    const averageCost = Number(asset.average_price ?? 0);

    const normalizedTicker = asset.ticker.trim().toUpperCase();
    const priceRow = priceByTicker.get(normalizedTicker);
    const defaultFallback = fallbackPriceFor(asset.currency);
    const effectiveFallback = averageCost > 0 ? averageCost : defaultFallback;

    const manualPriceCandidate =
      priceRow?.manual_price !== null && priceRow?.manual_price !== undefined && priceRow.manual_price > 0
        ? priceRow.manual_price
        : priceRow?.source === "manual" && priceRow.price > 0
          ? priceRow.price
          : null;

    const cachePriceCandidate =
      priceRow?.source === "api" && priceRow.price > 0
        ? priceRow.price
        : priceRow?.source !== "manual" && priceRow?.price && priceRow.price > 0
          ? priceRow.price
          : null;

    const resolved = resolvePrice({
      manualPrice: manualPriceCandidate,
      cachePrice: cachePriceCandidate,
      fallbackPrice: effectiveFallback,
    });

    const assetDividends = dividendsByAsset.get(asset.id) ?? 0;

    const summary = calculatePositionSummary({
      quantity,
      averagePrice: averageCost,
      assetClass: asset.asset_class,
      currency: asset.currency,
      resolvedPrice: resolved,
      usdRate,
      ticker: asset.ticker,
      notes: asset.notes,
      totalDividends: assetDividends,
      fixedIncomeMetadata: asset.fixed_income_metadata,
      annualCdiRate,
      today,
    });

    totalBRL = round2(totalBRL + summary.valueBRL);
    if (isCash) {
      cashBRL = round2(cashBRL + summary.valueBRL);
    } else if (summary.quantity > 0) {
      totalCostBRL = round2(totalCostBRL + summary.totalCostBRL);
    }

    const rate = asset.currency === "USD" ? usdRate : 1;
    const totalBought = boughtByAsset.get(asset.id) ?? 0;
    const totalSold = soldByAsset.get(asset.id) ?? 0;

    const fiOriginalCost =
      asset.fixed_income_metadata?.initial_investment_value !== undefined &&
      asset.fixed_income_metadata?.initial_investment_value !== null &&
      asset.fixed_income_metadata.initial_investment_value > 0
        ? asset.fixed_income_metadata.initial_investment_value
        : asset.fixed_income_metadata?.base_value !== undefined &&
            asset.fixed_income_metadata?.base_value !== null &&
            asset.fixed_income_metadata.base_value > 0
          ? asset.fixed_income_metadata.base_value
          : undefined;

    const effectiveAppliedNative =
      totalBought > 0
        ? totalBought
        : fiOriginalCost !== undefined
          ? fiOriginalCost
          : summary.totalCostBRL > 0
            ? summary.totalCostBRL
            : Number(asset.average_price || 0);

    const historicalCostBRL = round2(effectiveAppliedNative * rate);
    const historicalRedeemedBRL = round2(totalSold * rate);

    const isClosed = summary.quantity <= 0 && summary.valueBRL <= 0;
    const effectiveRealizedPnl = isClosed
      ? round2(historicalRedeemedBRL - historicalCostBRL)
      : summary.unrealizedPnl;

    const effectiveTotalReturnPnl = isClosed
      ? round2(historicalRedeemedBRL - historicalCostBRL + summary.totalDividends)
      : summary.totalReturnPnl;

    const effectiveFinalReturnPct = isClosed && historicalCostBRL > 0
      ? round2((effectiveTotalReturnPnl / historicalCostBRL) * 100)
      : isClosed
        ? null
        : summary.totalReturnPct;

    rawRows.push({
      assetId: asset.id,
      ticker: asset.ticker,
      assetClass: asset.asset_class,
      sector: asset.sector ?? null,
      currency: asset.currency,
      quantity: summary.quantity,
      averageCost: summary.pricingMode === "total_value" ? summary.totalCost : averageCost,
      totalCost: summary.totalCost,
      totalCostBRL: summary.totalCostBRL,
      averageCostBRL: summary.averagePriceBRL,
      dividends: summary.totalDividends,
      priceQuote: summary.priceQuote,
      priceBRL: summary.priceBRL,
      usdRate,
      source: summary.source,
      valueBRL: summary.valueBRL,
      unrealizedPnl: effectiveRealizedPnl,
      unrealizedPct: summary.unrealizedPct,
      totalReturnPnl: effectiveTotalReturnPnl,
      totalReturnPct: summary.totalReturnPct,
      historicalCostBRL,
      historicalRedeemedBRL,
      finalReturnPct: effectiveFinalReturnPct,
      isCash,
      pricingMode: summary.pricingMode,
      notes: asset.notes,
      fixedIncomeMetadata: asset.fixed_income_metadata,
      fixedIncomeResult: summary.fixedIncomeResult,
      isMatured: summary.isMatured,
      maturityDate: summary.maturityDate,
      netValueBRL: summary.netValueBRL,
      taxAmountBRL: summary.taxAmountBRL,
      taxRatePct: summary.taxRatePct,
    });
  }

  const rows = rawRows.map((row) => ({
    ...row,
    pct: totalBRL > 0 ? Math.round((row.valueBRL / totalBRL) * 10000) / 100 : 0,
  }));

  const consolidatedReturn = calculatePortfolioTotalReturn(rawRows);

  // Aporte líquido do mês corrente a partir de portfolio_contributions
  const thisMonth = currentMonth();
  let contributionBRL = 0;
  for (const c of contributionsQuery.data ?? []) {
    if (c.date.startsWith(thisMonth)) {
      contributionBRL += c.amount;
    }
  }

  // Snapshots mensais reais com proventos integrados (F36 & F37)
  const initialAccumulatedDividends = (assetsQuery.data ?? []).reduce(
    (acc, a) => acc + (a.accumulated_dividends ?? 0),
    0,
  );

  const currentMonthPoint =
    totalBRL > 0 || (assetsQuery.data && assetsQuery.data.length > 0)
      ? { month: thisMonth, total_value: totalBRL, total_cost: totalCostBRL }
      : null;

  const monthlySeries = buildPortfolioMonthlySeries({
    rawSnapshots: (snapshotsQuery.data ?? []).map((s) => ({
      month: s.month,
      total_value: Number(s.total_value),
      total_cost: Number(s.total_cost),
    })),
    currentMonthPoint,
    dividends: (dividendsQuery.data ?? []).map((d) => ({
      date: d.date,
      amount: Number(d.amount),
    })),
    initialAccumulatedDividends,
    limit: 6,
  });

  // Atualiza snapshot do mês corrente em background quando há dados carregados
  const lastUpdatedMonth = useRef<string | null>(null);
  useEffect(() => {
    if (
      assetsQuery.isLoading ||
      pricesQuery.isLoading ||
      !assetsQuery.data ||
      assetsQuery.data.length === 0 ||
      totalBRL <= 0
    ) {
      return;
    }
    if (lastUpdatedMonth.current !== thisMonth) {
      lastUpdatedMonth.current = thisMonth;
      upsertSnapshot.mutate({
        month: thisMonth,
        total_value: totalBRL,
        total_cost: totalCostBRL,
      });
    }
  }, [assetsQuery.data, assetsQuery.isLoading, pricesQuery.isLoading, thisMonth, totalBRL, totalCostBRL, upsertSnapshot]);

  return {
    rows,
    totalBRL,
    totalCostBRL,
    cashBRL,
    totalDividendsBRL: consolidatedReturn.totalDividendsBRL,
    totalReturnPnlBRL: consolidatedReturn.totalReturnPnl,
    totalReturnPct: consolidatedReturn.totalReturnPct,
    unrealizedPnlBRL: consolidatedReturn.capitalGainPnl,
    unrealizedPct: consolidatedReturn.capitalGainPct,
    monthlySeries,
    monthlyContributionCents: Math.round(contributionBRL * 100),
    isLoading: assetsQuery.isLoading || pricesQuery.isLoading,
    error: assetsQuery.error ?? pricesQuery.error,
    refetch: () => {
      void assetsQuery.refetch();
      void pricesQuery.refetch();
      void macroQuery.refetch();
      void contributionsQuery.refetch();
      void dividendsQuery.refetch();
      void snapshotsQuery.refetch();
    },
  };
}
