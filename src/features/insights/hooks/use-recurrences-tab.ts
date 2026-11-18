import { useCallback, useMemo, useState } from "react";
import {
  calculateAllCardsSubscriptionImpact,
  calculateFixedCommitmentRate,
  filterRecurrencesByTab,
  getDismissReason,
  type CalibrationDecision,
  type FeedbackDecision,
  type FeedbackMap,
  type RecurrenceFilterTab,
  type RecurrenceOccurrence,
} from "@/domain/insights";
import { RECURRENCE_LEVEL_LABELS } from "@/lib/labels";
import { formatCentsAsBRL } from "@/services/masks/money";
import { pushToast } from "@/services/toast";
import { useCreditCards } from "@/state";
import type { CreditCard } from "@/types";

export function useRecurrencesTab({
  totalRecurringCents,
  activeOccurrences,
  ignoredOccurrences,
  lapsedOccurrences,
  feedbackMap,
  onFeedback,
  cardsProp,
  initialSelectedKey,
  monthlyIncomeCents,
}: {
  totalRecurringCents: number;
  activeOccurrences: RecurrenceOccurrence[];
  ignoredOccurrences: RecurrenceOccurrence[];
  lapsedOccurrences: RecurrenceOccurrence[];
  feedbackMap: FeedbackMap;
  onFeedback: (occurrenceKey: string, decision: FeedbackDecision | null) => void;
  cardsProp?: CreditCard[];
  initialSelectedKey?: string;
  monthlyIncomeCents?: number;
}) {
  const cardsQuery = useCreditCards();
  const [selectedOccurrenceKey, setSelectedOccurrenceKey] = useState<string | null>(
    () => initialSelectedKey ?? null,
  );
  const [convertingOccurrence, setConvertingOccurrence] = useState<RecurrenceOccurrence | null>(null);
  const [filterTab, setFilterTab] = useState<RecurrenceFilterTab>("all");
  const [showLapsed, setShowLapsed] = useState(false);

  const cardImpacts = useMemo(() => {
    const cards = cardsProp ?? cardsQuery.data ?? [];
    if (cards.length === 0 || activeOccurrences.length === 0) return [];
    return calculateAllCardsSubscriptionImpact(cards, activeOccurrences).filter(
      (impact) => impact.totalProjectedCents > 0,
    );
  }, [cardsProp, cardsQuery.data, activeOccurrences]);

  const cancelledAnnualSavingsCents = useMemo(
    () =>
      ignoredOccurrences
        .filter((o) => feedbackMap[o.key] === "already_cancelled")
        .reduce((sum, o) => sum + o.averageCents * 12, 0),
    [ignoredOccurrences, feedbackMap],
  );

  const fixedCommitmentRate = useMemo(
    () => calculateFixedCommitmentRate(totalRecurringCents, monthlyIncomeCents),
    [totalRecurringCents, monthlyIncomeCents],
  );

  const tabCounts = useMemo(
    () => ({
      all: activeOccurrences.length,
      subscriptions: activeOccurrences.filter(
        (o) => filterRecurrencesByTab([o], "subscriptions").length > 0,
      ).length,
      fixed_bills: activeOccurrences.filter(
        (o) => filterRecurrencesByTab([o], "fixed_bills").length > 0,
      ).length,
      with_alerts: activeOccurrences.filter(
        (o) => filterRecurrencesByTab([o], "with_alerts").length > 0,
      ).length,
    }),
    [activeOccurrences],
  );

  const handleIgnoreWithReason = useCallback(
    (key: string, reason: CalibrationDecision) => {
      onFeedback(key, reason);
      if (reason === "essential") {
        pushToast({
          title: "Gasto classificado como essencial",
          description: "Mantido no monitoramento de custos fixos, com sugestões de corte silenciadas.",
          variant: "info",
        });
      } else if (reason === "already_cancelled") {
        const occ = activeOccurrences.find((o) => o.key === key);
        const annualSavings = (occ?.averageCents ?? 0) * 12;
        pushToast({
          title: "Assinatura cancelada celebrada",
          description:
            annualSavings > 0
              ? `Economia projetada de ${formatCentsAsBRL(annualSavings)}/ano conquistada com sucesso.`
              : "Assinatura removida dos custos fixos ativos.",
          variant: "success",
        });
      } else if (reason === "not_subscription") {
        pushToast({
          title: "Despesa reclassificada",
          description: "Probabilidade de recorrência deste fornecedor rebaixada no motor.",
          variant: "info",
        });
      } else {
        pushToast({
          title: "Despesa pontual silenciada",
          description: "Item silenciado apenas para este ciclo.",
          variant: "default",
        });
      }
    },
    [activeOccurrences, onFeedback],
  );

  const selectedOccurrence = useMemo(() => {
    if (!selectedOccurrenceKey) return null;
    return (
      activeOccurrences.find((o) => o.key === selectedOccurrenceKey) ??
      ignoredOccurrences.find((o) => o.key === selectedOccurrenceKey) ??
      lapsedOccurrences.find((o) => o.key === selectedOccurrenceKey) ??
      null
    );
  }, [activeOccurrences, ignoredOccurrences, lapsedOccurrences, selectedOccurrenceKey]);

  const handleStartConversion = useCallback(
    (keyOrOccurrence: string | RecurrenceOccurrence) => {
      const occ =
        typeof keyOrOccurrence === "string"
          ? (activeOccurrences.find((o) => o.key === keyOrOccurrence) ??
             ignoredOccurrences.find((o) => o.key === keyOrOccurrence) ??
             null)
          : keyOrOccurrence;
      if (occ) {
        setSelectedOccurrenceKey(null);
        setConvertingOccurrence(occ);
      }
    },
    [activeOccurrences, ignoredOccurrences],
  );

  const ignoredItems = useMemo(
    () =>
      ignoredOccurrences.map((o) => ({
        key: o.key,
        title: o.name,
        subtitle: `${RECURRENCE_LEVEL_LABELS[o.level]} · ${o.months.length} mês(es)`,
        confidence: o.confidence,
        amountCents: o.averageCents,
        dismissReason: getDismissReason(feedbackMap[o.key]),
      })),
    [ignoredOccurrences, feedbackMap],
  );

  return {
    filterTab,
    setFilterTab,
    showLapsed,
    setShowLapsed,
    cardImpacts,
    cancelledAnnualSavingsCents,
    fixedCommitmentRate,
    tabCounts,
    selectedOccurrence,
    setSelectedOccurrenceKey,
    convertingOccurrence,
    setConvertingOccurrence,
    handleIgnoreWithReason,
    handleStartConversion,
    ignoredItems,
  };
}
