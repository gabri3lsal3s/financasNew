import { describe, expect, it } from "vitest";
import {
  calculateMonthlyDarf,
  classifyAnnualDividendsReport,
  generateAnnualBensDireitosReport,
  getBensDireitosClassification,
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

    it("converte proventos de ativos em USD para reais com a taxa informada", () => {
      const assets: PortfolioAsset[] = [
        { id: "a2", user_id: "u1", ticker: "AAPL", asset_class: "Internacional", currency: "USD", quantity: 10, average_price: 150 },
      ];

      const dividends: PortfolioDividend[] = [
        { id: "d3", user_id: "u1", asset_id: "a2", date: "2026-05-15", amount: 20, notes: "DIVIDEND" },
      ];

      const report = classifyAnnualDividendsReport(dividends, assets, 2026, 5.0);
      // $20 * 5.0 = R$ 100,00 = 10000 cents
      expect(report.exemptDividends.totalCents).toBe(10000);
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
  });
});
