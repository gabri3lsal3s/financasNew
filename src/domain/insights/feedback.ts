/**
 * Aprendizado do usuário — ESPECIFICAÇÃO §3.7.4.
 *
 * O usuário pode ignorar / confirmar / restaurar cada ocorrência. A
 * ocorrência ignorada deixa de contar; confirmada é mantida (marcada).
 * O `occurrence_key` é a chave estável persistida em `insight_feedback`
 * (schema: user_id + occurrence_key + decision, unique por usuário).
 */

export type FeedbackDecision = "ignore" | "confirm";

export type FeedbackMap = Record<string, FeedbackDecision>;

/** Aplica o feedback: ignoradas saem da lista; confirmadas ganham flag. */
export function applyFeedback<T extends { key: string }>(
  occurrences: readonly T[],
  feedback: FeedbackMap,
): (T & { ignored: boolean; confirmed: boolean })[] {
  return occurrences
    .filter((occurrence) => feedback[occurrence.key] !== "ignore")
    .map((occurrence) => ({
      ...occurrence,
      ignored: false,
      confirmed: feedback[occurrence.key] === "confirm",
    }));
}
