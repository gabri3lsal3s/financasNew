import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listFeedback, setFeedback } from "@/data/repositories/insight-feedback";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import type { FeedbackDecision } from "@/domain/insights/feedback";
import { STATIC_GC_TIME, STALE_TIMES } from "@/state/cache-policy";

const feedbackKey = ["insight-feedback"] as const;

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

export function useSetFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ occurrenceKey, decision }: { occurrenceKey: string; decision: FeedbackDecision | null }) =>
      setFeedback(occurrenceKey, decision),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: feedbackKey });
    },
    // Falha não pode ser silenciosa (padrão das demais mutações): o toast
    // avisa e a decisão pode ser tentada de novo.
    onError: (error) => {
      pushToast({
        title: "Não foi possível salvar a avaliação",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}
