import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listFeedback, setFeedback } from "@/data/repositories/insight-feedback";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import type { FeedbackDecision } from "@/domain/insights/feedback";
import type { FeedbackEntry } from "@/domain/insights/learning-graph";
import { STATIC_GC_TIME, STALE_TIMES } from "@/state/cache-policy";

export const feedbackKey = ["insight-feedback"] as const;
export const feedbackEntriesKey = ["insight-feedback-entries"] as const;

/** Lista completa de decisões persistidas com timestamp (`created_at`) para escopo temporal (ex.: `one_off`). */
export function useFeedbackEntries() {
  return useQuery({
    queryKey: feedbackEntriesKey,
    queryFn: async (): Promise<FeedbackEntry[]> => {
      const rows = await listFeedback();
      return rows.map((row) => ({
        occurrenceKey: row.occurrence_key,
        decision: row.decision,
        createdAt: row.created_at ?? null,
      }));
    },
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });
}

/** Mapa occurrence_key → decisão persistida (aprendizado do usuário). */
export function useFeedback() {
  return useQuery({
    queryKey: feedbackKey,
    queryFn: async () => {
      const rows = await listFeedback();
      return Object.fromEntries(rows.map((row) => [row.occurrence_key, row.decision])) as Record<
        string,
        FeedbackDecision
      >;
    },
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });
}

/**
 * Mutation de persistência de feedback do usuário com atualização otimista (Fase 5 — Tarefa 5.3).
 *
 * Atualiza o cache imediatamente (onMutate) para recalcular os motores de insights e Visão Geral
 * sem latência, com rollback automático em caso de falha de rede e invalidação de agregados.
 */
export function useSetFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ occurrenceKey, decision }: { occurrenceKey: string; decision: FeedbackDecision | null }) =>
      setFeedback(occurrenceKey, decision),
    onMutate: async ({ occurrenceKey, decision }) => {
      await queryClient.cancelQueries({ queryKey: feedbackKey });
      await queryClient.cancelQueries({ queryKey: feedbackEntriesKey });
      const previous = queryClient.getQueryData<Record<string, FeedbackDecision>>(feedbackKey);
      const previousEntries = queryClient.getQueryData<FeedbackEntry[]>(feedbackEntriesKey);

      queryClient.setQueryData<Record<string, FeedbackDecision>>(feedbackKey, (old = {}) => {
        if (decision === null) {
          const next = { ...old };
          delete next[occurrenceKey];
          return next;
        }
        return { ...old, [occurrenceKey]: decision };
      });

      queryClient.setQueryData<FeedbackEntry[]>(feedbackEntriesKey, (old = []) => {
        const filtered = old.filter((entry) => entry.occurrenceKey !== occurrenceKey);
        if (decision === null) {
          return filtered;
        }
        return [
          ...filtered,
          {
            occurrenceKey,
            decision,
            createdAt: new Date().toISOString(),
          },
        ];
      });

      return { previous, previousEntries };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(feedbackKey, context.previous);
      }
      if (context?.previousEntries !== undefined) {
        queryClient.setQueryData(feedbackEntriesKey, context.previousEntries);
      }
      pushToast({
        title: "Não foi possível salvar a avaliação",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: feedbackKey });
      void queryClient.invalidateQueries({ queryKey: feedbackEntriesKey });
      void queryClient.invalidateQueries({ queryKey: ["insights"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}
