import { describe, expect, it } from "vitest";
import {
  sellAssetPosition,
  calculateReconciledAssetPosition,
} from "@/domain/portfolio/operations";
import { filterPeriodRedemptions } from "@/domain/reports/period-redemptions";
import {
  createCanonicalAssetHolding,
} from "@/domain/portfolio/canonical-types";
import {
  getInternationalProfile,
  resolveFixedIncomeIndexer,
  INTERNATIONAL_VEHICLE_LABELS,
} from "@/domain/portfolio/tickers-catalog";
import {
  calculateFixedIncomeExposure,
  calculateInternationalExposure,
} from "@/domain/portfolio/class-breakdown";
import {
  formatFixedIncomeRateLabel,
} from "@/domain/portfolio/fixed-income";
import { formatFixedIncomeRateLabel as formatGroupingRateLabel } from "@/domain/portfolio/position-grouping";
import {
  getActiveCustodyPositions,
  positionPnl,
} from "@/domain/portfolio/valuation";

describe("Auditoria Forense e Certificação de Produção — Axir Engine v4", () => {
  // -------------------------------------------------------------------------
  // Gate v4.1: Baixa Proporcional de Custo em Renda Fixa (Proportional Cost Abatement)
  // -------------------------------------------------------------------------
  describe("Gate v4.1: Baixa Proporcional de Custo em Renda Fixa", () => {
    it("preserva a taxa de rentabilidade contábil após resgate parcial de Renda Fixa", () => {
      // Cenário canônico de especificação:
      // Saldo pré-resgate: R$ 8.000,00
      // Custo pré-resgate: R$ 6.000,00 (Rentabilidade: +33,33%)
      // Resgate parcial: R$ 1.000,00
      // Proporção baixada: 1.000 / 8.000 = 12,5%
      // Custo baixado: 6.000 * 0,125 = R$ 750,00
      // Saldo pós-resgate: R$ 7.000,00
      // Custo pós-resgate: 6.000 - 750 = R$ 5.250,00
      // Lucro Realizado da operação: 1.000 - 750 = +R$ 250,00
      // Rentabilidade pós-resgate preservada: (7.000 - 5.250) / 5.250 = +33,33%

      // Simulação via sellAssetPosition informando valor pré-resgate
      const sellResult = sellAssetPosition({
        currentQuantity: 1,
        currentTotalCost: 6000,
        sellQuantity: 1,
        sellPrice: 1000,
        isTotalValue: true,
        currentGrossBalance: 8000,
      });

      expect(sellResult.costOfSoldQuantity).toBe(750);
      expect(sellResult.remainingTotalCost).toBe(5250);
      expect(sellResult.realizedPnl).toBe(250);

      // Verificação da rentabilidade pós-resgate
      const pnlPos = positionPnl(7000, sellResult.remainingTotalCost);
      expect(pnlPos.unrealizedPct).toBe(33.33);

      // Reconciliação do ledger ao excluir uma movimentação de resgate
      const reconciled = calculateReconciledAssetPosition({
        currentQuantity: 1,
        currentAveragePrice: 5250,
        isTotalValue: true,
        removedTransaction: {
          type: "sell",
          quantity: 1,
          price: 1000,
          total: 1000,
          total_cost_brl: 750,
        },
        remainingTransactions: [],
      });

      expect(reconciled.newTotalCost).toBe(6000);
    });

    it("elimina o prejuízo fictício em resgate de Renda Fixa no period-redemptions", () => {
      const redemptions = filterPeriodRedemptions({
        year: 2026,
        month: "2026-11",
        transactions: [
          {
            id: "tx-selic-resgate",
            asset_id: "asset-selic-31",
            type: "sell",
            date: "2026-11-05",
            quantity: 1,
            price: 5000,
            total: 5000,
          },
        ],
        assets: [
          {
            id: "asset-selic-31",
            ticker: "TESOURO-SELIC-31",
            asset_class: "Renda Fixa",
            quantity: 1,
            average_price: 10000, // Custo inicial acumulado
            currency: "BRL",
            fixed_income_metadata: {
              rate_type: "selic",
              rate_value: 100,
              base_date: "2024-01-01",
              initial_investment_date: "2024-01-01",
              base_value: 10000,
            },
          },
        ],
      });

      expect(redemptions.length).toBe(1);
      const item = redemptions[0]!;
      // O custo baixado não pode abater 100% dos R$ 10.000 gerando prejuízo falso
      expect(item.realizedPnlBRL).toBeGreaterThanOrEqual(0);
      expect(item.realizedPnlBRL).not.toBe(-9577.18);
    });
  });

  // -------------------------------------------------------------------------
  // Gate v4.2 & v4.3: Internacional Blindado, Câmbio & Segregação IVVB11
  // -------------------------------------------------------------------------
  describe("Gate v4.2 & v4.3: Internacional Blindado & Câmbio", () => {
    it("classifica IVVB11 como ETF B3 / BDR (Custódia BRL) e ativos USD como Moeda Forte Direta", () => {
      expect(INTERNATIONAL_VEHICLE_LABELS.bdr_brl).toBe("ETF B3 / BDR (Custódia BRL)");

      // IVVB11 negociado em BRL na B3
      const ivvb11Profile = getInternationalProfile({
        ticker: "IVVB11",
        currency: "BRL",
      });
      expect(ivvb11Profile.vehicle).toBe("bdr_brl");
      expect(ivvb11Profile.region).toBe("eua");

      // BDR AAPL34 negociado em BRL na B3
      const aaplBdrProfile = getInternationalProfile({
        ticker: "AAPL34",
        currency: "BRL",
      });
      expect(aaplBdrProfile.vehicle).toBe("bdr_brl");

      // Ativo direto nos EUA em USD
      const indaProfile = getInternationalProfile({
        ticker: "INDA",
        currency: "USD",
      });
      expect(indaProfile.vehicle).toBe("moeda_forte_usd");
      expect(indaProfile.region).toBe("emergentes");

      const sphqProfile = getInternationalProfile({
        ticker: "SPHQ",
        currency: "USD",
      });
      expect(sphqProfile.vehicle).toBe("moeda_forte_usd");
      expect(sphqProfile.region).toBe("eua");
    });

    it("aplica salvaguarda contra gravação de custo USD em BRL eliminando retorno anômalo (+786,6%)", () => {
      // Simulação do bug: ativo USD onde totalCostNative = $480.00,
      // mas totalCostBRL foi passado inadvertidamente como 480.00 (ao invés de ~R$ 2.500)
      const holding = createCanonicalAssetHolding({
        assetId: "asset-inda",
        ticker: "INDA",
        assetClass: "Internacional",
        currency: "USD",
        quantity: 10,
        averageCost: 48,
        totalCost: 480, // USD
        totalCostBRL: 480, // Valor anômalo em BRL (menor que 2.5x custo nativo)
        resolvedPrice: {
          ticker: "INDA",
          priceQuote: 55,
          priceBRL: 55 * 5.25, // R$ 288.75
          usdRate: 5.25,
          source: "api",
          isEstimate: false,
          asOfDate: "2026-11-19",
        },
      });

      // Custo BRL recalculado via taxa PTAX: 480 * 5.25 = R$ 2.520,00
      expect(holding.totalCostBRL).toBe(2520);
      expect(holding.marketValueBRL).toBe(2887.5);
      // Retorno percentual coerente e são (~+14,58%), nunca +786,6%
      expect(holding.totalReturnPct).toBeCloseTo(14.58, 2);
      expect(holding.totalReturnPct).not.toBeGreaterThan(100);
    });

    it("agrega segregação de exposição internacional corretamente", () => {
      const positions = [
        {
          ticker: "IVVB11",
          assetClass: "Internacional",
          valueBRL: 2250,
          currency: "BRL",
        },
        {
          ticker: "VOO",
          assetClass: "Internacional",
          valueBRL: 7750,
          currency: "USD",
        },
      ];

      const exposure = calculateInternationalExposure(positions);
      expect(exposure.totalValueBRL).toBe(10000);

      // Veículo BDR / B3 deve ter 22,5% e USD Direto deve ter 77,5%
      const bdrGroup = exposure.byVehicle.bdr_brl;
      const usdGroup = exposure.byVehicle.moeda_forte_usd;

      expect(bdrGroup.pct).toBe(22.5);
      expect(usdGroup.pct).toBe(77.5);
    });
  });

  // -------------------------------------------------------------------------
  // Gate v4.4: Posições Ativas Unificadas (62 Ativos / 20 RF) e Sinal de Fluxo
  // -------------------------------------------------------------------------
  describe("Gate v4.4: Posições Ativas e Consistência de Filtros", () => {
    it("exclui ativos zerados/vencidos e ativos de caixa via getActiveCustodyPositions", () => {
      const mixedPositions = [
        { ticker: "PETR4", quantity: 100, valueBRL: 3500, isCash: false },
        { ticker: "VALE3", quantity: 50, valueBRL: 3000, isCash: false },
        { ticker: "CAIXA", quantity: 500, valueBRL: 500, isCash: true },
        { ticker: "CDB-FACTA", quantity: 0, valueBRL: 0, isCash: false }, // Vencido/Liquidado
        { ticker: "CDB-RODOBENS", quantity: 1, valueBRL: 0, isCash: false }, // Zerado
      ];

      const active = getActiveCustodyPositions(mixedPositions);
      expect(active.length).toBe(2);
      expect(active.map((p) => p.ticker)).toEqual(["PETR4", "VALE3"]);
    });

    it("filtra títulos vencidos na exposição de Renda Fixa em class-breakdown", () => {
      const rfPositions = [
        { ticker: "CDB-BANCO-1", assetClass: "Renda Fixa", quantity: 1, valueBRL: 5000 },
        { ticker: "CDB-BANCO-2", assetClass: "Renda Fixa", quantity: 1, valueBRL: 3000 },
        { ticker: "CDB-FACTA", assetClass: "Renda Fixa", quantity: 0, valueBRL: 0 }, // Zerado
        { ticker: "CDB-RODOBENS", assetClass: "Renda Fixa", quantity: 0, valueBRL: 0 }, // Zerado
      ];

      const rfResult = calculateFixedIncomeExposure(rfPositions);
      expect(rfResult.totalAssetsCount).toBe(2);
      expect(rfResult.totalValueBRL).toBe(8000);
    });
  });

  // -------------------------------------------------------------------------
  // Gate v4.5: Classificador RF, Indexador Soberano e Rótulo Limpo
  // -------------------------------------------------------------------------
  describe("Gate v4.5: Classificador Soberano e Supressão de 0% a.a.", () => {
    it("classifica TESOURO-IPCA-32 como Inflação (IPCA+) mesmo se rate_type for pre por fallback", () => {
      const result = resolveFixedIncomeIndexer({
        ticker: "TESOURO-IPCA-32",
        fixed_income_metadata: {
          rate_type: "pre", // Fallback espúrio
          rate_value: 0,
          base_date: "2026-11-01",
        },
      });

      expect(result.macroKey).toBe("ipca");
      expect(result.macroLabel).toBe("Inflação (IPCA+)");
      expect(result.detailKey).toBe("ipca");
    });

    it("suprime '0% a.a.' e 'IPCA + 0% a.a.' em formatFixedIncomeRateLabel", () => {
      // Prefixado sem taxa informada
      expect(formatFixedIncomeRateLabel({ rate_type: "pre", rate_value: 0 })).toBe("Prefixado");

      // IPCA sem spread informado
      expect(formatFixedIncomeRateLabel({ rate_type: "ipca", rate_value: 0 })).toBe("IPCA+");

      // Selic sem taxa
      expect(formatFixedIncomeRateLabel({ rate_type: "selic", rate_value: 0 })).toBe("SELIC");

      // CDI sem taxa
      expect(formatFixedIncomeRateLabel({ rate_type: "cdi", rate_value: 0 })).toBe("CDI");

      // Com taxa preenchida (preserva formatação correta)
      expect(formatFixedIncomeRateLabel({ rate_type: "pre", rate_value: 12.5 })).toBe("12,5% a.a.");
      expect(formatFixedIncomeRateLabel({ rate_type: "ipca", rate_value: 6.2 })).toBe("IPCA + 6,2% a.a.");
    });

    it("formata rótulo de agrupamento sem ruído de 0% em position-grouping", () => {
      expect(
        formatGroupingRateLabel({
          fixedIncomeMetadata: { rate_type: "pre", rate_value: 0, base_date: "2026-11-01" },
        }),
      ).toBe("Prefixado");

      expect(
        formatGroupingRateLabel({
          fixedIncomeMetadata: { rate_type: "ipca", rate_value: 0, base_date: "2026-11-01" },
        }),
      ).toBe("IPCA+");
    });
  });
});
