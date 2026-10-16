import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import { SubscriptionSuccessPage } from "./subscription-success-page";

describe("SubscriptionSuccessPage Component", () => {
  it("renderiza a tela de sucesso para o Plano Pro Anual por padrão", () => {
    render(
      <MemoryRouter initialEntries={["/assinatura/sucesso?plano=pro-anual&metodo=pix"]}>
        <SubscriptionSuccessPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /Pagamento Confirmado/i })).toBeInTheDocument();
    expect(screen.getAllByText("Plano Pro Anual").length).toBeGreaterThan(0);
    expect(screen.getByText("PIX Instantâneo")).toBeInTheDocument();
    expect(screen.getByText("Economia de 25%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Acessar Painel Financeiro/i })).toBeInTheDocument();
  });

  it("renderiza a tela de sucesso para o Plano Pro Mensal via Cartão", () => {
    render(
      <MemoryRouter initialEntries={["/assinatura/sucesso?plano=pro-mensal&metodo=cartao"]}>
        <SubscriptionSuccessPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /Pagamento Confirmado/i })).toBeInTheDocument();
    expect(screen.getAllByText("Plano Pro Mensal").length).toBeGreaterThan(0);
    expect(screen.getByText("Cartão de Crédito")).toBeInTheDocument();
    expect(screen.getByText("Mensal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Acessar Painel Financeiro/i })).toBeInTheDocument();
  });

  it("exibe a lista de recursos exclusivos liberados", () => {
    render(
      <MemoryRouter initialEntries={["/assinatura/sucesso"]}>
        <SubscriptionSuccessPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Lançamentos e Histórico Ilimitados")).toBeInTheDocument();
    expect(screen.getByText("Multi-Cartões e Parcelamento até 60x")).toBeInTheDocument();
    expect(screen.getByText("Motor de Rebalanceamento Determinístico")).toBeInTheDocument();
    expect(screen.getByText("Radar Fiscal IR e Dossiê Executivo")).toBeInTheDocument();
  });
});
