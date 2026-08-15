import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MonthlyClosePrintView } from "./monthly-close-print-view";
import type { OverviewTotals } from "@/domain/overview";

const totals: OverviewTotals = {
  incomeCents: 500000,
  expenseCents: 300000,
  investmentCents: 0,
  balanceCents: 200000,
  savingsRatePercent: 40,
};

describe("MonthlyClosePrintView (F22)", () => {
  it("renderiza cabeçalho, KPIs e taxas com valores em centavos", () => {
    render(
      <MonthlyClosePrintView
        month="2026-08"
        totals={totals}
        expenseCount={5}
        incomeCount={2}
        categories={[
          { name: "Alimentação", totalCents: 180000, pct: 60 },
          { name: "Transporte", totalCents: 120000, pct: 40 },
        ]}
        paidInvoices={[]}
      />,
    );

    expect(screen.getByText("Finanças Pessoais")).toBeInTheDocument();
    expect(screen.getByText("Fechamento Mensal")).toBeInTheDocument();
    expect(screen.getByText("Rendas")).toBeInTheDocument();
    expect(screen.getByText("Despesas")).toBeInTheDocument();
    expect(screen.getByText("Saldo do mês")).toBeInTheDocument();
    expect(screen.getByText("Taxa de poupança")).toBeInTheDocument();
    expect(screen.getAllByText("40,0%")).toHaveLength(2); // KPI + Transporte
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
  });

  it("lista faturas quitadas com competência e data", () => {
    render(
      <MonthlyClosePrintView
        month="2026-08"
        totals={totals}
        expenseCount={0}
        incomeCount={0}
        categories={[]}
        paidInvoices={[
          { cardName: "Nubank", competenceMonth: "2026-07", amountCents: 45000, date: "2026-08-02" },
        ]}
      />,
    );

    expect(screen.getByText("Faturas quitadas")).toBeInTheDocument();
    expect(screen.getByText("Nubank")).toBeInTheDocument();
    expect(screen.getByText("2026-07")).toBeInTheDocument();
    expect(screen.getByText("02/08/2026")).toBeInTheDocument();
  });

  it("mostra estados vazios sem dados", () => {
    render(
      <MonthlyClosePrintView
        month="2026-08"
        totals={totals}
        expenseCount={0}
        incomeCount={0}
        categories={[]}
        paidInvoices={[]}
      />,
    );

    expect(screen.getByText("Nenhuma despesa registrada no mês.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum pagamento de fatura no mês.")).toBeInTheDocument();
  });

  it("marca o contêiner com a classe print-area", () => {
    const { container } = render(
      <MonthlyClosePrintView month="2026-08" totals={totals} expenseCount={0} incomeCount={0} categories={[]} paidInvoices={[]} />,
    );
    expect(container.querySelector(".print-area")).not.toBeNull();
  });
});
