import { useEffect, useRef } from "react";
import {
  usePortfolioAssets,
  usePortfolioContributions,
  usePortfolioDividends,
  usePortfolioSnapshots,
  useUpsertPortfolioSnapshot,
} from "./use-portfolio";
import { useAssetPrices } from "./use-asset-prices";
import {
  calculatePositionSummary,
  fallbackPriceFor,
  isCashAssetClass,
  resolvePrice,
  usdRateFromPrices,
  type PriceSource,
} from "@/domain/portfolio";
import { currentMonth, shiftMonth } from "@/lib/date";
import type { AssetCurrency } from "@/types";

const round2 = (value: number): number => Math.round(value * 100) / 100;

export interface PortfolioPositionRow {
  assetId: string;
  ticker: string;
  assetClass: string | null;
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
  dividends: number;
  /** Preço unitário em BRL (caixa = 1). */
  priceBRL: number;
  /** Fonte do preço usado (manual / api / fallback). */
  source: PriceSource;
  /** Valor de mercado em BRL (caixa = quantidade × 1). */
  valueBRL: number;
  /** % do patrimônio (0–100). */
  pct: number;
  /** Lucro/prejuízo não realizado em BRL (valor − custo; F14). */
  unrealizedPnl: number;
  /** Rentabilidade % sobre o custo (null quando não há custo — caixa; F14). */
  unrealizedPct: number | null;
  isCash: boolean;
}

export interface PortfolioPosition {
  rows: PortfolioPositionRow[];
  /** Patrimônio total = soma das posições em BRL. */
  totalBRL: number;
  /** Custo total da carteira em BRL. */
  totalCostBRL: number;
  /** Caixa derivado/alocado (valor dos ativos com classe caixa/reserva). */
  cashBRL: number;
  /**
   * Série mensal a partir de snapshots (F36).
   */
  monthlySeries: { month: string; valueBRL: number; costBRL: number }[];
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
  const contributionsQuery = usePortfolioContributions();
  const dividendsQuery = usePortfolioDividends();
  const snapshotsQuery = usePortfolioSnapshots();
  const upsertSnapshot = useUpsertPortfolioSnapshot();

  const prices = pricesQuery.data ?? [];
  const usdRate = usdRateFromPrices(prices);
  const priceByTicker = new Map(prices.map((p) => [p.ticker.trim().toUpperCase(), p]));

  // Agrupa proventos por ativo
  const dividendsByAsset = new Map<string, number>();
  for (const d of dividendsQuery.data ?? []) {
    dividendsByAsset.set(d.asset_id, (dividendsByAsset.get(d.asset_id) ?? 0) + d.amount);
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

    const summary = calculatePositionSummary({
      quantity,
      averagePrice: averageCost,
      assetClass: asset.asset_class,
      currency: asset.currency,
      resolvedPrice: resolved,
      usdRate,
    });

    totalBRL = round2(totalBRL + summary.valueBRL);
    totalCostBRL = round2(totalCostBRL + summary.totalCostBRL);
    if (isCash) {
      cashBRL = round2(cashBRL + summary.valueBRL);
    }

    rawRows.push({
      assetId: asset.id,
      ticker: asset.ticker,
      assetClass: asset.asset_class,
      currency: asset.currency,
      quantity,
      averageCost,
      totalCost: summary.totalCost,
      totalCostBRL: summary.totalCostBRL,
      averageCostBRL: summary.averagePriceBRL,
      dividends: dividendsByAsset.get(asset.id) ?? 0,
      priceBRL: summary.priceBRL,
      source: summary.source,
      valueBRL: summary.valueBRL,
      unrealizedPnl: summary.unrealizedPnl,
      unrealizedPct: summary.unrealizedPct,
      isCash,
    });
  }

  const rows = rawRows.map((row) => ({
    ...row,
    pct: totalBRL > 0 ? Math.round((row.valueBRL / totalBRL) * 10000) / 100 : 0,
  }));

  // Aporte líquido do mês corrente a partir de portfolio_contributions
  const thisMonth = currentMonth();
  let contributionBRL = 0;
  for (const c of contributionsQuery.data ?? []) {
    if (c.date.startsWith(thisMonth)) {
      contributionBRL += c.amount;
    }
  }

  // Snapshots mensais (últimos 6 meses)
  const months = Array.from({ length: 6 }, (_, index) => shiftMonth(thisMonth, index - 5));
  const snapshotByMonth = new Map((snapshotsQuery.data ?? []).map((s) => [s.month, s]));

  const monthlySeries = months.map((month) => {
    if (month === thisMonth) {
      return { month, valueBRL: totalBRL, costBRL: totalCostBRL };
    }
    const snap = snapshotByMonth.get(month);
    return {
      month,
      valueBRL: snap ? snap.total_value : totalBRL,
      costBRL: snap ? snap.total_cost : totalCostBRL,
    };
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
    monthlySeries,
    monthlyContributionCents: Math.round(contributionBRL * 100),
    isLoading: assetsQuery.isLoading || pricesQuery.isLoading,
    error: assetsQuery.error ?? pricesQuery.error,
    refetch: () => {
      void assetsQuery.refetch();
      void pricesQuery.refetch();
      void contributionsQuery.refetch();
      void dividendsQuery.refetch();
      void snapshotsQuery.refetch();
    },
  };
}
