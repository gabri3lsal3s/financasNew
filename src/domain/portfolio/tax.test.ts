import { describe, expect, it } from "vitest";
import {
  calculateMonthlyDarf,
  classifyAnnualDividendsReport,
  generateAnnualBensDireitosReport,
  getBensDireitosClassification,
  isBdrAsset,
  isEtfAsset,
  isFiiAsset,
  isForeignAsset,
} from "./tax";
import type { PortfolioAsset, PortfolioDividend } from "@/types";

describe("domain/portfolio/tax — Apuração Fiscal e IRPF", () => {
  describe("getBensDireitosClassification", () => {
    it("classifica FIIs no Grupo 07 / Código 03", () => {
      const result = getBensDireitosClassification("FIIs", "MXRF11");
      expect(result.groupCode).toBe("07");
      expect(result.itemCode).toBe("03");
    });

    it("classifica Ações no Grupo 03 / Código 01", () => {
      const result = getBensDireitosClassification("Ações", "PETR4");
      expect(result.groupCode).toBe("03");
      expect(result.itemCode).toBe("01");
    });

    it("classifica Renda Fixa no Grupo 04 / Código 02", () => {
      const result = getBensDireitosClassification("Renda Fixa", "Tesouro Selic");
      expect(result.groupCode).toBe("04");
      expect(result.itemCode).toBe("02");
    });
  });

  describe("generateAnnualBensDireitosReport", () => {
    it("gera relatório de bens e direitos com texto de discriminação pronto", () => {
      const assets: PortfolioAsset[] = [
        {
          id: "a1",
          user_id: "u1",
          ticker: "MXRF11",
          asset_class: "FIIs",
          currency: "BRL",
          quantity: 100,
          average_price: 10.5,
        },
      ];

      const report = generateAnnualBensDireitosReport(assets, 2026);
      expect(report.year).toBe(2026);
      expect(report.items).toHaveLength(1);
      expect(report.totalCostCents).toBe(105000);
      expect(report.items[0]?.discrimination).toContain("100 cotas/ações de MXRF11");
      expect(report.items[0]?.discrimination).toContain("R$ 1.050,00");
    });

    it("gera relatório de bens e direitos para ativos internacionais em USD com conversão cambial", () => {
      const assets: PortfolioAsset[] = [
        {
          id: "a2",
          user_id: "u1",
          ticker: "AAPL",
          asset_class: "Internacional",
          currency: "USD",
          quantity: 10,
          average_price: 150.0,
        },
      ];

      const report = generateAnnualBensDireitosReport(assets, 2026, 5.0);
      expect(report.year).toBe(2026);
      expect(report.items).toHaveLength(1);
      // 10 * 150 = $1500 * 5.0 = R$ 7.500,00 = 750000 cents
      expect(report.totalCostCents).toBe(750000);
      expect(report.items[0]?.discrimination).toContain("$ 1500.00");
      expect(report.items[0]?.discrimination).toContain("R$ 7.500,00");
      expect(report.items[0]?.discrimination).toContain("R$ 5.00");
    });
  });

  describe("classifyAnnualDividendsReport", () => {
    it("separa dividendos isentos de JCP tributável na fonte", () => {
      const assets: PortfolioAsset[] = [
        { id: "a1", user_id: "u1", ticker: "PETR4", asset_class: "Ações", currency: "BRL", quantity: 100, average_price: 30 },
      ];

      const dividends: PortfolioDividend[] = [
        { id: "d1", user_id: "u1", asset_id: "a1", date: "2026-05-15", amount: 150, notes: "DIVIDENDO" },
        { id: "d2", user_id: "u1", asset_id: "a1", date: "2026-08-20", amount: 50, notes: "JCP (JUROS SOBRE CAPITAL)" },
      ];

      const report = classifyAnnualDividendsReport(dividends, assets, 2026);
      expect(report.year).toBe(2026);
      expect(report.exemptDividends.totalCents).toBe(15000);
      expect(report.exclusiveJCP.totalCents).toBe(5000);
      expect(report.totalDividendsCents).toBe(20000);
    });

    it("converte proventos de ativos em USD para reais com a taxa informada e classifica em foreignDividends", () => {
      const assets: PortfolioAsset[] = [
        { id: "a2", user_id: "u1", ticker: "AAPL", asset_class: "Internacional", currency: "USD", quantity: 10, average_price: 150 },
      ];

      const dividends: PortfolioDividend[] = [
        { id: "d3", user_id: "u1", asset_id: "a2", date: "2026-05-15", amount: 20, notes: "DIVIDEND" },
      ];

      const report = classifyAnnualDividendsReport(dividends, assets, 2026, 5.0);
      // $20 * 5.0 = R$ 100,00 = 10000 cents
      expect(report.foreignDividends.totalCents).toBe(10000);
      expect(report.exemptDividends.totalCents).toBe(0);
      expect(report.totalDividendsCents).toBe(10000);
    });
  });

  describe("calculateMonthlyDarf", () => {
    it("aplica isenção de 20k em vendas de ações no mês", () => {
      const result = calculateMonthlyDarf({
        month: "2026-08",
        sales: [
          {
            ticker: "PETR4",
            assetClass: "Ações",
            saleAmountCents: 1500000, // R$ 15.000 (abaixo de 20k)
            costAmountCents: 1200000,
            profitCents: 300000, // Lucro de R$ 3.000
          },
        ],
      });

      expect(result.isStockExempt).toBe(true);
      expect(result.stockTaxDueCents).toBe(0);
      expect(result.shouldPayDarf).toBe(false);
    });

    it("tributa 15% em ações quando volume ultrapassa 20k e compensa prejuízos anteriores", () => {
      const result = calculateMonthlyDarf({
        month: "2026-08",
        sales: [
          {
            ticker: "VALE3",
            assetClass: "Ações",
            saleAmountCents: 2500000, // R$ 25.000 (> 20k)
            costAmountCents: 2000000,
            profitCents: 500000, // Lucro de R$ 5.000
          },
        ],
        previousLosses: {
          stockCents: 200000, // Prejuízo anterior de R$ 2.000
        },
      });

      expect(result.isStockExempt).toBe(false);
      expect(result.stockGrossProfitCents).toBe(500000);
      expect(result.stockCompensatedLossCents).toBe(200000);
      expect(result.stockTaxableProfitCents).toBe(300000);
      expect(result.stockTaxDueCents).toBe(45000); // 15% de 3.000 = R$ 450,00
      expect(result.shouldPayDarf).toBe(true);
      expect(result.remainingAccumulatedLossCents.stockCents).toBe(0);
    });

    it("tributa 20% em vendas de FIIs sem isenção de 20k", () => {
      const result = calculateMonthlyDarf({
        month: "2026-08",
        sales: [
          {
            ticker: "HGLG11",
            assetClass: "FIIs",
            saleAmountCents: 500000, // R$ 5.000
            costAmountCents: 400000,
            profitCents: 100000, // Lucro de R$ 1.000
          },
        ],
      });

      expect(result.fiiTaxableProfitCents).toBe(100000);
      expect(result.fiiTaxDueCents).toBe(20000); // 20% de 1.000 = R$ 200,00
      expect(result.totalTaxDueCents).toBe(20000);
      expect(result.shouldPayDarf).toBe(true);
    });

    it("tributa 15% em vendas de ETFs sem isenção de 20k, mesmo com volume baixo", () => {
      const result = calculateMonthlyDarf({
        month: "2026-08",
        sales: [
          {
            ticker: "BOVA11",
            assetClass: "ETFs",
            saleAmountCents: 600000, // R$ 6.000 (abaixo de 20k)
            costAmountCents: 500000,
            profitCents: 100000, // Lucro de R$ 1.000
          },
        ],
      });

      expect(result.stockSalesVolumeCents).toBe(0);
      expect(result.etfSalesVolumeCents).toBe(600000);
      expect(result.etfGrossProfitCents).toBe(100000);
      expect(result.etfTaxableProfitCents).toBe(100000);
      expect(result.etfTaxDueCents).toBe(15000); // 15% de 1.000 = R$ 150,00
      expect(result.totalTaxDueCents).toBe(15000);
      expect(result.shouldPayDarf).toBe(true);
    });

    it("assegura que volume de venda de ETF não contamina o teto de isenção de 20k de ações locais", () => {
      // Venda de R$ 15.000 em ações PETR4 (lucro R$ 3.000)
      // + Venda de R$ 10.000 em ETF BOVA11 (lucro R$ 1.000)
      // Volume total = R$ 25.000. Mas o volume de ações é R$ 15.000 (isento).
      const result = calculateMonthlyDarf({
        month: "2026-08",
        sales: [
          {
            ticker: "PETR4",
            assetClass: "Ações",
            saleAmountCents: 1500000, // R$ 15.000
            costAmountCents: 1200000,
            profitCents: 300000,
          },
          {
            ticker: "BOVA11",
            assetClass: "ETFs",
            saleAmountCents: 1000000, // R$ 10.000
            costAmountCents: 900000,
            profitCents: 100000,
          },
        ],
      });

      // Ações continuam isentas
      expect(result.stockSalesVolumeCents).toBe(1500000);
      expect(result.isStockExempt).toBe(true);
      expect(result.stockTaxDueCents).toBe(0);

      // ETF é tributado a 15%
      expect(result.etfSalesVolumeCents).toBe(1000000);
      expect(result.etfTaxableProfitCents).toBe(100000);
      expect(result.etfTaxDueCents).toBe(15000); // R$ 150,00

      // Total DARF a pagar é apenas o do ETF
      expect(result.totalTaxDueCents).toBe(15000);
      expect(result.shouldPayDarf).toBe(true);
    });

    it("segrega vendas de ativos internacionais (Lei 14.754/2023 - IRPF Anual) sem gerar DARF mensal e sem contaminar teto de 20k", () => {
      // Venda de R$ 30.000 em AAPL (moeda USD, lucro R$ 5.000)
      // + Venda de R$ 12.000 em VALE3 (lucro R$ 2.000)
      const result = calculateMonthlyDarf({
        month: "2026-08",
        sales: [
          {
            ticker: "AAPL",
            assetClass: "Internacional",
            currency: "USD",
            saleAmountCents: 3000000, // R$ 30.000
            costAmountCents: 2500000,
            profitCents: 500000, // Lucro R$ 5.000
          },
          {
            ticker: "VALE3",
            assetClass: "Ações",
            saleAmountCents: 1200000, // R$ 12.000
            costAmountCents: 1000000,
            profitCents: 200000, // Lucro R$ 2.000
          },
        ],
      });

      // Ativo internacional segregado
      expect(result.foreignSalesVolumeCents).toBe(3000000);
      expect(result.foreignGrossProfitCents).toBe(500000);

      // Ações locais não contaminadas
      expect(result.stockSalesVolumeCents).toBe(1200000);
      expect(result.isStockExempt).toBe(true);
      expect(result.stockTaxDueCents).toBe(0);

      // Nenhum DARF mensal devido (tributação do exterior ocorre na DAA anual)
      expect(result.totalTaxDueCents).toBe(0);
      expect(result.shouldPayDarf).toBe(false);
    });

    it("tributa BDRs a 15% sem isenção de 20k", () => {
      const result = calculateMonthlyDarf({
        month: "2026-08",
        sales: [
          {
            ticker: "AAPL34",
            assetClass: "BDRs",
            saleAmountCents: 500000, // R$ 5.000
            costAmountCents: 400000,
            profitCents: 100000, // Lucro R$ 1.000
          },
        ],
      });

      expect(result.stockSalesVolumeCents).toBe(0);
      expect(result.etfSalesVolumeCents).toBe(500000);
      expect(result.etfTaxDueCents).toBe(15000); // 15% de 1.000 = R$ 150,00
      expect(result.shouldPayDarf).toBe(true);
    });

    it("mantém isenção de 20k para Units de ações locais B3 (ex.: KLBN11, TAEE11)", () => {
      const result = calculateMonthlyDarf({
        month: "2026-08",
        sales: [
          {
            ticker: "KLBN11",
            assetClass: "Ações",
            saleAmountCents: 800000, // R$ 8.000 (< 20k)
            costAmountCents: 600000,
            profitCents: 200000,
          },
          {
            ticker: "TAEE11",
            assetClass: "Ações",
            saleAmountCents: 700000, // R$ 7.000 (total 15k < 20k)
            costAmountCents: 500000,
            profitCents: 200000,
          },
        ],
      });

      expect(result.stockSalesVolumeCents).toBe(1500000);
      expect(result.isStockExempt).toBe(true);
      expect(result.stockTaxDueCents).toBe(0);
      expect(result.etfSalesVolumeCents).toBe(0);
      expect(result.shouldPayDarf).toBe(false);
    });

    it("compensa prejuízos acumulados anteriores de ETFs", () => {
      const result = calculateMonthlyDarf({
        month: "2026-08",
        sales: [
          {
            ticker: "SMAL11",
            assetClass: "ETFs",
            saleAmountCents: 2000000, // R$ 20.000
            costAmountCents: 1500000,
            profitCents: 500000, // Lucro de R$ 5.000
          },
        ],
        previousLosses: {
          etfCents: 300000, // Prejuízo de R$ 3.000
        },
      });

      expect(result.etfGrossProfitCents).toBe(500000);
      expect(result.etfCompensatedLossCents).toBe(300000);
      expect(result.etfTaxableProfitCents).toBe(200000);
      expect(result.etfTaxDueCents).toBe(30000); // 15% de 2.000 = R$ 300,00
      expect(result.remainingAccumulatedLossCents.etfCents).toBe(0);
    });

    it("ignora vendas de Renda Fixa e Caixa na apuração de DARF de renda variável", () => {
      const result = calculateMonthlyDarf({
        month: "2026-08",
        sales: [
          {
            ticker: "TESOURO SELIC 2029",
            assetClass: "Renda Fixa",
            saleAmountCents: 5000000,
            costAmountCents: 4500000,
            profitCents: 500000,
          },
          {
            ticker: "CAIXA",
            assetClass: "Caixa",
            saleAmountCents: 1000000,
            costAmountCents: 1000000,
            profitCents: 0,
          },
        ],
      });

      expect(result.stockSalesVolumeCents).toBe(0);
      expect(result.fiiSalesVolumeCents).toBe(0);
      expect(result.etfSalesVolumeCents).toBe(0);
      expect(result.foreignSalesVolumeCents).toBe(0);
      expect(result.totalTaxDueCents).toBe(0);
      expect(result.shouldPayDarf).toBe(false);
    });
  });

  describe("classificadores fiscais (isForeignAsset, isEtfAsset, isBdrAsset, isFiiAsset)", () => {
    it("isForeignAsset classifica ativos em USD e internacionais", () => {
      expect(isForeignAsset("AAPL", "Internacional", "USD")).toBe(true);
      expect(isForeignAsset("VOO", "ETFs", "USD")).toBe(true);
      expect(isForeignAsset("NVDA", "Ações", undefined)).toBe(true);
      expect(isForeignAsset("PETR4", "Ações", "BRL")).toBe(false);
      expect(isForeignAsset("AAPL34", "BDRs", "BRL")).toBe(false);
      expect(isForeignAsset("IVVB11", "ETFs", "BRL")).toBe(false);
    });

    it("isEtfAsset identifica ETFs B3 por ticker ou classe", () => {
      expect(isEtfAsset("BOVA11", "Ações")).toBe(true);
      expect(isEtfAsset("SMAL11", "ETFs")).toBe(true);
      expect(isEtfAsset("IVVB11", "ETFs")).toBe(true);
      expect(isEtfAsset("NOVO11", "Fundos de Índice")).toBe(true);
      expect(isEtfAsset("KLBN11", "Ações")).toBe(false);
      expect(isEtfAsset("MXRF11", "FIIs")).toBe(false);
      expect(isEtfAsset("PETR4", "Ações")).toBe(false);
    });

    it("isBdrAsset identifica BDRs por padrão de código e classe", () => {
      expect(isBdrAsset("AAPL34")).toBe(true);
      expect(isBdrAsset("MSFT34")).toBe(true);
      expect(isBdrAsset("AMZO34")).toBe(true);
      expect(isBdrAsset("RANDOM", "BDRs")).toBe(true);
      expect(isBdrAsset("PETR4")).toBe(false);
      expect(isBdrAsset("BOVA11")).toBe(false);
    });

    it("isFiiAsset identifica FIIs e FIAGROs", () => {
      expect(isFiiAsset("MXRF11", "FIIs")).toBe(true);
      expect(isFiiAsset("HGLG11", "Fundo Imobiliário")).toBe(true);
      expect(isFiiAsset("VGIA11", "FIAGRO")).toBe(true);
      expect(isFiiAsset("PETR4", "Ações")).toBe(false);
      expect(isFiiAsset("BOVA11", "ETFs")).toBe(false);
    });
  });
});
