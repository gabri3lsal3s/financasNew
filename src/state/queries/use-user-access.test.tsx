import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserAccess } from "./use-user-access";
import * as accessRepo from "@/data/repositories/access";
import * as subscriptionsRepo from "@/data/repositories/subscriptions";
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
    });

    expect(result.current.hasFeature("transactions")).toBe(true);
    expect(result.current.hasFeature("overview")).toBe(true);
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
});
