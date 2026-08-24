import { useState, useMemo } from "react";
import { useSearchParams } from "react-router";

import {
  FileSpreadsheet,
  Flame,
  Info,
  Landmark,
  PieChart,
  Printer,
  Scale,
  TrendingUp,
} from "lucide-react";
import { Button, ErrorState, Skeleton, Tabs } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyText } from "@/components/ui/money-text";
import {
  MonthPicker,
  ReportTable,
  YearPicker,
} from "@/components/modules";
import {
  aggregateByCategory,
  aggregateByPaymentMethod,
  aggregateByWeekday,
  calculateAllocationGaps,
  calculateConcentrationRisk,
  calculateFreedomIndex,
  computeConsolidatedBalanceSheet,
  mondayFirstWeekday,
  validateCustomPeriod,
  WEEKDAY_LABELS,
} from "@/domain/reports";


import { isCashAssetClass } from "@/domain/portfolio";
import { addDaysISO } from "@/domain/debts";
import { currentMonth, currentYear, monthRange, shiftMonth, yearRange } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { computeOverview } from "@/domain/overview";
import {
  useAllocationTargets,
  useCategories,
  useDebts,
  useExpenses,
  useExpensesByRange,
  useGroupTargets,
  useIncomes,
  useIncomesByRange,
  usePortfolioAssets,
  usePortfolioContributions,
  usePortfolioDividends,
  usePortfolioPosition,
  useUserAccess,
  useUserPreferences,
} from "@/state";


import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { ExpenseDetailDialog } from "@/features/transactions";
import {
  ConsolidatedWealthModal,
  DividendFreedomModal,
  ExcelExportCard,
  FinancialCloseReportModal,
  ReportDetailDialog,
  TaxFacilitatorModal,
  WealthTearSheetModal,
} from "../components";

import type { Expense } from "@/types";
import { numberToCents } from "@/domain/money";
import type { ExcelWorkbookData } from "@/services/excel-export";

type MainTab = "financas" | "investimentos" | "balanco" | "fiscal";
type PeriodMode = "month" | "year" | "custom";
type AggregationTab = "category" | "method" | "weekday" | "charges";

/**
 * Central Unificada de Relatórios & Consultoria Patrimonial (§F42).
 * Hub consolidado com 4 abas: Finanças, Investimentos, Balanço 360° e Fiscal.
 */
export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabParam = (searchParams.get("aba") as MainTab) || "financas";
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

  const tabItems = useMemo(() => {
    const list: Array<{ value: MainTab; label: string; shortLabel?: string; icon: React.ReactNode }> = [];

    if (hasFinanceFeatures) {
      list.push({
        value: "financas",
        label: "Finanças & DRE",
        shortLabel: "Finanças",
        icon: <Landmark className="size-4" aria-hidden="true" />,
      });
    }

    if (hasInvestmentsFeature) {
      list.push({
        value: "investimentos",
        label: "Investimentos & Carteira",
        shortLabel: "Investimentos",
        icon: <TrendingUp className="size-4" aria-hidden="true" />,
      });
    }

    if (hasFinanceFeatures) {
      list.push({
        value: "balanco",
        label: "Balanço & Liberdade",
        shortLabel: "Balanço",
        icon: <Scale className="size-4" aria-hidden="true" />,
      });
    }

    if (hasInvestmentsFeature) {
      list.push({
        value: "fiscal",
        label: "Fiscal & IRPF",
        shortLabel: "Fiscal",
        icon: <FileSpreadsheet className="size-4" aria-hidden="true" />,
      });
    }

    if (list.length === 0) {
      return [
        {
          value: "financas" as MainTab,
          label: "Finanças & DRE",
          shortLabel: "Finanças",
          icon: <Landmark className="size-4" aria-hidden="true" />,
        },
        {
          value: "investimentos" as MainTab,
          label: "Investimentos & Carteira",
          shortLabel: "Investimentos",
          icon: <TrendingUp className="size-4" aria-hidden="true" />,
        },
        {
          value: "balanco" as MainTab,
          label: "Balanço & Liberdade",
          shortLabel: "Balanço",
          icon: <Scale className="size-4" aria-hidden="true" />,
        },
        {
          value: "fiscal" as MainTab,
          label: "Fiscal & IRPF",
          shortLabel: "Fiscal",
          icon: <FileSpreadsheet className="size-4" aria-hidden="true" />,
        },
      ];
    }

    return list;
  }, [hasFinanceFeatures, hasInvestmentsFeature]);

  const [selectedTab, setSelectedTab] = useState<MainTab>(() => {
    const validValues = new Set(tabItems.map((t) => t.value));
    if (validValues.has(activeTabParam)) return activeTabParam;
    return tabItems[0]?.value ?? "financas";
  });

  const validTabValues = useMemo(() => new Set(tabItems.map((t) => t.value)), [tabItems]);
  const mainTab: MainTab = validTabValues.has(selectedTab)
    ? selectedTab
    : (tabItems[0]?.value ?? "financas");

  const handleTabChange = (val: string) => {
    const nextTab = val as MainTab;
    setSelectedTab(nextTab);
    setSearchParams((prev) => {
      prev.set("aba", nextTab);
      return prev;
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
  const classTargetsQuery = useGroupTargets("class");
  const assetTargetsQuery = useAllocationTargets();

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
    assetsQuery.isLoading;

  const error =
    (mode === "month"
      ? monthlyExpenses.error ?? monthlyIncomes.error ?? prevExpenses.error ?? prevIncomes.error
      : mode === "year"
        ? yearExpenses.error ?? yearIncomes.error ?? prevYearExpenses.error ?? prevYearIncomes.error
        : rangeExpenses.error ?? rangeIncomes.error) ??
    debtsQuery.error ??
    categoriesQuery.error ??
    positionQuery.error;

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const debts = useMemo(() => debtsQuery.data ?? [], [debtsQuery.data]);
  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);
  const dividends = useMemo(() => dividendsQuery.data ?? [], [dividendsQuery.data]);
  const contributions = useMemo(() => contributionsQuery.data ?? [], [contributionsQuery.data]);
  const positionRows = useMemo(() => positionQuery.rows ?? [], [positionQuery.rows]);
  const classTargets = useMemo(() => classTargetsQuery.data ?? [], [classTargetsQuery.data]);
  const assetTargets = useMemo(() => assetTargetsQuery.data ?? [], [assetTargetsQuery.data]);

  const totalPatrimonyBRL = positionQuery.totalBRL ?? 0;
  const cashBalanceBRL = positionQuery.cashBRL ?? 0;
  const totalInvestedCostBRL = positionQuery.totalCostBRL ?? 0;

  const currentYearNum = new Date().getFullYear();
  const yearDividendsBRL = useMemo(
    () =>
      dividends
        .filter((d) => d.date.startsWith(String(currentYearNum)))
        .reduce((acc, d) => acc + d.amount, 0),
    [dividends, currentYearNum],
  );

  // Cálculos de Consultoria de Investimentos
  const allocationAnalysis = useMemo(() => {
    return calculateAllocationGaps(
      positionRows.map((r) => ({
        id: r.assetId ?? r.ticker,
        ticker: r.ticker,
        assetClass: r.assetClass ?? "outros",
        valueBRL: r.valueBRL,
        isCash: isCashAssetClass(r.assetClass),
      })),
      classTargets.map((ct) => ({ assetClass: ct.name, targetPercentage: ct.target_percentage })),
      assetTargets.map((at) => ({ assetId: at.asset_id, targetPercentage: at.target_percentage })),
    );
  }, [positionRows, classTargets, assetTargets]);

  const concentrationRisk = useMemo(() => {
    return calculateConcentrationRisk(
      positionRows.map((r) => ({
        id: r.assetId ?? r.ticker,
        ticker: r.ticker,
        assetClass: r.assetClass ?? "outros",
        currency: (r.currency as "BRL" | "USD") ?? "BRL",
        valueBRL: r.valueBRL,
        isCash: isCashAssetClass(r.assetClass),
      })),
    );
  }, [positionRows]);

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
      assets.map((a) => ({
        ticker: a.ticker,
        currentPriceBRL: a.quantity > 0 && a.average_price > 0 ? a.average_price : 10,
        monthlyDividendPerShareBRL: a.estimated_monthly_dividend_per_share ?? 0,
        quantity: a.quantity,
      })),
    );
  }, [yearDividendsBRL, monthlyExpenses.data, cashBalanceBRL, assets]);

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
        // Quando pesos estão desativados, neutraliza o weight (trata como 1)
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
        // Quando pesos estão desativados, neutraliza o weight (trata como 1)
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

  const currentOverview = useMemo(
    () => computeOverview(currentIncomeCents, currentExpenseCents, 0),
    [currentIncomeCents, currentExpenseCents],
  );


  const consolidatedBalance = useMemo(() => {
    // Usa os mesmos valores ponderados que os KPIs da página exibem (consistência)
    // currentIncomeCents e currentExpenseCents já aplicam weightsEnabled
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

    return computeConsolidatedBalanceSheet({
      investmentsMarketValueBRL: totalPatrimonyBRL,
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

    // Valores brutos (sem ponderação) — referência para exibição no modal DRE quando pesos ativos
    const grossIncomeBrutoCents = incomes.reduce((acc, i) => acc + numberToCents(i.value), 0);
    const totalExpensesBrutoCents = expenses.reduce((acc, e) => acc + numberToCents(e.value), 0);

    return {
      grossIncomeCents,
      totalExpensesCents,
      operationalSavingsCents,
      savingsRatePct,
      investedAporteCents,
      netCashFlowCents,
      grossIncomeBrutoCents,
      totalExpensesBrutoCents,
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
    return {
      appName: "Finanças & Investimentos",
      generatedAt: new Date().toLocaleDateString("pt-BR"),
      summary: {
        totalPatrimonyBRL,
        totalInvestedCostBRL,
        unrealizedPnlBRL: totalPatrimonyBRL - totalInvestedCostBRL,
        unrealizedPnlPct: totalInvestedCostBRL > 0 ? ((totalPatrimonyBRL - totalInvestedCostBRL) / totalInvestedCostBRL) * 100 : 0,
        cashBalanceBRL,
        yearDividendsBRL,
        freedomPct: freedomAnalysis.freedomPct,
        savingsRatePct: consolidatedBalance.dre.savingsRatePct,
      },
      positions: positionRows.map((r) => {
        const yoc = r.totalCostBRL > 0 ? (r.dividends / r.totalCostBRL) * 100 : 0;
        return {
          ticker: r.ticker,
          name: r.ticker,
          assetClass: r.assetClass ?? "outros",
          currency: r.currency ?? "BRL",
          quantity: r.quantity,
          averagePrice: r.averageCostBRL,
          currentPrice: r.priceBRL,
          totalValueBRL: r.valueBRL,
          unrealizedPnlBRL: r.unrealizedPnl,
          unrealizedPnlPct: r.unrealizedPct ?? 0,
          yearDividendsBRL: r.dividends,
          yocPct: yoc,
        };
      }),
      dividends: dividends.map((d) => ({
        date: d.date,
        ticker: assets.find((a) => a.id === d.asset_id)?.ticker ?? "Ativo",
        assetClass: assets.find((a) => a.id === d.asset_id)?.asset_class ?? "outros",
        amountBRL: d.amount,
        notes: d.notes,
      })),
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
    };
  }, [
    totalPatrimonyBRL,
    totalInvestedCostBRL,
    cashBalanceBRL,
    yearDividendsBRL,
    freedomAnalysis.freedomPct,
    consolidatedBalance.dre,
    positionRows,
    dividends,
    assets,
    month,
    debts,
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
      <div className="flex flex-col gap-6 p-4 sm:p-6">
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
      <div className="p-6">
        <ErrorState message={getErrorMessage(error)} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-3.5 sm:p-6 pb-20">
      {/* Banner / Card de Exportação Excel */}
      <ExcelExportCard workbookData={workbookData} description={excelDescription} />


      {/* Navegação Principal do Hub de Relatórios */}
      <Tabs
        value={mainTab}
        onValueChange={handleTabChange}
        variant="pills"
        items={tabItems}
      />

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
          {weightsEnabled && (
            <span className="inline-flex items-center gap-1 self-start sm:self-auto rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary-strong">
              <Info className="size-3 shrink-0" aria-hidden="true" />
              Valores ponderados
            </span>
          )}
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

      {/* ABA 1: FINANÇAS & DRE PESSOAL */}
      {mainTab === "financas" ? (
        <div className="flex flex-col gap-6">
          {/* Card Dossiê Executivo A4 de Finanças & DRE */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Landmark className="size-5 text-primary-strong shrink-0" aria-hidden="true" />
                <h3 className="text-sm sm:text-base font-bold text-foreground">Dossiê Executivo de Finanças Pessoais &amp; DRE (A4/PDF)</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Demonstração do Resultado do Exercício (DRE Pessoal), fluxo de caixa líquido, taxa de poupança e detalhamento de gastos.
              </p>
            </div>
            <Button
              type="button"
              variant="default"
              onClick={() => setFinancialReportOpen(true)}
              className="gap-2 shrink-0 w-full sm:w-auto justify-center"
            >
              <Printer className="size-4" aria-hidden="true" />
              Visualizar &amp; Imprimir Dossiê A4
            </Button>
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Receitas Totais</span>
              <MoneyText cents={grossIncomeBrutoCents} tone="positive" className="text-lg sm:text-xl font-bold font-display truncate" />
              {hasDualMetrics && (
                <span className="text-xs text-muted-foreground">
                  ponderado: <MoneyText cents={currentIncomeCents} tone="positive" className="inline text-xs font-medium" />
                </span>
              )}
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Despesas Totais</span>
              <MoneyText cents={grossExpenseBrutoCents} tone="negative" className="text-lg sm:text-xl font-bold font-display truncate" />
              {hasDualMetrics && (
                <span className="text-xs text-muted-foreground">
                  ponderado: <MoneyText cents={currentExpenseCents} tone="negative" className="inline text-xs font-medium" />
                </span>
              )}
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Poupança do Período</span>
              <div className="flex items-center justify-between gap-2">
                <MoneyText
                  cents={grossSavingsBrutoCents}
                  tone={grossSavingsBrutoCents >= 0 ? "positive" : "negative"}
                  className="text-lg sm:text-xl font-bold font-display truncate"
                />
                <span className="text-xs font-semibold text-muted-foreground shrink-0">
                  {grossSavingsRatePercent !== null ? `${grossSavingsRatePercent.toFixed(1)}%` : "—"}
                </span>
              </div>
              {hasDualMetrics && (
                <span className="text-xs text-muted-foreground">
                  ponderado: <MoneyText cents={currentIncomeCents - currentExpenseCents} tone={currentIncomeCents >= currentExpenseCents ? "positive" : "negative"} className="inline text-xs font-medium" /> ({currentOverview.savingsRatePercent !== null ? `${currentOverview.savingsRatePercent.toFixed(1)}%` : "—"})
                </span>
              )}
            </div>
          </div>

          {/* Agregações */}
          <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Detalhamento de Despesas</h3>
              <div className="grid grid-cols-3 sm:flex gap-1.5 w-full sm:w-auto">
                <Button
                  type="button"
                  variant={aggregationTab === "category" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAggregationTab("category")}
                  className="w-full sm:w-auto justify-center px-2 sm:px-3 text-xs"
                >
                  Categorias
                </Button>
                <Button
                  type="button"
                  variant={aggregationTab === "method" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAggregationTab("method")}
                  className="w-full sm:w-auto justify-center px-2 sm:px-3 text-xs"
                >
                  Formas de Pgto
                </Button>
                <Button
                  type="button"
                  variant={aggregationTab === "weekday" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAggregationTab("weekday")}
                  className="w-full sm:w-auto justify-center px-2 sm:px-3 text-xs"
                >
                  Dias da Semana
                </Button>

              </div>
            </div>

            {aggregationTab === "category" ? (
              <ReportTable
                title="Por Categoria"
                totalBrutoCents={grossExpenseBrutoCents}
                totalPonderadoCents={currentExpenseCents}
                totalCents={grossExpenseBrutoCents}
                rows={byCategory.map((c) => ({
                  key: c.categoryId,
                  label: c.name,
                  brutoCents: c.brutoCents,
                  ponderadoCents: c.ponderadoCents,
                  valueCents: c.brutoCents,
                  percent: grossExpenseBrutoCents > 0 ? (c.brutoCents / grossExpenseBrutoCents) * 100 : 0,
                }))}
                onRowClick={(row) => {
                  const catExpenses = expenses.filter((e) => e.category_id === row.key);
                  setDetailModal({
                    title: `Despesas: ${typeof row.label === "string" ? row.label : "Categoria"}`,
                    expenses: catExpenses,
                  });
                }}
              />
            ) : aggregationTab === "method" ? (
              <ReportTable
                title="Por Forma de Pagamento"
                totalBrutoCents={grossExpenseBrutoCents}
                totalPonderadoCents={currentExpenseCents}
                totalCents={grossExpenseBrutoCents}
                rows={byMethod.map((m) => ({
                  key: m.method,
                  label: PAYMENT_METHOD_LABELS[m.method as keyof typeof PAYMENT_METHOD_LABELS] ?? m.method,
                  brutoCents: m.brutoCents,
                  ponderadoCents: m.ponderadoCents,
                  valueCents: m.brutoCents,
                  percent: grossExpenseBrutoCents > 0 ? (m.brutoCents / grossExpenseBrutoCents) * 100 : 0,
                }))}
                onRowClick={(row) => {
                  const methodExpenses = expenses.filter((e) => (e.payment_method ?? "other") === row.key);
                  setDetailModal({
                    title: `Despesas: ${typeof row.label === "string" ? row.label : "Forma de Pagamento"}`,
                    expenses: methodExpenses,
                  });
                }}
              />
            ) : (
              <ReportTable
                title="Por Dia da Semana"
                totalBrutoCents={grossExpenseBrutoCents}
                totalPonderadoCents={currentExpenseCents}
                totalCents={grossExpenseBrutoCents}
                rows={byWeekday.map((w) => ({
                  key: String(w.weekday),
                  label: WEEKDAY_LABELS[w.weekday],
                  brutoCents: w.brutoCents,
                  ponderadoCents: w.ponderadoCents,
                  valueCents: w.brutoCents,
                  percent: grossExpenseBrutoCents > 0 ? (w.brutoCents / grossExpenseBrutoCents) * 100 : 0,
                }))}
                onRowClick={(row) => {
                  const weekdayNum = parseInt(row.key, 10);
                  const weekdayExpenses = expenses.filter((e) => mondayFirstWeekday(e.date) === weekdayNum);
                  setDetailModal({
                    title: `Despesas: ${WEEKDAY_LABELS[weekdayNum] ?? "Dia"}`,
                    expenses: weekdayExpenses,
                  });
                }}
              />

            )}

          </div>
        </div>
      ) : null}

      {/* ABA 2: INVESTIMENTOS & CARTEIRA */}
      {mainTab === "investimentos" ? (
        <div className="flex flex-col gap-6">
          {/* Card Dossiê Executivo A4 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-5 text-portfolio shrink-0" aria-hidden="true" />
                <h3 className="text-sm sm:text-base font-bold text-foreground">Dossiê Executivo de Alocação &amp; Patrimônio (A4/PDF)</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Documento de consultoria patrimonial com diagnóstico de defasagem de metas (Target vs. Actual), risco de concentração e custódia.
              </p>
            </div>
            <Button
              type="button"
              variant="default"
              onClick={() => setTearSheetOpen(true)}
              className="gap-2 shrink-0 w-full sm:w-auto justify-center"
            >
              <Printer className="size-4" aria-hidden="true" />
              Visualizar &amp; Imprimir Dossiê A4
            </Button>
          </div>

          {/* Resumo da Alocação & Metas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Patrimônio Consolidado</span>
              <MoneyText cents={numberToCents(totalPatrimonyBRL)} tone="portfolio" className="text-lg sm:text-xl font-bold font-display truncate" />
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Capital Investido</span>
              <MoneyText cents={numberToCents(totalInvestedCostBRL)} tone="default" className="text-lg sm:text-xl font-bold font-display truncate" />
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Aderência às Metas</span>
              <span className="text-lg sm:text-xl font-bold font-display text-primary-strong">{allocationAnalysis.alignmentScore}%</span>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Top 5 Concentração</span>
              <span className="text-lg sm:text-xl font-bold font-display text-foreground">{concentrationRisk.top5Pct.toFixed(1)}%</span>
            </div>
          </div>

          {/* Tabela Resumida de Gaps de Classe */}
          <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <PieChart className="size-4 text-portfolio shrink-0" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-foreground">Defasagem de Metas por Classe</h3>
              </div>
              {allocationAnalysis.topDeficitClass ? (
                <span className="text-xs font-semibold text-primary-strong">
                  Prioridade: Aportar em {allocationAnalysis.topDeficitClass.assetClass.toUpperCase()}
                </span>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/80">
              <table className="w-full min-w-[500px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-surface-hover/50 text-muted-foreground font-medium">
                    <th className="py-2.5 px-3">Classe</th>
                    <th className="py-2.5 px-3 text-right">Atual (R$)</th>
                    <th className="py-2.5 px-3 text-right">Atual (%)</th>
                    <th className="py-2.5 px-3 text-right">Meta (%)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {allocationAnalysis.classGaps.map((cg) => (
                    <tr key={cg.assetClass} className="hover:bg-surface-hover/30">
                      <td className="py-2 px-3 font-semibold capitalize text-foreground">{cg.assetClass}</td>
                      <td className="py-2 px-3 text-right font-mono"><MoneyText cents={numberToCents(cg.currentBRL)} /></td>
                      <td className="py-2 px-3 text-right font-mono">{cg.currentPct.toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right font-mono">{cg.targetPct > 0 ? `${cg.targetPct.toFixed(1)}%` : "—"}</td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                            cg.status === "deficit"
                              ? "bg-primary/10 text-primary-strong border border-primary/20"
                              : cg.status === "surplus"
                                ? "bg-surface-hover text-muted-foreground border border-border"
                                : "bg-positive/10 text-positive-strong border border-positive/20"
                          }`}
                        >
                          {cg.status === "deficit" ? "Aportar" : cg.status === "surplus" ? "Acima da Meta" : "Equilibrado"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* ABA 3: BALANÇO & LIBERDADE */}
      {mainTab === "balanco" ? (
        <div className="flex flex-col gap-6">
          {/* Card Duplo de Dossiês A4 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Scale className="size-5 text-primary-strong shrink-0" aria-hidden="true" />
                  <h3 className="text-sm sm:text-base font-bold text-foreground">Balanço 360° &amp; DRE Pessoal</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Relatório consolidado unindo investimentos, contas, dívidas, poupança e fluxo de caixa.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => setConsolidatedWealthOpen(true)} className="gap-2 w-full justify-center">
                <Printer className="size-4" aria-hidden="true" />
                Visualizar Balanço 360°
              </Button>
            </div>

            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Flame className="size-5 text-positive-strong shrink-0" aria-hidden="true" />
                  <h3 className="text-sm sm:text-base font-bold text-foreground">Dossiê de Liberdade Financeira</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Análise da cobertura de custos por proventos, calendário 12M e efeito bola de neve.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => setDividendFreedomOpen(true)} className="gap-2 w-full justify-center">
                <Printer className="size-4" aria-hidden="true" />
                Visualizar Dossiê de Liberdade
              </Button>
            </div>
          </div>

          {/* Cards de Patrimônio Líquido Real */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Patrimônio Líquido Real</span>
              <MoneyText cents={numberToCents(consolidatedBalance.netWorthBRL)} tone="portfolio" className="text-lg sm:text-xl font-bold font-display truncate" />
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Grau de Liberdade Financeira</span>
              <span className="text-lg sm:text-xl font-bold font-display text-positive-strong">{freedomAnalysis.freedomPct.toFixed(1)}%</span>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Autonomia de Reserva (Runway)</span>
              <span className="text-lg sm:text-xl font-bold font-display text-foreground">{freedomAnalysis.runwayMonths.toFixed(1)} meses</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ABA 4: FISCAL & IRPF */}
      {mainTab === "fiscal" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Landmark className="size-5 text-positive-strong shrink-0" aria-hidden="true" />
                <h3 className="text-sm sm:text-base font-bold text-foreground">Facilitador de Declaração de IRPF</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Textos prontos com 1-clique para cópia das Fichas de Bens e Direitos e Rendimentos Isentos/Exclusivos para o programa da Receita Federal.
              </p>
            </div>
            <Button
              type="button"
              variant="default"
              onClick={() => setTaxReportOpen(true)}
              className="gap-2 shrink-0 w-full sm:w-auto justify-center"
            >
              <Printer className="size-4" aria-hidden="true" />
              Abrir Fichas de IRPF
            </Button>
          </div>
        </div>
      ) : null}


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
          const yoc = r.totalCostBRL > 0 ? (r.dividends / r.totalCostBRL) * 100 : 0;
          return {
            ticker: r.ticker,
            name: r.ticker,
            assetClass: r.assetClass ?? "outros",
            currency: r.currency ?? "BRL",
            quantity: r.quantity,
            averagePrice: r.averageCostBRL,
            currentPrice: r.priceBRL,
            valueBRL: r.valueBRL,
            unrealizedPnlBRL: r.unrealizedPnl,
            unrealizedPnlPct: r.unrealizedPct ?? 0,
            yearDividendsBRL: r.dividends,
            yocPct: yoc,
            isCash: isCashAssetClass(r.assetClass),
          };
        })}
        totalBRL={totalPatrimonyBRL}
        totalCostBRL={totalInvestedCostBRL}
        cashBRL={cashBalanceBRL}
        yearDividendsBRL={yearDividendsBRL}
        allocationAnalysis={allocationAnalysis}
        concentrationRisk={concentrationRisk}
      />

      <DividendFreedomModal
        open={dividendFreedomOpen}
        onOpenChange={setDividendFreedomOpen}
        periodLabel={periodLabel}
        freedomAnalysis={freedomAnalysis}
        dividends={dividends}
        yearDividendsBRL={yearDividendsBRL}
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


