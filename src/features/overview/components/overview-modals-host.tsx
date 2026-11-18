import type { ReactNode } from "react";
import { DemoTrackSelectModal, WelcomeModal } from "@/components/modules";
import { CashCheckpointDialog } from "@/components/modules/cash-checkpoint-dialog";
import { resolveEffectiveLimit, spentByCategoryMap } from "@/domain/budgets";
import { AddContributionDialog } from "@/features/goals";
import { PendingDividendsDialog } from "@/features/investments/components/pending-dividends-dialog";
import type { useOverviewData } from "../hooks/use-overview-data";
import type { useOverviewModals } from "../hooks/use-overview-modals";
import { CategoryBreakdownDialog } from "./category-breakdown-dialog";
import { OtherBudgetsDialog } from "./other-budgets-dialog";
import { OtherCategoriesDialog } from "./other-categories-dialog";

export interface OverviewModalsHostProps {
  month: string;
  welcomeModalOpen: boolean;
  data: ReturnType<typeof useOverviewData>;
  modals: ReturnType<typeof useOverviewModals>;
  upgradeModal: ReactNode;
}

/**
 * Centraliza todos os modais e gavetas contextuais da tela de Visão Geral.
 */
export function OverviewModalsHost({
  month,
  welcomeModalOpen,
  data,
  modals,
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

  return (
    <>
      <WelcomeModal
        open={welcomeModalOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) modals.setWelcomeDismissed(true);
        }}
        onStartTour={() => modals.setDemoTrackModalOpen(true)}
      />
      <DemoTrackSelectModal
        open={modals.demoTrackModalOpen}
        onOpenChange={modals.setDemoTrackModalOpen}
      />

      {!data.isVirginAccount ? (
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

      <PendingDividendsDialog
        open={modals.pendingDividendsModalOpen}
        onOpenChange={modals.setPendingDividendsModalOpen}
        availableDividends={data.corporateDividends.available}
        projectedDividends={data.corporateDividends.projected}
      />

      {upgradeModal}
    </>
  );
}
