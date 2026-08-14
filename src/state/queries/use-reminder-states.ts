import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listReminderStates, setReminderState } from "@/data/repositories/reminder-states";
import type { ReminderState } from "@/domain/reminders";

export const reminderStatesKey = ["reminder-states"] as const;

/** Mapa occurrence_key → estado persistido (lido/snooze). */
export function useReminderStates() {
  return useQuery({
    queryKey: reminderStatesKey,
    queryFn: async (): Promise<ReminderState[]> => {
      const rows = await listReminderStates();
      return rows.map((row) => ({
        key: row.occurrence_key,
        kind: row.kind,
        snoozeUntil: row.snooze_until ?? undefined,
      }));
    },
    staleTime: 60_000,
  });
}

export function useSetReminderState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      occurrenceKey,
      state,
    }: {
      occurrenceKey: string;
      state: { kind: "read" | "snoozed"; snoozeUntil?: string } | null;
    }) => setReminderState(occurrenceKey, state),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reminderStatesKey });
    },
  });
}
