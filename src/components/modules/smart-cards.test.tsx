import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SmartSpendingPaceCard } from "./smart-spending-pace-card";
import { SmartInvoiceProjectionCard } from "./smart-invoice-projection-card";
import { SmartAnomaliesCard } from "./smart-anomalies-card";
import { SavingsHealthCard } from "./savings-health-card";
import type { InsightAlert } from "@/domain/insights";

describe("SmartSpendingPaceCard (F8)", () => {
  it("mostra o ritmo ativo e o gasto disponível diário", () => {
    render(
      <SmartSpendingPaceCard
        pace={{ active: true, spentPercent: 42, elapsedPercent: 30, gapPoints: 12, ahead: true }}
        dailyCents={15000}
      />,
    );
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText(/Acima do ritmo esperado/)).toBeInTheDocument();
    expect(screen.getByText("R$ 150,00")).toBeInTheDocument();
  });

  it("explica que o ritmo ativa a partir do 8º dia quando inativo", () => {
    render(<SmartSpendingPaceCard pace={null} dailyCents={null} />);
    expect(screen.getByText(/Acompanhamento ativo a partir do 8º dia/)).toBeInTheDocument();
  });
});

describe("SmartInvoiceProjectionCard (F8)", () => {
  it("mostra total, quantidade e próximo vencimento", () => {
    render(
      <SmartInvoiceProjectionCard openInvoicesCents={60000} openCount={2} nearestDueDate="2026-08-20" />,
    );
    expect(screen.getByText("R$ 600,00")).toBeInTheDocument();
    expect(screen.getByText(/2 cartões com saldo/)).toBeInTheDocument();
    expect(screen.getByText("20/08/2026")).toBeInTheDocument();
  });

  it("estado vazio sem faturas", () => {
    render(<SmartInvoiceProjectionCard openInvoicesCents={0} openCount={0} nearestDueDate={null} />);
    expect(screen.getByText(/Nenhuma fatura em aberto/)).toBeInTheDocument();
  });
});

describe("SmartAnomaliesCard (F8)", () => {
  const alerts: InsightAlert[] = [
    { id: "saldo_negativo", priority: 1, severity: "critical", title: "Saldo negativo", description: "Despesas superaram receitas." },
    { id: "ritmo_gastos", priority: 2, severity: "warning", title: "Ritmo acima", description: "Consumo acima do previsto." },
  ];

  it("lista os alertas priorizados com o AlertCard", () => {
    render(<SmartAnomaliesCard alerts={alerts} />);
    expect(screen.getByText("Saldo negativo")).toBeInTheDocument();
    expect(screen.getByText("Ritmo acima")).toBeInTheDocument();
  });

  it("respeita o limite e mostra estado vazio", () => {
    render(<SmartAnomaliesCard alerts={alerts} limit={1} />);
    expect(screen.getByText("Saldo negativo")).toBeInTheDocument();
    expect(screen.queryByText("Ritmo acima")).not.toBeInTheDocument();

    render(<SmartAnomaliesCard alerts={[]} />);
    expect(screen.getByText("Nenhum alerta crítico no momento.")).toBeInTheDocument();
  });
});

describe("SavingsHealthCard (F8)", () => {
  it("calcula meses de reserva e feedback da poupança", () => {
    render(<SavingsHealthCard savingsRatePercent={38} incomeCents={500000} expenseCents={310000} />);
    // 5.000 ÷ 3.100 ≈ 1,6 meses
    expect(screen.getByText("1,6")).toBeInTheDocument();
    expect(screen.getByText(/meses de despesas cobertos/)).toBeInTheDocument();
  });

  it("sem despesas não divide por zero", () => {
    render(<SavingsHealthCard savingsRatePercent={100} incomeCents={500000} expenseCents={0} />);
    expect(screen.getByText("Sem despesas registradas no mês.")).toBeInTheDocument();
  });
});
