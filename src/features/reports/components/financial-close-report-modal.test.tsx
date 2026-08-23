import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FinancialCloseReportModal } from "./financial-close-report-modal";

describe("FinancialCloseReportModal (F42)", () => {
  const mockDRE = {
    grossIncomeCents: 1000000,
    totalExpensesCents: 600000,
    operationalSavingsCents: 400000,
    savingsRatePct: 40.0,
    investedAporteCents: 200000,
    netCashFlowCents: 200000,
  };

  const mockCategories = [
    { name: "Alimentação", totalCents: 300000, pct: 50.0 },
    { name: "Moradia", totalCents: 300000, pct: 50.0 },
  ];

  const mockPaymentMethods = [
    { method: "credit", label: "Cartão de Crédito", totalCents: 400000, pct: 66.7 },
    { method: "pix", label: "Pix", totalCents: 200000, pct: 33.3 },
  ];

  it("renderiza os KPIs e a estrutura contábil da DRE", () => {
    render(
      <FinancialCloseReportModal
        open={true}
        onOpenChange={vi.fn()}
        periodLabel="Agosto de 2026"
        dre={mockDRE}
        categories={mockCategories}
        paymentMethods={mockPaymentMethods}
        expenseCount={10}
        incomeCount={2}
      />,
    );

    expect(screen.getByText("Relatório Executivo de Finanças Pessoais & DRE")).toBeInTheDocument();
    expect(screen.getAllByText("Agosto de 2026")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Receitas Totais")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Despesas Totais")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Resultado Operacional")[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Alimentação/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Cartão de Crédito/)[0]).toBeInTheDocument();
  });

  it("dispara window.print ao clicar no botão de impressão", () => {
    vi.useFakeTimers();
    const printSpy = vi.fn();
    const originalPrint = window.print;
    window.print = printSpy;

    render(
      <FinancialCloseReportModal
        open={true}
        onOpenChange={vi.fn()}
        periodLabel="Agosto de 2026"
        dre={mockDRE}
        categories={mockCategories}
        paymentMethods={mockPaymentMethods}
        expenseCount={10}
        incomeCount={2}
      />,
    );

    const printButton = screen.getByRole("button", { name: /Imprimir \/ Salvar PDF/i });
    fireEvent.click(printButton);

    vi.advanceTimersByTime(150);
    expect(printSpy).toHaveBeenCalled();

    window.print = originalPrint;
    vi.useRealTimers();
  });
});

