import { useCallback, useMemo } from "react";
import { calculateBusinessDre } from "@/domain/business";
import {
  buildFinancialDRE,
  buildReportFreedomAnalysis,
  computeConsolidatedBalanceSheet,
  sumContributionsInPeriod,
} from "@/domain/reports";
import { useSafeBusinessMode } from "@/hooks/use-safe-business-scope";
import { BUSINESS_PROFILE_LABELS } from "@/lib/labels";
import type { ExcelBusinessDreData } from "@/services/excel-export";
import { useFinanceReportData } from "./use-finance-report-data";
import { useInvestmentReportData } from "./use-investment-report-data";
import { useReportExcelPayload } from "./use-report-excel-payload";
import { useReportPeriodFilter } from "./use-report-period-filter";
import type { ReportsMainTab } from "./use-report-modals-state";

export type PeriodMode = "month" | "year" | "custom";

export interface UseReportsDataParams {
  hasFinanceFeatures: boolean;
  hasInvestmentsFeature: boolean;
  weightsEnabled: boolean;
  month: string;
  year: number;
  mode: PeriodMode;
  debouncedCustomStart: string;
  debouncedCustomEnd: string;
  customStart?: string;
  customEnd?: string;
  activeTab?: ReportsMainTab;
}

/**
 * Orquestrador unificado de dados dos Relatórios, compondo os 4 sub-hooks coesos:
 * período, finanças/DRE, carteira/alocação e payload Excel multi-abas.
 */
export function useReportsData(params: UseReportsDataParams) {
  const {
    hasFinanceFeatures, hasInvestmentsFeature, weightsEnabled,
    month, year, mode, debouncedCustomStart, debouncedCustomEnd,
    customStart = "", customEnd = "", activeTab,
  } = params;

  const period = useReportPeriodFilter({
    mode, month, year, debouncedCustomStart, debouncedCustomEnd, customStart, customEnd,
  });

  const needsFinance = activeTab !== "investimentos";
  const needsInvestments = activeTab !== "financas";

  const finance = useFinanceReportData({
    enabled: hasFinanceFeatures && needsFinance, weightsEnabled, mode, month, year,
    range: period.range, isYear: period.isYear, isCustom: period.isCustom, customValid: period.customValid,
  });

  const investments = useInvestmentReportData({
    enabled: hasInvestmentsFeature && needsInvestments,
    contributionsEnabled: hasInvestmentsFeature, mode, month, year,
    customValid: period.customValid, debouncedCustomStart, debouncedCustomEnd,
    isCurrentPeriod: period.isCurrentPeriod, selectedYearNum: period.selectedYearNum,
    periodLabel: period.periodLabel, isDateInPeriod: period.isDateInPeriod,
  });

  const periodContribBRL = useMemo(
    () =>
      sumContributionsInPeriod({
        contributions: investments.contributions,
        mode, month, year, customValid: period.customValid,
        startDate: debouncedCustomStart, endDate: debouncedCustomEnd,
      }),
    [investments.contributions, mode, month, year, period.customValid, debouncedCustomStart, debouncedCustomEnd],
  );

  const consolidatedBalance = useMemo(() => {
    const totalInvestmentsOnlyBRL = Math.max(0, investments.totalPatrimonyBRL - investments.cashBalanceBRL);
    const bankCashBRL = (finance.realCashBalanceCents ?? 0) / 100;
    const totalCashBRL = Math.round((investments.cashBalanceBRL + bankCashBRL) * 100) / 100;
    const creditCardInvoicesBRL = Math.round(finance.openInvoicesCents ?? 0) / 100;

    return computeConsolidatedBalanceSheet({
      investmentsMarketValueBRL: totalInvestmentsOnlyBRL,
      investmentsTotalCostBRL: investments.totalInvestedCostBRL,
      cashBalanceBRL: totalCashBRL,
      creditCardInvoicesBRL,
      debts: finance.debts.map((d) => ({
        id: d.id, type: d.type, remainingAmountBRL: d.amount, description: d.name,
      })),
      monthlyIncomesBRL: finance.currentIncomeCents / 100,
      monthlyExpensesBRL: finance.currentExpenseCents / 100,
      monthlyContributionsBRL: periodContribBRL,
    });
  }, [
    investments.totalPatrimonyBRL, investments.cashBalanceBRL, investments.totalInvestedCostBRL,
    finance.realCashBalanceCents, finance.openInvoicesCents,
    finance.debts, finance.currentIncomeCents, finance.currentExpenseCents, periodContribBRL,
  ]);

  const financialDRE = useMemo(
    () =>
      buildFinancialDRE({
        currentIncomeCents: finance.currentIncomeCents,
        currentExpenseCents: finance.currentExpenseCents,
        grossIncomeBrutoCents: finance.grossIncomeBrutoCents,
        totalExpensesBrutoCents: finance.grossExpenseBrutoCents,
        periodContributionsBRL: periodContribBRL,
      }),
    [
      finance.currentIncomeCents, finance.currentExpenseCents,
      finance.grossIncomeBrutoCents, finance.grossExpenseBrutoCents, periodContribBRL,
    ],
  );

  const freedomAnalysis = useMemo(
    () =>
      buildReportFreedomAnalysis({
        yearDividendsBRL: investments.yearDividendsBRL,
        monthlyExpenses: finance.monthlyExpensesData,
        reserveTotalCents: investments.emergencyFund.composition.totalReserveCents,
        cashBalanceBRL: investments.cashBalanceBRL,
        assets: investments.assets,
        usdRate: investments.usdRate,
      }),
    [
      investments.yearDividendsBRL, finance.monthlyExpensesData,
      investments.emergencyFund.composition.totalReserveCents,
      investments.cashBalanceBRL, investments.assets, investments.usdRate,
    ],
  );

  const { isBusinessModeEnabled, businessProfile } = useSafeBusinessMode();

  const businessDreForExcel = useMemo<ExcelBusinessDreData | null>(() => {
    if (!isBusinessModeEnabled || !hasFinanceFeatures) return null;
    const dre = calculateBusinessDre({
      incomes: finance.rawIncomes,
      expenses: finance.rawExpenses,
      debts: finance.rawDebts,
    });
    const profileKind = businessProfile?.profileKind ?? "mei";
    return {
      periodLabel: period.periodLabel,
      profileLabel: BUSINESS_PROFILE_LABELS[profileKind] ?? "MEI",
      grossRevenueBRL: dre.grossRevenueCents / 100,
      operationalCostsBRL: dre.operationalCostsCents / 100,
      operationalProfitBRL: dre.operationalProfitCents / 100,
      fiscalTaxesPaidBRL: dre.fiscalTaxesPaidCents / 100,
      proLaboreWithdrawnBRL: dre.proLaboreWithdrawnCents / 100,
      retainedEarningsBRL: dre.retainedEarningsCents / 100,
      marginPct: dre.marginPct,
    };
  }, [
    isBusinessModeEnabled,
    hasFinanceFeatures,
    finance.rawIncomes,
    finance.rawExpenses,
    finance.rawDebts,
    businessProfile?.profileKind,
    period.periodLabel,
  ]);

  const excel = useReportExcelPayload({
    hasFinanceFeatures, hasInvestmentsFeature, month,
    isCurrentPeriod: period.isCurrentPeriod, isDateInPeriod: period.isDateInPeriod,
    totalPatrimonyBRL: investments.totalPatrimonyBRL, totalInvestedCostBRL: investments.totalInvestedCostBRL,
    cashBalanceBRL: investments.cashBalanceBRL, yearDividendsBRL: investments.yearDividendsBRL,
    usdRate: investments.usdRate, historicalPit: investments.historicalPit,
    positionQuery: investments.positionQuery, positionRows: investments.positionRows,
    assets: investments.assets, dividends: investments.dividends, debts: finance.debts,
    expenses: finance.expenses, incomes: finance.incomes, periodRedemptions: investments.periodRedemptions,
    allocationAnalysis: investments.allocationAnalysis, consolidatedBalance, freedomAnalysis,
    ...(businessDreForExcel ? { businessDre: businessDreForExcel } : {}),
  });

  const needsFinanceLoading = needsFinance;
  const needsInvestmentsLoading = true;
  const loading = (needsFinanceLoading && finance.loading) || (needsInvestmentsLoading && investments.loading);
  const error = (needsFinanceLoading ? finance.error : null) ?? (needsInvestmentsLoading ? investments.error : null);

  const refetchAll = useCallback(async () => {
    await Promise.all([finance.refetchFinance(), investments.refetchInvestments()]);
  }, [finance, investments]);

  return {
    periodLabel: period.periodLabel,
    isCurrentPeriod: period.isCurrentPeriod,
    isDateInPeriod: period.isDateInPeriod,
    loading,
    error,
    expenses: finance.expenses,
    incomes: finance.incomes,
    expenseEntries: finance.expenseEntries,
    incomeEntries: finance.incomeEntries,
    byCategory: finance.byCategory,
    byMethod: finance.byMethod,
    byWeekday: finance.byWeekday,
    byChargeKind: finance.byChargeKind,
    limitsByCategory: finance.limitsByCategory,
    householdSummary: finance.householdSummary,
    grossExpenseBrutoCents: finance.grossExpenseBrutoCents,
    grossIncomeBrutoCents: finance.grossIncomeBrutoCents,
    grossSavingsBrutoCents: finance.grossSavingsBrutoCents,
    grossSavingsRatePercent: finance.grossSavingsRatePercent,
    currentExpenseCents: finance.currentExpenseCents,
    currentIncomeCents: finance.currentIncomeCents,
    hasDualMetrics: finance.hasDualMetrics,
    categories: finance.categories,
    consolidatedBalance,
    financialDRE,
    positionRows: investments.positionRows,
    cashBalanceBRL: investments.cashBalanceBRL,
    totalPatrimonyBRL: investments.totalPatrimonyBRL,
    allocationAnalysis: investments.allocationAnalysis,
    concentrationRisk: investments.concentrationRisk,
    investmentDonutData: investments.investmentDonutData,
    freedomAnalysis,
    buildWorkbookData: excel.buildWorkbookData,
    excelDescription: excel.excelDescription,
    isExcelDisabled: excel.isExcelDisabled,
    positionQuery: investments.positionQuery,
    refetchAll,
    periodFlowSummary: investments.periodFlowSummary,
    periodRedemptions: investments.periodRedemptions,
    yearDividendsBRL: investments.yearDividendsBRL,
    macroIndicatorsQuery: investments.macroIndicatorsQuery,
    assetsQuery: investments.assetsQuery,
    dividends: investments.dividends,
    assets: investments.assets,
    usdRate: investments.usdRate,
    fxMetadata: investments.fxMetadata,
    transactions: investments.transactions,
    businessDreForExcel,
  };
}
