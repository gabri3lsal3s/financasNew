import { useMemo } from "react";
import {
  buildReportExcelWorkbook,
  type AllocationAnalysisResult,
  type ConsolidatedBalanceSheetResult,
  type FreedomAnalysisResult,
  type PeriodRedemptionItem,
} from "@/domain/reports";
import type { PointInTimeResult } from "@/domain/portfolio";
import type { ExcelWorkbookData } from "@/services/excel-export";
import type { PortfolioPosition, PortfolioPositionRow } from "@/state";
import type { Debt, Expense, Income, PortfolioAsset, PortfolioDividend } from "@/types";

export interface UseReportExcelPayloadParams {
  hasFinanceFeatures: boolean;
  hasInvestmentsFeature: boolean;
  month: string;
  isCurrentPeriod: boolean;
  isDateInPeriod: (dateStr: string) => boolean;
  totalPatrimonyBRL: number;
  totalInvestedCostBRL: number;
  cashBalanceBRL: number;
  yearDividendsBRL: number;
  usdRate: number;
  historicalPit: PointInTimeResult | null | undefined;
  positionQuery: PortfolioPosition;
  positionRows: readonly PortfolioPositionRow[];
  assets: readonly PortfolioAsset[];
  dividends: readonly PortfolioDividend[];
  debts: readonly Debt[];
  expenses: readonly Expense[];
  incomes: readonly Income[];
  periodRedemptions: readonly PeriodRedemptionItem[];
  allocationAnalysis: AllocationAnalysisResult;
  consolidatedBalance: ConsolidatedBalanceSheetResult;
  freedomAnalysis: FreedomAnalysisResult;
}

/**
 * Prepara o payload multi-abas do Caderno Excel (.xlsx) para exportação fiscal e patrimonial.
 */
export function useReportExcelPayload(params: UseReportExcelPayloadParams) {
  const {
    hasFinanceFeatures,
    hasInvestmentsFeature,
    month,
    isCurrentPeriod,
    isDateInPeriod,
    totalPatrimonyBRL,
    totalInvestedCostBRL,
    cashBalanceBRL,
    yearDividendsBRL,
    usdRate,
    historicalPit,
    positionQuery,
    positionRows,
    assets,
    dividends,
    debts,
    expenses,
    incomes,
    periodRedemptions,
    allocationAnalysis,
    consolidatedBalance,
    freedomAnalysis,
  } = params;

  const workbookData: ExcelWorkbookData = useMemo(
    () =>
      buildReportExcelWorkbook({
        month,
        isCurrentPeriod,
        isDateInPeriod,
        totalPatrimonyBRL,
        totalInvestedCostBRL,
        cashBalanceBRL,
        yearDividendsBRL,
        usdRate,
        historicalPit,
        positionSummary: {
          unrealizedPnlBRL: positionQuery.unrealizedPnlBRL,
          unrealizedPct: positionQuery.unrealizedPct,
          totalReturnPct: positionQuery.totalReturnPct,
          portfolioIrr: positionQuery.portfolioIrr,
          allTimeEconomicPnlBRL: positionQuery.allTimeEconomicPnlBRL,
        },
        positionRows,
        assets,
        dividends,
        debts,
        periodRedemptions,
        allocationAnalysis,
        consolidatedBalance,
        freedomAnalysis,
      }),
    [
      month, isCurrentPeriod, isDateInPeriod, totalPatrimonyBRL, totalInvestedCostBRL,
      cashBalanceBRL, yearDividendsBRL, usdRate, historicalPit, positionQuery.unrealizedPnlBRL,
      positionQuery.unrealizedPct, positionQuery.totalReturnPct, positionQuery.portfolioIrr,
      positionQuery.allTimeEconomicPnlBRL, positionRows, assets, dividends, debts,
      periodRedemptions, allocationAnalysis, consolidatedBalance, freedomAnalysis,
    ],
  );

  const excelDescription = useMemo(() => {
    if (!hasFinanceFeatures && hasInvestmentsFeature) {
      return "Exportação completa das abas de Investimentos (Resumo Patrimonial, Custódia de Ativos, Proventos e Fiscal) com formatações e fórmulas nativas.";
    }
    if (hasFinanceFeatures && !hasInvestmentsFeature) {
      return "Exportação completa das abas financeiras (Resumo Financeiro, DRE e Dívidas) com formatações e fórmulas nativas.";
    }
    return "Exportação completa em 5 abas (Resumo Patrimonial, Custódia de Ativos, Proventos, DRE e Dívidas) com formatações e fórmulas nativas.";
  }, [hasFinanceFeatures, hasInvestmentsFeature]);

  const isExcelDisabled = useMemo(() => {
    const hasCustody = (workbookData.positions?.length ?? 0) > 0;
    const hasDividends = (workbookData.dividends?.length ?? 0) > 0;
    return (
      !hasCustody &&
      !hasDividends &&
      expenses.length === 0 &&
      incomes.length === 0 &&
      debts.length === 0 &&
      periodRedemptions.length === 0
    );
  }, [workbookData.positions, workbookData.dividends, expenses.length, incomes.length, debts.length, periodRedemptions.length]);

  return { workbookData, excelDescription, isExcelDisabled };
}
