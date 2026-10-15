import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClearDemoData, useLoadDemoData } from "./use-demo-data";
import type { ReactNode } from "react";

const loadDemoDataMock = vi.fn();
const clearDemoDataMock = vi.fn();
const pushToastMock = vi.fn();
const triggerSensoryMock = vi.fn();

vi.mock("@/services/demo-data", () => ({
  loadDemoData: () => loadDemoDataMock(),
  clearDemoData: () => clearDemoDataMock(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: (args: unknown) => pushToastMock(args),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: (args: unknown) => triggerSensoryMock(args),
}));

describe("use-demo-data hooks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("useLoadDemoData", () => {
    it("executa loadDemoData, invalida queries e emite toast de sucesso", async () => {
      loadDemoDataMock.mockResolvedValueOnce({
        categories: 5,
        cards: 1,
        incomes: 2,
        expenses: 10,
        budgets: 2,
        assets: 1,
      });

      const { result } = renderHook(() => useLoadDemoData(), { wrapper });
      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(loadDemoDataMock).toHaveBeenCalledTimes(1);
      expect(triggerSensoryMock).toHaveBeenCalledWith("success");
      expect(pushToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Dados de exemplo carregados",
          variant: "success",
        }),
      );
    });

    it("lida com erro emitindo toast destrutivo", async () => {
      loadDemoDataMock.mockRejectedValueOnce(new Error("Falha no servidor"));

      const { result } = renderHook(() => useLoadDemoData(), { wrapper });
      result.current.mutate();

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(triggerSensoryMock).toHaveBeenCalledWith("destructive");
      expect(pushToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
        }),
      );
    });
  });

  describe("useClearDemoData", () => {
    it("executa clearDemoData e emite toast informativo de sucesso", async () => {
      clearDemoDataMock.mockResolvedValueOnce({
        expenses: 10,
        incomes: 2,
        cards: 1,
        budgets: 0,
        assets: 1,
      });

      const { result } = renderHook(() => useClearDemoData(), { wrapper });
      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(clearDemoDataMock).toHaveBeenCalledTimes(1);
      expect(triggerSensoryMock).toHaveBeenCalledWith("action");
      expect(pushToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Dados de exemplo removidos",
          variant: "success",
        }),
      );
    });
  });
});
