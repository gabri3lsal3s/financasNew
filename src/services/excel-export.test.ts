import { describe, expect, it } from "vitest";
import { generateMultiSheetExcelXml } from "./excel-export";
import type { ExcelWorkbookData } from "./excel-export";

describe("generateMultiSheetExcelXml", () => {
  it("deve gerar XML compatível com 5 abas formatadas", () => {
    const mockData: ExcelWorkbookData = {
      appName: "Finanças Pro",
      generatedAt: "23/08/2026",
      summary: {
        totalPatrimonyBRL: 100000,
        totalInvestedCostBRL: 85000,
        unrealizedPnlBRL: 15000,
        unrealizedPnlPct: 17.65,
        cashBalanceBRL: 10000,
        yearDividendsBRL: 6500,
        freedomPct: 52.3,
        savingsRatePct: 35.0,
      },
      positions: [
        {
          ticker: "PETR4",
          name: "Petrobras PN",
          assetClass: "acoes",
          currency: "BRL",
          quantity: 100,
          averagePrice: 30,
          currentPrice: 38.5,
          totalValueBRL: 3850,
          unrealizedPnlBRL: 850,
          unrealizedPnlPct: 28.33,
          yearDividendsBRL: 450,
          yocPct: 15.0,
        },
      ],
      dividends: [
        {
          date: "2026-08-15",
          ticker: "PETR4",
          assetClass: "acoes",
          amountBRL: 450,
          notes: "Dividendo trimestral",
        },
      ],
      dreMonthly: [
        {
          month: "2026-08",
          grossIncomeBRL: 12000,
          totalExpensesBRL: 7000,
          operationalSavingsBRL: 5000,
          savingsRatePct: 41.67,
          investedAporteBRL: 3000,
          netCashFlowBRL: 2000,
        },
      ],
      debts: [
        {
          description: "Financiamento Imobiliário",
          type: "payable",
          remainingAmountBRL: 180000,
          totalAmountBRL: 250000,
          installmentsProgress: "70/360",
          dueDate: "2026-08-25",
        },
      ],
    };

    const xml = generateMultiSheetExcelXml(mockData);

    // Deve conter declarações de XML Spreadsheet
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"');

    // Deve conter todas as 5 abas
    expect(xml).toContain('ss:Name="Resumo Executivo"');
    expect(xml).toContain('ss:Name="Custódia e Ativos"');
    expect(xml).toContain('ss:Name="Extrato de Proventos"');
    expect(xml).toContain('ss:Name="DRE Financeiro"');
    expect(xml).toContain('ss:Name="Dívidas e Passivos"');


    // Deve conter os dados serializados
    expect(xml).toContain("PETR4");
    expect(xml).toContain("3850.00");
    expect(xml).toContain("Financiamento Imobiliário");
    expect(xml).toContain("12000.00");
  });
});
