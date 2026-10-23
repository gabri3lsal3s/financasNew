/**
 * Aprendizado do usuário — ESPECIFICAÇÃO §3.7.4 & F23.
 *
 * O usuário pode confirmar uma ocorrência como gasto fixo, ou descartá-la
 * através de micro-feedbacks qualificados de 1 toque:
 *   - "already_cancelled": Já cancelei (celebra economia anual, remove dos fixos)
 *   - "one_off": É despesa pontual (silencia no ciclo corrente sem penalizar o motor)
 *   - "not_subscription": Não é assinatura (rebaixa a probabilidade no classificador)
 *   - "ignore": Descarte genérico legado
 *
 * O `occurrence_key` é a chave estável persistida em `insight_feedback`.
 */

export type QualifiedDismissReason = "already_cancelled" | "one_off" | "not_subscription";

export type FeedbackDecision = "ignore" | "confirm" | "essential" | QualifiedDismissReason;

export type FeedbackMap = Record<string, FeedbackDecision>;

export interface QualifiedDismissOption {
  reason: QualifiedDismissReason;
  label: string;
  description: string;
  badgeLabel: string;
}

export const QUALIFIED_DISMISS_OPTIONS: readonly QualifiedDismissOption[] = [
  {
    reason: "already_cancelled",
    label: "Já cancelei",
    description: "Celebra a economia anual e remove dos custos fixos ativos.",
    badgeLabel: "Cancelada",
  },
  {
    reason: "one_off",
    label: "É despesa pontual",
    description: "Silencia apenas no ciclo atual sem penalizar o classificador.",
    badgeLabel: "Pontual",
  },
  {
    reason: "not_subscription",
    label: "Não é assinatura",
    description: "Rebaixa de imediato a probabilidade de virar recorrência.",
    badgeLabel: "Não é assinatura",
  },
];

/**
 * Avalia se uma decisão de feedback representa descarte ou silenciamento da ocorrência.
 */
export function isOccurrenceIgnored(decision?: FeedbackDecision | null): boolean {
  if (!decision) return false;
  return (
    decision === "ignore" ||
    decision === "already_cancelled" ||
    decision === "one_off" ||
    decision === "not_subscription"
  );
}

/**
 * Avalia se uma decisão de feedback marca a ocorrência explicitamente como essencial.
 */
export function isOccurrenceEssential(decision?: FeedbackDecision | null): boolean {
  return decision === "essential";
}

/**
 * Retorna o motivo qualificado de descarte associado a uma decisão, se houver.
 */
export function getDismissReason(decision?: FeedbackDecision | null): QualifiedDismissReason | undefined {
  if (
    decision === "already_cancelled" ||
    decision === "one_off" ||
    decision === "not_subscription"
  ) {
    return decision;
  }
  return undefined;
}

export type FeedbackOccurrenceItem<T> = T & {
  ignored: boolean;
  confirmed: boolean;
  essential?: boolean;
  dismissReason?: QualifiedDismissReason;
};

/** Aplica o feedback: ocorrências descartadas saem da lista ativa; confirmadas ganham flag. */
export function applyFeedback<T extends { key: string }>(
  occurrences: readonly T[],
  feedback: FeedbackMap,
): FeedbackOccurrenceItem<T>[] {
  return occurrences
    .filter((occurrence) => !isOccurrenceIgnored(feedback[occurrence.key]))
    .map((occurrence) => ({
      ...occurrence,
      ignored: false,
      confirmed: feedback[occurrence.key] === "confirm",
      essential: feedback[occurrence.key] === "essential",
      dismissReason: getDismissReason(feedback[occurrence.key]),
    }));
}

/**
 * Particiona as ocorrências entre ativas (não ignoradas) e ignoradas/descartadas,
 * permitindo exibi-las separadamente na interface com o motivo do descarte.
 */
export function partitionFeedback<T extends { key: string }>(
  occurrences: readonly T[],
  feedback: FeedbackMap,
): {
  active: FeedbackOccurrenceItem<T>[];
  ignored: FeedbackOccurrenceItem<T>[];
} {
  const active: FeedbackOccurrenceItem<T>[] = [];
  const ignored: FeedbackOccurrenceItem<T>[] = [];

  for (const occurrence of occurrences) {
    const decision = feedback[occurrence.key];
    const isIgnored = isOccurrenceIgnored(decision);
    const isConfirmed = decision === "confirm";
    const isEssential = decision === "essential";
    const dismissReason = getDismissReason(decision);

    const item: FeedbackOccurrenceItem<T> = {
      ...occurrence,
      ignored: isIgnored,
      confirmed: isConfirmed,
      essential: isEssential,
      dismissReason,
    };

    if (isIgnored) {
      ignored.push(item);
    } else {
      active.push(item);
    }
  }

  return { active, ignored };
}
