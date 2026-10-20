import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBudgets, budgetsKey } from "./use-budgets";
import * as budgetsRepo from "@/data/repositories/budgets";
import { STALE_TIMES, STATIC_GC_TIME } from "@/state/cache-policy";
import type { Budget } from "@/types";

vi.mock("@/data/repositories/budgets", () => ({
  listBudgets: vi.fn(),
}));

const mockBudgets: Budget[] = [
  {
    id: "b-1",
    user_id: "user-1",
    category_id: "cat-1",
    month: "2026-10",
    limit: 150000,
  },
];

describe("useBudgets Hook — Calibração de Cache (Tarefa 1.2)", () => {
  let queryClient: QueryClient;

  function createWrapper() {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("carrega orçamentos com staleTime estático de 5 minutos e gcTime de 30 minutos", async () => {
    vi.mocked(budgetsRepo.listBudgets).mockResolvedValueOnce(mockBudgets);

    const { result } = renderHook(() => useBudgets(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockBudgets);
    expect(budgetsRepo.listBudgets).toHaveBeenCalledTimes(1);

    const query = queryClient.getQueryCache().find({ queryKey: [...budgetsKey] });
    expect(query).toBeDefined();
    const observers = (query as unknown as { observers: Array<{ options: { staleTime?: number; gcTime?: number } }> }).observers;
    expect(observers[0]?.options.staleTime).toBe(STALE_TIMES.static);
    expect(observers[0]?.options.staleTime).toBe(300_000);
    expect(observers[0]?.options.gcTime).toBe(STATIC_GC_TIME);
  });
});
