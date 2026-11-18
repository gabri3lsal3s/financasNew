import type { FamilyConsolidationResult, FamilyPortfolioSummary } from "@/types";
import { HouseholdBalanceCard } from "./household-balance-card";
import { HouseholdCeilingCard } from "./household-ceiling-card";
import { HouseholdClusteringRanking } from "./household-clustering-ranking";
import { HouseholdCombinedFlowCard } from "./household-combined-flow-card";
import { HouseholdComparisonCard } from "./household-comparison-card";
import { HouseholdExpenseFeed } from "./household-expense-feed";
import { HouseholdWealthCard } from "./household-wealth-card";

export interface FamilyConsolidationDashboardProps {
  consolidation: FamilyConsolidationResult;
  portfolioSummary: FamilyPortfolioSummary | null | undefined;
  currentUserId?: string;
  onOpenSettlement: () => void;
  onOpenManageAssets: () => void;
}

export function FamilyConsolidationDashboard({
  consolidation,
  portfolioSummary,
  currentUserId,
  onOpenSettlement,
  onOpenManageAssets,
}: FamilyConsolidationDashboardProps) {
  const isCombinedMode = consolidation.family.split_rule === "combined";

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {isCombinedMode ? (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <HouseholdCombinedFlowCard
            totalIncomeCents={consolidation.total_income_cents}
            totalSpentCents={consolidation.total_spent_cents}
          />
          <HouseholdCeilingCard
            monthlyCeilingCents={consolidation.monthly_ceiling_cents}
            totalSpentCents={consolidation.total_spent_cents}
            remainingCents={consolidation.remaining_cents}
            spentPercentage={consolidation.spent_percentage}
            totalIncomeCents={consolidation.total_income_cents}
          />
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <HouseholdCeilingCard
              monthlyCeilingCents={consolidation.monthly_ceiling_cents}
              totalSpentCents={consolidation.total_spent_cents}
              remainingCents={consolidation.remaining_cents}
              spentPercentage={consolidation.spent_percentage}
              totalIncomeCents={consolidation.total_income_cents}
            />
            <HouseholdBalanceCard
              members={consolidation.members}
              splitRule={consolidation.family.split_rule}
              isSettled={consolidation.is_settled}
              settlement={consolidation.settlement}
              hasPostSettlementExpenses={consolidation.has_post_settlement_expenses}
              onOpenSettlement={onOpenSettlement}
            />
          </section>

          <section>
            <HouseholdComparisonCard
              members={consolidation.members}
              expenses={consolidation.expenses}
              monthlyCeilingCents={consolidation.monthly_ceiling_cents}
              splitRule={consolidation.family.split_rule}
              month={consolidation.month}
            />
          </section>
        </>
      )}

      <section>
        <HouseholdClusteringRanking expenses={consolidation.expenses} />
      </section>

      <section>
        <HouseholdExpenseFeed
          expenses={consolidation.expenses}
          currentUserId={currentUserId}
        />
      </section>

      <section>
        <HouseholdWealthCard
          portfolioSummary={portfolioSummary}
          monthlyCeilingCents={consolidation.monthly_ceiling_cents}
          monthlyExpensesCents={consolidation.total_spent_cents}
          onOpenManageAssets={onOpenManageAssets}
        />
      </section>
    </div>
  );
}
