import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { categoriesKey, useAllCategories, useCategories, useCategoryUsage } from "./use-categories";
import * as categoriesRepo from "@/data/repositories/categories";
import { STALE_TIMES, STATIC_GC_TIME } from "@/state/cache-policy";
import type { Category } from "@/types";

vi.mock("@/data/repositories/categories", () => ({
  listCategories: vi.fn(),
  listAllCategories: vi.fn(),
  getCategoryUsage: vi.fn(),
}));

const mockCategories: Category[] = [
  {
    id: "cat-1",
    user_id: "user-1",
    name: "Alimentação",
    type: "expense",
    color: "#ff0000",
    icon: "Utensils",
    is_reserved: false,
    is_active: true,
  },
];

describe("useCategories Hook — Calibração de Cache (Tarefa 1.2)", () => {
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

  it("carrega categorias ativas com staleTime de 5 minutos e gcTime estendido", async () => {
    vi.mocked(categoriesRepo.listCategories).mockResolvedValueOnce(mockCategories);

    const { result } = renderHook(() => useCategories("expense"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockCategories);
    expect(categoriesRepo.listCategories).toHaveBeenCalledWith("expense");

    const query = queryClient.getQueryCache().find({ queryKey: [...categoriesKey, "expense"] });
    expect(query).toBeDefined();
    const observers = (query as unknown as { observers: Array<{ options: { staleTime?: number; gcTime?: number } }> }).observers;
    expect(observers[0]?.options.staleTime).toBe(STALE_TIMES.static);
    expect(observers[0]?.options.staleTime).toBe(300_000);
    expect(observers[0]?.options.gcTime).toBe(STATIC_GC_TIME);
  });

  it("lista categorias pessoais e categorias familiares compartilhadas da família ativa (Tarefa 3.2)", async () => {
    const combinedCategories: Category[] = [
      {
        id: "cat-personal",
        user_id: "user-1",
        name: "Academia",
        type: "expense",
        color: "#3b82f6",
        icon: "Dumbbell",
        is_reserved: false,
        is_active: true,
        is_family: false,
      },
      {
        id: "cat-shared-partner",
        user_id: "user-partner-2",
        name: "Supermercado Casa",
        type: "expense",
        color: "#10b981",
        icon: "ShoppingCart",
        is_reserved: false,
        is_active: true,
        is_family: true,
        family_id: "fam-active-123",
      },
    ];

    vi.mocked(categoriesRepo.listCategories).mockResolvedValueOnce(combinedCategories);

    const { result } = renderHook(() => useCategories("expense"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]?.is_family).toBe(false);
    expect(result.current.data?.[1]?.is_family).toBe(true);
    expect(result.current.data?.[1]?.family_id).toBe("fam-active-123");
  });

  it("carrega todas as categorias com staleTime de 5 minutos", async () => {
    vi.mocked(categoriesRepo.listAllCategories).mockResolvedValueOnce(mockCategories);

    const { result } = renderHook(() => useAllCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockCategories);
    expect(categoriesRepo.listAllCategories).toHaveBeenCalledWith(undefined);

    const query = queryClient.getQueryCache().find({ queryKey: [...categoriesKey, "all", "all"] });
    expect(query).toBeDefined();
    const observers = (query as unknown as { observers: Array<{ options: { staleTime?: number } }> }).observers;
    expect(observers[0]?.options.staleTime).toBe(STALE_TIMES.static);
  });

  it("busca uso de categoria com staleTime 0 para consistência em exclusões", async () => {
    vi.mocked(categoriesRepo.getCategoryUsage).mockResolvedValueOnce({ expenses: 5, incomes: 0 });

    const { result } = renderHook(() => useCategoryUsage("cat-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({ expenses: 5, incomes: 0 });
    expect(categoriesRepo.getCategoryUsage).toHaveBeenCalledWith("cat-1");

    const query = queryClient.getQueryCache().find({ queryKey: [...categoriesKey, "usage", "cat-1"] });
    expect(query).toBeDefined();
    const observers = (query as unknown as { observers: Array<{ options: { staleTime?: number } }> }).observers;
    expect(observers[0]?.options.staleTime).toBe(0);
  });
});
