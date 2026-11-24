import { useMemo, useState } from "react";
import { Brain, Calendar, ChevronDown, ChevronUp, Clock, PauseCircle, RotateCcw, Sparkles, Store } from "lucide-react";
import { Badge, Button, ConfirmDialog } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import {
  formatAdvisorThemeKey,
  formatCooldownExpiry,
  INSIGHT_FAMILY_LABELS,
  MEMORIZED_FEEDBACK_LABELS,
  PAYDAY_PATTERN_LABELS,
  type FeedbackMap,
  type InsightThemeFamily,
  type PaydayProfile,
  type QualifiedDismissReason,
  type SmartDecayRecord,
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

export interface MerchantMemoryEntryLike {
  alias?: string;
  categoryName?: string;
  count?: number;
}

export interface AssistantMemorySectionProps {
  feedbackMap: FeedbackMap;
  onRevokeFeedback: (occurrenceKey: string) => void;
  activeOccurrences?: RecurrenceOccurrence[];
  ignoredOccurrences?: RecurrenceOccurrence[];
  dismissals?: Record<string, number>;
  onRevokeDismissal?: (themeKey: string) => void;
  paydayProfile?: PaydayProfile;
  decayByFamily?: Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>>;
  onUnmuteFamily?: (family: InsightThemeFamily) => void;
  merchantLearning?: Readonly<Record<string, MerchantMemoryEntryLike>> | null;
  onForgetMerchant?: (merchantKey: string) => void;
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
  paydayProfile,
  decayByFamily,
  onUnmuteFamily,
  merchantLearning,
  onForgetMerchant,
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

  const pausedFamilies = useMemo(() => {
    if (!decayByFamily) return [];
    return (Object.entries(decayByFamily) as [InsightThemeFamily, SmartDecayRecord | undefined][])
      .filter((entry): entry is [InsightThemeFamily, SmartDecayRecord] => {
        const rec = entry[1];
        return Boolean(rec && (rec.muted || rec.dismissedUntil > now));
      })
      .map(([family, rec]) => ({
        family,
        label: INSIGHT_FAMILY_LABELS[family] ?? family,
        muted: Boolean(rec.muted),
        dismissCount: rec.dismissCount,
        formattedDate: formatCooldownExpiry(rec.dismissedUntil),
      }));
  }, [decayByFamily, now]);

  const merchantEntries = useMemo(() => {
    if (!merchantLearning) return [];
    return Object.entries(merchantLearning).map(([key, val]) => ({
      key,
      label: val?.alias || key,
      categoryName: val?.categoryName,
      count: val?.count,
    }));
  }, [merchantLearning]);

  const totalMemorizedCount =
    activeCooldowns.length +
    activeFeedbackDecisions.length +
    pausedFamilies.length +
    merchantEntries.length;

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
          Memória do Copiloto ({totalMemorizedCount})
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

          {totalMemorizedCount === 0 && (!paydayProfile || paydayProfile.pattern === "unknown") ? (
            <div className="py-4 text-center">
              <p className="text-xs text-muted-foreground">
                Nenhuma restrição ou descarte memorizado no momento. O copiloto está operando com histórico completo.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 divide-y divide-border/50">
              {paydayProfile && paydayProfile.pattern !== "unknown" ? (
                <div className="flex flex-col gap-2 pt-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Calendar className="size-3" aria-hidden="true" />
                    Perfil de Renda Aprendido
                  </span>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-surface-raised/80 p-3 text-xs">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-foreground">
                          {PAYDAY_PATTERN_LABELS[paydayProfile.pattern].title}
                        </span>
                        <Badge variant="muted" size="xs">
                          Confiança {Math.round(paydayProfile.confidence * 100)}%
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {PAYDAY_PATTERN_LABELS[paydayProfile.pattern].description}
                        {paydayProfile.typicalIncomeDays.length > 0
                          ? ` Dias típicos: ${paydayProfile.typicalIncomeDays.join(", ")}.`
                          : ""}
                      </p>
                    </div>
                    {paydayProfile.expectedMonthlyIncomeCents > 0 ? (
                      <div className="flex flex-col sm:items-end shrink-0">
                        <span className="text-[10px] text-muted-foreground">Renda esperada</span>
                        <MoneyText
                          cents={paydayProfile.expectedMonthlyIncomeCents}
                          tone="positive"
                          className="text-xs font-semibold"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {(activeCooldowns.length > 0 || pausedFamilies.length > 0) ? (
                <div className="flex flex-col gap-2 pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" aria-hidden="true" />
                    Temas em Cooldown &amp; Famílias Pausadas
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {pausedFamilies.map((pf) => (
                      <div
                        key={pf.family}
                        className="flex items-center justify-between gap-2 rounded-lg bg-surface-raised/80 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <PauseCircle className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-foreground truncate">{pf.label}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {pf.muted
                                ? "Tema pausado pelo usuário"
                                : `Em cooldown até ${pf.formattedDate} (${pf.dismissCount}x dispensado)`}
                            </span>
                          </div>
                        </div>
                        {onUnmuteFamily ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            sensoryIntent="action"
                            onClick={() => onUnmuteFamily(pf.family)}
                            className="h-7 px-2 text-xs shrink-0"
                          >
                            Reativar
                          </Button>
                        ) : null}
                      </div>
                    ))}
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
                    Decisões de Aprendizado
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

              {merchantEntries.length > 0 ? (
                <div className="flex flex-col gap-2 pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Store className="size-3" aria-hidden="true" />
                    Estabelecimentos Aprendidos
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {merchantEntries.map((m) => (
                      <div
                        key={m.key}
                        className="flex items-center justify-between gap-2 rounded-lg bg-surface-raised/80 px-3 py-2 text-xs"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-foreground truncate">{m.label}</span>
                          {m.categoryName ? (
                            <span className="text-[11px] text-muted-foreground truncate">
                              Categoria associada: {m.categoryName}
                            </span>
                          ) : null}
                        </div>
                        {onForgetMerchant ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            sensoryIntent="action"
                            onClick={() => onForgetMerchant(m.key)}
                            className="h-7 px-2 text-xs shrink-0"
                          >
                            Esquecer
                          </Button>
                        ) : null}
                      </div>
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
