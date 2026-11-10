import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionTab } from "./subscription-tab";
import type { SubscriptionStatus } from "@/types";

let mockSubscription: SubscriptionStatus = {
  tier: "trial",
  trialDaysRemaining: 15,
  trialEndsAt: "2026-11-01T00:00:00Z",
  currentPeriodEnd: null,
  plan: null,
  cancelAtPeriodEnd: false,
  isFullAccess: true,
  isTrial: true,
  isPro: false,
  isLifetime: false,
  isReadOnly: false,
  canWrite: true,
};

vi.mock("@/state", () => ({
  useUserSubscription: () => mockSubscription,
  useCancelSubscriptionMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateSubscriptionCardMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpgradeToAnnualMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/data/repositories/billing", () => ({
  cancelSubscription: vi.fn().mockResolvedValue(undefined),
  updateSubscriptionCreditCard: vi.fn().mockResolvedValue(undefined),
  fetchInvoices: vi.fn().mockResolvedValue([]),
}));

function renderSubscriptionTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SubscriptionTab />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SubscriptionTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscription = {
      tier: "trial",
      trialDaysRemaining: 15,
      trialEndsAt: "2026-11-01T00:00:00Z",
      currentPeriodEnd: null,
      plan: null,
      cancelAtPeriodEnd: false,
      isFullAccess: true,
      isTrial: true,
      isPro: false,
      isLifetime: false,
      isReadOnly: false,
      canWrite: true,
    };
  });

  it("renderiza o card de Plano Atual e a tabela comparativa por padrão", () => {
    renderSubscriptionTab();

    expect(screen.getByRole("heading", { name: /Plano Atual/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Comparativo de Planos/i })).toBeInTheDocument();
    // Card de licença modular NÃO deve aparecer quando não há moduleAccess
    expect(screen.queryByText(/Licença Modular Personalizada/i)).not.toBeInTheDocument();
  });

  it("não renderiza o card de Licença Modular Personalizada para o usuário comum mesmo quando houver moduleAccess", () => {
    mockSubscription = {
      ...mockSubscription,
      tier: "lifetime",
      isLifetime: true,
      moduleAccess: {
        investments: "write",
        reports: "read",
        cards: "none",
      },
    };

    renderSubscriptionTab();

    expect(screen.queryByText(/Licença Modular Personalizada/i)).not.toBeInTheDocument();
  });

  it("não renderiza o card de Licença Modular Personalizada quando moduleAccess for vazio", () => {
    mockSubscription = {
      ...mockSubscription,
      moduleAccess: {},
    };

    renderSubscriptionTab();

    expect(screen.queryByText(/Licença Modular Personalizada/i)).not.toBeInTheDocument();
  });

  it("exibe informações de cobrança automática e cartão quando hasAutoRenew for true", () => {
    mockSubscription = {
      ...mockSubscription,
      tier: "pro_annual",
      plan: "annual",
      isPro: true,
      hasAutoRenew: true,
      hasCardRegistered: true,
      cardLast4: "4242",
      cardBrand: "Mastercard",
    };

    renderSubscriptionTab();

    expect(screen.getByText(/Cobrança Automática Ativa/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Cartão de Crédito [rR]ecorrente/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /Alterar Cartão/i })).toBeInTheDocument();
  });
});
