import { useQuery } from "@tanstack/react-query";
import { getLatestCashCheckpoint, listCashCheckpoints } from "@/data/repositories/cash-checkpoints";
import { STALE_TIMES, STATIC_GC_TIME } from "@/state/cache-policy";
import { useDemoSession } from "@/state/demo-mode";
import { makeSimulatedQueryResult } from "./use-simulated-queries";
import type { CashCheckpoint } from "@/types";

export const cashCheckpointsKey = ["cash_checkpoints"] as const;

/** Lista todos os checkpoints de saldo em caixa do usuário. */
export function useCashCheckpoints() {
  const { isDemoActive } = useDemoSession();
  const simulated = makeSimulatedQueryResult<CashCheckpoint[]>([]);
  const real = useQuery({
    queryKey: cashCheckpointsKey,
    queryFn: listCashCheckpoints,
    enabled: !isDemoActive,
    staleTime: STALE_TIMES.transactional,
    gcTime: STATIC_GC_TIME,
  });

  return isDemoActive ? simulated : real;
}

/** Obtém o último checkpoint de saldo cadastrado. */
export function useLatestCashCheckpoint() {
  const { isDemoActive } = useDemoSession();
  const simulated = makeSimulatedQueryResult<CashCheckpoint | null>(null);
  const real = useQuery({
    queryKey: [...cashCheckpointsKey, "latest"],
    queryFn: getLatestCashCheckpoint,
    enabled: !isDemoActive,
    staleTime: STALE_TIMES.transactional,
    gcTime: STATIC_GC_TIME,
  });

  return isDemoActive ? simulated : real;
}
