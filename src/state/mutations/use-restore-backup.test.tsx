import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useRestoreBackup } from "./use-restore-backup";
import * as exportRepo from "@/data/repositories/export";
import * as toastService from "@/services/toast";
import type { BackupPayload, RestoreSummary } from "@/domain/export";

vi.mock("@/data/repositories/export", () => ({
  fetchAllUserData: vi.fn(),
  restoreBackup: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const emptyBackupPayload: BackupPayload = {
  version: 1,
  app: "Finanças Pessoais",
  exportedAt: "2026-08-25T10:00:00.000Z",
  data: {
    categories: [],
    credit_cards: [],
    card_competence_overrides: [],
    incomes: [],
    expenses: [],
    card_payments: [],
    debts: [],
    budgets: [],
    income_goals: [],
    insight_feedback: [],
    reminder_states: [],
    portfolio_assets: [],
    portfolio_transactions: [],
    portfolio_snapshots: [],
    portfolio_contributions: [],
    portfolio_dividends: [],
    allocation_targets: [],
    class_targets: [],
    sector_targets: [],
    asset_prices: [],
    cash_checkpoints: [],
    user_preferences: [],
  },
};


describe("useRestoreBackup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restaura o backup com sucesso e dispara toast positivo", async () => {
    const summary: RestoreSummary = { expenses: 5, incomes: 2 };
    vi.mocked(exportRepo.restoreBackup).mockResolvedValueOnce(summary);

    const { result } = renderHook(() => useRestoreBackup(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate(emptyBackupPayload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(exportRepo.restoreBackup).toHaveBeenCalledTimes(1);
    expect(toastService.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "success",
        title: "Backup restaurado",
      }),
    );
  });

  it("trata erro na restauração disparando toast destrutivo", async () => {
    vi.mocked(exportRepo.restoreBackup).mockRejectedValueOnce(new Error("Falha no RPC"));

    const { result } = renderHook(() => useRestoreBackup(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate(emptyBackupPayload);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastService.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Erro ao restaurar backup",
      }),
    );
  });
});
