import { useState } from "react";
import { Calendar, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { Badge, Input, MoneyInput, Progress } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { FireProjectionChart } from "./fire-projection-chart";
import {
  DEFAULT_REAL_RETURN_RATE,
  calculateHabitFireImpact,
  fireProjection,
  projectEmergencyFund,
} from "@/domain/fire";
import { currentMonth } from "@/lib/date";
import { cn } from "@/lib/utils";

export interface PlanningSectionProps {
  /** Saldo líquido do mês (centavos) — proxy do caixa disponível. */
  balanceCents: number;
  /** Despesas mensais de referência (centavos). */
  monthlyExpensesCents: number;
  className?: string;
}

/**
 * PlanningSection (F24 e F52 unificada) — Simulador FIRE + Termômetro de Reserva + Conversor de Hábitos.
 *
 * 100% presentacional: consome motores puros de domínio de `domain/fire`.
 */
export function PlanningSection({ balanceCents, monthlyExpensesCents, className }: PlanningSectionProps) {
  const [contributionCents, setContributionCents] = useState<number | null>(null);
  const [expensesCents, setExpensesCents] = useState<number | null>(null);
  const [returnPct, setReturnPct] = useState(String(Math.round(DEFAULT_REAL_RETURN_RATE * 100)));
  const [habitSavingsCents, setHabitSavingsCents] = useState<number | null>(15000); // R$ 150,00 padrão

  const effectiveContribution = contributionCents ?? Math.max(0, balanceCents);
  const effectiveExpenses = expensesCents ?? Math.max(0, monthlyExpensesCents);
  const realReturn = (Number(returnPct) || DEFAULT_REAL_RETURN_RATE * 100) / 100;

  const projection = fireProjection({
    annualExpensesCents: effectiveExpenses * 12,
    initialCapitalCents: 0,
    monthlyContributionCents: effectiveContribution,
    realReturnRate: realReturn,
  });

  const emergencyFund = projectEmergencyFund({
    currentLiquidCents: balanceCents,
    monthlyExpensesCents: effectiveExpenses,
    monthlySavingsVelocityCents: effectiveContribution,
    referenceMonth: currentMonth(),
  });

  const habitImpact = calculateHabitFireImpact({
    habitMonthlyCostCents: habitSavingsCents ?? 0,
    baselineAnnualExpensesCents: effectiveExpenses * 12,
    baselineInitialCapitalCents: 0,
    baselineMonthlyContributionCents: effectiveContribution,
    realReturnRate: realReturn,
  });

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Termômetro Preditivo da Reserva de Emergência (§F52) */}
      <section
        aria-label="Termômetro da reserva de emergência"
        className="flex flex-col gap-4 rounded-xl border border-border/80 bg-surface p-4 sm:p-5 min-w-0 shadow-xs"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Termômetro da Reserva de Emergência</h2>
              <p className="truncate text-[11px] text-muted-foreground">
                Cobertura atual: <strong className="font-semibold text-foreground">{emergencyFund.currentMonthsCovered} meses</strong> de custo de vida.
              </p>
            </div>
          </div>
          <Badge variant="portfolio" className="text-xs">
            Caixa Atual: <MoneyText cents={balanceCents} tone="default" className="font-semibold ml-1" />
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: "3 Meses (Básico)", data: emergencyFund.milestone3m },
            { label: "6 Meses (Adequado)", data: emergencyFund.milestone6m },
            { label: "12 Meses (Confortável)", data: emergencyFund.milestone12m },
          ].map(({ label, data }) => (
            <div
              key={label}
              className={cn(
                "flex flex-col gap-2 p-3 rounded-lg border",
                data.isReached
                  ? "border-positive/30 bg-positive/5"
                  : "border-border/60 bg-muted/20",
              )}
            >
              <div className="flex items-center justify-between gap-1 text-xs">
                <span className="font-medium text-foreground">{label}</span>
                <span className="num font-semibold text-muted-foreground">{data.progressPercent}%</span>
              </div>
              <Progress value={data.progressPercent} className="h-1.5" />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>Alvo: <MoneyText cents={data.targetCents} tone="default" /></span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" aria-hidden="true" />
                  {data.isReached ? "Concluído" : data.estimatedCompletionMonth ? `Previsão: ${data.estimatedCompletionMonth}` : "Sem previsão"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Simulador FIRE — card em linha cheia */}
      <section
        aria-label="Independência financeira"
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:p-5 min-w-0 overflow-hidden shadow-xs"
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
            <MoneyText cents={projection.targetCents} tone="positive" className="text-sm font-semibold whitespace-nowrap" />

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

      {/* Conversor de Impacto FIRE ("O Custo do Hábito na Aposentadoria") (§F52) */}
      <section
        aria-label="Impacto de hábitos na aposentadoria"
        className="flex flex-col gap-4 rounded-xl border border-border/80 bg-surface p-4 sm:p-5 min-w-0 shadow-xs"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-warning/10 border border-warning/20 text-warning-strong">
              <Sparkles className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">O Impacto do Hábito na Aposentadoria</h2>
              <p className="truncate text-[11px] text-muted-foreground">
                Descubra o tempo de liberdade ganho ao cortar uma despesa recorrente.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:w-64 shrink-0">
            Economia mensal simulada
            <MoneyInput
              cents={habitSavingsCents ?? 0}
              onCentsChange={setHabitSavingsCents}
              size="sm"
              aria-label="Economia mensal simulada"
            />
          </label>
          <div className="flex-1 p-3 rounded-lg border border-border/60 bg-muted/20 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{habitImpact.impactSummary}</p>
            <p className="text-[11px] mt-1">
              Redução na meta patrimonial necessária: <MoneyText cents={habitImpact.fireTargetReductionCents} tone="positive" className="font-semibold" />
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">

          <div className="p-2.5 rounded-lg border border-border/60 bg-muted/30">
            <span className="text-[10px] text-muted-foreground block">Em 10 anos:</span>
            <MoneyText cents={habitImpact.futureValue10yCents} tone="default" className="text-xs font-semibold" />
          </div>
          <div className="p-2.5 rounded-lg border border-border/60 bg-muted/30">
            <span className="text-[10px] text-muted-foreground block">Em 20 anos:</span>
            <MoneyText cents={habitImpact.futureValue20yCents} tone="default" className="text-xs font-semibold" />
          </div>
          <div className="p-2.5 rounded-lg border border-border/60 bg-muted/30">
            <span className="text-[10px] text-muted-foreground block">Em 30 anos:</span>
            <MoneyText cents={habitImpact.futureValue30yCents} tone="positive" className="text-xs font-semibold" />
          </div>
        </div>
      </section>
    </div>
  );
}
