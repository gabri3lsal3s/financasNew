import { useState, useMemo } from "react";
import { useSearchParams } from "react-router";
import {
  FileSpreadsheet,
  Flame,
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
  validateCustomPeriod,
  WEEKDAY_LABELS,
  type ReportEntry,
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
} from "@/state";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { ExpenseDetailDialog } from "@/features/transactions";
import {
  ConsolidatedWealthModal,
  DividendFreedomModal,
  ExcelExportCard,
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

  const [mainTab, setMainTab] = useState<MainTab>(
    ["financas", "investimentos", "balanco", "fiscal"].includes(activeTabParam) ? activeTabParam : "financas",
  );

  const handleTabChange = (val: string) => {
    const nextTab = val as MainTab;
    setMainTab(nextTab);
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
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    title: string;
    expenses: Expense[];
  } | null>(null);

  // Modais de Dossiê de Consultoria
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

  const expenses =
    mode === "month"
      ? monthlyExpenses.data ?? []
      : mode === "year"
        ? yearExpenses.data ?? []
        : customValid
          ? rangeExpenses.data ?? []
          : [];
  const incomes =
    mode === "month"
      ? monthlyIncomes.data ?? []
      : mode === "year"
        ? yearIncomes.data ?? []
        : customValid
          ? rangeIncomes.data ?? []
          : [];

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

  const consolidatedBalance = useMemo(() => {
    const curMonthIncome = (monthlyIncomes.data ?? []).reduce((acc, i) => acc + i.value, 0);
    const curMonthExpense = (monthlyExpenses.data ?? []).reduce((acc, e) => acc + e.value, 0);
    const curMonthContrib = contributions
      .filter((c) => c.date.startsWith(month))
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
      monthlyIncomesBRL: curMonthIncome,
      monthlyExpensesBRL: curMonthExpense,
      monthlyContributionsBRL: curMonthContrib,
    });
  }, [totalPatrimonyBRL, totalInvestedCostBRL, cashBalanceBRL, debts, monthlyIncomes.data, monthlyExpenses.data, contributions, month]);

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

  // Conversão de dados da aba finanças
  const toEntries = (
    list: readonly {
      id: string;
      date: string;
      category_id: string;
      value: number;
      report_weight: number;
      payment_method?: string | null;
    }[],
    kind: "expense" | "income",
  ): ReportEntry[] =>
    list.map((item) => {
      const cat = categoryById.get(item.category_id);
      return {
        id: item.id,
        date: item.date,
        kind,
        categoryId: item.category_id,
        categoryName: cat?.name ?? "Sem categoria",
        categoryIcon: cat?.icon,
        paymentMethod: item.payment_method,
        baseCents: numberToCents(item.value),
        weight: item.report_weight,
      };
    });

  const expenseEntries = toEntries(expenses, "expense");
  const incomeEntries = toEntries(incomes, "income");

  const byCategory = aggregateByCategory(expenseEntries);
  const byMethod = aggregateByPaymentMethod(expenseEntries);
  const byWeekday = aggregateByWeekday(expenseEntries);

  const currentExpenseCents = expenseEntries.reduce((acc, e) => acc + e.baseCents * e.weight, 0);
  const currentIncomeCents = incomeEntries.reduce((acc, e) => acc + e.baseCents * e.weight, 0);

  const currentOverview = computeOverview(currentIncomeCents, currentExpenseCents, 0);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 pb-20">
      {/* Banner / Card de Exportação Excel */}
      <ExcelExportCard workbookData={workbookData} />

      {/* Navegação Principal do Hub de Relatórios */}
      <Tabs
        value={mainTab}
        onValueChange={handleTabChange}
        variant="pills"
        items={[
          {
            value: "financas",
            label: "Finanças & DRE",
            icon: <Landmark className="size-4" aria-hidden="true" />,
          },
          {
            value: "investimentos",
            label: "Investimentos & Carteira",
            icon: <TrendingUp className="size-4" aria-hidden="true" />,
          },
          {
            value: "balanco",
            label: "Balanço & Liberdade",
            icon: <Scale className="size-4" aria-hidden="true" />,
          },
          {
            value: "fiscal",
            label: "Fiscal & IRPF",
            icon: <FileSpreadsheet className="size-4" aria-hidden="true" />,
          },
        ]}
      />

      {/* ABA 1: FINANÇAS & DRE PESSOAL */}
      {mainTab === "financas" ? (
        <div className="flex flex-col gap-6">
          {/* Seletor de Período */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface/90 p-3 shadow-xs">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={mode === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("month")}
              >
                Mensal
              </Button>
              <Button
                type="button"
                variant={mode === "year" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("year")}
              >
                Anual
              </Button>
              <Button
                type="button"
                variant={mode === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("custom")}
              >
                Personalizado
              </Button>
            </div>

            {mode === "month" ? (
              <MonthPicker value={month} onValueChange={setMonth} />
            ) : mode === "year" ? (
              <YearPicker value={year} onValueChange={setYear} />
            ) : (
              <div className="flex items-center gap-2">
                <DatePicker value={customStart} onValueChange={setCustomStart} placeholder="Início" />
                <span className="text-xs text-muted-foreground">até</span>
                <DatePicker value={customEnd} onValueChange={setCustomEnd} placeholder="Fim" />
              </div>
            )}
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Receitas Totais</span>
              <MoneyText cents={currentIncomeCents} tone="positive" className="text-xl font-bold font-display" />
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Despesas Totais</span>
              <MoneyText cents={currentExpenseCents} tone="negative" className="text-xl font-bold font-display" />
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Poupança do Período</span>
              <div className="flex items-center justify-between">
                <MoneyText
                  cents={currentIncomeCents - currentExpenseCents}
                  tone={currentIncomeCents >= currentExpenseCents ? "positive" : "negative"}
                  className="text-xl font-bold font-display"
                />
                <span className="text-xs font-semibold text-muted-foreground">
                  {currentOverview.savingsRatePercent !== null ? `${currentOverview.savingsRatePercent.toFixed(1)}%` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Agregações */}
          <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Detalhamento de Despesas</h3>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  variant={aggregationTab === "category" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAggregationTab("category")}
                >
                  Categorias
                </Button>
                <Button
                  type="button"
                  variant={aggregationTab === "method" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAggregationTab("method")}
                >
                  Formas de Pgto
                </Button>
                <Button
                  type="button"
                  variant={aggregationTab === "weekday" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAggregationTab("weekday")}
                >
                  Dias da Semana
                </Button>
              </div>
            </div>

            {aggregationTab === "category" ? (
              <ReportTable
                title="Por Categoria"
                totalCents={currentExpenseCents}
                rows={byCategory.map((c) => ({
                  key: c.categoryId,
                  label: c.name,
                  valueCents: c.totalCents,
                  percent: currentExpenseCents > 0 ? (c.totalCents / currentExpenseCents) * 100 : 0,
                }))}
              />
            ) : aggregationTab === "method" ? (
              <ReportTable
                title="Por Forma de Pagamento"
                totalCents={currentExpenseCents}
                rows={byMethod.map((m) => ({
                  key: m.method,
                  label: PAYMENT_METHOD_LABELS[m.method as keyof typeof PAYMENT_METHOD_LABELS] ?? m.method,
                  valueCents: m.totalCents,
                  percent: currentExpenseCents > 0 ? (m.totalCents / currentExpenseCents) * 100 : 0,
                }))}
              />
            ) : (
              <ReportTable
                title="Por Dia da Semana"
                totalCents={currentExpenseCents}
                rows={byWeekday.map((w) => ({
                  key: String(w.weekday),
                  label: WEEKDAY_LABELS[w.weekday],
                  valueCents: w.totalCents,
                  percent: currentExpenseCents > 0 ? (w.totalCents / currentExpenseCents) * 100 : 0,
                }))}
              />
            )}
          </div>
        </div>
      ) : null}

      {/* ABA 2: INVESTIMENTOS & CARTEIRA */}
      {mainTab === "investimentos" ? (
        <div className="flex flex-col gap-6">
          {/* Card Dossiê Executivo A4 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-5 text-portfolio" aria-hidden="true" />
                <h3 className="text-base font-bold text-foreground">Dossiê Executivo de Alocação &amp; Patrimônio (A4/PDF)</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Documento de consultoria patrimonial com diagnóstico de defasagem de metas (Target vs. Actual), risco de concentração e custódia.
              </p>
            </div>
            <Button
              type="button"
              variant="default"
              onClick={() => setTearSheetOpen(true)}
              className="gap-2 shrink-0"
            >
              <Printer className="size-4" aria-hidden="true" />
              Visualizar &amp; Imprimir Dossiê A4
            </Button>
          </div>

          {/* Resumo da Alocação & Metas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Patrimônio Consolidado</span>
              <MoneyText cents={numberToCents(totalPatrimonyBRL)} tone="portfolio" className="text-xl font-bold font-display" />
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Capital Investido</span>
              <MoneyText cents={numberToCents(totalInvestedCostBRL)} tone="default" className="text-xl font-bold font-display" />
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Aderência às Metas</span>
              <span className="text-xl font-bold font-display text-primary-strong">{allocationAnalysis.alignmentScore}%</span>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Top 5 Concentração</span>
              <span className="text-xl font-bold font-display text-foreground">{concentrationRisk.top5Pct.toFixed(1)}%</span>
            </div>
          </div>

          {/* Tabela Resumida de Gaps de Classe */}
          <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="size-4 text-portfolio" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-foreground">Defasagem de Metas por Classe</h3>
              </div>
              {allocationAnalysis.topDeficitClass ? (
                <span className="text-xs font-semibold text-primary-strong">
                  Prioridade: Aportar em {allocationAnalysis.topDeficitClass.assetClass.toUpperCase()}
                </span>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/80">
              <table className="w-full text-left text-xs border-collapse">
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
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Scale className="size-5 text-primary-strong" aria-hidden="true" />
                  <h3 className="text-base font-bold text-foreground">Balanço 360° &amp; DRE Pessoal</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Relatório consolidado unindo investimentos, contas, dívidas, poupança e fluxo de caixa.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => setConsolidatedWealthOpen(true)} className="gap-2 w-full justify-center">
                <Printer className="size-4" aria-hidden="true" />
                Visualizar Balanço 360°
              </Button>
            </div>

            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Flame className="size-5 text-positive-strong" aria-hidden="true" />
                  <h3 className="text-base font-bold text-foreground">Dossiê de Liberdade Financeira</h3>
                </div>
                <p className="text-xs text-muted-foreground">
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Patrimônio Líquido Real</span>
              <MoneyText cents={numberToCents(consolidatedBalance.netWorthBRL)} tone="portfolio" className="text-xl font-bold font-display" />
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Grau de Liberdade Financeira</span>
              <span className="text-xl font-bold font-display text-positive-strong">{freedomAnalysis.freedomPct.toFixed(1)}%</span>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Autonomia de Reserva (Runway)</span>
              <span className="text-xl font-bold font-display text-foreground">{freedomAnalysis.runwayMonths.toFixed(1)} meses</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ABA 4: FISCAL & IRPF */}
      {mainTab === "fiscal" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-xs">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Landmark className="size-5 text-positive-strong" aria-hidden="true" />
                <h3 className="text-base font-bold text-foreground">Facilitador de Declaração de IRPF</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Textos prontos com 1-clique para cópia das Fichas de Bens e Direitos e Rendimentos Isentos/Exclusivos para o programa da Receita Federal.
              </p>
            </div>
            <Button
              type="button"
              variant="default"
              onClick={() => setTaxReportOpen(true)}
              className="gap-2 shrink-0"
            >
              <Printer className="size-4" aria-hidden="true" />
              Abrir Fichas de IRPF
            </Button>
          </div>
        </div>
      ) : null}

      {/* Modais de Dossiês de Consultoria */}
      <WealthTearSheetModal
        open={tearSheetOpen}
        onOpenChange={setTearSheetOpen}
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
        freedomAnalysis={freedomAnalysis}
        dividends={dividends}
        yearDividendsBRL={yearDividendsBRL}
      />

      <ConsolidatedWealthModal
        open={consolidatedWealthOpen}
        onOpenChange={setConsolidatedWealthOpen}
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
          open={detailModal.open}
          onOpenChange={(op) => !op && setDetailModal(null)}
          title={detailModal.title}
          expenses={detailModal.expenses}
          categories={categories}
        />
      ) : null}
    </div>
  );
}

