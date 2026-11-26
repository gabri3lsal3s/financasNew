import { numberToCents } from "@/domain/money/parse";
import { formatFxSourceLabel, type StaleQuoteGuardResult } from "@/domain/portfolio/stale-quote-guard";
import { isCustomValuationAsset, isTesouroAsset } from "@/domain/portfolio/valuation";
import { type CanonicalFxMetadata } from "@/domain/portfolio/canonical-types";
import { type PortfolioMonthlySeriesPoint } from "@/domain/portfolio/summary";
import { type TwrConsolidatedResult } from "@/domain/portfolio/twr";
import type {
  TearSheetClassGroup,
  TearSheetPerformancePoint,
  WealthPositionRow,
} from "./tear-sheet-types";

const CLASS_TOKEN_COLORS: Record<string, string> = {
  acao: "hsl(var(--primary-strong))",
  acoes: "hsl(var(--primary-strong))",
  "acoes brasil": "hsl(var(--primary-strong))",
  fii: "hsl(var(--accent))",
  fiis: "hsl(var(--accent))",
  "fundos imobiliarios": "hsl(var(--accent))",
  etf: "hsl(var(--cat-1))",
  etfs: "hsl(var(--cat-1))",
  "renda fixa": "hsl(var(--cat-7))",
  renda_fixa: "hsl(var(--cat-7))",
  "renda fixa & titulos publicos": "hsl(var(--cat-7))",
  tesouro: "hsl(var(--cat-7))",
  "tesouro direto": "hsl(var(--cat-7))",
  internacional: "hsl(var(--portfolio))",
  "internacional global": "hsl(var(--portfolio))",
  "internacional & etfs globais": "hsl(var(--portfolio))",
  global: "hsl(var(--portfolio))",
  cripto: "hsl(var(--cat-5))",
  caixa: "hsl(var(--cat-2))",
  "reserva de caixa": "hsl(var(--cat-2))",
  "caixa / reserva": "hsl(var(--cat-2))",
  outros: "hsl(var(--cat-10))",
};

export const SECTOR_TOKEN_PALETTE: readonly string[] = [
  "hsl(var(--primary-strong))",
  "hsl(var(--accent))",
  "hsl(var(--cat-1))",
  "hsl(var(--cat-7))",
  "hsl(var(--cat-5))",
  "hsl(var(--cat-4))",
  "hsl(var(--portfolio))",
  "hsl(var(--cat-2))",
  "hsl(var(--cat-3))",
  "hsl(var(--cat-6))",
  "hsl(var(--cat-8))",
  "hsl(var(--cat-9))",
  "hsl(var(--cat-10))",
];

const CLASS_SORT_ORDER = [
  "acoes",
  "acao",
  "fiis",
  "fii",
  "internacional",
  "global",
  "renda fixa",
  "renda_fixa",
  "tesouro",
  "outros",
];

function normalizeClassKey(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function resolveAssetClassTokenColor(assetClass: string): string {
  if (!assetClass) return "hsl(var(--cat-10))";
  const lower = assetClass.toLowerCase().trim();
  const norm = normalizeClassKey(assetClass);

  if (CLASS_TOKEN_COLORS[lower]) return CLASS_TOKEN_COLORS[lower];
  if (CLASS_TOKEN_COLORS[norm]) return CLASS_TOKEN_COLORS[norm];

  // Heurística de correspondência canônica por família de ativo
  if (norm.includes("fii") || norm.includes("imobili")) {
    return "hsl(var(--accent))";
  }
  if (norm.includes("acao") || norm.includes("acoes") || norm.includes("stock_br") || norm.includes("equity")) {
    return "hsl(var(--primary-strong))";
  }
  if (norm.includes("internac") || norm.includes("global") || norm.includes("exterior") || norm.includes("stock_intl")) {
    return "hsl(var(--portfolio))";
  }
  if (norm.includes("caixa") || norm.includes("reserva") || norm.includes("liquidez") || norm.includes("cash")) {
    return "hsl(var(--cat-2))";
  }
  if (
    norm.includes("fixa") ||
    norm.includes("tesouro") ||
    norm.includes("cdb") ||
    norm.includes("lci") ||
    norm.includes("lca") ||
    norm.includes("cri") ||
    norm.includes("cra") ||
    norm.includes("debenture")
  ) {
    return "hsl(var(--cat-7))";
  }
  if (norm.includes("cripto") || norm.includes("btc") || norm.includes("crypto") || norm.includes("bitcoin")) {
    return "hsl(var(--cat-5))";
  }
  if (norm.includes("etf")) {
    return "hsl(var(--cat-1))";
  }

  return "hsl(var(--cat-10))";
}

export function buildPerformanceSeries(
  portfolioTwr?: TwrConsolidatedResult,
  monthlySeries?: readonly PortfolioMonthlySeriesPoint[],
): TearSheetPerformancePoint[] {
  if (portfolioTwr?.series && portfolioTwr.series.length >= 2) {
    return portfolioTwr.series.map((item) => {
      const [y, m] = item.month.split("-");
      return {
        month: item.month,
        monthLabel: y && m ? `${m}/${y.slice(2)}` : item.month,
        patrimonyBRL: item.totalValueBRL,
        ratePct: item.monthRatePct,
      };
    });
  }

  if (monthlySeries && monthlySeries.length >= 2) {
    return monthlySeries.map((item) => {
      const [y, m] = item.month.split("-");
      return {
        month: item.month,
        monthLabel: y && m ? `${m}/${y.slice(2)}` : item.month,
        patrimonyBRL: item.valueBRL,
        ratePct: item.twrMonthPct ?? 0,
        dividendsBRL: item.monthDividendsBRL,
        costBRL: item.costBRL,
      };
    });
  }

  return [];
}

export function buildClassTableGroups(
  activeInvestmentRows: readonly WealthPositionRow[],
  totalBRL: number,
  cashBRL?: number,
  usdRate?: number,
  fxMetadata?: CanonicalFxMetadata | null,
  staleGuard?: StaleQuoteGuardResult | null,
): TearSheetClassGroup[] {
  const groups = new Map<string, WealthPositionRow[]>();
  for (const row of activeInvestmentRows) {
    const cls = row.assetClass || "Outros";
    const list = groups.get(cls) ?? [];
    list.push(row);
    groups.set(cls, list);
  }

  const groupsResult = Array.from(groups.entries())
    .sort(([clsA], [clsB]) => {
      const normA = normalizeClassKey(clsA);
      const normB = normalizeClassKey(clsB);
      const idxA = CLASS_SORT_ORDER.findIndex((prefix) => normA.includes(prefix));
      const idxB = CLASS_SORT_ORDER.findIndex((prefix) => normB.includes(prefix));
      return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
    })
    .map(([assetClass, items]) => {
      const subtotalBRL = items.reduce((acc, i) => acc + i.valueBRL, 0);

      const resolveItemCost = (i: WealthPositionRow): number => {
        if (i.totalCostBRL !== undefined && i.totalCostBRL !== null && i.totalCostBRL > 0) {
          return i.totalCostBRL;
        }
        const anyCost = (i as unknown as { costBRL?: number }).costBRL;
        if (anyCost !== undefined && anyCost !== null && anyCost > 0) {
          return anyCost;
        }
        if (i.currency === "USD") {
          return Math.max(0, i.valueBRL - (i.unrealizedPnlBRL ?? 0));
        }
        const avg = i.averagePrice || (i as unknown as { avgPriceBRL?: number }).avgPriceBRL;
        if (avg && avg > 0 && i.quantity > 0) {
          return avg * i.quantity;
        }
        if (i.unrealizedPnlBRL !== undefined) {
          return Math.max(0, i.valueBRL - i.unrealizedPnlBRL);
        }
        return i.valueBRL;
      };

      const subtotalCostBRL = items.reduce((acc, i) => acc + Math.max(0, resolveItemCost(i)), 0);
      const subtotalPnlBRL = items.reduce((acc, i) => {
        if (i.unrealizedPnlBRL !== undefined) return acc + i.unrealizedPnlBRL;
        const cost = resolveItemCost(i);
        return acc + (i.valueBRL - cost);
      }, 0);
      const subtotalDividendsBRL = items.reduce((acc, i) => acc + (i.dividendsBRL ?? 0), 0);
      const subtotalTotalReturnBRL = subtotalPnlBRL + subtotalDividendsBRL;
      const subtotalTotalReturnPct = subtotalCostBRL > 0 ? (subtotalTotalReturnBRL / subtotalCostBRL) * 100 : 0;
      const subtotalUnrealizedPct = subtotalCostBRL > 0 ? (subtotalPnlBRL / subtotalCostBRL) * 100 : 0;
      const pctOfTotal = totalBRL > 0 ? (subtotalBRL / totalBRL) * 100 : 0;

      const isInternacional =
        assetClass.toLowerCase().includes("internacional") ||
        assetClass.toLowerCase().includes("global");

      let subtotalPriceVarPctUSD: number | undefined;
      let effectiveGroupUsdRate: number | undefined = usdRate;

      if (isInternacional) {
        const usdItems = items.filter((i) => i.currency === "USD");
        const totalUsdVal = usdItems.reduce((acc, i) => {
          const pr = i.currentPrice || (i as unknown as { priceBRL?: number }).priceBRL || (i.quantity > 0 ? i.valueBRL / i.quantity : 0);
          return acc + (i.quantity * pr);
        }, 0);
        const totalUsdCost = usdItems.reduce((acc, i) => {
          const avg = i.averagePrice || (i as unknown as { avgPriceBRL?: number }).avgPriceBRL || 0;
          return acc + (i.totalCostUSD ?? (i.quantity * avg));
        }, 0);
        if (totalUsdCost > 0) {
          subtotalPriceVarPctUSD = ((totalUsdVal - totalUsdCost) / totalUsdCost) * 100;
        }
        if (!effectiveGroupUsdRate) {
          effectiveGroupUsdRate = usdItems.find((i) => i.usdRate && i.usdRate > 0)?.usdRate;
        }
      }

      const sortedItems = [...items].sort((a, b) => b.valueBRL - a.valueBRL);
      const topItem = sortedItems[0];
      const effectiveFxLabel = fxMetadata ? formatFxSourceLabel(fxMetadata) : undefined;

      return {
        className: assetClass,
        color: resolveAssetClassTokenColor(assetClass),
        totalCents: numberToCents(subtotalBRL),
        sharePct: pctOfTotal,
        pnlPct: subtotalTotalReturnPct,
        subtotalPriceVarPct: subtotalUnrealizedPct,
        subtotalPriceVarPctUSD,
        usdRate: effectiveGroupUsdRate,
        fxSourceLabel: effectiveFxLabel,
        totalCostCents: numberToCents(subtotalCostBRL),
        totalDividendsCents: numberToCents(subtotalDividendsBRL),
        topAssetTicker: topItem?.ticker,
        topAssetSharePct: subtotalBRL > 0 && topItem ? (topItem.valueBRL / subtotalBRL) * 100 : undefined,
        items: items.map((r) => {
          const isUsd = r.currency === "USD";
          const effectiveCost = resolveItemCost(r);
          const effectiveCurrentPrice =
            r.currentPrice ||
            (r as unknown as { priceBRL?: number }).priceBRL ||
            (r.quantity > 0 ? r.valueBRL / r.quantity : 0);
          const effectiveAvgPrice =
            r.averagePrice ||
            (r as unknown as { avgPriceBRL?: number }).avgPriceBRL ||
            (r.quantity > 0 && effectiveCost > 0 ? effectiveCost / r.quantity : 0);

          const nativePriceVarPct =
            r.pricePnlPctUSD !== undefined && r.pricePnlPctUSD !== null
              ? r.pricePnlPctUSD
              : isUsd && effectiveAvgPrice > 0 && effectiveCurrentPrice > 0
                ? ((effectiveCurrentPrice - effectiveAvgPrice) / effectiveAvgPrice) * 100
                : r.unrealizedPnlPct !== undefined
                  ? r.unrealizedPnlPct
                  : effectiveCost > 0
                    ? ((r.valueBRL - effectiveCost) / effectiveCost) * 100
                    : 0;

          const itemTotalReturnPct =
            r.totalReturnPct !== undefined && r.totalReturnPct !== null
              ? r.totalReturnPct
              : r.unrealizedPnlPct !== undefined
                ? r.unrealizedPnlPct
                : effectiveCost > 0
                  ? ((r.valueBRL - effectiveCost + (r.dividendsBRL ?? r.yearDividendsBRL ?? 0)) / effectiveCost) * 100
                  : 0;

          const tickerUpper = r.ticker.trim().toUpperCase();
          const staleIssue = staleGuard?.issueByTicker[tickerUpper];
          const isExemptCustomOrFixed =
            r.isCash ||
            r.pricingMode === "cash" ||
            r.pricingMode === "total_value" ||
            r.fixedIncomeMetadata != null ||
            r.canonicalSource === "custom_valuation" ||
            isCustomValuationAsset({
              ticker: r.ticker,
              asset_class: r.assetClass,
              notes: r.notes ?? null,
            }) ||
            isTesouroAsset(r.ticker, r.assetClass);
          const quoteStatusFlag =
            r.source === "manual"
              ? ("manual" as const)
              : isExemptCustomOrFixed
                ? null
                : staleIssue?.kind === "post_trade_stale" || staleIssue?.kind === "stale_market_data"
                  ? ("stale" as const)
                  : r.isEstimate || r.source === "fallback" || staleIssue?.kind === "missing_or_fallback"
                    ? ("fallback" as const)
                    : null;

          return {
            ticker: r.ticker,
            name: r.name,
            sector: r.sector,
            quantity: r.quantity,
            avgPriceCents: numberToCents(effectiveAvgPrice),
            currentPriceCents: numberToCents(effectiveCurrentPrice),
            totalCents: numberToCents(r.valueBRL),
            pricePnlPct: nativePriceVarPct,
            pnlPct: itemTotalReturnPct,
            dividendsCents: numberToCents(r.dividendsBRL ?? r.yearDividendsBRL ?? 0),
            yocPct: r.yocPct,
            currency: r.currency,
            score: r.score,
            status: r.allocationStatus ?? "active",
            indexType: r.indexType,
            maturityDate: r.maturityDate,
            quoteStatusFlag,
            marketPriceAt: r.marketPriceAt ?? null,
          };
        }),
      };
    });

  if (cashBRL && cashBRL > 0) {
    groupsResult.push({
      className: "Reserva de Caixa",
      color: resolveAssetClassTokenColor("Caixa / Reserva"),
      totalCents: numberToCents(cashBRL),
      sharePct: totalBRL > 0 ? (cashBRL / totalBRL) * 100 : 0,
      pnlPct: 0,
      subtotalPriceVarPct: 0,
      subtotalPriceVarPctUSD: undefined,
      usdRate: undefined,
      fxSourceLabel: undefined,
      totalCostCents: numberToCents(cashBRL),
      totalDividendsCents: 0,
      topAssetTicker: "CAIXA",
      topAssetSharePct: 100,
      items: [
        {
          ticker: "CAIXA",
          name: "Disponibilidades em Moeda Corrente",
          sector: "Liquidez Imediata",
          quantity: cashBRL,
          avgPriceCents: 100,
          currentPriceCents: 100,
          totalCents: numberToCents(cashBRL),
          pricePnlPct: 0,
          pnlPct: 0,
          dividendsCents: 0,
          yocPct: 0,
          currency: "BRL",
          status: "ativo",
          score: null,
          indexType: null,
          maturityDate: null,
          quoteStatusFlag: null,
          marketPriceAt: null,
        },
      ],
    });
  }

  return groupsResult;
}
