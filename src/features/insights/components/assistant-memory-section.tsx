import { useMemo, useState } from "react";
import { Brain, ChevronDown, ChevronUp, Clock, RotateCcw, Sparkles } from "lucide-react";
import { Button, ConfirmDialog } from "@/components/ui";
import {
  formatAdvisorThemeKey,
  formatCooldownExpiry,
  MEMORIZED_FEEDBACK_LABELS,
  type FeedbackMap,
  type QualifiedDismissReason,
} from "@/domain/insights";
import type { RecurrenceOccurrence } from "@/domain/insights/recurrences";
import { useSmartAdvisorDismissals } from "@/features/overview/hooks";
import { pushToast } from "@/services/toast";
import {
  CooldownMemoryRow,
  FeedbackMemoryRow,
  type CooldownMemoryItem,
  type FeedbackMemoryItem,
} from "./memory/AssistantMemoryRows";

export interface AssistantMemorySectionProps {
  feedbackMap: FeedbackMap;
  onRevokeFeedback: (occurrenceKey: string) => void;
  activeOccurrences?: RecurrenceOccurrence[];
  ignoredOccurrences?: RecurrenceOccurrence[];
  dismissals?: Record<string, number>;
  onRevokeDismissal?: (themeKey: string) => void;
}

const VALID_DECISIONS: (QualifiedDismissReason | "ignore" | "essential")[] = [
  "essential",
  "already_cancelled",
  "one_off",
  "not_subscription",
  "ignore",
];

export function AssistantMemorySection({
  feedbackMap,
  onRevokeFeedback,
  activeOccurrences = [],
  ignoredOccurrences = [],
  dismissals: controlledDismissals,
  onRevokeDismissal: controlledOnRevokeDismissal,
}: AssistantMemorySectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [now] = useState(() => Date.now());

  const hookDismissals = useSmartAdvisorDismissals();
  const effectiveDismissals = controlledDismissals ?? hookDismissals.dismissals;
  const revokeDismissalFn = controlledOnRevokeDismissal ?? hookDismissals.revokeDismissal;

  const activeCooldowns: CooldownMemoryItem[] = useMemo(() => {
    return Object.entries(effectiveDismissals)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > now)
      .map(([themeKey, expiry]) => {
        const { name, detail } = formatAdvisorThemeKey(themeKey);
        return {
          themeKey,
          expiry,
          name,
          detail,
          formattedDate: formatCooldownExpiry(expiry),
        };
      });
  }, [effectiveDismissals, now]);

  const activeFeedbackDecisions: FeedbackMemoryItem[] = useMemo(() => {
    return Object.entries(feedbackMap)
      .filter(
        (entry): entry is [string, QualifiedDismissReason | "ignore" | "essential"] =>
          Boolean(entry[1]) &&
          VALID_DECISIONS.includes(entry[1] as QualifiedDismissReason | "ignore" | "essential"),
      )
      .map(([key, decision]) => {
        const found =
          ignoredOccurrences.find((o) => o.key === key) ??
          activeOccurrences.find((o) => o.key === key);
        return {
          key,
          decision,
          name: found?.name ?? formatAdvisorThemeKey(key).name,
          label: MEMORIZED_FEEDBACK_LABELS[decision] ?? "Ignorado",
          amountCents: found?.averageCents,
        };
      });
  }, [feedbackMap, ignoredOccurrences, activeOccurrences]);

  const totalMemorizedCount = activeCooldowns.length + activeFeedbackDecisions.length;

  const handleReactivateDismissal = (themeKey: string, itemName: string) => {
    revokeDismissalFn(themeKey);
    pushToast({
      title: "Monitoramento reativado",
      description: `${itemName} voltou a ser analisado pelo assistente proativo.`,
      variant: "success",
    });
  };

  const handleReactivateFeedback = (key: string, itemName: string, decision?: string) => {
    onRevokeFeedback(key);
    pushToast({
      title: "Monitoramento reativado",
      description:
        decision === "essential"
          ? `${itemName} voltou a ser analisado pelo assistente para oportunidades de economia.`
          : `${itemName} foi reintroduzido no fluxo ativo de detecção.`,
      variant: "success",
    });
  };

  const handleClearAllMemory = () => {
    if (controlledOnRevokeDismissal) {
      for (const item of activeCooldowns) {
        controlledOnRevokeDismissal(item.themeKey);
      }
    } else {
      hookDismissals.resetAll();
    }
    for (const item of activeFeedbackDecisions) {
      onRevokeFeedback(item.key);
    }
    setConfirmResetOpen(false);
    pushToast({
      title: "Memória do assistente limpa",
      description: "Todos os itens voltaram ao fluxo ativo de análise.",
      variant: "success",
    });
  };

  return (
    <section aria-label="Memória de aprendizado do assistente" className="flex flex-col gap-2 pt-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        sensoryIntent="selection"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between gap-2 self-start max-sm:min-h-11 text-xs text-muted-foreground hover:text-foreground"
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

      {isOpen ? (
        <div className="flex flex-col gap-3.5 rounded-xl border border-dashed border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Decisões de micro-feedback e descartes temporários memorizados para calibrar suas recomendações.
              Reative o monitoramento a qualquer momento para reintroduzir a transação no fluxo ativo.
            </p>
            {totalMemorizedCount > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                sensoryIntent="selection"
                onClick={() => setConfirmResetOpen(true)}
                className="shrink-0 max-sm:min-h-11 self-start sm:self-center text-xs gap-1.5"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                <span>Reativar tudo</span>
              </Button>
            ) : null}
          </div>

          {totalMemorizedCount === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-muted-foreground">
                Nenhuma restrição ou descarte memorizado no momento. O assistente está operando com histórico completo.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 divide-y divide-border/50">
              {activeCooldowns.length > 0 ? (
                <div className="flex flex-col gap-2 pt-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" aria-hidden="true" />
                    Descartes Temporários sob Cooldown
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {activeCooldowns.map((item) => (
                      <CooldownMemoryRow
                        key={item.themeKey}
                        item={item}
                        onReactivate={handleReactivateDismissal}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {activeFeedbackDecisions.length > 0 ? (
                <div className="flex flex-col gap-2 pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Sparkles className="size-3" aria-hidden="true" />
                    Decisões de Micro-Feedback Registradas
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {activeFeedbackDecisions.map((item) => (
                      <FeedbackMemoryRow
                        key={item.key}
                        item={item}
                        onReactivate={handleReactivateFeedback}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmResetOpen}
        onOpenChange={setConfirmResetOpen}
        title="Reativar todo o monitoramento?"
        description="Todos os descartes em cooldown e decisões de micro-feedback serão removidos para que o assistente volte a analisar o histórico completo."
        confirmLabel="Reativar tudo"
        variant="default"
        onConfirm={handleClearAllMemory}
      />
    </section>
  );
}
