import { useMemo } from "react";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { DeltaHint, KpiCard, KpiGrid } from "@/components/modules";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import { MoneyText, SkeletonChart, SkeletonHeroCard, SkeletonKpi } from "@/components/ui";
import {
  buildInvestmentsOverviewBreakdown,
  buildMonthlyExpensesBreakdown,
  buildMonthlyIncomeBreakdown,
  buildOperatingBalanceBreakdown,
} from "@/domain/calculation-memory";
import type { DailySeriesAccumulator, OverviewTotals } from "@/domain/overview";

export interface OverviewKpiGridProps {
  month: string;
  totals: OverviewTotals;
  prevTotals: OverviewTotals;
  incomeCents: number;
  expenseCents: number;
  grossIncomeCents: number;
  grossExpenseCents: number;
  dailySeries: DailySeriesAccumulator;
  onNavigate: (to: string) => void;
}

/**
 * Placeholder esqueleto da Visão Geral enquanto consultas principais carregam.
 */
export function OverviewLoadingSkeleton({ isCurrentMonth }: { isCurrentMonth: boolean }) {
  return (
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
  );
}

/**
 * Grade de KPIs fundamentais do mês (Receitas, Despesas, Investimentos e Resultado).
 */
export function OverviewKpiGrid({
  month,
  totals,
  prevTotals,
  incomeCents,
  expenseCents,
  grossIncomeCents,
  grossExpenseCents,
  dailySeries,
  onNavigate,
}: OverviewKpiGridProps) {
  const incomeBreakdown = useMemo(() => {
    return buildMonthlyIncomeBreakdown({
      month,
      grossIncomeCents,
      weightedIncomeCents: incomeCents,
      previousIncomeCents: prevTotals.incomeCents,
    });
  }, [grossIncomeCents, incomeCents, month, prevTotals.incomeCents]);

  const expenseBreakdown = useMemo(() => {
    return buildMonthlyExpensesBreakdown({
      month,
      grossExpenseCents,
      weightedExpenseCents: expenseCents,
      previousExpenseCents: prevTotals.expenseCents,
    });
  }, [expenseCents, grossExpenseCents, month, prevTotals.expenseCents]);

  const investmentBreakdown = useMemo(() => {
    return buildInvestmentsOverviewBreakdown({
      month,
      investmentCents: totals.investmentCents,
      previousInvestmentCents: prevTotals.investmentCents,
    });
  }, [month, prevTotals.investmentCents, totals.investmentCents]);

  const balanceBreakdown = useMemo(() => {
    return buildOperatingBalanceBreakdown({
      month,
      incomeCents: totals.incomeCents,
      expenseCents: totals.expenseCents,
      investmentCents: totals.investmentCents,
      operatingBalanceCents: totals.operatingBalanceCents,
    });
  }, [
    month,
    totals.expenseCents,
    totals.incomeCents,
    totals.investmentCents,
    totals.operatingBalanceCents,
  ]);

  return (
    <KpiGrid columns={4} data-tour="overview-kpis">
      <KpiCard
        label="Receitas"
        cents={totals.incomeCents}
        tone="positive"
        icon={<TrendingUp className="size-4" aria-hidden="true" />}
        action={<CalculationMemoryModal breakdown={incomeBreakdown} />}
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
        onClick={() => onNavigate(`/transacoes?tipo=receitas&month=${month}`)}
      />
      <KpiCard
        label="Despesas"
        cents={totals.expenseCents}
        tone="negative"
        icon={<TrendingDown className="size-4" aria-hidden="true" />}
        action={<CalculationMemoryModal breakdown={expenseBreakdown} />}
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
        onClick={() => onNavigate(`/transacoes?tipo=despesas&month=${month}`)}
      />
      <KpiCard
        label="Investimentos"
        cents={totals.investmentCents}
        tone="portfolio"
        icon={<TrendingUp className="size-4" aria-hidden="true" />}
        action={<CalculationMemoryModal breakdown={investmentBreakdown} />}
        spark={dailySeries.investmentSeries}
        onClick={() => onNavigate("/investments")}
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
        action={<CalculationMemoryModal breakdown={balanceBreakdown} />}
        spark={dailySeries.balanceSeries}
        onClick={() => onNavigate("/relatorios")}
      />
    </KpiGrid>
  );
}
