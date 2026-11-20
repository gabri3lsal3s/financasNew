import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConsolidatedWealthModal } from "./consolidated-wealth-modal";
import type { ConsolidatedBalanceSheetResult } from "@/domain/reports";

const mockBalanceSheet: ConsolidatedBalanceSheetResult = {
  totalAssetsBRL: 150000,
  totalInvestmentsBRL: 120000,
  totalCostBRL: 100000,
  unrealizedPnlBRL: 20000,
  unrealizedPnlPct: 20,
  cashBalanceBRL: 25000,
  receivablesBRL: 5000,
  totalLiabilitiesBRL: 30000,
  debtsPayableBRL: 25000,
  creditCardInvoicesBRL: 5000,
  netWorthBRL: 120000,
  debtToAssetRatioPct: 20,
  dre: {
    grossIncomeBRL: 20000,
    totalExpensesBRL: 12000,
    operationalSavingsBRL: 8000,
    savingsRatePct: 40,
    investedAporteBRL: 5000,
    netCashFlowBRL: 3000,
  },
};

describe("ConsolidatedWealthModal (Fase 12)", () => {
  it("renderiza cabeçalho, síntese de 4 KPIs, colunas de ativos/passivos e DRE Pessoal compacta", () => {
    render(
      <ConsolidatedWealthModal
        open={true}
        onOpenChange={vi.fn()}
        balanceSheet={mockBalanceSheet}
        accountHolder="Investidor Exemplo"
      />,
    );

    expect(screen.getAllByText(/Balanço Patrimonial 360°/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/SÍNTESE PATRIMONIAL & GRAU DE ALAVANCAGEM/i)).toBeInTheDocument();
    expect(screen.getAllByText(/ATIVOS TOTAIS/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/PASSIVOS EXIGÍVEIS/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Demonstração do Resultado do Exercício \(DRE Pessoal — Base Ponderada\)/i)).toBeInTheDocument();
  });
});
