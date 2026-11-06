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

    expect(screen.getAllByText("Relatório Executivo de Finanças Pessoais & DRE")[0]).toBeInTheDocument();
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

  it("renderiza valores nominais e de consulta ponderados quando houver diferença", () => {
    const mockWeightedDRE = {
      grossIncomeCents: 800000,
      totalExpensesCents: 400000,
      operationalSavingsCents: 400000,
      savingsRatePct: 50.0,
      investedAporteCents: 100000,
      netCashFlowCents: 300000,
      grossIncomeBrutoCents: 1000000,
      totalExpensesBrutoCents: 500000,
    };


    render(
      <FinancialCloseReportModal
        open={true}
        onOpenChange={vi.fn()}
        periodLabel="Agosto de 2026"
        dre={mockWeightedDRE}
        categories={mockCategories}
        paymentMethods={mockPaymentMethods}
        expenseCount={10}
        incomeCount={2}
        showWeightedNote={true}
      />,
    );

    // Confere se aparecem as indicações de valor ponderado para consulta
    expect(screen.getAllByText(/ponderado:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/O valor principal exibido é o valor bruto nominal/i).length).toBeGreaterThan(0);
  });

  it("renderiza o relatório em período anual com discriminação de faturas pagas e cascata contábil", () => {
    const mockPaidInvoices = [
      { cardName: "Nubank Ultravioleta", competenceMonth: "2026-07", amountCents: 150000, date: "2026-08-10" },
      { cardName: "Itaú Personnalité", competenceMonth: "2026-08", amountCents: 250000, date: "2026-08-20" },
    ];

    render(
      <FinancialCloseReportModal
        open={true}
        onOpenChange={vi.fn()}
        periodLabel="Exercício de 2026"
        dre={mockDRE}
        categories={mockCategories}
        paymentMethods={mockPaymentMethods}
        paidInvoices={mockPaidInvoices}
        expenseCount={50}
        incomeCount={12}
      />,
    );

    expect(screen.getAllByText("Exercício de 2026")[0]).toBeInTheDocument();
    expect(screen.getAllByText("FATURAS DE CARTÃO QUITADAS NO PERÍODO").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nubank Ultravioleta").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Itaú Personnalité").length).toBeGreaterThan(0);
  });

  it("renderiza colunas de Orçado e Desvio quando categorias possuem budgetLimitCents", () => {
    const categoriesWithBudget = [
      { name: "Alimentação", totalCents: 350000, pct: 70.0, budgetLimitCents: 300000, variancePct: 17 },
      { name: "Transporte", totalCents: 150000, pct: 30.0, budgetLimitCents: 200000, variancePct: -25 },
    ];

    render(
      <FinancialCloseReportModal
        open={true}
        onOpenChange={vi.fn()}
        periodLabel="Agosto de 2026"
        dre={mockDRE}
        categories={categoriesWithBudget}
        paymentMethods={mockPaymentMethods}
        expenseCount={10}
        incomeCount={2}
      />,
    );

    expect(screen.getAllByText("Orçado")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Desvio")[0]).toBeInTheDocument();
    expect(screen.getAllByText("+17%")[0]).toBeInTheDocument();
    expect(screen.getAllByText("-25%")[0]).toBeInTheDocument();
  });

  it("renderiza seção de Consolidação Residencial quando householdSummary for fornecido", () => {
    const householdSummary = {
      familyTitle: "Família Silva",
      monthlyCeilingCents: 800000,
      totalSpentCents: 750000,
      spentPercentage: 94,
      userContributionCents: 450000,
      userPercentageOfTotal: 60.0,
    };

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
        householdSummary={householdSummary}
      />,
    );

    expect(screen.getAllByText(/CONSOLIDAÇÃO RESIDENCIAL/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText("Teto Familiar")[0]).toBeInTheDocument();
    expect(screen.getAllByText("94%")[0]).toBeInTheDocument();
    expect(screen.getAllByText("(60,0%)")[0]).toBeInTheDocument();
  });
});



