import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RebalanceSimulatorPage } from "./rebalance-simulator-page";

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RebalanceSimulatorPage", () => {
  it("renderiza a página com presets unificados e opções de estratégia", () => {
    renderWithProviders(<RebalanceSimulatorPage />);

    expect(
      screen.getByRole("heading", { name: /Simulador de Rebalanceamento Inteligente de Carteira/i }),
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Foco em Proventos & Dividendos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Global Multi-Mercado/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Crescimento & Longo Prazo/i })).toBeInTheDocument();
  });

  it("permite trocar de preset e recalcular as classes", () => {
    renderWithProviders(<RebalanceSimulatorPage />);

    const multimercadoBtn = screen.getByRole("button", { name: /Global Multi-Mercado/i });
    fireEvent.click(multimercadoBtn);

    // Deve conter classes do modelo multimercado (ex: Ativos Globais / Dólar)
    expect(screen.getByDisplayValue(/Ativos Globais \/ Dólar/i)).toBeInTheDocument();
  });

  it("exibe ativos com Notas (0 a 10) por classe e distribui o aporte recomendado via deriveAssetWeightsFromScores (§Plano 42)", () => {
    renderWithProviders(<RebalanceSimulatorPage />);

    expect(screen.getByText(/Ativos & Notas \(0 a 10\) dentro de Fundos Imobiliários/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("HGLG11")).toBeInTheDocument();
    expect(screen.getByDisplayValue("MXRF11")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Adicionar ativo/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("HGLG11").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nota 9").length).toBeGreaterThan(0);
  });
});
