import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Coins, DollarSign, Inbox, PieChart, Plus, TrendingDown, TrendingUp } from "lucide-react";
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
  OnboardingBanner,
  WelcomeFeatureModal,
  WelcomeModal,
  DemoTrackSelectModal,
  PermissionsAlertBanner,
  WeeklyDueRadarCard,
  VirginAccountHero,
  AndroidProBanner,
  DashboardPixClipboardCard,
} from "@/components/modules";
import {
  budgetLimitsByCategory,
  isInheritedLimit,
  resolveEffectiveLimit,
  spentByCategoryMap,
  spentGrossByCategoryMap,
} from "@/domain/budgets";
import {
  createGoalDismissalCheckpoint,
  createPaceDismissalCheckpoint,
  createSurplusDismissalCheckpoint,
} from "@/domain/overview";
import { currentMonth, monthLabel } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { hasSeenWelcomeModal } from "@/state";
import { PendingDividendsDialog } from "@/features/investments/components/pending-dividends-dialog";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
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
import {
  useDashboardAlertDismissals,
  useOverviewPermissionsBanner,
  useOverviewData,
  usePixClipboardDetector,
} from "../hooks";
import { AddContributionDialog } from "@/features/goals";
import { ActiveTripBanner } from "@/features/trips/components";
import { ActiveSplitsCard } from "@/features/transactions/components";
import { isAndroidDevice, isNativePlatform } from "@/services/native/platform";
import type { PublicShare } from "@/types";

export function OverviewPage() {
  const [month, setMonth] = useState(currentMonth);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isOthersBudgetOpen, setIsOthersBudgetOpen] = useState(false);
  const [isOtherCategoriesOpen, setIsOtherCategoriesOpen] = useState(false);
  const [pendingDividendsModalOpen, setPendingDividendsModalOpen] = useState(false);
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [depositGoalShare, setDepositGoalShare] = useState<PublicShare | null>(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [demoTrackModalOpen, setDemoTrackModalOpen] = useState(false);
  const [androidBannerDismissed, setAndroidBannerDismissed] = useState(false);
  const { detectedPix, dismissDetectedPix, clearDetectedPix } = usePixClipboardDetector();

  const navigate = useNavigate();
  const { guardAction, upgradeModal } = useMutationGuard();

  const handleLaunchPixFromClipboard = useCallback(
    (params: {
      valorCents?: number;
      desc?: string;
      categoria?: string;
      tipo?: "expense" | "income";
      forma?: "pix";
      pixKey?: string;
    }) => {
      clearDetectedPix();
      const search = new URLSearchParams();
      search.set("novo", params.tipo || "despesa");
      search.set("modo", "rapido");
      search.set("forma", "pix");
      if (params.valorCents) search.set("valor", String(params.valorCents));
      if (params.desc) search.set("desc", params.desc);
      if (params.categoria) search.set("categoria", params.categoria);
      navigate({ pathname: "/", search: search.toString() });
    },
    [clearDetectedPix, navigate],
  );

  const { alertDismissals, updateAlertDismissals } = useDashboardAlertDismissals();
  const {
    shouldShowPermissionsBanner,
    permissionBannerType,
    handlePermissionsBannerAction,
    handlePermissionsBannerDismiss,
  } = useOverviewPermissionsBanner(navigate);

  // Hook canônico extraído — consolida todas as queries e cálculos da Home (§F23)
  const data = useOverviewData({ month, alertDismissals });

  const {
    loading,
    error,
    isCurrentMonth,
    incomeCents,
    expenseCents,
    grossIncomeCents,
    grossExpenseCents,
    totals,
    prevTotals,
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
    householdData,
    currentUserId,
    isVirginAccount,
    showOnboarding,
    dismissOnboarding,
    corporateDividends,
    subscription,
    realCashData,
    budgetsQuery,
    expenseCategories,
    cardsQuery,
    incomesQuery,
    expensesQuery,
    prevExpensesQuery,
  } = data;

  const shouldOpenWelcome = isVirginAccount && !hasSeenWelcomeModal();
  const welcomeModalOpen = shouldOpenWelcome && !welcomeDismissed;


  const isAndroidEligible = useMemo(() => {
    if (androidBannerDismissed) return false;
    return isAndroidDevice() && !isNativePlatform();
  }, [androidBannerDismissed]);

  // Handlers de Descarte de Alertas (§F23)
  const handleDismissPace = useCallback(() => {
    updateAlertDismissals((prev) => ({
      ...prev,
      pace: createPaceDismissalCheckpoint({
        month,
        spentPercent: pace.spentPercent,
        surplusCents: projection.surplusCents,
      }),
    }));
  }, [month, pace.spentPercent, projection.surplusCents, updateAlertDismissals]);

  const handleDismissSurplus = useCallback(() => {
    updateAlertDismissals((prev) => ({
      ...prev,
      surplus: createSurplusDismissalCheckpoint({
        month,
        surplusCents: surplusCapacity.suggestedAporteCents,
      }),
    }));
  }, [month, surplusCapacity.suggestedAporteCents, updateAlertDismissals]);

  const handleDismissGoal = useCallback(
    (share: PublicShare) => {
      const pld = (share.payload as Record<string, unknown> | null) ?? {};
      const targetCents = Number(pld.target_cents ?? 0);
      const live = liveGoalProgress.get(share.id)?.currentCents;
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

      updateAlertDismissals((prev) => ({
        ...prev,
        goals: {
          ...prev.goals,
          [share.id]: createGoalDismissalCheckpoint({
            goalId: share.id,
            currentCents,
            targetCents,
            percentage,
            stage,
          }),
        },
      }));
    },
    [liveGoalProgress, surplusCapacity.hasSurplus, updateAlertDismissals],
  );

  // Orçamentos compactos (§3.6)
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
    const limits = budgetLimitsByCategory(budgetsQuery.data ?? []);
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

    const segmentBaseCents = Math.max(1, totalLimits, totalBudgetedSpent);
    const activeBudgetSpentRows = [...rows]
      .filter((r) => r.spentCents > 0)
      .sort((a, b) => b.spentCents - a.spentCents);
    const topBudgetSegments = activeBudgetSpentRows.slice(0, 4);
    const otherRows = activeBudgetSpentRows.slice(4);
    const otherBudgetSpentCents = otherRows.reduce((acc, r) => acc + r.spentCents, 0);
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
      otherBudgetRows: otherRows,
      totalLimitsCents: totalLimits,
      totalRemainingCents: totalRemaining,
      globalPercent: gPercent,
      budgetSegments: segments,
    };
  }, [budgetsQuery.data, expensesQuery.data, expenseCategories.data, month]);

  // Donut de categorias
  const { donutSlices, otherCategoriesRows, totalActiveCategoriesCount } = useMemo(() => {
    const categories = expenseCategories.data ?? [];
    const activeRows = categories
      .map((category) => {
        const spentGross = spentGrossByCategory.get(category.id) ?? 0;
        return {
          category,
          spentGrossCents: spentGross,
          percent: grossExpenseCents > 0 ? (spentGross / grossExpenseCents) * 100 : 0,
        };
      })
      .filter((row) => row.spentGrossCents > 0)
      .sort((a, b) => b.spentGrossCents - a.spentGrossCents);

    const top5 = activeRows.slice(0, 5);
    const others = activeRows.slice(5);

    const top5SpentCents = top5.reduce((acc, r) => acc + r.spentGrossCents, 0);
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

  // Montagem e priorização do Carrossel de Alertas (§F23 & Regra 19)
  const alertItems: (DashboardAlertItem | null | undefined | false)[] = [
    shouldShowPermissionsBanner && {
      id: "permissions-alert",
      priority: 1,
      content: (
        <PermissionsAlertBanner
          type={permissionBannerType}
          onAction={handlePermissionsBannerAction}
          onDismiss={handlePermissionsBannerDismiss}
        />
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
    Boolean(detectedPix && detectedPix.candidate.valueCents > 0) && {
      id: "pix-clipboard-alert",
      priority: 1,
      content: (
        <DashboardPixClipboardCard
          detected={detectedPix!}
          onLaunch={handleLaunchPixFromClipboard}
          onDismiss={dismissDetectedPix}
        />
      ),
    },
    activeTrips[0]
      ? {
          id: `active-trip-${activeTrips[0].id}`,
          priority: 2,
          content: <ActiveTripBanner trip={activeTrips[0]} />,
        }
      : false,
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
    (corporateDividends.available.length > 0 || corporateDividends.projected.length > 0) && {
      id: "corporate-dividends-alert",
      priority: corporateDividends.available.length > 0 ? 2 : 3,
      content: (
        <div
          role="alert"
          className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-surface shadow-xs transition-all"
        >
          <div className="flex items-center gap-3 min-w-0 pr-6 sm:pr-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-portfolio/20 bg-portfolio/10 text-portfolio">
              <Coins className="size-4.5" aria-hidden="true" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground truncate">
                  {corporateDividends.available.length > 0
                    ? "Proventos Creditados na Corretora"
                    : "Proventos Previstos no Mês"}
                </span>
                <Badge variant="muted" size="xs">
                  {corporateDividends.available.length > 0
                    ? `${corporateDividends.available.length} ${corporateDividends.available.length === 1 ? "disponível" : "disponíveis"}`
                    : "PROVISIONADO"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {corporateDividends.available.length > 0
                  ? `${corporateDividends.available.length} proventos disponíveis totalizando R$ ${corporateDividends.totalAvailableAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
                  : `${corporateDividends.projected.length} proventos previstos totalizando R$ ${corporateDividends.totalProjectedAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} previstos.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-center mt-auto sm:mt-0">
            <Button
              type="button"
              size="sm"
              onClick={() => setPendingDividendsModalOpen(true)}
              className="shrink-0 self-stretch sm:self-center font-semibold cursor-pointer"
            >
              Conferir
            </Button>
          </div>
        </div>
      ),
    },
    isAndroidEligible && {
      id: "android-pro-banner",
      priority: 4,
      content: <AndroidProBanner onDismiss={() => setAndroidBannerDismissed(true)} />,
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
            {showOnboarding && data.onboardingQuery?.data ? (
              <OnboardingBanner
                counts={data.onboardingQuery.data}
                hasFeature={data.hasFeature}
                onDismiss={dismissOnboarding}
              />
            ) : null}

            {isVirginAccount ? (
              <VirginAccountHero onOpenDemo={() => setDemoTrackModalOpen(true)} />
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

                {subscription.isReadOnly && <ReadOnlyBanner />}

                {isCurrentMonth ? (
                  <RealCashHeroCard
                    realCashData={realCashData}
                    onCalibrate={() => guardAction(() => setCheckpointOpen(true), "Calibrar Saldo com o Banco")}
                  />
                ) : null}

                {isCurrentMonth ? <WeeklyDueRadarCard summary={weeklyRadarSummary} /> : null}

                <ActiveSplitsCard month={month} />

                {/* KPIs fundamentais com sparkline */}
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
                    onClick={() => navigate(`/transacoes?tipo=receitas&month=${month}`)}
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
                    onClick={() => navigate(`/transacoes?tipo=despesas&month=${month}`)}
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
                    ariaLabel="Resultado do mês"
                    cents={totals.operatingBalanceCents}
                    tone={totals.operatingBalanceCents >= 0 ? "positive" : "negative"}
                    icon={<DollarSign className="size-4" aria-hidden="true" />}
                    spark={dailySeries.balanceSeries}
                    onClick={() => navigate("/relatorios")}
                  />
                </KpiGrid>

                {/* Fluxo diário + distribuição por categoria */}
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

                {/* Orçamentos compactos */}
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

                {/* Aporte Direcionado */}
                <QuickAporteCard
                  currentMonthAporteCents={totals.investmentCents}
                  suggestedAporteCents={
                    surplusCapacity.hasSurplus && isCurrentMonth
                      ? surplusCapacity.suggestedAporteCents
                      : 0
                  }
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

                {/* Diálogo Raio-X de Categoria */}
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

                {/* Diálogo Outros Orçamentos */}
                <OtherBudgetsDialog
                  open={isOthersBudgetOpen}
                  onOpenChange={setIsOthersBudgetOpen}
                  month={month}
                  rows={otherBudgetRows}
                  onSelectCategory={(catId) => setSelectedCategoryId(catId)}
                />

                {/* Diálogo Demais Categorias */}
                <OtherCategoriesDialog
                  open={isOtherCategoriesOpen}
                  onOpenChange={setIsOtherCategoriesOpen}
                  month={month}
                  rows={otherCategoriesRows}
                  totalExpensesCents={grossExpenseCents}
                  onSelectCategory={(catId) => setSelectedCategoryId(catId)}
                />
              </>
            )}

            <CashCheckpointDialog
              open={checkpointOpen}
              onOpenChange={setCheckpointOpen}
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

            <PendingDividendsDialog
              open={pendingDividendsModalOpen}
              onOpenChange={setPendingDividendsModalOpen}
              availableDividends={corporateDividends.available}
              projectedDividends={corporateDividends.projected}
            />

            {upgradeModal}
          </>
        )}
      </div>
    </>
  );
}
