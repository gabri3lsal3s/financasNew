import { useId } from "react";
import { Calendar, CheckCircle2, RotateCcw } from "lucide-react";
import { Button, MoneyInput, Progress } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import type { calculateEmergencyFund } from "@/domain/projection";
import { formatMonthYear } from "@/lib/date";
import { cn } from "@/lib/utils";

export interface EmergencyThermometerMilestonesProps {
  result: ReturnType<typeof calculateEmergencyFund>;
  showAdjustments: boolean;
  isCustomized: boolean;
  effectiveReserve: number;
  effectiveExpenses: number;
  effectiveVelocity: number;
  onReserveChange: (cents: number | null) => void;
  onExpensesChange: (cents: number | null) => void;
  onVelocityChange: (cents: number | null) => void;
  onReset: () => void;
}

/**
 * Painel simulador de premissas e grade dos marcos de 3, 6 e 12 meses da reserva.
 */
export function EmergencyThermometerMilestones({
  result,
  showAdjustments,
  isCustomized,
  effectiveReserve,
  effectiveExpenses,
  effectiveVelocity,
  onReserveChange,
  onExpensesChange,
  onVelocityChange,
  onReset,
}: EmergencyThermometerMilestonesProps) {
  const reserveId = useId();
  const expensesId = useId();
  const velocityId = useId();

  const milestoneCards = [
    { label: "3 Meses", subtitle: "Básico / Essencial", data: result.milestone3m },
    { label: "6 Meses", subtitle: "Adequado / Recomendado", data: result.milestone6m },
    { label: "12 Meses", subtitle: "Confortável / Alta Segurança", data: result.milestone12m },
  ];

  return (
    <>
      {showAdjustments ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/20 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Premissas de Cálculo</span>
            {isCustomized ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3 mr-1" aria-hidden="true" />
                Restaurar valores detectados
              </Button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 min-w-0">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={reserveId} className="text-xs font-semibold text-foreground">
                Saldo atual da reserva
              </label>
              <MoneyInput
                id={reserveId}
                cents={effectiveReserve}
                onCentsChange={onReserveChange}
                size="sm"
                aria-label="Saldo atual da reserva"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={expensesId} className="text-xs font-semibold text-foreground">
                Custo de vida mensal
              </label>
              <MoneyInput
                id={expensesId}
                cents={effectiveExpenses}
                onCentsChange={onExpensesChange}
                size="sm"
                aria-label="Custo de vida mensal"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={velocityId} className="text-xs font-semibold text-foreground">
                Aporte mensal para reserva
              </label>
              <MoneyInput
                id={velocityId}
                cents={effectiveVelocity}
                onCentsChange={onVelocityChange}
                size="sm"
                aria-label="Aporte mensal para reserva"
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {milestoneCards.map(({ label, subtitle, data }) => (
          <div
            key={label}
            className={cn(
              "flex flex-col gap-2.5 p-3.5 rounded-lg border transition-colors",
              data.isReached ? "border-positive/30 bg-positive/5" : "border-border/80 bg-muted/20",
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
                        ? `Previsão: ${formatMonthYear(data.estimatedCompletionMonth)}`
                        : "Sem previsão"}
                    </span>
                  </>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
