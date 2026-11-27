import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as accessRepo from "@/data/repositories/access";
import * as subscriptionsRepo from "@/data/repositories/subscriptions";
import * as prefsRepo from "@/data/repositories/user-preferences";
import * as sessionRpc from "@/data/rpc/session";
import { useSessionBootstrap } from "./use-session-bootstrap";
import {
  userAccessQueryKey,
  userFeaturesQueryKey,
  userSubscriptionQueryKey,
} from "./use-user-access";
import { userPreferencesQueryKey } from "./use-user-preferences";
import type { Profile, UserPreferences } from "@/types";

vi.mock("@/data/rpc/session", () => ({
  getMySessionBootstrap: vi.fn(),
}));

vi.mock("@/data/repositories/access", () => ({
  getMyProfile: vi.fn(),
  getMyFeatures: vi.fn(),
}));

vi.mock("@/data/repositories/subscriptions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/repositories/subscriptions")>();
  return {
    ...actual,
    getMySubscription: vi.fn(),
  };
});

vi.mock("@/data/repositories/user-preferences", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/repositories/user-preferences")>();
  return {
    ...actual,
    getUserPreferences: vi.fn(),
  };
});

const mockProfile: Profile = {
  id: "user-boot-1",
  name: "Maria",
  email: "maria@exemplo.com",
  role: "user",
  status: "active",
  approved_at: "2026-01-01T00:00:00Z",
  approved_by: null,
  suspended_reason: null,
  created_at: "2026-01-01T00:00:00Z",
};

const mockPreferences: UserPreferences = {
  user_id: "user-boot-1",
  theme: "dark",
  app_mode: "investor",
  reminders_enabled: true,
  reminder_days_before_bill: 3,
  reminder_days_before_debt: 2,
  report_weights_enabled: true,
  max_sector_acoes: 25,
  max_sector_fiis: 20,
  custom_settings: {
    familyModeEnabled: false,
    tripModeEnabled: false,
  },
};

describe("useSessionBootstrap", () => {
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

  it("executa 1 RPC única e semeia as 4 chaves individuais no QueryClient", async () => {
    vi.mocked(sessionRpc.getMySessionBootstrap).mockResolvedValueOnce({
      profile: mockProfile,
      features: { overview: true, transactions: true },
      subscription: {
        plan_id: "pro_annual",
        tier: "pro_annual",
        status: "active",
        starts_at: "2026-01-01T00:00:00Z",
        trial_days_remaining: null,
        trial_ends_at: null,
        current_period_end: "2027-01-01T00:00:00Z",
        cancel_at_period_end: false,
        is_full_access: true,
        is_trial: false,
        is_pro: true,
        is_lifetime: false,
        is_read_only: false,
        can_write: true,
        module_permissions: {},
      },
      preferences: mockPreferences,
    });

    const { result } = renderHook(() => useSessionBootstrap("user-boot-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(sessionRpc.getMySessionBootstrap).toHaveBeenCalledTimes(1);
    expect(accessRepo.getMyProfile).not.toHaveBeenCalled();

    expect(queryClient.getQueryData(userAccessQueryKey("user-boot-1"))).toEqual(mockProfile);
    expect(queryClient.getQueryData(userFeaturesQueryKey("user-boot-1"))).toEqual({
      overview: true,
      transactions: true,
    });
    expect(queryClient.getQueryData(userPreferencesQueryKey("user-boot-1"))).toEqual(mockPreferences);
    expect(queryClient.getQueryData(userSubscriptionQueryKey("user-boot-1"))).toMatchObject({
      tier: "pro_annual",
      isPro: true,
      canWrite: true,
    });
  });

  it("trata preferences: null sem erro para contas recém-criadas", async () => {
    vi.mocked(sessionRpc.getMySessionBootstrap).mockResolvedValueOnce({
      profile: mockProfile,
      features: { overview: true },
      subscription: null,
      preferences: null,
    });

    const { result } = renderHook(() => useSessionBootstrap("user-boot-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(queryClient.getQueryData(userPreferencesQueryKey("user-boot-1"))).toBeNull();
    expect(queryClient.getQueryData(userSubscriptionQueryKey("user-boot-1"))).toBeNull();
  });

  it("faz fallback automático para os 4 repositórios quando a RPC ainda não existe (PGRST202)", async () => {
    vi.mocked(sessionRpc.getMySessionBootstrap).mockRejectedValueOnce({
      code: "PGRST202",
      message: "Could not find the function public.get_my_session_bootstrap",
    });
    vi.mocked(accessRepo.getMyProfile).mockResolvedValueOnce(mockProfile);
    vi.mocked(accessRepo.getMyFeatures).mockResolvedValueOnce({ overview: true });
    vi.mocked(subscriptionsRepo.getMySubscription).mockResolvedValueOnce(null);
    vi.mocked(prefsRepo.getUserPreferences).mockResolvedValueOnce(mockPreferences);

    const { result } = renderHook(() => useSessionBootstrap("user-boot-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(accessRepo.getMyProfile).toHaveBeenCalledTimes(1);
    expect(accessRepo.getMyFeatures).toHaveBeenCalledTimes(1);
    expect(subscriptionsRepo.getMySubscription).toHaveBeenCalledTimes(1);
    expect(prefsRepo.getUserPreferences).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(userPreferencesQueryKey("user-boot-1"))).toEqual(mockPreferences);
  });
});
