import { useMemo } from "react";
import { MoneyText } from "@/components/ui";
import { KpiCard, KpiGrid } from "@/components/modules";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import {
  buildMonthlyExpensesBreakdown,
  buildMonthlyIncomeBreakdown,
  buildOperatingBalanceBreakdown,
} from "@/domain/calculation-memory";

export interface TransactionSummaryKpisProps {
  month?: string;
  incomesTotalCents: number;
  incomesWeightedCents: number;
  expensesTotalCents: number;
  expensesWeightedCents: number;
  balanceCents: number;
  balanceWeightedCents: number;
}

function WeightedHint({ label, cents }: { label: string; cents: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium text-foreground text-[11px] whitespace-nowrap tabular-nums">
      <span className="hidden sm:inline">{label}:</span>
      <span className="sm:hidden">Pond:</span>
      <MoneyText cents={cents} tone="default" variant="caption" className="text-[11px]" />
    </span>
  );
}

/** Grade de KPIs de receitas, despesas e saldo mensal da tela de transações. */
export function TransactionSummaryKpis({
  month = "atual",
  incomesTotalCents,
  incomesWeightedCents,
  expensesTotalCents,
  expensesWeightedCents,
  balanceCents,
  balanceWeightedCents,
}: TransactionSummaryKpisProps) {
  const incomeBreakdown = useMemo(() => {
    return buildMonthlyIncomeBreakdown({
      month,
      grossIncomeCents: incomesTotalCents,
      weightedIncomeCents: incomesWeightedCents,
    });
  }, [incomesTotalCents, incomesWeightedCents, month]);

  const expenseBreakdown = useMemo(() => {
    return buildMonthlyExpensesBreakdown({
      month,
      grossExpenseCents: expensesTotalCents,
      weightedExpenseCents: expensesWeightedCents,
    });
  }, [expensesTotalCents, expensesWeightedCents, month]);

  const balanceBreakdown = useMemo(() => {
    return buildOperatingBalanceBreakdown({
      month,
      incomeCents: incomesWeightedCents,
      expenseCents: expensesWeightedCents,
      operatingBalanceCents: balanceWeightedCents,
    });
  }, [balanceWeightedCents, expensesWeightedCents, incomesWeightedCents, month]);

  return (
    <KpiGrid columns={3}>
      <KpiCard
        label="Receitas"
        cents={incomesTotalCents}
        tone="positive"
        action={<CalculationMemoryModal breakdown={incomeBreakdown} />}
        hint={
          incomesTotalCents !== incomesWeightedCents ? (
            <WeightedHint label="Ponderada" cents={incomesWeightedCents} />
          ) : undefined
        }
      />
      <KpiCard
        label="Despesas"
        cents={expensesTotalCents}
        tone="negative"
        action={<CalculationMemoryModal breakdown={expenseBreakdown} />}
        hint={
          expensesTotalCents !== expensesWeightedCents ? (
            <WeightedHint label="Ponderada" cents={expensesWeightedCents} />
          ) : undefined
        }
      />
      <KpiCard
        label="Saldo do mês"
        cents={balanceCents}
        tone={balanceCents >= 0 ? "positive" : "negative"}
        action={<CalculationMemoryModal breakdown={balanceBreakdown} />}
        hint={
          balanceCents !== balanceWeightedCents ? (
            <WeightedHint label="Ponderado" cents={balanceWeightedCents} />
          ) : undefined
        }
      />
    </KpiGrid>
  );
}
