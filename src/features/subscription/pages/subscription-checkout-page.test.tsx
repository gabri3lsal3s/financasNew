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
});
