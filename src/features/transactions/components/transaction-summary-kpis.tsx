import { MoneyText } from "@/components/ui";
import { KpiCard, KpiGrid } from "@/components/modules";

export interface TransactionSummaryKpisProps {
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
  incomesTotalCents,
  incomesWeightedCents,
  expensesTotalCents,
  expensesWeightedCents,
  balanceCents,
  balanceWeightedCents,
}: TransactionSummaryKpisProps) {
  return (
    <KpiGrid columns={3}>
      <KpiCard
        label="Receitas"
        cents={incomesTotalCents}
        tone="positive"
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
        hint={
          balanceCents !== balanceWeightedCents ? (
            <WeightedHint label="Ponderado" cents={balanceWeightedCents} />
          ) : undefined
        }
      />
    </KpiGrid>
  );
}
