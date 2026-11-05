import { useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { Badge, Button, MoneyInput, Progress } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import {
  EMERGENCY_HEALTH_LABELS,
  calculateEmergencyFund,
  type EmergencyFundComposition,
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
  /** Composição detalhada da reserva (contas + ativos de investimento). */
  composition?: EmergencyFundComposition;
  /** Callback para abrir o diálogo de configuração da composição. */
  onOpenConfig?: () => void;
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
  composition,
  onOpenConfig,
}: EmergencyThermometerProps) {
  const [customReserveCents, setCustomReserveCents] = useState<number | null>(null);
  const [customExpensesCents, setCustomExpensesCents] = useState<number | null>(null);
  const [customVelocityCents, setCustomVelocityCents] = useState<number | null>(null);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [showCompositionDetails, setShowCompositionDetails] = useState(false);

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
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Reserva de Emergência & Autonomia</h2>
            {composition && composition.portfolioReserveCents > 0 && (
              <Badge variant="muted" size="xs">
                Sincronizada
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
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
          {onOpenConfig && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenConfig}
              className="h-7 px-2 text-xs text-foreground hover:bg-surface-hover"
            >
              <Shield className="size-3.5 mr-1 text-muted-foreground" aria-hidden="true" />
              Configurar reserva
            </Button>
          )}
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
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">Reserva disponível</p>
            {Boolean(composition?.breakdown?.length) && (
              <button
                type="button"
                onClick={() => setShowCompositionDetails((prev) => !prev)}
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
              >
                <span>{showCompositionDetails ? "Ocultar" : "Origem"}</span>
                {showCompositionDetails ? (
                  <ChevronUp className="size-3" aria-hidden="true" />
                ) : (
                  <ChevronDown className="size-3" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
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

      {/* Detalhamento Expansível da Composição (Origem dos Recursos) */}
      {showCompositionDetails && composition && composition.breakdown.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/15 p-3 min-w-0 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Composição da Reserva ({composition.breakdown.length} fontes):</span>
            <span className="text-[11px] text-muted-foreground">
              {composition.cashInAccountsCents > 0 && (
                <span>Contas: {Math.round((composition.cashInAccountsCents / composition.totalReserveCents) * 100)}% · </span>
              )}
              Investimentos: {Math.round((composition.portfolioReserveCents / composition.totalReserveCents) * 100)}%
            </span>
          </div>

          <div className="flex flex-col gap-1.5 pt-1">
            {composition.breakdown.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-surface border border-border/40 text-xs min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-foreground truncate">{item.label}</span>
                  {item.assetClass && (
                    <Badge variant="muted" size="xs">
                      {item.assetClass}
                    </Badge>
                  )}
                  {item.isCashEquivalent && (
                    <Badge variant="positive" size="xs">
                      Liquidez
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <MoneyText cents={item.selectedCents} tone="default" className="font-semibold tabular-nums" />
                  <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                    {item.pctOfTotal}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Avisos de Risco / Liquidez na Reserva */}
      {composition && composition.warnings.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning-strong">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate">
            {composition.warnings[0]?.message}
          </span>
          {onOpenConfig && (
            <button
              type="button"
              onClick={onOpenConfig}
              className="text-[11px] font-medium underline shrink-0 hover:opacity-80"
            >
              Ajustar
            </button>
          )}
        </div>
      )}

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
