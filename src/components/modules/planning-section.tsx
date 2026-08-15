import { useState } from "react";
import { Rocket, ShieldAlert } from "lucide-react";
import { Input, MoneyInput } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { EmergencyFundGauge } from "./emergency-fund-gauge";
import { FireProjectionChart } from "./fire-projection-chart";
import { DEFAULT_REAL_RETURN_RATE, EMERGENCY_HEALTH_LABELS, emergencyFundMonths, fireProjection } from "@/domain/fire";
import { cn } from "@/lib/utils";

export interface PlanningSectionProps {
  /** Saldo líquido do mês (centavos) — proxy do caixa disponível. */
  balanceCents: number;
  /** Despesas mensais de referência (centavos). */
  monthlyExpensesCents: number;
  className?: string;
}

/**
 * PlanningSection (F24) — fundo de emergência + simulador FIRE.
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

  const emergency = emergencyFundMonths(balanceCents, effectiveExpenses);
  const projection = fireProjection({
    annualExpensesCents: effectiveExpenses * 12,
    initialCapitalCents: 0,
    monthlyContributionCents: effectiveContribution,
    realReturnRate: realReturn,
  });

  return (
    <div className={cn("grid grid-cols-1 gap-4 lg:grid-cols-2", className)}>
      {/* Fundo de emergência */}
      <section
        aria-label="Fundo de emergência"
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 min-w-0 overflow-hidden"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary-strong">
            <ShieldAlert className="size-3.5" aria-hidden="true" />
          </span>
          <h2 className="text-sm font-semibold text-foreground">Fundo de emergência</h2>
        </div>

        <div className="flex items-center justify-center py-1">
          <EmergencyFundGauge months={emergency.months} health={emergency.health} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs min-w-0">
          <div className="min-w-0">
            <p className="text-muted-foreground">Caixa (saldo do mês)</p>
            <MoneyText cents={Math.max(0, balanceCents)} tone="default" className="text-xs truncate" />
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground">Despesa mensal</p>
            <MoneyText cents={effectiveExpenses} tone="default" className="text-xs truncate" />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Reserva estimada pelo saldo líquido do mês (rendas − despesas − investimentos). Faixas:{" "}
          {EMERGENCY_HEALTH_LABELS.critico} &lt; 3 · {EMERGENCY_HEALTH_LABELS.baixo} 3–5 ·{" "}
          {EMERGENCY_HEALTH_LABELS.adequado} 6–11 · {EMERGENCY_HEALTH_LABELS.saudavel} ≥ 12 meses.
        </p>
      </section>

      {/* Simulador FIRE */}
      <section
        aria-label="Independência financeira"
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 min-w-0 overflow-hidden"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-positive/10 border border-positive/20 text-positive-strong">
            <Rocket className="size-3.5" aria-hidden="true" />
          </span>
          <h2 className="text-sm font-semibold text-foreground">Independência financeira (FIRE)</h2>
        </div>

        <div className="flex flex-col gap-2.5 min-w-0">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Aporte mensal
            <MoneyInput cents={effectiveContribution} onCentsChange={setContributionCents} size="sm" aria-label="Aporte mensal" />
          </label>
          <div className="grid grid-cols-2 gap-2.5 min-w-0">
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
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs min-w-0">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 min-w-0">
            <p className="text-muted-foreground">Meta FIRE (4%)</p>
            <MoneyText cents={projection.targetCents} tone="positive" className="text-sm truncate" />
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 min-w-0">
            <p className="text-muted-foreground">Tempo até a meta</p>
            <p className="num text-sm font-semibold text-foreground truncate">
              {projection.yearsToFire === null ? `+${projection.series.length - 1} anos` : `${projection.yearsToFire} ${projection.yearsToFire === 1 ? "ano" : "anos"}`}
            </p>
          </div>
        </div>

        <FireProjectionChart series={projection.series} targetCents={projection.targetCents} className="min-w-0" />

        <p className="text-[11px] text-muted-foreground">
          Regra dos 4%: meta = despesas anuais × 25, com retirada anual de 4%. Simulação determinística e
          simplificada (retorno real constante, sem inflação implícita) — apenas um norte, sem garantias.
        </p>
      </section>
    </div>
  );
}
