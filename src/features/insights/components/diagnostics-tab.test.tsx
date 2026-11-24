import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildDiagnosticBreakdowns } from "@/domain/calculation-memory";
import { DiagnosticsTab } from "./diagnostics-tab";

describe("DiagnosticsTab (Fase 4 — Portão de Qualidade)", () => {
  it("Cenário 1: 1 despesa sem renda exibe 1 aviso informativo e todos os indicadores neutros sem 'Crítico' ou '+100%'", () => {
    render(
      <DiagnosticsTab
        warnings={[
          {
            id: "sem_renda_registrada",
            variant: "info",
            message:
              "Aguardando registro de renda no mês: Você já registrou despesas neste período, mas ainda não há entradas de renda.",
          },
        ]}
        expandedWarnings={false}
        setExpandedWarnings={vi.fn()}
        health="indefinido"
        savingsRate={0}
        concentration={{ topSharePercent: 0, alert: false }}
        weekendComparable={false}
        weekendRatio={0}
        trendHasPreviousBase={false}
        trendSignificant={false}
        trendPercent={0}
        overspentBudgets={0}
        essentialSpending={{
          essentialCents: 0,
          totalCents: 5000,
          ratioPercent: 0,
          status: "em_formacao",
          hasCriticalMass: false,
        }}
        hasTransactions={true}
        hasIncome={false}
      />,
    );

    expect(screen.getAllByText("Aguardando renda").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Sem base anterior")).toBeInTheDocument();
    expect(screen.getAllByText("Em formação").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Crítico")).not.toBeInTheDocument();
    expect(screen.queryByText("+100%")).not.toBeInTheDocument();
  });

  it("renderiza os 6 gatilhos de Memória de Cálculo nos DiagnosticCards quando breakdowns são fornecidos", () => {
    const breakdowns = buildDiagnosticBreakdowns({
      month: "2026-11",
      incomeCents: 350666,
      expenseCents: 227382,
      investmentCents: 0,
      committedObligationsCents: 0,
      savingsRate: 35.15,
      hasIncome: true,
      overspentBudgets: 0,
      activeBudgetsCount: 4,
      topIncomeSourceCents: 350666,
      concentrationPercent: 100,
      weekdayDailyCents: 5000,
      weekendDailyCents: 6000,
      weekendRatio: 1.2,
      weekendComparable: true,
      essentialCents: 100000,
      essentialDenominatorCents: 350666,
      essentialPercent: 28.5,
      trendHasPreviousBase: true,
      previousComparableCents: 200000,
      trendPercent: 13.7,
    });

    render(
      <DiagnosticsTab
        warnings={[]}
        expandedWarnings={false}
        setExpandedWarnings={vi.fn()}
        health="forte"
        savingsRate={35.15}
        concentration={{ topSharePercent: 100, alert: false }}
        weekendComparable={true}
        weekendRatio={1.2}
        trendHasPreviousBase={true}
        trendSignificant={false}
        trendPercent={13.7}
        overspentBudgets={0}
        essentialSpending={{
          essentialCents: 100000,
          totalCents: 350666,
          ratioPercent: 28.5,
          status: "adequado",
          hasCriticalMass: true,
        }}
        breakdowns={breakdowns}
        hasTransactions={true}
        hasIncome={true}
      />,
    );

    const memoryButtons = screen.getAllByRole("button", { name: /Ver memória de cálculo de/i });
    expect(memoryButtons).toHaveLength(6);
  });
});
