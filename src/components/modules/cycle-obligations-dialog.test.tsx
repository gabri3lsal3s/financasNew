import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CycleObligationsDialog } from "./cycle-obligations-dialog";
import type { CycleObligationsBreakdown } from "@/domain/cash";

const navigateMock = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const mockBreakdown: CycleObligationsBreakdown = {
  invoices: [
    {
      cardId: "c1",
      cardName: "Nubank Ultravioleta",
      cardColor: "#8A05BE",
      competenceMonth: "2026-11",
      dueDate: "2026-11-15",
      saldoCents: 150000,
    },
  ],
  openInvoicesCents: 150000,
  payableDebts: [
    {
      id: "d1",
      name: "Internet Fibra",
      dueDate: "2026-10-25",
      amountCents: 12000,
      isOverdue: true,
      type: "payable",
    },
    {
      id: "d2",
      name: "Aluguel",
      dueDate: "2026-11-10",
      amountCents: 100000,
      isOverdue: false,
      type: "payable",
    },
  ],
  payableDebtsCents: 112000,
  committedObligationsCents: 262000,
  receivableDebts: [
    {
      id: "r1",
      name: "Reembolso",
      dueDate: "2026-11-20",
      amountCents: 5000,
      isOverdue: false,
      type: "receivable",
    },
  ],
  receivablePendingCents: 5000,
  futureDebts: {
    count: 3,
    totalCents: 150000,
  },
};

describe("CycleObligationsDialog", () => {
  it("renderiza faturas, contas a pagar e aviso de dívidas futuras com precisão", () => {
    const onOpenChange = vi.fn();

    render(
      <CycleObligationsDialog
        open={true}
        onOpenChange={onOpenChange}
        breakdown={mockBreakdown}
      />,
    );

    expect(screen.getByText("Obrigações do Ciclo Atual")).toBeInTheDocument();
    expect(screen.getByText("Total Comprometido no Ciclo")).toBeInTheDocument();

    // Faturas
    expect(screen.getByText("Nubank Ultravioleta")).toBeInTheDocument();
    expect(screen.getByText(/Vence em 15\/11\/2026/)).toBeInTheDocument();

    // Contas
    expect(screen.getByText("Internet Fibra")).toBeInTheDocument();
    expect(screen.getByText("Atrasada")).toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
    expect(screen.getByText("No prazo")).toBeInTheDocument();

    // Recebíveis
    expect(screen.getByText("Reembolso")).toBeInTheDocument();

    // Dívidas futuras
    expect(screen.getByText("Visão de Médio e Longo Prazo")).toBeInTheDocument();
    expect(screen.getByText(/3 parcela\(s\)\/dívida\(s\) futura\(s\)/)).toBeInTheDocument();
  });

  it("fecha o modal ao clicar no botão Fechar", () => {
    const onOpenChange = vi.fn();

    render(
      <CycleObligationsDialog
        open={true}
        onOpenChange={onOpenChange}
        breakdown={mockBreakdown}
      />,
    );

    const closeButtons = screen.getAllByRole("button", { name: "Fechar" });
    fireEvent.click(closeButtons[0]!);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
