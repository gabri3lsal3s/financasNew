import { useState, useMemo } from "react";
import { useSearchParams } from "react-router";
import { FileSpreadsheet, Landmark, Scale, TrendingUp } from "lucide-react";
import { Button, ErrorState, Skeleton, Tabs, type TabItem } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { MonthPicker, YearPicker } from "@/components/modules";
import {
  aggregateByCategory,
  aggregateByPaymentMethod,
  aggregateByWeekday,
  calculateAllocationGaps,
  calculateConcentrationRisk,
  calculateFreedomIndex,
  computeConsolidatedBalanceSheet,
  filterPeriodRedemptions,
  buildAllocationDonutSegments,
  validateCustomPeriod,
} from "@/domain/reports";
import { isCashAssetClass } from "@/domain/portfolio";
import { addDaysISO } from "@/domain/debts";
import { currentMonth, currentYear, monthLabel, monthRange, shiftMonth, yearRange } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import {

  useAllocationTargets,
  useCategories,
  useDebts,
  useExpenses,
  useExpensesByRange,
  useGroupTargets,
  useIncomes,
  useIncomesByRange,
  useAllPortfolioTransactions,
  usePortfolioAssets,
  usePortfolioContributions,
  usePortfolioDividends,
  usePortfolioPosition,
  useUserAccess,
  useUserPreferences,
} from "@/state";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { ExpenseDetailDialog } from "@/features/transactions";
import { PortfolioDarfMonitor } from "@/features/investments/components";
import {
  ConsolidatedWealthModal,
  DividendFreedomModal,
  FinancialCloseReportModal,
  ReportDetailDialog,
  TaxFacilitatorModal,
  WealthTearSheetModal,
  FinancialTab,
  InvestmentsTab,
  BalanceTab,
  TaxTab,
  type AggregationTab,
} from "../components";
import type { Expense } from "@/types";
import { numberToCents } from "@/domain/money";
import type { ExcelWorkbookData } from "@/services/excel-export";

type MainTab = "financas" | "investimentos" | "balanco" | "fiscal";
type PeriodMode = "month" | "year" | "custom";

/**
 * Central Unificada de Relatórios & Consultoria Patrimonial (§F42).
 * Hub orquestrador com 4 sub-abas: Finanças, Investimentos, Balanço 360° e Fiscal.
 */
export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabParam = (searchParams.get("aba") as MainTab) || (searchParams.get("tab") as MainTab) || "financas";
  const { hasFeature } = useUserAccess();
  const prefsQuery = useUserPreferences();
  /** Quando false, os pesos de relatório são neutralizados (weight = 1 para todos). */
  const weightsEnabled = prefsQuery.data?.report_weights_enabled ?? true;

  const hasFinanceFeatures =
    hasFeature("transactions") ||
    hasFeature("cards") ||
    hasFeature("overview") ||
    hasFeature("budgets") ||
    hasFeature("debts");
  const hasInvestmentsFeature = hasFeature("investments");

  const availableTabs = useMemo(() => {
    const list: MainTab[] = [];
    if (hasFinanceFeatures) list.push("financas");
    if (hasInvestmentsFeature) list.push("investimentos");
    if (hasFinanceFeatures) list.push("balanco");
    if (hasInvestmentsFeature) list.push("fiscal");
    if (list.length === 0) return ["financas", "investimentos", "balanco", "fiscal"] as MainTab[];
    return list;
  }, [hasFinanceFeatures, hasInvestmentsFeature]);

  const [selectedTab, setSelectedTab] = useState<MainTab>(() => {
    const validValues = new Set(availableTabs);
    if (validValues.has(activeTabParam)) return activeTabParam;
    return availableTabs[0] ?? "financas";
  });

  const validTabValues = useMemo(() => new Set(availableTabs), [availableTabs]);
  const mainTab: MainTab = validTabValues.has(selectedTab)
    ? selectedTab
    : (availableTabs[0] ?? "financas");

  const handleTabChange = (val: string) => {
    const nextTab = val as MainTab;
    setSelectedTab(nextTab);
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev);
      updated.set("aba", nextTab);
      return updated;
    });
  };

  // Filtros de Período da Aba Finanças
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(currentYear());
  const [mode, setMode] = useState<PeriodMode>("month");
  const [aggregationTab, setAggregationTab] = useState<AggregationTab>("category");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [detailModal, setDetailModal] = useState<{
    title: string;
    expenses: Expense[];
  } | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Modais de Dossiê de Consultoria
  const [financialReportOpen, setFinancialReportOpen] = useState(false);
  const [tearSheetOpen, setTearSheetOpen] = useState(false);
  const [dividendFreedomOpen, setDividendFreedomOpen] = useState(false);
  const [consolidatedWealthOpen, setConsolidatedWealthOpen] = useState(false);
  const [taxReportOpen, setTaxReportOpen] = useState(false);
  const [darfMonitorOpen, setDarfMonitorOpen] = useState(false);

  const range =
    mode === "month"
      ? monthRange(month)
      : mode === "year"
        ? yearRange(year)
        : { start: customStart, end: customEnd ? addDaysISO(customEnd, 1) : "" };
  const customValid =
    mode !== "custom" ||
    (customStart !== "" && customEnd !== "" && validateCustomPeriod(customStart, customEnd).ok);

  const isYear = mode === "year";
  const isCustom = mode === "custom";

  // Queries de Finanças
  const monthlyExpenses = useExpenses(month);
  const monthlyIncomes = useIncomes(month);
  const prevExpenses = useExpenses(shiftMonth(month, -1));
  const prevIncomes = useIncomes(shiftMonth(month, -1));

  const yearExpenses = useExpensesByRange(range.start, range.end, { enabled: isYear });
  const yearIncomes = useIncomesByRange(range.start, range.end, { enabled: isYear });
  const prevYearRange = isYear ? yearRange(year - 1) : { start: "", end: "" };
  const prevYearExpenses = useExpensesByRange(prevYearRange.start, prevYearRange.end, { enabled: isYear });
  const prevYearIncomes = useIncomesByRange(prevYearRange.start, prevYearRange.end, { enabled: isYear });

  const rangeExpenses = useExpensesByRange(range.start, range.end, { enabled: isCustom && customValid });
  const rangeIncomes = useIncomesByRange(range.start, range.end, { enabled: isCustom && customValid });
  const debtsQuery = useDebts();
  const categoriesQuery = useCategories();
  const contributionsQuery = usePortfolioContributions();

  // Queries de Investimentos & Patrimônio
  const positionQuery = usePortfolioPosition();
  const assetsQuery = usePortfolioAssets();
  const dividendsQuery = usePortfolioDividends();
  const transactionsQuery = useAllPortfolioTransactions();
  const classTargetsQuery = useGroupTargets("class");
  const sectorTargetsQuery = useGroupTargets("sector");
  const assetTargetsQuery = useAllocationTargets();

  const [expandedTreeClasses, setExpandedTreeClasses] = useState<Set<string>>(() => new Set());
  const [expandedTreeSectors, setExpandedTreeSectors] = useState<Set<string>>(() => new Set());

  const expenses = useMemo(
    () =>
      mode === "month"
        ? monthlyExpenses.data ?? []
        : mode === "year"
          ? yearExpenses.data ?? []
          : customValid
            ? rangeExpenses.data ?? []
            : [],
    [mode, monthlyExpenses.data, yearExpenses.data, customValid, rangeExpenses.data],
  );

  const incomes = useMemo(
    () =>
      mode === "month"
        ? monthlyIncomes.data ?? []
        : mode === "year"
          ? yearIncomes.data ?? []
          : customValid
            ? rangeIncomes.data ?? []
            : [],
    [mode, monthlyIncomes.data, yearIncomes.data, customValid, rangeIncomes.data],
  );

  const loading =
    (mode === "month"
      ? monthlyExpenses.isLoading || monthlyIncomes.isLoading || prevExpenses.isLoading || prevIncomes.isLoading
      : mode === "year"
        ? yearExpenses.isLoading || yearIncomes.isLoading || prevYearExpenses.isLoading || prevYearIncomes.isLoading
        : rangeExpenses.isLoading || rangeIncomes.isLoading) ||
    debtsQuery.isLoading ||
    categoriesQuery.isLoading ||
    positionQuery.isLoading ||
    assetsQuery.isLoading ||
    transactionsQuery.isLoading ||
    sectorTargetsQuery.isLoading;

  const error =
    (mode === "month"
      ? monthlyExpenses.error ?? monthlyIncomes.error ?? prevExpenses.error ?? prevIncomes.error
      : mode === "year"
        ? yearExpenses.error ?? yearIncomes.error ?? prevYearExpenses.error ?? prevYearIncomes.error
        : rangeExpenses.error ?? rangeIncomes.error) ??
    debtsQuery.error ??
    categoriesQuery.error ??
    positionQuery.error ??
    transactionsQuery.error ??
    sectorTargetsQuery.error;

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const debts = useMemo(() => debtsQuery.data ?? [], [debtsQuery.data]);
  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);
  const dividends = useMemo(() => dividendsQuery.data ?? [], [dividendsQuery.data]);
  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);
  const contributions = useMemo(() => contributionsQuery.data ?? [], [contributionsQuery.data]);
  const positionRows = useMemo(() => positionQuery.rows ?? [], [positionQuery.rows]);
  const classTargets = useMemo(() => classTargetsQuery.data ?? [], [classTargetsQuery.data]);
  const sectorTargets = useMemo(
    () =>
      (sectorTargetsQuery.data ?? []).map((st) => ({
        sectorName: st.name,
        targetPercentage: st.target_percentage,
      })),
    [sectorTargetsQuery.data],
  );
  const assetTargets = useMemo(() => assetTargetsQuery.data ?? [], [assetTargetsQuery.data]);

  const totalPatrimonyBRL = positionQuery.totalBRL ?? 0;
  const cashBalanceBRL = positionQuery.cashBRL ?? 0;
  const totalInvestedCostBRL = positionQuery.totalCostBRL ?? 0;

  const usdRate = useMemo(
    () => positionRows.find((r) => r.currency === "USD")?.usdRate ?? 5.25,
    [positionRows],
  );

  const assetCurrencyMap = useMemo(
    () => new Map(assets.map((a) => [a.id, a.currency])),
    [assets],
  );

  const currentYearNum = new Date().getFullYear();
  const yearDividendsBRL = useMemo(() => {
    const tableDivs = dividends
      .filter((d) => d.date.startsWith(String(currentYearNum)))
      .reduce((acc, d) => {
        const curr = d.asset_id ? assetCurrencyMap.get(d.asset_id) : "BRL";
        const rate = curr === "USD" ? usdRate : 1;
        return acc + d.amount * rate;
      }, 0);
    if (tableDivs > 0) return tableDivs;
    return positionQuery.totalDividendsBRL;
  }, [dividends, currentYearNum, positionQuery.totalDividendsBRL, assetCurrencyMap, usdRate]);

  const currentMonthStr = currentMonth();
  const currentMonthFormatted = monthLabel(currentMonthStr);
  const monthTransactions = useMemo(
    () => transactions.filter((t) => t.date.startsWith(currentMonthStr)),
    [transactions, currentMonthStr],
  );
  const monthDividendsList = useMemo(
    () => dividends.filter((d) => d.date.startsWith(currentMonthStr)),
    [dividends, currentMonthStr],
  );
  const monthBuysBRL = useMemo(
    () =>
      monthTransactions
        .filter((t) => t.type === "buy")
        .reduce((acc, t) => {
          const curr = assetCurrencyMap.get(t.asset_id);
          const rate = curr === "USD" ? usdRate : 1;
          const totalVal = t.total ?? (t.quantity * t.price);
          return acc + totalVal * rate;
        }, 0),
    [monthTransactions, assetCurrencyMap, usdRate],
  );
  const monthSellsBRL = useMemo(
    () =>
      monthTransactions
        .filter((t) => t.type === "sell")
        .reduce((acc, t) => {
          const curr = assetCurrencyMap.get(t.asset_id);
          const rate = curr === "USD" ? usdRate : 1;
          const totalVal = t.total ?? (t.quantity * t.price);
          return acc + totalVal * rate;
        }, 0),
    [monthTransactions, assetCurrencyMap, usdRate],
  );
  const monthDividendsAmountBRL = useMemo(
    () =>
      monthDividendsList.reduce((acc, d) => {
        const curr = d.asset_id ? assetCurrencyMap.get(d.asset_id) : "BRL";
        const rate = curr === "USD" ? usdRate : 1;
        return acc + d.amount * rate;
      }, 0),
    [monthDividendsList, assetCurrencyMap, usdRate],
  );
  const monthNetFlowBRL = monthBuysBRL - monthSellsBRL + monthDividendsAmountBRL;

  const monthFlowSummary = useMemo(
    () => ({
      buysBRL: monthBuysBRL,
      sellsBRL: monthSellsBRL,
      dividendsBRL: monthDividendsAmountBRL,
      netFlowBRL: monthNetFlowBRL,
      monthLabel: currentMonthFormatted,
    }),
    [monthBuysBRL, monthSellsBRL, monthDividendsAmountBRL, monthNetFlowBRL, currentMonthFormatted],
  );

  const periodRedemptions = useMemo(() => {
    return filterPeriodRedemptions({
      transactions,
      assets,
      mode,
      month,
      year,
      startDate: customValid ? customStart : undefined,
      endDate: customValid ? customEnd : undefined,
      usdRate,
    });
  }, [
    transactions,
    assets,
    mode,
    month,
    year,
    customValid,
    customStart,
    customEnd,
    usdRate,
  ]);

  // Cálculos de Consultoria de Investimentos
  const allocationAnalysis = useMemo(() => {
    return calculateAllocationGaps(
      positionRows.map((r) => ({
        id: r.assetId ?? r.ticker,
        ticker: r.ticker,
        assetClass: r.assetClass ?? "outros",
        sector: r.sector,
        valueBRL: r.valueBRL,
        isCash: isCashAssetClass(r.assetClass),
      })),
      classTargets.map((ct) => ({ assetClass: ct.name, targetPercentage: ct.target_percentage })),
      assetTargets.map((at) => ({ assetId: at.asset_id, targetPercentage: at.target_percentage })),
      sectorTargets,
    );
  }, [positionRows, classTargets, assetTargets, sectorTargets]);

  const concentrationRisk = useMemo(() => {
    return calculateConcentrationRisk(
      positionRows.map((r) => ({
        id: r.assetId ?? r.ticker,
        ticker: r.ticker,
        assetClass: r.assetClass ?? "outros",
        sector: r.sector,
        currency: (r.currency as "BRL" | "USD") ?? "BRL",
        valueBRL: r.valueBRL,
        isCash: isCashAssetClass(r.assetClass),
      })),
    );
  }, [positionRows]);

  const investmentDonutData = useMemo(() => {
    return buildAllocationDonutSegments({
      positions: positionRows
        .filter((r) => !r.isCash && r.quantity > 0)
        .map((r) => ({
          assetClass: r.assetClass,
          sector: r.sector,
          valueBRL: r.valueBRL,
        })),
      cashBalanceBRL,
      includeCash: cashBalanceBRL > 0,
    });
  }, [positionRows, cashBalanceBRL]);

  const freedomAnalysis = useMemo(() => {
    const monthlyDivs = yearDividendsBRL > 0 ? yearDividendsBRL / 12 : 0;
    const monthlyExp =
      monthlyExpenses.data && monthlyExpenses.data.length > 0
        ? monthlyExpenses.data.reduce((acc, e) => acc + e.value, 0)
        : 3000;

    return calculateFreedomIndex(
      monthlyDivs,
      monthlyExp,
      cashBalanceBRL,
      assets.map((a) => {
        const isUSD = a.currency === "USD";
        const rate = isUSD ? usdRate : 1;
        const avgPrice = a.quantity > 0 && a.average_price > 0 ? a.average_price : 10;
        return {
          ticker: a.ticker,
          currentPriceBRL: avgPrice * rate,
          monthlyDividendPerShareBRL: (a.estimated_monthly_dividend_per_share ?? 0) * rate,
          quantity: a.quantity,
        };
      }),
    );
  }, [yearDividendsBRL, monthlyExpenses.data, cashBalanceBRL, assets, usdRate]);

  const periodLabel = useMemo(() => {
    if (mode === "month") {
      const parts = month.split("-");
      const y = parts[0];
      const m = parts[1];
      if (y && m) {
        const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        const monthName = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        return monthName.charAt(0).toUpperCase() + monthName.slice(1);
      }
      return month;
    }
    if (mode === "year") {
      return `Exercício de ${year}`;
    }
    if (customStart && customEnd) {
      return `${customStart} a ${customEnd}`;
    }
    return "Período Personalizado";
  }, [mode, month, year, customStart, customEnd]);

  // Conversão de dados da aba finanças
  const expenseEntries = useMemo(() => {
    return expenses.map((item) => {
      const cat = categoryById.get(item.category_id);
      return {
        id: item.id,
        date: item.date,
        kind: "expense" as const,
        categoryId: item.category_id,
        categoryName: cat?.name ?? "Sem categoria",
        categoryIcon: cat?.icon,
        paymentMethod: item.payment_method,
        baseCents: numberToCents(item.value),
        weight: weightsEnabled ? item.report_weight : 1,
      };
    });
  }, [expenses, categoryById, weightsEnabled]);

  const incomeEntries = useMemo(() => {
    return incomes.map((item) => {
      const cat = categoryById.get(item.category_id);
      return {
        id: item.id,
        date: item.date,
        kind: "income" as const,
        categoryId: item.category_id,
        categoryName: cat?.name ?? "Sem categoria",
        categoryIcon: cat?.icon,
        paymentMethod: undefined,
        baseCents: numberToCents(item.value),
        weight: weightsEnabled ? item.report_weight : 1,
      };
    });
  }, [incomes, categoryById, weightsEnabled]);

  const byCategory = useMemo(() => aggregateByCategory(expenseEntries), [expenseEntries]);
  const byMethod = useMemo(() => aggregateByPaymentMethod(expenseEntries), [expenseEntries]);
  const byWeekday = useMemo(() => aggregateByWeekday(expenseEntries), [expenseEntries]);

  const grossExpenseBrutoCents = useMemo(
    () => expenseEntries.reduce((acc, e) => acc + e.baseCents, 0),
    [expenseEntries],
  );
  const grossIncomeBrutoCents = useMemo(
    () => incomeEntries.reduce((acc, e) => acc + e.baseCents, 0),
    [incomeEntries],
  );
  const grossSavingsBrutoCents = grossIncomeBrutoCents - grossExpenseBrutoCents;
  const grossSavingsRatePercent =
    grossIncomeBrutoCents > 0 ? (grossSavingsBrutoCents / grossIncomeBrutoCents) * 100 : null;

  const currentExpenseCents = useMemo(
    () => expenseEntries.reduce((acc, e) => acc + e.baseCents * e.weight, 0),
    [expenseEntries],
  );
  const currentIncomeCents = useMemo(
    () => incomeEntries.reduce((acc, e) => acc + e.baseCents * e.weight, 0),
    [incomeEntries],
  );

  const hasDualMetrics =
    weightsEnabled &&
    (grossIncomeBrutoCents !== currentIncomeCents || grossExpenseBrutoCents !== currentExpenseCents);

  const consolidatedBalance = useMemo(() => {

    const curMonthIncomeBRL = currentIncomeCents / 100;
    const curMonthExpenseBRL = currentExpenseCents / 100;
    const curMonthContrib = contributions
      .filter((c) => {
        if (mode === "month") return c.date.startsWith(month);
        if (mode === "year") return c.date.startsWith(String(year));
        if (customValid && customStart && customEnd) return c.date >= customStart && c.date <= customEnd;
        return c.date.startsWith(month);
      })
      .reduce((acc, c) => acc + c.amount, 0);

    const totalInvestmentsOnlyBRL = Math.max(0, totalPatrimonyBRL - cashBalanceBRL);

    return computeConsolidatedBalanceSheet({
      investmentsMarketValueBRL: totalInvestmentsOnlyBRL,
      investmentsTotalCostBRL: totalInvestedCostBRL,
      cashBalanceBRL: cashBalanceBRL,
      debts: debts.map((d) => ({
        id: d.id,
        type: d.type,
        remainingAmountBRL: d.amount,
        description: d.name,
      })),
      monthlyIncomesBRL: curMonthIncomeBRL,
      monthlyExpensesBRL: curMonthExpenseBRL,
      monthlyContributionsBRL: curMonthContrib,
    });
  }, [totalPatrimonyBRL, totalInvestedCostBRL, cashBalanceBRL, debts, currentIncomeCents, currentExpenseCents, contributions, mode, month, year, customValid, customStart, customEnd]);

  const financialDRE = useMemo(() => {
    const grossIncomeCents = currentIncomeCents;
    const totalExpensesCents = currentExpenseCents;
    const operationalSavingsCents = grossIncomeCents - totalExpensesCents;
    const savingsRatePct =
      grossIncomeCents > 0 ? (operationalSavingsCents / grossIncomeCents) * 100 : 0;

    const periodContribBRL = contributions
      .filter((c) => {
        if (mode === "month") return c.date.startsWith(month);
        if (mode === "year") return c.date.startsWith(String(year));
        if (customValid && customStart && customEnd)
          return c.date >= customStart && c.date <= customEnd;
        return c.date.startsWith(month);
      })
      .reduce((acc, c) => acc + c.amount, 0);

    const investedAporteCents = numberToCents(periodContribBRL);
    const netCashFlowCents = operationalSavingsCents - investedAporteCents;

    const grossIncomeBrutoCentsVal = incomes.reduce((acc, i) => acc + numberToCents(i.value), 0);
    const totalExpensesBrutoCentsVal = expenses.reduce((acc, e) => acc + numberToCents(e.value), 0);

    return {
      grossIncomeCents,
      totalExpensesCents,
      operationalSavingsCents,
      savingsRatePct,
      investedAporteCents,
      netCashFlowCents,
      grossIncomeBrutoCents: grossIncomeBrutoCentsVal,
      totalExpensesBrutoCents: totalExpensesBrutoCentsVal,
    };
  }, [
    currentIncomeCents,
    currentExpenseCents,
    contributions,
    mode,
    month,
    year,
    customValid,
    customStart,
    customEnd,
    incomes,
    expenses,
  ]);

  // Estrutura Completa do Caderno Excel
  const workbookData: ExcelWorkbookData = useMemo(() => {
    const totalInvestmentsOnlyBRL = Math.max(0, totalPatrimonyBRL - cashBalanceBRL);
    const fallbackUnrealizedPnl = totalInvestmentsOnlyBRL - totalInvestedCostBRL;
    const fallbackUnrealizedPct = totalInvestedCostBRL > 0 ? (fallbackUnrealizedPnl / totalInvestedCostBRL) * 100 : 0;

    return {
      appName: "Finanças & Investimentos",
      generatedAt: new Date().toLocaleDateString("pt-BR"),
      summary: {
        totalPatrimonyBRL,
        totalInvestedCostBRL,
        unrealizedPnlBRL: positionQuery.unrealizedPnlBRL ?? fallbackUnrealizedPnl,
        unrealizedPnlPct: positionQuery.unrealizedPct ?? fallbackUnrealizedPct,
        totalReturnPct: positionQuery.totalReturnPct,
        portfolioIrrPct: positionQuery.portfolioIrr?.annualizedRatePct ?? null,
        allTimeEconomicPnlBRL: positionQuery.allTimeEconomicPnlBRL,
        cashBalanceBRL,
        yearDividendsBRL,
        freedomPct: freedomAnalysis.freedomPct,
        savingsRatePct: consolidatedBalance.dre.savingsRatePct,
      },
      positions: positionRows
        .filter((r) => !r.isCash && r.quantity > 0)
        .map((r) => {
          const yoc = r.totalCostBRL > 0 ? (r.dividends / r.totalCostBRL) * 100 : 0;
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
          };
        }),
      dividends: dividends.map((d) => {
        const asset = assets.find((a) => a.id === d.asset_id);
        const isUSD = asset?.currency === "USD";
        const rate = isUSD ? usdRate : 1;
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
    };
  }, [
    totalPatrimonyBRL,
    totalInvestedCostBRL,
    cashBalanceBRL,
    yearDividendsBRL,
    positionQuery.unrealizedPnlBRL,
    positionQuery.unrealizedPct,
    positionQuery.totalReturnPct,
    positionQuery.portfolioIrr,
    positionQuery.allTimeEconomicPnlBRL,
    freedomAnalysis.freedomPct,
    consolidatedBalance.dre,
    positionRows,
    dividends,
    assets,
    month,
    debts,
    periodRedemptions,
    allocationAnalysis.classGaps,
    usdRate,
  ]);

  const excelDescription = useMemo(() => {
    if (!hasFinanceFeatures && hasInvestmentsFeature) {
      return "Exportação completa das abas de Investimentos (Resumo Patrimonial, Custódia de Ativos, Proventos e Fiscal) com formatações e fórmulas nativas.";
    }
    if (hasFinanceFeatures && !hasInvestmentsFeature) {
      return "Exportação completa das abas financeiras (Resumo Financeiro, DRE e Dívidas) com formatações e fórmulas nativas.";
    }
    return "Exportação completa em 5 abas (Resumo Patrimonial, Custódia de Ativos, Proventos, DRE e Dívidas) com formatações e fórmulas nativas.";
  }, [hasFinanceFeatures, hasInvestmentsFeature]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 w-full min-w-0">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 w-full min-w-0">
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => {
            void Promise.all([
              monthlyExpenses.refetch(),
              monthlyIncomes.refetch(),
              prevExpenses.refetch(),
              prevIncomes.refetch(),
              yearExpenses.refetch(),
              yearIncomes.refetch(),
              debtsQuery.refetch(),
              categoriesQuery.refetch(),
              positionQuery.refetch(),
              assetsQuery.refetch(),
            ]);
          }}
        />
      </div>
    );
  }

  const tabItems: TabItem[] = [
    ...(hasFinanceFeatures
      ? [
          {
            value: "financas",
            label: "Finanças & DRE",
            shortLabel: "Finanças",
            icon: <Landmark className="size-4" aria-hidden="true" />,
            content: (
              <FinancialTab
                grossIncomeBrutoCents={grossIncomeBrutoCents}
                grossExpenseBrutoCents={grossExpenseBrutoCents}
                grossSavingsBrutoCents={grossSavingsBrutoCents}
                grossSavingsRatePercent={grossSavingsRatePercent}
                currentIncomeCents={currentIncomeCents}
                currentExpenseCents={currentExpenseCents}
                hasDualMetrics={hasDualMetrics}
                aggregationTab={aggregationTab}
                setAggregationTab={setAggregationTab}
                byCategory={byCategory}
                byMethod={byMethod}
                byWeekday={byWeekday}
                expenses={expenses}
                onOpenFinancialReport={() => setFinancialReportOpen(true)}
                onShowDetail={(title, expenseList) => setDetailModal({ title, expenses: expenseList })}
              />
            ),
          },
        ]
      : []),
    ...(hasInvestmentsFeature
      ? [
          {
            value: "investimentos",
            label: "Investimentos & Carteira",
            shortLabel: "Investimentos",
            icon: <TrendingUp className="size-4" aria-hidden="true" />,
            content: (
              <InvestmentsTab
                totalPatrimonyBRL={totalPatrimonyBRL}
                allocationAnalysis={allocationAnalysis}
                concentrationRisk={concentrationRisk}
                classSegments={investmentDonutData.classSegments}
                sectorSegments={investmentDonutData.sectorSegments}
                totalUniqueSectors={investmentDonutData.totalUniqueSectors}
                expandedTreeClasses={expandedTreeClasses}
                setExpandedTreeClasses={setExpandedTreeClasses}
                expandedTreeSectors={expandedTreeSectors}
                setExpandedTreeSectors={setExpandedTreeSectors}
                onOpenTearSheet={() => setTearSheetOpen(true)}
              />
            ),
          },
        ]
      : []),
    ...(hasFinanceFeatures
      ? [
          {
            value: "balanco",
            label: "Balanço & Liberdade",
            shortLabel: "Balanço",
            icon: <Scale className="size-4" aria-hidden="true" />,
            content: (
              <BalanceTab
                consolidatedBalance={consolidatedBalance}
                freedomAnalysis={freedomAnalysis}
                onOpenConsolidatedWealth={() => setConsolidatedWealthOpen(true)}
                onOpenDividendFreedom={() => setDividendFreedomOpen(true)}
              />
            ),
          },
        ]
      : []),
    ...(hasInvestmentsFeature
      ? [
          {
            value: "fiscal",
            label: "Fiscal & Declaração",
            shortLabel: "Fiscal",
            icon: <FileSpreadsheet className="size-4" aria-hidden="true" />,
            content: (
              <TaxTab
                workbookData={workbookData}
                excelDescription={excelDescription}
                onOpenTaxReport={() => setTaxReportOpen(true)}
                onOpenDarfMonitor={() => setDarfMonitorOpen(true)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Relatórios
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Dossiês executivos, DRE pessoal, consolidação patrimonial e inteligência fiscal
          </p>
        </div>
      </header>

      {/* Seletor Global de Período — Compartilhado por todas as abas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface/90 p-3 sm:p-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="grid grid-cols-3 sm:flex items-center gap-1.5 w-full sm:w-auto">
            <Button
              type="button"
              variant={mode === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("month")}
              className="w-full sm:w-auto justify-center px-2 sm:px-3 text-xs"
            >
              Mensal
            </Button>
            <Button
              type="button"
              variant={mode === "year" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("year")}
              className="w-full sm:w-auto justify-center px-2 sm:px-3 text-xs"
            >
              Anual
            </Button>
            <Button
              type="button"
              variant={mode === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("custom")}
              className="w-full sm:w-auto justify-center px-2 sm:px-3 text-xs"
            >
              Personalizado
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-center sm:justify-end w-full sm:w-auto">
          {mode === "month" ? (
            <MonthPicker value={month} onValueChange={setMonth} className="w-full sm:w-auto" />
          ) : mode === "year" ? (
            <YearPicker value={year} onValueChange={setYear} className="w-full sm:w-auto" />
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <DatePicker value={customStart} onValueChange={setCustomStart} placeholder="Início" className="w-full sm:w-auto" />
              <span className="text-xs text-muted-foreground text-center">até</span>
              <DatePicker value={customEnd} onValueChange={setCustomEnd} placeholder="Fim" className="w-full sm:w-auto" />
            </div>
          )}
        </div>
      </div>

      {/* Navegação Principal em Tabs com suporte a gestos swipe e acessibilidade */}
      <Tabs
        value={mainTab}
        onValueChange={handleTabChange}
        swipeable
        items={tabItems}
      />

      {/* Modais de Dossiês de Consultoria */}
      <FinancialCloseReportModal
        open={financialReportOpen}
        onOpenChange={setFinancialReportOpen}
        periodLabel={periodLabel}
        dre={financialDRE}
        categories={byCategory.map((c) => ({
          name: c.name,
          brutoCents: c.brutoCents,
          ponderadoCents: c.ponderadoCents,
          totalCents: c.brutoCents,
          pct: grossExpenseBrutoCents > 0 ? (c.brutoCents / grossExpenseBrutoCents) * 100 : 0,
        }))}
        paymentMethods={byMethod.map((m) => ({
          method: m.method,
          label: PAYMENT_METHOD_LABELS[m.method as keyof typeof PAYMENT_METHOD_LABELS] ?? m.method,
          brutoCents: m.brutoCents,
          ponderadoCents: m.ponderadoCents,
          totalCents: m.brutoCents,
          pct: grossExpenseBrutoCents > 0 ? (m.brutoCents / grossExpenseBrutoCents) * 100 : 0,
        }))}
        expenseCount={expenseEntries.length}
        incomeCount={incomeEntries.length}
        showWeightedNote={weightsEnabled}
      />

      <WealthTearSheetModal
        open={tearSheetOpen}
        onOpenChange={setTearSheetOpen}
        periodLabel={periodLabel}
        rows={positionRows.map((r) => {
          const yoc = r.totalCostBRL > 0 ? ((r.dividends ?? 0) / r.totalCostBRL) * 100 : 0;
          return {
            ticker: r.ticker,
            name: r.ticker,
            assetClass: r.assetClass ?? "outros",
            sector: r.sector,
            currency: r.currency ?? "BRL",
            quantity: r.quantity,
            averagePrice: r.averageCost,
            currentPrice: r.priceQuote,
            valueBRL: r.valueBRL,
            totalCostBRL: r.totalCostBRL,
            unrealizedPnlBRL: r.unrealizedPnl,
            unrealizedPnlPct: r.unrealizedPct ?? 0,
            totalReturnPnlBRL: r.totalReturnPnl,
            totalReturnPct: r.totalReturnPct ?? (r.unrealizedPct ?? 0),
            dividendsBRL: r.dividends ?? 0,
            yearDividendsBRL: r.dividends ?? 0,
            yocPct: yoc,
            isCash: isCashAssetClass(r.assetClass),
          };
        })}
        totalBRL={totalPatrimonyBRL}
        totalCostBRL={totalInvestedCostBRL}
        totalDividendsBRL={positionQuery.totalDividendsBRL}
        totalReturnPnlBRL={positionQuery.totalReturnPnlBRL}
        totalReturnPct={positionQuery.totalReturnPct}
        unrealizedPnlBRL={positionQuery.unrealizedPnlBRL}
        unrealizedPnlPct={positionQuery.unrealizedPct}
        periodRedemptions={periodRedemptions}
        cashBRL={cashBalanceBRL}
        yearDividendsBRL={yearDividendsBRL}
        monthSummary={monthFlowSummary}
        allocationAnalysis={allocationAnalysis}
        concentrationRisk={concentrationRisk}
        portfolioIrr={positionQuery.portfolioIrr}
        allTimeEconomicPnlBRL={positionQuery.allTimeEconomicPnlBRL}
      />

      <DividendFreedomModal
        open={dividendFreedomOpen}
        onOpenChange={setDividendFreedomOpen}
        periodLabel={periodLabel}
        freedomAnalysis={freedomAnalysis}
        dividends={dividends}
        yearDividendsBRL={yearDividendsBRL}
        assets={assets}
        usdRate={usdRate}
      />

      <ConsolidatedWealthModal
        open={consolidatedWealthOpen}
        onOpenChange={setConsolidatedWealthOpen}
        periodLabel={periodLabel}
        balanceSheet={consolidatedBalance}
      />

      <TaxFacilitatorModal
        open={taxReportOpen}
        onOpenChange={setTaxReportOpen}
        assets={assets}
        dividends={dividends}
      />

      <PortfolioDarfMonitor
        open={darfMonitorOpen}
        onOpenChange={setDarfMonitorOpen}
        assets={assets}
        transactions={transactions}
      />

      {/* Detalhe de Lançamento ao clicar nas tabelas de finanças */}
      {selectedExpense ? (
        <ExpenseDetailDialog
          expense={selectedExpense}
          open={Boolean(selectedExpense)}
          onOpenChange={(op) => !op && setSelectedExpense(null)}
        />
      ) : null}

      {detailModal ? (
        <ReportDetailDialog
          open={Boolean(detailModal)}
          onOpenChange={(op) => !op && setDetailModal(null)}
          title={detailModal.title}
          expenses={detailModal.expenses}
          categories={categories}
          onSelectExpense={setSelectedExpense}
        />
      ) : null}
    </div>
  );
}
