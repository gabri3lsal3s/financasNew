import { useMemo } from "react";
import { todayISO } from "@/domain/debts";
import { buildCompetenceSummaries, invoiceDueDate } from "@/domain/cards";
import {
  analyzeCashGap,
  computeWeeklyDueRadar,
  dailyBudget,
  endOfMonthProjection,
  projectCardInvoiceObligations,
  spendingPace,
} from "@/domain/projection";
import {
  buildDailyFlow,
  buildDailyCumulativeSeries,
  calculateSurplusCapacity,
  computeOverview,
  shouldShowGoalAlert,
  shouldShowPaceAlert,
  shouldShowSurplusAlert,
} from "@/domain/overview";
import { numberToCents, sumGrossCents, sumWeightedCents } from "@/domain/money";
import { contributionsInMonthCents } from "@/domain/portfolio";
import {
  resolveGoalComposition,
  type AccountCompositionItem,
  type PortfolioAssetCompositionItem,
} from "@/domain/goals";
import { currentMonth, shiftMonth } from "@/lib/date";
import {
  useAllCardExpenses,
  useAllCardPayments,
  useBudgets,
  useCategories,
  useCreditCards,
  useDebts,
  useExpenses,
  useIncomes,
  useMyPublicShares,
  usePortfolioContributions,
  usePortfolioPosition,
  useRealCashBalance,
  useUserSubscription,
  useOnboardingCounts,
  useFamilyConsolidation,
  useFamilyMode,
  useMyFamily,
  useUserAccess,
  useCorporateDividends,
} from "@/state";
import { useUserTrips } from "@/state/queries/use-trips";
import { useOnboardingDismissed } from "@/hooks";
import { isFirstUse, shouldShowOnboardingBanner } from "@/domain/onboarding";
import type { DashboardAlertDismissals, GoalCompositionConfig } from "@/types";

interface SplitSharePayload {
  title?: string;
  total_cents?: number;
  people_count?: number;
  guest_share_cents?: number;
  is_completed?: boolean;
  debt_id?: string;
  expense_id?: string;
  participants?: Array<{
    name: string;
    share_cents: number;
    is_host: boolean;
    is_settled: boolean;
  }>;
}

export interface UseOverviewDataOptions {
  month: string;
  alertDismissals: DashboardAlertDismissals;
}

export function useOverviewData({ month, alertDismissals }: UseOverviewDataOptions) {
  const prevMonth = shiftMonth(month, -1);
  const rangeEnd = `${shiftMonth(month, 1)}-01`;
  const today = todayISO();
  const isCurrentMonth = month === currentMonth();

  // Queries TanStack
  const incomesQuery = useIncomes(month);
  const expensesQuery = useExpenses(month);
  const prevIncomesQuery = useIncomes(prevMonth);
  const prevExpensesQuery = useExpenses(prevMonth);

  const cardsQuery = useCreditCards();
  const budgetsQuery = useBudgets();
  const expenseCategories = useCategories("expense");
  const debtsQuery = useDebts();
  const cardExpensesQuery = useAllCardExpenses();
  const cardPaymentsQuery = useAllCardPayments();
  const contributionsQuery = usePortfolioContributions();
  const splitSharesQuery = useMyPublicShares("split");
  const goalSharesQuery = useMyPublicShares("goal_tracker");
  const tripsQuery = useUserTrips();

  const { isFamilyModeEnabled } = useFamilyMode();
  const myFamilyQuery = useMyFamily();
  const hasFamily = Boolean(isFamilyModeEnabled && myFamilyQuery.data?.family);
  const familyConsolidationQuery = useFamilyConsolidation(month, { enabled: hasFamily });
  const householdData = hasFamily ? familyConsolidationQuery.data : null;
  const currentUserId = myFamilyQuery.data?.currentMember?.user_id;

  const realCashData = useRealCashBalance(today);
  const portfolioPositionQuery = usePortfolioPosition();
  const rawPositionRows = portfolioPositionQuery?.rows;
  const positionRows = useMemo(() => rawPositionRows ?? [], [rawPositionRows]);
  const { hasFeature } = useUserAccess();
  const onboardingQuery = useOnboardingCounts();
  const corporateDividends = useCorporateDividends();
  const subscription = useUserSubscription();

  const { isDismissed: isOnboardingDismissed, dismiss: dismissOnboarding } = useOnboardingDismissed();

  const isVirginAccount = Boolean(onboardingQuery?.data && isFirstUse(onboardingQuery.data));
  const showOnboarding =
    !isOnboardingDismissed && onboardingQuery?.data
      ? shouldShowOnboardingBanner(onboardingQuery.data, hasFeature)
      : false;

  const loading =
    incomesQuery.isLoading ||
    expensesQuery.isLoading ||
    (isCurrentMonth && realCashData.isLoading);

  const error =
    incomesQuery.error ??
    expensesQuery.error ??
    (isCurrentMonth ? realCashData.error : null);

  // Computação pura dos totais do mês (§3.6)
  const {
    incomeCents,
    expenseCents,
    grossIncomeCents,
    grossExpenseCents,
    prevGrossIncomeCents,
    prevGrossExpenseCents,
    investmentCents,
    prevInvestmentCents,
    totals,
    prevTotals,
  } = useMemo(() => {
    const incCents = sumWeightedCents(incomesQuery.data ?? []);
    const expCents = sumWeightedCents(expensesQuery.data ?? []);
    const grossIncCents = sumGrossCents(incomesQuery.data ?? []);
    const grossExpCents = sumGrossCents(expensesQuery.data ?? []);
    const prevGrossIncCents = sumGrossCents(prevIncomesQuery.data ?? []);
    const prevGrossExpCents = sumGrossCents(prevExpensesQuery.data ?? []);

    const contribs = contributionsQuery.data ?? [];
    const invCents = contributionsInMonthCents(contribs, month);
    const prevInvCents = contributionsInMonthCents(contribs, prevMonth);

    const tot = computeOverview(grossIncCents, grossExpCents, invCents);
    const prevTot = computeOverview(prevGrossIncCents, prevGrossExpCents, prevInvCents);

    return {
      incomeCents: incCents,
      expenseCents: expCents,
      grossIncomeCents: grossIncCents,
      grossExpenseCents: grossExpCents,
      prevGrossIncomeCents: prevGrossIncCents,
      prevGrossExpenseCents: prevGrossExpCents,
      investmentCents: invCents,
      prevInvestmentCents: prevInvCents,
      totals: tot,
      prevTotals: prevTot,
    };
  }, [
    incomesQuery.data,
    expensesQuery.data,
    prevIncomesQuery.data,
    prevExpensesQuery.data,
    contributionsQuery.data,
    month,
    prevMonth,
  ]);

  // Fluxo diário + curva de saldo acumulado
  const dailyFlow = useMemo(() => {
    const contribs = contributionsQuery.data ?? [];
    const dailyItems = [
      ...(incomesQuery.data ?? []).map((i) => ({ date: i.date, kind: "income" as const, amountCents: numberToCents(i.value) })),
      ...(expensesQuery.data ?? []).map((e) => ({ date: e.date, kind: "expense" as const, amountCents: numberToCents(e.value) })),
      ...contribs
        .filter((c) => c.date.startsWith(month))
        .map((c) => ({ date: c.date, kind: "investment" as const, amountCents: numberToCents(c.amount) })),
    ];
    return buildDailyFlow(month, dailyItems);
  }, [incomesQuery.data, expensesQuery.data, contributionsQuery.data, month]);

  const dailySeries = useMemo(() => buildDailyCumulativeSeries(dailyFlow), [dailyFlow]);

  // Projeção e ritmo de gastos para o mês atual
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();

  const pace = useMemo(
    () =>
      isCurrentMonth
        ? spendingPace({
            spentCents: grossExpenseCents,
            monthlyBudgetCents: Math.max(1, grossIncomeCents),
            dayOfMonth,
            daysInMonth,
          })
        : { active: false, spentPercent: 0, elapsedPercent: 0, gapPoints: 0, ahead: false },
    [isCurrentMonth, grossExpenseCents, grossIncomeCents, dayOfMonth, daysInMonth],
  );

  const daily = useMemo(
    () =>
      isCurrentMonth
        ? dailyBudget({
            phase: "current",
            incomesCents: grossIncomeCents,
            investmentsCents: investmentCents,
            expensesCents: grossExpenseCents,
            dayOfMonth,
            daysInMonth,
          })
        : { dailyCents: null, monthlyNetCents: 0, daysRemaining: null },
    [isCurrentMonth, grossIncomeCents, investmentCents, grossExpenseCents, dayOfMonth, daysInMonth],
  );

  const projection = useMemo(
    () =>
      isCurrentMonth
        ? endOfMonthProjection({
            phase: "current",
            incomesCents: grossIncomeCents,
            investmentsCents: investmentCents,
            expensesCents: grossExpenseCents,
            dayOfMonth,
            daysInMonth,
          })
        : { projectedExpensesCents: null, surplusCents: null, onTrack: null, burnRateCents: null },
    [isCurrentMonth, grossIncomeCents, investmentCents, grossExpenseCents, dayOfMonth, daysInMonth],
  );

  const showPaceAlert =
    isCurrentMonth &&
    pace.active &&
    (pace.ahead || projection.onTrack === false || (projection.surplusCents !== null && projection.surplusCents < 0));

  const surplusCapacity = useMemo(
    () =>
      calculateSurplusCapacity({
        incomeCents: totals.incomeCents,
        expenseCents: totals.expenseCents,
        openInvoicesCents: realCashData.safeToSpend.committedObligationsCents,
        contributionsAlreadyMadeCents: totals.investmentCents,
        safeToSpendCents: realCashData.safeToSpend.safeToSpendCents,
      }),
    [totals, realCashData.safeToSpend],
  );

  const cashGapResult = useMemo(
    () =>
      analyzeCashGap({
        currentBalanceCents: realCashData.cashBalance.currentBalanceCents,
        today,
        obligations: [
          ...projectCardInvoiceObligations({
            cards: cardsQuery.data ?? [],
            expenses: cardExpensesQuery.data ?? [],
            payments: cardPaymentsQuery.data ?? [],
            today,
            currentMonth: month,
          }),
          ...(debtsQuery.data ?? [])
            .filter((d) => d.type === "payable" && !d.paid_at && d.due_date && d.due_date < rangeEnd)
            .map((d) => ({
              id: `debt-${d.id}`,
              name: d.name,
              dueDate: d.due_date < today ? today : d.due_date,
              amountCents: numberToCents(d.amount),
              kind: "debt" as const,
            })),
        ],
        inflows: [
          ...(debtsQuery.data ?? [])
            .filter((d) => d.type === "receivable" && !d.paid_at && d.due_date && d.due_date >= today)
            .map((d) => ({
              id: `recv-${d.id}`,
              name: d.name,
              expectedDate: d.due_date,
              amountCents: numberToCents(d.amount),
            })),
          ...(incomesQuery.data ?? [])
            .filter((i) => i.date >= today)
            .map((i) => ({
              id: `income-${i.id}`,
              name: "Renda prevista",
              expectedDate: i.date,
              amountCents: Math.round(i.value * 100),
            })),
        ],
      }),
    [
      realCashData.cashBalance.currentBalanceCents,
      today,
      cardsQuery.data,
      cardExpensesQuery.data,
      cardPaymentsQuery.data,
      month,
      debtsQuery.data,
      rangeEnd,
      incomesQuery.data,
    ],
  );

  const weeklyRadarSummary = useMemo(() => {
    if (
      cardsQuery.isLoading ||
      cardExpensesQuery.isLoading ||
      cardPaymentsQuery.isLoading ||
      debtsQuery.isLoading ||
      !cardsQuery.data ||
      !cardExpensesQuery.data ||
      !cardPaymentsQuery.data ||
      !debtsQuery.data
    ) {
      return {
        items: [],
        totalDueCents: 0,
        realCashCents: realCashData.cashBalance.currentBalanceCents,
        freeBalanceCents: realCashData.cashBalance.currentBalanceCents,
        isDeficitRisk: false,
        hasObligations: false,
      };
    }

    const cards = cardsQuery.data;
    const allExpenses = cardExpensesQuery.data;
    const allPayments = cardPaymentsQuery.data;
    const allDebts = debtsQuery.data;

    const invoices = cards
      .filter((card) => card.is_active)
      .flatMap((card) => {
        const expenses = allExpenses.filter((e) => e.card_id === card.id);
        const payments = allPayments.filter((p) => p.card_id === card.id);
        return buildCompetenceSummaries(expenses, payments)
          .filter((summary) => summary.saldoCents > 0)
          .map((summary) => ({
            id: `bill:${card.id}:${summary.month}`,
            name: summary.month === month ? `Fatura ${card.name}` : `Fatura ${card.name} (${summary.month})`,
            dueDate: invoiceDueDate(summary.month, card.due_day),
            amountCents: summary.saldoCents,
            cardId: card.id,
            competenceMonth: summary.month,
          }));
      });

    return computeWeeklyDueRadar({
      today,
      realCashCents: realCashData.cashBalance.currentBalanceCents,
      debts: allDebts,
      invoices,
    });
  }, [
    today,
    realCashData.cashBalance.currentBalanceCents,
    cardsQuery.isLoading,
    cardExpensesQuery.isLoading,
    cardPaymentsQuery.isLoading,
    debtsQuery.isLoading,
    cardsQuery.data,
    cardExpensesQuery.data,
    cardPaymentsQuery.data,
    debtsQuery.data,
    month,
  ]);

  // Apuração de Rachas a receber pendentes
  const splitPendingData = useMemo(() => {
    const debts = debtsQuery.data ?? [];
    const splitShares = splitSharesQuery.data ?? [];
    if (splitShares.length === 0 && debts.length === 0) {
      return { count: 0, pendingCents: 0, totalExpensesCents: 0, items: [] };
    }

    let count = 0;
    let pendingCents = 0;
    let totalExpensesCents = 0;
    const items: Array<{
      id: string;
      title: string;
      pendingCents: number;
      pendingFriendsCount: number;
      totalFriendsCount: number;
    }> = [];

    const debtMap = new Map(debts.map((d) => [d.id, d]));
    const expenseDebtMap = new Map(
      debts.filter((d) => d.type === "receivable" && d.expense_id).map((d) => [d.expense_id!, d]),
    );
    const mappedDebtIds = new Set<string>();
    const mappedExpenseIds = new Set<string>();

    for (const share of splitShares) {
      if (share.is_revoked) continue;
      const payload = (share.payload ?? {}) as unknown as SplitSharePayload;
      const debtId = payload?.debt_id;
      const expenseId = payload?.expense_id;
      if (debtId) mappedDebtIds.add(debtId);
      if (expenseId) mappedExpenseIds.add(expenseId);

      const isCompleted = Boolean(payload?.is_completed);

      const debt = (debtId ? debtMap.get(debtId) : null) || (expenseId ? expenseDebtMap.get(expenseId) : null);
      if (debt) mappedDebtIds.add(debt.id);

      const isSettled = isCompleted || (debt ? Boolean(debt.paid_at) : false);

      if (isSettled) continue;

      const participants = payload.participants ?? [];
      const friends = participants.filter((p) => !p.is_host);
      const guestCount = Math.max(1, Number(payload.people_count ?? 2) - 1);
      const guestShareCents = Number(payload.guest_share_cents ?? 0);

      const totalFriendsCount = friends.length > 0 ? friends.length : guestCount;
      const pendingFriendsCount =
        friends.length > 0
          ? friends.filter((f) => !f.is_settled).length
          : guestCount;
      const pendingForThisSplit =
        friends.length > 0
          ? friends.reduce((acc, f) => acc + (f.is_settled ? 0 : Number(f.share_cents)), 0)
          : guestShareCents * guestCount;

      if (pendingForThisSplit > 0) {
        count += 1;
        pendingCents += pendingForThisSplit;
        totalExpensesCents += Number(payload.total_cents ?? (guestShareCents * Number(payload.people_count ?? 2)));
        items.push({
          id: share.id,
          title: payload.title?.trim() || "Despesa",
          pendingCents: pendingForThisSplit,
          pendingFriendsCount,
          totalFriendsCount,
        });
      }
    }

    // Computa dívidas de racha a receber pendentes que ainda não possuem public_share
    for (const debt of debts) {
      if (debt.type !== "receivable" || debt.paid_at) continue;
      if (mappedDebtIds.has(debt.id)) continue;
      if (debt.expense_id && mappedExpenseIds.has(debt.expense_id)) continue;
      if (!debt.name.toLowerCase().startsWith("racha:") && !debt.name.toLowerCase().includes("racha")) continue;

      const debtCents = Math.round(debt.amount * 100);
      if (debtCents > 0) {
        count += 1;
        pendingCents += debtCents;
        totalExpensesCents += debtCents;
        items.push({
          id: `debt_${debt.id}`,
          title: debt.name.replace(/^racha:\s*/i, "").trim() || "Despesa",
          pendingCents: debtCents,
          pendingFriendsCount: 1,
          totalFriendsCount: 1,
        });
      }
    }

    return { count, pendingCents, totalExpensesCents, items };
  }, [debtsQuery.data, splitSharesQuery.data]);

  // Cálculo reativo e instantâneo do progresso de metas patrimoniais
  const liveGoalProgress = useMemo(() => {
    const currentBalance = Math.max(0, realCashData.cashBalance.currentBalanceCents);
    const accounts: AccountCompositionItem[] = [
      {
        id: "main_cash",
        name: "Saldo em Conta Corrente / Caixa Geral",
        balanceCents: currentBalance,
        pendingObligationsCents: 0,
      },
    ];

    const assets: PortfolioAssetCompositionItem[] = positionRows
      .filter((r) => r.quantity > 0 || r.valueBRL > 0)
      .map((r) => ({
        id: r.assetId,
        ticker: r.ticker,
        assetClass: r.assetClass,
        quantity: r.quantity > 0 ? r.quantity : 1,
        valueCents: Math.round(r.valueBRL * 100),
        totalCostCents: Math.round(r.totalCostBRL * 100),
      }));

    const map = new Map<string, { currentCents: number; percentage: number; isCompleted: boolean }>();
    const allShares = goalSharesQuery.data ?? [];

    for (const share of allShares) {
      const payload = (share.payload as Record<string, unknown> | null) ?? {};
      const config = payload.composition_config as GoalCompositionConfig | undefined;
      const targetCents = Number(payload.target_cents ?? 0);
      const isCompletedInDb = payload.status === "completed";

      if (config) {
        const resolved = resolveGoalComposition({
          config,
          targetCents,
          accounts,
          assets,
          previouslyLockedAsCompleted: isCompletedInDb && targetCents > 0 ? false : isCompletedInDb,
        });

        const isActuallyCompleted =
          targetCents > 0 ? resolved.currentCents >= targetCents : isCompletedInDb;

        map.set(share.id, {
          currentCents: resolved.currentCents,
          percentage: Math.round(resolved.progressPercent),
          isCompleted: isActuallyCompleted,
        });
      } else {
        const currentCents = Number(payload.current_cents ?? 0);
        const percentage = targetCents > 0 ? Math.round((currentCents / targetCents) * 100) : 0;
        const isActuallyCompleted =
          targetCents > 0 ? currentCents >= targetCents : isCompletedInDb;

        map.set(share.id, {
          currentCents,
          percentage,
          isCompleted: isActuallyCompleted,
        });
      }
    }

    return map;
  }, [realCashData.cashBalance.currentBalanceCents, positionRows, goalSharesQuery.data]);

  // Apuração de metas ativas e elegíveis organizadas no carrossel
  const eligibleGoalShares = useMemo(() => {
    const goalShares = goalSharesQuery.data ?? [];
    if (goalShares.length === 0) return [];

    const activeList = goalShares.filter(
      (s) => (s.payload as Record<string, unknown> | null)?.status !== "archived",
    );
    if (activeList.length === 0) return [];

    const eligibleList = activeList.filter((s) => {
      const pld = (s.payload as Record<string, unknown> | null) ?? {};
      const targetCents = Number(pld.target_cents ?? 0);
      const live = liveGoalProgress.get(s.id)?.currentCents;
      const currentCents = live !== undefined ? live : Number(pld.current_cents ?? 0);
      const percentage = targetCents > 0 ? Math.round((currentCents / targetCents) * 100) : 0;
      const isCompleted = targetCents > 0 ? currentCents >= targetCents : pld.status === "completed";
      const isFinalStretch = percentage >= 80 && !isCompleted;
      const stage: "completed" | "final_stretch" | "has_surplus" | "regular" = isCompleted
        ? "completed"
        : isFinalStretch
          ? "final_stretch"
          : surplusCapacity.hasSurplus
            ? "has_surplus"
            : "regular";

      const checkpoint = alertDismissals.goals?.[s.id];
      return shouldShowGoalAlert(checkpoint, {
        goalId: s.id,
        currentCents,
        targetCents,
        percentage,
        stage,
      });
    });

    return eligibleList;
  }, [goalSharesQuery.data, liveGoalProgress, surplusCapacity.hasSurplus, alertDismissals.goals]);

  // Viagens ativas em andamento
  const activeTrips = useMemo(() => {
    return (tripsQuery.data ?? []).filter((t) => t.status === "active");
  }, [tripsQuery.data]);

  const isPaceEligible = shouldShowPaceAlert(alertDismissals.pace, {
    month,
    spentPercent: pace.spentPercent,
    surplusCents: projection.surplusCents,
  });

  const isSurplusEligible = shouldShowSurplusAlert(alertDismissals.surplus, {
    month,
    surplusCents: surplusCapacity.suggestedAporteCents,
  });

  return {
    month,
    prevMonth,
    rangeEnd,
    today,
    isCurrentMonth,
    loading,
    error,
    hasFeature,
    onboardingQuery,
    // Totais e Cálculos
    incomeCents,
    expenseCents,
    grossIncomeCents,
    grossExpenseCents,
    prevGrossIncomeCents,
    prevGrossExpenseCents,
    investmentCents,
    prevInvestmentCents,
    totals,
    prevTotals,
    // Fluxos e Projeções
    dailyFlow,
    dailySeries,
    pace,
    daily,
    projection,
    showPaceAlert,
    isPaceEligible,
    surplusCapacity,
    isSurplusEligible,
    cashGapResult,
    weeklyRadarSummary,
    splitPendingData,
    eligibleGoalShares,
    liveGoalProgress,
    activeTrips,
    // Família
    hasFamily,
    householdData,
    currentUserId,
    // Onboarding
    isVirginAccount,
    showOnboarding,
    dismissOnboarding,
    // Assinaturas e Proventos
    corporateDividends,
    subscription,
    // Queries brutas para renderização complementar
    realCashData,
    positionRows,
    budgetsQuery,
    expenseCategories,
    cardsQuery,
    debtsQuery,
    incomesQuery,
    expensesQuery,
    prevExpensesQuery,
  };
}
