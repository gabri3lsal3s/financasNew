import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useExportData } from "./use-export-data";
import * as exportRepo from "@/data/repositories/export";
import type { BackupPayload } from "@/domain/export";

vi.mock("@/data/repositories/export", () => ({
  fetchAllUserData: vi.fn(),
  restoreBackup: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useExportData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("busca todos os dados de usuário com sucesso", async () => {
    const mockPayload: BackupPayload = {
      version: 1,
      exportedAt: "2026-08-25T10:00:00.000Z",
      tables: {
        profiles: [],
        categories: [],
        credit_cards: [],
        expenses: [],
        incomes: [],
        recurrences: [],
        debts: [],
        budgets: [],
        income_goals: [],
        portfolio_assets: [],
        portfolio_transactions: [],
        portfolio_contributions: [],
        portfolio_dividends: [],
        portfolio_snapshots: [],
        user_preferences: [],
        card_bill_refinances: [],
        loan_contracts: [],
        allocation_presets: [],
        cash_checkpoints: [],
      },
    };
    vi.mocked(exportRepo.fetchAllUserData).mockResolvedValueOnce(mockPayload);

    const { result } = renderHook(() => useExportData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockPayload);
    expect(exportRepo.fetchAllUserData).toHaveBeenCalledTimes(1);
  });
});
