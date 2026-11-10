import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DebtSimulatorPage } from "./debt-simulator-page";
import { RebalanceSimulatorPage } from "./rebalance-simulator-page";
import { CompoundInterestPage } from "./compound-interest-page";
import { ToolsHubPage } from "./tools-hub-page";
import {
  encodeCompoundInterestState,
  encodeDebtSimulatorState,
  encodeRebalanceSimulatorState,
  getPendingSimulation,
} from "@/domain/share";

function renderWithProviders(ui: React.ReactElement, initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("features/tools — Simuladores Financeiros Abertos & Stateful URLs", () => {
  const mockWriteText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWriteText },
      configurable: true,
      writable: true,
    });
  });

  describe("DebtSimulatorPage", () => {
    it("renderiza os KPIs e tabela de dívidas corretamente", () => {
      renderWithProviders(<DebtSimulatorPage />);

      expect(
        screen.getByRole("heading", {
          name: "Simulador de Quitação: Avalanche vs Bola de Neve",
        }),
      ).toBeInTheDocument();
      expect(screen.getByText("Suas Dívidas Cadastradas")).toBeInTheDocument();
      expect(screen.getByText("Economia com Avalanche")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Copiar Link da Simulação" }),
      ).toBeInTheDocument();
    });

    it("permite alternar entre Método Avalanche e Bola de Neve", () => {
      renderWithProviders(<DebtSimulatorPage />);

      const snowballBtn = screen.getByRole("button", { name: /Bola de Neve/i });
      fireEvent.click(snowballBtn);

      expect(
        screen.getByText(/Elimina primeiro as menores dívidas para obter vitórias psicológicas/i),
      ).toBeInTheDocument();
    });

    it("copia o link serializado com estado ao clicar em Copiar Link da Simulação", async () => {
      renderWithProviders(<DebtSimulatorPage />);

      const shareBtn = screen.getByRole("button", { name: "Copiar Link da Simulação" });
      fireEvent.click(shareBtn);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledTimes(1);
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringContaining("/ferramentas/simulador-dividas?s="),
        );
      });

      expect(screen.getByText("Link Copiado!")).toBeInTheDocument();
    });

    it("carrega estado customizado a partir de query string s e exibe badge de simulação compartilhada", () => {
      const customState = {
        debts: [
          {
            id: "custom-debt-1",
            name: "Financiamento Imobiliário",
            balanceCents: 25000000,
            monthlyRatePercent: 0.8,
            minPaymentCents: 210000,
          },
        ],
        extraBudgetCents: 150000,
        strategy: "avalanche" as const,
      };

      const token = encodeDebtSimulatorState(customState);

      renderWithProviders(<DebtSimulatorPage />, [`/ferramentas/simulador-dividas?s=${token}`]);

      expect(screen.getByText("Simulação Compartilhada")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Financiamento Imobiliário")).toBeInTheDocument();
    });

    it("armazena simulação de dívidas no storage ao clicar no CTA de conversão", () => {
      renderWithProviders(<DebtSimulatorPage />);

      expect(
        screen.getByRole("heading", {
          name: "Deseja monitorar suas finanças e metas com automação diária?",
        }),
      ).toBeInTheDocument();

      const ctaBtn = screen.getByRole("button", { name: "Criar Conta no Axir" });
      fireEvent.click(ctaBtn);

      const stored = getPendingSimulation();
      expect(stored).not.toBeNull();
      expect(stored?.type).toBe("debt_simulator");
      if (stored && stored.type === "debt_simulator") {
        expect(stored.debts.length).toBeGreaterThan(0);
      }
    });
  });

  describe("RebalanceSimulatorPage", () => {
    it("renderiza as classes modelo e recomendação pós-aporte", () => {
      renderWithProviders(<RebalanceSimulatorPage />);

      expect(
        screen.getByRole("heading", {
          name: "Simulador de Rebalanceamento Inteligente de Carteira",
        }),
      ).toBeInTheDocument();
      expect(screen.getByText("Recomendação de Compra do Próximo Aporte")).toBeInTheDocument();
      expect(screen.getByText("Foco em Proventos & Dividendos")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Copiar Link da Simulação" }),
      ).toBeInTheDocument();
    });

    it("permite alternar presets de estratégia", () => {
      renderWithProviders(<RebalanceSimulatorPage />);

      const globalPresetBtn = screen.getByRole("button", { name: "Global Multi-Mercado" });
      fireEvent.click(globalPresetBtn);

      expect(screen.getByDisplayValue("Ativos Globais / Dólar")).toBeInTheDocument();
    });

    it("copia o link de rebalanceamento com as classes serializadas", async () => {
      renderWithProviders(<RebalanceSimulatorPage />);

      const shareBtn = screen.getByRole("button", { name: "Copiar Link da Simulação" });
      fireEvent.click(shareBtn);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledTimes(1);
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringContaining("/ferramentas/rebalanceamento?s="),
        );
      });

      expect(screen.getByText("Link Copiado!")).toBeInTheDocument();
    });

    it("carrega alocação customizada a partir de query string s e exibe badge de simulação compartilhada", () => {
      const customRebalance = {
        patrimonyBaseCents: 15000000,
        aporteAmountCents: 400000,
        classes: [
          {
            key: "crypto",
            name: "Bitcoin & Criptoativos",
            targetPercent: 20,
            currentProportion: 0.1,
            yieldRate: 0,
          },
          {
            key: "rf",
            name: "Tesouro Selic",
            targetPercent: 80,
            currentProportion: 0.9,
            yieldRate: 0.1,
          },
        ],
        selectedPreset: "custom",
      };

      const token = encodeRebalanceSimulatorState(customRebalance);

      renderWithProviders(<RebalanceSimulatorPage />, [`/ferramentas/rebalanceamento?s=${token}`]);

      expect(screen.getByText("Simulação Compartilhada")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Bitcoin & Criptoativos")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Tesouro Selic")).toBeInTheDocument();
    });

    it("armazena simulação de rebalanceamento no storage ao clicar no CTA de conversão", () => {
      renderWithProviders(<RebalanceSimulatorPage />);

      const ctaBtn = screen.getByRole("button", { name: "Criar Conta no Axir" });
      fireEvent.click(ctaBtn);

      const stored = getPendingSimulation();
      expect(stored).not.toBeNull();
      expect(stored?.type).toBe("rebalance_simulator");
      if (stored && stored.type === "rebalance_simulator") {
        expect(stored.classes.length).toBeGreaterThan(0);
      }
    });
  });

  describe("CompoundInterestPage", () => {
    it("renderiza parâmetros, evolução e ponto de inflexão", () => {
      renderWithProviders(<CompoundInterestPage />);

      expect(
        screen.getByRole("heading", {
          name: "Simulador de Juros Compostos & Independência Financeira",
        }),
      ).toBeInTheDocument();
      expect(screen.getByText("Patrimônio Final Projetado")).toBeInTheDocument();
      expect(screen.getByText("Ponto de Inflexão")).toBeInTheDocument();
      expect(screen.getByText("Evolução Anual do Patrimônio")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Copiar Link da Simulação" }),
      ).toBeInTheDocument();
    });

    it("copia o link com estado do simulador de juros compostos", async () => {
      renderWithProviders(<CompoundInterestPage />);

      const shareBtn = screen.getByRole("button", { name: "Copiar Link da Simulação" });
      fireEvent.click(shareBtn);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledTimes(1);
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringContaining("/ferramentas/juros-compostos?s="),
        );
      });

      expect(screen.getByText("Link Copiado!")).toBeInTheDocument();
    });

    it("carrega simulação customizada via URL s e exibe badge de simulação compartilhada", () => {
      const customCompound = {
        initialAmountCents: 5000000,
        monthlyContributionCents: 300000,
        annualRatePercent: 12.0,
        periodYears: 15,
        monthlyLivingCostCents: 800000,
      };

      const token = encodeCompoundInterestState(customCompound);

      renderWithProviders(<CompoundInterestPage />, [`/ferramentas/juros-compostos?s=${token}`]);

      expect(screen.getByText("Simulação Compartilhada")).toBeInTheDocument();
    });

    it("armazena simulação de juros compostos no storage ao clicar no CTA de conversão", () => {
      renderWithProviders(<CompoundInterestPage />);

      const ctaBtn = screen.getByRole("button", { name: "Criar Conta no Axir" });
      fireEvent.click(ctaBtn);

      const stored = getPendingSimulation();
      expect(stored).not.toBeNull();
      expect(stored?.type).toBe("compound_interest");
      if (stored && stored.type === "compound_interest") {
        expect(stored.periodYears).toBeGreaterThan(0);
      }
    });
  });

  describe("ToolsHubPage", () => {
    it("lista os três simuladores com links de acesso", () => {
      renderWithProviders(<ToolsHubPage />);

      expect(
        screen.getByRole("heading", { name: "Simuladores Financeiros Gratuitos" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Simulador de Dívidas: Avalanche vs Bola de Neve" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Simulador de Rebalanceamento Inteligente" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          name: "Simulador de Juros Compostos & Independência Financeira",
        }),
      ).toBeInTheDocument();
    });
  });
});
