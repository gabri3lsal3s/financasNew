import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Shield, SlidersHorizontal } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import { buildEmergencyFundBreakdown } from "@/domain/calculation-memory";
import {
  EMERGENCY_HEALTH_LABELS,
  calculateEmergencyFund,
  type EmergencyFundComposition,
  type EmergencyHealth,
} from "@/domain/projection";
import { currentMonth } from "@/lib/date";
import { cn } from "@/lib/utils";
import { EmergencyThermometerComposition } from "./overview/emergency-thermometer-composition";
import { EmergencyThermometerMilestones } from "./overview/emergency-thermometer-milestones";

export interface EmergencyThermometerProps {
  liquidReserveCents: number;
  monthlyExpensesCents: number;
  monthlySavingsVelocityCents?: number;
  referenceMonth?: string;
  className?: string;
  composition?: EmergencyFundComposition;
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
    customReserveCents !== null || customExpensesCents !== null || customVelocityCents !== null;

  const result = calculateEmergencyFund({
    currentLiquidCents: effectiveReserve,
    monthlyExpensesCents: effectiveExpenses,
    monthlySavingsVelocityCents: effectiveVelocity,
    referenceMonth,
  });

  const emergencyBreakdown = useMemo(() => {
    return buildEmergencyFundBreakdown({
      liquidReserveCents: effectiveReserve,
      monthlyExpensesCents: effectiveExpenses,
      targetMonths: 6,
      targetCents: result.milestone6m.targetCents,
      monthlySavingsVelocityCents: effectiveVelocity,
    });
  }, [
    effectiveExpenses,
    effectiveReserve,
    effectiveVelocity,
    result.milestone6m.targetCents,
  ]);

  return (
    <section
      aria-label="Termômetro da reserva de emergência"
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border/80 bg-surface p-4 sm:p-5 min-w-0 shadow-xs",
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Reserva de Emergência & Autonomia</h2>
            <CalculationMemoryModal breakdown={emergencyBreakdown} />
            {composition && composition.portfolioReserveCents > 0 ? (
              <Badge variant="muted" size="xs">
                Sincronizada
              </Badge>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Cobertura atual:{" "}
            <strong className="font-semibold text-foreground tabular-nums">
              {result.currentMonthsCovered} {result.currentMonthsCovered === 1 ? "mês" : "meses"}
            </strong>{" "}
            {result.currentMonthsCovered > 0 ? `(~${Math.round(result.currentMonthsCovered * 30)} dias)` : null} de custo de vida.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Badge variant={HEALTH_BADGE_VARIANTS[result.health]} size="sm">
            {EMERGENCY_HEALTH_LABELS[result.health]}
          </Badge>
          {onOpenConfig ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenConfig}
              className="h-7 px-2 text-xs text-foreground hover:bg-surface-hover cursor-pointer"
            >
              <Shield className="size-3.5 mr-1 text-muted-foreground" aria-hidden="true" />
              Configurar reserva
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            sensoryIntent="toggle"
            onClick={() => setShowAdjustments((prev) => !prev)}
            aria-expanded={showAdjustments}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <SlidersHorizontal className="size-3.5 mr-1" aria-hidden="true" />
            {showAdjustments ? "Ocultar ajustes" : "Ajustar simulação"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs min-w-0">
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3 min-w-0">
          <p className="text-muted-foreground">Autonomia estimada</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {result.currentMonthsCovered} {result.currentMonthsCovered === 1 ? "mês" : "meses"}
            </span>
            {result.currentMonthsCovered > 0 ? (
              <span className="text-[11px] text-muted-foreground">
                (~{Math.round(result.currentMonthsCovered * 30)} dias)
              </span>
            ) : null}
          </div>
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">Reserva disponível</p>
            {(composition?.breakdown?.length ?? 0) > 0 ? (
              <button
                type="button"
                onClick={() => setShowCompositionDetails((prev) => !prev)}
                className="relative text-[10px] text-primary-strong hover:underline flex items-center gap-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded max-sm:after:absolute max-sm:after:-inset-2"
              >
                <span>{showCompositionDetails ? "Ocultar" : "Origem"}</span>
                {showCompositionDetails ? (
                  <ChevronUp className="size-3" aria-hidden="true" />
                ) : (
                  <ChevronDown className="size-3" aria-hidden="true" />
                )}
              </button>
            ) : null}
          </div>
          <MoneyText
            cents={effectiveReserve}
            tone={effectiveReserve >= 0 ? "positive" : "negative"}
            className="text-sm font-semibold whitespace-nowrap tabular-nums"
          />
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3 min-w-0">
          <p className="text-muted-foreground">Custo de vida mensal base</p>
          <MoneyText
            cents={effectiveExpenses}
            tone="default"
            className="text-sm font-semibold whitespace-nowrap tabular-nums"
          />
        </div>
      </div>

      {composition ? (
        <EmergencyThermometerComposition
          composition={composition}
          showDetails={showCompositionDetails}
          onOpenConfig={onOpenConfig}
        />
      ) : null}

      <EmergencyThermometerMilestones
        result={result}
        showAdjustments={showAdjustments}
        isCustomized={isCustomized}
        effectiveReserve={effectiveReserve}
        effectiveExpenses={effectiveExpenses}
        effectiveVelocity={effectiveVelocity}
        onReserveChange={setCustomReserveCents}
        onExpensesChange={setCustomExpensesCents}
        onVelocityChange={setCustomVelocityCents}
        onReset={() => {
          setCustomReserveCents(null);
          setCustomExpensesCents(null);
          setCustomVelocityCents(null);
        }}
      />
    </section>
  );
}
