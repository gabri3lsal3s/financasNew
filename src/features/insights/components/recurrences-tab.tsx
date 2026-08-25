import { ChevronDown, ChevronUp, EyeOff, Repeat } from "lucide-react";
import { Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { InsightList } from "@/components/modules";
import { SERVICE_SEGMENT_LABELS } from "@/domain/insights";
import { RECURRENCE_LEVEL_LABELS } from "@/lib/labels";
import type { RecurrenceOccurrence } from "@/domain/insights/recurrences";
import type { FeedbackDecision, FeedbackMap } from "@/domain/insights/feedback";

export interface RecurrencesTabProps {
  totalRecurringCents: number;
  totalAnnualRecurringCents: number;
  canCutRecurringCents: number;
  canCutAnnualCents: number;
  activeOccurrences: RecurrenceOccurrence[];
  ignoredOccurrences: RecurrenceOccurrence[];
  feedbackMap: FeedbackMap;
  showIgnored: boolean;
  setShowIgnored: (val: boolean | ((prev: boolean) => boolean)) => void;
  onFeedback: (occurrenceKey: string, decision: FeedbackDecision | null) => void;
}

export function RecurrencesTab({
  totalRecurringCents,
  totalAnnualRecurringCents,
  canCutRecurringCents,
  canCutAnnualCents,
  activeOccurrences,
  ignoredOccurrences,
  feedbackMap,
  showIgnored,
  setShowIgnored,
  onFeedback,
}: RecurrencesTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Card de Resumo de Recorrências */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6 w-full">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Total mensal recorrente</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <MoneyText cents={totalRecurringCents} tone="default" animated className="text-xl sm:text-2xl font-bold" />
              <span className="text-xs text-muted-foreground">/mês</span>
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground">Total anual projetado</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <MoneyText cents={totalAnnualRecurringCents} tone="default" animated className="text-xl sm:text-2xl font-bold" />
              <span className="text-xs text-muted-foreground">/ano</span>
            </div>
          </div>
          {canCutRecurringCents > 0 ? (
            <div>
              <span className="text-xs font-medium text-positive-strong">Economia potencial (corte)</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <MoneyText cents={canCutRecurringCents} tone="positive" animated className="text-xl sm:text-2xl font-bold" />
                <span className="text-xs text-muted-foreground">/mês</span>
              </div>
              <p className="text-xs font-medium text-positive-strong mt-0.5">
                +<MoneyText cents={canCutAnnualCents} tone="positive" /> ao ano
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Lista de Recorrências Ativas */}
      <section aria-label="Lista de assinaturas e recorrências" className="flex flex-col gap-2">
        <InsightList
          items={activeOccurrences.map((o) => {
            const badges: { label: string; tone?: "default" | "positive" | "negative" | "warning" | "critical" | "muted" }[] = [];

            if (o.segment && o.segment !== "other") {
              badges.push({ label: SERVICE_SEGMENT_LABELS[o.segment], tone: "default" });
            }

            if (o.tier === "can_cut") {
              badges.push({ label: "Pode cortar", tone: "positive" });
            } else if (o.tier === "discretionary") {
              badges.push({ label: "Discricionário", tone: "default" });
            } else if (o.tier === "essential") {
              badges.push({ label: "Essencial", tone: "default" });
            }

            if (o.missingThisMonth) {
              badges.push({ label: "Pendente no mês", tone: "warning" });
            } else if (o.daysUntilNextDue !== undefined) {
              if (o.daysUntilNextDue === 0) {
                badges.push({ label: "Vence hoje", tone: "warning" });
              } else if (o.daysUntilNextDue > 0 && o.daysUntilNextDue <= 7) {
                badges.push({ label: `Em ${o.daysUntilNextDue}d`, tone: "warning" });
              } else if (o.typicalDayOfMonth) {
                badges.push({ label: `Dia ~${o.typicalDayOfMonth}`, tone: "muted" });
              }
            }

            if (o.priceAdjustment) {
              badges.push({ label: `+${o.priceAdjustment.percentIncrease}% reajuste`, tone: "warning" });
            }

            if (o.duplicateChargesThisMonth && o.duplicateChargesThisMonth > 1) {
              badges.push({ label: `${o.duplicateChargesThisMonth}x no mês`, tone: "warning" });
            }

            return {
              key: o.key,
              title: o.name,
              subtitle: `${RECURRENCE_LEVEL_LABELS[o.level]} · ${o.months.length} mês(es)`,
              confidence: o.confidence,
              amountCents: o.averageCents,
              badges,
              icon: <Repeat className="size-4" aria-hidden="true" />,
            };
          })}
          feedback={feedbackMap}
          onIgnore={(key) => onFeedback(key, "ignore")}
          onConfirm={(key) => onFeedback(key, "confirm")}
          onRestore={(key) => onFeedback(key, null)}
          emptyLabel="Nenhuma assinatura ou recorrência ativa detectada nos últimos meses."
        />
      </section>

      {/* Seção colapsável de Ocorrências Ignoradas */}
      {ignoredOccurrences.length > 0 ? (
        <section aria-label="Ocorrências ignoradas" className="flex flex-col gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowIgnored((prev) => !prev)}
            className="flex items-center justify-between gap-2 self-start text-xs text-muted-foreground hover:text-foreground"
            aria-expanded={showIgnored}
          >
            <span className="flex items-center gap-1.5 font-medium">
              <EyeOff className="size-3.5" aria-hidden="true" />
              Ocorrências ignoradas ({ignoredOccurrences.length})
            </span>
            {showIgnored ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
          </Button>

          {showIgnored ? (
            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border/80 p-3 bg-surface/40">
              <p className="text-xs text-muted-foreground">
                Ocorrências ignoradas são excluídas dos cálculos e relatórios. Clique no ícone de restaurar para devolvê-las à lista ativa.
              </p>
              <InsightList
                items={ignoredOccurrences.map((o) => ({
                  key: o.key,
                  title: o.name,
                  subtitle: `${RECURRENCE_LEVEL_LABELS[o.level]} · ${o.months.length} mês(es)`,
                  confidence: o.confidence,
                  amountCents: o.averageCents,
                  icon: <Repeat className="size-4" aria-hidden="true" />,
                }))}
                feedback={feedbackMap}
                onRestore={(key) => onFeedback(key, null)}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
