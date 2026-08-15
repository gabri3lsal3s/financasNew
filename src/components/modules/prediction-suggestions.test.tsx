import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PredictionSuggestions } from "./prediction-suggestions";

const suggestions = [
  {
    categoryId: "c-mercado",
    categoryName: "Mercado",
    paymentMethod: "credit_card",
    cardId: "card-nubank",
    receiveType: null,
    value: 320,
    confidence: 0.9,
  },
  {
    categoryId: "c-transporte",
    categoryName: "Transporte",
    paymentMethod: "pix",
    cardId: null,
    receiveType: null,
    value: 24.5,
    confidence: 0.6,
  },
];

describe("PredictionSuggestions — autopreenchimento (F21)", () => {
  it("não renderiza nada sem sugestões", () => {
    const { container } = render(<PredictionSuggestions suggestions={[]} onApply={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lista as sugestões com categoria, contexto e valor", () => {
    render(
      <PredictionSuggestions
        suggestions={suggestions}
        paymentLabels={{ credit_card: "Cartão de crédito", pix: "Pix" }}
        cardLabels={{ "card-nubank": "Nubank" }}
        onApply={vi.fn()}
      />,
    );
    expect(screen.getByRole("listbox", { name: /sugestões preditivas/i })).toBeInTheDocument();
    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(screen.getByText("Cartão de crédito · Nubank")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
    expect(screen.getByText("Pix")).toBeInTheDocument();
    expect(screen.getByText("R$ 320,00")).toBeInTheDocument();
  });

  it("aplica a sugestão com 1 toque", async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<PredictionSuggestions suggestions={suggestions} onApply={onApply} />);

    await user.click(screen.getByRole("option", { name: /Mercado/ }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(suggestions[0]);
  });

  it("usa o label de recebimento quando é receita", () => {
    render(
      <PredictionSuggestions
        suggestions={[
          {
            categoryId: "c-salario",
            categoryName: "Salário",
            paymentMethod: null,
            cardId: null,
            receiveType: "pix",
            value: 5000,
            confidence: 0.95,
          },
        ]}
        receiveLabels={{ pix: "Pix" }}
        onApply={vi.fn()}
      />,
    );
    expect(screen.getByText("Pix")).toBeInTheDocument();
  });
});
