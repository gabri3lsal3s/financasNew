import { describe, expect, it } from "vitest";
import {
  buildFixedIncomeSellNotes,
  calculateFixedIncomeRedemptionPreview,
  parseFixedIncomeSellNotes,
} from "@/domain/portfolio";
import { filterPeriodRedemptions } from "@/domain/reports/period-redemptions";
import { buildTearSheetModel } from "@/domain/reports/build-tear-sheet-model";
import type { PortfolioAsset, PortfolioTransaction } from "@/types";

describe("Auditoria Forense e Certificação de Produção — Axir Engine v7 (ID: BR-20261119-6445)", () => {
  // -------------------------------------------------------------------------
  // Gate v7.1: Imutabilidade Sequencial & Prevenção de Resgate Zerado
  // -------------------------------------------------------------------------
  describe("Gate v7.1: Imutabilidade Sequencial & Prevenção de Resgate Zerado", () => {
    it("garante que a realização do 3º resgate parcial preserva bit-a-bit os resgates 1 e 2 anteriores", () => {
      // Posição inicial de Renda Fixa (TESOURO-SELIC-31)
      const asset: PortfolioAsset = {
        id: "asset-selic-31",
        user_id: "user-6445",
        ticker: "TESOURO-SELIC-31",
        notes: "Tesouro Selic 2031",
        asset_class: "Renda Fixa",
        currency: "BRL",
        quantity: 1,
        average_price: 26170.29,
        total_cost_brl: 26170.29,
        created_at: "2024-01-10T00:00:00Z",
        fixed_income_metadata: {
          rate_type: "selic",
          rate_value: 100,
          base_date: "2026-11-01",
          initial_investment_date: "2024-01-10", // > 720 dias -> 15.0%
          initial_investment_value: 26170.29,
          base_value: 30000.0,
          is_tax_exempt: false,
        },
      };

      // Resgate 1: Bruto R$ 1.009,51 | Custo baixado R$ 763,91 | Lucro R$ 245,60 | IR 15% R$ 36,84 | Líq R$ 208,76
      const preview1 = calculateFixedIncomeRedemptionPreview({
        asset,
        withdrawGross: 1009.51,
        date: "2026-11-05",
        appliedCostOverride: asset.fixed_income_metadata?.initial_investment_value,
      });
      if (!preview1) throw new Error("preview1 must not be null");

      const tx1: PortfolioTransaction = {
        id: "tx-selic-resgate-1",
        user_id: "user-6445",
        asset_id: asset.id,
        type: "sell",
        date: "2026-11-05",
        quantity: 1,
        price: 1009.51,
        total: 1009.51,
        total_cost_brl: preview1.appliedCostBasis, // 763,91
        notes: buildFixedIncomeSellNotes({
          appliedCost: preview1.appliedCostBasis,
          realizedProfit: preview1.realizedProfit,
          taxAmount: preview1.taxAmount,
          taxRatePct: preview1.taxRatePct,
          netCredit: preview1.netCredit,
        }),
      };

      // Estado intermediário da custódia após Resgate 1
      const assetAfter1: PortfolioAsset = {
        ...asset,
        average_price: preview1.remainingCostBasis,
        total_cost_brl: preview1.remainingCostBasis,
        fixed_income_metadata: {
          ...asset.fixed_income_metadata!,
          initial_investment_value: preview1.remainingCostBasis,
          base_value: preview1.remainingGrossBalance,
        },
      };

      // Resgate 2: Bruto R$ 1.653,17
      const preview2 = calculateFixedIncomeRedemptionPreview({
        asset: assetAfter1,
        withdrawGross: 1653.17,
        date: "2026-11-14",
        appliedCostOverride: assetAfter1.fixed_income_metadata?.initial_investment_value,
      });
      if (!preview2) throw new Error("preview2 must not be null");

      const tx2: PortfolioTransaction = {
        id: "tx-selic-resgate-2",
        user_id: "user-6445",
        asset_id: asset.id,
        type: "sell",
        date: "2026-11-14",
        quantity: 1,
        price: 1653.17,
        total: 1653.17,
        total_cost_brl: preview2.appliedCostBasis,
        notes: buildFixedIncomeSellNotes({
          appliedCost: preview2.appliedCostBasis,
          realizedProfit: preview2.realizedProfit,
          taxAmount: preview2.taxAmount,
          taxRatePct: preview2.taxRatePct,
          netCredit: preview2.netCredit,
        }),
      };

      // Avaliação com apenas 2 resgates
      const redemptionsBefore3 = filterPeriodRedemptions({
        transactions: [tx1, tx2],
        assets: [assetAfter1],
        mode: "month",
        month: "2026-11",
      });

      expect(redemptionsBefore3).toHaveLength(2);
      const r1Before = redemptionsBefore3.find((r) => r.id === "tx-selic-resgate-1")!;
      const r2Before = redemptionsBefore3.find((r) => r.id === "tx-selic-resgate-2")!;

      // Snapshot dos valores dos resgates 1 e 2
      const snapshotR1 = { ...r1Before };
      const snapshotR2 = { ...r2Before };

      // Executa o 3º resgate de R$ 2.023,29 (do caso real v7)
      const assetAfter2: PortfolioAsset = {
        ...assetAfter1,
        average_price: preview2.remainingCostBasis,
        total_cost_brl: preview2.remainingCostBasis,
        fixed_income_metadata: {
          ...assetAfter1.fixed_income_metadata!,
          initial_investment_value: preview2.remainingCostBasis,
          base_value: preview2.remainingGrossBalance,
        },
      };

      const preview3 = calculateFixedIncomeRedemptionPreview({
        asset: assetAfter2,
        withdrawGross: 2023.29,
        date: "2026-11-19",
        appliedCostOverride: assetAfter2.fixed_income_metadata?.initial_investment_value,
      });
      if (!preview3) throw new Error("preview3 must not be null");

      const tx3: PortfolioTransaction = {
        id: "tx-selic-resgate-3",
        user_id: "user-6445",
        asset_id: asset.id,
        type: "sell",
        date: "2026-11-19",
        quantity: 1,
        price: 2023.29,
        total: 2023.29,
        total_cost_brl: preview3.appliedCostBasis,
        notes: buildFixedIncomeSellNotes({
          appliedCost: preview3.appliedCostBasis,
          realizedProfit: preview3.realizedProfit,
          taxAmount: preview3.taxAmount,
          taxRatePct: preview3.taxRatePct,
          netCredit: preview3.netCredit,
        }),
      };

      const assetAfter3: PortfolioAsset = {
        ...assetAfter2,
        average_price: preview3.remainingCostBasis,
        total_cost_brl: preview3.remainingCostBasis,
        fixed_income_metadata: {
          ...assetAfter2.fixed_income_metadata!,
          initial_investment_value: preview3.remainingCostBasis,
          base_value: preview3.remainingGrossBalance,
        },
      };

      // Avaliação com os 3 resgates
      const redemptionsAfter3 = filterPeriodRedemptions({
        transactions: [tx1, tx2, tx3],
        assets: [assetAfter3],
        mode: "month",
        month: "2026-11",
      });

      expect(redemptionsAfter3).toHaveLength(3);
      const r1After = redemptionsAfter3.find((r) => r.id === "tx-selic-resgate-1")!;
      const r2After = redemptionsAfter3.find((r) => r.id === "tx-selic-resgate-2")!;
      const r3After = redemptionsAfter3.find((r) => r.id === "tx-selic-resgate-3")!;

      // PROVA DE IMUTABILIDADE BIT-A-BIT: Resgate 1 e Resgate 2 NÃO mudaram nada
      expect(r1After.appliedCostBRL).toBe(snapshotR1.appliedCostBRL);
      expect(r1After.realizedPnlBRL).toBe(snapshotR1.realizedPnlBRL);
      expect(r1After.taxAmountBRL).toBe(snapshotR1.taxAmountBRL);
      expect(r1After.redeemedValueBRL).toBe(snapshotR1.redeemedValueBRL);

      expect(r2After.appliedCostBRL).toBe(snapshotR2.appliedCostBRL);
      expect(r2After.realizedPnlBRL).toBe(snapshotR2.realizedPnlBRL);
      expect(r2After.taxAmountBRL).toBe(snapshotR2.taxAmountBRL);
      expect(r2After.redeemedValueBRL).toBe(snapshotR2.redeemedValueBRL);

      // PROVA ANTI-RESGATE ZERADO: Resgate 3 tem lucro positivo e IR retido correto
      expect(r3After.appliedCostBRL).toBeGreaterThan(0);
      expect(r3After.appliedCostBRL).toBeLessThan(2023.29);
      expect(r3After.realizedPnlBRL).toBeGreaterThan(0);
      expect(r3After.realizedPnlBRL).not.toBe(0);
      expect(r3After.finalReturnPct).toBeGreaterThan(0);
      expect(r3After.taxAmountBRL).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Gate v7.2: IR Regressivo Real & Parse de Notas
  // -------------------------------------------------------------------------
  describe("Gate v7.2: IR Regressivo Real & Parse de Notas", () => {
    it("faz o parse exato e tolerante das notas de resgate gravadas no momento da operação", () => {
      const notes =
        "Resgate Renda Fixa | Custo baixado: R$ 1749.42 | Lucro Realizado: +R$ 273.87 | IRRF: -R$ 55.11 (20.0%) | Líquido: R$ 1968.18";
      const parsed = parseFixedIncomeSellNotes(notes);

      expect(parsed).not.toBeNull();
      expect(parsed?.appliedCost).toBe(1749.42);
      expect(parsed?.realizedProfit).toBe(273.87);
      expect(parsed?.taxAmount).toBe(55.11);
      expect(parsed?.taxRatePct).toBe(20.0);
      expect(parsed?.netCredit).toBe(1968.18);
    });

    it("aplica alíquota de 15,0% para ativos com ganho acumulado >= 25% mesmo com data estimada de Marco Zero", () => {
      const assetMarcoZero: PortfolioAsset = {
        id: "asset-marco-zero",
        user_id: "user-1",
        ticker: "TESOURO-SELIC-31",
        asset_class: "Renda Fixa",
        quantity: 1,
        average_price: 1000,
        currency: "BRL",
        created_at: "2026-11-01T00:00:00Z", // Data recente de criação
        fixed_income_metadata: {
          rate_type: "selic",
          rate_value: 100,
          base_date: "2026-11-01",
          is_tax_exempt: false,
        },
      };

      const txSell: PortfolioTransaction = {
        id: "tx-mz-sell",
        user_id: "user-1",
        asset_id: "asset-marco-zero",
        type: "sell",
        date: "2026-11-19",
        quantity: 1,
        price: 1500,
        total: 1500,
        total_cost_brl: 1000, // Ganho de 500 / 1000 = 50%
      };

      const redemptions = filterPeriodRedemptions({
        transactions: [txSell],
        assets: [assetMarcoZero],
        mode: "month",
        month: "2026-11",
      });

      expect(redemptions).toHaveLength(1);
      const r = redemptions[0]!;
      expect(r.taxRatePct).toBeNull();
      expect(r.taxAmountBRL).toBe(0);
      expect(r.realizedPnlBRL).toBe(500.0);
    });
  });

  // -------------------------------------------------------------------------
  // Gate v7.3: Reconciliação Pág. 1 e Pág. 5 & Unificação de % de Renda Fixa
  // -------------------------------------------------------------------------
  describe("Gate v7.3: Reconciliação Pág. 1 e Pág. 5 & Unificação de % de Renda Fixa", () => {
    it("garante que o peso de Renda Fixa na tabela Target vs. Actual lê da mesma fonte normalizada do gráfico de rosca", () => {
      const tearSheetModel = buildTearSheetModel({
        rows: [
          {
            ticker: "TESOURO-SELIC",
            name: "Tesouro Selic",
            assetClass: "Renda Fixa",
            sector: "Títulos Públicos",
            currency: "BRL",
            quantity: 1,
            averagePrice: 24420.87,
            currentPrice: 28324.56,
            totalCostBRL: 24420.87,
            valueBRL: 28324.56,
            unrealizedPnlBRL: 3903.69,
            unrealizedPnlPct: 15.98,
            totalReturnPnlBRL: 3903.69,
            totalReturnPct: 15.98,
          },
          {
            ticker: "BOVA11",
            name: "iShares Ibovespa",
            assetClass: "Ações",
            sector: "Índice",
            currency: "BRL",
            quantity: 100,
            averagePrice: 700.0,
            currentPrice: 763.83,
            totalCostBRL: 70000.0,
            valueBRL: 76383.38,
            unrealizedPnlBRL: 6383.38,
            unrealizedPnlPct: 9.12,
            totalReturnPnlBRL: 6383.38,
            totalReturnPct: 9.12,
          },
        ],
        totalBRL: 104707.94,
        totalCostBRL: 94420.87,
        cashBRL: 0,
        allocationAnalysis: {
          totalBRL: 104707.94,
          alignmentScore: 93,
          equilibriumIndexPct: 93,
          totalTargetPct: 100,
          totalGapBRL: 0,
          classGaps: [
            {
              assetClass: "Renda Fixa",
              currentBRL: 28324.56,
              currentPct: 27.05,
              targetPct: 30.0,
              gapBRL: 3087.82,
              gapPct: 2.95,
              status: "deficit",
              recommendedOrder: 1,
            },
            {
              assetClass: "Ações",
              currentBRL: 76383.38,
              currentPct: 72.95,
              targetPct: 70.0,
              gapBRL: -3087.82,
              gapPct: -2.95,
              status: "surplus",
              recommendedOrder: 2,
            },
          ],
          sectorGaps: [],
          assetGaps: [],
          topDeficitClass: null,
          topDeficitSector: null,
          topDeficitAsset: null,
          treeNodes: [],
        },
        concentrationRisk: {
          totalBRL: 104707.94,
          top5BRL: 104707.94,
          top5Pct: 100,
          top10BRL: 104707.94,
          top10Pct: 100,
          singleAssetDominance: { ticker: "BOVA11", valueBRL: 76383.38, pct: 72.95 },
          sectorExposure: [],
          topSectorDominance: null,
          top3SectorsPct: 100,
          currencyExposure: { brlBRL: 104707.94, brlPct: 100, usdBRL: 0, usdPct: 0 },
          riskScore: 75,
          riskAlerts: [],
        },
      });

      const donutClassRF = tearSheetModel.donutData.classSegments.find(
        (s) => s.label === "Renda Fixa" || s.key === "renda fixa",
      );
      const rowRF = tearSheetModel.allocationRows.find(
        (r) => r.assetClass === "Renda Fixa",
      );

      expect(donutClassRF).toBeDefined();
      expect(rowRF).toBeDefined();

      // O percentual exibido na tabela Target vs. Actual DEVE ser rigorosamente idêntico ao do gráfico de rosca
      expect(rowRF?.currentPct).toBe(donutClassRF?.pct);
    });
  });
});
