import { useMemo, useState } from "react";
import { Brain, ChevronDown, ChevronUp, Clock, RotateCcw, Sparkles } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import {
  formatAdvisorThemeKey,
  formatCooldownExpiry,
  MEMORIZED_FEEDBACK_LABELS,
  type FeedbackMap,
  type QualifiedDismissReason,
} from "@/domain/insights";
import type { RecurrenceOccurrence } from "@/domain/insights/recurrences";
import { useSmartAdvisorDismissals } from "@/features/overview/hooks";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

export interface AssistantMemorySectionProps {
  feedbackMap: FeedbackMap;
  onRevokeFeedback: (occurrenceKey: string) => void;
  activeOccurrences?: RecurrenceOccurrence[];
  ignoredOccurrences?: RecurrenceOccurrence[];
  /** Opcional para testes ou modo controlado */
  dismissals?: Record<string, number>;
  onRevokeDismissal?: (themeKey: string) => void;
}

export function AssistantMemorySection({
  feedbackMap,
  onRevokeFeedback,
  activeOccurrences = [],
  ignoredOccurrences = [],
  dismissals: controlledDismissals,
  onRevokeDismissal: controlledOnRevokeDismissal,
}: AssistantMemorySectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hookDismissals = useSmartAdvisorDismissals();
  const effectiveDismissals = controlledDismissals ?? hookDismissals.dismissals;
  const revokeDismissalFn = controlledOnRevokeDismissal ?? hookDismissals.revokeDismissal;

  const [now] = useState(() => Date.now());

  // 1. Cooldowns temporários ativos
  const activeCooldowns = useMemo(() => {
    return Object.entries(effectiveDismissals)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > now)
      .map(([themeKey, expiry]) => {
        const { name, detail } = formatAdvisorThemeKey(themeKey);
        const formattedDate = formatCooldownExpiry(expiry);
        return {
          themeKey,
          expiry,
          name,
          detail,
          formattedDate,
        };
      });
  }, [effectiveDismissals, now]);

  // 2. Decisões de micro-feedback registradas
  const activeFeedbackDecisions = useMemo(() => {
    const validDecisions: (QualifiedDismissReason | "ignore")[] = [
      "already_cancelled",
      "one_off",
      "not_subscription",
      "ignore",
    ];

    return Object.entries(feedbackMap)
      .filter(
        (entry): entry is [string, QualifiedDismissReason | "ignore"] =>
          Boolean(entry[1]) && validDecisions.includes(entry[1] as QualifiedDismissReason | "ignore"),
      )
      .map(([key, decision]) => {
        const found =
          ignoredOccurrences.find((o) => o.key === key) ??
          activeOccurrences.find((o) => o.key === key);
        const name = found?.name ?? formatAdvisorThemeKey(key).name;
        const label = MEMORIZED_FEEDBACK_LABELS[decision] ?? "Ignorado";
        return {
          key,
          decision,
          name,
          label,
          amountCents: found?.averageCents,
        };
      });
  }, [feedbackMap, ignoredOccurrences, activeOccurrences]);

  const totalMemorizedCount = activeCooldowns.length + activeFeedbackDecisions.length;

  const handleReactivateDismissal = (themeKey: string, itemName: string) => {
    triggerSensory("action");
    revokeDismissalFn(themeKey);
    pushToast({
      title: "Monitoramento reativado",
      description: `${itemName} voltou a ser analisado pelo assistente proativo.`,
      variant: "success",
    });
  };

  const handleReactivateFeedback = (key: string, itemName: string) => {
    triggerSensory("action");
    onRevokeFeedback(key);
    pushToast({
      title: "Monitoramento reativado",
      description: `${itemName} foi reintroduzido no fluxo ativo de detecção.`,
      variant: "success",
    });
  };

  return (
    <section aria-label="Memória de aprendizado do assistente" className="flex flex-col gap-2 pt-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between gap-2 self-start text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-1.5 font-medium">
          <Brain className="size-3.5 text-muted-foreground" aria-hidden="true" />
          Memória de Aprendizado do Assistente ({totalMemorizedCount})
        </span>
        {isOpen ? (
          <ChevronUp className="size-3.5" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-3.5" aria-hidden="true" />
        )}
      </Button>

      {isOpen && (
        <div className="flex flex-col gap-3.5 rounded-xl border border-dashed border-border/80 bg-surface/40 p-3.5 sm:p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Decisões de micro-feedback e descartes temporários memorizados para calibrar suas recomendações.
            Reative o monitoramento a qualquer momento para reintroduzir a transação no fluxo ativo do assistente.
          </p>

          {totalMemorizedCount === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-muted-foreground">
                Nenhuma restrição ou descarte memorizado no momento. O assistente está operando com histórico completo.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 divide-y divide-border/40">
              {/* Seção 1: Descartes Temporários (Cooldowns de 30 dias) */}
              {activeCooldowns.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" aria-hidden="true" />
                    Descartes Temporários sob Cooldown
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {activeCooldowns.map((item) => (
                      <div
                        key={item.themeKey}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-border/60 bg-surface/80 hover:bg-surface transition-colors"
                      >
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
                            <Badge variant="muted" size="xs">
                              Cooldown
                            </Badge>
                            {item.detail && (
                              <span className="text-[11px] text-muted-foreground">({item.detail})</span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Descartado temporariamente até {item.formattedDate}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleReactivateDismissal(item.themeKey, item.name)}
                          className="h-7 text-xs font-medium self-start sm:self-auto shrink-0"
                          aria-label={`Reativar monitoramento de ${item.name}`}
                          title={`Reativar monitoramento de ${item.name}`}
                        >
                          <RotateCcw className="size-3 mr-1.5" aria-hidden="true" />
                          Reativar monitoramento
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Seção 2: Decisões de Micro-Feedback Registradas */}
              {activeFeedbackDecisions.length > 0 && (
                <div className="flex flex-col gap-2 pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Sparkles className="size-3" aria-hidden="true" />
                    Decisões de Micro-Feedback Registradas
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {activeFeedbackDecisions.map((item) => {
                      const badgeVariant =
                        item.decision === "already_cancelled"
                          ? "positive"
                          : item.decision === "one_off"
                            ? "warning"
                            : "muted";

                      return (
                        <div
                          key={item.key}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-border/60 bg-surface/80 hover:bg-surface transition-colors"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
                              <Badge variant={badgeVariant} size="xs">
                                {item.label}
                              </Badge>
                            </div>
                            {item.amountCents !== undefined && (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <span>Média estimada:</span>
                                <MoneyText cents={item.amountCents} className="font-medium text-foreground text-[11px]" />
                              </div>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleReactivateFeedback(item.key, item.name)}
                            className="h-7 text-xs font-medium self-start sm:self-auto shrink-0"
                            aria-label={`Reativar monitoramento de ${item.name}`}
                            title={`Reativar monitoramento de ${item.name}`}
                          >
                            <RotateCcw className="size-3 mr-1.5" aria-hidden="true" />
                            Reativar monitoramento
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
