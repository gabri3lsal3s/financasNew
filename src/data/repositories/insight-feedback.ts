import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import type { DbInsert, InsightFeedback } from "@/types";
import type { FeedbackDecision } from "@/domain/insights/feedback";

/**
 * Aprendizado de insights (§3.7.4) — persistência do feedback do usuário.
 * Tabela `insight_feedback` (unique por usuário + occurrence_key).
 */

export type FeedbackRow = Pick<InsightFeedback, "occurrence_key" | "decision">;

export async function listFeedback(): Promise<FeedbackRow[]> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<FeedbackRow[]>(
    getSupabase().from("insight_feedback").select("occurrence_key, decision").eq("user_id", user_id),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return data ?? [];
}

/**
 * Upsert do aprendizado: `ignore`/`confirm` gravados (ou removidos quando o
 * usuário restaura). Restaurar = apagar a linha (volta a contar).
 */
export async function setFeedback(occurrenceKey: string, decision: FeedbackDecision | null): Promise<void> {
  const user_id = await currentUserId();

  if (decision === null) {
    const { error } = await getSupabase()
      .from("insight_feedback")
      .delete()
      .eq("user_id", user_id)
      .eq("occurrence_key", occurrenceKey);
    if (error) {
      const classified = classifyError(error);
      throw new AppError(classified.kind, classified.message, error);
    }
    return;
  }

  const input: DbInsert<InsightFeedback> = { user_id, occurrence_key: occurrenceKey, decision };
  const { error } = await getSupabase().from("insight_feedback").upsert(input, {
    onConflict: "user_id,occurrence_key",
  });
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}
