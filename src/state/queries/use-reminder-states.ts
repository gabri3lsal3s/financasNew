import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listReminderStates, setReminderState, markAllRemindersAsRead } from "@/data/repositories/reminder-states";
import type { ReminderState } from "@/domain/reminders";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import { STATIC_GC_TIME, STALE_TIMES } from "@/state/cache-policy";

const reminderStatesKey = ["reminder-states"] as const;

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
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
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
    // Falha silenciosa em lido/snooze/restaurar deixava o lembrete sem
    // feedback — agora o erro aparece com retry implícito (novo clique).
    onError: (error) => {
      pushToast({
        title: "Não foi possível atualizar o lembrete",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

export function useMarkAllRemindersAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (occurrenceKeys: string[]) => markAllRemindersAsRead(occurrenceKeys),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reminderStatesKey });
      pushToast({
        title: "Lembretes atualizados",
        description: "Todos os lembretes visíveis foram marcados como lidos.",
        variant: "default",
      });
    },
    onError: (error) => {
      pushToast({
        title: "Não foi possível marcar os lembretes",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}
