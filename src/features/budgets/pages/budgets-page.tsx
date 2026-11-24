import { PiggyBank, Plus, SlidersHorizontal, Target, TrendingDown } from "lucide-react";
import { Button, ErrorState, Tabs } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { ReadOnlyBanner } from "@/components/modules";
import { getErrorMessage } from "@/services/errors";
import {
  BudgetsCategoriesTab,
  BudgetsDialogs,
  BudgetsGoalsTab,
  BudgetsLimitsTab,
  useBudgetsPage,
  type BudgetsTabKey,
} from "@/features/budgets/components";

/** Categorias & Orçamentos (§3.5.2) e metas de renda (§3.5.3) — Opção C unificada. */
export function BudgetsPage() {
  const b = useBudgetsPage();

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader
        title="Orçamentos"
        description="Tetos de gastos mensais, metas de renda e controle de categorias"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              aria-label="Ajustar orçamento"
              onClick={b.handleOpenAdjustBudget}
              className="gap-1.5"
            >
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              <span>Ajustar orçamento</span>
            </Button>
            <Button
              size="sm"
              aria-label="Nova categoria"
              onClick={b.handleOpenCreateCategory}
              className="gap-1.5"
            >
              <Plus aria-hidden="true" className="size-4" />
              <span>Nova categoria</span>
            </Button>
          </>
        }
      />

      {b.permission.isReadOnlyMode && (
        <ReadOnlyBanner
          onActivatePro={() => {
            b.setUpgradeContext(undefined);
            b.setUpgradeOpen(true);
          }}
        />
      )}

      {b.error ? (
        <ErrorState message={getErrorMessage(b.error)} onRetry={b.handleRetry} />
      ) : (
        <Tabs
          value={b.tab}
          onValueChange={(value) => b.handleTabChange(value as BudgetsTabKey)}
          variant="underline"
          fullWidth={false}
          swipeable
          items={[
            {
              value: "limits",
              label: "Despesas",
              icon: <TrendingDown className="size-4" aria-hidden="true" />,
              content: (
                <BudgetsLimitsTab
                  month={b.month}
                  onMonthChange={b.setMonth}
                  spendMetric={b.spendMetric}
                  onSpendMetricChange={b.setSpendMetric}
                  totalExpensesGrossCents={b.totalExpensesGrossCents}
                  totalExpensesWeightedCents={b.totalExpensesWeightedCents}
                  hasBudgetLimits={b.hasBudgetLimits}
                  totalBudgetedExpensesCents={b.totalBudgetedExpensesCents}
                  totalExpensesCents={b.totalExpensesCents}
                  hasPartialBudgets={b.hasPartialBudgets}
                  totalLimitsCents={b.totalLimitsCents}
                  totalUnbudgetedExpensesCents={b.totalUnbudgetedExpensesCents}
                  budgetedRowsCount={b.budgetedRowsCount}
                  categoriesCount={b.categoriesCount}
                  onOpenAdjustBudget={b.handleOpenAdjustBudget}
                  suggestion={b.suggestion}
                  fromCategory={b.fromCategory}
                  toCategory={b.toCategory}
                  onOpenReallocate={b.handleOpenReallocate}
                  isLoading={b.isLimitsLoading}
                  rows={b.rows}
                  unbudgetedRows={b.unbudgetedRows}
                  effectiveHighlightId={b.effectiveHighlightId}
                  onOpenLimit={b.handleOpenLimit}
                  onEditCategory={b.handleEditCategory}
                  onOpenCreateCategory={b.handleOpenCreateCategory}
                  showAllCategories={b.showAllCategories}
                  onToggleShowAllCategories={b.toggleShowAllCategories}
                />
              ),
            },
            {
              value: "goals",
              label: "Metas",
              icon: <Target className="size-4" aria-hidden="true" />,
              content: (
                <BudgetsGoalsTab
                  month={b.month}
                  onMonthChange={b.setMonth}
                  activeCampaigns={b.activeCampaigns}
                  archivedCampaigns={b.archivedCampaigns}
                  showArchivedCampaigns={b.showArchivedCampaigns}
                  onToggleShowArchivedCampaigns={b.toggleShowArchivedCampaigns}
                  liveGoalProgress={b.liveGoalProgress}
                  incomeCategories={b.incomeCategories}
                  realizedByCategory={b.realizedByCategory}
                  goalsByCategory={b.goalsByCategory}
                  goalShares={b.goalShares}
                  nowMs={b.nowMs}
                  effectiveHighlightId={b.effectiveHighlightId}
                  onOpenNewStandaloneCampaign={b.handleOpenNewStandaloneCampaign}
                  onOpenDeposit={b.handleOpenDeposit}
                  onManageShare={b.handleManageShare}
                  onManageContributions={b.handleManageContributions}
                  onOpenComposition={b.handleOpenComposition}
                  onOpenGoal={b.handleOpenGoal}
                  onEditCategory={b.handleEditCategory}
                  onShareGoal={b.handleShareGoal}
                  onOpenCreateCategory={b.handleOpenCreateCategory}
                />
              ),
            },
            {
              value: "categories",
              label: "Categorias",
              icon: <PiggyBank className="size-4" aria-hidden="true" />,
              content: (
                <BudgetsCategoriesTab
                  allCategories={b.allCategories}
                  onOpenKitsModal={() => b.handleOpenKitsModal()}
                  onSeedCategories={() => void b.handleSeedCategories()}
                  isSeeding={b.isSeeding}
                  isSeedError={b.isSeedError}
                  seedFeedback={b.seedFeedback}
                  onOpenCreateCategory={b.handleOpenCreateCategory}
                  onEditCategory={b.handleEditCategory}
                />
              ),
            },
          ]}
        />
      )}

      <BudgetsDialogs state={b} />
    </div>
  );
}
