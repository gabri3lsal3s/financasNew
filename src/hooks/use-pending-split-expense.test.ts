import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { usePendingSplitExpense, PENDING_SPLIT_STORAGE_KEY } from "./use-pending-split-expense";
import * as authHook from "./use-auth";
import * as stateModule from "@/state";

vi.mock("./use-auth");
vi.mock("@/state");

describe("usePendingSplitExpense", () => {
  const mockMutateAsync = vi.fn().mockResolvedValue("expense-123");

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(stateModule.useSaveSplitExpense).mockReturnValue({
      mutateAsync: mockMutateAsync,
    } as unknown as ReturnType<typeof stateModule.useSaveSplitExpense>);
  });

  it("não executa se não houver usuário autenticado", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      session: null,
      user: null,
    } as unknown as ReturnType<typeof authHook.useAuth>);

    localStorage.setItem(
      PENDING_SPLIT_STORAGE_KEY,
      JSON.stringify({
        token: "tok123",
        title: "Pizza",
        amountCents: 5000,
        date: "2026-11-05",
      }),
    );

    renderHook(() => usePendingSplitExpense());

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_SPLIT_STORAGE_KEY)).not.toBeNull();
  });

  it("processa e remove despesa pendente quando usuário estiver autenticado", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      session: { user: { id: "user-123" } },
      user: { id: "user-123" },
    } as unknown as ReturnType<typeof authHook.useAuth>);

    localStorage.setItem(
      PENDING_SPLIT_STORAGE_KEY,
      JSON.stringify({
        token: "tok123",
        title: "Almoço da equipe",
        amountCents: 3500,
        date: "2026-11-05",
      }),
    );

    renderHook(() => usePendingSplitExpense());

    expect(mockMutateAsync).toHaveBeenCalledWith({
      title: "Almoço da equipe",
      amountCents: 3500,
      date: "2026-11-05",
    });
    expect(localStorage.getItem(PENDING_SPLIT_STORAGE_KEY)).toBeNull();
  });

  it("limpa storage graciosamente se os dados estiverem corrompidos", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      session: { user: { id: "user-123" } },
      user: { id: "user-123" },
    } as unknown as ReturnType<typeof authHook.useAuth>);

    localStorage.setItem(PENDING_SPLIT_STORAGE_KEY, "invalid-json{{");

    renderHook(() => usePendingSplitExpense());

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_SPLIT_STORAGE_KEY)).toBeNull();
  });
});
