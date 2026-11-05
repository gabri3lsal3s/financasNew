import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createPublicShare,
  getPublicShareByToken,
  listMyPublicShares,
  revokePublicShare,
  saveSplitExpenseToAccount,
} from "./public-shares";
import { getSupabase } from "@/data/client";
import * as rpcModule from "@/data/rpc";
import * as categoriesRepo from "./categories";

vi.mock("@/data/client", () => ({
  getSupabase: vi.fn(),
}));

vi.mock("@/data/rpc", () => ({
  createExpenseWithDebt: vi.fn(),
}));

vi.mock("./categories", () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
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
});

