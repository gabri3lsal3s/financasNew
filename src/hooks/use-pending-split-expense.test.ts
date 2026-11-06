import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { usePendingSplitExpense, PENDING_SPLIT_STORAGE_KEY } from "./use-pending-split-expense";
import * as authHook from "./use-auth";
import * as stateModule from "@/state";
import * as appLockModule from "@/services/native/app-lock";

vi.mock("./use-auth");
vi.mock("@/state");
vi.mock("@/services/native/app-lock");
vi.mock("@/services/sensory", () => ({ triggerSensory: vi.fn() }));
vi.mock("@/services/toast", () => ({ pushToast: vi.fn() }));

describe("usePendingSplitExpense", () => {
  const mockSaveMutateAsync = vi.fn().mockResolvedValue("expense-123");
  const mockSignalMutateAsync = vi.fn().mockResolvedValue({ success: true });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(stateModule.useSaveSplitExpense).mockReturnValue({
      mutateAsync: mockSaveMutateAsync,
    } as unknown as ReturnType<typeof stateModule.useSaveSplitExpense>);
    vi.mocked(stateModule.useSignalSplitPayment).mockReturnValue({
      mutateAsync: mockSignalMutateAsync,
    } as unknown as ReturnType<typeof stateModule.useSignalSplitPayment>);
    vi.mocked(appLockModule.isAppLocked).mockReturnValue(false);
    vi.mocked(appLockModule.subscribeAppLock).mockImplementation(() => {
      return () => {};
    });
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

    expect(mockSaveMutateAsync).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_SPLIT_STORAGE_KEY)).not.toBeNull();
  });

  it("não executa enquanto o aplicativo estiver bloqueado por biometria", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      session: { user: { id: "user-123" } },
      user: { id: "user-123" },
    } as unknown as ReturnType<typeof authHook.useAuth>);
    vi.mocked(appLockModule.isAppLocked).mockReturnValue(true);

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

    expect(mockSaveMutateAsync).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_SPLIT_STORAGE_KEY)).not.toBeNull();
  });

  it("processa, sinaliza pagamento e remove despesa pendente quando usuário estiver autenticado e desbloqueado", async () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      session: {
        user: {
          id: "user-123",
          user_metadata: { name: "Lucas Convidado" },
        },
      },
      user: { id: "user-123" },
    } as unknown as ReturnType<typeof authHook.useAuth>);

    localStorage.setItem(
      PENDING_SPLIT_STORAGE_KEY,
      JSON.stringify({
        token: "tok123",
        title: "Almoço da equipe",
        amountCents: 3500,
        date: "2026-11-05",
        participantId: "part-456",
        categoryId: "cat-almoco",
      }),
    );

    renderHook(() => usePendingSplitExpense());

    await waitFor(() => {
      expect(mockSaveMutateAsync).toHaveBeenCalledWith({
        title: "Almoço da equipe",
        amountCents: 3500,
        date: "2026-11-05",
        categoryId: "cat-almoco",
      });
      expect(mockSignalMutateAsync).toHaveBeenCalledWith({
        token: "tok123",
        participantId: "part-456",
        participantName: "Lucas Convidado",
        amountCents: 3500,
      });
      expect(localStorage.getItem(PENDING_SPLIT_STORAGE_KEY)).toBeNull();
    });
  });

  it("limpa storage graciosamente se os dados estiverem corrompidos", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      session: { user: { id: "user-123" } },
      user: { id: "user-123" },
    } as unknown as ReturnType<typeof authHook.useAuth>);

    localStorage.setItem(PENDING_SPLIT_STORAGE_KEY, "invalid-json{{");

    renderHook(() => usePendingSplitExpense());

    expect(mockSaveMutateAsync).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_SPLIT_STORAGE_KEY)).toBeNull();
  });
});
