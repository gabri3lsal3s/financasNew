import { useQuery } from "@tanstack/react-query";
import { getLatestCashCheckpoint, listCashCheckpoints } from "@/data/repositories/cash-checkpoints";
import { STALE_TIMES, STATIC_GC_TIME } from "@/state/cache-policy";
import { useDemoSession } from "@/state/demo-mode";
import { makeSimulatedQueryResult } from "./use-simulated-queries";
import type { CashCheckpoint, TransactionScope } from "@/types";

export const cashCheckpointsKey = ["cash_checkpoints"] as const;

/** Lista os checkpoints de saldo em caixa do usuário (opcionalmente por escopo). */
export function useCashCheckpoints(scope?: TransactionScope, options?: { enabled?: boolean }) {
  const { isDemoActive } = useDemoSession();
  const simulated = makeSimulatedQueryResult<CashCheckpoint[]>([]);
  const real = useQuery({
    queryKey: scope ? [...cashCheckpointsKey, scope] : cashCheckpointsKey,
    queryFn: () => listCashCheckpoints(scope),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.transactional,
    gcTime: STATIC_GC_TIME,
  });

  return isDemoActive ? simulated : real;
}

/** Obtém o último checkpoint de saldo cadastrado no escopo informado (default: 'personal'). */
export function useLatestCashCheckpoint(scope: TransactionScope = "personal", options?: { enabled?: boolean }) {
  const { isDemoActive } = useDemoSession();
  const simulated = makeSimulatedQueryResult<CashCheckpoint | null>(null);
  const real = useQuery({
    queryKey: [...cashCheckpointsKey, "latest", scope],
    queryFn: () => getLatestCashCheckpoint(scope),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.transactional,
    gcTime: STATIC_GC_TIME,
  });

  return isDemoActive ? simulated : real;
}
