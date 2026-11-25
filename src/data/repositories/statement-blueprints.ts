import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { callRpc, unwrapRpc } from "@/data/rpc/client";
import { AppError, classifyError } from "@/services/errors";
import type {
  StatementBlueprintOutcomeResult,
  StatementLayoutBlueprintFileKind,
  StatementLayoutBlueprintRow,
  StatementLayoutBlueprintRules,
} from "@/types";

export interface UpsertStatementBlueprintParams {
  fingerprint: string;
  issuerKey: string;
  issuerName: string;
  fileKind: StatementLayoutBlueprintFileKind;
  rulesJson: StatementLayoutBlueprintRules;
}

export interface RecordStatementBlueprintOutcomeParams {
  blueprintId: string;
  exactChecksumHit: boolean;
}

/**
 * Lista todos os blueprints acessíveis ao usuário autenticado via RLS
 * (`scope = 'global' AND status = 'active'` ou `scope = 'user' AND owner_user_id = auth.uid()`).
 */
export async function listAccessibleStatementBlueprints(): Promise<
  StatementLayoutBlueprintRow[]
> {
  const { data, error } = await resolveQuery<StatementLayoutBlueprintRow[]>(
    getSupabase()
      .from("statement_layout_blueprints")
      .select(
        "id, fingerprint, issuer_key, issuer_name, file_kind, scope, owner_user_id, status, rules_json, exact_checksum_hits, distinct_users_verified, distinct_users_failed, consecutive_failures, promoted_at, created_at, updated_at",
      )
      .order("updated_at", { ascending: false }),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data ?? [];
}

/**
 * Persiste ou atualiza um blueprint pessoal (`scope = 'user'`) após validação Zod + Shadow Replay,
 * delegando a validação anti-PII e regras SQL para o RPC `upsert_statement_layout_blueprint`.
 */
export async function upsertStatementLayoutBlueprint(
  params: UpsertStatementBlueprintParams,
): Promise<StatementLayoutBlueprintRow> {
  return unwrapRpc(
    callRpc("upsert_statement_layout_blueprint", {
      p_fingerprint: params.fingerprint,
      p_issuer_key: params.issuerKey,
      p_issuer_name: params.issuerName,
      p_file_kind: params.fileKind,
      p_rules_json: params.rulesJson,
    }),
  );
}

/**
 * Registra sucesso ou falha de um blueprint aplicado em campo via voto anônimo anti-Sybil,
 * disparando promoção automática (`global`) ou self-healing conforme a migration 0156.
 */
export async function recordStatementBlueprintOutcome(
  params: RecordStatementBlueprintOutcomeParams,
): Promise<StatementBlueprintOutcomeResult> {
  return unwrapRpc(
    callRpc("record_statement_blueprint_outcome", {
      p_blueprint_id: params.blueprintId,
      p_exact_checksum_hit: params.exactChecksumHit,
    }),
  );
}

/**
 * Lista todos os blueprints da fila global/pendente/suspensa para o Painel Admin (D16).
 */
export async function adminListStatementBlueprints(): Promise<
  StatementLayoutBlueprintRow[]
> {
  return unwrapRpc(callRpc("admin_list_statement_blueprints", {}));
}

/**
 * Aprova e promove um blueprint para `scope = 'global', status = 'active'` no Painel Admin.
 */
export async function adminApproveStatementBlueprint(
  blueprintId: string,
  rulesJson?: StatementLayoutBlueprintRules,
): Promise<StatementLayoutBlueprintRow> {
  return unwrapRpc(
    callRpc("admin_approve_statement_blueprint", {
      p_blueprint_id: blueprintId,
      ...(rulesJson !== undefined ? { p_rules_json: rulesJson } : {}),
    }),
  );
}

/**
 * Suspende um blueprint problemático no Painel Admin (registrado em `audit_events`).
 */
export async function adminSuspendStatementBlueprint(
  blueprintId: string,
): Promise<StatementLayoutBlueprintRow> {
  return unwrapRpc(
    callRpc("admin_suspend_statement_blueprint", {
      p_blueprint_id: blueprintId,
    }),
  );
}
