import { describe, expect, it } from "vitest";
import {
  calculateFiiExposure,
  calculateFixedIncomeExposure,
  calculateInternationalExposure,
  calculateStocksExposure,
  calculateMonthsElapsed,
  detectClassInceptions,
} from "./class-breakdown";
import type { PortfolioAsset } from "@/types";

describe("Motor Puro de Exposição de FIIs (calculateFiiExposure)", () => {
  it("agrega corretamente FIIs de tijolo, papel e agro", () => {
    const mockPositions = [
      {
        assetId: "1",
        ticker: "HGLG11",
        assetClass: "FIIs",
        sector: "Imobiliário / Logística",
        valueBRL: 6000,
        totalCostBRL: 5000,
      },
      {
        assetId: "2",
        ticker: "XPML11",
        assetClass: "FIIs",
        sector: "Imobiliário / Shoppings",
        valueBRL: 4000,
        totalCostBRL: 3800,
      },
      {
        assetId: "3",
        ticker: "MXRF11",
        assetClass: "FIIs",
        sector: "Imobiliário / Papel e CRI",
        valueBRL: 8000,
        totalCostBRL: 8200,
      },
      {
        assetId: "4",
        ticker: "RZTR11",
        assetClass: "FIIs",
        sector: "Agro / FIAGRO",
        valueBRL: 2000,
        totalCostBRL: 2000,
      },
      // Ativo de outra classe não deve entrar
      {
        assetId: "5",
        ticker: "PETR4",
        assetClass: "Ações",
        sector: "Petróleo",
        valueBRL: 15000,
      },
    ];

    const result = calculateFiiExposure(mockPositions);

    // Total de FIIs = 6000 + 4000 + 8000 + 2000 = 20.000
    expect(result.totalValueBRL).toBe(20000);
    expect(result.totalCostBRL).toBe(19000);
    expect(result.unrealizedPnl).toBe(1000);
    expect(result.unrealizedPct).toBe(5.3);
    expect(result.totalAssetsCount).toBe(4);

    // Tijolo = HGLG11 (6000) + XPML11 (4000) = 10000 (50%)
    expect(result.groups.tijolo.valueBRL).toBe(10000);
    expect(result.groups.tijolo.pct).toBe(50);
    expect(result.groups.tijolo.count).toBe(2);

    // Papel = MXRF11 (8000) = 40%
    expect(result.groups.papel.valueBRL).toBe(8000);
    expect(result.groups.papel.pct).toBe(40);

    // Agro = RZTR11 (2000) = 10%
    expect(result.groups.agro_infra.valueBRL).toBe(2000);
    expect(result.groups.agro_infra.pct).toBe(10);

    // Top categoria = Tijolo
    expect(result.topCategory?.key).toBe("tijolo");
    expect(result.isConcentrated).toBe(false);
  });

  it("alerta quando há concentração excessiva (>= 70%) em uma única categoria de FII", () => {
    const concentratedPositions = [
      {
        assetId: "1",
        ticker: "KNIP11",
        assetClass: "FIIs",
        sector: "Imobiliário / Papel e CRI",
        valueBRL: 16000,
      },
      {
        assetId: "2",
        ticker: "HGLG11",
        assetClass: "FIIs",
        sector: "Imobiliário / Logística",
        valueBRL: 4000,
      },
    ];

    const result = calculateFiiExposure(concentratedPositions);
    expect(result.totalValueBRL).toBe(20000);
    expect(result.groups.papel.pct).toBe(80);
    expect(result.isConcentrated).toBe(true);
    expect(result.topCategory?.key).toBe("papel");
  });

  it("trata lista vazia com segurança", () => {
    const result = calculateFiiExposure([]);
    expect(result.totalValueBRL).toBe(0);
    expect(result.totalAssetsCount).toBe(0);
    expect(result.topCategory).toBeNull();
    expect(result.isConcentrated).toBe(false);
  });
});

describe("Motor Puro de Exposição de Renda Fixa (calculateFixedIncomeExposure)", () => {
  it("decompõe corretamente por indexador e por risco de crédito/emissor", () => {
    const mockPositions = [
      {
        assetId: "rf-1",
        ticker: "TESOURO SELIC 2029",
        assetClass: "Renda Fixa",
        sector: "Pós-fixado (Selic / CDI)",
        valueBRL: 10000,
      },
      {
        assetId: "rf-2",
        ticker: "TESOURO IPCA+ 2035",
        assetClass: "Renda Fixa",
        sector: "Inflação (IPCA+)",
        valueBRL: 15000,
      },
      {
        assetId: "rf-3",
        ticker: "CDB 110% CDI BANCO INTER",
        assetClass: "Renda Fixa",
        sector: "Pós-fixado (Selic / CDI)",
        valueBRL: 15000,
      },
      {
        assetId: "rf-4",
        ticker: "LCI IPCA+ 6%",
        assetClass: "Renda Fixa",
        sector: "Inflação (IPCA+)",
        valueBRL: 5000,
      },
      {
        assetId: "rf-5",
        ticker: "DEBÊNTURE INCENTIVADA VALE",
        assetClass: "Renda Fixa",
        sector: "Crédito Privado (CRI / CRA / Debêntures)",
        valueBRL: 5000,
      },
    ];

    const mockAssets: PortfolioAsset[] = [
      {
        id: "rf-4",
        user_id: "u1",
        ticker: "LCI IPCA+ 6%",
        asset_class: "Renda Fixa",
        currency: "BRL",
        quantity: 5000,
        average_price: 1,
        fixed_income_metadata: {
          rate_type: "ipca",
          rate_value: 6,
          base_date: "2026-01-01",
          is_tax_exempt: true,
          issuer_type: "bancario_fgc",
        },
      },
      {
        id: "rf-5",
        user_id: "u1",
        ticker: "DEBÊNTURE INCENTIVADA VALE",
        asset_class: "Renda Fixa",
        currency: "BRL",
        quantity: 5000,
        average_price: 1,
        fixed_income_metadata: {
          rate_type: "ipca",
          rate_value: 6.5,
          base_date: "2026-01-01",
          is_tax_exempt: true,
          issuer_type: "credito_privado",
        },
      },
    ];

    const result = calculateFixedIncomeExposure(mockPositions, mockAssets);

    // Total = 10000 + 15000 + 15000 + 5000 + 5000 = 50.000
    expect(result.totalValueBRL).toBe(50000);
    expect(result.totalAssetsCount).toBe(5);

    // Indexadores:
    // Selic/CDI = 10.000 (Tesouro Selic) + 15.000 (CDB) = 25.000 (50%)
    expect(result.byIndexer.cdi.valueBRL + result.byIndexer.selic.valueBRL).toBe(25000);

    // IPCA = 15.000 (Tesouro IPCA) + 5.000 (LCI IPCA) + 5.000 (Debenture IPCA) = 25.000 (50%)
    expect(result.byIndexer.ipca.valueBRL).toBe(25000);
    expect(result.byIndexer.ipca.pct).toBe(50);

    // Emissores:
    // Tesouro Direto = 10.000 + 15.000 = 25.000 (50%)
    expect(result.byIssuer.tesouro.valueBRL).toBe(25000);
    expect(result.byIssuer.tesouro.pct).toBe(50);

    // Bancário FGC = 15.000 (CDB) + 5.000 (LCI) = 20.000 (40%)
    expect(result.byIssuer.bancario_fgc.valueBRL).toBe(20000);
    expect(result.byIssuer.bancario_fgc.pct).toBe(40);

    // Crédito Privado = 5.000 (Debênture) = 10%
    expect(result.byIssuer.credito_privado.valueBRL).toBe(5000);
    expect(result.byIssuer.credito_privado.pct).toBe(10);

    // Isenção Fiscal:
    // LCI (5.000) + Debênture Incentivada (5.000) = 10.000 (20%)
    expect(result.taxExemptValueBRL).toBe(10000);
    expect(result.taxExemptPct).toBe(20);
  });
});

describe("Motor Puro de Exposição de Ações Brasil (calculateStocksExposure)", () => {
  it("decompõe corretamente ações por perfil cíclico (BESST vs Commodities vs Doméstico) e por porte (Cap Size)", () => {
    const mockPositions = [
      {
        assetId: "stk-1",
        ticker: "ITUB4",
        assetClass: "Ações",
        sector: "Financeiro / Bancos",
        valueBRL: 10000,
        totalCostBRL: 8000,
      },
      {
        assetId: "stk-2",
        ticker: "EGIE3",
        assetClass: "Ações",
        sector: "Utilidade Pública / Energia Elétrica",
        valueBRL: 10000,
        totalCostBRL: 9000,
      },
      {
        assetId: "stk-3",
        ticker: "VALE3",
        assetClass: "Ações",
        sector: "Materiais Básicos / Mineração",
        valueBRL: 15000,
        totalCostBRL: 16000,
      },
      {
        assetId: "stk-4",
        ticker: "LREN3",
        assetClass: "Ações",
        sector: "Consumo Cíclico / Varejo",
        valueBRL: 5000,
        totalCostBRL: 7000,
      },
    ];

    const result = calculateStocksExposure(mockPositions);

    // Total = 10000 + 10000 + 15000 + 5000 = 40.000
    expect(result.totalValueBRL).toBe(40000);
    expect(result.totalCostBRL).toBe(40000);
    expect(result.unrealizedPnl).toBe(0);
    expect(result.unrealizedPct).toBe(0);
    expect(result.totalAssetsCount).toBe(4);

    // Perfil:
    // Defensivo BESST = ITUB4 (10k) + EGIE3 (10k) = 20k (50%)
    expect(result.byProfile.defensivo_besst.valueBRL).toBe(20000);
    expect(result.byProfile.defensivo_besst.pct).toBe(50);
    expect(result.byProfile.defensivo_besst.count).toBe(2);

    // Commodities = VALE3 (15k) = 37.5%
    expect(result.byProfile.commodities.valueBRL).toBe(15000);
    expect(result.byProfile.commodities.pct).toBe(37.5);

    // Cíclico Doméstico = LREN3 (5k) = 12.5%
    expect(result.byProfile.ciclico_domestico.valueBRL).toBe(5000);
    expect(result.byProfile.ciclico_domestico.pct).toBe(12.5);

    // Cap Size:
    // Large Cap = ITUB4 (10k) + EGIE3 (10k) + VALE3 (15k) = 35k (87.5%)
    expect(result.byCapSize.large_cap.valueBRL).toBe(35000);
    expect(result.byCapSize.large_cap.pct).toBe(87.5);

    // Mid Cap = LREN3 (5k) = 12.5%
    expect(result.byCapSize.mid_cap.valueBRL).toBe(5000);
    expect(result.byCapSize.mid_cap.pct).toBe(12.5);

    // Top profile
    expect(result.topProfile?.key).toBe("defensivo_besst");
    expect(result.isConcentrated).toBe(false);
  });

  it("alerta quando há concentração excessiva (>= 60%) em um perfil", () => {
    const mockPositions = [
      {
        assetId: "stk-1",
        ticker: "VALE3",
        assetClass: "Ações",
        valueBRL: 7000,
      },
      {
        assetId: "stk-2",
        ticker: "PETR4",
        assetClass: "Ações",
        valueBRL: 3000,
      },
    ];

    const result = calculateStocksExposure(mockPositions);
    expect(result.totalValueBRL).toBe(10000);
    expect(result.byProfile.commodities.pct).toBe(100);
    expect(result.isConcentrated).toBe(true);
    expect(result.topProfile?.key).toBe("commodities");
  });
});

describe("Motor Puro de Exposição Internacional (calculateInternationalExposure)", () => {
  it("decompõe ativos internacionais por geografia e por veículo de custódia (USD direto vs BDR)", () => {
    const mockPositions = [
      {
        assetId: "intl-1",
        ticker: "VOO",
        assetClass: "Internacional",
        sector: "Índice Amplo S&P 500",
        valueBRL: 20000,
        totalCostBRL: 18000,
      },
      {
        assetId: "intl-2",
        ticker: "VT",
        assetClass: "Internacional",
        sector: "Mercados Globais All-World",
        valueBRL: 10000,
        totalCostBRL: 10000,
      },
      {
        assetId: "intl-3",
        ticker: "AAPL34",
        assetClass: "Internacional",
        sector: "Tecnologia / BDR",
        valueBRL: 10000,
        totalCostBRL: 9000,
      },
    ];

    const result = calculateInternationalExposure(mockPositions);

    // Total = 20k + 10k + 10k = 40.000
    expect(result.totalValueBRL).toBe(40000);
    expect(result.totalAssetsCount).toBe(3);

    // Veículo de custódia:
    // Moeda forte USD = VOO (20k) + VT (10k) = 30k (75%)
    expect(result.byVehicle.moeda_forte_usd.valueBRL).toBe(30000);
    expect(result.byVehicle.moeda_forte_usd.pct).toBe(75);
    expect(result.usdDirectValueBRL).toBe(30000);
    expect(result.usdDirectPct).toBe(75);

    // BDR na B3 = AAPL34 (10k) = 25%
    expect(result.byVehicle.bdr_brl.valueBRL).toBe(10000);
    expect(result.byVehicle.bdr_brl.pct).toBe(25);

    // Geografia:
    // EUA = VOO (20k) + AAPL34 (10k) = 30k (75%)
    expect(result.byRegion.eua.valueBRL).toBe(30000);
    expect(result.byRegion.eua.pct).toBe(75);

    // Global = VT (10k) = 25%
    expect(result.byRegion.global.valueBRL).toBe(10000);
    expect(result.byRegion.global.pct).toBe(25);

    // Alerta de concentração >= 70%
    expect(result.topRegion?.key).toBe("eua");
    expect(result.isConcentrated).toBe(true);
  });
});

describe("Detecção de Safra Efetiva por Classe (detectClassInceptions)", () => {
  it("calcula corretamente meses decorridos entre duas datas", () => {
    // 2024-01-01 a 2026-11-01: (2026-2024)*12 + (11-1) + 1 = 35 meses
    expect(calculateMonthsElapsed("2024-01-01", "2026-11-01")).toBe(35);
    // Mesmo mês: 1 mês
    expect(calculateMonthsElapsed("2026-11-01", "2026-11-05")).toBe(1);
  });

  it("identifica safras distintas a partir de transações, metadados de RF e criação", () => {
    const mockAssets = [
      {
        id: "a1",
        ticker: "VALE3",
        assetClass: "Ações",
        createdAt: "2026-03-01T10:00:00Z",
      },
      {
        id: "a2",
        ticker: "HGLG11",
        assetClass: "FIIs",
        createdAt: "2026-05-01T10:00:00Z",
      },
      {
        id: "a3",
        ticker: "CDB 100% CDI",
        assetClass: "Renda Fixa",
        fixedIncomeMetadata: {
          rate_type: "cdi" as const,
          rate_value: 100,
          base_date: "2024-01-01",
          initial_investment_date: "2024-01-01",
        },
      },
      {
        id: "a4",
        ticker: "VOO",
        assetClass: "Internacional",
        createdAt: "2026-10-15T10:00:00Z",
      },
    ];

    const mockTransactions = [
      {
        assetId: "a1",
        ticker: "VALE3",
        date: "2026-01-10",
      },
      {
        assetId: "a2",
        ticker: "HGLG11",
        date: "2026-06-01",
      },
    ];

    const inceptions = detectClassInceptions(mockAssets, mockTransactions, "2026-11-01");

    // Renda Fixa: começou em 2024-01-01 -> ~35 meses
    expect(inceptions.fixed_income.firstDate).toBe("2024-01-01");
    expect(inceptions.fixed_income.monthsActive).toBeGreaterThanOrEqual(34);
    expect(inceptions.fixed_income.isMaturing).toBe(false);

    // Ações: primeira compra em 2026-01-10 -> 11 meses
    expect(inceptions.stocks.firstDate).toBe("2026-01-10");
    expect(inceptions.stocks.monthsActive).toBe(11);
    expect(inceptions.stocks.isMaturing).toBe(false);

    // FIIs: menor entre transação (2026-06-01) e criação (2026-05-01) -> 2026-05-01 (~7 meses)
    expect(inceptions.fiis.firstDate).toBe("2026-05-01");
    expect(inceptions.fiis.monthsActive).toBe(7);
    expect(inceptions.fiis.isMaturing).toBe(false);

    // Internacional: criado em 2026-10-15 -> ~2 meses (< 3 meses => maturing)
    expect(inceptions.international.firstDate).toBe("2026-10-15");
    expect(inceptions.international.monthsActive).toBe(2);
    expect(inceptions.international.isMaturing).toBe(true);

    // Total: menor data global (2024-01-01)
    expect(inceptions.total.firstDate).toBe("2024-01-01");
    expect(inceptions.total.monthsActive).toBeGreaterThanOrEqual(34);
  });

  it("limita safras ao marco zero quando informado (Marco Zero Ground Truth)", () => {
    const mockAssets = [
      {
        id: "a1",
        ticker: "VALE3",
        assetClass: "Ações",
        createdAt: "2020-01-01T00:00:00Z", // Antigo, mas o usuário só entrou no app em 2026-08
      },
    ];

    const inceptions = detectClassInceptions(
      mockAssets,
      [],
      "2026-11-01",
      "2026-08", // Marco Zero no aplicativo
    );

    expect(inceptions.stocks.firstDate).toBe("2026-08-01");
    expect(inceptions.stocks.monthsActive).toBe(4); // Ago, Set, Out, Nov = 4 meses
    expect(inceptions.stocks.isMaturing).toBe(false);
  });
});
