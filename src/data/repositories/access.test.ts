import { describe, expect, it, vi } from "vitest";
import { checkInviteEligibility } from "./access";

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "u-1" } },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        ilike: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: "inv-1",
                code: "GF-VALID-2026",
                max_uses: 10,
                used_count: 0,
                is_revoked: false,
              },
              error: null,
            }),
        }),
      }),
    }),
  }),
}));

describe("access repository", () => {
  it("deve validar código de convite existente e elegível", async () => {
    const res = await checkInviteEligibility("GF-VALID-2026");
    expect(res.valid).toBe(true);
  });

  it("deve retornar erro para código em branco", async () => {
    const res = await checkInviteEligibility("");
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("não informado");
  });
});
