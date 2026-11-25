import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/services/errors";
import {
  adminApproveStatementBlueprint,
  adminListStatementBlueprints,
  adminSuspendStatementBlueprint,
  listAccessibleStatementBlueprints,
  recordStatementBlueprintOutcome,
  upsertStatementLayoutBlueprint,
} from "./statement-blueprints";

const mockOrder = vi.fn();
const mockSelect = vi.fn(() => ({ order: mockOrder }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockCallRpc = vi.fn();
const mockUnwrapRpc = vi.fn();

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    from: mockFrom,
  }),
}));

vi.mock("@/data/rpc/client", () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
  unwrapRpc: (...args: unknown[]) => mockUnwrapRpc(...args),
}));

const sampleRow = {
  id: "bp-1",
  fingerprint: "pdf:sicredi:a1b2c3d4",
  issuer_key: "sicredi",
  issuer_name: "Sicredi",
  file_kind: "pdf_text" as const,
  scope: "user" as const,
  owner_user_id: "user-1",
  status: "active" as const,
  rules_json: {
    startMarkers: ["lancamentos"],
    pauseMarkers: [],
    boletoMarkers: [],
    totalLabels: ["total da fatura"],
    ignoredTotalLabels: [],
    columnMode: "single" as const,
    strictStartZone: true,
    polarity: "positive_purchase" as const,
    dateFormatHint: "dmy" as const,
  },
  exact_checksum_hits: 1,
  distinct_users_verified: 1,
  distinct_users_failed: 0,
  consecutive_failures: 0,
  promoted_at: null,
  created_at: "2026-11-24T00:00:00.000Z",
  updated_at: "2026-11-24T00:00:00.000Z",
};

describe("statement-blueprints repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista blueprints acessíveis via RLS ordenados por updated_at DESC e classifica erros PostgREST", async () => {
    mockOrder.mockResolvedValueOnce({ data: [sampleRow], error: null });

    const rows = await listAccessibleStatementBlueprints();
    expect(rows).toEqual([sampleRow]);
    expect(mockFrom).toHaveBeenCalledWith("statement_layout_blueprints");

    mockOrder.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });

    await expect(listAccessibleStatementBlueprints()).rejects.toBeInstanceOf(AppError);
  });

  it("encaminha RPCs de aprendizado de usuário e telemetria anti-Sybil com parâmetros snake_case exatos", async () => {
    mockCallRpc.mockReturnValue("rpc-promise");
    mockUnwrapRpc.mockResolvedValueOnce(sampleRow);

    const saved = await upsertStatementLayoutBlueprint({
      fingerprint: sampleRow.fingerprint,
      issuerKey: sampleRow.issuer_key,
      issuerName: sampleRow.issuer_name,
      fileKind: "pdf_text",
      rulesJson: sampleRow.rules_json,
    });
    expect(saved.id).toBe("bp-1");
    expect(mockCallRpc).toHaveBeenCalledWith("upsert_statement_layout_blueprint", {
      p_fingerprint: sampleRow.fingerprint,
      p_issuer_key: sampleRow.issuer_key,
      p_issuer_name: sampleRow.issuer_name,
      p_file_kind: "pdf_text",
      p_rules_json: sampleRow.rules_json,
    });

    const outcomeRes = {
      success: true,
      blueprint_id: "bp-1",
      scope: "user",
      status: "active",
      distinct_users_verified: 1,
      trusted_users_verified: 1,
      trusted_users_failed: 0,
    };
    mockUnwrapRpc.mockResolvedValueOnce(outcomeRes);

    const out = await recordStatementBlueprintOutcome({
      blueprintId: "bp-1",
      exactChecksumHit: true,
    });
    expect(out).toEqual(outcomeRes);
    expect(mockCallRpc).toHaveBeenCalledWith("record_statement_blueprint_outcome", {
      p_blueprint_id: "bp-1",
      p_exact_checksum_hit: true,
    });
  });

  it("chama RPCs Admin de listagem, aprovação e suspensão com curadoria de D16", async () => {
    mockCallRpc.mockReturnValue("rpc-promise");
    mockUnwrapRpc.mockResolvedValueOnce([sampleRow]);
    expect(await adminListStatementBlueprints()).toEqual([sampleRow]);
    expect(mockCallRpc).toHaveBeenCalledWith("admin_list_statement_blueprints", {});

    mockUnwrapRpc.mockResolvedValueOnce({ ...sampleRow, scope: "global", status: "active" });
    await adminApproveStatementBlueprint("bp-1", sampleRow.rules_json);
    expect(mockCallRpc).toHaveBeenCalledWith("admin_approve_statement_blueprint", {
      p_blueprint_id: "bp-1",
      p_rules_json: sampleRow.rules_json,
    });

    mockUnwrapRpc.mockResolvedValueOnce({ ...sampleRow, status: "suspended" });
    await adminSuspendStatementBlueprint("bp-1");
    expect(mockCallRpc).toHaveBeenCalledWith("admin_suspend_statement_blueprint", {
      p_blueprint_id: "bp-1",
    });
  });
});
