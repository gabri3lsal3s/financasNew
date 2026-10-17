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

  it("renderiza o card de Licença Modular Personalizada quando o usuário possui moduleAccess", () => {
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

    // Card de licença modular DEVE aparecer
    expect(screen.getByRole("heading", { name: /Licença Modular Personalizada/i })).toBeInTheDocument();
    expect(screen.getByText("Whitelist Ativa")).toBeInTheDocument();

    // Verifica badges dos módulos concedidos e bloqueados
    expect(screen.getByText("Investimentos & Carteira")).toBeInTheDocument();
    expect(screen.getByText("Acesso Total")).toBeInTheDocument();
    expect(screen.getByText("Somente Leitura")).toBeInTheDocument();

    // Módulos omitidos na Whitelist ou com 'none' devem estar com badge Bloqueado
    const blockedBadges = screen.getAllByText("Bloqueado");
    expect(blockedBadges.length).toBeGreaterThan(0);
  });

  it("não renderiza o card de Licença Modular Personalizada quando moduleAccess for vazio", () => {
    mockSubscription = {
      ...mockSubscription,
      moduleAccess: {},
    };

    renderSubscriptionTab();

    expect(screen.queryByText(/Licença Modular Personalizada/i)).not.toBeInTheDocument();
  });
});
