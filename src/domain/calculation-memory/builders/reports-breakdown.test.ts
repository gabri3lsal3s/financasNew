import { describe, expect, it } from "vitest";
import { buildBalanceSheet360Breakdown, buildFreedomIndexBreakdown } from "./reports-breakdown";
import type { ConsolidatedBalanceSheetResult } from "@/domain/reports/consolidated-balance";
import type { FreedomAnalysisResult } from "@/domain/reports/freedom-index";

describe("reports-breakdown", () => {
  it("deve montar breakdown completo do Balanço 360° com ativos, passivos e patrimônio líquido real (AUD-06)", () => {
    const mockBalance: ConsolidatedBalanceSheetResult = {
      totalInvestmentsBRL: 85000,
      totalCostBRL: 70000,
      unrealizedPnlBRL: 15000,
      unrealizedPnlPct: 21.43,
      cashBalanceBRL: 15000, // Caixa bancário + corretora
      receivablesBRL: 2000,
      totalAssetsBRL: 102000,
      debtsPayableBRL: 12000,
      creditCardInvoicesBRL: 3500, // Faturas de cartão
      totalLiabilitiesBRL: 15500,
      netWorthBRL: 86500,
      debtToAssetRatioPct: 15.2,
      dre: {
        grossIncomeBRL: 10000,
        totalExpensesBRL: 6000,
        operationalSavingsBRL: 4000,
        savingsRatePct: 40,
        investedAporteBRL: 2000,
        netCashFlowBRL: 2000,
      },
    };

    const breakdown = buildBalanceSheet360Breakdown(mockBalance);

    expect(breakdown.title).toBe("Balanço Patrimonial 360°");
    expect(breakdown.result.unit).toBe("currency");
    expect(breakdown.result.rawValue).toBe(8650000); // R$ 86.500,00 em centavos
    expect(breakdown.steps).toHaveLength(7);
    expect(breakdown.steps[0]?.rawValue).toBe(8500000); // Investimentos
    expect(breakdown.steps[1]?.rawValue).toBe(1500000); // Caixa
    expect(breakdown.steps[2]?.rawValue).toBe(200000); // Recebíveis
    expect(breakdown.steps[3]?.rawValue).toBe(10200000); // Ativos
    expect(breakdown.steps[4]?.rawValue).toBe(1200000); // Dívidas
    expect(breakdown.steps[5]?.rawValue).toBe(350000); // Faturas
    expect(breakdown.steps[6]?.rawValue).toBe(1550000); // Passivos
    expect(breakdown.copyText).toContain("Balanço Patrimonial 360°");
  });

  it("deve montar breakdown de Liberdade Financeira e Runway com unidades percentuais e meses (AUD-03)", () => {
    const mockFreedom: FreedomAnalysisResult = {
      monthlyDividendsBRL: 2500,
      monthlyExpensesBRL: 5000,
      liquidReservesBRL: 30000,
      freedomPct: 50,
      freedomStage: "half",
      stageLabel: "Meio Caminho da Liberdade (50% a 74%)",
      runwayMonths: 6,
      snowballAssets: [],
      totalSnowballAssetsCount: 0,
    };

    const breakdown = buildFreedomIndexBreakdown(mockFreedom);

    expect(breakdown.title).toBe("Liberdade Financeira & Runway");
    expect(breakdown.result.unit).toBe("percent");
    expect(breakdown.result.rawValue).toBe(50);
    expect(breakdown.steps).toHaveLength(5);
    expect(breakdown.steps[0]?.rawValue).toBe(250000); // Proventos
    expect(breakdown.steps[1]?.rawValue).toBe(500000); // Despesas
    expect(breakdown.steps[2]?.unit).toBe("percent");
    expect(breakdown.steps[2]?.rawValue).toBe(50);
    expect(breakdown.steps[3]?.rawValue).toBe(3000000); // Reservas
    expect(breakdown.steps[4]?.unit).toBe("months");
    expect(breakdown.steps[4]?.rawValue).toBe(6);
  });
});
