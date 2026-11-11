import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WealthTearSheetModal } from "./wealth-tear-sheet-modal";
import type { AllocationAnalysisResult, ConcentrationRiskResult } from "@/domain/reports";

const mockAllocation: AllocationAnalysisResult = {
  totalBRL: 100000,
  alignmentScore: 99,
  classGaps: [
    {
      assetClass: "FIIs",
      currentBRL: 23500,
      currentPct: 23.5,
      targetPct: 25.0,
      gapBRL: 1613.53,
      gapPct: -1.5,
      status: "deficit",
      recommendedOrder: 1,
    },
    {
      assetClass: "Ações",
      currentBRL: 26000,
      currentPct: 26.0,
      targetPct: 25.0,
      gapBRL: -1080.0,
      gapPct: 1.0,
      status: "surplus",
      recommendedOrder: 2,
    },
  ],
  sectorGaps: [],
  assetGaps: [],
  topDeficitClass: {
    assetClass: "FIIs",
    currentBRL: 23500,
    currentPct: 23.5,
    targetPct: 25.0,
    gapBRL: 1613.53,
    gapPct: -1.5,
    status: "deficit",
    recommendedOrder: 1,
  },
  topDeficitSector: {
    className: "Internacional",
    sectorName: "Estados Unidos",
    currentBRL: 2000,
    currentPct: 2.0,
    targetPctInClass: 50,
    effectiveTargetPct: 10,
    targetIdealBRL: 2500,
    gapBRL: 500,
    gapPct: -1.0,
    status: "deficit",
    recommendedOrder: 1,
  },
  topDeficitAsset: null,
  treeNodes: [],
};

const mockConcentration: ConcentrationRiskResult = {
  totalBRL: 100000,
  top5BRL: 30000,
  top5Pct: 30.0,
  top10BRL: 50000,
  top10Pct: 50.0,
  singleAssetDominance: { ticker: "TESOURO-SELIC-31", valueBRL: 8800, pct: 8.8 },
  sectorExposure: [],
  topSectorDominance: null,
  top3SectorsPct: 20.0,
  currencyExposure: { brlBRL: 80000, brlPct: 80, usdBRL: 20000, usdPct: 20 },
  riskScore: 85,
  riskAlerts: [],
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
    expect(screen.getAllByText("+9,4% a.a. (Padrão CVM)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Retorno contábil: +16,7%").length).toBeGreaterThan(0);

    // Quadro Executivo de Metodologias (no final do relatório)
    expect(screen.getAllByText("Metodologias & Métricas de Rentabilidade da Carteira").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\. TWR \(Cotas — Padrão CVM \/ ANBIMA\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2\. Retorno do Bolso \(TIR \/ XIRR\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3\. Retorno Contábil da Custódia Aberta/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4\. Resultado Histórico \(P&L Total em R\$\)/i).length).toBeGreaterThan(0);
  });

  it("renderiza o gráfico comparativo de rentabilidade mês a mês quando há >= 2 competências e exibe empty state calmo quando < 2", () => {
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
    expect(screen.getAllByText(/Benchmarks de Comparação/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Métricas de Risco & Consistência/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Índice Sharpe").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Max Drawdown").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Consistência").length).toBeGreaterThan(0);

    // Rerenderiza com apenas 1 competência (deve exibir empty state calmo informando a necessidade de histórico)
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

    // O gráfico SVG e as métricas de risco avançadas não devem ser renderizados
    expect(screen.queryByText("Índice Sharpe")).not.toBeInTheDocument();

    // Deve exibir o empty state calmo com aviso de necessidade de histórico mensal
    expect(screen.getAllByText("Histórico Mensal em Formação").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/São necessários ao menos 2 fechamentos mensais registrados/i).length,
    ).toBeGreaterThan(0);
  });

  it("utiliza estritamente twrMonthPct no fallback de monthlySeries e nunca atribui totalReturnPct acumulado", () => {
    render(
      <WealthTearSheetModal
        open={true}
        onOpenChange={vi.fn()}
        rows={[]}
        totalBRL={100000}
        totalCostBRL={90000}
        monthlySeries={[
          {
            month: "2026-08",
            valueBRL: 95000,
            costBRL: 90000,
            monthDividendsBRL: 500,
            accumulatedDividendsBRL: 500,
            capitalGainPnl: 5000,
            capitalGainPct: 5.5,
            totalReturnPnl: 5500,
            totalReturnPct: 25.0, // Taxa acumulada de 25% que NUNCA deve ser usada no gráfico mensal
            twrMonthPct: -1.5,     // Taxa periódica mensal real (-1,5%)
            twrAccumulatedPct: -1.5,
            sharePrice: 98.5,
          },
          {
            month: "2026-09",
            valueBRL: 100000,
            costBRL: 90000,
            monthDividendsBRL: 600,
            accumulatedDividendsBRL: 1100,
            capitalGainPnl: 10000,
            capitalGainPct: 11.1,
            totalReturnPnl: 10600,
            totalReturnPct: 28.0, // Taxa acumulada de 28% que NUNCA deve ser usada no gráfico mensal
            twrMonthPct: 2.3,      // Taxa periódica mensal real (+2,3%)
            twrAccumulatedPct: 0.8,
            sharePrice: 100.8,
          },
        ]}
        allocationAnalysis={mockAllocation}
        concentrationRisk={mockConcentration}
      />,
    );

    // Deve exibir o gráfico com os rótulos das competências
    expect(screen.getAllByText("08/26").length).toBeGreaterThan(0);
    expect(screen.getAllByText("09/26").length).toBeGreaterThan(0);

    // Deve exibir as taxas periódicas mensais (-1,5% e +2,3%)
    expect(screen.getAllByText("-1,5%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+2,3%").length).toBeGreaterThan(0);

    // Jamais deve exibir as taxas acumuladas de 25,0% ou 28,0%
    expect(screen.queryByText("+25,0%")).not.toBeInTheDocument();
    expect(screen.queryByText("+28,0%")).not.toBeInTheDocument();
  });

  it("renderiza a estrutura de portal de impressão A4 no body através do PrintSheet sem botões de tela", () => {
    render(
      <WealthTearSheetModal
        open={true}
        onOpenChange={vi.fn()}
        rows={[]}
        totalBRL={50000}
        totalCostBRL={45000}
        allocationAnalysis={mockAllocation}
        concentrationRisk={mockConcentration}
      />,
    );


    // O modal deve conter o botão de imprimir, mas os botões possuem print:hidden
    const printBtn = screen.getByRole("button", { name: /Imprimir \/ Salvar PDF/i });
    expect(printBtn).toBeInTheDocument();

    // No body deve existir o contêiner .print-sheet renderizado pelo portal
    const printSheetEl = document.body.querySelector(".print-sheet");
    expect(printSheetEl).toBeInTheDocument();
    expect(printSheetEl?.querySelector(".print-document")).toBeInTheDocument();
  });

  it("renderiza os 4 Raios-X de Subalocação profunda e não renderiza mais o comparativo fatiado de benchmarks", () => {
    render(
      <WealthTearSheetModal
        open={true}
        onOpenChange={vi.fn()}
        rows={[
          {
            ticker: "ITUB4",
            name: "Itaú Unibanco",
            assetClass: "Ações",
            sector: "Financeiro",
            currency: "BRL",
            quantity: 100,
            averagePrice: 30,
            currentPrice: 35,
            valueBRL: 3500,
            totalCostBRL: 3000,
            unrealizedPnlBRL: 500,
            unrealizedPnlPct: 16.67,
            totalReturnPnlBRL: 600,
            totalReturnPct: 20,
            isCash: false,
          },
          {
            ticker: "HGLG11",
            name: "CSHG Logística",
            assetClass: "FIIs",
            sector: "Logística",
            currency: "BRL",
            quantity: 50,
            averagePrice: 150,
            currentPrice: 160,
            valueBRL: 8000,
            totalCostBRL: 7500,
            unrealizedPnlBRL: 500,
            unrealizedPnlPct: 6.67,
            totalReturnPnlBRL: 800,
            totalReturnPct: 10.67,
            isCash: false,
          },
        ]}
        totalBRL={11500}
        totalCostBRL={10500}
        allocationAnalysis={mockAllocation}
        concentrationRisk={mockConcentration}
      />,
    );

    // Não deve mais renderizar o comparativo fragmentado de benchmarks por classe
    expect(screen.queryByText(/Comparativo por Tipo de Ativo vs. Benchmarks/i)).not.toBeInTheDocument();

    // Deve renderizar o título da seção de Raios-X
    expect(screen.getAllByText(/Raios-X de Subalocação Setorial, Cíclica & Risco de Emissão/i).length).toBeGreaterThan(0);

    // Deve renderizar os cards de Raio-X
    expect(screen.getAllByText(/Raio-X de Ações Brasil/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Raio-X de Fundos Imobiliários/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Raio-X de Renda Fixa/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Raio-X Internacional/i).length).toBeGreaterThan(0);
  });

  it("identifica formalmente o documento como Dossiê Executivo da Posição Vigente Consolidada", () => {
    render(
      <WealthTearSheetModal
        open={true}
        onOpenChange={vi.fn()}
        rows={[]}
        totalBRL={50000}
        totalCostBRL={45000}
        allocationAnalysis={mockAllocation}
        concentrationRisk={mockConcentration}
      />,
    );

    // Deve renderizar o título formal do documento institucional
    expect(screen.getAllByText("Dossiê Executivo da Posição Vigente Consolidada").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Posição Patrimonial Consolidada & Diagnóstico de Metas").length).toBeGreaterThan(0);
  });
});

