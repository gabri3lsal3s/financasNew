import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminResetUserMFA,
  adminRevokeUserSessions,
  checkAdminPortalGrant,
  issueAdminStepUpChallenge,
  listAccessInvites,
  listAuditEvents,
  listSystemFeatures,
} from "./admin";

const rpcMock = vi.fn();
const invokeMock = vi.fn();

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
    from: (table: string) => ({
      select: () => ({
        order: () => {
          if (table === "system_features") {
            return Promise.resolve({
              data: [{ key: "investments", name: "Investimentos", is_globally_enabled: true }],
              error: null,
            });
          }
          if (table === "access_invites") {
            return Promise.resolve({
              data: [{ id: "inv-1", code: "GF-TEST", max_uses: 1, used_count: 0 }],
              error: null,
            });
          }
          const auditChain = {
            ilike: () => auditChain,
            eq: () => auditChain,
            gte: () => auditChain,
            lte: () => auditChain,
            range: () =>
              Promise.resolve({
                data: [{ id: "log-1", action: "UPDATE_STATUS" }],
                error: null,
              }),
          };
          return auditChain;
        },
      }),
    }),
  }),
}));

describe("admin repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve listar funcionalidades do sistema", async () => {
    const features = await listSystemFeatures();
    expect(features).toHaveLength(1);
    expect(features[0]?.key).toBe("investments");
  });

  it("deve listar convites de acesso", async () => {
    const invites = await listAccessInvites();
    expect(invites).toHaveLength(1);
    expect(invites[0]?.code).toBe("GF-TEST");
  });

  it("deve listar eventos de auditoria", async () => {
    const logs = await listAuditEvents(10);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("UPDATE_STATUS");
  });

  it("deve validar concessão do portal administrativo em modo fail-closed", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { granted: true, portal_scope: "admin_portal", expires_at: "2026-12-01T00:00:00Z" },
      error: null,
    });
    const granted = await checkAdminPortalGrant();
    expect(granted).toEqual({
      granted: true,
      portalScope: "admin_portal",
      expiresAt: "2026-12-01T00:00:00Z",
      reason: null,
    });

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied" },
    });
    const denied = await checkAdminPortalGrant();
    expect(denied).toEqual({
      granted: false,
      portalScope: null,
      expiresAt: null,
      reason: "rpc_error",
    });
  });

  it("deve emitir desafio step-up e repassar step_up_token nas ações sensíveis", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        challenge_id: "ch-1",
        step_up_token: "tok-abc",
        operation: "reset_mfa",
        target_ref: "user-123",
        expires_at: "2026-11-27T18:05:00Z",
      },
      error: null,
    });

    const challenge = await issueAdminStepUpChallenge("reset_mfa", "user-123");
    expect(challenge).toEqual({
      challengeId: "ch-1",
      stepUpToken: "tok-abc",
      operation: "reset_mfa",
      targetRef: "user-123",
      expiresAt: "2026-11-27T18:05:00Z",
    });

    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
    await expect(adminResetUserMFA("user-123", "tok-abc")).resolves.toBe(true);
    expect(invokeMock).toHaveBeenCalledWith("admin-super-action", {
      body: {
        action: "reset_mfa",
        target_user_id: "user-123",
        step_up_token: "tok-abc",
      },
    });

    await expect(adminRevokeUserSessions("user-123", "tok-xyz")).resolves.toBe(true);
    expect(invokeMock).toHaveBeenCalledWith("admin-super-action", {
      body: {
        action: "revoke_sessions",
        target_user_id: "user-123",
        step_up_token: "tok-xyz",
      },
    });
  });
});

