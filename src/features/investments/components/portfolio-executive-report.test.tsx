import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortfolioExecutiveReport } from "./portfolio-executive-report";
import type { PositionRow } from "@/components/modules/position-table";

let mockMonthlyPositionLoading = false;
let mockMonthlyPositionIsError = false;
let mockMonthlyPositionData: unknown = null;
const mockRefetch = vi.fn();

vi.mock("@/state", () => ({
  usePortfolioMonthlyPosition: () => ({
    data: mockMonthlyPositionData,
    isLoading: mockMonthlyPositionLoading,
    isError: mockMonthlyPositionIsError,
    refetch: mockRefetch,
  }),
  usePortfolioSnapshots: () => ({
    data: [
      { id: "s1", month: "2026-08", total_value: 100000, total_cost: 90000 },
      { id: "s2", month: "2026-07", total_value: 95000, total_cost: 88000 },
    ],
  }),
  useDeletePortfolioSnapshot: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("./monthly-closing-editor", () => ({
  MonthlyClosingEditor: () => <div data-testid="closing-editor" />,
}));

describe("PortfolioExecutiveReport — Ausência de Flash e Estado de Carregamento", () => {
  const defaultRows: PositionRow[] = [
    {
      assetId: "a1",
      ticker: "PETR4",
      assetClass: "acoes",
      quantity: 100,
      averageCost: 30,
      priceBRL: 38,
      valueBRL: 3800,
      currency: "BRL",
      source: "manual",
      pricingMode: "unit_price",
      pct: 100,
      unrealizedPnl: 800,
      unrealizedPct: 26.6,
      isCash: false,
    },
  ];

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    rows: defaultRows,
    totalBRL: 80000,
    cashBRL: 10000,
    yearDividendsBRL: 1200,
    portfolioIrr: undefined,
    portfolioTwr: undefined,
    totalReturnPct: 15,
    totalReturnPnlBRL: 10000,
    allTimeEconomicPnlBRL: 10000,
  };

  it("exibe skeleton e NÃO renderiza a síntese executiva do mês atual enquanto a competência histórica estiver carregando", () => {
    mockMonthlyPositionLoading = true;
    mockMonthlyPositionData = null;

    render(
      <PortfolioExecutiveReport
        {...defaultProps}
        initialMonth="2026-07"
      />,
    );

    // Deve exibir o esqueleto de carregamento com data-testid
    const skeletons = screen.getAllByTestId("report-loading-skeleton");
    expect(skeletons.length).toBeGreaterThan(0);

    // NÃO deve renderizar o cabeçalho oficial de relatório enquanto carrega
    expect(
      screen.queryByText("Relatório Executivo de Acompanhamento da Carteira"),
    ).not.toBeInTheDocument();
  });

  it("renderiza mensagem de indisponibilidade quando os dados carregados indicam saldo consolidado sem custódia (fidelity)", () => {
    mockMonthlyPositionLoading = false;
    mockMonthlyPositionData = {
      month: "2026-07",
      totalValueBRL: 95000,
      totalCostBRL: 88000,
      cashQuantity: 0,
      positions: [],
      fidelity: {
        canGenerateExecutiveReport: false,
        reasons: ["Esta competência possui apenas registro consolidado de saldo patrimonial (TWA)."],
        snapshotTotalValue: 95000,
      },
    };

    render(
      <PortfolioExecutiveReport
        {...defaultProps}
        initialMonth="2026-07"
      />,
    );

    const errorTitles = screen.getAllByText("Relatório Analítico Não Disponível para esta Competência");
    expect(errorTitles.length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Esta competência possui apenas registro consolidado de saldo patrimonial/)[0],
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Conferir & Calibrar Fechamento/i })[0]).toBeInTheDocument();
  });

  it("renderiza estado de erro e permite tentar novamente quando a query de posição falha", () => {
    mockMonthlyPositionLoading = false;
    mockMonthlyPositionIsError = true;
    mockMonthlyPositionData = null;

    render(
      <PortfolioExecutiveReport
        {...defaultProps}
        initialMonth="2026-07"
      />,
    );

    const errorTitles = screen.getAllByText("Falha ao Carregar Competência Histórica");
    expect(errorTitles.length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Não foi possível recuperar os dados desta competência/)[0],
    ).toBeInTheDocument();

    const retryBtn = screen.getAllByRole("button", { name: /Tentar novamente/i })[0];
    expect(retryBtn).toBeInTheDocument();
    retryBtn?.click();
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("calcula retorno de classe internacional com base no custo em BRL sem distorção cambial", () => {
    mockMonthlyPositionLoading = false;
    mockMonthlyPositionIsError = false;
    mockMonthlyPositionData = null;

    const usdRows: PositionRow[] = [
      {
        assetId: "voo-1",
        ticker: "VOO",
        assetClass: "internacional",
        quantity: 1,
        averageCost: 464.41, // em USD
        totalCost: 464.41,
        totalCostBRL: 2554.26, // 464.41 * 5.50 em BRL
        priceQuote: 691.32, // em USD
        priceBRL: 3802.26,
        usdRate: 5.50,
        valueBRL: 3802.26,
        currency: "USD",
        source: "manual",
        pricingMode: "unit_price",
        pct: 100,
        unrealizedPnl: 1248.00,
        unrealizedPct: 48.86,
        totalReturnPnl: 1248.00,
        totalReturnPct: 48.86,
        isCash: false,
      },
    ];

    render(
      <PortfolioExecutiveReport
        {...defaultProps}
        rows={usdRows}
        totalBRL={3802.26}
      />,
    );

    // Não deve conter a distorção absurda de 500%+ ou 700%+
    expect(screen.queryByText(/\+573/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\+718/)).not.toBeInTheDocument();

    // Deve exibir a rentabilidade realista calculada sobre o custo em BRL (+48,9%)
    expect(screen.getAllByText(/\+48,9%/)[0]).toBeInTheDocument();
  });

  describe("Tarefa 3.1: 4 KPIs da Síntese Executiva focados na Competência", () => {
    it("exibe os 4 KPIs com dados de competência isolada e subtextos padronizados", () => {
      mockMonthlyPositionLoading = false;
      mockMonthlyPositionIsError = false;
      mockMonthlyPositionData = {
        month: "2026-07",
        totalValueBRL: 125000,
        totalCostBRL: 110000,
        cashQuantity: 15000,
        monthDividendsTotalBRL: 450,
        positions: [
          {
            assetId: "a1",
            ticker: "ITUB4",
            assetClass: "acoes",
            quantity: 100,
            averagePrice: 30,
            totalCost: 3000,
            totalCostBRL: 3000,
            priceBRL: 35,
            valueBRL: 3500,
            unrealizedPnl: 500,
            unrealizedPct: 16.67,
            accumulatedDividendsBRL: 50,
            monthDividendsBRL: 50,
            totalReturnPnl: 550,
            totalReturnPct: 18.33,
          },
        ],
        fidelity: {
          status: "complete",
          canGenerateExecutiveReport: true,
          reasons: [],
        },
        monthlyStatement: {
          month: "2026-07",
          startBalanceBRL: 120000,
          endBalanceBRL: 125000,
          monthRatePct: 3.25,
          monthNetPnlBRL: 3900,
          monthDividendsBRL: 450,
          monthBuysBRL: 1100,
          monthSellsBRL: 0,
          monthNetContributionBRL: 1100,
          monthGrossContributionsBRL: 1100,
          monthGrossWithdrawalsBRL: 0,
          weightedCapitalBaseBRL: 120550,
          weightedCashFlowBRL: 550,
          transactionsCount: 1,
          dividendsCount: 2,
        },
      };

      render(
        <PortfolioExecutiveReport
          {...defaultProps}
          initialMonth="2026-07"
        />,
      );

      // KPI 1: Patrimônio no Fechamento
      expect(screen.getAllByText("Patrimônio no Fechamento").length).toBeGreaterThan(0);
      expect(screen.getAllByText("1 ativo em custódia").length).toBeGreaterThan(0);

      // KPI 2: Rentabilidade da Competência (TWR)
      expect(screen.getAllByText("Rentabilidade da Competência (TWR)").length).toBeGreaterThan(0);
      expect(screen.getAllByText("+3,3%").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Variação isolada do mês (Padrão CVM)").length).toBeGreaterThan(0);

      // KPI 3: Resultado Líquido do Mês (P&L)
      expect(screen.getAllByText("Resultado Líquido do Mês (P&L)").length).toBeGreaterThan(0);
      expect(screen.getAllByText("P&L líquido da competência").length).toBeGreaterThan(0);

      // KPI 4: Proventos da Competência
      expect(screen.getAllByText("Proventos da Competência").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Recebidos no mês").length).toBeGreaterThan(0);
    });

    it("renderiza rentabilidade e resultado líquido negativos com semântica de alerta quando o mês é de queda", () => {
      mockMonthlyPositionLoading = false;
      mockMonthlyPositionIsError = false;
      mockMonthlyPositionData = {
        month: "2026-07",
        totalValueBRL: 95000,
        totalCostBRL: 100000,
        cashQuantity: 5000,
        monthDividendsTotalBRL: 120,
        positions: [
          {
            assetId: "a1",
            ticker: "VALE3",
            assetClass: "acoes",
            quantity: 100,
            averagePrice: 60,
            totalCost: 6000,
            totalCostBRL: 6000,
            priceBRL: 50,
            valueBRL: 5000,
            unrealizedPnl: -1000,
            unrealizedPct: -16.67,
            accumulatedDividendsBRL: 120,
            monthDividendsBRL: 120,
            totalReturnPnl: -880,
            totalReturnPct: -14.67,
          },
        ],
        fidelity: {
          status: "complete",
          canGenerateExecutiveReport: true,
          reasons: [],
        },
        monthlyStatement: {
          month: "2026-07",
          startBalanceBRL: 98000,
          endBalanceBRL: 95000,
          monthRatePct: -3.06,
          monthNetPnlBRL: -3000,
          monthDividendsBRL: 120,
          monthBuysBRL: 0,
          monthSellsBRL: 0,
          monthNetContributionBRL: 0,
          monthGrossContributionsBRL: 0,
          monthGrossWithdrawalsBRL: 0,
          weightedCapitalBaseBRL: 98000,
          weightedCashFlowBRL: 0,
          transactionsCount: 0,
          dividendsCount: 1,
        },
      };

      render(
        <PortfolioExecutiveReport
          {...defaultProps}
          initialMonth="2026-07"
        />,
      );

      // Rentabilidade negativa (-3,1%)
      const rateElements = screen.getAllByText("-3,1%");
      expect(rateElements.length).toBeGreaterThan(0);
      expect(rateElements[0]?.className).toContain("text-negative-strong");

      // P&L negativo (-R$ 3.000,00)
      expect(screen.getAllByText("Resultado Líquido do Mês (P&L)").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/[−-]\s*R\$[\s\u00a0]*3\.000,00/i).length).toBeGreaterThan(0);
    });
  });

  describe("Tarefa 3.2: Inclusão do Painel de Movimentações da Competência", () => {
    it("exibe o bloco de movimentações da competência consumindo monthBuysBRL, monthSellsBRL, monthDividendsBRL e monthNetContributionBRL", () => {
      mockMonthlyPositionLoading = false;
      mockMonthlyPositionIsError = false;
      mockMonthlyPositionData = {
        month: "2026-07",
        totalValueBRL: 125000,
        totalCostBRL: 110000,
        cashQuantity: 15000,
        monthDividendsTotalBRL: 450,
        positions: [
          {
            assetId: "a1",
            ticker: "ITUB4",
            assetClass: "acoes",
            quantity: 100,
            averagePrice: 30,
            totalCost: 3000,
            totalCostBRL: 3000,
            priceBRL: 35,
            valueBRL: 3500,
            unrealizedPnl: 500,
            unrealizedPct: 16.67,
            accumulatedDividendsBRL: 50,
            monthDividendsBRL: 50,
            totalReturnPnl: 550,
            totalReturnPct: 18.33,
          },
        ],
        fidelity: {
          status: "complete",
          canGenerateExecutiveReport: true,
          reasons: [],
        },
        monthlyStatement: {
          month: "2026-07",
          startBalanceBRL: 120000,
          endBalanceBRL: 125000,
          monthRatePct: 3.25,
          monthNetPnlBRL: 3900,
          monthDividendsBRL: 450,
          monthBuysBRL: 1100,
          monthSellsBRL: 0,
          monthNetContributionBRL: 1100,
          monthGrossContributionsBRL: 1100,
          monthGrossWithdrawalsBRL: 0,
          weightedCapitalBaseBRL: 120550,
          weightedCashFlowBRL: 550,
          transactionsCount: 1,
          dividendsCount: 2,
        },
      };

      render(
        <PortfolioExecutiveReport
          {...defaultProps}
          initialMonth="2026-07"
        />,
      );

      // Título e contadores do painel de movimentações
      expect(screen.getAllByText("MOVIMENTAÇÕES DA COMPETÊNCIA").length).toBeGreaterThan(0);
      expect(screen.getAllByText("1 operação · 2 proventos").length).toBeGreaterThan(0);

      // 4 Quadrantes de Movimentação
      expect(screen.getAllByText("Compras do Mês").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/1\.100,00/).length).toBeGreaterThan(0);

      expect(screen.getAllByText("Vendas do Mês").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/0,00/).length).toBeGreaterThan(0);

      expect(screen.getAllByText("Proventos do Mês").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/450,00/).length).toBeGreaterThan(0);

      expect(screen.getAllByText("Aporte Líquido Injetado").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/\+\s*R\$[\s\u00a0]*1\.100,00/i).length).toBeGreaterThan(0);
    });

    it("renderiza fluxo de vendas e resgate com aporte líquido negativo quando houver desinvestimento no mês", () => {
      mockMonthlyPositionLoading = false;
      mockMonthlyPositionIsError = false;
      mockMonthlyPositionData = {
        month: "2026-07",
        totalValueBRL: 95000,
        totalCostBRL: 90000,
        cashQuantity: 5000,
        monthDividendsTotalBRL: 200,
        positions: [],
        fidelity: {
          status: "complete",
          canGenerateExecutiveReport: true,
          reasons: [],
        },
        monthlyStatement: {
          month: "2026-07",
          startBalanceBRL: 100000,
          endBalanceBRL: 95000,
          monthRatePct: -0.5,
          monthNetPnlBRL: -500,
          monthDividendsBRL: 200,
          monthBuysBRL: 500,
          monthSellsBRL: 3000,
          monthNetContributionBRL: -2500,
          monthGrossContributionsBRL: 500,
          monthGrossWithdrawalsBRL: 3000,
          weightedCapitalBaseBRL: 98500,
          weightedCashFlowBRL: -1500,
          transactionsCount: 3,
          dividendsCount: 1,
        },
      };

      render(
        <PortfolioExecutiveReport
          {...defaultProps}
          initialMonth="2026-07"
        />,
      );

      // Contadores
      expect(screen.getAllByText("3 operações · 1 provento").length).toBeGreaterThan(0);

      // Vendas de R$ 3.000,00
      expect(screen.getAllByText(/3\.000,00/).length).toBeGreaterThan(0);

      // Aporte líquido negativo de -R$ 2.500,00 com semântica de alerta negativo
      const netContributionText = screen.getAllByText(/[−-]\s*R\$[\s\u00a0]*2\.500,00/i);
      expect(netContributionText.length).toBeGreaterThan(0);
      expect(netContributionText[0]?.className).toContain("text-negative-strong");
    });
  });
});
