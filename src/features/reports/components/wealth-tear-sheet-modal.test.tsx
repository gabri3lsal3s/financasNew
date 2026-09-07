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

  it("renderiza TWR com destaque quando disponível e exibe o Quadro Executivo de Metodologias", () => {
    render(
      <WealthTearSheetModal
        open={true}
        onOpenChange={vi.fn()}
        rows={[]}
        totalBRL={107939.10}
        totalCostBRL={98546.13}
        totalReturnPct={16.7}
        portfolioTwr={{
          accumulatedRatePct: 27.1,
          annualizedRatePct: 9.4,
          monthsElapsed: 32,
          currentSharePrice: 127.1,
          status: "ok",
          series: [],
        }}
        portfolioIrr={{
          annualizedRatePct: 6.3,
          periodRatePct: 15.0,
          daysElapsed: 921,
          isEligible: true,
          status: "ok",
        }}
        allTimeEconomicPnlBRL={16511.84}
        allocationAnalysis={mockAllocation}
        concentrationRisk={mockConcentration}
      />,
    );

    // Rentabilidade adaptativa: TWR como métrica principal (tela e folha de impressão)
    expect(screen.getAllByText("Rentabilidade (TWR)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+9.4% a.a. (Padrão CVM)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Retorno contábil: +16,7%").length).toBeGreaterThan(0);

    // Quadro Executivo de Metodologias (no final do relatório)
    expect(screen.getAllByText("Metodologias & Métricas de Rentabilidade da Carteira").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\. TWR \(Cotas — Padrão CVM \/ ANBIMA\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2\. Retorno do Bolso \(TIR \/ XIRR\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3\. Retorno Contábil da Custódia Aberta/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4\. Resultado Histórico \(P&L Total em R\$\)/i).length).toBeGreaterThan(0);
  });

  it("renderiza o gráfico comparativo de rentabilidade mês a mês quando há >= 2 competências e oculta quando < 2", () => {
    const { rerender } = render(
      <WealthTearSheetModal
        open={true}
        onOpenChange={vi.fn()}
        rows={[]}
        totalBRL={100000}
        totalCostBRL={90000}
        portfolioTwr={{
          accumulatedRatePct: 10,
          annualizedRatePct: null,
          monthsElapsed: 3,
          currentSharePrice: 110,
          status: "ok",
          series: [
            {
              month: "2026-07",
              monthRatePct: 1.5,
              accumulatedRatePct: 1.5,
              sharePrice: 101.5,
              totalShares: 100,
              totalValueBRL: 95000,
            },
            {
              month: "2026-08",
              monthRatePct: -0.8,
              accumulatedRatePct: 0.69,
              sharePrice: 100.69,
              totalShares: 100,
              totalValueBRL: 97000,
            },
            {
              month: "2026-09",
              monthRatePct: 2.1,
              accumulatedRatePct: 2.8,
              sharePrice: 102.8,
              totalShares: 100,
              totalValueBRL: 100000,
            },
          ],
        }}
        allocationAnalysis={mockAllocation}
        concentrationRisk={mockConcentration}
      />,
    );

    // Deve exibir o título do gráfico comparativo histórico
    expect(
      screen.getAllByText("Comparativo Histórico de Rentabilidade & Patrimônio Mês a Mês").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("07/26").length).toBeGreaterThan(0);
    expect(screen.getAllByText("08/26").length).toBeGreaterThan(0);
    expect(screen.getAllByText("09/26").length).toBeGreaterThan(0);

    // Deve exibir o painel de Benchmarks e Métricas Avançadas de Risco
    expect(screen.getAllByText(/Benchmarks Oficiais de Comparação/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Métricas de Risco & Consistência do Período/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Índice Sharpe").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Max Drawdown").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Consistência").length).toBeGreaterThan(0);

    // Rerenderiza com apenas 1 competência (deve ocultar o gráfico para evitar gráfico quebrado)
    rerender(
      <WealthTearSheetModal
        open={true}
        onOpenChange={vi.fn()}
        rows={[]}
        totalBRL={100000}
        totalCostBRL={90000}
        portfolioTwr={{
          accumulatedRatePct: 1.5,
          annualizedRatePct: null,
          monthsElapsed: 1,
          currentSharePrice: 101.5,
          status: "ok",
          series: [
            {
              month: "2026-09",
              monthRatePct: 1.5,
              accumulatedRatePct: 1.5,
              sharePrice: 101.5,
              totalShares: 100,
              totalValueBRL: 100000,
            },
          ],
        }}
        allocationAnalysis={mockAllocation}
        concentrationRisk={mockConcentration}
      />,
    );

    expect(
      screen.queryByText("Comparativo Histórico de Rentabilidade & Patrimônio Mês a Mês"),
    ).not.toBeInTheDocument();
  });
});
