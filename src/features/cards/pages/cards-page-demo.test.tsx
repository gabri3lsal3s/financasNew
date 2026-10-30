import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { endDemo, resetDemoSession, startDemo } from "@/state/demo-mode";
import { CardsPage } from "./cards-page";

// Mock das queries e mutações auxiliares que não fazem parte do core de dados da fatura
vi.mock("@/state/queries/use-user-preferences", () => ({
  useUserPreferences: () => ({
    data: { custom_settings: { primaryCardId: null, cardOrder: [] } },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/state/queries/use-insight-feedback", () => ({
  useFeedback: () => ({ data: [], isLoading: false, isError: false }),
  useSetFeedback: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/state/queries/use-permission", () => ({
  usePermission: () => ({ isHidden: false, canRead: true, canWrite: true, isReadOnlyMode: false, accessLevel: "admin" }),
}));

vi.mock("@/state/queries/use-user-subscription", () => ({
  useUserSubscription: () => ({ canWrite: true, isReadOnly: false, tier: "pro_annual" }),
}));

vi.mock("@/state/mutations/use-card-mutations", () => ({
  useUpdateCard: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCardPayment: () => ({ mutate: vi.fn(), isPending: false }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/cartoes"]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CardsPage no Modo Demo / Tour Interativo (Fase 1)", () => {
  beforeEach(() => {
    resetDemoSession();
  });

  afterEach(() => {
    endDemo();
    resetDemoSession();
  });

  it("navega até /cartoes durante o tour e renderiza a carteira perfeitamente sem nenhuma caixa vermelha de erro", async () => {
    // 1. Inicia o tour interativo na trilha de finanças
    startDemo("finances");

    // 2. Renderiza a página de cartões
    render(<CardsPage />, { wrapper: createWrapper() });

    // 3. Valida que o cartão simulado Master Black Principal é renderizado
    await waitFor(() => {
      expect(screen.getByText("Mastercard Black Principal")).toBeInTheDocument();
    });

    // 4. Valida a presença do container alvo do tour com o seletor canônico
    const tourContainer = document.querySelector('[data-tour="cards-content"]');
    expect(tourContainer).toBeInTheDocument();

    // 5. Garante que NENHUM bloco de erro foi montado na tela
    expect(screen.queryByText(/Algo deu errado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tente novamente em instantes/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // 6. Valida que o card interativo e as métricas de fatura estão presentes
    const cardButton = screen.getByRole("button", { name: /Cartão Mastercard Black Principal/i });
    expect(cardButton).toBeInTheDocument();
    expect(cardButton).toHaveAttribute("aria-label", expect.stringContaining("fatura atual R$"));
    expect(cardButton).toHaveAttribute("aria-label", expect.stringContaining("disponível R$"));
    expect(screen.getByText("Sua Carteira")).toBeInTheDocument();
  });
});
