import { describe, it, expect } from "vitest";
import { generateMultiSheetExcelXml, type ExcelWorkbookData } from "@/services/excel-export";

describe("Segurança e Sanitização em Planilhas Excel (.xls / XML)", () => {
  const baseWorkbookData: ExcelWorkbookData = {
    appName: "Áxis Finance Test",
    generatedAt: "09/11/2026",
    summary: {
      totalPatrimonyBRL: 10000,
      totalInvestedCostBRL: 8000,
      unrealizedPnlBRL: 2000,
      unrealizedPnlPct: 25,
      cashBalanceBRL: 500,
      yearDividendsBRL: 300,
      freedomPct: 15,
      savingsRatePct: 20,
    },
    positions: [],
    dividends: [],
    dreMonthly: [],
    debts: [],
  };

  it("escapa entidades XML básicas (&, <, >, \", ') em campos de texto", () => {
    const data: ExcelWorkbookData = {
      ...baseWorkbookData,
      positions: [
        {
          ticker: "VALE3",
          name: "Vale & Cia <Mineração> 'Especial' \"Top\"",
          assetClass: "Ações",
          currency: "BRL",
          quantity: 100,
          averagePrice: 60,
          currentPrice: 70,
          totalValueBRL: 7000,
          unrealizedPnlBRL: 1000,
          unrealizedPnlPct: 16.67,
          yearDividendsBRL: 200,
          yocPct: 3.33,
        },
      ],
    };

    const xml = generateMultiSheetExcelXml(data);
    expect(xml).toContain("&amp; Cia &lt;Mineração&gt; &apos;Especial&apos; &quot;Top&quot;");
    expect(xml).not.toContain("<Mineração>");
  });

  it("neutraliza injeção direta de fórmulas (=cmd, +cmd, -cmd, @cmd, |cmd) adicionando apóstrofo", () => {
    const maliciousFormulas = [
      "=cmd|' /C calc'!A0",
      "+12345*cmd|' /C calc'!A0",
      "-cmd|' /C calc'!A0",
      "@SUM(1+1)*cmd|' /C calc'!A0",
      "|calc.exe",
    ];

    for (const formula of maliciousFormulas) {
      const data: ExcelWorkbookData = {
        ...baseWorkbookData,
        debts: [
          {
            description: formula,
            type: "payable",
            remainingAmountBRL: 100,
            totalAmountBRL: 100,
          },
        ],
      };

      const xml = generateMultiSheetExcelXml(data);
      expect(xml).toContain(`&apos;${formula.replace(/&/g, "&amp;").replace(/'/g, "&apos;")}`);
    }
  });

  it("neutraliza fórmulas precedidas por espaços em branco para contornar checagem ingênua", () => {
    const hiddenFormula = "   =2+5+cmd|' /C calc'!A0";
    const data: ExcelWorkbookData = {
      ...baseWorkbookData,
      debts: [
        {
          description: hiddenFormula,
          type: "payable",
          remainingAmountBRL: 50,
          totalAmountBRL: 50,
        },
      ],
    };

    const xml = generateMultiSheetExcelXml(data);
    expect(xml).toContain("&apos;   =2+5+cmd|&apos; /C calc&apos;!A0");
  });

  it("neutraliza caracteres de controle perigosos (\\t e \\r)", () => {
    const tabPayload = "\t=1+1";
    const data: ExcelWorkbookData = {
      ...baseWorkbookData,
      dividends: [
        {
          date: "09/11/2026",
          ticker: "PETR4",
          assetClass: "Ações",
          amountBRL: 100,
          notes: tabPayload,
        },
      ],
    };

    const xml = generateMultiSheetExcelXml(data);
    expect(xml).toContain("&apos;\t=1+1");
  });

  it("preserva números legítimos com sinal sem prefixar apóstrofo", () => {
    const legitimateNumbers = ["-15.50", "+100", "-50,00", "+25"];
    for (const num of legitimateNumbers) {
      const data: ExcelWorkbookData = {
        ...baseWorkbookData,
        debts: [
          {
            description: num,
            type: "payable",
            remainingAmountBRL: 10,
            totalAmountBRL: 10,
          },
        ],
      };

      const xml = generateMultiSheetExcelXml(data);
      expect(xml).toContain(`<Data ss:Type="String">${num}</Data>`);
      expect(xml).not.toContain(`&apos;${num}`);
    }
  });
});
