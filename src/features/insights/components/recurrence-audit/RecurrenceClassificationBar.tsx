import { Ban, Check, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { RECURRENCE_CADENCE_LABELS, SERVICE_SEGMENT_LABELS } from "@/domain/insights";
import type { FeedbackDecision } from "@/domain/insights/feedback";
import type { RecurrenceOccurrence } from "@/domain/insights/recurrences";
import { RECURRENCE_LEVEL_LABELS } from "@/lib/labels";

export interface RecurrenceClassificationBarProps {
  occurrence: RecurrenceOccurrence;
  isEssential: boolean;
  currentFeedbackDecision?: FeedbackDecision | null;
  onApplyDecision: (decision: FeedbackDecision | null, successMsg: string) => void;
}

export function RecurrenceClassificationBar({
  occurrence,
  isEssential,
  currentFeedbackDecision,
  onApplyDecision,
}: RecurrenceClassificationBarProps) {
  const cadenceLabel = occurrence.cadence ? RECURRENCE_CADENCE_LABELS[occurrence.cadence] : undefined;
  const essentialActive = isEssential || currentFeedbackDecision === "essential";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="default" size="sm">
            {RECURRENCE_LEVEL_LABELS[occurrence.level]}
          </Badge>

          {cadenceLabel && occurrence.cadence !== "monthly" ? (
            <Badge variant="default" size="sm" className="font-semibold">
              {cadenceLabel}
            </Badge>
          ) : null}

          {occurrence.segment && occurrence.segment !== "other" ? (
            <Badge variant="default" size="sm">
              {SERVICE_SEGMENT_LABELS[occurrence.segment]}
            </Badge>
          ) : null}

          {isEssential || occurrence.tier === "essential" ? (
            <Badge variant="default" size="sm">
              Essencial
            </Badge>
          ) : occurrence.tier === "can_cut" ? (
            <Badge variant="positive" size="sm">
              Pode cortar
            </Badge>
          ) : occurrence.tier === "discretionary" ? (
            <Badge variant="default" size="sm">
              Discricionário
            </Badge>
          ) : null}

          {occurrence.lifecycle === "lapsed" ? (
            <Badge variant="muted" size="sm">
              Interrompida
            </Badge>
          ) : occurrence.missingThisMonth ? (
            <Badge variant="warning" size="sm">
              Pendente no ciclo
            </Badge>
          ) : occurrence.daysUntilNextDue !== undefined ? (
            occurrence.daysUntilNextDue === 0 ? (
              <Badge variant="warning" size="sm">
                Vence hoje
              </Badge>
            ) : occurrence.daysUntilNextDue > 0 && occurrence.daysUntilNextDue <= 7 ? (
              <Badge variant="warning" size="sm">
                Em {occurrence.daysUntilNextDue}d
              </Badge>
            ) : occurrence.typicalDayOfMonth ? (
              <Badge variant="muted" size="sm">
                Dia ~{occurrence.typicalDayOfMonth}
              </Badge>
            ) : null
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="text-xs font-semibold text-foreground">
            Classificação e Memória do Assistente
          </span>
          <span className="text-[11px] text-muted-foreground">
            Suas decisões calibram projeções e relatórios
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button
            type="button"
            variant={essentialActive ? "default" : "outline"}
            size="xs"
            sensoryIntent="selection"
            onClick={() =>
              onApplyDecision(
                essentialActive ? null : "essential",
                essentialActive
                  ? "Classificação de essencial removida."
                  : "Gasto fixado como essencial (sem sugestões de corte).",
              )
            }
            className="gap-1.5 h-8 text-xs justify-start"
            title="Mantém na lista de custos fixos essenciais e silencia sugestões de corte"
          >
            {essentialActive ? (
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{essentialActive ? "É Essencial" : "Essencial"}</span>
          </Button>

          <Button
            type="button"
            variant={currentFeedbackDecision === "already_cancelled" ? "default" : "outline"}
            size="xs"
            sensoryIntent="selection"
            onClick={() =>
              onApplyDecision(
                currentFeedbackDecision === "already_cancelled" ? null : "already_cancelled",
                currentFeedbackDecision === "already_cancelled"
                  ? "Item desmarcado de cancelado."
                  : "Marcado como cancelado (celebra economia anual e remove dos custos ativos).",
              )
            }
            className="gap-1.5 h-8 text-xs justify-start"
            title="Celebra a economia anual e remove dos custos fixos mensais"
          >
            {currentFeedbackDecision === "already_cancelled" ? (
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">Já Cancelei</span>
          </Button>

          <Button
            type="button"
            variant={currentFeedbackDecision === "one_off" ? "default" : "outline"}
            size="xs"
            sensoryIntent="selection"
            onClick={() =>
              onApplyDecision(
                currentFeedbackDecision === "one_off" ? null : "one_off",
                currentFeedbackDecision === "one_off"
                  ? "Marcação de pontual removida."
                  : "Marcado como gasto pontual (não tratado como compromisso fixo).",
              )
            }
            className="gap-1.5 h-8 text-xs justify-start"
            title="Silencia o gasto como despesa pontual sem penalizar o classificador"
          >
            {currentFeedbackDecision === "one_off" ? (
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Clock className="size-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">
              {currentFeedbackDecision === "one_off" ? "É Pontual" : "Gasto Pontual"}
            </span>
          </Button>

          <Button
            type="button"
            variant={currentFeedbackDecision === "not_subscription" ? "default" : "outline"}
            size="xs"
            sensoryIntent="selection"
            onClick={() =>
              onApplyDecision(
                currentFeedbackDecision === "not_subscription" ? null : "not_subscription",
                currentFeedbackDecision === "not_subscription"
                  ? "Marcação removida."
                  : "Classificado como despesa comum (não é assinatura contínua).",
              )
            }
            className="gap-1.5 h-8 text-xs justify-start"
            title="Informa que este estabelecimento não é uma assinatura contínua"
          >
            {currentFeedbackDecision === "not_subscription" ? (
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Ban className="size-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate sm:hidden">Não Assinar</span>
            <span className="truncate hidden sm:inline">Não é Assinatura</span>
          </Button>
        </div>
      </div>
    </>
  );
}
