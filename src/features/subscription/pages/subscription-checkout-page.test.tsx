import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SubscriptionCheckoutPage } from "./subscription-checkout-page";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { user: { id: "user-123" } },
    loading: false,
    configError: null,
  }),
}));

vi.mock("@/state", () => ({
  useUserSubscription: () => ({
    isPro: false,
    plan: "free",
    status: "active",
  }),
  USER_SUBSCRIPTION_KEY: ["user-subscription"],
}));

function renderCheckout(initialRoute = "/assinatura?plano=pro-anual") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <SubscriptionCheckoutPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const createCheckoutSessionMock = vi.fn();

vi.mock("@/data/repositories/billing", () => ({
  createCheckoutSession: (...args: unknown[]) => createCheckoutSessionMock(...args),
}));

describe("SubscriptionCheckoutPage Component", () => {
  it("renderiza o resumo do plano anual e botões de pagamento", () => {
    renderCheckout();

    expect(screen.getByRole("heading", { name: "Plano Pro Anual" })).toBeInTheDocument();
    expect(screen.getByText("Forma de Pagamento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cartão de Crédito/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PIX Instantâneo/i })).toBeInTheDocument();
  });

  it("permite alternar para o método de pagamento PIX e exibe badge à vista", async () => {
    const user = userEvent.setup();
    renderCheckout();

    const pixButton = screen.getByRole("button", { name: /PIX Instantâneo/i });
    await user.click(pixButton);

    expect(screen.getByText(/PIX Anual com 25% OFF/i)).toBeInTheDocument();
    expect(screen.getByText(/Gerar QR Code PIX/i)).toBeInTheDocument();
  });

  it("inicia diretamente no método PIX via deep link (?metodo=pix)", () => {
    renderCheckout("/assinatura?plano=pro-anual&metodo=pix");

    expect(screen.getByText(/PIX Anual com 25% OFF/i)).toBeInTheDocument();
    expect(screen.getByText(/Gerar QR Code PIX/i)).toBeInTheDocument();
  });

  it("exibe alerta contextual de cancelamento quando redirecionado do gateway (?status=cancelado)", () => {
    renderCheckout("/assinatura?plano=pro-anual&status=cancelado");

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/O pagamento não foi concluído/i)).toBeInTheDocument();
  });

  it("permite ao usuário alternar de volta para cartão ou planos quando o PIX estiver ativo (sem prender o usuário)", async () => {
    createCheckoutSessionMock.mockResolvedValueOnce({
      method: "pix",
      qrCodeBase64: "dGVzdC1xcmNvZGU=",
      copyPasteKey: "00020126580014br.gov.bcb.pix...",
      expiresAt: "2026-10-16T12:00:00Z",
    });

    const user = userEvent.setup();
    renderCheckout("/assinatura?plano=pro-anual&metodo=pix");

    const cpfInput = screen.getByPlaceholderText("000.000.000-00");
    await user.type(cpfInput, "11144477735");

    const submitBtn = screen.getByRole("button", { name: /Gerar QR Code PIX/i });
    await user.click(submitBtn);

    // PIX gerado com sucesso
    expect(await screen.findByAltText("QR Code PIX")).toBeInTheDocument();
    expect(screen.getByText("Copiar Código PIX")).toBeInTheDocument();

    // Ações de desbloqueio para não prender o usuário
    const switchCardBtn = screen.getByRole("button", { name: /Pagar com cartão de crédito em vez de PIX/i });
    expect(switchCardBtn).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Voltar aos planos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ir para o painel/i })).toBeInTheDocument();

    // Alterna para cartão
    await user.click(switchCardBtn);
    expect(screen.getByPlaceholderText("Nome como impresso no cartão")).toBeInTheDocument();
  });

  it("possui botão de voltar ergonômico no cabeçalho", () => {
    renderCheckout();
    const backBtn = screen.getByRole("button", { name: /Voltar/i });
    expect(backBtn).toBeInTheDocument();
  });

  it("exibe validação em tempo real de CPF e detecção dinâmica de bandeira de cartão", async () => {
    const user = userEvent.setup();
    renderCheckout();

    // 1. Testa validação de CPF em tempo real
    const cpfInput = screen.getByPlaceholderText("000.000.000-00");
    await user.type(cpfInput, "11144477735"); // CPF válido
    expect(screen.getByText("CPF válido")).toBeInTheDocument();

    // 2. Testa detecção dinâmica de bandeira de cartão
    const cardInput = screen.getByPlaceholderText("0000 0000 0000 0000");
    await user.type(cardInput, "4111222233334444");
    expect(screen.getByText("Visa")).toBeInTheDocument();

    await user.clear(cardInput);
    await user.type(cardInput, "5500000000000000");
    expect(screen.getByText("Mastercard")).toBeInTheDocument();
  });

  it("redireciona para checkoutUrl quando o gateway retorna hosted_session (Stripe Checkout)", async () => {
    const originalLocation = window.location;
    const mockLocation = { ...originalLocation, href: "" };
    Object.defineProperty(window, "location", {
      value: mockLocation,
      writable: true,
      configurable: true,
    });

    createCheckoutSessionMock.mockResolvedValueOnce({
      ok: true,
      method: "hosted_session",
      provider: "stripe",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_session_456",
      sessionId: "cs_test_session_456",
    });

    const user = userEvent.setup();
    renderCheckout("/assinatura?plano=pro-anual");

    const cpfInput = screen.getByPlaceholderText("000.000.000-00");
    await user.type(cpfInput, "11144477735");

    const nameInput = screen.getByPlaceholderText("Nome como impresso no cartão");
    await user.type(nameInput, "CLIENTE STRIPE");

    const cardInput = screen.getByPlaceholderText("0000 0000 0000 0000");
    await user.type(cardInput, "4242424242424242");

    const expiryInput = screen.getByPlaceholderText("MM/AA");
    await user.type(expiryInput, "12/28");

    const cvvInput = screen.getByPlaceholderText("123");
    await user.type(cvvInput, "123");

    const submitBtn = screen.getByRole("button", { name: /Confirmar Assinatura Pro/i });
    await user.click(submitBtn);

    expect(mockLocation.href).toBe("https://checkout.stripe.com/c/pay/cs_test_session_456");

    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });
});

