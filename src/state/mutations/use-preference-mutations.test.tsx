import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userPreferencesQueryKey } from "@/state/queries/use-user-preferences";
import type { UserPreferences } from "@/types";
import { useUpdateCustomSettings } from "./use-preference-mutations";

let activeUid: string | null = "u1";
let mockUpdateImpl: () => Promise<void> = async () => {};
const mockPushToast = vi.fn();

vi.mock("@/services/user-storage", () => ({
  getActiveUserId: () => activeUid,
}));

vi.mock("@/services/toast", () => ({
  pushToast: (...args: unknown[]) => mockPushToast(...args),
}));

vi.mock("@/data/repositories/user-preferences", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/repositories/user-preferences")>();
  return {
    ...actual,
    updateCustomSettings: () => mockUpdateImpl(),
  };
});

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useUpdateCustomSettings", () => {
  beforeEach(() => {
    activeUid = "u1";
    mockUpdateImpl = async () => {};
    mockPushToast.mockReset();
  });

  it("sintetiza cache otimista quando previous === null sem fabricar consentimentos e restaura null no erro", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const key = userPreferencesQueryKey("u1");
    queryClient.setQueryData<UserPreferences | null>(key, null);

    let rejectWrite!: (err: Error) => void;
    mockUpdateImpl = () =>
      new Promise<void>((_resolve, reject) => {
        rejectWrite = reject;
      });

    const { result } = renderHook(() => useUpdateCustomSettings(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        carouselDismissals: {
          "cashflow.pace": { preset: "7d", dismissedAt: 100, dismissedUntil: 200 },
        },
      });
    });

    await waitFor(() => {
      const optimistic = queryClient.getQueryData<UserPreferences | null>(key);
      expect(optimistic).not.toBeNull();
      expect(optimistic?.reminders_enabled).toBe(false);
      expect(optimistic?.custom_settings?.carouselDismissals?.["cashflow.pace"]?.preset).toBe("7d");
    });

    await act(async () => {
      rejectWrite(new Error("Falha de rede"));
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<UserPreferences | null>(key)).toBeNull();
      expect(mockPushToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      );
    });
  });

  it("não inventa entrada no cache quando previous === undefined", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const key = userPreferencesQueryKey("u1");

    const { result } = renderHook(() => useUpdateCustomSettings(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ density: "compact" });
    });

    expect(queryClient.getQueryData(key)).toBeUndefined();
  });

  it("descarta rollback do usuário anterior após logout/troca de UID", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const keyU1 = userPreferencesQueryKey("u1");
    const prevU1: UserPreferences = {
      user_id: "u1",
      theme: "system",
      app_mode: "investor",
      reminders_enabled: true,
      reminder_days_before_debt: 3,
      reminder_days_before_bill: 3,
      report_weights_enabled: false,
      max_sector_acoes: null,
      max_sector_fiis: null,
      custom_settings: { density: "comfortable" },
    };
    queryClient.setQueryData(keyU1, prevU1);

    let rejectWrite!: (err: Error) => void;
    mockUpdateImpl = () =>
      new Promise<void>((_resolve, reject) => {
        rejectWrite = reject;
      });

    const { result } = renderHook(() => useUpdateCustomSettings(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ density: "compact" });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<UserPreferences>(keyU1)?.custom_settings?.density).toBe(
        "compact",
      );
    });

    // Usuário troca para u2 / logout antes do retorno da rede
    activeUid = "u2";
    queryClient.removeQueries({ queryKey: keyU1 });

    await act(async () => {
      rejectWrite(new Error("Erro tardio"));
    });

    expect(queryClient.getQueryData(keyU1)).toBeUndefined();
  });
});
