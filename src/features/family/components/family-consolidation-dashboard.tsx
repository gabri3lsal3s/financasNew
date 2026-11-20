import { useState } from "react";
import { useSearchParams } from "react-router";
import { CalendarDays, Landmark, Receipt } from "lucide-react";
import { Badge, Tabs, type TabItem } from "@/components/ui";
import type { FamilyConsolidationResult, FamilyPortfolioSummary } from "@/types";
import { HouseholdBalanceCard } from "./household-balance-card";
import { HouseholdCeilingCard } from "./household-ceiling-card";
import { HouseholdClusteringRanking } from "./household-clustering-ranking";
import { HouseholdCombinedFlowCard } from "./household-combined-flow-card";
import { HouseholdComparisonCard } from "./household-comparison-card";
import { HouseholdExpenseFeed } from "./household-expense-feed";
import { HouseholdKpisGrid } from "./household-kpis-grid";
import { HouseholdWealthCard } from "./household-wealth-card";

export interface FamilyConsolidationDashboardProps {
  consolidation: FamilyConsolidationResult;
  portfolioSummary: FamilyPortfolioSummary | null | undefined;
  currentUserId?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onOpenSettlement: () => void;
  onOpenManageAssets: () => void;
}

export function FamilyConsolidationDashboard({
  consolidation,
  portfolioSummary,
  currentUserId,
  activeTab: controlledTab,
  onTabChange: controlledOnTabChange,
  onOpenSettlement,
  onOpenManageAssets,
}: FamilyConsolidationDashboardProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [localTab, setLocalTab] = useState<string>(() => {
    return searchParams.get("tab") ?? "resumo";
  });

  const activeTab = controlledTab ?? localTab;

  const handleTabChange = (newTab: string) => {
    if (controlledOnTabChange) {
      controlledOnTabChange(newTab);
    } else {
      setLocalTab(newTab);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (newTab === "resumo") {
          next.delete("tab");
        } else {
          next.set("tab", newTab);
        }
        return next;
      });
    }
  };

  const isCombinedMode = consolidation.family.split_rule === "combined";

  const tabItems: TabItem[] = [
    {
      value: "resumo",
      label: "Visão do Mês",
      shortLabel: "Mês",
      icon: <CalendarDays className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-5 sm:gap-6 min-w-0">
          {/* Grid Canônico Superior de KPIs */}
          <HouseholdKpisGrid
            consolidation={consolidation}
            currentUserId={currentUserId}
            onOpenSettlement={onOpenSettlement}
          />

          {isCombinedMode ? (
            <div className="flex flex-col gap-5 sm:gap-6 min-w-0">
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
                month={consolidation.month}
              />
              <HouseholdClusteringRanking
                expenses={consolidation.expenses}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-5 sm:gap-6 min-w-0">
              {/* 1. Teto e Ritmo de Gastos da Casa (Largura total, dados orçamentários macro) */}
              <HouseholdCeilingCard
                monthlyCeilingCents={consolidation.monthly_ceiling_cents}
                totalSpentCents={consolidation.total_spent_cents}
                remainingCents={consolidation.remaining_cents}
                spentPercentage={consolidation.spent_percentage}
                totalIncomeCents={consolidation.total_income_cents}
                month={consolidation.month}
              />

              {/* 2. Equilíbrio das Contas do Mês e Ação Direta de Acerto Pix */}
              <HouseholdBalanceCard
                members={consolidation.members}
                splitRule={consolidation.family.split_rule}
                isSettled={consolidation.is_settled}
                settlement={consolidation.settlement}
                hasPostSettlementExpenses={consolidation.has_post_settlement_expenses}
                onOpenSettlement={onOpenSettlement}
              />

              {/* 3. Comparativo Detalhado de Cotas e Contribuição entre Participantes */}
              <HouseholdComparisonCard
                members={consolidation.members}
                expenses={consolidation.expenses}
                monthlyCeilingCents={consolidation.monthly_ceiling_cents}
                splitRule={consolidation.family.split_rule}
                month={consolidation.month}
              />

              {/* 4. Ranking de Consumo Familiar Agrupado por Categoria */}
              <HouseholdClusteringRanking
                expenses={consolidation.expenses}
              />
            </div>
          )}
        </div>
      ),
    },
    {
      value: "extrato",
      label: "Extrato",
      shortLabel: "Extrato",
      icon: <Receipt className="size-4" aria-hidden="true" />,
      badge: (
        <Badge variant="muted" size="xs">
          {consolidation.expenses.length}
        </Badge>
      ),
      content: (
        <div className="flex flex-col gap-5 sm:gap-6 min-w-0">
          <HouseholdExpenseFeed
            expenses={consolidation.expenses}
            currentUserId={currentUserId}
          />
        </div>
      ),
    },
    {
      value: "patrimonio",
      label: "Patrimônio",
      shortLabel: "Patrimônio",
      icon: <Landmark className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-5 sm:gap-6 min-w-0">
          <HouseholdWealthCard
            portfolioSummary={portfolioSummary}
            monthlyCeilingCents={consolidation.monthly_ceiling_cents}
            monthlyExpensesCents={consolidation.total_spent_cents}
            onOpenManageAssets={onOpenManageAssets}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        items={tabItems}
        variant="underline"
        fullWidth={false}
        swipeable
        forceMount
        ariaLabel="Abas da consolidação familiar"
      />
    </div>
  );
}
