import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DividendFormDialog } from "./dividend-form-dialog";

vi.mock("@/state", () => ({
  usePortfolioAssets: () => ({
    data: [{ id: "a-1", ticker: "MXRF11", asset_class: "FIIs", currency: "BRL", quantity: 100, average_price: 10 }],
    isLoading: false,
  }),
  useCreatePortfolioDividend: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe("DividendFormDialog — Fase 36", () => {
  it("renderiza o formulário de cadastro de provento", () => {
    render(<DividendFormDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Registrar Provento Recebido")).toBeInTheDocument();
    expect(screen.getByText("Tipo de Provento")).toBeInTheDocument();
    expect(screen.getByText("Salvar Provento")).toBeInTheDocument();
  });
});
