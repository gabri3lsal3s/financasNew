import { useState } from "react";
import { Rocket } from "lucide-react";
import { Input, MoneyInput } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { FireProjectionChart } from "./fire-projection-chart";
import { DEFAULT_REAL_RETURN_RATE, fireProjection } from "@/domain/fire";
import { cn } from "@/lib/utils";

export interface PlanningSectionProps {
  /** Saldo líquido do mês (centavos) — proxy do caixa disponível. */
  balanceCents: number;
  /** Despesas mensais de referência (centavos). */
  monthlyExpensesCents: number;
  className?: string;
}

/**
 * PlanningSection (F24) — simulador FIRE.
 *
 * 100% presentacional: recebe saldo/despesa do mês e mantém os inputs do
 * simulador (aporte, despesa e retorno real) em estado local de UI. Os
 * motores são puros (`domain/fire`) — nada de cálculo na UI.
 */
export function PlanningSection({ balanceCents, monthlyExpensesCents, className }: PlanningSectionProps) {
  const [contributionCents, setContributionCents] = useState<number | null>(null);
  const [expensesCents, setExpensesCents] = useState<number | null>(null);
  const [returnPct, setReturnPct] = useState(String(Math.round(DEFAULT_REAL_RETURN_RATE * 100)));

  const effectiveContribution = contributionCents ?? Math.max(0, balanceCents);
  const effectiveExpenses = expensesCents ?? Math.max(0, monthlyExpensesCents);
  const realReturn = (Number(returnPct) || DEFAULT_REAL_RETURN_RATE * 100) / 100;

  const projection = fireProjection({
    annualExpensesCents: effectiveExpenses * 12,
    initialCapitalCents: 0,
    monthlyContributionCents: effectiveContribution,
    realReturnRate: realReturn,
  });

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Simulador FIRE — card em linha cheia */}
      <section
        aria-label="Independência financeira"
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:p-5 min-w-0 overflow-hidden"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-positive/10 border border-positive/20 text-positive-strong">
            <Rocket className="size-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Independência financeira (FIRE)</h2>
            <p className="truncate text-[11px] text-muted-foreground">Meta: despesas anuais × 25, retirada de 4% ao ano.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 min-w-0">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Aporte mensal
            <MoneyInput cents={effectiveContribution} onCentsChange={setContributionCents} size="sm" aria-label="Aporte mensal" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Despesa mensal
            <MoneyInput cents={effectiveExpenses} onCentsChange={setExpensesCents} size="sm" aria-label="Despesa mensal" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Retorno real % a.a.
            <Input
              type="text"
              inputMode="decimal"
              value={returnPct}
              onChange={(event) => setReturnPct(event.target.value)}
              aria-label="Retorno real anual em percentual"
              className="h-8 text-sm"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs min-w-0">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 min-w-0">
            <p className="text-muted-foreground">Meta FIRE (4%)</p>
            <MoneyText cents={projection.targetCents} tone="positive" className="text-sm truncate" />
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 min-w-0">
            <p className="text-muted-foreground">Tempo até a meta</p>
            <p className="num text-sm font-semibold text-foreground truncate">
              {projection.yearsToFire === null ? `+${projection.series.length - 1} anos` : `${projection.yearsToFire} ${projection.yearsToFire === 1 ? "ano" : "anos"}`}
            </p>
          </div>
        </div>

        <FireProjectionChart series={projection.series} targetCents={projection.targetCents} className="mx-auto w-full max-w-[460px] min-w-0" />

        <p className="text-[11px] text-muted-foreground">
          Regra dos 4%: meta = despesas anuais × 25, com retirada anual de 4%. Simulação determinística e
          simplificada (retorno real constante, sem inflação implícita) — apenas um norte, sem garantias.
        </p>
      </section>
    </div>
  );
}
