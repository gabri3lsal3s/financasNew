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

export const groupTargetsKey = (groupType: "class" | "sector") => ["group_targets", groupType] as const;

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
    onSuccess: async (_, variables) => {
      queryClient.setQueryData<import("@/types").GroupTarget[]>(
        groupTargetsKey(groupType),
        (old = []) => {
          const existing = old.find((it) =>
            groupType === "class"
              ? it.name === variables.name
              : it.name === variables.name && it.class_name === variables.className,
          );
          const filtered = old.filter((it) =>
            groupType === "class"
              ? it.name !== variables.name
              : !(it.name === variables.name && it.class_name === variables.className),
          );
          return [
            ...filtered,
            {
              id: existing?.id ?? `temp-${variables.name}`,
              user_id: existing?.user_id ?? "",
              group_type: groupType,
              name: variables.name,
              class_name: variables.className ?? null,
              target_percentage: variables.target,
            },
          ];
        },
      );
      await invalidatePortfolioSuite(queryClient);
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
    onSuccess: async (_, variables) => {
      queryClient.setQueryData<import("@/types").GroupTarget[]>(
        groupTargetsKey("class"),
        (old = []) => {
          const existingMap = new Map(old.map((it) => [it.name, it]));
          return variables.classes.map((c) => {
            const ex = existingMap.get(c.name);
            return {
              id: ex?.id ?? `temp-${c.name}`,
              user_id: ex?.user_id ?? "",
              group_type: "class" as const,
              name: c.name,
              class_name: null,
              target_percentage: c.target_percentage,
            };
          });
        },
      );

      queryClient.setQueryData<import("@/types").GroupTarget[]>(
        groupTargetsKey("sector"),
        (old = []) => {
          const existingMap = new Map(old.map((it) => [`${it.class_name ?? ""}::${it.name}`, it]));
          return variables.sectors.map((s) => {
            const key = `${s.class_name ?? ""}::${s.name}`;
            const ex = existingMap.get(key);
            return {
              id: ex?.id ?? `temp-${s.name}`,
              user_id: ex?.user_id ?? "",
              group_type: "sector" as const,
              class_name: s.class_name ?? null,
              name: s.name,
              target_percentage: s.target_percentage,
            };
          });
        },
      );

      await invalidatePortfolioSuite(queryClient);
    },
  });
}
