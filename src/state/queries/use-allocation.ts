import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAllocationTargets,
  listGroupTargets,
  removeGroupTarget,
  saveAllocationTargets,
  saveGroupTarget,
  type AllocationTargetInput,
} from "@/data/repositories/allocation-targets";
import { STATIC_GC_TIME, STALE_TIMES } from "@/state/cache-policy";
import { useDemoSession } from "@/state/demo-mode";
import {
  useSimulatedAllocationTargets,
  useSimulatedGroupTargets,
} from "./use-simulated-queries";

export const allocationTargetsKey = ["allocation_targets"] as const;
const groupTargetsKey = (groupType: "class" | "sector") => ["group_targets", groupType] as const;

/** Metas por ativo (soma ≤ 100% — validada na UI e no banco). */
export function useAllocationTargets() {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedAllocationTargets();
  const real = useQuery({
    queryKey: allocationTargetsKey,
    queryFn: () => listAllocationTargets(),
    enabled: !isDemoActive,
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });

  return isDemoActive ? simulated : real;
}

/** Substitui o conjunto de metas por ativo em lote (RPC transacional). */
export function useSaveAllocationTargets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targets: AllocationTargetInput[]) => saveAllocationTargets(targets),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: allocationTargetsKey });
    },
  });
}

/** Metas de grupo (classe ou setor). */
export function useGroupTargets(groupType: "class" | "sector") {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedGroupTargets(groupType);
  const real = useQuery({
    queryKey: groupTargetsKey(groupType),
    queryFn: () => listGroupTargets(groupType),
    enabled: !isDemoActive,
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });

  return isDemoActive ? simulated : real;
}

/** Upsert de meta de grupo. */
export function useSaveGroupTarget(groupType: "class" | "sector") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, target }: { name: string; target: number }) => saveGroupTarget(groupType, name, target),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupTargetsKey(groupType) });
    },
  });
}

/** Remove meta de grupo. */
export function useRemoveGroupTarget(groupType: "class" | "sector") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => removeGroupTarget(groupType, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupTargetsKey(groupType) });
    },
  });
}
