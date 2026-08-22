import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DividendFormDialog } from "./dividend-form-dialog";

const createDividendMock = vi.fn();

vi.mock("@/state", () => ({
  usePortfolioAssets: () => ({
    data: [{ id: "a-1", ticker: "MXRF11", asset_class: "FIIs", currency: "BRL", quantity: 100, average_price: 10 }],
    isLoading: false,
  }),
  useCreatePortfolioDividend: () => ({
    mutateAsync: createDividendMock,
    isPending: false,
  }),
}));

describe("DividendFormDialog — Fase 39 Inteligência de Proventos", () => {
  it("renderiza o formulário de cadastro de provento", () => {
    render(<DividendFormDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Registrar Provento Recebido")).toBeInTheDocument();
    expect(screen.getByText("Tipo de Provento")).toBeInTheDocument();
    expect(screen.getByText("Salvar Provento")).toBeInTheDocument();
  });

  it("permite alternar para 'Por Cota' e calcula o valor total automaticamente", async () => {
    createDividendMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<DividendFormDialog open={true} onOpenChange={vi.fn()} />);

    // Clica no modo Por Cota
    await user.click(screen.getByRole("button", { name: "Por Cota (Unitário)" }));

    // Digita 10 centavos no valor por cota
    const perShareInput = screen.getByLabelText("Valor por cota");
    await user.type(perShareInput, "10"); // R$ 0,10

    // O total calculado para 100 cotas deve ser R$ 10,00
    expect(screen.getByText("R$ 10,00")).toBeInTheDocument();

    // Salva o provento
    await user.click(screen.getByRole("button", { name: "Salvar Provento" }));

    expect(createDividendMock).toHaveBeenCalledWith({
      asset_id: "a-1",
      date: expect.any(String),
      amount: 10,
      notes: expect.stringContaining("R$ 0.10/cota × 100"),
    });
  });
});
