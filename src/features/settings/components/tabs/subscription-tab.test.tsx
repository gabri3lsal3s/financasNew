import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeMaxAnticipationMonths } from "../subscription/use-cumulative-renewal";
import { SubscriptionTab } from "./subscription-tab";
import type { SubscriptionStatus } from "@/types";

const mockSchedulePlanChange = vi.fn().mockResolvedValue({ ok: true, message: "Agendado" });

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
  useBillingContact: () => ({ data: null, isLoading: false }),
  useCancelSubscriptionMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateSubscriptionCardMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSchedulePlanChangeMutation: () => ({
    mutateAsync: mockSchedulePlanChange,
    isPending: false,
  }),
  useCancelScheduledPlanChangeMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCumulativeCheckoutMutation: () => ({
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

  it("calcula corretamente o teto de 11 meses em computeMaxAnticipationMonths", () => {
    const now = new Date("2026-05-01T12:00:00Z");
    expect(computeMaxAnticipationMonths(now.toISOString(), now)).toBe(11);
    expect(computeMaxAnticipationMonths("2026-11-01T12:00:00Z", now)).toBe(5);
    expect(computeMaxAnticipationMonths("2027-03-01T12:00:00Z", now)).toBe(0);
  });

  it("abre SwitchToAnnualModal para assinante mensal com cartão e agenda mudança para anual", async () => {
    const user = userEvent.setup();
    mockSubscription = {
      ...mockSubscription,
      tier: "pro_monthly",
      plan: "monthly",
      status: "active",
      isPro: true,
      isTrial: false,
      hasAutoRenew: true,
      hasCardRegistered: true,
      cardLast4: "4242",
      currentPeriodEnd: "2026-12-27T12:00:00Z",
    };

    renderSubscriptionTab();

    await user.click(screen.getByRole("button", { name: /Mudar para o Anual/i }));
    expect(screen.getByText(/Cobrança hoje: R\$ 0,00\./i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Agendar no Cartão/i }));
    expect(mockSchedulePlanChange).toHaveBeenCalledWith("annual");
  });

  it("exibe gatilho de migração para o anual durante trial_scheduled e agenda via modal", async () => {
    const user = userEvent.setup();
    mockSubscription = {
      ...mockSubscription,
      tier: "trial",
      plan: null,
      status: "trialing",
      billingPhase: "trial_scheduled",
      isTrial: true,
      isPro: false,
      hasAutoRenew: true,
      hasCardRegistered: true,
      cardLast4: "1989",
      scheduledPlanId: "pro_monthly",
      scheduledFirstChargeAt: "2026-12-27T12:00:00Z",
      trialEndsAt: "2026-12-27T12:00:00Z",
      billingStartAt: null,
    };

    renderSubscriptionTab();

    await user.click(screen.getByRole("button", { name: /Mudar para o Anual/i }));
    expect(screen.getByText(/mantendo seus 30 dias de teste gratuitos intactos/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Mudar Agendamento para Anual/i }));
    expect(mockSchedulePlanChange).toHaveBeenCalledWith("annual");
  });
});
