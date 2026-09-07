import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WealthTearSheetModal } from "./wealth-tear-sheet-modal";
import type { AllocationAnalysisResult, ConcentrationRiskResult } from "@/domain/portfolio";

const mockAllocation: AllocationAnalysisResult = {
  alignmentScore: 99,
  classGaps: [
    { assetClass: "FIIs", currentPct: 23.5, targetPct: 25.0, gapBRL: 1613.53, gapPct: -1.5, status: "below" },
    { assetClass: "Ações", currentPct: 26.0, targetPct: 25.0, gapBRL: -1080.0, gapPct: 1.0, status: "above" },
  ],
  topDeficitClass: { assetClass: "FIIs", currentPct: 23.5, targetPct: 25.0, gapBRL: 1613.53, gapPct: -1.5, status: "below" },
  topDeficitSector: { sectorName: "Estados Unidos", gapBRL: 500 },
};

const mockConcentration: ConcentrationRiskResult = {
  singleAssetDominance: { ticker: "TESOURO-SELIC-31", pct: 8.8 },
  top3ConcentrationPct: 20.0,
  top5ConcentrationPct: 30.0,
  hhi: 500,
  isDiversified: true,
  riskLevel: "low",
  alerts: [],
};

describe("WealthTearSheetModal — Reconciliação Contábil na Síntese Executiva", () => {
  it("renderiza reconciliação explícita quando há ganhos brutos realizados de posições encerradas", () => {
    render(
      <WealthTearSheetModal
        open={true}
        onOpenChange={vi.fn()}
        rows={[
          {
            ticker: "WEGE3",
            name: "WEG ON",
            assetClass: "Ações",
            sector: "Bens de Capital",
            currency: "BRL",
            quantity: 100,
            averagePrice: 40,
            currentPrice: 50,
            valueBRL: 5000,
            totalCostBRL: 4000,
            unrealizedPnlBRL: 1000,
            unrealizedPnlPct: 25,
            totalReturnPnlBRL: 1200,
            totalReturnPct: 30,
            dividendsBRL: 200,
            yearDividendsBRL: 200,
            yocPct: 5,
            isCash: false,
          },
        ]}
        totalBRL={107939.10}
        totalCostBRL={98546.13}
        unrealizedPnlBRL={9386.06}
        unrealizedPnlPct={9.5}
        totalDividendsBRL={7019.74}
        totalReturnPnlBRL={16405.80}
        totalReturnPct={16.7}
        allTimeEconomicPnlBRL={16511.84}
        realizedPnlBRL={106.04}
        allocationAnalysis={mockAllocation}
        concentrationRisk={mockConcentration}
      />,
    );

    // Verifica que o card de Resultado Histórico agora exibe o subtexto estendido (modal + print sheet)
    expect(screen.getAllByText("P&L Total (Vivo + Encerrados)").length).toBeGreaterThan(0);

    // Verifica que a frase de reconciliação está presente no texto da síntese
    expect(
      screen.getAllByText(/Somado ao resultado bruto realizado de posições encerradas/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Resultado Econômico Histórico Consolidado totaliza/i).length,
    ).toBeGreaterThan(0);
  });

  it("mantém a narrativa concisa sem menção a posições encerradas quando realized é zero", () => {
    render(
      <WealthTearSheetModal
        open={true}
        onOpenChange={vi.fn()}
        rows={[
          {
            ticker: "WEGE3",
            name: "WEG ON",
            assetClass: "Ações",
            sector: "Bens de Capital",
            currency: "BRL",
            quantity: 100,
            averagePrice: 40,
            currentPrice: 50,
            valueBRL: 5000,
            totalCostBRL: 4000,
            unrealizedPnlBRL: 1000,
            unrealizedPnlPct: 25,
            totalReturnPnlBRL: 1200,
            totalReturnPct: 30,
            dividendsBRL: 200,
            yearDividendsBRL: 200,
            yocPct: 5,
            isCash: false,
          },
        ]}
        totalBRL={5000}
        totalCostBRL={4000}
        unrealizedPnlBRL={1000}
        unrealizedPnlPct={25}
        totalDividendsBRL={200}
        totalReturnPnlBRL={1200}
        totalReturnPct={30}
        allTimeEconomicPnlBRL={1200}
        realizedPnlBRL={0}
        allocationAnalysis={mockAllocation}
        concentrationRisk={mockConcentration}
      />,
    );

    // Subtexto padrão sem posições encerradas (modal + print sheet)
    expect(screen.getAllByText("P&L Econômico Total").length).toBeGreaterThan(0);

    // Não deve conter a frase de posições encerradas
    expect(
      screen.queryByText(/Somado ao resultado bruto realizado/i),
    ).not.toBeInTheDocument();
  });
});
