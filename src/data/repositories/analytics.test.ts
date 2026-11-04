import { describe, it, expect, vi, beforeEach } from "vitest";
import { logAnalyticsBatch, getFeatureUsageRanking } from "./analytics";

const mockResolveQuery = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockGte = vi.fn();

vi.mock("@/data/query", () => ({
  resolveQuery: (...args: unknown[]) => mockResolveQuery(...args),
}));

vi.mock("@/data/session", () => ({
  currentUserId: vi.fn().mockResolvedValue("user-test-id"),
}));

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    from: () => ({
      insert: mockInsert,
      select: () => ({
        gte: mockGte,
      }),
    }),
  }),
}));

describe("analytics repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não executa insert quando lote de eventos é vazio", async () => {
    await logAnalyticsBatch([]);
    expect(mockResolveQuery).not.toHaveBeenCalled();
  });

  it("chama resolveQuery com insert quando há eventos", async () => {
    mockResolveQuery.mockResolvedValueOnce({ error: null });

    const events = [
      {
        event_name: "feature_used",
        module: "transactions",
        metadata: { source: "modal" },
      },
    ];

    await logAnalyticsBatch(events);

    expect(mockResolveQuery).toHaveBeenCalled();
  });

  it("executa getFeatureUsageRanking e calcula contagem agrupada", async () => {
    const rawEvents = [
      { module: "transactions", created_at: "2026-08-20T10:00:00Z" },
      { module: "transactions", created_at: "2026-08-20T11:00:00Z" },
      { module: "investments", created_at: "2026-08-20T12:00:00Z" },
    ];

    mockResolveQuery.mockResolvedValueOnce({ data: rawEvents, error: null });

    const ranking = await getFeatureUsageRanking(30);

    expect(ranking).toEqual([
      { module: "transactions", count: 2, percentage: 67, lastUsedAt: "2026-08-20T11:00:00Z" },
      { module: "investments", count: 1, percentage: 33, lastUsedAt: "2026-08-20T12:00:00Z" },
    ]);
  });
});
