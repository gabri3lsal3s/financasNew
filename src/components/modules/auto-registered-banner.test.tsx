import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dismissAutoRegisteredBanner,
  getAutoRegisteredBanner,
  revertAutoRegisteredTransaction,
  setAutoRegisteredBanner,
  type AutoRegisteredTransaction,
} from "@/services/native";
import { AutoRegisteredBanner } from "./auto-registered-banner";

vi.mock("@/services/native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/native")>();
  return {
    ...actual,
    revertAutoRegisteredTransaction: vi.fn(),
  };
});

vi.mock("@/features/transactions/components/expense-detail-dialog", () => ({
  ExpenseDetailDialog: ({ open, expense }: { open: boolean; expense: unknown }) =>
    open ? <div data-testid="mock-expense-dialog">Dialog Aberto: {JSON.stringify(expense)}</div> : null,
}));

vi.mock("@/features/transactions/components/income-detail-dialog", () => ({
  IncomeDetailDialog: ({ open, income }: { open: boolean; income: unknown }) =>
    open ? <div data-testid="mock-income-dialog">Dialog Renda Aberto: {JSON.stringify(income)}</div> : null,
}));

describe("AutoRegisteredBanner (§1.6)", () => {
  const mockItem: AutoRegisteredTransaction = {
    id: "exp_123",
    type: "expense",
    amountCents: 4500,
    description: "Pix para Padaria Silva",
    merchant: "Padaria Silva",
    date: "2026-10-21",
    categoryId: "cat_1",
    categoryName: "Alimentação",
    paymentMethod: "pix",
    parsed: {
      id: "pix_123",
      bankName: "Nubank",
      nature: "expense",
      type: "expense",
      amountCents: 4500,
      description: "Pix para Padaria Silva",
      merchant: "Padaria Silva",
      date: "2026-10-21",
      paymentMethod: "pix",
      rawText: "Comprovante Pix Nubank",
      timestamp: Date.now(),
    },
    registeredAt: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dismissAutoRegisteredBanner();
  });

  it("não renderiza nada quando não há transação auto-cadastrada", () => {
    const { container } = render(<AutoRegisteredBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza aviso persistente com valor, favorecido e botões de ação", () => {
    setAutoRegisteredBanner(mockItem);

    render(<AutoRegisteredBanner />);

    expect(
      screen.getByText(/Pix de R\$\s*45,00 para Padaria Silva cadastrado!/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Editar Lançamento/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Desfazer/i })).toBeInTheDocument();
  });

  it("ao clicar em Desfazer, dispara a reversão da transação", () => {
    setAutoRegisteredBanner(mockItem);

    render(<AutoRegisteredBanner />);

    const undoButton = screen.getByRole("button", { name: /Desfazer/i });
    fireEvent.click(undoButton);

    expect(revertAutoRegisteredTransaction).toHaveBeenCalledWith(mockItem);
  });

  it("ao clicar em Editar Lançamento, abre o diálogo com os campos pré-carregados", () => {
    setAutoRegisteredBanner(mockItem);

    render(<AutoRegisteredBanner />);

    expect(screen.queryByTestId("mock-expense-dialog")).not.toBeInTheDocument();

    const editButton = screen.getByRole("button", { name: /Editar Lançamento/i });
    fireEvent.click(editButton);

    expect(screen.getByTestId("mock-expense-dialog")).toBeInTheDocument();
    expect(screen.getByText(/exp_123/)).toBeInTheDocument();
  });

  it("ao clicar no botão fechar (X), descarta o banner", () => {
    setAutoRegisteredBanner(mockItem);

    render(<AutoRegisteredBanner />);

    const closeButton = screen.getByRole("button", { name: "Fechar aviso de lançamento" });
    fireEvent.click(closeButton);

    expect(getAutoRegisteredBanner()).toBeNull();
  });
});
