import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { DollarSign, HeartHandshake, Inbox, PieChart, Plus, TrendingDown, TrendingUp, X } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, MoneyText, SkeletonChart, SkeletonHeroCard, SkeletonKpi } from "@/components/ui";
import {
  CategoryDonut,
  DashboardAlertsCarousel,
  type DashboardAlertItem,
  DeltaHint,
  KpiCard,
  KpiGrid,
  MonthPicker,
  PaceAlertBanner,
  RealCashHeroCard,
  SurplusAporteBanner,
  CashGapAlert,
  ReadOnlyBanner,
  TrialEndingBanner,
  PendingSuggestionsCard,
  PendingSplitSignalsCard,
  AutoRegisteredBanner,
  SmartAdvisorCard,
  QuickAporteCard,
  QuickBalanceAdjustmentModal,
  OnboardingBanner,
  WelcomeFeatureModal,
  WelcomeModal,
  DemoTrackSelectModal,
  PermissionsAlertBanner,
  WeeklyDueRadarCard,
} from "@/components/modules";
import { isFirstUse, shouldShowOnboardingBanner } from "@/domain/onboarding";
import {
  budgetLimitsByCategory,
  isInheritedLimit,
  resolveEffectiveLimit,
  spentByCategoryMap,
  spentGrossByCategoryMap,
} from "@/domain/budgets";
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
  createGoalDismissalCheckpoint,
  createPaceDismissalCheckpoint,
  createSurplusDismissalCheckpoint,
  createZeroGuiltDismissalCheckpoint,
  shouldShowGoalAlert,
  shouldShowPaceAlert,
  shouldShowSurplusAlert,
  shouldShowZeroGuiltAlert,
} from "@/domain/overview";
import { numberToCents, sumGrossCents, sumWeightedCents } from "@/domain/money";
import { contributionsInMonthCents } from "@/domain/portfolio";
import {
  resolveGoalComposition,
  type AccountCompositionItem,
  type PortfolioAssetCompositionItem,
} from "@/domain/goals";

import { currentMonth, monthLabel, shiftMonth } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
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
  hasSeenWelcomeModal,
  useFamilyConsolidation,
  useFamilyMode,
  useMyFamily,
} from "@/state";
import type { GoalCompositionConfig } from "@/types";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { useOnboardingDismissed, usePendingSplitExpense, usePendingSimulation } from "@/hooks";
import { CashCheckpointDialog } from "@/components/modules/cash-checkpoint-dialog";
import { cn } from "@/lib/utils";
import {
  CategoryBreakdownDialog,
  OtherBudgetsDialog,
  OtherCategoriesDialog,
  SplitPendingBanner,
  GoalProgressAlertBanner,
  HouseholdAlertBanner,
  OverviewDailyFlowSection,
  OverviewBudgetsSection,
} from "../components";
import { useDashboardAlertDismissals, useOverviewPermissionsBanner } from "../hooks";
import { triggerSensory } from "@/services/sensory";
import { AddContributionDialog } from "@/features/goals";
import type { GoalAlertStage, PublicShare, SplitSharePayload } from "@/types";

export function OverviewPage() {
  usePendingSplitExpense();
  usePendingSimulation();

  const [month, setMonth] = useState(currentMonth);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isOthersBudgetOpen, setIsOthersBudgetOpen] = useState(false);
  const [isOtherCategoriesOpen, setIsOtherCategoriesOpen] = useState(false);
  const navigate = useNavigate();
  const subscription = useUserSubscription();
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [depositGoalShare, setDepositGoalShare] = useState<PublicShare | null>(null);
  const { guardAction, upgradeModal } = useMutationGuard();

  const prevMonth = shiftMonth(month, -1);
  const rangeEnd = `${shiftMonth(month, 1)}-01`;
  const today = todayISO();
  const isCurrentMonth = month === currentMonth();

  // Queries TanStack (state).
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
  const onboardingQuery = useOnboardingCounts();

  const { isDismissed: isOnboardingDismissed, dismiss: dismissOnboarding } = useOnboardingDismissed();


  // Acolhimento no primeiro login (§4.1): detecta conta virgem e abre o WelcomeModal sem cascading render
  const isVirginAccount = Boolean(onboardingQuery?.data && isFirstUse(onboardingQuery.data));
  const shouldOpenWelcome = isVirginAccount && !hasSeenWelcomeModal();
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const welcomeModalOpen = shouldOpenWelcome && !welcomeDismissed;
  const [demoTrackModalOpen, setDemoTrackModalOpen] = useState(false);

  const showOnboarding =
    !isOnboardingDismissed && onboardingQuery?.data
      ? shouldShowOnboardingBanner(onboardingQuery.data)
      : false;

  const { alertDismissals, updateAlertDismissals } = useDashboardAlertDismissals();
  const {
    shouldShowPermissionsBanner,
    permissionBannerType,
    handlePermissionsBannerAction,
    handlePermissionsBannerDismiss,
  } = useOverviewPermissionsBanner(navigate);

  // Isolamento de erros críticos (§Fase 4): a tela só bloqueia se o fluxo financeiro base falhar
  const loading =
    incomesQuery.isLoading ||
    expensesQuery.isLoading ||
    (isCurrentMonth && realCashData.isLoading);

  const error =
    incomesQuery.error ??
    expensesQuery.error ??
    (isCurrentMonth ? realCashData.error : null);

  // Computação pura dos totais do mês (§3.6). Padrão do app: BRUTO como métrica principal, informando ponderado quando houver.
  const {
    incomeCents,
    expenseCents,
    grossIncomeCents,
    grossExpenseCents,
    investmentCents,
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


  // Fluxo diário (barras empilhadas) + curva de saldo acumulado.
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

  // Séries acumuladas diárias para os sparklines dos KPIs (evolução do mês atual).
  const dailySeries = useMemo(() => buildDailyCumulativeSeries(dailyFlow), [dailyFlow]);

  // Orçamentos compactos (§3.6): barra segmentada consolidada e diagnóstico executivo.
  // Métrica principal: gasto efetivo ponderado (alinhado com Orçamentos e Categorias).
  const {
    limitsByCategory,
    spentWeightedByCategory,
    spentGrossByCategory,
    budgetRows,
    otherBudgetRows,
    totalLimitsCents,
    totalRemainingCents,
    globalPercent,
    budgetSegments,
  } = useMemo(() => {
    const budgets = budgetsQuery.data ?? [];
    const limits = budgetLimitsByCategory(budgets);
    const spentWeighted = spentByCategoryMap(expensesQuery.data ?? []);
    const spentGross = spentGrossByCategoryMap(expensesQuery.data ?? []);
    const rows = (expenseCategories.data ?? [])
      .map((category) => {
        const spentWeightedCents = spentWeighted.get(category.id) ?? 0;
        const limitCents = resolveEffectiveLimit(limits.get(category.id) ?? [], month);
        return {
          category,
          limitCents,
          spentCents: spentWeightedCents,
          remainingCents: limitCents - spentWeightedCents,
          percent: limitCents > 0 ? (spentWeightedCents / limitCents) * 100 : 0,
          inherited: isInheritedLimit(limits.get(category.id) ?? [], month),
        };
      })
      .filter((row) => row.limitCents > 0);
    const totalLimits = rows.reduce((acc, row) => acc + row.limitCents, 0);
    const totalBudgetedSpent = rows.reduce((acc, row) => acc + row.spentCents, 0);
    const totalRemaining = totalLimits - totalBudgetedSpent;
    const gPercent = totalLimits > 0 ? (totalBudgetedSpent / totalLimits) * 100 : 0;

    // Segmentos da Barra Única:
    const segmentBaseCents = Math.max(1, totalLimits, totalBudgetedSpent);
    const activeBudgetSpentRows = [...rows]
      .filter((r) => r.spentCents > 0)
      .sort((a, b) => b.spentCents - a.spentCents);
    const topBudgetSegments = activeBudgetSpentRows.slice(0, 4);
    const otherBudgetRows = activeBudgetSpentRows.slice(4);
    const otherBudgetSpentCents = otherBudgetRows.reduce((acc, r) => acc + r.spentCents, 0);
    const segments = [
      ...topBudgetSegments.map((row) => ({
        id: row.category.id,
        label: row.category.name,
        color: row.category.color ?? undefined,
        spentCents: row.spentCents,
        percent: (row.spentCents / segmentBaseCents) * 100,
      })),
      ...(otherBudgetSpentCents > 0
        ? [
            {
              id: "others",
              label: "Outros",
              color: "#64748b",
              spentCents: otherBudgetSpentCents,
              percent: (otherBudgetSpentCents / segmentBaseCents) * 100,
            },
          ]
        : []),
    ];

    return {
      limitsByCategory: limits,
      spentWeightedByCategory: spentWeighted,
      spentGrossByCategory: spentGross,
      budgetRows: rows,
      otherBudgetRows,
      totalLimitsCents: totalLimits,
      totalRemainingCents: totalRemaining,
      globalPercent: gPercent,
      budgetSegments: segments,
    };
  }, [budgetsQuery.data, expensesQuery.data, expenseCategories.data, month]);

  // Donut de categorias: Top 5 individuais + grupo 'Demais categorias' para fechar 100% das despesas brutas
  const { donutSlices, otherCategoriesRows, totalActiveCategoriesCount } = useMemo(() => {
    const categories = expenseCategories.data ?? [];
    const activeRows = categories
      .map((category) => {
        const spentGrossCents = spentGrossByCategory.get(category.id) ?? 0;
        return {
          category,
          spentGrossCents,
          percent: grossExpenseCents > 0 ? (spentGrossCents / grossExpenseCents) * 100 : 0,
        };
      })
      .filter((row) => row.spentGrossCents > 0)
      .sort((a, b) => b.spentGrossCents - a.spentGrossCents);

    const top5 = activeRows.slice(0, 5);
    const others = activeRows.slice(5);

    const top5SpentCents = top5.reduce((acc, r) => acc + r.spentGrossCents, 0);
    // Garante fechamento de 100% com o total de despesas brutas (grossExpenseCents):
    const othersSpentCents = Math.max(0, grossExpenseCents - top5SpentCents);

    const slices = top5.map((row) => ({
      key: row.category.id,
      label: row.category.name,
      valueCents: row.spentGrossCents,
      icon: row.category.icon,
      color: row.category.color,
      onClick: () => setSelectedCategoryId(row.category.id),
    }));

    if (others.length > 0 || othersSpentCents > 0) {
      const othersCount = others.length;
      slices.push({
        key: "__other_categories__",
        label: othersCount > 0 ? `Demais (${othersCount})` : "Demais",
        valueCents: othersSpentCents,
        icon: "layers",
        color: "#64748b",
        onClick: () => setIsOtherCategoriesOpen(true),
      });
    }

    return {
      donutSlices: slices,
      otherCategoriesRows: others,
      totalActiveCategoriesCount: activeRows.length,
    };
  }, [expenseCategories.data, spentGrossByCategory, grossExpenseCents]);

  // Detalhes da Categoria Selecionada para o Diálogo de Raio-X
  const prevSpentWeightedByCategory = spentByCategoryMap(prevExpensesQuery.data ?? []);
  const selectedCategory = (expenseCategories.data ?? []).find((c) => c.id === selectedCategoryId) ?? null;
  const selectedLimitCents = selectedCategory
    ? resolveEffectiveLimit(limitsByCategory.get(selectedCategory.id) ?? [], month)
    : 0;
  const selectedSpentWeightedCents = selectedCategory ? (spentWeightedByCategory.get(selectedCategory.id) ?? 0) : 0;
  const selectedSpentGrossCents = selectedCategory ? (spentGrossByCategory.get(selectedCategory.id) ?? 0) : 0;
  const selectedPrevSpentWeightedCents = selectedCategory
    ? (prevSpentWeightedByCategory.get(selectedCategory.id) ?? 0)
    : 0;
  const selectedExpenses = (expensesQuery.data ?? []).filter((e) => e.category_id === selectedCategoryId);

  // Projeção e ritmo de gastos (§3.8) para o mês atual.
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
    // Salvaguarda estrita de hidratação: nunca processa o radar de vencimentos se as queries
    // essenciais de cartões, despesas, pagamentos e dívidas estiverem carregando ou com dados nulos
    // (evitando que faturas quitadas apareçam como vencidas com o saldo nominal original).
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

    // Apuração canônica e auditada de faturas em aberto (§3.3.3 / §4.3)
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
    if (splitShares.length === 0) return { count: 0, pendingCents: 0, totalExpensesCents: 0, items: [] };

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

    // Mapa de dívidas por expense_id e debt_id
    const debtMap = new Map(debts.map((d) => [d.id, d]));
    const expenseDebtMap = new Map(
      debts.filter((d) => d.type === "receivable" && d.expense_id).map((d) => [d.expense_id!, d]),
    );

    for (const share of splitShares) {
      if (share.is_revoked) continue;
      const payload = (share.payload ?? {}) as unknown as SplitSharePayload;
      const debtId = payload?.debt_id;
      const expenseId = payload?.expense_id;
      const isCompleted = Boolean(payload?.is_completed);

      const debt = (debtId ? debtMap.get(debtId) : null) || (expenseId ? expenseDebtMap.get(expenseId) : null);
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

    return { count, pendingCents, totalExpensesCents, items };
  }, [debtsQuery.data, splitSharesQuery.data]);

  // Cálculo reativo e instantâneo do progresso de metas patrimoniais (§Plano 12)
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

  // Apuração de metas ativas e elegíveis organizadas no carrossel (§Plano 12)
  const eligibleGoalShares = useMemo(() => {
    const goalShares = goalSharesQuery.data ?? [];
    if (goalShares.length === 0) return [];

    const activeList = goalShares.filter(
      (s) => (s.payload as Record<string, unknown> | null)?.status !== "archived",
    );
    if (activeList.length === 0) return [];

    // Filtra metas que foram dispensadas e não tiveram mudança relevante
    const eligibleList = activeList.filter((s) => {
      const pld = (s.payload as Record<string, unknown> | null) ?? {};
      const targetCents = Number(pld.target_cents ?? 0);
      const live = liveGoalProgress.get(s.id)?.currentCents;
      const currentCents = live !== undefined ? live : Number(pld.current_cents ?? 0);
      const percentage = targetCents > 0 ? Math.round((currentCents / targetCents) * 100) : 0;
      const isCompleted = targetCents > 0 ? currentCents >= targetCents : pld.status === "completed";
      const isFinalStretch = percentage >= 80 && !isCompleted;
      const stage: GoalAlertStage = isCompleted
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
        status: pld.status as string | undefined,
      });
    });

    // Ordena: reta final (>= 80% e < 100%) primeiro, depois maior percentual
    return [...eligibleList].sort((a, b) => {
      const pldA = (a.payload as Record<string, unknown> | null) ?? {};
      const pldB = (b.payload as Record<string, unknown> | null) ?? {};
      const tA = Number(pldA.target_cents ?? 0);
      const liveA = liveGoalProgress.get(a.id)?.currentCents;
      const cA = liveA !== undefined ? liveA : Number(pldA.current_cents ?? 0);
      const tB = Number(pldB.target_cents ?? 0);
      const liveB = liveGoalProgress.get(b.id)?.currentCents;
      const cB = liveB !== undefined ? liveB : Number(pldB.current_cents ?? 0);
      const pctA = tA > 0 ? cA / tA : 0;
      const pctB = tB > 0 ? cB / tB : 0;
      const isFinalA = pctA >= 0.8 && pctA < 1 ? 1 : 0;
      const isFinalB = pctB >= 0.8 && pctB < 1 ? 1 : 0;
      if (isFinalA !== isFinalB) return isFinalB - isFinalA;
      return pctB - pctA;
    });
  }, [goalSharesQuery.data, liveGoalProgress, surplusCapacity.hasSurplus, alertDismissals.goals]);

  const handleDismissGoal = useCallback(
    (share: PublicShare) => {
      const pld = (share.payload as Record<string, unknown> | null) ?? {};
      const targetCents = Number(pld.target_cents ?? 0);
      const live = liveGoalProgress.get(share.id)?.currentCents;
      const currentCents = live !== undefined ? live : Number(pld.current_cents ?? 0);
      const percentage = targetCents > 0 ? Math.round((currentCents / targetCents) * 100) : 0;
      const isCompleted = targetCents > 0 ? currentCents >= targetCents : pld.status === "completed";
      const isFinalStretch = percentage >= 80 && !isCompleted;
      const stage: GoalAlertStage = isCompleted
        ? "completed"
        : isFinalStretch
          ? "final_stretch"
          : surplusCapacity.hasSurplus
            ? "has_surplus"
            : "regular";

      const checkpoint = createGoalDismissalCheckpoint({
        goalId: share.id,
        currentCents,
        targetCents,
        percentage,
        stage,
        status: pld.status as string | undefined,
      });

      updateAlertDismissals((prev) => ({
        ...prev,
        goals: {
          ...(prev.goals ?? {}),
          [share.id]: checkpoint,
        },
      }));
    },
    [liveGoalProgress, surplusCapacity.hasSurplus, updateAlertDismissals],
  );

  const handleDismissPace = useCallback(() => {
    const checkpoint = createPaceDismissalCheckpoint({
      month,
      spentPercent: pace.spentPercent,
      surplusCents: projection.surplusCents,
    });
    updateAlertDismissals((prev) => ({
      ...prev,
      pace: checkpoint,
    }));
  }, [month, pace.spentPercent, projection.surplusCents, updateAlertDismissals]);

  const handleDismissSurplus = useCallback(() => {
    const checkpoint = createSurplusDismissalCheckpoint({
      month,
      surplusCents: surplusCapacity.suggestedAporteCents,
    });
    updateAlertDismissals((prev) => ({
      ...prev,
      surplus: checkpoint,
    }));
  }, [month, surplusCapacity.suggestedAporteCents, updateAlertDismissals]);

  const handleDismissZeroGuilt = useCallback(() => {
    triggerSensory("action");
    const checkpoint = createZeroGuiltDismissalCheckpoint(todayISO());
    updateAlertDismissals((prev) => ({
      ...prev,
      zeroGuilt: checkpoint,
    }));
  }, [updateAlertDismissals]);

  const [zeroGuiltModalOpen, setZeroGuiltModalOpen] = useState(false);

  // Detector de Inatividade (>= 4 dias sem lançar no mês corrente)
  const isInactive = useMemo(() => {
    if (!isCurrentMonth) return false;
    const allExpenses = expensesQuery.data ?? [];
    const allIncomes = incomesQuery.data ?? [];
    if (allExpenses.length === 0 && allIncomes.length === 0) return false;

    let latestTimestamp = 0;
    for (const exp of allExpenses) {
      const ts = new Date(exp.date).getTime();
      if (ts > latestTimestamp) latestTimestamp = ts;
    }
    for (const inc of allIncomes) {
      const ts = new Date(inc.date).getTime();
      if (ts > latestTimestamp) latestTimestamp = ts;
    }

    if (latestTimestamp === 0) return false;
    const currentDayTs = new Date(`${todayISO()}T12:00:00Z`).getTime();
    const diffDays = Math.floor((currentDayTs - latestTimestamp) / (1000 * 60 * 60 * 24));
    return diffDays >= 4;
  }, [isCurrentMonth, expensesQuery.data, incomesQuery.data]);

  const isZeroGuiltEligible = shouldShowZeroGuiltAlert(alertDismissals.zeroGuilt, todayISO());
  const isPaceEligible = shouldShowPaceAlert(alertDismissals.pace, {
    month,
    spentPercent: pace.spentPercent,
    surplusCents: projection.surplusCents,
  });
  const isSurplusEligible = shouldShowSurplusAlert(alertDismissals.surplus, {
    month,
    surplusCents: surplusCapacity.suggestedAporteCents,
  });

  const alertItems: (DashboardAlertItem | null | undefined | false)[] = [
    shouldShowPermissionsBanner && {
      id: "permissions-health-banner",
      priority: 1,
      content: (
        <PermissionsAlertBanner
          type={permissionBannerType}
          onAction={handlePermissionsBannerAction}
          onDismiss={handlePermissionsBannerDismiss}
        />
      ),
    },
    isInactive && isZeroGuiltEligible && {
      id: "zero-guilt-balance-alignment",
      priority: 2,
      content: (
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 p-3.5 sm:p-4 rounded-2xl border border-primary/20 bg-primary/5 shadow-xs">
          <div className="flex items-center gap-3 min-w-0 pr-6 sm:pr-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary-strong">
              <HeartHandshake className="size-4.5" aria-hidden="true" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground truncate">
                  Alinhamento de Saldo em 60s
                </span>
                <Badge variant="muted" size="xs">
                  Zero Culpa
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Sem tempo para lançar tudo? Sincronize seu saldo e Safe-to-Spend em 1 clique.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-center mt-auto sm:mt-0">
            <Button
              type="button"
              size="sm"
              onClick={() => setZeroGuiltModalOpen(true)}
              className="shrink-0 self-stretch sm:self-center font-semibold cursor-pointer"
            >
              Alinhar Saldo
            </Button>
            <button
              type="button"
              onClick={handleDismissZeroGuilt}
              className="absolute top-3 right-3 sm:static flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer shrink-0"
              aria-label="Dispensar aviso de alinhamento"
              title="Dispensar aviso"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ),
    },
    Boolean(householdData && householdData.monthly_ceiling_cents > 0 && householdData.spent_percentage >= 100) && {
      id: "household-ceiling-exceeded",
      priority: 1,
      content: (
        <HouseholdAlertBanner
          variant="ceiling_exceeded"
          totalSpentCents={householdData!.total_spent_cents}
          ceilingCents={householdData!.monthly_ceiling_cents}
          spentPercentage={householdData!.spent_percentage}
          daysRemaining={daily.daysRemaining ?? undefined}
        />
      ),
    },
    isCurrentMonth && cashGapResult.isCashGapDetected && {
      id: "cash-gap-alert",
      priority: cashGapResult.severity === "critical" ? 1 : 3,
      content: <CashGapAlert result={cashGapResult} />,
    },
    Boolean(householdData && !householdData.is_settled && householdData.settlement && householdData.settlement.amount_cents > 0) && {
      id: "household-settlement-pending",
      priority: 2,
      content: (
        <HouseholdAlertBanner
          variant="settlement_pending"
          settlementAmountCents={householdData!.settlement!.amount_cents}
          settlementPayerName={householdData!.settlement!.payer_name}
          settlementReceiverName={householdData!.settlement!.receiver_name}
          isCurrentUserPayer={currentUserId ? householdData!.settlement!.payer_id === currentUserId : false}
          isCurrentUserReceiver={currentUserId ? householdData!.settlement!.receiver_id === currentUserId : false}
        />
      ),
    },
    showPaceAlert && isPaceEligible && {
      id: "pace-alert-banner",
      priority: projection.surplusCents !== null && projection.surplusCents < 0 ? 2 : 3,
      content: (
        <PaceAlertBanner
          spentPercent={pace.spentPercent}
          elapsedPercent={pace.elapsedPercent}
          dailyCents={daily.dailyCents}
          daysRemaining={daily.daysRemaining}
          surplusCents={projection.surplusCents}
          onNavigateInsights={() => navigate("/insights")}
          onDismiss={handleDismissPace}
        />
      ),
    },
    Boolean(householdData && householdData.monthly_ceiling_cents > 0 && householdData.spent_percentage >= 85 && householdData.spent_percentage < 100) && {
      id: "household-ceiling-warning",
      priority: 3,
      content: (
        <HouseholdAlertBanner
          variant="ceiling_warning"
          totalSpentCents={householdData!.total_spent_cents}
          ceilingCents={householdData!.monthly_ceiling_cents}
          spentPercentage={householdData!.spent_percentage}
          daysRemaining={daily.daysRemaining ?? undefined}
        />
      ),
    },
    splitPendingData.count > 0 && {
      id: "split-pending-banner",
      priority: 2,
      content: (
        <SplitPendingBanner
          pendingCents={splitPendingData.pendingCents}
          activeCount={splitPendingData.count}
          totalExpensesCents={splitPendingData.totalExpensesCents}
          items={splitPendingData.items}
        />
      ),
    },
    ...eligibleGoalShares.map((share) => ({
      id: `goal-progress-${share.id}`,
      priority: 3,
      content: (
        <GoalProgressAlertBanner
          key={share.id}
          goalShare={share}
          liveCurrentCents={liveGoalProgress.get(share.id)?.currentCents}
          surplusCents={surplusCapacity.hasSurplus ? surplusCapacity.suggestedAporteCents : null}
          onOpenDeposit={(s) => setDepositGoalShare(s)}
          onNavigateGoals={() => navigate("/orcamentos?tab=goals")}
          onDismiss={() => handleDismissGoal(share)}
        />
      ),
    })),
    surplusCapacity.hasSurplus && isCurrentMonth && isSurplusEligible && {
      id: "surplus-aporte-banner",
      priority: 4,
      content: (
        <SurplusAporteBanner
          surplusCents={surplusCapacity.suggestedAporteCents}
          onDismiss={handleDismissSurplus}
        />
      ),
    },
    subscription.isTrial &&
      !subscription.hasAutoRenew &&
      subscription.trialDaysRemaining !== null && {
        id: "trial-ending-banner",
        priority: subscription.trialDaysRemaining <= 7 ? 2 : 4,
        content: <TrialEndingBanner daysRemaining={subscription.trialDaysRemaining} />,
      },
  ];

  return (
    <>
      <WelcomeModal
        open={welcomeModalOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setWelcomeDismissed(true);
        }}
        onStartTour={() => setDemoTrackModalOpen(true)}
      />
      <DemoTrackSelectModal
        open={demoTrackModalOpen}
        onOpenChange={setDemoTrackModalOpen}
      />
      <WelcomeFeatureModal />
      <div className="flex flex-col gap-6 w-full min-w-0">
        {/* F12 — sem header visual: o app mostra direto o seletor de mês.
            Título mantido apenas para leitores de tela (ordem de heading). */}
        <h1 className="sr-only">Visão Geral</h1>

      <MonthPicker value={month} onValueChange={setMonth} />

      <AutoRegisteredBanner />

      <PendingSuggestionsCard />

      <PendingSplitSignalsCard />

      {error ? (
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => {
            void incomesQuery.refetch();
            void expensesQuery.refetch();
            if (isCurrentMonth) {
              void realCashData.refetch();
            }
          }}
        />
      ) : loading ? (
        <div className="flex flex-col gap-3" aria-hidden="true" data-testid="overview-loading-skeleton">
          {isCurrentMonth ? <SkeletonHeroCard /> : null}
          <KpiGrid columns={4}>
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </KpiGrid>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        </div>
      ) : (
        <>
          <DashboardAlertsCarousel items={alertItems} />

          {isCurrentMonth ? (
            <SmartAdvisorCard
              month={month}
              savingsSurplusCents={surplusCapacity.suggestedAporteCents}
              safeToSpendCents={realCashData.safeToSpend.safeToSpendCents}
              committedObligationsCents={realCashData.safeToSpend.committedObligationsCents}
            />
          ) : null}

          {showOnboarding && onboardingQuery?.data ? (
            <OnboardingBanner counts={onboardingQuery.data} onDismiss={dismissOnboarding} />
          ) : null}

          {subscription.isReadOnly && <ReadOnlyBanner />}

          {isCurrentMonth ? (
            <RealCashHeroCard
              realCashData={realCashData}
              onCalibrate={() => guardAction(() => setCheckpointOpen(true), "Calibrar Saldo com o Banco")}
            />
          ) : null}

          {isCurrentMonth ? <WeeklyDueRadarCard summary={weeklyRadarSummary} /> : null}

          {/* KPIs fundamentais (§3.6) com sparkline */}
          <KpiGrid columns={4} data-tour="overview-kpis">
            <KpiCard
              label="Receitas"
              cents={totals.incomeCents}
              tone="positive"
              icon={<TrendingUp className="size-4" aria-hidden="true" />}
              hint={
                <div className="flex flex-col gap-0.5 min-w-0">
                  <DeltaHint currentCents={totals.incomeCents} previousCents={prevTotals.incomeCents} />
                  {grossIncomeCents !== incomeCents ? (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap min-w-0 block">
                      <span className="hidden sm:inline">Ponderada: </span>
                      <span className="sm:hidden">Pond: </span>
                      <MoneyText cents={incomeCents} tone="default" className="text-[10px] tabular-nums" />
                    </span>
                  ) : null}
                </div>
              }
              spark={dailySeries.incomeSeries}
            />
            <KpiCard
              label="Despesas"
              cents={totals.expenseCents}
              tone="negative"
              icon={<TrendingDown className="size-4" aria-hidden="true" />}
              hint={
                <div className="flex flex-col gap-0.5 min-w-0">
                  <DeltaHint currentCents={totals.expenseCents} previousCents={prevTotals.expenseCents} invert />
                  {grossExpenseCents !== expenseCents ? (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap min-w-0 block">
                      <span className="hidden sm:inline">Ponderada: </span>
                      <span className="sm:hidden">Pond: </span>
                      <MoneyText cents={expenseCents} tone="default" className="text-[10px] tabular-nums" />
                    </span>
                  ) : null}
                </div>
              }
              spark={dailySeries.expenseSeries}
            />
            <KpiCard
              label="Investimentos"
              cents={totals.investmentCents}
              tone="portfolio"
              icon={<TrendingUp className="size-4" aria-hidden="true" />}
              spark={dailySeries.investmentSeries}
              onClick={() => navigate("/investments")}
            />
            <KpiCard
              label={
                <>
                  <span className="hidden sm:inline">Resultado do mês</span>
                  <span className="sm:hidden">Resultado</span>
                </>
              }
              cents={totals.operatingBalanceCents}
              tone={totals.operatingBalanceCents >= 0 ? "positive" : "negative"}
              icon={<DollarSign className="size-4" aria-hidden="true" />}
              spark={dailySeries.balanceSeries}
            />
          </KpiGrid>

          {/* Análises do período: fluxo diário + distribuição por categoria */}
          <section
            aria-label="Análises do período"
            className={cn("grid gap-3 min-w-0", donutSlices.length > 0 ? "lg:grid-cols-2" : "")}
          >
            <OverviewDailyFlowSection
              days={dailyFlow}
              hasInvestments={totals.investmentCents > 0}
            />
            {donutSlices.length > 0 ? (
              <section aria-label="Distribuição por categoria" className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <PieChart className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    <h2 className="text-sm font-semibold tracking-tight text-foreground truncate min-w-0">Distribuição por categoria</h2>
                  </div>
                  <Badge variant="muted" size="xs">
                    {totalActiveCategoriesCount} {totalActiveCategoriesCount === 1 ? "categoria" : "categorias"}
                  </Badge>
                </div>
                <CategoryDonut
                  slices={donutSlices}
                  totalCents={grossExpenseCents}
                  onSliceClick={(slice) => {
                    if (slice.key === "__other_categories__") {
                      setIsOtherCategoriesOpen(true);
                    } else if (slice.key) {
                      setSelectedCategoryId(slice.key);
                    }
                  }}
                />
              </section>
            ) : null}
          </section>

          {/* Orçamentos (§3.6): Layout Revolut / Apple Wallet em largura total */}
          <OverviewBudgetsSection
            hasBudgets={budgetRows.length > 0}
            totalRemainingCents={totalRemainingCents}
            totalLimitsCents={totalLimitsCents}
            globalPercent={globalPercent}
            budgetSegments={budgetSegments}
            onNavigateBudgets={() => navigate("/orcamentos")}
            onSelectCategory={(catId) => setSelectedCategoryId(catId)}
            onOpenOthersBudget={() => setIsOthersBudgetOpen(true)}
          />

          {/* Bloco de Investimentos do Mês & Aporte Direcionado */}
          <QuickAporteCard
            currentMonthAporteCents={totals.investmentCents}
            suggestedAporteCents={
              surplusCapacity.hasSurplus && isCurrentMonth
                ? surplusCapacity.suggestedAporteCents
                : 0
            }
          />

          {/* Diálogo Raio-X de Categoria (Responsivo / BottomSheet no mobile / Modal no desktop) */}
          <CategoryBreakdownDialog
            open={selectedCategoryId !== null}
            onOpenChange={(open) => {
              if (!open) setSelectedCategoryId(null);
            }}
            category={selectedCategory}
            month={month}
            limitCents={selectedLimitCents}
            spentWeightedCents={selectedSpentWeightedCents}
            spentGrossCents={selectedSpentGrossCents}
            prevSpentWeightedCents={selectedPrevSpentWeightedCents}
            expenses={selectedExpenses}
            cards={cardsQuery.data ?? []}
          />

          {/* Diálogo Outros Orçamentos (Responsivo / BottomSheet no mobile / Modal no desktop) */}
          <OtherBudgetsDialog
            open={isOthersBudgetOpen}
            onOpenChange={setIsOthersBudgetOpen}
            month={month}
            rows={otherBudgetRows}
            onSelectCategory={(catId) => setSelectedCategoryId(catId)}
          />

          {/* Diálogo Demais Categorias do Donut (Responsivo / BottomSheet no mobile / Modal no desktop) */}
          <OtherCategoriesDialog
            open={isOtherCategoriesOpen}
            onOpenChange={setIsOtherCategoriesOpen}
            month={month}
            rows={otherCategoriesRows}
            totalExpensesCents={grossExpenseCents}
            onSelectCategory={(catId) => setSelectedCategoryId(catId)}
          />

          {(incomesQuery.data ?? []).length === 0 && (expensesQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Inbox className="size-6" aria-hidden="true" />}
              title="Sem lançamentos neste mês"
              description={`Registre receitas e despesas de ${monthLabel(month)} para ver os KPIs aqui.`}
              action={
                <Button
                  size="sm"
                  onClick={() => navigate("/transacoes?novo=transacao")}
                  className="gap-2 cursor-pointer"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Novo lançamento
                </Button>
              }
            />
          ) : null}

          <CashCheckpointDialog
            open={checkpointOpen}
            onOpenChange={setCheckpointOpen}
            currentBalanceCents={realCashData.cashBalance.currentBalanceCents}
          />

          <QuickBalanceAdjustmentModal
            open={zeroGuiltModalOpen}
            onOpenChange={setZeroGuiltModalOpen}
            currentBalanceCents={realCashData.cashBalance.currentBalanceCents}
          />

          {depositGoalShare && (
            <AddContributionDialog
              open={Boolean(depositGoalShare)}
              onOpenChange={(open) => {
                if (!open) setDepositGoalShare(null);
              }}
              share={depositGoalShare}
            />
          )}

          {upgradeModal}
        </>
      )}
      </div>
    </>
  );
}
