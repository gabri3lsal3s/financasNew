import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAllocationTargets,
  listGroupTargets,
  removeGroupTarget,
  saveAllocationTargets,
  saveGroupTarget,
  type AllocationTargetInput,
} from "@/data/repositories/allocation-targets";
import { getUserPreferences, updateSectorCaps, type SectorCaps } from "@/data/repositories/user-preferences";
import { STATIC_GC_TIME, STALE_TIMES } from "@/state/cache-policy";

export const allocationTargetsKey = ["allocation_targets"] as const;
const groupTargetsKey = (groupType: "class" | "sector") => ["group_targets", groupType] as const;
const sectorCapsKey = ["sector_caps"] as const;

/** Metas por ativo (soma ≤ 100% — validada na UI e no banco). */
export function useAllocationTargets() {
  return useQuery({
    queryKey: allocationTargetsKey,
    queryFn: () => listAllocationTargets(),
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });
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
  return useQuery({
    queryKey: groupTargetsKey(groupType),
    queryFn: () => listGroupTargets(groupType),
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });
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

/** Travas setoriais (max_sector_acoes / max_sector_fiis). */
export function useSectorCaps() {
  return useQuery({
    queryKey: sectorCapsKey,
    queryFn: async (): Promise<SectorCaps> => {
      const prefs = await getUserPreferences();
      return {
        maxSectorAcoes: prefs?.max_sector_acoes ?? null,
        maxSectorFiis: prefs?.max_sector_fiis ?? null,
      };
    },
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });
}

/** Atualiza as travas setoriais. */
export function useUpdateSectorCaps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (caps: SectorCaps) => updateSectorCaps(caps),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sectorCapsKey });
    },
  });
}
