import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Activity, ChevronRight, DollarSign, HeartHandshake, Inbox, PieChart, Plus, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, MoneyText, SkeletonChart, SkeletonHeroCard, SkeletonKpi } from "@/components/ui";
import {
  CategoryDonut,
  DailyFlowChart,
  DashboardAlertsCarousel,
  type DashboardAlertItem,
  DeltaHint,
  KpiCard,
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
  type PermissionAlertBannerType,
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
} from "@/domain/overview";
import { numberToCents, sumGrossCents, sumWeightedCents } from "@/domain/money";
import { contributionsInMonthCents } from "@/domain/portfolio";

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
  useRealCashBalance,
  useUserSubscription,
  useOnboardingCounts,
  hasSeenWelcomeModal,
  useFamilyConsolidation,
  useFamilyMode,
  useMyFamily,
  useUserPreferences,
  useUpdateCustomSettings,
} from "@/state";
import {
  usePermissionsStatus,
  isNativePlatform,
  useBankAssistantPreferences,
  setDismissedPermissionAlert,
  isPermissionAlertDismissed,
  isDueNotificationsEnabled,
} from "@/services/native";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { useOnboardingDismissed, usePendingSplitExpense, usePendingSimulation } from "@/hooks";
import { CashCheckpointDialog } from "@/components/modules/cash-checkpoint-dialog";
import { cn } from "@/lib/utils";
import {
  CategoryBreakdownDialog,
  OtherBudgetsDialog,
  OtherCategoriesDialog,
  SplitPendingBanner,
  CampaignsSummaryBanner,
  HouseholdAlertBanner,
} from "../components";
import type { SplitSharePayload } from "@/types";

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

  const isNative = isNativePlatform();
  const { postNotificationsGranted, listenerGranted, requestPostNotifications, requestNotificationListener } = usePermissionsStatus();
  const { preferences: bankPrefs } = useBankAssistantPreferences();
  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const cloudDeviceNotifs = userPreferencesQuery.data?.custom_settings?.deviceNotifications;
  const dueNotificationsActive = cloudDeviceNotifs?.dueNotificationsEnabled ?? isDueNotificationsEnabled();

  const isBankListenerMissing = isNative && bankPrefs.passiveCaptureEnabled && !listenerGranted;
  const isPushDueMissing = isNative && dueNotificationsActive && !postNotificationsGranted;

  const [permissionAlertDismissed, setPermissionAlertDismissed] = useState(false);

  const isAlertDismissedInStorage =
    isPermissionAlertDismissed("passiveBankListener") ||
    isPermissionAlertDismissed("pushDue") ||
    Boolean(cloudDeviceNotifs?.dismissedPermissionAlerts?.passiveBankListener) ||
    Boolean(cloudDeviceNotifs?.dismissedPermissionAlerts?.pushDue);

  const shouldShowPermissionsBanner =
    isNative &&
    !permissionAlertDismissed &&
    !isAlertDismissedInStorage &&
    (isBankListenerMissing || isPushDueMissing);

  const permissionBannerType: PermissionAlertBannerType =
    isBankListenerMissing && isPushDueMissing
      ? "both"
      : isBankListenerMissing
        ? "bank_listener"
        : "push_due";

  const handlePermissionsBannerAction = () => {
    if (permissionBannerType === "bank_listener") {
      void requestNotificationListener();
    } else if (permissionBannerType === "push_due") {
      void requestPostNotifications();
    } else {
      navigate("/configuracoes?tab=notifications");
    }
  };

  const handlePermissionsBannerDismiss = () => {
    setPermissionAlertDismissed(true);
    setDismissedPermissionAlert("passiveBankListener", true);
    setDismissedPermissionAlert("pushDue", true);
    updateCustomSettingsMutation.mutate({
      deviceNotifications: {
        dismissedPermissionAlerts: {
          pushDue: true,
          passiveBankListener: true,
        },
      },
    });
  };

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

  // Apuração de campanhas / metas coletivas ativas
  const activeCampaignData = useMemo(() => {
    const goalShares = goalSharesQuery.data ?? [];
    if (goalShares.length === 0) return null;

    const activeList = goalShares.filter((s) => !s.is_revoked);
    if (activeList.length === 0) return null;

    // Pega a primeira campanha com maior progresso ou mais recente
    const topCampaign = activeList[0]!;
    const payload = topCampaign.payload as Record<string, unknown>;
    const targetCents = Number(payload.target_cents ?? 0);
    const currentCents = Number(payload.current_cents ?? 0);
    const percentage = targetCents > 0 ? Math.round((currentCents / targetCents) * 100) : 0;

    return {
      title: (payload.title as string) || "Meta Coletiva",
      targetCents,
      currentCents,
      percentage,
      activeCount: activeList.length,
    };
  }, [goalSharesQuery.data]);

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
    isInactive && {
      id: "zero-guilt-balance-alignment",
      priority: 2,
      content: (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 p-3.5 sm:p-4 rounded-2xl border border-primary/20 bg-primary/5 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
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
          <Button
            type="button"
            size="sm"
            onClick={() => setZeroGuiltModalOpen(true)}
            className="shrink-0 self-stretch sm:self-center font-semibold cursor-pointer"
          >
            Alinhar Saldo
          </Button>
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
    showPaceAlert && {
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
    Boolean(activeCampaignData) && {
      id: "campaigns-summary-banner",
      priority: 3,
      content: (
        <CampaignsSummaryBanner
          title={activeCampaignData!.title}
          targetCents={activeCampaignData!.targetCents}
          currentCents={activeCampaignData!.currentCents}
          percentage={activeCampaignData!.percentage}
          activeCount={activeCampaignData!.activeCount}
        />
      ),
    },
    surplusCapacity.hasSurplus && isCurrentMonth && {
      id: "surplus-aporte-banner",
      priority: 4,
      content: (
        <SurplusAporteBanner surplusCents={surplusCapacity.suggestedAporteCents} />
      ),
    },
    subscription.isTrial &&
      subscription.trialDaysRemaining !== null &&
      subscription.trialDaysRemaining <= 7 && {
        id: "trial-ending-banner",
        priority: 2,
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
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </div>
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
          <div className="grid gap-3 min-w-0 grid-cols-2 lg:grid-cols-4" data-tour="overview-kpis">
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
            </div>

          {/* Análises do período: fluxo diário + distribuição por categoria */}
          <section
            aria-label="Análises do período"
            className={cn("grid gap-3 min-w-0", donutSlices.length > 0 ? "lg:grid-cols-2" : "")}
          >
            <section aria-label="Fluxo diário" className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Activity className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <h2 className="text-sm font-semibold tracking-tight text-foreground truncate min-w-0">Fluxo diário</h2>
                </div>
                <div className="flex items-center justify-end gap-2 sm:gap-2.5 text-[11px] shrink-0 flex-wrap">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-positive-strong shrink-0" /> Receitas
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-negative-strong shrink-0" /> Despesas
                  </span>
                  {totals.investmentCents > 0 && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-portfolio shrink-0" /> Investimentos
                    </span>
                  )}
                </div>
              </div>

              <DailyFlowChart days={dailyFlow} />
            </section>
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
          <section
            aria-label="Orçamentos"
            className="flex flex-col gap-3.5 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden"
          >
            {/* Header do Card: Título + Botão de Ação */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Target className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <h2 className="text-sm font-semibold tracking-tight text-foreground truncate min-w-0">Orçamentos do mês</h2>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate("/orcamentos")}
                aria-label="Ver todos os orçamentos"
                className="h-7 gap-1 px-2 sm:px-2.5 text-xs font-medium text-foreground hover:bg-surface-hover cursor-pointer border-border/80 shrink-0"
              >
                <span className="hidden sm:inline">Ver todos</span>
                <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
              </Button>
            </div>

            {budgetRows.length === 0 ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 bg-surface-hover/20 p-3.5 text-xs text-muted-foreground">
                <span>Nenhum orçamento configurado para este mês.</span>
                <button
                  type="button"
                  onClick={() => navigate("/orcamentos")}
                  className="font-medium text-primary hover:underline cursor-pointer"
                >
                  Definir limites →
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:gap-3.5">
                {/* Bloco de Métricas: Saldo à esquerda e Badge de Consumo à direita */}
                <div className="flex items-end justify-between gap-2 pt-0.5">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {totalRemainingCents >= 0 ? "Saldo disponível no teto" : "Orçamento ultrapassado em"}
                    </span>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <MoneyText
                        cents={Math.abs(totalRemainingCents)}
                        tone="default"
                        className={cn(
                          "font-bold tracking-tight whitespace-nowrap tabular-nums",
                          totalRemainingCents >= 0 ? "text-positive-strong" : "text-critical-strong",
                          Math.abs(totalRemainingCents) >= 100_000_000
                            ? "text-xl sm:text-2xl"
                            : "text-2xl sm:text-3xl",
                        )}
                      />
                      <span className="text-xs text-muted-foreground font-normal">
                        de <MoneyText cents={totalLimitsCents} tone="default" className="text-muted-foreground font-medium" /> planejado
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={globalPercent > 100 ? "critical" : globalPercent >= 85 ? "warning" : "positive"}
                    size="xs"
                    className="shrink-0 mb-1"
                  >
                    {Math.round(globalPercent)}% utilizado
                  </Badge>
                </div>

                {/* Barra Segmentada Única (Estilo Apple / Linear) com clique para Raio-X */}
                <div className="w-full flex flex-col gap-2.5">
                  <div
                    className="flex w-full h-2.5 sm:h-3 rounded-full overflow-hidden bg-surface-hover/70 p-0.5 border border-border/40 gap-0.5"
                    role="group"
                    aria-label={`Uso do orçamento: ${Math.round(globalPercent)}%`}
                  >
                    {budgetSegments.map((seg) => (
                      <button
                        type="button"
                        key={seg.id}
                        style={{
                          width: `${Math.max(1.5, seg.percent)}%`,
                          backgroundColor: seg.color ?? undefined,
                        }}
                        className="h-full rounded-full transition-all duration-300 first:rounded-l-full last:rounded-r-full shrink-0 outline-none cursor-pointer hover:brightness-110 active:scale-95 focus-visible:ring-1 focus-visible:ring-ring"
                        title={`${seg.label}: ${(seg.spentCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} — clique para ver detalhes`}
                        onClick={() => {
                          if (seg.id === "others") {
                            setIsOthersBudgetOpen(true);
                          } else {
                            setSelectedCategoryId(seg.id);
                          }
                        }}
                      />
                    ))}
                  </div>

                  {/* Legenda Estruturada em 2 Colunas Simétricas no Mobile e Flex no Desktop */}
                  {budgetSegments.length > 0 ? (
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-3 sm:gap-x-4 gap-y-2 text-xs pt-0.5 min-w-0">
                      {budgetSegments.map((seg) => (
                        <button
                          type="button"
                          key={seg.id}
                          onClick={() => {
                            if (seg.id === "others") {
                              setIsOthersBudgetOpen(true);
                            } else {
                              setSelectedCategoryId(seg.id);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 min-w-0 text-muted-foreground transition-all duration-150 rounded-lg p-1 -m-1 cursor-pointer hover:bg-surface-hover hover:text-foreground active:scale-95 text-left"
                        >
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: seg.color ?? undefined }}
                            aria-hidden="true"
                          />
                          <span className="font-medium text-foreground truncate min-w-0">{seg.label}</span>
                          <span className="hidden sm:inline font-medium text-foreground">:</span>
                          <MoneyText cents={seg.spentCents} tone="default" className="hidden sm:inline-block text-muted-foreground shrink-0 tabular-nums font-medium" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </section>

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

          {upgradeModal}
        </>
      )}
      </div>
    </>
  );
}
