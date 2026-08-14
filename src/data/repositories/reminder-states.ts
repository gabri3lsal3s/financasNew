import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import type { DbInsert, ReminderState, ReminderStateKind } from "@/types";

/**
 * Estado persistido dos lembretes (§3.10) — in-app.
 * Tabela `reminder_states` (unique por usuário + occurrence_key).
 */

export type ReminderStateRow = Pick<ReminderState, "occurrence_key" | "kind" | "snooze_until">;

export async function listReminderStates(): Promise<ReminderStateRow[]> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<ReminderStateRow[]>(
    getSupabase().from("reminder_states").select("occurrence_key, kind, snooze_until").eq("user_id", user_id),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return data ?? [];
}

/**
 * Grava o estado de um lembrete: `read`, `snoozed` (com data) ou `null`
 * (restaura — apaga a linha, o alerta volta a contar).
 */
export async function setReminderState(
  occurrenceKey: string,
  state: { kind: ReminderStateKind; snoozeUntil?: string } | null,
): Promise<void> {
  const user_id = await currentUserId();

  if (state === null) {
    const { error } = await getSupabase()
      .from("reminder_states")
      .delete()
      .eq("user_id", user_id)
      .eq("occurrence_key", occurrenceKey);
    if (error) {
      const classified = classifyError(error);
      throw new AppError(classified.kind, classified.message, error);
    }
    return;
  }

  const input: DbInsert<ReminderState> = {
    user_id,
    occurrence_key: occurrenceKey,
    kind: state.kind,
    snooze_until: state.snoozeUntil ?? null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await getSupabase().from("reminder_states").upsert(input, {
    onConflict: "user_id,occurrence_key",
  });
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}
