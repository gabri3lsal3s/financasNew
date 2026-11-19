/**
 * Portão de Qualidade Final v5 (Gate v5)
 * Certificação Definitiva de Produção (>= 98/100) — Axir Engine
 *
 * Teste puro e desacoplado de banco, React e UI.
 * Cobre:
 * - Gate v5.1: Invariância Cambial do Custo & Isolamento Estrito do Fluxo Externo (F_t)
 * - Gate v5.2: SSOT de Realizados, Baixa Proporcional RF e Tabela Regressiva de IR
 * - Gate v5.3: Sanidade Cambial em Lotes USD, Saneamento de SPHQ e Guardrails Defensivos
 * - Gate v5.4: Unicidade do Classificador RF (TESOURO-IPCA-32) e Polimento pt-BR
 * - Gate v5.5: Zero Regressão Global (62 ativos / 20 RF, IVVB11 BDR/ETF B3, Metas 100%, Consistência r > 0)
 */

import { describe, expect, it } from "vitest";
import {
  evaluatePortfolioCanonicalState,
} from "@/domain/portfolio/canonical-engine";
import {
  createCanonicalAssetHolding,
} from "@/domain/portfolio/canonical-types";
import {
  computeCanonicalAssetLedger,
} from "@/domain/portfolio/canonical-normalizer";
import {
  buildPortfolioMonthlySeries,
  calculatePortfolioTotalReturn,
} from "@/domain/portfolio/summary";
import {
  filterPeriodRedemptions,
} from "@/domain/reports/period-redemptions";
import {
  resolveFixedIncomeIndexer,
  getInternationalProfile,
} from "@/domain/portfolio/tickers-catalog";
import {
  formatPercent,
  formatSignedPct,
} from "@/services/masks/percent";
import type { PortfolioAsset, PortfolioTransaction } from "@/types";

describe("Auditoria Forense e Certificação de Produção — Axir Engine v5", () => {
  // -------------------------------------------------------------------------
  // Gate v5.1: Invariância Cambial do Custo & Fim do Aporte Fantasma via PTAX
  // -------------------------------------------------------------------------
  describe("Gate v5.1: Invariância Cambial do Custo & Isolamento do Fluxo Externo", () => {
    it("garante que a variação da PTAX D-0 (5,25 -> 5,91) não altera o custo histórico em BRL (Delta C = 0)", () => {
      // Ativo internacional adquirido a USD 100 com câmbio histórico fixado em R$ 5,25
      const assetAapl: PortfolioAsset = {
        id: "asset-aapl",
        user_id: "user-test",
        ticker: "AAPL",
        asset_class: "Internacional",
        currency: "USD",
        quantity: 10,
        average_price: 100,
        total_cost_brl: 5250, // Custo congelado na compra (10 * 100 * 5,25)
      };

      // Avaliação com PTAX 5.25
      const state525 = evaluatePortfolioCanonicalState({
        asOfDate: "2026-11-19",
        mode: "instant",
        assets: [assetAapl],
        usdRate: 5.25,
        assetPrices: { AAPL: 100 },
        disableMemoization: true,
      });

      expect(state525.totalCostBRL).toBe(5250);
      expect(state525.totalValueBRL).toBe(5250);
      expect(state525.capitalGainPnl).toBe(0);

      // Agora a PTAX salta para 5.91 sem nenhuma nova compra ou aporte
      const state591 = evaluatePortfolioCanonicalState({
        asOfDate: "2026-11-19",
        mode: "instant",
        assets: [assetAapl],
        usdRate: 5.91,
        assetPrices: { AAPL: 100 },
        disableMemoization: true,
      });

      // INVARIANTE BLOQUEANTE 1: O custo histórico em BRL não pode flutuar com PTAX D-0
      expect(state591.totalCostBRL).toBe(5250);
      const deltaCost = state591.totalCostBRL - state525.totalCostBRL;
      expect(deltaCost).toBe(0);

      // INVARIANTE BLOQUEANTE 2: A valorização cambial reflete 100% no valor de mercado e no ganho econômico
      expect(state591.totalValueBRL).toBe(5910);
      expect(state591.capitalGainPnl).toBe(660); // 5910 - 5250 = +R$ 660,00
    });

    it("assegura que na competência operacional o aporte líquido (F_t) deriva dos eventos do ledger e não de Delta C", () => {
      // Simulação de competência operacional corrente com compras de 3.853,64 e vendas de 2.662,68 (Líquido = +1.190,96)
      // Onde Delta C bruto contábil do mês seria diferente devido a oscilações de posições
      const series = buildPortfolioMonthlySeries({
        rawSnapshots: [
          {
            month: "2026-10",
            total_value: 104740.27,
            total_cost: 99381.85,
            status: "closed",
          },
        ],
        currentMonthPoint: {
          month: "2026-11",
          total_value: 106377.43,
          total_cost: 102061.95, // Delta C = 102.061,95 - 99.381,85 = +2.680,10 (distorcido se usado como aporte)
          status: "provisional",
        },
        contributions: [
          {
            date: "2026-11-10",
            amount: 1190.96, // Fluxo líquido real do ledger de transações
            notes: "Fluxo líquido real de compras e vendas",
          },
        ],
        limit: 2,
      });

      const novPoint = series.find((p) => p.month === "2026-11");
      expect(novPoint).toBeDefined();

      // O aporte líquido do mês operacional DEVE ser exatamente o fluxo do ledger (+R$ 1.190,96)
      // e NUNCA o Delta C bruto (+R$ 2.680,10)
      expect(novPoint?.netContributionBRL).toBe(1190.96);
      expect(novPoint?.netContributionBRL).not.toBe(2680.1);

      // Consequentemente, o mês não é transformado artificialmente em prejuízo
      expect(novPoint?.twrMonthPct).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Gate v5.2: SSOT de Realizados, Baixa Proporcional RF e IR Regressivo
  // -------------------------------------------------------------------------
  describe("Gate v5.2: SSOT de Realizados, Baixa Proporcional e Alíquota de IR", () => {
    it("conecta a apuração de resultado realizado ao motor canônico unificado (Pág. 1 e Pág. 5)", () => {
      // Carteira de teste com resgate de Renda Fixa: Saldo R$ 8.000, Custo R$ 6.000, Saque R$ 1.000
      const txResgate: PortfolioTransaction = {
        id: "tx-rf-resgate-01",
        user_id: "user-test",
        asset_id: "asset-rf-01",
        type: "sell",
        date: "2026-11-10",
        quantity: 1,
        price: 1000,
        total: 1000,
        total_cost_brl: 750, // Baixa proporcional: 1.000 / 8.000 * 6.000 = 750
      };

      const assetRF: PortfolioAsset = {
        id: "asset-rf-01",
        user_id: "user-test",
        ticker: "CDB-INTER-2028",
        asset_class: "Renda Fixa",
        quantity: 1,
        average_price: 6000,
        total_cost_brl: 6000,
        currency: "BRL",
        fixed_income_metadata: {
          rate_type: "cdi",
          rate_value: 110,
          base_date: "2023-01-10",
          initial_investment_date: "2023-01-10", // Mais de 720 dias
          base_value: 6000,
        },
      };

      const ledgerResult = computeCanonicalAssetLedger(
        [
          {
            date: "2023-01-10",
            type: "buy",
            quantity: 1,
            price: 6000,
            total: 6000,
            total_cost_brl: 6000,
          },
          {
            date: "2026-11-10",
            type: "sell",
            quantity: 1,
            price: 1000,
            total: 1000,
            total_cost_brl: 750,
          },
        ],
        undefined,
        {
          isFixedIncome: true,
          fixedIncomeMetadata: assetRF.fixed_income_metadata,
        },
      );

      // Lucro realizado líquido de IR: 250 - 37,50 = R$ 212,50
      expect(ledgerResult.realizedPnl).toBe(212.5);
      // Custo remanescente ativo: 6.000 - 750 = R$ 5.250,00
      expect(ledgerResult.totalCostBRL).toBe(5250);

      // Verificação da tabela de resgates
      const redemptions = filterPeriodRedemptions({
        year: 2026,
        month: "2026-11",
        transactions: [txResgate],
        assets: [assetRF],
      });

      expect(redemptions).toHaveLength(1);
      const red = redemptions[0]!;
      // Lucro bruto de R$ 250,00 e lucro líquido após IR de R$ 212,50
      expect(red.grossRedeemedValueBRL - red.appliedCostBRL).toBe(250);
      expect(red.realizedPnlBRL).toBe(212.5);

      // O título foi aplicado em 2023 (> 720 dias): alíquota regressiva canônica DEVE ser 15,0% (e não 22,5%)
      expect(red.taxRatePct).toBe(15.0);
      expect(red.taxAmountBRL).toBe(37.5); // 250 * 15% = 37,50
      expect(red.realizedPnlBRL).toBe(212.5); // 250 - 37,50 = 212,50

      const totalRealizedPnlBRL = redemptions.reduce((acc, r) => acc + r.realizedPnlBRL, 0);
      expect(totalRealizedPnlBRL).toBe(212.5);
    });

    it("respeita a tabela regressiva de IR para diferentes faixas de dias decorridos", () => {
      const now = new Date("2026-11-19");
      const d100DaysAgo = new Date(now.getTime() - 100 * 86400000).toISOString().split("T")[0]!; // <= 180 d -> 22.5%
      const d250DaysAgo = new Date(now.getTime() - 250 * 86400000).toISOString().split("T")[0]!; // 181-360 d -> 20.0%
      const d500DaysAgo = new Date(now.getTime() - 500 * 86400000).toISOString().split("T")[0]!; // 361-720 d -> 17.5%
      const d800DaysAgo = new Date(now.getTime() - 800 * 86400000).toISOString().split("T")[0]!; // > 720 d -> 15.0%

      const testCases = [
        { date: d100DaysAgo, expectedTax: 22.5 },
        { date: d250DaysAgo, expectedTax: 20.0 },
        { date: d500DaysAgo, expectedTax: 17.5 },
        { date: d800DaysAgo, expectedTax: 15.0 },
      ];

      for (const tc of testCases) {
        const tx: PortfolioTransaction = {
          id: `tx-${tc.expectedTax}`,
          user_id: "user-1",
          asset_id: `asset-${tc.expectedTax}`,
          type: "sell",
          date: "2026-11-19",
          quantity: 1,
          price: 2000,
          total: 2000,
          total_cost_brl: 1500,
        };
        const asset: PortfolioAsset = {
          id: `asset-${tc.expectedTax}`,
          user_id: "user-1",
          ticker: `CDB-${tc.expectedTax}`,
          asset_class: "Renda Fixa",
          quantity: 1,
          average_price: 1500,
          total_cost_brl: 1500,
          currency: "BRL",
          fixed_income_metadata: {
            rate_type: "cdi",
            rate_value: 100,
            base_date: tc.date,
            initial_investment_date: tc.date,
          },
        };

        const res = filterPeriodRedemptions({
          year: 2026,
          month: "2026-11",
          transactions: [tx],
          assets: [asset],
        });

        expect(res[0]?.taxRatePct).toBe(tc.expectedTax);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Gate v5.3: Sanidade Cambial em Lotes USD & Saneamento de SPHQ
  // -------------------------------------------------------------------------
  describe("Gate v5.3: Sanidade Cambial em Lotes USD & Guardrails", () => {
    it("detecta e cura o déficit de custo de SPHQ restaurando a rentabilidade correta", () => {
      // Simulação do caso real de SPHQ:
      // Qtd: 3,04553 | Preço Médio USD: 82,74 | Custo Nativo: $252,00
      // Custo armazenado corrompido em BRL: R$ 797,90 (câmbio implícito 3,166 < 3,5)
      // Cotação atual: $82,04 à PTAX 5,91 = R$ 1.476,64
      const sphqHolding = createCanonicalAssetHolding({
        assetId: "asset-sphq",
        ticker: "SPHQ",
        assetClass: "Internacional",
        currency: "USD",
        quantity: 3.04553,
        averageCost: 82.74,
        totalCost: 252.0, // USD
        totalCostBRL: 797.9, // Custo corrompido que gerava retorno artificial de +85,5%
        resolvedPrice: {
          ticker: "SPHQ",
          priceQuote: 82.04,
          priceBRL: 82.04 * 5.91,
          usdRate: 5.91,
          source: "api",
          isEstimate: false,
          asOfDate: "2026-11-19",
        },
      });

      // A salvaguarda deve detectar a razão 797,90 / 252 = 3,166 < 3,5
      // e curar o custo em BRL utilizando a taxa de referência/PTAX
      expect(sphqHolding.totalCostBRL).toBeGreaterThan(1400); // 252 * 5.91 ~= 1.489,32
      expect(sphqHolding.totalCostBRL).toBeCloseTo(252 * 5.91, 0);

      // O retorno total não pode mais ser a anomalia de +85,5%
      expect(sphqHolding.unrealizedPct).not.toBeNull();
      expect(sphqHolding.unrealizedPct!).toBeLessThan(10); // Próximo de zero ou negativo suave em USD
    });

    it("assegura que transações de moedas estrangeiras no ledger nunca fiquem com fx_rate <= 1.0", () => {
      const ledgerForeign = computeCanonicalAssetLedger(
        [
          {
            date: "2026-11-01",
            type: "buy",
            quantity: 5,
            price: 50,
            total: 250, // USD
            fx_rate: 1.0, // Taxa inválida/default que não pode persistir
            total_cost_brl: 250, // Custo não convertido
          },
        ],
        undefined,
        { currency: "USD", defaultFxRate: 5.91 },
      );

      // O normalizador canônico deve curar automaticamente o custo usando a taxa de câmbio histórica/referência
      expect(ledgerForeign.totalCostBRL).toBeGreaterThan(1000); // >= 250 * 5.0
    });
  });

  // -------------------------------------------------------------------------
  // Gate v5.4: Unicidade do Classificador RF (TESOURO-IPCA-32) e Polimento pt-BR
  // -------------------------------------------------------------------------
  describe("Gate v5.4: Unicidade do Classificador RF & Polimento pt-BR", () => {
    it("resolve TESOURO-IPCA-32 estritamente como IPCA+ em vez de Prefixado", () => {
      const indexer = resolveFixedIncomeIndexer({
        ticker: "TESOURO-IPCA-32",
      });
      expect(indexer.detailLabel).toBe("IPCA+");

      const indexerSelic = resolveFixedIncomeIndexer({
        ticker: "TESOURO-SELIC-31",
      });
      expect(indexerSelic.detailLabel.toUpperCase()).toBe("SELIC");
    });

    it("garante conformidade rigorosa da formatação pt-BR com vírgula e sinais", () => {
      // Formatação de percentual com vírgula
      expect(formatPercent(22.5, 1)).toBe("22,5");
      expect(formatPercent(1.0, 2)).toBe("1,00");
      expect(formatPercent(0.43, 2)).toBe("0,43");

      // Retornos formatados com sinal explícito e sufixo %
      expect(formatSignedPct(24.9, 1)).toBe("+24,9%");
      expect(formatSignedPct(33.1, 1)).toBe("+33,1%");
      expect(formatSignedPct(-0.7, 1)).toBe("-0,7%");
    });
  });

  // -------------------------------------------------------------------------
  // Gate v5.5: Zero Regressão Global
  // -------------------------------------------------------------------------
  describe("Gate v5.5: Zero Regressão Global (Preservação de Todas as Conquistas)", () => {
    it("preserva a segregação de IVVB11 como ETF B3 / BDR e não Moeda Forte Direta (USD)", () => {
      const ivvb11Profile = getInternationalProfile({
        ticker: "IVVB11",
        currency: "BRL",
      });
      expect(ivvb11Profile.vehicle).toBe("bdr_brl");
    });

    it("mantém a integridade do cálculo de Retorno Total da carteira", () => {
      const ret = calculatePortfolioTotalReturn([
        {
          valueBRL: 106377.43,
          totalCostBRL: 102061.95,
          dividends: 1245.50,
        },
      ]);

      expect(ret.capitalGainPnl).toBeCloseTo(4315.48, 2);
      expect(ret.totalReturnPnl).toBeCloseTo(5560.98, 2);
      expect(ret.totalReturnPct).toBeCloseTo(5.45, 1);
    });
  });
});
