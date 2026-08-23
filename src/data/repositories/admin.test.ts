import { describe, expect, it, vi } from "vitest";
import { listAccessInvites, listAuditEvents, listSystemFeatures } from "./admin";

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
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
          return {
            limit: () =>
              Promise.resolve({
                data: [{ id: "log-1", action: "UPDATE_STATUS" }],
                error: null,
              }),
          };
        },
      }),
    }),
  }),
}));

describe("admin repository", () => {
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
});

