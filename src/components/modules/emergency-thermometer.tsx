import { useState } from "react";
import { Calendar, CheckCircle2, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Badge, Button, MoneyInput, Progress } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import {
  EMERGENCY_HEALTH_LABELS,
  calculateEmergencyFund,
  type EmergencyHealth,
} from "@/domain/projection";
import { currentMonth } from "@/lib/date";
import { cn } from "@/lib/utils";

export interface EmergencyThermometerProps {
  /** Saldo acumulado detectado para a reserva (centavos). */
  liquidReserveCents: number;
  /** Custo de vida mensal de referência (centavos). */
  monthlyExpensesCents: number;
  /** Capacidade / aporte mensal de poupança (centavos). */
  monthlySavingsVelocityCents?: number;
  /** Mês de referência ("YYYY-MM"). Padrão: mês corrente. */
  referenceMonth?: string;
  className?: string;
}

const HEALTH_BADGE_VARIANTS: Record<EmergencyHealth, "critical" | "warning" | "positive" | "portfolio"> = {
  critico: "critical",
  baixo: "warning",
  adequado: "positive",
  saudavel: "portfolio",
};

/**
 * Termômetro da Reserva de Emergência — Módulo de Projeção.
 *
 * Avalia a cobertura atual do custo de vida em meses e projeta
 * a conclusão dos marcos essenciais (3, 6 e 12 meses).
 *
 * 100% presentacional: consome motor puro de `domain/projection/emergency-fund`.
 */
export function EmergencyThermometer({
  liquidReserveCents,
  monthlyExpensesCents,
  monthlySavingsVelocityCents = 0,
  referenceMonth = currentMonth(),
  className,
}: EmergencyThermometerProps) {
  const [customReserveCents, setCustomReserveCents] = useState<number | null>(null);
  const [customExpensesCents, setCustomExpensesCents] = useState<number | null>(null);
  const [customVelocityCents, setCustomVelocityCents] = useState<number | null>(null);
  const [showAdjustments, setShowAdjustments] = useState(false);

  const effectiveReserve = customReserveCents ?? Math.max(0, liquidReserveCents);
  const effectiveExpenses = customExpensesCents ?? Math.max(0, monthlyExpensesCents);
  const effectiveVelocity = customVelocityCents ?? Math.max(0, monthlySavingsVelocityCents);

  const isCustomized =
    customReserveCents !== null ||
    customExpensesCents !== null ||
    customVelocityCents !== null;

  function handleReset() {
    setCustomReserveCents(null);
    setCustomExpensesCents(null);
    setCustomVelocityCents(null);
  }

  const result = calculateEmergencyFund({
    currentLiquidCents: effectiveReserve,
    monthlyExpensesCents: effectiveExpenses,
    monthlySavingsVelocityCents: effectiveVelocity,
    referenceMonth,
  });

  const milestoneCards = [
    {
      label: "3 Meses",
      subtitle: "Básico / Essencial",
      data: result.milestone3m,
    },
    {
      label: "6 Meses",
      subtitle: "Adequado / Recomendado",
      data: result.milestone6m,
    },
    {
      label: "12 Meses",
      subtitle: "Confortável / Alta Segurança",
      data: result.milestone12m,
    },
  ];

  return (
    <section
      aria-label="Termômetro da reserva de emergência"
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border/80 bg-surface p-4 sm:p-5 min-w-0 shadow-xs",
        className,
      )}
    >
      {/* Cabeçalho Composto Adaptativo (Regra 12) */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Reserva de Emergência & Autonomia</h2>
          <p className="text-[11px] text-muted-foreground">
            Cobertura atual:{" "}
            <strong className="font-semibold text-foreground tabular-nums">
              {result.currentMonthsCovered} {result.currentMonthsCovered === 1 ? "mês" : "meses"}
            </strong>{" "}
            {result.currentMonthsCovered > 0 && `(~${Math.round(result.currentMonthsCovered * 30)} dias)`} de custo de vida.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Badge variant={HEALTH_BADGE_VARIANTS[result.health]} size="sm">
            {EMERGENCY_HEALTH_LABELS[result.health]}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAdjustments((prev) => !prev)}
            aria-expanded={showAdjustments}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <SlidersHorizontal className="size-3.5 mr-1" aria-hidden="true" />
            {showAdjustments ? "Ocultar ajustes" : "Ajustar simulação"}
          </Button>
        </div>
      </div>

      {/* Indicadores-Base de Autonomia & Cobertura */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs min-w-0">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 min-w-0">
          <p className="text-muted-foreground">Autonomia estimada</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {result.currentMonthsCovered} {result.currentMonthsCovered === 1 ? "mês" : "meses"}
            </span>
            {result.currentMonthsCovered > 0 && (
              <span className="text-[11px] text-muted-foreground">
                (~{Math.round(result.currentMonthsCovered * 30)} dias)
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 min-w-0">
          <p className="text-muted-foreground">Reserva disponível</p>
          <MoneyText
            cents={effectiveReserve}
            tone={effectiveReserve >= 0 ? "positive" : "negative"}
            className="text-sm font-semibold whitespace-nowrap tabular-nums"
          />
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 min-w-0">
          <p className="text-muted-foreground">Custo de vida mensal base</p>
          <MoneyText
            cents={effectiveExpenses}
            tone="default"
            className="text-sm font-semibold whitespace-nowrap tabular-nums"
          />
        </div>
      </div>

      {/* Painel de Ajustes Opcionais (Ajuste fino de premissas) */}
      {showAdjustments && (
        <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Premissas de Cálculo</span>
            {isCustomized && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3 mr-1" aria-hidden="true" />
                Restaurar valores detectados
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 min-w-0">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              Saldo atual da reserva
              <MoneyInput
                cents={effectiveReserve}
                onCentsChange={setCustomReserveCents}
                size="sm"
                aria-label="Saldo atual da reserva"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              Custo de vida mensal
              <MoneyInput
                cents={effectiveExpenses}
                onCentsChange={setCustomExpensesCents}
                size="sm"
                aria-label="Custo de vida mensal"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              Aporte mensal para reserva
              <MoneyInput
                cents={effectiveVelocity}
                onCentsChange={setCustomVelocityCents}
                size="sm"
                aria-label="Aporte mensal para reserva"
              />
            </label>
          </div>
        </div>
      )}

      {/* Grid Mobile-First de Marcos da Reserva (Regra 10) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {milestoneCards.map(({ label, subtitle, data }) => (
          <div
            key={label}
            className={cn(
              "flex flex-col gap-2.5 p-3.5 rounded-lg border transition-colors",
              data.isReached
                ? "border-positive/30 bg-positive/5"
                : "border-border/60 bg-muted/20",
            )}
          >
            <div className="flex items-start justify-between gap-1">
              <div>
                <span className="text-xs font-semibold text-foreground block">{label}</span>
                <span className="text-[10px] text-muted-foreground">{subtitle}</span>
              </div>
              <span
                className={cn(
                  "text-xs font-bold tabular-nums whitespace-nowrap",
                  data.isReached ? "text-positive-strong" : "text-muted-foreground",
                )}
              >
                {data.progressPercent}%
              </span>
            </div>

            <Progress
              value={data.progressPercent}
              aria-label={`Progresso da meta de ${label}: ${data.progressPercent}%`}
              className="h-1.5"
            />

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
              <span>
                Meta:{" "}
                <MoneyText
                  cents={data.targetCents}
                  tone="default"
                  className="font-semibold text-foreground whitespace-nowrap tabular-nums"
                />
              </span>
              <span className="flex items-center gap-1 shrink-0">
                {data.isReached ? (
                  <>
                    <CheckCircle2 className="size-3 text-positive-strong" aria-hidden="true" />
                    <span className="font-medium text-positive-strong">Atingido</span>
                  </>
                ) : (
                  <>
                    <Calendar className="size-3" aria-hidden="true" />
                    <span>
                      {data.estimatedCompletionMonth
                        ? `Previsão: ${data.estimatedCompletionMonth}`
                        : "Sem previsão"}
                    </span>
                  </>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
