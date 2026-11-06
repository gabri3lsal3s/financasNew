import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getMyFamily,
  getFamilyConsolidation,
  createFamily,
  inviteFamilyMember,
  acceptFamilyInvite,
  leaveFamily,
  removeFamilyMember,
  recordFamilySettlement,
  updateFamily,
  updateFamilyMember,
  revokeFamilyInvite,
  getFamilyInviteByToken,
  listFamilySettlements,
} from "./families";
import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import * as rpcModule from "@/data/rpc";
import { AppError } from "@/services/errors";

vi.mock("@/data/client", () => ({
  getSupabase: vi.fn(),
}));

vi.mock("@/data/session", () => ({
  currentUserId: vi.fn(),
}));

vi.mock("@/data/rpc", () => ({
  getFamilyConsolidation: vi.fn(),
  createFamily: vi.fn(),
  inviteFamilyMember: vi.fn(),
  acceptFamilyInvite: vi.fn(),
  leaveFamily: vi.fn(),
  removeFamilyMember: vi.fn(),
  recordFamilySettlement: vi.fn(),
}));

describe("data/repositories/families", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMyFamily", () => {
    it("retorna null se não houver usuário autenticado", async () => {
      vi.mocked(currentUserId).mockRejectedValueOnce(new AppError("session-expired", "Sessão expirada"));

      const result = await getMyFamily();
      expect(result).toBeNull();
    });

    it("retorna null se o usuário não pertencer a nenhuma família", async () => {
      vi.mocked(currentUserId).mockResolvedValueOnce("user-1");

      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(getSupabase).mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof getSupabase>);

      const result = await getMyFamily();
      expect(result).toBeNull();
      expect(mockFrom).toHaveBeenCalledWith("family_members");
    });

    it("retorna dados da família, membros e convites para owner", async () => {
      vi.mocked(currentUserId).mockResolvedValueOnce("user-owner-1");

      const mockMemberRow = {
        id: "mem-1",
        family_id: "fam-1",
        user_id: "user-owner-1",
        role: "owner",
        display_name: "Gabriel",
        pix_key: "gabriel@test.com",
        pix_key_type: "email",
        split_ratio: 0.5,
        created_at: "2026-11-01T10:00:00Z",
        updated_at: "2026-11-01T10:00:00Z",
      };

      const mockFamilyRow = {
        id: "fam-1",
        name: "Família Sales",
        owner_id: "user-owner-1",
        monthly_budget: 15000,
        split_rule: "equal",
        created_at: "2026-11-01T10:00:00Z",
        updated_at: "2026-11-01T10:00:00Z",
      };

      const mockMembersList = [
        mockMemberRow,
        {
          id: "mem-2",
          family_id: "fam-1",
          user_id: "user-partner-2",
          role: "member",
          display_name: "Mariana",
          pix_key: "11999999999",
          pix_key_type: "phone",
          split_ratio: 0.5,
          created_at: "2026-11-02T10:00:00Z",
          updated_at: "2026-11-02T10:00:00Z",
        },
      ];

      const mockInvitesList = [
        {
          id: "inv-1",
          family_id: "fam-1",
          invited_by: "user-owner-1",
          invited_email: "mariana@test.com",
          token: "token123",
          status: "pending",
          role: "member",
          created_at: "2026-11-01T10:00:00Z",
          expires_at: "2026-11-08T10:00:00Z",
        },
      ];

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "family_members") {
          return {
            select: vi.fn().mockImplementation(() => ({
              eq: vi.fn().mockImplementation((col: string) => {
                if (col === "user_id") {
                  return {
                    maybeSingle: vi.fn().mockResolvedValue({ data: mockMemberRow, error: null }),
                  };
                }
                if (col === "family_id") {
                  return {
                    order: vi.fn().mockResolvedValue({ data: mockMembersList, error: null }),
                  };
                }
                return {};
              }),
            })),
          };
        }
        if (table === "families") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockFamilyRow, error: null }),
              }),
            }),
          };
        }
        if (table === "family_invites") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockInvitesList, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof getSupabase>);

      const result = await getMyFamily();
      expect(result).not.toBeNull();
      expect(result?.family.name).toBe("Família Sales");
      expect(result?.family.monthly_budget).toBe(1500000);
      expect(result?.members).toHaveLength(2);
      expect(result?.currentMember.role).toBe("owner");
      expect(result?.invites).toHaveLength(1);
    });

    it("não busca convites se o usuário for membro comum (role member)", async () => {
      vi.mocked(currentUserId).mockResolvedValueOnce("user-partner-2");

      const mockMemberRow = {
        id: "mem-2",
        family_id: "fam-1",
        user_id: "user-partner-2",
        role: "member",
        display_name: "Mariana",
        pix_key: null,
        pix_key_type: null,
        split_ratio: 0.5,
        created_at: "2026-11-02T10:00:00Z",
        updated_at: "2026-11-02T10:00:00Z",
      };

      const mockFamilyRow = {
        id: "fam-1",
        name: "Família Sales",
        owner_id: "user-owner-1",
        monthly_budget: null,
        split_rule: "equal",
        created_at: "2026-11-01T10:00:00Z",
        updated_at: "2026-11-01T10:00:00Z",
      };

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "family_members") {
          return {
            select: vi.fn().mockImplementation(() => ({
              eq: vi.fn().mockImplementation((col: string) => {
                if (col === "user_id") {
                  return {
                    maybeSingle: vi.fn().mockResolvedValue({ data: mockMemberRow, error: null }),
                  };
                }
                return {
                  order: vi.fn().mockResolvedValue({ data: [mockMemberRow], error: null }),
                };
              }),
            })),
          };
        }
        if (table === "families") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockFamilyRow, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof getSupabase>);

      const result = await getMyFamily();
      expect(result).not.toBeNull();
      expect(result?.currentMember.role).toBe("member");
      expect(result?.invites).toHaveLength(0);
      expect(mockFrom).not.toHaveBeenCalledWith("family_invites");
    });

    it("lança AppError quando ocorre falha de consulta no banco", async () => {
      vi.mocked(currentUserId).mockResolvedValueOnce("user-1");

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "42501", message: "permission denied" },
            }),
          }),
        }),
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof getSupabase>);

      await expect(getMyFamily()).rejects.toThrow(AppError);
    });
  });

  describe("RPC Delegations", () => {
    it("getFamilyConsolidation delega corretamente para getFamilyConsolidationRpc", async () => {
      const mockConsolidation = {
        family: { id: "fam-1", name: "Casa", owner_id: "u1", monthly_budget_cents: 100000, split_rule: "equal" as const },
        month: "2026-11",
        monthly_ceiling_cents: 100000,
        total_spent_cents: 45000,
        total_income_cents: 0,
        remaining_cents: 55000,
        spent_percentage: 45,
        members: [],
        expenses: [],
        is_settled: false,
        settlement: null,
        has_post_settlement_expenses: false,
      };

      vi.mocked(rpcModule.getFamilyConsolidation).mockResolvedValueOnce(mockConsolidation);

      const result = await getFamilyConsolidation({ month: "2026-11" });
      expect(result).toEqual(mockConsolidation);
      expect(rpcModule.getFamilyConsolidation).toHaveBeenCalledWith({ month: "2026-11" });
    });

    it("createFamily delega corretamente para createFamilyRpc", async () => {
      vi.mocked(rpcModule.createFamily).mockResolvedValueOnce("fam-new-id");

      const result = await createFamily({ name: "Nova Família" });
      expect(result).toBe("fam-new-id");
      expect(rpcModule.createFamily).toHaveBeenCalledWith({
        name: "Nova Família",
        monthlyBudget: null,
      });
    });

    it("inviteFamilyMember delega para inviteFamilyMemberRpc", async () => {
      const mockInviteResult = {
        id: "inv-1",
        family_id: "fam-1",
        token: "tok123",
        role: "member" as const,
        invited_email: "parceiro@exemplo.com",
        status: "pending" as const,
        expires_at: "2026-11-13T10:00:00Z",
        created_at: "2026-11-06T10:00:00Z",
      };

      vi.mocked(rpcModule.inviteFamilyMember).mockResolvedValueOnce(mockInviteResult);

      const result = await inviteFamilyMember({ invitedEmail: "parceiro@exemplo.com" });
      expect(result).toEqual(mockInviteResult);
      expect(rpcModule.inviteFamilyMember).toHaveBeenCalledWith(
        expect.objectContaining({
          invitedEmail: "parceiro@exemplo.com",
          token: expect.any(String),
        }),
      );
    });

    it("acceptFamilyInvite delega para acceptFamilyInviteRpc", async () => {
      const mockAccept = { success: true, family_id: "fam-1", role: "member" as const };
      vi.mocked(rpcModule.acceptFamilyInvite).mockResolvedValueOnce(mockAccept);

      const result = await acceptFamilyInvite({ token: "tok123" });
      expect(result).toEqual(mockAccept);
      expect(rpcModule.acceptFamilyInvite).toHaveBeenCalledWith({ token: "tok123" });
    });

    it("leaveFamily delega para leaveFamilyRpc", async () => {
      const mockLeave = { success: true, family_id: "fam-1", disbanded: false };
      vi.mocked(rpcModule.leaveFamily).mockResolvedValueOnce(mockLeave);

      const result = await leaveFamily({ familyId: "fam-1" });
      expect(result).toEqual(mockLeave);
      expect(rpcModule.leaveFamily).toHaveBeenCalledWith({ familyId: "fam-1" });
    });

    it("removeFamilyMember delega para removeFamilyMemberRpc", async () => {
      const mockResult = { success: true, family_id: "fam-1", removed_user_id: "u-2" };
      vi.mocked(rpcModule.removeFamilyMember).mockResolvedValueOnce(mockResult);

      const result = await removeFamilyMember("fam-1", "u-2");
      expect(result).toEqual(mockResult);
      expect(rpcModule.removeFamilyMember).toHaveBeenCalledWith({
        familyId: "fam-1",
        targetUserId: "u-2",
      });
    });

    it("recordFamilySettlement delega para recordFamilySettlementRpc", async () => {
      vi.mocked(rpcModule.recordFamilySettlement).mockResolvedValueOnce("settle-id-1");

      const input = {
        month: "2026-11",
        payerId: "user-1",
        receiverId: "user-2",
        amount: 350.5,
      };

      const result = await recordFamilySettlement(input);
      expect(result).toBe("settle-id-1");
      expect(rpcModule.recordFamilySettlement).toHaveBeenCalledWith(input);
    });
  });

  describe("Mutations & Management Repositories", () => {
    it("updateFamily atualiza dados cadastrais e retorna entidade mapeada", async () => {
      const updatedRow = {
        id: "fam-1",
        name: "Família Renovada",
        owner_id: "user-1",
        monthly_budget: 18000,
        split_rule: "proportional",
        created_at: "2026-11-01T10:00:00Z",
        updated_at: "2026-11-06T10:00:00Z",
      };

      const mockSingle = vi.fn().mockResolvedValue({ data: updatedRow, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(getSupabase).mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof getSupabase>);

      const result = await updateFamily("fam-1", {
        name: " Família Renovada ",
        monthly_budget: 1800000,
        split_rule: "proportional",
      });

      expect(result.name).toBe("Família Renovada");
      expect(result.monthly_budget).toBe(1800000);
      expect(result.split_rule).toBe("proportional");
      expect(mockUpdate).toHaveBeenCalledWith({
        name: "Família Renovada",
        monthly_budget: 18000,
        split_rule: "proportional",
      });
    });

    it("updateFamilyMember atualiza perfil do participante", async () => {
      const updatedMember = {
        id: "mem-1",
        family_id: "fam-1",
        user_id: "user-1",
        role: "owner",
        display_name: "Gabriel S.",
        pix_key: "gabriel@pix.me",
        pix_key_type: "email",
        split_ratio: 0.6,
        created_at: "2026-11-01T10:00:00Z",
        updated_at: "2026-11-06T10:00:00Z",
      };

      const mockSingle = vi.fn().mockResolvedValue({ data: updatedMember, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(getSupabase).mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof getSupabase>);

      const result = await updateFamilyMember("mem-1", {
        display_name: "Gabriel S.",
        pix_key: "gabriel@pix.me",
        pix_key_type: "email",
        split_ratio: 0.6,
      });

      expect(result.display_name).toBe("Gabriel S.");
      expect(result.pix_key).toBe("gabriel@pix.me");
      expect(result.split_ratio).toBe(0.6);
    });

    it("revokeFamilyInvite marca convite como revogado", async () => {
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

      vi.mocked(getSupabase).mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof getSupabase>);

      await revokeFamilyInvite("inv-123");

      expect(mockFrom).toHaveBeenCalledWith("family_invites");
      expect(mockUpdate).toHaveBeenCalledWith({ status: "revoked" });
      expect(mockEq).toHaveBeenCalledWith("id", "inv-123");
    });

    it("getFamilyInviteByToken retorna convite enriquecido com família e convidador", async () => {
      const mockInviteRow = {
        id: "inv-1",
        family_id: "fam-1",
        invited_by: "user-1",
        invited_email: "parceiro@exemplo.com",
        token: "token-convite-valido",
        status: "pending",
        role: "member",
        created_at: "2026-11-01T10:00:00Z",
        expires_at: "2026-11-08T10:00:00Z",
      };

      const mockFamilyRow = {
        id: "fam-1",
        name: "Família Santos",
        owner_id: "user-1",
      };

      const mockProfileRow = {
        name: "Lucas Santos",
      };

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "family_invites") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockInviteRow, error: null }),
              }),
            }),
          };
        }
        if (table === "families") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockFamilyRow, error: null }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockProfileRow, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof getSupabase>);

      const result = await getFamilyInviteByToken("token-convite-valido");
      expect(result).not.toBeNull();
      expect(result?.token).toBe("token-convite-valido");
      expect(result?.family_name).toBe("Família Santos");
      expect(result?.inviter_name).toBe("Lucas Santos");
    });

    it("getFamilyInviteByToken retorna null se token for vazio ou nulo", async () => {
      const result = await getFamilyInviteByToken("   ");
      expect(result).toBeNull();
    });

    it("listFamilySettlements lista acertos ordenados", async () => {
      const mockSettlements = [
        {
          id: "set-1",
          family_id: "fam-1",
          month: "2026-10",
          payer_id: "u1",
          receiver_id: "u2",
          amount: 420.0,
          settled_at: "2026-10-31T20:00:00Z",
          payment_method: "pix",
          notes: "Acerto de outubro",
          snapshot: {},
          created_at: "2026-10-31T20:00:00Z",
          created_by: "u1",
        },
      ];

      const mockLimit = vi.fn().mockResolvedValue({ data: mockSettlements, error: null });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      vi.mocked(getSupabase).mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof getSupabase>);

      const result = await listFamilySettlements("fam-1");
      expect(result).toHaveLength(1);
      expect(result[0]?.amount).toBe(420);
      expect(result[0]?.payment_method).toBe("pix");
      expect(mockFrom).toHaveBeenCalledWith("family_settlements");
    });
  });
});
