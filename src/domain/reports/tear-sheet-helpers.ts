import { numberToCents } from "@/domain/money";
import type { PortfolioMonthlySeriesPoint, TwrConsolidatedResult } from "@/domain/portfolio";
import type {
  TearSheetClassGroup,
  TearSheetPerformancePoint,
  WealthPositionRow,
} from "./tear-sheet-types";

const CLASS_TOKEN_COLORS: Record<string, string> = {
  acao: "hsl(var(--primary-strong))",
  acoes: "hsl(var(--primary-strong))",
  fii: "hsl(var(--accent))",
  fiis: "hsl(var(--accent))",
  etf: "hsl(var(--cat-1))",
  etfs: "hsl(var(--cat-1))",
  "renda fixa": "hsl(var(--cat-7))",
  renda_fixa: "hsl(var(--cat-7))",
  tesouro: "hsl(var(--cat-7))",
  internacional: "hsl(var(--portfolio))",
  global: "hsl(var(--portfolio))",
  cripto: "hsl(var(--cat-5))",
  caixa: "hsl(var(--cat-2))",
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
  const lower = assetClass.toLowerCase().trim();
  const norm = normalizeClassKey(assetClass);
  return CLASS_TOKEN_COLORS[lower] ?? CLASS_TOKEN_COLORS[norm] ?? "hsl(var(--cat-10))";
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
      const subtotalCostBRL = items.reduce((acc, i) => {
        const cost =
          i.totalCostBRL !== undefined && i.totalCostBRL !== null && i.totalCostBRL > 0
            ? i.totalCostBRL
            : i.currency === "USD"
              ? i.valueBRL - i.unrealizedPnlBRL
              : i.averagePrice * i.quantity;
        return acc + Math.max(0, cost);
      }, 0);
      const subtotalPnlBRL = items.reduce((acc, i) => acc + i.unrealizedPnlBRL, 0);
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
        const totalUsdVal = usdItems.reduce((acc, i) => acc + i.quantity * i.currentPrice, 0);
        const totalUsdCost = usdItems.reduce((acc, i) => acc + (i.totalCostUSD ?? (i.quantity * i.averagePrice)), 0);
        if (totalUsdCost > 0) {
          subtotalPriceVarPctUSD = ((totalUsdVal - totalUsdCost) / totalUsdCost) * 100;
        }
        if (!effectiveGroupUsdRate) {
          effectiveGroupUsdRate = usdItems.find((i) => i.usdRate && i.usdRate > 0)?.usdRate;
        }
      }

      const sortedItems = [...items].sort((a, b) => b.valueBRL - a.valueBRL);
      const topItem = sortedItems[0];

      return {
        className: assetClass,
        color: resolveAssetClassTokenColor(assetClass),
        totalCents: numberToCents(subtotalBRL),
        sharePct: pctOfTotal,
        pnlPct: subtotalTotalReturnPct,
        subtotalPriceVarPct: subtotalUnrealizedPct,
        subtotalPriceVarPctUSD,
        usdRate: effectiveGroupUsdRate,
        totalCostCents: numberToCents(subtotalCostBRL),
        totalDividendsCents: numberToCents(subtotalDividendsBRL),
        topAssetTicker: topItem?.ticker,
        topAssetSharePct: subtotalBRL > 0 && topItem ? (topItem.valueBRL / subtotalBRL) * 100 : undefined,
        items: items.map((r) => {
          const isUsd = r.currency === "USD";
          const nativePriceVarPct =
            r.pricePnlPctUSD !== undefined && r.pricePnlPctUSD !== null
              ? r.pricePnlPctUSD
              : isUsd && r.averagePrice > 0 && r.currentPrice > 0
                ? ((r.currentPrice - r.averagePrice) / r.averagePrice) * 100
                : r.unrealizedPnlPct;

          return {
            ticker: r.ticker,
            name: r.name,
            sector: r.sector,
            quantity: r.quantity,
            avgPriceCents: numberToCents(r.averagePrice),
            currentPriceCents: numberToCents(r.currentPrice),
            totalCents: numberToCents(r.valueBRL),
            pricePnlPct: nativePriceVarPct,
            pnlPct: r.totalReturnPct !== undefined ? r.totalReturnPct : r.unrealizedPnlPct,
            dividendsCents: numberToCents(r.dividendsBRL ?? r.yearDividendsBRL ?? 0),
            yocPct: r.yocPct,
            currency: r.currency,
            score: r.score,
            status: r.allocationStatus ?? "active",
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
        },
      ],
    });
  }

  return groupsResult;
}
