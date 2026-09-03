import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMacroIndicators } from "./use-macro-indicators";
import * as quotesService from "@/services/quotes";

describe("useMacroIndicators hook", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("retorna as taxas de CDI e Selic obtidas do Banco Central", async () => {
    vi.spyOn(quotesService, "fetchBcbIndicator").mockImplementation(async (indicator) => {
      if (indicator === "CDI") return 11.25;
      if (indicator === "SELIC") return 11.50;
      return null;
    });

    const { result } = renderHook(() => useMacroIndicators(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      annualCdiRate: 11.25,
      annualSelicRate: 11.50,
    });
  });

  it("aplica taxa padrão de fallback quando o BCB estiver temporariamente indisponível", async () => {
    vi.spyOn(quotesService, "fetchBcbIndicator").mockResolvedValue(null);

    const { result } = renderHook(() => useMacroIndicators(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.annualCdiRate).toBe(10.5);
    expect(result.current.data?.annualSelicRate).toBe(10.5);
  });
});
