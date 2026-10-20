import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useExpensesByRange } from "./use-expenses";
import { useIncomesByRange } from "./use-incomes";

const listExpensesByRangeMock = vi.fn().mockImplementation((_start, _end, options) => {
  if (options?.signal?.aborted) {
    throw new DOMException("The user aborted a request.", "AbortError");
  }
  return Promise.resolve([]);
});

const listIncomesByRangeMock = vi.fn().mockImplementation((_start, _end, options) => {
  if (options?.signal?.aborted) {
    throw new DOMException("The user aborted a request.", "AbortError");
  }
  return Promise.resolve([]);
});

vi.mock("@/data/repositories/expenses", () => ({
  listExpensesByRange: (start: string, end: string, options?: { signal?: AbortSignal }) =>
    listExpensesByRangeMock(start, end, options),
  listExpensesByMonth: vi.fn(),
  getExpense: vi.fn(),
}));

vi.mock("@/data/repositories/incomes", () => ({
  listIncomesByRange: (start: string, end: string, options?: { signal?: AbortSignal }) =>
    listIncomesByRangeMock(start, end, options),
  listIncomesByMonth: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useExpensesByRange & useIncomesByRange AbortSignal propagation", () => {
  it("encaminha o AbortSignal do TanStack Query para listExpensesByRange", async () => {
    listExpensesByRangeMock.mockClear();

    const { result } = renderHook(() => useExpensesByRange("2026-08-01", "2026-09-01"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(listExpensesByRangeMock).toHaveBeenCalledWith(
      "2026-08-01",
      "2026-09-01",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("encaminha o AbortSignal do TanStack Query para listIncomesByRange", async () => {
    listIncomesByRangeMock.mockClear();

    const { result } = renderHook(() => useIncomesByRange("2026-08-01", "2026-09-01"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(listIncomesByRangeMock).toHaveBeenCalledWith(
      "2026-08-01",
      "2026-09-01",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("aborta o signal quando a query de despesas é cancelada ao desmontar", async () => {
    let capturedSignal: AbortSignal | undefined;
    listExpensesByRangeMock.mockImplementationOnce((_start, _end, options) => {
      capturedSignal = options?.signal;
      return new Promise(() => {
        // Promessa pendente que nunca resolve
      });
    });

    const { unmount } = renderHook(() => useExpensesByRange("2026-08-01", "2026-09-01"), {
      wrapper: createWrapper(),
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });
});
