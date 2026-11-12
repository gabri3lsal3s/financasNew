import { useCallback, useMemo } from "react";
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
  weightedCents,
} from "@/domain/reports";
import { isCashAssetClass, isDividendType } from "@/domain/portfolio";
import { budgetLimitsByCategory } from "@/domain/budgets";
import { addDaysISO, todayISO } from "@/domain/debts";
import { currentMonth, currentYear, monthRange, shiftMonth, yearRange } from "@/lib/date";
import { numberToCents } from "@/domain/money";
import type { ExcelWorkbookData } from "@/services/excel-export";
import {
  useAllocationTargets,
  useBudgets,
  useCategories,
  useDebts,
  useExpenses,
  useExpensesByRange,
  useFamilyConsolidation,
  useFamilyMode,
  useGroupTargets,
  useIncomes,
  useIncomesByRange,
  useMyFamily,
  useAllPortfolioTransactions,
  usePortfolioAssets,
  usePortfolioContributions,
  usePortfolioDividends,
  usePortfolioPosition,
  usePortfolioSnapshots,
  useMacroIndicators,
  useEmergencyFundComposition,
} from "@/state";

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
}

export function useReportsData({
  hasFinanceFeatures,
  hasInvestmentsFeature,
  weightsEnabled,
  month,
  year,
  mode,
  debouncedCustomStart,
  debouncedCustomEnd,
  customStart = "",
  customEnd = "",
}: UseReportsDataParams) {
  const range =
    mode === "month"
      ? monthRange(month)
      : mode === "year"
        ? yearRange(year)
        : { start: debouncedCustomStart, end: debouncedCustomEnd ? addDaysISO(debouncedCustomEnd, 1) : "" };

  const customValid =
    mode !== "custom" ||
    (debouncedCustomStart !== "" && debouncedCustomEnd !== "" && validateCustomPeriod(debouncedCustomStart, debouncedCustomEnd).ok);

  const isYear = mode === "year";
  const isCustom = mode === "custom";

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

  const isDateInPeriod = useCallback(
    (dateStr: string) => {
      if (mode === "month") {
        return dateStr.startsWith(month);
      }
      if (mode === "year") {
        return dateStr.startsWith(String(year));
      }
      if (mode === "custom" && customValid && debouncedCustomStart && debouncedCustomEnd) {
        return dateStr >= debouncedCustomStart && dateStr <= debouncedCustomEnd;
      }
      return true;
    },
    [mode, month, year, customValid, debouncedCustomStart, debouncedCustomEnd],
  );

  // Queries de Finanças — condicionadas a hasFinanceFeatures
  const monthlyExpenses = useExpenses(month, { enabled: hasFinanceFeatures });
  const monthlyIncomes = useIncomes(month, { enabled: hasFinanceFeatures });
  const prevExpenses = useExpenses(shiftMonth(month, -1), { enabled: hasFinanceFeatures });
  const prevIncomes = useIncomes(shiftMonth(month, -1), { enabled: hasFinanceFeatures });

  const yearExpenses = useExpensesByRange(range.start, range.end, { enabled: isYear && hasFinanceFeatures });
  const yearIncomes = useIncomesByRange(range.start, range.end, { enabled: isYear && hasFinanceFeatures });
  const prevYearRange = isYear ? yearRange(year - 1) : { start: "", end: "" };
  const prevYearExpenses = useExpensesByRange(prevYearRange.start, prevYearRange.end, { enabled: isYear && hasFinanceFeatures });
  const prevYearIncomes = useIncomesByRange(prevYearRange.start, prevYearRange.end, { enabled: isYear && hasFinanceFeatures });

  const rangeExpenses = useExpensesByRange(range.start, range.end, { enabled: isCustom && customValid && hasFinanceFeatures });
  const rangeIncomes = useIncomesByRange(range.start, range.end, { enabled: isCustom && customValid && hasFinanceFeatures });
  const debtsQuery = useDebts({ enabled: hasFinanceFeatures });
  const categoriesQuery = useCategories(undefined, { enabled: hasFinanceFeatures });
  const contributionsQuery = usePortfolioContributions();
  const budgetsQuery = useBudgets();
  const { isFamilyModeEnabled } = useFamilyMode();
  const myFamilyQuery = useMyFamily();
  const hasFamily = Boolean(myFamilyQuery.data?.family?.id);
  const familyConsolidationQuery = useFamilyConsolidation(mode === "month" ? month : currentMonth(), {
    enabled: hasFamily && isFamilyModeEnabled && mode === "month",
  });

  // Queries de Investimentos & Patrimônio
  const positionQuery = usePortfolioPosition();
  const emergencyFund = useEmergencyFundComposition();
  const snapshotsQuery = usePortfolioSnapshots();
  const macroIndicatorsQuery = useMacroIndicators();
  const assetsQuery = usePortfolioAssets();
  const dividendsQuery = usePortfolioDividends();
  const transactionsQuery = useAllPortfolioTransactions();
  const classTargetsQuery = useGroupTargets("class");
  const sectorTargetsQuery = useGroupTargets("sector");
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
    snapshotsQuery.isLoading ||
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
    snapshotsQuery.error ??
    transactionsQuery.error ??
    sectorTargetsQuery.error;

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const debts = useMemo(() => debtsQuery.data ?? [], [debtsQuery.data]);
  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);
  const dividends = useMemo(() => dividendsQuery.data ?? [], [dividendsQuery.data]);
  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);
  const contributions = useMemo(() => contributionsQuery.data ?? [], [contributionsQuery.data]);
  const snapshots = useMemo(() => snapshotsQuery.data ?? [], [snapshotsQuery.data]);
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

  const usdRate = useMemo(
    () => positionRows.find((r) => r.currency === "USD")?.usdRate ?? 5.25,
    [positionRows],
  );

  const assetCurrencyMap = useMemo(
    () => new Map(assets.map((a) => [a.id, a.currency])),
    [assets],
  );

  // Proventos alinhados estritamente ao exercício/ano selecionado
  const selectedYearNum = useMemo(() => {
    if (mode === "year") return year;
    if (mode === "month") return parseInt(month.slice(0, 4), 10) || new Date().getFullYear();
    if (debouncedCustomStart) return parseInt(debouncedCustomStart.slice(0, 4), 10) || new Date().getFullYear();
    return new Date().getFullYear();
  }, [mode, year, month, debouncedCustomStart]);

  const yearDividendsBRL = useMemo(() => {
    const tableDivs = dividends
      .filter((d) => d.date.startsWith(String(selectedYearNum)))
      .reduce((acc, d) => {
        const curr = d.asset_id ? assetCurrencyMap.get(d.asset_id) : "BRL";
        const rate = curr === "USD" ? usdRate : 1;
        return acc + d.amount * rate;
      }, 0);
    if (tableDivs > 0) return tableDivs;
    if (selectedYearNum === new Date().getFullYear()) {
      return positionQuery.totalDividendsBRL;
    }
    return 0;
  }, [dividends, selectedYearNum, positionQuery.totalDividendsBRL, assetCurrencyMap, usdRate]);

  // Movimentações, proventos e aportes filtrados estritamente pelo período ativo
  const periodTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        if (!isDateInPeriod(t.date)) return false;
        const asset = assets.find((a) => a.id === t.asset_id);
        if (asset && (isCashAssetClass(asset.asset_class) || asset.ticker.toUpperCase() === "CAIXA")) {
          return false;
        }
        return true;
      }),
    [transactions, isDateInPeriod, assets],
  );

  const periodDividendsList = useMemo(() => {
    const list: Array<{ id?: string; asset_id: string | null; date: string; amount: number }> = [];

    for (const d of dividends) {
      if (isDateInPeriod(d.date)) {
        list.push({ id: d.id, asset_id: d.asset_id, date: d.date, amount: d.amount });
      }
    }

    for (const t of periodTransactions) {
      if (isDividendType(t.type)) {
        const amt = t.total > 0 ? t.total : (t.quantity > 0 && t.price > 0 ? t.quantity * t.price : 0);
        if (amt <= 0) continue;
        const tDate = t.date ? t.date.slice(0, 10) : "";
        const alreadyInList = list.some(
          (d) => d.asset_id === t.asset_id && d.date.slice(0, 10) === tDate && Math.abs(d.amount - amt) < 0.01,
        );
        if (!alreadyInList) {
          list.push({ id: t.id, asset_id: t.asset_id, date: t.date, amount: amt });
        }
      }
    }

    return list;
  }, [dividends, isDateInPeriod, periodTransactions]);

  const periodBuysBRL = useMemo(
    () =>
      periodTransactions
        .filter((t) => t.type === "buy" || t.type === "subscription")
        .reduce((acc, t) => {
          const curr = assetCurrencyMap.get(t.asset_id);
          const rate = curr === "USD" ? usdRate : 1;
          const totalVal = t.total ?? (t.quantity * t.price);
          return acc + totalVal * rate;
        }, 0),
    [periodTransactions, assetCurrencyMap, usdRate],
  );

  const periodSellsBRL = useMemo(
    () =>
      periodTransactions
        .filter((t) => t.type === "sell")
        .reduce((acc, t) => {
          const curr = assetCurrencyMap.get(t.asset_id);
          const rate = curr === "USD" ? usdRate : 1;
          const totalVal = t.total ?? (t.quantity * t.price);
          return acc + totalVal * rate;
        }, 0),
    [periodTransactions, assetCurrencyMap, usdRate],
  );

  const periodDividendsAmountBRL = useMemo(
    () =>
      periodDividendsList.reduce((acc, d) => {
        const curr = d.asset_id ? assetCurrencyMap.get(d.asset_id) : "BRL";
        const rate = curr === "USD" ? usdRate : 1;
        return acc + d.amount * rate;
      }, 0),
    [periodDividendsList, assetCurrencyMap, usdRate],
  );

  const periodNetFlowBRL = periodBuysBRL - periodSellsBRL + periodDividendsAmountBRL;

  const periodFlowSummary = useMemo(
    () => ({
      buysBRL: periodBuysBRL,
      sellsBRL: periodSellsBRL,
      dividendsBRL: periodDividendsAmountBRL,
      netFlowBRL: periodNetFlowBRL,
      monthLabel: periodLabel,
    }),
    [periodBuysBRL, periodSellsBRL, periodDividendsAmountBRL, periodNetFlowBRL, periodLabel],
  );

  const selectedSnapshot = useMemo(() => {
    if (mode === "month") {
      return snapshots.find((s) => s.month === month) ?? null;
    }
    if (mode === "year") {
      const yearSnaps = snapshots
        .filter((s) => s.month.startsWith(String(year)))
        .sort((a, b) => b.month.localeCompare(a.month));
      return yearSnaps[0] ?? null;
    }
    if (mode === "custom" && debouncedCustomEnd) {
      const customEndMonth = debouncedCustomEnd.slice(0, 7);
      const inRangeSnaps = snapshots
        .filter((s) => s.month <= customEndMonth)
        .sort((a, b) => b.month.localeCompare(a.month));
      return inRangeSnaps[0] ?? null;
    }
    return null;
  }, [snapshots, mode, month, year, debouncedCustomEnd]);

  const isCurrentPeriod = useMemo(() => {
    if (mode === "month") return month === currentMonth();
    if (mode === "year") return year === currentYear();
    if (mode === "custom") return !!debouncedCustomEnd && debouncedCustomEnd >= todayISO();
    return true;
  }, [mode, month, year, debouncedCustomEnd]);

  const periodPatrimonyBRL = useMemo(() => {
    if (isCurrentPeriod) {
      return positionQuery.totalBRL ?? 0;
    }
    if (selectedSnapshot) {
      return Number(selectedSnapshot.total_value);
    }
    return 0;
  }, [isCurrentPeriod, positionQuery.totalBRL, selectedSnapshot]);

  const periodInvestedCostBRL = useMemo(() => {
    if (isCurrentPeriod) {
      return positionQuery.totalCostBRL ?? 0;
    }
    if (selectedSnapshot) {
      return Number(selectedSnapshot.total_cost);
    }
    return 0;
  }, [isCurrentPeriod, positionQuery.totalCostBRL, selectedSnapshot]);

  const totalPatrimonyBRL = periodPatrimonyBRL;
  const cashBalanceBRL = positionQuery.cashBRL ?? 0;
  const totalInvestedCostBRL = periodInvestedCostBRL;

  const periodRedemptions = useMemo(() => {
    return filterPeriodRedemptions({
      transactions,
      assets,
      mode,
      month,
      year,
      startDate: customValid ? debouncedCustomStart : undefined,
      endDate: customValid ? debouncedCustomEnd : undefined,
      usdRate,
    });
  }, [
    transactions,
    assets,
    mode,
    month,
    year,
    customValid,
    debouncedCustomStart,
    debouncedCustomEnd,
    usdRate,
  ]);

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

    const liquidReservesBRL =
      emergencyFund.composition.totalReserveCents > 0
        ? emergencyFund.composition.totalReserveCents / 100
        : cashBalanceBRL;

    return calculateFreedomIndex(
      monthlyDivs,
      monthlyExp,
      liquidReservesBRL,
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
  }, [yearDividendsBRL, monthlyExpenses.data, emergencyFund.composition.totalReserveCents, cashBalanceBRL, assets, usdRate]);

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

  const limitsByCategory = useMemo(
    () => budgetLimitsByCategory(budgetsQuery.data ?? []),
    [budgetsQuery.data],
  );

  const currentUserId = myFamilyQuery.data?.currentMember?.user_id;
  const householdData = isFamilyModeEnabled && mode === "month" ? familyConsolidationQuery.data : null;

  const householdSummary = useMemo(() => {
    if (!householdData || householdData.monthly_ceiling_cents <= 0) return null;
    const currentMemberSpent = householdData.members.find((m) => m.user_id === currentUserId);
    return {
      familyTitle: householdData.family.name,
      monthlyCeilingCents: householdData.monthly_ceiling_cents,
      totalSpentCents: householdData.total_spent_cents,
      spentPercentage: householdData.spent_percentage,
      userContributionCents: currentMemberSpent?.spent_cents ?? 0,
      userPercentageOfTotal: currentMemberSpent?.percentage_of_total ?? 0,
    };
  }, [householdData, currentUserId]);

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
    () => expenseEntries.reduce((acc, e) => acc + weightedCents(e.baseCents, e.weight), 0),
    [expenseEntries],
  );
  const currentIncomeCents = useMemo(
    () => incomeEntries.reduce((acc, e) => acc + weightedCents(e.baseCents, e.weight), 0),
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
        if (customValid && debouncedCustomStart && debouncedCustomEnd) return c.date >= debouncedCustomStart && c.date <= debouncedCustomEnd;
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
  }, [totalPatrimonyBRL, totalInvestedCostBRL, cashBalanceBRL, debts, currentIncomeCents, currentExpenseCents, contributions, mode, month, year, customValid, debouncedCustomStart, debouncedCustomEnd]);

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
        if (customValid && debouncedCustomStart && debouncedCustomEnd)
          return c.date >= debouncedCustomStart && c.date <= debouncedCustomEnd;
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
    debouncedCustomStart,
    debouncedCustomEnd,
    incomes,
    expenses,
  ]);

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
          const effectiveDivs = r.currency === "USD" ? (r.dividendsNative ?? (r.usdRate && r.usdRate > 0 ? r.dividends / r.usdRate : r.dividends)) : r.dividends;
          const effectiveCost = r.currency === "USD" ? (r.totalCost ?? (r.usdRate && r.usdRate > 0 && r.totalCostBRL ? r.totalCostBRL / r.usdRate : r.totalCostBRL)) : r.totalCostBRL;
          const yoc = effectiveCost > 0 && effectiveDivs > 0 ? (effectiveDivs / effectiveCost) * 100 : 0;
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
      dividends: dividends
        .filter((d) => isDateInPeriod(d.date))
        .map((d) => {
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
    isDateInPeriod,
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

  const isExcelDisabled = useMemo(() => {
    const hasCustody = (workbookData.positions?.length ?? 0) > 0;
    const hasDividends = (workbookData.dividends?.length ?? 0) > 0;
    const hasExpenses = expenses.length > 0;
    const hasIncomes = incomes.length > 0;
    const hasDebts = debts.length > 0;
    const hasRedemptions = periodRedemptions.length > 0;
    return !hasCustody && !hasDividends && !hasExpenses && !hasIncomes && !hasDebts && !hasRedemptions;
  }, [workbookData.positions, workbookData.dividends, expenses.length, incomes.length, debts.length, periodRedemptions.length]);

  const refetchAll = useCallback(() => {
    return Promise.all([
      monthlyExpenses.refetch(),
      monthlyIncomes.refetch(),
      prevExpenses.refetch(),
      prevIncomes.refetch(),
      yearExpenses.refetch(),
      yearIncomes.refetch(),
      debtsQuery.refetch(),
      categoriesQuery.refetch(),
      positionQuery.refetch(),
      snapshotsQuery.refetch(),
      assetsQuery.refetch(),
    ]);
  }, [
    monthlyExpenses,
    monthlyIncomes,
    prevExpenses,
    prevIncomes,
    yearExpenses,
    yearIncomes,
    debtsQuery,
    categoriesQuery,
    positionQuery,
    snapshotsQuery,
    assetsQuery,
  ]);

  return {
    periodLabel,
    isDateInPeriod,
    loading,
    error,
    expenses,
    incomes,
    expenseEntries,
    incomeEntries,
    byCategory,
    byMethod,
    byWeekday,
    limitsByCategory,
    householdSummary,
    grossExpenseBrutoCents,
    grossIncomeBrutoCents,
    grossSavingsBrutoCents,
    grossSavingsRatePercent,
    currentExpenseCents,
    currentIncomeCents,
    hasDualMetrics,
    consolidatedBalance,
    financialDRE,
    positionRows,
    cashBalanceBRL,
    totalPatrimonyBRL,
    allocationAnalysis,
    concentrationRisk,
    investmentDonutData,
    freedomAnalysis,
    workbookData,
    excelDescription,
    isExcelDisabled,
    positionQuery,
    refetchAll,
    periodFlowSummary,
    periodRedemptions,
    yearDividendsBRL,
    macroIndicatorsQuery,
    assetsQuery,
    dividends,
    assets,
    usdRate,
    transactions,
    categories,
  };
}
