import {
  isCashAssetClass,
  isDividendType,
  isHistoricalWithdrawal,
  type PointInTimeResult,
  type PriceSource,
} from "@/domain/portfolio";
import type { PortfolioAsset, PortfolioDividend, PortfolioTransaction } from "@/types";

export interface PeriodInvestmentFlowResult {
  buysBRL: number;
  sellsBRL: number;
  dividendsBRL: number;
  netFlowBRL: number;
  monthLabel: string;
  cashDepositsBRL?: number;
  cashWithdrawalsBRL?: number;
  externalContributionsBRL?: number;
  externalWithdrawalsBRL?: number;
  operationsCount?: number;
}

/**
 * Calcula fluxos financeiros da carteira (compras, vendas, proventos e fluxo líquido)
 * estritamente dentro do período ativo, contabilizando aportes/resgates em caixa e externos (§Bloco 2).
 */
export function computePeriodInvestmentFlow(params: {
  transactions?: readonly PortfolioTransaction[];
  dividends?: readonly PortfolioDividend[];
  assets?: readonly PortfolioAsset[];
  assetCurrencyMap?: ReadonlyMap<string, string>;
  usdRate?: number;
  isDateInPeriod?: (dateStr: string) => boolean;
  periodLabel?: string;
  contributions?: readonly { date?: string | null; amount: number; notes?: string | null }[];
  monthlyStatement?: {
    monthBuysBRL: number;
    monthSellsBRL: number;
    monthDividendsBRL: number;
    monthNetContributionBRL: number;
    transactionsCount?: number;
  } | null;
  reconciledNetFlowBRL?: number | null;
}): PeriodInvestmentFlowResult {
  const {
    transactions = [],
    dividends = [],
    assets = [],
    assetCurrencyMap = new Map(),
    usdRate = 1.0,
    isDateInPeriod = () => true,
    periodLabel = "Período Atual",
    contributions = [],
    monthlyStatement,
    reconciledNetFlowBRL,
  } = params;

  // Se o demonstrativo canônico da competência estiver disponível, ele é a SSOT
  if (monthlyStatement) {
    const netFlowBRL = reconciledNetFlowBRL != null ? reconciledNetFlowBRL : monthlyStatement.monthNetContributionBRL;
    const buysBRL =
      monthlyStatement.monthBuysBRL > 0
        ? monthlyStatement.monthBuysBRL
        : (netFlowBRL > 0 ? netFlowBRL : 0);
    const sellsBRL = monthlyStatement.monthSellsBRL;
    const dividendsBRL = monthlyStatement.monthDividendsBRL;
    const operationsCount = monthlyStatement.transactionsCount ?? (buysBRL > 0 || sellsBRL > 0 ? 1 : 0);
    return {
      buysBRL,
      sellsBRL,
      dividendsBRL,
      netFlowBRL,
      monthLabel: periodLabel,
      cashDepositsBRL: 0,
      cashWithdrawalsBRL: 0,
      externalContributionsBRL: netFlowBRL > 0 ? netFlowBRL : 0,
      externalWithdrawalsBRL: netFlowBRL < 0 ? Math.abs(netFlowBRL) : 0,
      operationsCount,
    };
  }

  const assetById = new Map(assets.map((a) => [a.id, a]));

  let cashDepositsBRL = 0;
  let cashWithdrawalsBRL = 0;
  let cashOperationsCount = 0;

  for (const t of transactions) {
    if (!isDateInPeriod(t.date)) continue;
    const asset = assetById.get(t.asset_id);
    const isCash = asset ? isCashAssetClass(asset.asset_class) || asset.ticker.toUpperCase() === "CAIXA" : false;
    if (isCash) {
      const val = Math.abs(t.total ?? t.quantity * t.price);
      const type = (t.type || "").toLowerCase().trim();
      if (type === "buy" || type === "deposit" || type === "deposito" || type === "aporte") {
        cashDepositsBRL += val;
        cashOperationsCount++;
      } else if (type === "sell" || type === "withdrawal" || type === "saque" || type === "retirada") {
        cashWithdrawalsBRL += val;
        cashOperationsCount++;
      }
    }
  }

  let externalContributionsBRL = 0;
  let externalWithdrawalsBRL = 0;
  let contributionsCount = 0;
  if (contributions) {
    for (const c of contributions) {
      if (c.date && isDateInPeriod(c.date)) {
        contributionsCount++;
        if (isHistoricalWithdrawal(c)) {
          externalWithdrawalsBRL += Math.abs(c.amount);
        } else {
          externalContributionsBRL += Math.abs(c.amount);
        }
      }
    }
  }

  const periodTransactions = transactions.filter((t) => {
    if (!isDateInPeriod(t.date)) return false;
    const asset = assetById.get(t.asset_id);
    if (asset && (isCashAssetClass(asset.asset_class) || asset.ticker.toUpperCase() === "CAIXA")) {
      return false;
    }
    return true;
  });

  const periodDividendsList: Array<{ asset_id: string | null; date: string; amount: number }> = [];
  for (const d of dividends) {
    if (isDateInPeriod(d.date)) {
      periodDividendsList.push({ asset_id: d.asset_id, date: d.date, amount: d.amount });
    }
  }

  for (const t of periodTransactions) {
    if (!isDividendType(t.type)) continue;
    const amt = t.total > 0 ? t.total : t.quantity > 0 && t.price > 0 ? t.quantity * t.price : 0;
    if (amt <= 0) continue;
    const tDate = t.date ? t.date.slice(0, 10) : "";
    const alreadyInList = periodDividendsList.some(
      (d) =>
        d.asset_id === t.asset_id &&
        d.date.slice(0, 10) === tDate &&
        Math.abs(d.amount - amt) < 0.01,
    );
    if (!alreadyInList) {
      periodDividendsList.push({ asset_id: t.asset_id, date: t.date, amount: amt });
    }
  }

  const sumByTypes = (types: readonly string[]) =>
    periodTransactions
      .filter((t) => types.includes(t.type))
      .reduce((acc, t) => {
        const curr = assetCurrencyMap.get(t.asset_id);
        const rate = curr === "USD" ? usdRate : 1;
        const totalVal = t.total ?? t.quantity * t.price;
        return acc + totalVal * rate;
      }, 0);

  const rawBuysBRL = sumByTypes(["buy", "subscription"]);
  const rawSellsBRL = sumByTypes(["sell"]);
  const dividendsBRL = periodDividendsList.reduce((acc, d) => {
    const curr = d.asset_id ? assetCurrencyMap.get(d.asset_id) : "BRL";
    const rate = curr === "USD" ? usdRate : 1;
    return acc + d.amount * rate;
  }, 0);

  let buysBRL =
    rawBuysBRL > 0
      ? rawBuysBRL
      : cashDepositsBRL > 0
        ? cashDepositsBRL
        : externalContributionsBRL;

  const sellsBRL =
    rawSellsBRL > 0
      ? rawSellsBRL
      : cashWithdrawalsBRL > 0
        ? cashWithdrawalsBRL
        : externalWithdrawalsBRL;

  const netExternalCashFlow =
    externalContributionsBRL - externalWithdrawalsBRL + (cashDepositsBRL - cashWithdrawalsBRL);

  let netFlowBRL =
    rawBuysBRL > 0 || rawSellsBRL > 0
      ? rawBuysBRL - rawSellsBRL + dividendsBRL
      : netExternalCashFlow !== 0
        ? netExternalCashFlow + dividendsBRL
        : dividendsBRL;

  // Se houver fluxo externo líquido reconciliado da série de snapshots (F_t = Delta C_total),
  // ele prevalece sobre contribuições parciais ou descoladas (§Gate v3.1)
  if (reconciledNetFlowBRL != null && Math.abs(reconciledNetFlowBRL) > 0.001) {
    if (rawBuysBRL === 0 && rawSellsBRL === 0) {
      if (reconciledNetFlowBRL > 0) {
        buysBRL = Math.round(reconciledNetFlowBRL * 100) / 100;
      }
      netFlowBRL = Math.round((reconciledNetFlowBRL + dividendsBRL) * 100) / 100;
    }
  }

  const operationsCount = periodTransactions.length + cashOperationsCount + contributionsCount;

  return {
    buysBRL,
    sellsBRL,
    dividendsBRL,
    netFlowBRL,
    monthLabel: periodLabel,
    cashDepositsBRL,
    cashWithdrawalsBRL,
    externalContributionsBRL,
    externalWithdrawalsBRL,
    operationsCount,
  };
}

/** Soma proventos de um ano específico convertendo ativos em USD pela cotação informada. */
export function computeYearDividendsBRL(params: {
  dividends: readonly PortfolioDividend[];
  selectedYear: number;
  assetCurrencyMap: ReadonlyMap<string, string>;
  usdRate: number;
  fallbackCurrentYearDividendsBRL: number;
}): number {
  const {
    dividends,
    selectedYear,
    assetCurrencyMap,
    usdRate,
    fallbackCurrentYearDividendsBRL,
  } = params;

  const yearPrefix = String(selectedYear);
  const tableDivs = dividends
    .filter((d) => d.date.startsWith(yearPrefix))
    .reduce((acc, d) => {
      const curr = d.asset_id ? assetCurrencyMap.get(d.asset_id) : "BRL";
      const rate = curr === "USD" ? usdRate : 1;
      return acc + d.amount * rate;
    }, 0);

  if (tableDivs > 0) return tableDivs;
  if (selectedYear === new Date().getFullYear()) {
    return fallbackCurrentYearDividendsBRL;
  }
  return 0;
}

/** Converte posições históricas Point-in-Time para o formato de linha consolidada. */
export function mapHistoricalPitPositions(historicalPit: PointInTimeResult) {
  return historicalPit.positions.map((p) => {
    const source: PriceSource = (p.quoteSource ?? "manual") as PriceSource;
    return {
      assetId: p.assetId ?? p.ticker,
      ticker: p.ticker,
      assetClass: p.assetClass,
      sector: p.sector ?? null,
      currency: (p.currency as "BRL" | "USD") ?? "BRL",
      quantity: p.quantity,
      averageCost: p.averagePrice,
      totalCost: p.totalCost,
      totalCostBRL: p.totalCostBRL,
      averageCostBRL: p.averagePrice,
      dividends: p.accumulatedDividendsBRL,
      dividendsNative:
        p.currency === "USD" && p.priceQuote > 0 && p.priceBRL > 0
          ? p.accumulatedDividendsBRL / (p.priceBRL / p.priceQuote)
          : p.accumulatedDividendsBRL,
      priceQuote: p.priceQuote,
      priceBRL: p.priceBRL,
      usdRate: p.currency === "USD" && p.priceQuote > 0 ? p.priceBRL / p.priceQuote : 1,
      source,
      valueBRL: p.valueBRL,
      pct: historicalPit.totalValueBRL > 0 ? (p.valueBRL / historicalPit.totalValueBRL) * 100 : 0,
      unrealizedPnl: p.unrealizedPnl,
      unrealizedPct: p.unrealizedPct,
      totalReturnPnl: p.totalReturnPnl,
      totalReturnPct: p.totalReturnPct,
      isCash: false,
      pricingMode: "unit_price" as const,
    };
  });
}
