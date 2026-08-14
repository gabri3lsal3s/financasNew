import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listFeedback, setFeedback } from "@/data/repositories/insight-feedback";
import type { FeedbackDecision } from "@/domain/insights/feedback";

export const feedbackKey = ["insight-feedback"] as const;

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
    staleTime: 60_000,
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
  });
}
