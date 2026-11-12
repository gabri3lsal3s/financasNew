import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BudgetsLimitsTab } from "./budgets-limits-tab";
import { BudgetsGoalsTab } from "./budgets-goals-tab";
import { BudgetsCategoriesTab } from "./budgets-categories-tab";
import type { Category } from "@/types";

const mockCategory: Category = {
  id: "cat-1",
  user_id: "user-1",
  name: "Alimentação",
  type: "expense",
  color: "#FF5733",
  icon: "Utensils",
  is_reserved: false,
  is_active: true,
};

describe("Budgets Tabs Component Modularization", () => {
  it("renders BudgetsLimitsTab with metric toggle and category rows", async () => {
    const onSpendMetricChange = vi.fn();
    const onOpenLimit = vi.fn();

    render(
      <BudgetsLimitsTab
        month="2026-08"
        onMonthChange={vi.fn()}
        spendMetric="personal"
        onSpendMetricChange={onSpendMetricChange}
        totalExpensesGrossCents={50000}
        totalExpensesWeightedCents={40000}
        hasBudgetLimits={true}
        totalBudgetedExpensesCents={40000}
        totalExpensesCents={40000}
        hasPartialBudgets={false}
        totalLimitsCents={100000}
        totalUnbudgetedExpensesCents={0}
        budgetedRowsCount={1}
        categoriesCount={1}
        onOpenAdjustBudget={vi.fn()}
        suggestion={null}
        fromCategory={undefined}
        toCategory={undefined}
        onOpenReallocate={vi.fn()}
        isLoading={false}
        rows={[
          {
            category: mockCategory,
            spentCents: 40000,
            spentGrossCents: 50000,
            spentWeightedCents: 40000,
            limitCents: 100000,
            inherited: false,
            hasSplitDifference: true,
          },
        ]}
        unbudgetedRows={[]}
        effectiveHighlightId={null}
        onOpenLimit={onOpenLimit}
        onEditCategory={vi.fn()}
        onOpenCreateCategory={vi.fn()}
        showAllCategories={false}
        onToggleShowAllCategories={vi.fn()}
      />
    );

    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Total Gasto")).toBeInTheDocument();
    expect(screen.getByText("Teto Planejado")).toBeInTheDocument();

    const user = userEvent.setup();
    const totalBrutoBtn = screen.getByRole("button", { name: /Total Bruto/i });
    await user.click(totalBrutoBtn);
    expect(onSpendMetricChange).toHaveBeenCalledWith("household");
  });

  it("renders BudgetsGoalsTab with new goal button and empty state", async () => {
    const onOpenNewStandaloneCampaign = vi.fn();

    render(
      <BudgetsGoalsTab
        month="2026-08"
        onMonthChange={vi.fn()}
        activeCampaigns={[]}
        archivedCampaigns={[]}
        showArchivedCampaigns={false}
        onToggleShowArchivedCampaigns={vi.fn()}
        liveGoalProgress={new Map()}
        incomeCategories={[]}
        realizedByCategory={new Map()}
        goalsByCategory={new Map()}
        goalShares={[]}
        nowMs={Date.now()}
        effectiveHighlightId={null}
        onOpenNewStandaloneCampaign={onOpenNewStandaloneCampaign}
        onOpenDeposit={vi.fn()}
        onManageShare={vi.fn()}
        onManageContributions={vi.fn()}
        onOpenComposition={vi.fn()}
        onOpenGoal={vi.fn()}
        onEditCategory={vi.fn()}
        onShareGoal={vi.fn()}
        onOpenCreateCategory={vi.fn()}
      />
    );

    expect(screen.getByText("Metas Financeiras & Termômetro Coletivo")).toBeInTheDocument();
    expect(screen.getByText("Sem categorias de renda")).toBeInTheDocument();

    const user = userEvent.setup();
    const newMetaBtn = screen.getByRole("button", { name: /Nova Meta/i });
    await user.click(newMetaBtn);
    expect(onOpenNewStandaloneCampaign).toHaveBeenCalled();
  });

  it("renders BudgetsCategoriesTab with seed button and category listing", async () => {
    const onSeedCategories = vi.fn();
    const onOpenCreateCategory = vi.fn();

    render(
      <BudgetsCategoriesTab
        allCategories={[mockCategory]}
        onSeedCategories={onSeedCategories}
        isSeeding={false}
        isSeedError={false}
        seedFeedback={null}
        onOpenCreateCategory={onOpenCreateCategory}
        onEditCategory={vi.fn()}
      />
    );

    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Restaurar padrões")).toBeInTheDocument();

    const user = userEvent.setup();
    const seedBtn = screen.getByRole("button", { name: /Restaurar padrões/i });
    await user.click(seedBtn);
    expect(onSeedCategories).toHaveBeenCalled();
  });
});
