import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import { DebtSimulatorPage } from "./debt-simulator-page";
import { RebalanceSimulatorPage } from "./rebalance-simulator-page";
import { CompoundInterestPage } from "./compound-interest-page";
import { ToolsHubPage } from "./tools-hub-page";

describe("features/tools — Simuladores Financeiros Abertos", () => {
  describe("DebtSimulatorPage", () => {
    it("renderiza os KPIs e tabela de dívidas corretamente", () => {
      render(
        <MemoryRouter>
          <DebtSimulatorPage />
        </MemoryRouter>,
      );

      expect(
        screen.getByRole("heading", {
          name: "Simulador de Quitação: Avalanche vs Bola de Neve",
        }),
      ).toBeInTheDocument();
      expect(screen.getByText("Suas Dívidas Cadastradas")).toBeInTheDocument();
      expect(screen.getByText("Economia com Avalanche")).toBeInTheDocument();
    });

    it("permite alternar entre Método Avalanche e Bola de Neve", () => {
      render(
        <MemoryRouter>
          <DebtSimulatorPage />
        </MemoryRouter>,
      );

      const snowballBtn = screen.getByRole("button", { name: /Bola de Neve/i });
      fireEvent.click(snowballBtn);

      expect(
        screen.getByText(/Elimina primeiro as menores dívidas para obter vitórias psicológicas/i),
      ).toBeInTheDocument();
    });
  });

  describe("RebalanceSimulatorPage", () => {
    it("renderiza as classes modelo e recomendação pós-aporte", () => {
      render(
        <MemoryRouter>
          <RebalanceSimulatorPage />
        </MemoryRouter>,
      );

      expect(
        screen.getByRole("heading", {
          name: "Simulador de Rebalanceamento Inteligente de Carteira",
        }),
      ).toBeInTheDocument();
      expect(screen.getByText("Recomendação de Compra do Próximo Aporte")).toBeInTheDocument();
      expect(screen.getByText("Foco em Proventos & Dividendos")).toBeInTheDocument();
    });

    it("permite alternar presets de estratégia", () => {
      render(
        <MemoryRouter>
          <RebalanceSimulatorPage />
        </MemoryRouter>,
      );

      const globalPresetBtn = screen.getByRole("button", { name: "Global Multi-Mercado" });
      fireEvent.click(globalPresetBtn);

      expect(screen.getByDisplayValue("Ativos Globais / Dólar")).toBeInTheDocument();
    });
  });

  describe("CompoundInterestPage", () => {
    it("renderiza parâmetros, evolução e ponto de inflexão", () => {
      render(
        <MemoryRouter>
          <CompoundInterestPage />
        </MemoryRouter>,
      );

      expect(
        screen.getByRole("heading", {
          name: "Simulador de Juros Compostos & Independência Financeira",
        }),
      ).toBeInTheDocument();
      expect(screen.getByText("Patrimônio Final Projetado")).toBeInTheDocument();
      expect(screen.getByText("Ponto de Inflexão")).toBeInTheDocument();
      expect(screen.getByText("Evolução Anual do Patrimônio")).toBeInTheDocument();
    });
  });

  describe("ToolsHubPage", () => {
    it("lista os três simuladores com links de acesso", () => {
      render(
        <MemoryRouter>
          <ToolsHubPage />
        </MemoryRouter>,
      );

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
