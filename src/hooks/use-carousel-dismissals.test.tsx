import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetCarouselDismissalsStore,
  useCarouselDismissals,
} from "./use-carousel-dismissals";

let activeUid: string | null = "user-1";
const uidListeners = new Set<(uid: string | null) => void>();
const mockMutate = vi.fn();
const mockPushToast = vi.fn();
let mockPreferencesData: {
  custom_settings?: Record<string, unknown>;
} | null | undefined = { custom_settings: {} };

vi.mock("@/services/user-storage", () => ({
  getActiveUserId: () => activeUid,
  getUserStorageKey: (base: string, uid?: string | null) => `${base}:${uid ?? "anon"}`,
  subscribeActiveUserId: (cb: (uid: string | null) => void) => {
    uidListeners.add(cb);
    return () => {
      uidListeners.delete(cb);
    };
  },
}));

vi.mock("@/services/toast", () => ({
  pushToast: (...args: unknown[]) => mockPushToast(...args),
}));

vi.mock("@/state/queries/use-user-preferences", () => ({
  useUserPreferences: () => ({
    data: mockPreferencesData,
    isLoading: false,
    isPending: false,
    status: "success",
  }),
}));

vi.mock("@/state/mutations/use-preference-mutations", () => ({
  useUpdateCustomSettings: () => ({
    mutate: (...args: unknown[]) => mockMutate(...args),
    isPending: false,
  }),
}));

describe("useCarouselDismissals", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetCarouselDismissalsStore();
    activeUid = "user-1";
    mockPreferencesData = { custom_settings: {} };
    mockMutate.mockReset();
    mockPushToast.mockReset();
  });

  it("oculta imediatamente ao dispensar, exibe toast de 5s com Desfazer e reativa ao desfazer", () => {
    const { result } = renderHook(() => useCarouselDismissals());
    expect(result.current.isCardVisible("portfolio.drift")).toBe(true);

    act(() => {
      result.current.dismissCard("portfolio.drift", "6m");
    });

    expect(result.current.isCardVisible("portfolio.drift")).toBe(false);
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockPushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 5000,
        action: expect.objectContaining({ label: "Desfazer" }),
      }),
    );

    const toastArg = mockPushToast.mock.calls[0]![0] as { action: { onClick: () => void } };
    act(() => {
      toastArg.action.onClick();
    });

    expect(result.current.isCardVisible("portfolio.drift")).toBe(true);
    expect(mockMutate).toHaveBeenCalledTimes(2);
  });

  it("ignora Undo atrasado quando uma nova dispensa já substituiu a operação", () => {
    const { result } = renderHook(() => useCarouselDismissals());

    act(() => {
      result.current.dismissCard("portfolio.drift", "6m");
    });
    const firstToastUndo = (
      mockPushToast.mock.calls[0]![0] as { action: { onClick: () => void } }
    ).action.onClick;

    act(() => {
      result.current.dismissCard("portfolio.drift", "7d");
    });

    // Clique atrasado no Undo da primeira operação não deve desfazer o 7d atual
    act(() => {
      firstToastUndo();
    });

    expect(result.current.isCardVisible("portfolio.drift")).toBe(false);
    expect(result.current.dismissalsMap["portfolio.drift"]?.preset).toBe("7d");
  });

  it("faz rollback do store local se a mutação falhar para a mesma versão", () => {
    const { result } = renderHook(() => useCarouselDismissals());

    act(() => {
      result.current.dismissCard("cashflow.pace", "1m");
    });
    expect(result.current.isCardVisible("cashflow.pace")).toBe(false);

    const callbacks = mockMutate.mock.calls[0]![1] as { onError?: () => void };
    act(() => {
      callbacks.onError?.();
    });

    expect(result.current.isCardVisible("cashflow.pace")).toBe(true);
  });

  it("isola estado por usuário na troca de UID e nunca escreve sem userId", () => {
    const { result } = renderHook(() => useCarouselDismissals());

    act(() => {
      result.current.dismissCard("cashflow.pace", "7d");
    });
    expect(result.current.isCardVisible("cashflow.pace")).toBe(false);

    act(() => {
      activeUid = "user-2";
      uidListeners.forEach((fn) => fn("user-2"));
    });

    expect(result.current.isCardVisible("cashflow.pace")).toBe(true);

    act(() => {
      activeUid = null;
      uidListeners.forEach((fn) => fn(null));
    });

    act(() => {
      result.current.dismissCard("cashflow.pace", "7d");
    });
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("rejeita preset 6m não permitido para cards táticos", () => {
    const { result } = renderHook(() => useCarouselDismissals());

    act(() => {
      result.current.dismissCard("cashflow.pace", "6m");
    });

    expect(result.current.isCardVisible("cashflow.pace")).toBe(true);
    expect(mockMutate).not.toHaveBeenCalled();

    act(() => {
      result.current.dismissCard("cashflow.pace", "1m");
    });

    expect(result.current.isCardVisible("cashflow.pace")).toBe(false);
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("lê aliases legados apenas quando chave canônica está ausente", () => {
    const future = Date.now() + 86_400_000;
    mockPreferencesData = {
      custom_settings: {
        portfolioAlertDismissals: {
          "available-dividends-alert": { dismissedUntil: future },
        },
      },
    };
    const { result } = renderHook(() => useCarouselDismissals());

    expect(
      result.current.isCardVisible("portfolio.dividends_available", {
        legacySources: {
          portfolioAlertDismissals: {
            "available-dividends-alert": { dismissedUntil: future },
          },
        },
      }),
    ).toBe(false);
  });
});
