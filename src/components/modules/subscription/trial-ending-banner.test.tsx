import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BrowserRouter } from "react-router";
import { TrialEndingBanner } from "./trial-ending-banner";

describe("TrialEndingBanner component", () => {
  it("renderiza mensagem para 5 dias restantes", () => {
    render(
      <BrowserRouter>
        <TrialEndingBanner daysRemaining={5} />
      </BrowserRouter>,
    );

    expect(screen.getByText("Seu período de teste Pro encerra em 5 dias")).toBeInTheDocument();
    expect(screen.getByText("5d restantes")).toBeInTheDocument();
  });

  it("renderiza mensagem para 1 dia restante (amanhã)", () => {
    render(
      <BrowserRouter>
        <TrialEndingBanner daysRemaining={1} />
      </BrowserRouter>,
    );

    expect(screen.getByText("Seu período de teste Pro encerra amanhã")).toBeInTheDocument();
    expect(screen.getByText("1d restantes")).toBeInTheDocument();
  });

  it("renderiza mensagem para 0 dias restantes (último dia)", () => {
    render(
      <BrowserRouter>
        <TrialEndingBanner daysRemaining={0} />
      </BrowserRouter>,
    );

    expect(screen.getByText("Seu período de teste Pro encerra hoje")).toBeInTheDocument();
    expect(screen.getByText("Último dia")).toBeInTheDocument();
  });

  it("dispara callback onActivatePro ao clicar no botão", () => {
    const handleActivate = vi.fn();
    render(
      <BrowserRouter>
        <TrialEndingBanner daysRemaining={3} onActivatePro={handleActivate} />
      </BrowserRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Ativar Plano Pro/i }));
    expect(handleActivate).toHaveBeenCalledTimes(1);
  });
});
