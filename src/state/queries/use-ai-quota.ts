import { useQuery } from "@tanstack/react-query";
import {
  computeAiQuotaRemaining,
  fetchMyAiQuotaForMonth,
  type AiQuotaRemainingSummary,
} from "@/data/repositories/ai-quotas";
import { useUserAccess } from "./use-user-access";
import { getBrtQuotaPeriods } from "../../../supabase/functions/_shared/ai-schemas";

export const aiQuotaKey = ["user_ai_quotas"] as const;

export function aiQuotaMonthQueryKey(userId: string | null, periodMonth: string) {
  return [...aiQuotaKey, userId, periodMonth] as const;
}

export interface UseAiQuotaResult {
  summary: AiQuotaRemainingSummary;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
}

/**
 * Query leve para pré-checagem de saldo FinOps (`batch_calls` e `receipt_calls`)
 * usada antes de lotes Vision multi-página e para reservar o último crédito antes do `categorize_batch`.
 */
export function useAiQuota(options?: { enabled?: boolean }): UseAiQuotaResult {
  const { profile } = useUserAccess();
  const { periodMonth } = getBrtQuotaPeriods();
  const enabled = Boolean(profile?.id) && (options?.enabled ?? true);

  const query = useQuery({
    queryKey: aiQuotaMonthQueryKey(profile?.id ?? null, periodMonth),
    queryFn: () => fetchMyAiQuotaForMonth(periodMonth),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return {
    summary: computeAiQuotaRemaining(query.data ?? null),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
