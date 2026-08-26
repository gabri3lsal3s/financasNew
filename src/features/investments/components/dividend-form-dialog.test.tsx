import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DividendFormDialog } from "./dividend-form-dialog";

const recordOrderMock = vi.fn();

vi.mock("@/state", () => ({
  usePortfolioAssets: () => ({
    data: [{ id: "a-1", ticker: "MXRF11", asset_class: "FIIs", currency: "BRL", quantity: 100, average_price: 10 }],
    isLoading: false,
  }),
  useRecordOrder: () => ({
    mutateAsync: recordOrderMock,
    isPending: false,
  }),
}));

describe("DividendFormDialog — Fase 39 Inteligência de Proventos", () => {
  it("renderiza o formulário de cadastro de provento", () => {
    render(<DividendFormDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Registrar Provento Recebido")).toBeInTheDocument();
    expect(screen.getByText("Tipo de Provento")).toBeInTheDocument();
    expect(screen.getByText("Creditar provento no saldo em caixa (corretora)")).toBeInTheDocument();
    expect(screen.getByText("Salvar Provento")).toBeInTheDocument();
  });

  it("permite alternar para 'Por Cota' e calcula o valor total automaticamente", async () => {
    recordOrderMock.mockResolvedValue({});
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

    expect(recordOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        asset: expect.objectContaining({ id: "a-1", ticker: "MXRF11" }),
        type: "dividend",
        total: 10,
        syncCash: true,
        notes: expect.stringContaining("R$ 0.10/cota x 100"),
      }),
    );
  });

  it("permite alternar para 'Extrato do Mês' e salva com o primeiro dia do mês", async () => {
    recordOrderMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<DividendFormDialog open={true} onOpenChange={vi.fn()} />);

    // Alterna para o modo Extrato do Mês
    await user.click(screen.getByRole("button", { name: "Extrato do Mes" }));

    // Digita o valor total de R$ 50,00 (5000 centavos)
    const amountInput = screen.getByLabelText("Valor do provento");
    await user.type(amountInput, "5000");

    // Salva o provento
    await user.click(screen.getByRole("button", { name: "Salvar Provento" }));

    expect(recordOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        asset: expect.objectContaining({ id: "a-1", ticker: "MXRF11" }),
        type: "dividend",
        date: expect.stringMatching(/^\d{4}-\d{2}-01$/),
        total: 50,
        syncCash: true,
        notes: expect.stringContaining("[MENSAL]"),
      }),
    );
  });
});

