import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
