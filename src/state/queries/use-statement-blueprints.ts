import { useQuery } from "@tanstack/react-query";
import {
  adminListStatementBlueprints,
  listAccessibleStatementBlueprints,
} from "@/data/repositories/statement-blueprints";
import {
  fromCloudBlueprintRow,
  type StatementLayoutBlueprint,
} from "@/domain/reconciliation";
import type { StatementLayoutBlueprintRow } from "@/types";
import { useUserAccess } from "./use-user-access";

export const statementBlueprintsKey = ["statement_layout_blueprints"] as const;
export const adminStatementBlueprintsKey = ["admin_statement_blueprints"] as const;

export function statementBlueprintsUserQueryKey(userId: string | null) {
  return [...statementBlueprintsKey, userId] as const;
}

/**
 * Query cacheada (staleTime 10min) carregando blueprints acessíveis na nuvem
 * (`scope = 'user'` do próprio usuário + `scope = 'global' AND status = 'active'`).
 */
export function useStatementBlueprints(options?: { enabled?: boolean }) {
  const { profile } = useUserAccess();
  const enabled = Boolean(profile?.id) && (options?.enabled ?? true);

  return useQuery<StatementLayoutBlueprint[], Error>({
    queryKey: statementBlueprintsUserQueryKey(profile?.id ?? null),
    queryFn: async () => {
      const rows = await listAccessibleStatementBlueprints();
      return rows
        .map((row) => fromCloudBlueprintRow(row))
        .filter(
          (bp): bp is StatementLayoutBlueprint =>
            bp !== null && (!bp.cloudStatus || bp.cloudStatus === "active"),
        );
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Lista todos os blueprints (pending_review, active, suspended) para curadoria Admin (D16).
 */
export function useAdminStatementBlueprints(options?: { enabled?: boolean }) {
  const { profile } = useUserAccess();
  const enabled = Boolean(profile?.id) && (options?.enabled ?? true);

  return useQuery<StatementLayoutBlueprintRow[], Error>({
    queryKey: adminStatementBlueprintsKey,
    queryFn: adminListStatementBlueprints,
    enabled,
    staleTime: 30_000,
  });
}
