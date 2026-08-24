import { useQuery } from "@tanstack/react-query";
import { getLatestCashCheckpoint, listCashCheckpoints } from "@/data/repositories/cash-checkpoints";
import { STALE_TIMES, STATIC_GC_TIME } from "@/state/cache-policy";

export const cashCheckpointsKey = ["cash_checkpoints"] as const;

/** Lista todos os checkpoints de saldo em caixa do usuário. */
export function useCashCheckpoints() {
  return useQuery({
    queryKey: cashCheckpointsKey,
    queryFn: listCashCheckpoints,
    staleTime: STALE_TIMES.transactional,
    gcTime: STATIC_GC_TIME,
  });
}

/** Obtém o último checkpoint de saldo cadastrado. */
export function useLatestCashCheckpoint() {
  return useQuery({
    queryKey: [...cashCheckpointsKey, "latest"],
    queryFn: getLatestCashCheckpoint,
    staleTime: STALE_TIMES.transactional,
    gcTime: STATIC_GC_TIME,
  });
}
