import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DividendFreedomModal } from "./dividend-freedom-modal";
import type { FreedomAnalysisResult } from "@/domain/reports";

const mockFreedomAnalysis: FreedomAnalysisResult = {
  monthlyExpensesBRL: 5000,
  monthlyDividendsBRL: 2500,
  liquidReservesBRL: 90000,
  freedomPct: 50,
  freedomStage: "half",
  stageLabel: "Segurança Financeira",
  runwayMonths: 18,
  totalSnowballAssetsCount: 1,
  snowballAssets: [
    {
      ticker: "MXRF11",
      currentPriceBRL: 10.5,
      monthlyIncomeGeneratedBRL: 12.0,
      newSharesPerMonth: 1.14,
      isSnowballReached: true,
      monthsToBuyOneShare: 0.87,
    },
  ],
};

describe("DividendFreedomModal (Fase 13)", () => {
  it("renderiza cabeçalho, régua FIRE com 5 marcos, síntese e tabela de efeito bola de neve", () => {
    render(
      <DividendFreedomModal
        open={true}
        onOpenChange={vi.fn()}
        freedomAnalysis={mockFreedomAnalysis}
        dividends={[]}
        yearDividendsBRL={30000}
        accountHolder="Investidor Exemplo"
      />,
    );

    expect(screen.getAllByText(/Dossiê de Proventos & Liberdade Financeira/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/SÍNTESE DE PROVENTOS & INDEPENDÊNCIA FINANCEIRA/i)).toBeInTheDocument();
    expect(screen.getByText(/Estágio de Independência Financeira \(FIRE\)/i)).toBeInTheDocument();
    expect(screen.getByText(/1º Quarto/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Independência/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Ativos no Efeito Bola de Neve/i)).toBeInTheDocument();
    expect(screen.getByText(/MXRF11/i)).toBeInTheDocument();
  });
});
