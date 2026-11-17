import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listGroupTargets,
  removeGroupTarget,
  saveGroupTarget,
  saveHierarchyTargets,
} from "@/data/repositories/allocation-targets";
import type { SaveHierarchyTargetsParams } from "@/data/rpc";
import { STATIC_GC_TIME, STALE_TIMES } from "@/state/cache-policy";
import { useDemoSession } from "@/state/demo-mode";
import { invalidatePortfolioSuite } from "@/state/mutations/portfolio/portfolio-keys";
import { useSimulatedGroupTargets } from "./use-simulated-queries";

const groupTargetsKey = (groupType: "class" | "sector") => ["group_targets", groupType] as const;

/** Metas de grupo (classe ou setor escopado por classe). */
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
    mutationFn: ({
      name,
      target,
      className,
    }: {
      name: string;
      target: number;
      className?: string;
    }) => saveGroupTarget(groupType, name, target, className),
    onSuccess: () => {
      void invalidatePortfolioSuite(queryClient);
    },
  });
}

/** Remove meta de grupo. */
export function useRemoveGroupTarget(groupType: "class" | "sector") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: string | { name: string; className?: string }) =>
      typeof input === "string"
        ? removeGroupTarget(groupType, input)
        : removeGroupTarget(groupType, input.name, input.className),
    onSuccess: () => {
      void invalidatePortfolioSuite(queryClient);
    },
  });
}

/** Substitui atomicamente metas de Classes % e Setores % por Classe via RPC em lote. */
export function useSaveHierarchyTargets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: SaveHierarchyTargetsParams) => saveHierarchyTargets(params),
    onSuccess: () => {
      void invalidatePortfolioSuite(queryClient);
    },
  });
}
