import type { ReactNode } from "react";
import {
  DemoTrackSelectModal,
  OnboardingChecklistModal,
  type OnboardingQuickTourTrack,
} from "@/components/modules";
import { CashCheckpointDialog } from "@/components/modules/cash-checkpoint-dialog";
import { resolveEffectiveLimit, spentByCategoryMap } from "@/domain/budgets";
import { AddContributionDialog } from "@/features/goals";
import type { useOverviewData } from "../hooks/use-overview-data";
import type { useOverviewModals } from "../hooks/use-overview-modals";
import { CategoryBreakdownDialog } from "./category-breakdown-dialog";
import { InitialPreferencesModal } from "./initial-preferences-modal";
import { OtherBudgetsDialog } from "./other-budgets-dialog";
import { OtherCategoriesDialog } from "./other-categories-dialog";

export interface OverviewModalsHostProps {
  month: string;
  data: ReturnType<typeof useOverviewData>;
  modals: ReturnType<typeof useOverviewModals>;
  onStartQuickTour: (track: OnboardingQuickTourTrack) => void;
  upgradeModal: ReactNode;
}

/**
 * Centraliza todos os modais e gavetas contextuais da tela de Visão Geral.
 */
export function OverviewModalsHost({
  month,
  data,
  modals,
  onStartQuickTour,
  upgradeModal,
}: OverviewModalsHostProps) {
  const { budgetAndDonut } = data;
  const expenseCategories = data.expenseCategories.data ?? [];
  const expenses = data.expensesQuery.data ?? [];
  const prevExpenses = data.prevExpensesQuery.data ?? [];
  const prevSpentWeightedByCategory = spentByCategoryMap([...prevExpenses]);
  const selectedCategory = expenseCategories.find((c) => c.id === modals.selectedCategoryId) ?? null;

  const selectedLimitCents = selectedCategory
    ? resolveEffectiveLimit(budgetAndDonut.limitsByCategory.get(selectedCategory.id) ?? [], month)
    : 0;
  const selectedSpentWeightedCents = selectedCategory
    ? (budgetAndDonut.spentWeightedByCategory.get(selectedCategory.id) ?? 0)
    : 0;
  const selectedSpentGrossCents = selectedCategory
    ? (budgetAndDonut.spentGrossByCategory.get(selectedCategory.id) ?? 0)
    : 0;
  const selectedPrevSpentWeightedCents = selectedCategory
    ? (prevSpentWeightedByCategory.get(selectedCategory.id) ?? 0)
    : 0;
  const selectedExpenses = expenses.filter((e) => e.category_id === modals.selectedCategoryId);

  const quickTourTrack: OnboardingQuickTourTrack =
    data.initialGoal === "family"
      ? "shared_finances"
      : data.initialGoal === "investments"
        ? "investments"
        : "finances";

  return (
    <>
      <DemoTrackSelectModal
        open={modals.demoTrackModalOpen}
        onOpenChange={modals.setDemoTrackModalOpen}
      />

      {data.onboardingQuery?.data ? (
        <OnboardingChecklistModal
          open={modals.onboardingChecklistOpen}
          onOpenChange={modals.setOnboardingChecklistOpen}
          counts={data.onboardingQuery.data}
          hasFeature={data.hasFeature}
          initialGoal={data.initialGoal}
          onCalibrateCash={() => modals.setCheckpointOpen(true)}
          onStartQuickTour={() => onStartQuickTour(quickTourTrack)}
          onOpenDemoTrackSelect={() => modals.setDemoTrackModalOpen(true)}
        />
      ) : null}

      {!data.showVirginGuide ? (
        <>
          <CategoryBreakdownDialog
            open={modals.selectedCategoryId !== null}
            onOpenChange={(open) => {
              if (!open) modals.setSelectedCategoryId(null);
            }}
            category={selectedCategory}
            month={month}
            limitCents={selectedLimitCents}
            spentWeightedCents={selectedSpentWeightedCents}
            spentGrossCents={selectedSpentGrossCents}
            prevSpentWeightedCents={selectedPrevSpentWeightedCents}
            expenses={selectedExpenses}
            cards={data.cardsQuery.data ?? []}
          />

          <OtherBudgetsDialog
            open={modals.isOthersBudgetOpen}
            onOpenChange={modals.setIsOthersBudgetOpen}
            month={month}
            rows={budgetAndDonut.otherBudgetRows}
            onSelectCategory={(catId) => modals.setSelectedCategoryId(catId)}
          />

          <OtherCategoriesDialog
            open={modals.isOtherCategoriesOpen}
            onOpenChange={modals.setIsOtherCategoriesOpen}
            month={month}
            rows={budgetAndDonut.otherCategoriesRows}
            totalExpensesCents={data.grossExpenseCents}
            onSelectCategory={(catId) => modals.setSelectedCategoryId(catId)}
          />
        </>
      ) : null}

      <CashCheckpointDialog
        open={modals.checkpointOpen}
        onOpenChange={modals.setCheckpointOpen}
        currentBalanceCents={data.realCashData.cashBalance.currentBalanceCents}
      />

      {modals.depositGoalShare ? (
        <AddContributionDialog
          open={Boolean(modals.depositGoalShare)}
          onOpenChange={(open) => {
            if (!open) modals.setDepositGoalShare(null);
          }}
          share={modals.depositGoalShare}
        />
      ) : null}

      {modals.initialPreferencesOpen ? (
        <InitialPreferencesModal
          open={modals.initialPreferencesOpen}
          onOpenChange={modals.setInitialPreferencesOpen}
        />
      ) : null}

      {upgradeModal}
    </>
  );
}
