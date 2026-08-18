import { useAllPortfolioTransactions, usePortfolioAssets } from "./use-portfolio";
import { useAssetPrices } from "./use-asset-prices";
import {
  computeLedger,
  fallbackPriceFor,
  isCashAssetClass,
  portfolioMonthlySeries,
  positionPnl,
  resolvePrice,
  usdRateFromPrices,
  valueAssetPosition,
  type LedgerTransaction,
  type PriceSource,
} from "@/domain/portfolio";
import { currentMonth, shiftMonth } from "@/lib/date";
import type { AssetCurrency, PortfolioTransaction } from "@/types";

/**
 * Posição consolidada da carteira (§3.11.2) — derivação local de exibição:
 *   • Ledger por ativo (custo médio, quantidade, proventos — domain puro);
 *   • Valoração em BRL com pipeline manual → cache → fallback (D5);
 *   • Rentabilidade não realizada (valor − custo, % sobre o custo — F14);
 *   • Caixa/reserva com valor 1:1 (quantidade = valor);
 *   • pctAtual = valor ÷ patrimônio total × 100;
 *   • Série mensal derivada (F14) para o comparativo Δ vs. mês anterior.
 * Nenhuma posição é armazenada — tudo derivado das transações + cotações.
 */

const round2 = (value: number): number => Math.round(value * 100) / 100;

export interface PortfolioPositionRow {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  currency: AssetCurrency;
  quantity: number;
  averageCost: number;
  totalCost: number;
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
  /** Caixa derivado do ledger (fluxo líquido) — pode ser negativo. */
  cashBRL: number;
  /**
   * Série mensal derivada (F14): últimos 6 meses, valorados com os preços
   * atuais (aproximação documentada em `portfolioMonthlySeries`). Usada no
   * comparativo "Δ vs. mês anterior" do KPI Patrimônio e na sparkline (F16).
   */
  monthlySeries: { month: string; valueBRL: number }[];
  /**
   * Aporte líquido do mês corrente em centavos (F19): compras + subscrições
   * − vendas do mês. É a "saída mensal de investimentos" usada nas projeções
   * de insights — não o patrimônio (que distorceria o superávit).
   */
  monthlyContributionCents: number;
  isLoading: boolean;
  error: unknown;
  /** Reexecuta as consultas de ativos, transações e preços. */
  refetch: () => void;
}

export function usePortfolioPosition(): PortfolioPosition {
  const assetsQuery = usePortfolioAssets();
  const transactionsQuery = useAllPortfolioTransactions();
  const pricesQuery = useAssetPrices();

  const prices = pricesQuery.data ?? [];
  const usdRate = usdRateFromPrices(prices);
  const priceByTicker = new Map(prices.map((p) => [p.ticker.trim().toUpperCase(), p]));

  const transactionsByAsset = new Map<string, PortfolioTransaction[]>();
  for (const tx of transactionsQuery.data ?? []) {
    const list = transactionsByAsset.get(tx.asset_id) ?? [];
    list.push(tx);
    transactionsByAsset.set(tx.asset_id, list);
  }

  let totalBRL = 0;
  let cashBRL = 0;
  const rawRows: Array<Omit<PortfolioPositionRow, "pct">> = [];

  for (const asset of assetsQuery.data ?? []) {
    const ledger = computeLedger(
      (transactionsByAsset.get(asset.id) ?? []).map(
        (t): LedgerTransaction => ({
          id: t.id,
          type: t.type,
          date: t.date,
          quantity: t.quantity,
          price: t.price,
          total: t.total,
        }),
      ),
    );
    cashBRL = round2(cashBRL + ledger.cash);

    const isCash = isCashAssetClass(asset.asset_class);
    let source: PriceSource = "fallback";
    let priceBRL: number;
    let valueBRL: number;

    if (isCash) {
      // Ticker de caixa: valor 1:1 (quantidade = valor) — §3.11.2.
      priceBRL = 1;
      valueBRL = ledger.quantity;
    } else {
      const normalizedTicker = asset.ticker.trim().toUpperCase();
      const priceRow = priceByTicker.get(normalizedTicker);
      const defaultFallback = fallbackPriceFor(asset.currency);
      const effectiveFallback = ledger.averageCost > 0 ? ledger.averageCost : defaultFallback;

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
      priceBRL = asset.currency === "USD" ? round2(resolved.price * usdRate) : resolved.price;
      valueBRL = valueAssetPosition(ledger.quantity, resolved, asset.currency, usdRate).valueBRL;
      source = resolved.source;
    }

    totalBRL = round2(totalBRL + valueBRL);
    const pnl = positionPnl(valueBRL, ledger.totalCost);
    rawRows.push({
      assetId: asset.id,
      ticker: asset.ticker,
      assetClass: asset.asset_class,
      currency: asset.currency,
      quantity: ledger.quantity,
      averageCost: ledger.averageCost,
      totalCost: ledger.totalCost,
      dividends: ledger.dividends,
      priceBRL,
      source,
      valueBRL: round2(valueBRL),
      unrealizedPnl: pnl.unrealizedPnl,
      unrealizedPct: pnl.unrealizedPct,
      isCash,
    });
  }

  const rows = rawRows.map((row) => ({
    ...row,
    pct: totalBRL > 0 ? Math.round((row.valueBRL / totalBRL) * 10000) / 100 : 0,
  }));

  // Série mensal derivada (F14): últimos 6 meses (inclusive o atual), valorada
  // com os preços atuais — aproximação documentada em `portfolioMonthlySeries`.
  const months = Array.from({ length: 6 }, (_, index) => shiftMonth(currentMonth(), index - 5));
  const seriesAssets = rawRows.map((row) => ({
    assetId: row.assetId,
    isCash: row.isCash,
    priceBRL: row.priceBRL,
  }));
  const monthlySeries = portfolioMonthlySeries(transactionsByAsset, seriesAssets, months);

  // Aporte líquido do mês corrente (F19): compras + subscrições debitam,
  // vendas creditam; proventos/splits não contam como aporte.
  const currentMonthKey = currentMonth();
  let contributionBRL = 0;
  for (const tx of transactionsQuery.data ?? []) {
    if (!tx.date.startsWith(currentMonthKey)) continue;
    if (tx.type === "buy" || tx.type === "subscription") contributionBRL += tx.total;
    else if (tx.type === "sell") contributionBRL -= tx.total;
  }

  return {
    rows,
    totalBRL,
    cashBRL,
    monthlySeries,
    monthlyContributionCents: Math.round(contributionBRL * 100),
    isLoading: assetsQuery.isLoading || transactionsQuery.isLoading || pricesQuery.isLoading,
    error: assetsQuery.error ?? transactionsQuery.error ?? pricesQuery.error,
    refetch: () => {
      void assetsQuery.refetch();
      void transactionsQuery.refetch();
      void pricesQuery.refetch();
    },
  };
}
