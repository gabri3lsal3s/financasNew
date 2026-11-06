import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminDeleteUser,
  deleteCurrentUserAccount,
  deleteOwnAccount,
  getFamilyConsolidation,
  createFamily,
  inviteFamilyMember,
  acceptFamilyInvite,
  leaveFamily,
  recordFamilySettlement,
} from "./rpc";
import { AppError } from "@/services/errors";
import type { FamilyConsolidationResult } from "@/types";

const rpcMock = vi.fn();

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
  }),
}));

describe("RPC: Exclusão de Contas e Usuários", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deleteCurrentUserAccount", () => {
    it("deve executar a RPC delete_current_user_account com sucesso", async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null });

      await expect(deleteCurrentUserAccount()).resolves.toBeUndefined();
      expect(rpcMock).toHaveBeenCalledTimes(1);
      expect(rpcMock).toHaveBeenCalledWith("delete_current_user_account", {});
    });

    it("deve propagar AppError quando a RPC retornar erro", async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Acesso não autenticado.", code: "42501" },
      });

      await expect(deleteCurrentUserAccount()).rejects.toThrow(AppError);
      expect(rpcMock).toHaveBeenCalledWith("delete_current_user_account", {});
    });
  });

  describe("deleteOwnAccount (alias)", () => {
    it("deve delegar para delete_current_user_account com sucesso", async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null });

      await expect(deleteOwnAccount()).resolves.toBeUndefined();
      expect(rpcMock).toHaveBeenCalledTimes(1);
      expect(rpcMock).toHaveBeenCalledWith("delete_current_user_account", {});
    });
  });

  describe("adminDeleteUser", () => {
    it("deve executar a RPC admin_delete_user com target_user_id correto", async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null });

      await expect(adminDeleteUser({ targetUserId: "target-uuid-123" })).resolves.toBeUndefined();
      expect(rpcMock).toHaveBeenCalledTimes(1);
      expect(rpcMock).toHaveBeenCalledWith("admin_delete_user", {
        target_user_id: "target-uuid-123",
      });
    });

    it("deve propagar AppError quando a RPC falhar (ex: usuário tentando autoexclusão)", async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Superadmins não podem se autoexcluir por esta função.", code: "P0001" },
      });

      await expect(adminDeleteUser({ targetUserId: "same-uuid" })).rejects.toThrow(AppError);
      expect(rpcMock).toHaveBeenCalledWith("admin_delete_user", {
        target_user_id: "same-uuid",
      });
    });
  });

  describe("getFamilyConsolidation", () => {
    const mockConsolidation: FamilyConsolidationResult = {
      family: {
        id: "fam-1",
        name: "Família Silva",
        owner_id: "user-1",
        monthly_budget_cents: 500000,
        split_rule: "equal",
      },
      month: "2026-11",
      monthly_ceiling_cents: 500000,
      total_spent_cents: 250000,
      total_income_cents: 0,
      remaining_cents: 250000,
      spent_percentage: 50,
      members: [
        {
          user_id: "user-1",
          role: "owner",
          display_name: "Gabriel",
          pix_key: "gabriel@test.com",
          pix_key_type: "email",
          split_ratio: 0.5,
          spent_cents: 150000,
          percentage_of_total: 60,
        },
        {
          user_id: "user-2",
          role: "member",
          display_name: "Mariana",
          pix_key: "11999999999",
          pix_key_type: "phone",
          split_ratio: 0.5,
          spent_cents: 100000,
          percentage_of_total: 40,
        },
      ],
      expenses: [
        {
          id: "exp-1",
          description: "Supermercado",
          date: "2026-11-05",
          amount_cents: 150000,
          category_id: "cat-1",
          category_name: "Alimentação",
          category_icon: "shopping-cart",
          category_color: "#10b981",
          user_id: "user-1",
          payer_name: "Gabriel",
          is_own: true,
          created_at: "2026-11-05T14:00:00Z",
        },
      ],
      is_settled: false,
      settlement: null,
      has_post_settlement_expenses: false,
    };

    it("deve executar get_family_consolidation com parâmetros informados", async () => {
      rpcMock.mockResolvedValueOnce({ data: mockConsolidation, error: null });

      const result = await getFamilyConsolidation({
        familyId: "fam-1",
        month: "2026-11",
      });

      expect(result).toEqual(mockConsolidation);
      expect(rpcMock).toHaveBeenCalledTimes(1);
      expect(rpcMock).toHaveBeenCalledWith("get_family_consolidation", {
        p_family_id: "fam-1",
        p_month: "2026-11",
      });
    });

    it("deve normalizar undefined para null nos argumentos da RPC", async () => {
      rpcMock.mockResolvedValueOnce({ data: mockConsolidation, error: null });

      const result = await getFamilyConsolidation();

      expect(result).toEqual(mockConsolidation);
      expect(rpcMock).toHaveBeenCalledWith("get_family_consolidation", {
        p_family_id: null,
        p_month: null,
      });
    });

    it("deve permitir retorno nulo de forma limpa quando usuário não tem família", async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null });

      const result = await getFamilyConsolidation();

      expect(result).toBeNull();
      expect(rpcMock).toHaveBeenCalledWith("get_family_consolidation", {
        p_family_id: null,
        p_month: null,
      });
    });

    it("deve lançar AppError quando a RPC retornar erro (ex: acesso negado)", async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Acesso negado: usuário não pertence à família especificada.", code: "42501" },
      });

      await expect(
        getFamilyConsolidation({ familyId: "fam-alheia" }),
      ).rejects.toThrow(AppError);
    });
  });

  describe("createFamily", () => {
    it("deve chamar create_family com parâmetros mapeados e retornar o id gerado", async () => {
      rpcMock.mockResolvedValueOnce({ data: "fam-123", error: null });

      const result = await createFamily({
        name: "Família Santos",
        monthlyBudget: 6000,
        splitRule: "equal",
        displayName: "Gabriel",
        pixKey: "12345678900",
        pixKeyType: "cpf",
      });

      expect(result).toBe("fam-123");
      expect(rpcMock).toHaveBeenCalledWith("create_family", {
        p_name: "Família Santos",
        p_monthly_budget: 6000,
        p_split_rule: "equal",
        p_display_name: "Gabriel",
        p_pix_key: "12345678900",
        p_pix_key_type: "cpf",
      });
    });

    it("deve normalizar valores opcionais para null e default equal", async () => {
      rpcMock.mockResolvedValueOnce({ data: "fam-456", error: null });

      const result = await createFamily({
        name: "Família Simples",
      });

      expect(result).toBe("fam-456");
      expect(rpcMock).toHaveBeenCalledWith("create_family", {
        p_name: "Família Simples",
        p_monthly_budget: null,
        p_split_rule: "equal",
        p_display_name: null,
        p_pix_key: null,
        p_pix_key_type: null,
      });
    });

    it("deve lançar AppError em caso de falha (ex: usuário já pertence a uma família)", async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Usuário já pertence a uma família ativa.", code: "23505" },
      });

      await expect(
        createFamily({ name: "Segunda Família" }),
      ).rejects.toThrow(AppError);
    });
  });

  describe("inviteFamilyMember", () => {
    const mockInviteResult = {
      id: "inv-1",
      family_id: "fam-1",
      token: "tok-abc-123",
      role: "member" as const,
      invited_email: "mariana@test.com",
      status: "pending" as const,
      expires_at: "2026-11-13T10:00:00Z",
      created_at: "2026-11-06T10:00:00Z",
    };

    it("deve convidar membro com parâmetros completos", async () => {
      rpcMock.mockResolvedValueOnce({ data: mockInviteResult, error: null });

      const result = await inviteFamilyMember({
        familyId: "fam-1",
        invitedEmail: "mariana@test.com",
        role: "member",
        token: "custom-token",
      });

      expect(result).toEqual(mockInviteResult);
      expect(rpcMock).toHaveBeenCalledWith("invite_family_member", {
        p_family_id: "fam-1",
        p_invited_email: "mariana@test.com",
        p_role: "member",
        p_token: "custom-token",
      });
    });

    it("deve aplicar defaults para chamada sem parâmetros", async () => {
      rpcMock.mockResolvedValueOnce({ data: mockInviteResult, error: null });

      const result = await inviteFamilyMember();

      expect(result).toEqual(mockInviteResult);
      expect(rpcMock).toHaveBeenCalledWith("invite_family_member", {
        p_family_id: null,
        p_invited_email: null,
        p_role: "member",
        p_token: null,
      });
    });

    it("deve lançar AppError se usuário não for admin da família", async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Apenas administradores podem convidar membros para a família.", code: "42501" },
      });

      await expect(inviteFamilyMember()).rejects.toThrow(AppError);
    });
  });

  describe("acceptFamilyInvite", () => {
    it("deve aceitar convite com parâmetros informados", async () => {
      const mockResult = {
        success: true,
        family_id: "fam-1",
        role: "member" as const,
      };
      rpcMock.mockResolvedValueOnce({ data: mockResult, error: null });

      const result = await acceptFamilyInvite({
        token: "tok-xyz",
        displayName: "Parceiro",
        pixKey: "partner@test.com",
        pixKeyType: "email",
      });

      expect(result).toEqual(mockResult);
      expect(rpcMock).toHaveBeenCalledWith("accept_family_invite", {
        p_token: "tok-xyz",
        p_display_name: "Parceiro",
        p_pix_key: "partner@test.com",
        p_pix_key_type: "email",
      });
    });

    it("deve aceitar convite apenas com o token obrigatório", async () => {
      const mockResult = {
        success: true,
        family_id: "fam-1",
        role: "member" as const,
      };
      rpcMock.mockResolvedValueOnce({ data: mockResult, error: null });

      const result = await acceptFamilyInvite({
        token: "tok-xyz",
      });

      expect(result).toEqual(mockResult);
      expect(rpcMock).toHaveBeenCalledWith("accept_family_invite", {
        p_token: "tok-xyz",
        p_display_name: null,
        p_pix_key: null,
        p_pix_key_type: null,
      });
    });

    it("deve lançar AppError se o convite estiver expirado ou inválido", async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Este convite expirou.", code: "22023" },
      });

      await expect(acceptFamilyInvite({ token: "expired-token" })).rejects.toThrow(AppError);
    });
  });

  describe("leaveFamily", () => {
    it("deve solicitar saída com parâmetros de transferência e dissolução", async () => {
      const mockResult = {
        success: true,
        family_id: "fam-1",
        disbanded: false,
      };
      rpcMock.mockResolvedValueOnce({ data: mockResult, error: null });

      const result = await leaveFamily({
        familyId: "fam-1",
        transferToUserId: "user-2",
        disband: false,
      });

      expect(result).toEqual(mockResult);
      expect(rpcMock).toHaveBeenCalledWith("leave_family", {
        p_family_id: "fam-1",
        p_transfer_to_user_id: "user-2",
        p_disband: false,
      });
    });

    it("deve aplicar defaults ao sair da família atual", async () => {
      const mockResult = {
        success: true,
        family_id: "fam-1",
        disbanded: true,
      };
      rpcMock.mockResolvedValueOnce({ data: mockResult, error: null });

      const result = await leaveFamily();

      expect(result).toEqual(mockResult);
      expect(rpcMock).toHaveBeenCalledWith("leave_family", {
        p_family_id: null,
        p_transfer_to_user_id: null,
        p_disband: false,
      });
    });
  });

  describe("recordFamilySettlement", () => {
    it("deve registrar acerto de contas com sucesso", async () => {
      rpcMock.mockResolvedValueOnce({ data: "settlement-123", error: null });

      const result = await recordFamilySettlement({
        month: "2026-11",
        payerId: "user-1",
        receiverId: "user-2",
        amount: 250.75,
        familyId: "fam-1",
        paymentMethod: "pix",
        notes: "Acerto supermercado",
        snapshot: { ratio: 0.5 },
      });

      expect(result).toBe("settlement-123");
      expect(rpcMock).toHaveBeenCalledWith("record_family_settlement", {
        p_month: "2026-11",
        p_payer_id: "user-1",
        p_receiver_id: "user-2",
        p_amount: 250.75,
        p_family_id: "fam-1",
        p_payment_method: "pix",
        p_notes: "Acerto supermercado",
        p_snapshot: { ratio: 0.5 },
      });
    });

    it("deve normalizar valores opcionais para default pix e objeto vazio", async () => {
      rpcMock.mockResolvedValueOnce({ data: "settlement-456", error: null });

      const result = await recordFamilySettlement({
        month: "2026-11",
        payerId: "user-1",
        receiverId: "user-2",
        amount: 100,
      });

      expect(result).toBe("settlement-456");
      expect(rpcMock).toHaveBeenCalledWith("record_family_settlement", {
        p_month: "2026-11",
        p_payer_id: "user-1",
        p_receiver_id: "user-2",
        p_amount: 100,
        p_family_id: null,
        p_payment_method: "pix",
        p_notes: null,
        p_snapshot: {},
      });
    });

    it("deve lançar AppError se os membros forem iguais ou valor negativo", async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "Pagador e recebedor devem ser membros diferentes.", code: "22023" },
      });

      await expect(
        recordFamilySettlement({
          month: "2026-11",
          payerId: "user-1",
          receiverId: "user-1",
          amount: 100,
        }),
      ).rejects.toThrow(AppError);
    });
  });
});
