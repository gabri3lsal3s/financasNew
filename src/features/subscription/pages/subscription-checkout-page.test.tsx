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
});
