import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAllocationPreset,
  deleteAllocationPreset,
  listAllocationPresets,
  updateAllocationPreset,
} from "@/data/repositories/allocation-presets";
import { STATIC_GC_TIME, STALE_TIMES } from "@/state/cache-policy";
import type { PresetSnapshotInput } from "@/domain/portfolio/presets";

export const allocationPresetsKey = ["allocation_presets"] as const;

/** Busca todos os cenários salvos do usuário. */
export function useAllocationPresets() {
  return useQuery({
    queryKey: allocationPresetsKey,
    queryFn: () => listAllocationPresets(),
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });
}

/** Cria um novo cenário de alocação. */
export function useCreateAllocationPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PresetSnapshotInput) => createAllocationPreset(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: allocationPresetsKey });
    },
  });
}

/** Atualiza um cenário existente. */
export function useUpdateAllocationPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PresetSnapshotInput> }) =>
      updateAllocationPreset(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: allocationPresetsKey });
    },
  });
}

/** Exclui um cenário de alocação. */
export function useDeleteAllocationPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAllocationPreset(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: allocationPresetsKey });
    },
  });
}
