import { describe, expect, it, vi } from "vitest";
import {
  createCashCheckpoint,
  deleteCashCheckpoint,
  getLatestCashCheckpoint,
  listCashCheckpoints,
} from "./cash-checkpoints";
import { getSupabase } from "@/data/client";

vi.mock("@/data/client", () => ({
  getSupabase: vi.fn(),
}));

vi.mock("@/data/session", () => ({
  currentUserId: vi.fn().mockResolvedValue("user-test-123"),
}));

describe("data/repositories/cash-checkpoints", () => {
  it("listCashCheckpoints retorna lista de checkpoints ordenados", async () => {
    const mockData = [
      {
        id: "chk-1",
        user_id: "user-test-123",
        date: "2026-08-24",
        balance_cents: 540000,
        notes: "Saldo Nubank + Itaú",
        created_at: "2026-08-24T12:00:00Z",
      },
    ];

    const mockOrder2 = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder1 });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getSupabase>);

    const result = await listCashCheckpoints();
    expect(result).toHaveLength(1);
    expect(result[0]?.balance_cents).toBe(540000);
    expect(result[0]?.notes).toBe("Saldo Nubank + Itaú");
  });

  it("getLatestCashCheckpoint retorna o último checkpoint ou null", async () => {
    const mockData = [
      {
        id: "chk-latest",
        user_id: "user-test-123",
        date: "2026-08-24",
        balance_cents: 300000,
        notes: null,
        created_at: "2026-08-24T18:00:00Z",
      },
    ];

    const mockLimit = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const mockOrder2 = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getSupabase>);

    const result = await getLatestCashCheckpoint();
    expect(mockEq).toHaveBeenCalledWith("scope", "personal");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("chk-latest");
    expect(result?.balance_cents).toBe(300000);
  });

  it("filtra checkpoints pela data de corte antes de selecionar o mais recente", async () => {
    const cutoffDate = "2026-08-24";
    const mockLimit = vi.fn().mockResolvedValue({
      data: [{
        id: "chk-cutoff",
        user_id: "user-test-123",
        date: cutoffDate,
        balance_cents: 80000,
        scope: "business",
        created_at: "2026-08-24T18:00:00Z",
      }],
      error: null,
    });
    const mockOrderCreatedAt = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockOrderDate = vi.fn().mockReturnValue({ order: mockOrderCreatedAt });
    const mockLte = vi.fn().mockReturnValue({ order: mockOrderDate });
    const mockEq = vi.fn().mockReturnValue({ lte: mockLte });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    } as unknown as ReturnType<typeof getSupabase>);

    const result = await getLatestCashCheckpoint("business", cutoffDate);

    expect(mockEq).toHaveBeenCalledWith("scope", "business");
    expect(mockLte).toHaveBeenCalledWith("date", cutoffDate);
    expect(mockOrderDate).toHaveBeenCalledWith("date", { ascending: false });
    expect(mockOrderCreatedAt).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(mockLimit).toHaveBeenCalledWith(1);
    expect(result?.balance_cents).toBe(80000);
  });

  it("createCashCheckpoint insere e retorna novo checkpoint", async () => {
    const mockCreated = {
      id: "chk-new",
      user_id: "user-test-123",
      date: "2026-08-24",
      balance_cents: 450000,
      notes: "Ajuste manual",
      scope: "personal",
      created_at: "2026-08-24T19:00:00Z",
    };

    const mockSingle = vi.fn().mockResolvedValue({ data: mockCreated, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getSupabase>);

    const result = await createCashCheckpoint({
      date: "2026-08-24",
      balance_cents: 450000,
      notes: "Ajuste manual",
    });

    expect(result.id).toBe("chk-new");
    expect(result.balance_cents).toBe(450000);
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-test-123",
      date: "2026-08-24",
      balance_cents: 450000,
      notes: "Ajuste manual",
      scope: "personal",
    });
  });

  it("deleteCashCheckpoint executa deleção por id", async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });

    vi.mocked(getSupabase).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getSupabase>);

    await deleteCashCheckpoint("chk-123");
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith("id", "chk-123");
  });
});
