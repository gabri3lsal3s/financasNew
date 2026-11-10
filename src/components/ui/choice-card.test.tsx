import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChoiceCard } from "./choice-card";
import { CreditCard } from "lucide-react";

describe("ChoiceCard — Cartão Canônico de Opção e Seleção (§4)", () => {
  it("renderiza título, descrição e badge corretamente", () => {
    render(
      <ChoiceCard
        title="Controlar cartões e faturas"
        description="Evite surpresas no fechamento e veja seu melhor dia de compra em tempo real."
        badge="Essencial"
        icon={<CreditCard data-testid="card-icon" />}
      />,
    );

    expect(screen.getByText("Controlar cartões e faturas")).toBeInTheDocument();
    expect(
      screen.getByText("Evite surpresas no fechamento e veja seu melhor dia de compra em tempo real."),
    ).toBeInTheDocument();
    expect(screen.getByText("Essencial")).toBeInTheDocument();
    expect(screen.getByTestId("card-icon")).toBeInTheDocument();
  });

  it("renderiza estado selecionado com aria-checked=true", () => {
    render(
      <ChoiceCard
        title="Quitar dívidas"
        selected={true}
      />,
    );

    const button = screen.getByRole("radio");
    expect(button).toHaveAttribute("aria-checked", "true");
  });

  it("aciona onClick ao clicar", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <ChoiceCard
        title="Opção Teste"
        onClick={handleClick}
      />,
    );

    await user.click(screen.getByRole("radio"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
