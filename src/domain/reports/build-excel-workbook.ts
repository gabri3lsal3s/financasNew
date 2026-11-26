import { calculatePortfolioQualityScore } from "@/domain/portfolio/allocation";
import { type PointInTimeResult } from "@/domain/portfolio/point-in-time";
import { type XIRRResult } from "@/domain/portfolio/irr";
import { todayISO } from "@/domain/debts/index";
import { formatDateBR } from "@/lib/date";
import type { ExcelBusinessDreData, ExcelWorkbookData } from "@/services/excel-export";
import type { AssetAllocationStatus, Debt, PortfolioAsset, PortfolioDividend } from "@/types";
import type { AllocationAnalysisResult } from "./allocation-gaps";
import type { ConsolidatedBalanceSheetResult } from "./consolidated-balance";
import type { FreedomAnalysisResult } from "./freedom-index";
import type { PeriodRedemptionItem } from "./period-redemptions";

export interface ExcelPositionSourceRow {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  sector?: string | null;
  currency: "BRL" | "USD";
  quantity: number;
  averageCost: number;
  totalCost: number;
  totalCostBRL: number;
  dividends: number;
  dividendsNative?: number;
  priceQuote: number;
  usdRate: number;
  valueBRL: number;
  unrealizedPnl: number;
  unrealizedPct: number | null;
  isCash: boolean;
  score?: number | null;
  allocationStatus?: AssetAllocationStatus | null;
}

export interface BuildReportExcelWorkbookParams {
  month: string;
  isCurrentPeriod: boolean;
  isDateInPeriod: (dateStr: string) => boolean;
  totalPatrimonyBRL: number;
  totalInvestedCostBRL: number;
  cashBalanceBRL: number;
  yearDividendsBRL: number;
  usdRate: number;
  historicalPit: PointInTimeResult | null | undefined;
  positionSummary: {
    unrealizedPnlBRL?: number;
    unrealizedPct?: number | null;
    totalReturnPct?: number | null;
    portfolioIrr?: XIRRResult;
    allTimeEconomicPnlBRL?: number;
  };
  positionRows: readonly ExcelPositionSourceRow[];
  assets: readonly PortfolioAsset[];
  dividends: readonly PortfolioDividend[];
  debts: readonly Debt[];
  periodRedemptions: readonly PeriodRedemptionItem[];
  allocationAnalysis: AllocationAnalysisResult;
  consolidatedBalance: ConsolidatedBalanceSheetResult;
  freedomAnalysis: FreedomAnalysisResult;
  businessDre?: ExcelBusinessDreData | null;
}

/** Constrói o objeto ExcelWorkbookData padronizado para exportação multi-abas (.xlsx). */
export function buildReportExcelWorkbook(
  params: BuildReportExcelWorkbookParams,
): ExcelWorkbookData {
  const {
    month,
    isCurrentPeriod,
    isDateInPeriod,
    totalPatrimonyBRL,
    totalInvestedCostBRL,
    cashBalanceBRL,
    yearDividendsBRL,
    usdRate,
    historicalPit,
    positionSummary,
    positionRows,
    assets,
    dividends,
    debts,
    periodRedemptions,
    allocationAnalysis,
    consolidatedBalance,
    freedomAnalysis,
    businessDre,
  } = params;

  const totalInvestmentsOnlyBRL = Math.max(0, totalPatrimonyBRL - cashBalanceBRL);
  const fallbackUnrealizedPnl = totalInvestmentsOnlyBRL - totalInvestedCostBRL;
  const fallbackUnrealizedPct =
    totalInvestedCostBRL > 0 ? (fallbackUnrealizedPnl / totalInvestedCostBRL) * 100 : 0;

  return {
    appName: "Axir",
    generatedAt: formatDateBR(todayISO()),
    summary: {
      totalPatrimonyBRL,
      totalInvestedCostBRL,
      unrealizedPnlBRL:
        !isCurrentPeriod && historicalPit?.monthlyStatement
          ? historicalPit.monthlyStatement.monthNetPnlBRL
          : (positionSummary.unrealizedPnlBRL ?? fallbackUnrealizedPnl),
      unrealizedPnlPct:
        !isCurrentPeriod && historicalPit?.monthlyStatement?.monthRatePct != null
          ? historicalPit.monthlyStatement.monthRatePct
          : (positionSummary.unrealizedPct ?? fallbackUnrealizedPct),
      totalReturnPct:
        !isCurrentPeriod && historicalPit?.monthlyStatement?.monthRatePct != null
          ? historicalPit.monthlyStatement.monthRatePct
          : positionSummary.totalReturnPct,
      portfolioIrrPct: isCurrentPeriod
        ? (positionSummary.portfolioIrr?.annualizedRatePct ?? null)
        : null,
      allTimeEconomicPnlBRL:
        (isCurrentPeriod ? positionSummary.allTimeEconomicPnlBRL : undefined) ?? undefined,
      cashBalanceBRL,
      yearDividendsBRL,
      freedomPct: freedomAnalysis.freedomPct,
      savingsRatePct: consolidatedBalance.dre.savingsRatePct,
      portfolioQualityScore: calculatePortfolioQualityScore(
        positionRows
          .filter((r) => !r.isCash && r.quantity > 0)
          .map((r) => {
            const a = assets.find(
              (item) =>
                item.id === r.assetId || item.ticker.toUpperCase() === r.ticker.toUpperCase(),
            );
            return {
              score: a?.score ?? r.score ?? null,
              allocation_status: a?.allocation_status ?? r.allocationStatus ?? "active",
              valueBRL: r.valueBRL,
            };
          }),
      ),
    },
    positions: positionRows
      .filter((r) => !r.isCash && r.quantity > 0)
      .map((r) => {
        const effectiveDivs =
          r.currency === "USD"
            ? (r.dividendsNative ?? (r.usdRate && r.usdRate > 0 ? r.dividends / r.usdRate : r.dividends))
            : r.dividends;
        const effectiveCost =
          r.currency === "USD"
            ? (r.totalCost ?? (r.usdRate && r.usdRate > 0 && r.totalCostBRL ? r.totalCostBRL / r.usdRate : r.totalCostBRL))
            : r.totalCostBRL;
        const yoc = effectiveCost > 0 && effectiveDivs > 0 ? (effectiveDivs / effectiveCost) * 100 : 0;
        const asset = assets.find(
          (a) => a.id === r.assetId || a.ticker.toUpperCase() === r.ticker.toUpperCase(),
        );
        return {
          ticker: r.ticker,
          name: r.ticker,
          assetClass: r.assetClass ?? "outros",
          sector: r.sector,
          currency: r.currency ?? "BRL",
          quantity: r.quantity,
          averagePrice: r.averageCost,
          currentPrice: r.priceQuote,
          totalValueBRL: r.valueBRL,
          unrealizedPnlBRL: r.unrealizedPnl,
          unrealizedPnlPct: r.unrealizedPct ?? 0,
          yearDividendsBRL: r.dividends,
          yocPct: yoc,
          score: asset?.score ?? null,
          allocationStatus: asset?.allocation_status ?? "active",
        };
      }),
    dividends: dividends
      .filter((d) => isDateInPeriod(d.date))
      .map((d) => {
        const asset = assets.find((a) => a.id === d.asset_id);
        const rate = asset?.currency === "USD" ? usdRate : 1;
        return {
          date: d.date,
          ticker: asset?.ticker ?? "Ativo",
          assetClass: asset?.asset_class ?? "outros",
          amountBRL: d.amount * rate,
          notes: d.notes,
        };
      }),
    dreMonthly: [
      {
        month,
        grossIncomeBRL: consolidatedBalance.dre.grossIncomeBRL,
        totalExpensesBRL: consolidatedBalance.dre.totalExpensesBRL,
        operationalSavingsBRL: consolidatedBalance.dre.operationalSavingsBRL,
        savingsRatePct: consolidatedBalance.dre.savingsRatePct,
        investedAporteBRL: consolidatedBalance.dre.investedAporteBRL,
        netCashFlowBRL: consolidatedBalance.dre.netCashFlowBRL,
      },
    ],
    debts: debts.map((d) => ({
      description: d.name,
      type: d.type,
      remainingAmountBRL: d.amount,
      totalAmountBRL: d.amount,
      installmentsProgress: d.paid_at ? "Quitada" : "Pendente",
      dueDate: d.due_date,
    })),
    redemptions: periodRedemptions.map((r) => ({
      ticker: r.ticker,
      name: r.name,
      assetClass: r.assetClass,
      sector: r.sector,
      redemptionDate: r.redemptionDate,
      quantity: r.quantity,
      appliedCostBRL: r.appliedCostBRL,
      redeemedValueBRL: r.redeemedValueBRL,
      realizedPnlBRL: r.realizedPnlBRL,
      finalReturnPct: r.finalReturnPct,
    })),
    classTargets: allocationAnalysis.classGaps.map((cg) => ({
      assetClass: cg.assetClass,
      currentBRL: cg.currentBRL,
      currentPct: cg.currentPct,
      targetPct: cg.targetPct,
      gapBRL: cg.gapBRL,
      status:
        cg.gapBRL > 0
          ? "Abaixo da Meta (Aporte Sugerido)"
          : cg.currentPct > cg.targetPct && cg.targetPct > 0
            ? "Acima da Meta"
            : "Em Equilíbrio",
    })),
    ...(businessDre ? { businessDre } : {}),
  };
}
