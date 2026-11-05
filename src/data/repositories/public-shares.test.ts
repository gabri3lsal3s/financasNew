import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createPublicShare,
  getPublicShareByToken,
  getSharedFamilyBudgetByToken,
  listMyPublicShares,
  regeneratePublicShare,
  revokePublicShare,
  saveSplitExpenseToAccount,
  saveSimulationToAccount,
} from "./public-shares";
import { getSupabase } from "@/data/client";
import * as rpcModule from "@/data/rpc";
import * as categoriesRepo from "./categories";
import * as debtsRepo from "./debts";
import * as allocationRepo from "./allocation-targets";
import * as incomeGoalsRepo from "./income-goals";

vi.mock("@/data/client", () => ({
  getSupabase: vi.fn(),
}));

vi.mock("@/data/rpc", () => ({
  createExpenseWithDebt: vi.fn(),
  getSharedFamilyBudget: vi.fn(),
}));

vi.mock("./categories", () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
}));

vi.mock("./debts", () => ({
  createDebt: vi.fn(),
}));

vi.mock("./allocation-targets", () => ({
  saveGroupTarget: vi.fn(),
}));

vi.mock("./income-goals", () => ({
  setGoal: vi.fn(),
}));

vi.mock("@/data/session", () => ({
  currentUserId: vi.fn().mockResolvedValue("user-test-uuid"),
}));

describe("data/repositories/public-shares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createPublicShare insere e retorna um novo compartilhamento público", async () => {
    const mockRow = {
      id: "share-uuid-1",
      user_id: "user-test-uuid",
      kind: "split",
      token: "testtoken10",
      payload: { title: "Pizza", total_cents: 6000 },
      created_at: "2026-11-05T12:00:00Z",
      expires_at: "2026-12-05T12:00:00Z",
      is_revoked: false,
      updated_at: "2026-11-05T12:00:00Z",
    };

    const mockSingle = vi.fn().mockResolvedValue({ data: mockRow, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getSupabase>);

    const result = await createPublicShare({
      kind: "split",
      token: "testtoken10",
      payload: { title: "Pizza", total_cents: 6000 },
    });

    expect(result.id).toBe("share-uuid-1");
    expect(result.kind).toBe("split");
    expect(result.token).toBe("testtoken10");
    expect(result.is_revoked).toBe(false);
    expect(mockFrom).toHaveBeenCalledWith("public_shares");
  });

  it("getPublicShareByToken retorna compartilhamento válido por token", async () => {
    const mockRow = {
      id: "share-uuid-2",
      user_id: "user-test-uuid",
      kind: "split",
      token: "validtoken1",
      payload: { title: "Churrasco", total_cents: 12000 },
      created_at: "2026-11-05T12:00:00Z",
      expires_at: new Date(Date.now() + 1000000).toISOString(),
      is_revoked: false,
      updated_at: "2026-11-05T12:00:00Z",
    };

    const mockLimit = vi.fn().mockResolvedValue({ data: [mockRow], error: null });
    const mockEq2 = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getSupabase>);

    const result = await getPublicShareByToken("validtoken1");
    expect(result).not.toBeNull();
    expect(result?.token).toBe("validtoken1");
    expect(result?.kind).toBe("split");
  });

  it("getPublicShareByToken retorna null se expirado", async () => {
    const mockExpiredRow = {
      id: "share-uuid-3",
      user_id: "user-test-uuid",
      kind: "split",
      token: "expiredtoken",
      payload: { title: "Passado", total_cents: 5000 },
      created_at: "2026-01-01T12:00:00Z",
      expires_at: "2026-01-02T12:00:00Z", // Data já expirada
      is_revoked: false,
      updated_at: "2026-01-01T12:00:00Z",
    };

    const mockLimit = vi.fn().mockResolvedValue({ data: [mockExpiredRow], error: null });
    const mockEq2 = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getSupabase>);

    const result = await getPublicShareByToken("expiredtoken");
    expect(result).toBeNull();
  });

  it("revokePublicShare atualiza is_revoked para true", async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getSupabase>);

    await revokePublicShare("share-uuid-to-revoke");
    expect(mockFrom).toHaveBeenCalledWith("public_shares");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_revoked: true }),
    );
    expect(mockEq).toHaveBeenCalledWith("id", "share-uuid-to-revoke");
  });

  it("listMyPublicShares retorna lista de compartilhamentos do usuário", async () => {
    const mockRows = [
      {
        id: "share-1",
        user_id: "user-test-uuid",
        kind: "split",
        token: "tok1",
        payload: {},
        created_at: "2026-11-05T10:00:00Z",
        expires_at: null,
        is_revoked: false,
        updated_at: "2026-11-05T10:00:00Z",
      },
    ];

    const mockOrder = vi.fn().mockResolvedValue({ data: mockRows, error: null });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getSupabase>);

    const result = await listMyPublicShares();
    expect(result).toHaveLength(1);
    expect(result[0]?.token).toBe("tok1");
  });

  describe("saveSplitExpenseToAccount", () => {
    it("salva despesa com categoria preferencial encontrada", async () => {
      vi.mocked(categoriesRepo.listCategories).mockResolvedValueOnce([
        { id: "cat-alim", name: "Alimentação", type: "expense", icon: "alim", color: "#123", is_reserved: false, is_active: true, user_id: "user-1" },
      ]);
      vi.mocked(rpcModule.createExpenseWithDebt).mockResolvedValueOnce("new-expense-id-123");

      const result = await saveSplitExpenseToAccount({
        title: "Pizza com amigos",
        amountCents: 4500,
        date: "2026-11-05",
      });

      expect(result).toBe("new-expense-id-123");
      expect(rpcModule.createExpenseWithDebt).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 45,
          date: "2026-11-05",
          categoryId: "cat-alim",
          paymentMethod: "pix",
          description: "Pizza com amigos",
          reportWeight: 1,
          installments: [
            {
              date: "2026-11-05",
              value: 45,
              billCompetence: null,
            },
          ],
        }),
      );
    });

    it("cria categoria padrão se o usuário não possuir categorias", async () => {
      vi.mocked(categoriesRepo.listCategories).mockResolvedValueOnce([]);
      vi.mocked(categoriesRepo.createCategory).mockResolvedValueOnce({
        id: "cat-created-auto",
        name: "Alimentação",
        type: "expense",
        icon: "alimentacao",
        color: "#DDA726",
        is_reserved: false,
        is_active: true,
        user_id: "user-1",
      });
      vi.mocked(rpcModule.createExpenseWithDebt).mockResolvedValueOnce("expense-auto-cat");

      const result = await saveSplitExpenseToAccount({
        title: "Racha Hamburgueria",
        amountCents: 3000,
      });

      expect(categoriesRepo.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "expense",
          name: "Alimentação",
        }),
      );
      expect(result).toBe("expense-auto-cat");
    });
  });

  describe("getSharedFamilyBudgetByToken & regeneratePublicShare", () => {
    it("getSharedFamilyBudgetByToken delega para o RPC getSharedFamilyBudget", async () => {
      const mockResult = {
        token: "fam-tok-1",
        month: "2026-11",
        owner_name: "Gabriel",
        monthly_ceiling_cents: 500000,
        total_spent_cents: 200000,
        remaining_cents: 300000,
        spent_percentage: 40,
        is_revoked: false,
        expires_at: null,
        expenses: [],
      };
      vi.mocked(rpcModule.getSharedFamilyBudget).mockResolvedValueOnce(mockResult);

      const res = await getSharedFamilyBudgetByToken("fam-tok-1", "2026-11");
      expect(rpcModule.getSharedFamilyBudget).toHaveBeenCalledWith({
        token: "fam-tok-1",
        month: "2026-11",
      });
      expect(res).toEqual(mockResult);
    });

    it("regeneratePublicShare revoga o token anterior e cria um novo compartilhamento", async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: "new-share-id",
          user_id: "user-test-uuid",
          kind: "family_budget",
          token: "brandnewtoken",
          payload: { monthly_ceiling_cents: 500000 },
          created_at: "2026-11-05T12:00:00Z",
          expires_at: null,
          is_revoked: false,
          updated_at: "2026-11-05T12:00:00Z",
        },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === "public_shares") {
          return {
            update: mockUpdate,
            insert: mockInsert,
          };
        }
        return {};
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof getSupabase>);

      const result = await regeneratePublicShare("old-share-id", {
        kind: "family_budget",
        payload: { monthly_ceiling_cents: 500000 },
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_revoked: true,
        }),
      );
      expect(mockEq).toHaveBeenCalledWith("id", "old-share-id");
      expect(result.id).toBe("new-share-id");
      expect(result.token).toBe("brandnewtoken");
    });
  });

  describe("saveSimulationToAccount", () => {
    it("transporta simulação de dívidas criando registros na tabela de dívidas", async () => {
      vi.mocked(debtsRepo.createDebt).mockResolvedValue({} as never);

      await saveSimulationToAccount({
        type: "debt_simulator",
        debts: [
          {
            name: "Empréstimo Pessoal",
            balanceCents: 500000,
            interestRateAnnual: 18.5,
            minimumPaymentCents: 50000,
          },
        ],
      });

      expect(debtsRepo.createDebt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Empréstimo Pessoal",
          amount: 5000,
          type: "payable",
        }),
      );
    });

    it("transporta simulação de rebalanceamento salvando metas de classe", async () => {
      vi.mocked(allocationRepo.saveGroupTarget).mockResolvedValue(undefined);

      await saveSimulationToAccount({
        type: "rebalance_simulator",
        classes: [
          { name: "Ações", targetPercent: 50 },
          { name: "FIIs", targetPercent: 50 },
        ],
      });

      expect(allocationRepo.saveGroupTarget).toHaveBeenCalledWith("class", "Ações", 50);
      expect(allocationRepo.saveGroupTarget).toHaveBeenCalledWith("class", "FIIs", 50);
    });

    it("transporta simulação de juros compostos criando meta de aportes", async () => {
      vi.mocked(categoriesRepo.listCategories).mockResolvedValueOnce([
        {
          id: "cat-invest-1",
          name: "Investimentos & Metas",
          type: "income",
          icon: "investimentos",
          color: "#3B82F6",
          is_reserved: false,
          is_active: true,
          user_id: "user-1",
          is_family: false,
        },
      ]);
      vi.mocked(incomeGoalsRepo.setGoal).mockResolvedValue(undefined);

      await saveSimulationToAccount({
        type: "compound_interest",
        initialAmountCents: 1000000,
        monthlyContributionCents: 200000,
        annualRatePercent: 12,
        periodYears: 15,
      });

      expect(incomeGoalsRepo.setGoal).toHaveBeenCalledWith(
        "cat-invest-1",
        expect.any(String),
        2000,
      );
    });
  });
});



