import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useUserAccess,
  USER_ACCESS_KEY,
  USER_FEATURES_KEY,
  USER_SUBSCRIPTION_KEY,
  userAccessQueryKey,
  userFeaturesQueryKey,
  userSubscriptionQueryKey,
} from "./use-user-access";
import * as accessRepo from "@/data/repositories/access";
import * as subscriptionsRepo from "@/data/repositories/subscriptions";
import { setActiveUserId } from "@/services/user-storage";
import type { Profile, SubscriptionStatus } from "@/types";

vi.mock("@/data/client", () => ({
  getSupabase: vi.fn(() => ({
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  })),
}));

vi.mock("@/data/repositories/access", () => ({
  getMyProfile: vi.fn(),
  getMyFeatures: vi.fn(),
}));

vi.mock("@/data/repositories/subscriptions", () => ({
  getMySubscription: vi.fn(),
}));

const mockProfile: Profile = {
  id: "user-1",
  name: "João Silva",
  email: "joao@exemplo.com",
  role: "user",
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  approved_at: "2026-01-01T00:00:00Z",
  approved_by: null,
  suspended_reason: null,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useUserAccess hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveUserId("user-1");
  });

  it("bloqueia funcionalidades quando o módulo possui access_level = none na assinatura", async () => {
    vi.mocked(accessRepo.getMyProfile).mockResolvedValue(mockProfile);
    vi.mocked(accessRepo.getMyFeatures).mockResolvedValue({
      transactions: true,
      investments: true,
      reports: true,
      overview: true,
    });
    vi.mocked(subscriptionsRepo.getMySubscription).mockResolvedValue({
      tier: "lifetime",
      canWrite: true,
      isFullAccess: true,
      moduleAccess: {
        investments: "write",
        reports: "write",
        transactions: "none",
        cards: "none",
        debts: "none",
        budgets: "none",
      },
    } as unknown as SubscriptionStatus);

    const { result } = renderHook(() => useUserAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Módulos liberados
    expect(result.current.hasFeature("investments")).toBe(true);
    expect(result.current.hasFeature("reports")).toBe(true);

    // Módulos bloqueados explicitamente por moduleAccess
    expect(result.current.hasFeature("transactions")).toBe(false);
    expect(result.current.hasFeature("cards")).toBe(false);
    expect(result.current.hasFeature("debts")).toBe(false);
    expect(result.current.hasFeature("budgets")).toBe(false);

    // Overview derivada: se todos os módulos do core financeiro estão bloqueados, overview é desativada
    expect(result.current.hasFeature("overview")).toBe(false);
  });

  it("permite overview quando ao menos um módulo financeiro está ativo", async () => {
    vi.mocked(accessRepo.getMyProfile).mockResolvedValue(mockProfile);
    vi.mocked(accessRepo.getMyFeatures).mockResolvedValue({
      transactions: true,
      overview: true,
    });
    vi.mocked(subscriptionsRepo.getMySubscription).mockResolvedValue({
      tier: "lifetime",
      canWrite: true,
      isFullAccess: true,
      moduleAccess: {
        transactions: "write",
        cards: "none",
        debts: "none",
        budgets: "none",
      },
    } as unknown as SubscriptionStatus);

    const { result } = renderHook(() => useUserAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasFeature("transactions")).toBe(true);
      expect(result.current.hasFeature("overview")).toBe(true);
    });
  });

  it("superadmin e admin têm acesso irrestrito independente de moduleAccess", async () => {
    vi.mocked(accessRepo.getMyProfile).mockResolvedValue({
      ...mockProfile,
      role: "admin",
    });
    vi.mocked(accessRepo.getMyFeatures).mockResolvedValue({});
    vi.mocked(subscriptionsRepo.getMySubscription).mockResolvedValue({
      tier: "lifetime",
      canWrite: true,
      isFullAccess: true,
      moduleAccess: {
        transactions: "none",
      },
    } as unknown as SubscriptionStatus);

    const { result } = renderHook(() => useUserAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.hasFeature("transactions")).toBe(true);
    expect(result.current.hasFeature("overview")).toBe(true);
  });

  it("respeita Kill-Switch global mesmo se o módulo tiver acesso na assinatura", async () => {
    vi.mocked(accessRepo.getMyProfile).mockResolvedValue(mockProfile);
    vi.mocked(accessRepo.getMyFeatures).mockResolvedValue({
      investments: false, // Kill-Switch ativo
    });
    vi.mocked(subscriptionsRepo.getMySubscription).mockResolvedValue({
      tier: "lifetime",
      canWrite: true,
      isFullAccess: true,
      moduleAccess: {
        investments: "write",
      },
    } as unknown as SubscriptionStatus);

    const { result } = renderHook(() => useUserAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasFeature("investments")).toBe(false);
  });

  it("aplica regra de Whitelist quando o usuário só tem investimentos (módulos não listados são bloqueados)", async () => {
    vi.mocked(accessRepo.getMyProfile).mockResolvedValue(mockProfile);
    vi.mocked(accessRepo.getMyFeatures).mockResolvedValue({
      transactions: true,
      cards: true,
      debts: true,
      budgets: true,
      investments: true,
      overview: true,
    });
    // Usuário possui apenas 'investments' no moduleAccess (restrição modular ativa)
    vi.mocked(subscriptionsRepo.getMySubscription).mockResolvedValue({
      tier: "lifetime",
      canWrite: true,
      isFullAccess: true,
      moduleAccess: {
        investments: "write",
      },
    } as unknown as SubscriptionStatus);

    const { result } = renderHook(() => useUserAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Módulo explicitamente concedido
    expect(result.current.hasFeature("investments")).toBe(true);

    // Módulos não concedidos devem ser BLOQUEADOS por Whitelist
    expect(result.current.hasFeature("transactions")).toBe(false);
    expect(result.current.hasFeature("cards")).toBe(false);
    expect(result.current.hasFeature("debts")).toBe(false);
    expect(result.current.hasFeature("budgets")).toBe(false);

    // Overview derivada também deve ser suprimida
    expect(result.current.hasFeature("overview")).toBe(false);
  });

  it("aplica Fail-Closed imediato no cold start quando o activeUserId for nulo", async () => {
    setActiveUserId(null);

    const { result } = renderHook(() => useUserAccess(), {
      wrapper: createWrapper(),
    });

    // Sem usuário ativo: queries desabilitadas e Fail-Closed rigoroso
    expect(result.current.profile).toBeNull();
    expect(result.current.hasFeature("overview")).toBe(false);
    expect(result.current.hasFeature("transactions")).toBe(false);
    expect(result.current.hasFeature("investments")).toBe(false);
    expect(accessRepo.getMyProfile).not.toHaveBeenCalled();
    expect(subscriptionsRepo.getMySubscription).not.toHaveBeenCalled();
  });

  it("aplica Fail-Closed para usuário comum quando a assinatura for nula", async () => {
    vi.mocked(accessRepo.getMyProfile).mockResolvedValue(mockProfile);
    vi.mocked(accessRepo.getMyFeatures).mockResolvedValue({
      transactions: true,
      investments: true,
    });
    vi.mocked(subscriptionsRepo.getMySubscription).mockResolvedValue(null);

    const { result } = renderHook(() => useUserAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Com subscription = null e usuário não-admin, Fail-Closed bloqueia todos os acessos
    expect(result.current.hasFeature("overview")).toBe(false);
    expect(result.current.hasFeature("transactions")).toBe(false);
    expect(result.current.hasFeature("investments")).toBe(false);
  });

  it("isolar chaves de query no formato [...KEY, userId]", () => {
    expect(userAccessQueryKey("user-123")).toEqual(["user_access", "user-123"]);
    expect(userFeaturesQueryKey("user-123")).toEqual(["user_features", "user-123"]);
    expect(userSubscriptionQueryKey("user-123")).toEqual(["user_subscription", "user-123"]);
    expect(userSubscriptionQueryKey(null)).toEqual(["user_subscription", null]);
    expect(USER_ACCESS_KEY).toEqual(["user_access"]);
    expect(USER_FEATURES_KEY).toEqual(["user_features"]);
    expect(USER_SUBSCRIPTION_KEY).toEqual(["user_subscription"]);
  });

  it("reestabelece acesso ao alternar de cold start (null) para sessão autenticada com usuário restrito", async () => {
    // 1. Inicia em cold start sem usuário
    setActiveUserId(null);

    const { result, rerender } = renderHook(() => useUserAccess(), {
      wrapper: createWrapper(),
    });

    expect(result.current.profile).toBeNull();
    expect(result.current.hasFeature("investments")).toBe(false);

    // 2. Simula resolução da autenticação (login / restauração de token)
    vi.mocked(accessRepo.getMyProfile).mockResolvedValue(mockProfile);
    vi.mocked(accessRepo.getMyFeatures).mockResolvedValue({
      investments: true,
      transactions: true,
    });
    vi.mocked(subscriptionsRepo.getMySubscription).mockResolvedValue({
      tier: "pro_monthly",
      canWrite: true,
      isFullAccess: false,
      moduleAccess: {
        investments: "write",
      },
    } as unknown as SubscriptionStatus);

    setActiveUserId("user-1");
    rerender();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.profile?.id).toBe("user-1");
    });

    // 3. Após resolver, módulo concedido funciona e core financeiro continua bloqueado por Whitelist
    expect(result.current.hasFeature("investments")).toBe(true);
    expect(result.current.hasFeature("transactions")).toBe(false);
    expect(result.current.hasFeature("overview")).toBe(false);
  });
});
