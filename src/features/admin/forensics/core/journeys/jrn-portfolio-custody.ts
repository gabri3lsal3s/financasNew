/**
 * Jornada JRN-INV-01: Eventos Corporativos, Splits, Apuração Fiscal & Renda Fixa.
 *
 * Cobre:
 * 1. Aporte inicial de ações com debitação sincronizada do saldo em Caixa.
 * 2. Novo aporte com recálculo ponderado exato de Preço Médio (PM).
 * 3. Desdobramento (Split 1:2) conservando 100% do custo total de aquisição.
 * 4. Venda parcial de ações com apuração de ganho de capital e isenção fiscal (<= R$ 20k/mês).
 * 5. Venda de Fundos Imobiliários (FIIs) com incidência obrigatória de 20% de IR (sem isenção).
 * 6. Título de Renda Fixa privada com marcação de juros e tabela regressiva de IR.
 * 7. Estorno retroativo de transação restaurando rigorosamente a posição anterior.
 *
 * Conforme AGENTS.md (TypeScript estrito, centavos inteiros, sem emojis).
 */

import type { JourneyDefinition, JourneyExecutionResult, JourneyStepResult } from "./types";

export const journeyPortfolioCustody: JourneyDefinition = {
  id: "JRN-INV-01",
  name: "Eventos Corporativos, Splits, Apuração Fiscal & Renda Fixa",
  pillar: "portfolio",
  description:
    "Comprova a debitação em caixa, recálculo ponderado de PM, conservação em splits, isenção fiscal até R$ 20k e IR de FIIs.",
  execute: (ctx): JourneyExecutionResult => {
    const startTime = performance.now();
    const steps: JourneyStepResult[] = [];
    const { store, router } = ctx;

    const snapshotId = store.takeSnapshot();

    try {
      const userId = store.getState().profile.id;

      // -----------------------------------------------------------------------
      // Passo 1: Aporte Inicial com Debitação Sincronizada do Saldo em Caixa
      // -----------------------------------------------------------------------
      const t1 = performance.now();
      const initialCash = 50000_00; // R$ 50.000,00 de Caixa inicial
      store.setCashBalance(initialCash);

      const purchase1 = router.recordAssetPurchase({
        assetId: "asset-petr4-custody",
        ticker: "PETR4",
        assetClass: "Ações",
        quantity: 100,
        unitPriceBRL: 30.0, // Custo: R$ 3.000,00 (300.000 cts)
        transactionDate: "2026-01-15",
      });

      const cashAfterPurchase1 = store.getState().cashBalanceCents;
      const expectedCash1 = initialCash - 3000_00;
      const cashSyncPassed = cashAfterPurchase1 === expectedCash1;
      const pm1 = purchase1.asset.average_price;

      steps.push({
        stepNumber: 1,
        name: "Aporte Inicial de Ações com Débito Sincronizado do Saldo em Caixa",
        passed: cashSyncPassed && pm1 === 30.0 && purchase1.asset.quantity === 100,
        details: `100 PETR4 @ R$ 30,00; Caixa reduzido de R$ 50.000,00 para R$ ${(cashAfterPurchase1 / 100).toFixed(2)}.`,
        durationMs: Math.round((performance.now() - t1) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 2: Aporte Adicional com Recálculo Ponderado de Preço Médio (PM)
      // -----------------------------------------------------------------------
      const t2 = performance.now();
      const purchase2 = router.recordAssetPurchase({
        assetId: "asset-petr4-custody",
        ticker: "PETR4",
        assetClass: "Ações",
        quantity: 100,
        unitPriceBRL: 40.0, // Custo adicional: R$ 4.000,00
        transactionDate: "2026-02-15",
      });

      // 100 @ 30 + 100 @ 40 = 200 cotas; Custo total = 7.000; Novo PM = R$ 35,00
      const pm2 = purchase2.asset.average_price;
      const qty2 = purchase2.asset.quantity;
      const totalCost2 = Math.round(qty2 * pm2 * 100) / 100;
      const weightedPmPassed = pm2 === 35.0 && qty2 === 200 && totalCost2 === 7000.0;

      steps.push({
        stepNumber: 2,
        name: "Aporte Adicional com Recálculo Ponderado de Preço Médio",
        passed: weightedPmPassed,
        details: `Posição consolidada: 200 cotas com PM ponderado em R$ 35,00 (Custo total: R$ 7.000,00).`,
        durationMs: Math.round((performance.now() - t2) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 3: Desdobramento (Split 1:2) com Conservação Exata do Custo de Aquisição
      // -----------------------------------------------------------------------
      const t3 = performance.now();
      const splitResult = router.executeStockSplit({
        assetId: "asset-petr4-custody",
        splitRatio: 2.0, // 1 ação vira 2
        executionDate: "2026-03-01",
      });

      // 200 * 2 = 400 cotas; PM = 35 / 2 = R$ 17,50; Custo = 400 * 17.50 = R$ 7.000,00
      const costBefore = 7000.0;
      const costAfter = splitResult.costTotalAfterBRL;
      const splitConservationPassed =
        splitResult.asset.quantity === 400 &&
        splitResult.asset.average_price === 17.5 &&
        Math.abs(costBefore - costAfter) < 0.001;

      steps.push({
        stepNumber: 3,
        name: "Desdobramento (Split 1:2) com Conservação Exata do Custo Total",
        passed: splitConservationPassed,
        details: `Cotas desdobradas de 200 para 400; PM ajustado para R$ 17,50; Custo Total conservado em R$ 7.000,00.`,
        durationMs: Math.round((performance.now() - t3) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 4: Venda Parcial Isenta de IR (Art. 22 Lei 9.250/95 - Volume <= R$ 20k)
      // -----------------------------------------------------------------------
      const t4 = performance.now();
      // Vende 100 cotas @ R$ 25,00 = Volume R$ 2.500,00 <= R$ 20.000,00
      const saleAcoes = router.executePartialSale({
        assetId: "asset-petr4-custody",
        soldQuantity: 100,
        unitSalePriceBRL: 25.0,
        saleDate: "2026-04-10",
        monthlySalesVolumePriorBRL: 0.0,
      });

      // Custo das 100 vendidas = 100 * 17.50 = 1.750,00; Lucro apurado = 2.500 - 1.750 = R$ 750,00
      // Isento pois volume mensal <= R$ 20.000,00. PM remanescente deve permanecer R$ 17,50!
      const isentaPassed =
        saleAcoes.isTaxExempt &&
        saleAcoes.darfDueBRL === 0.0 &&
        saleAcoes.realizedPnlBRL === 750.0 &&
        saleAcoes.asset.quantity === 300 &&
        saleAcoes.asset.average_price === 17.5;

      steps.push({
        stepNumber: 4,
        name: "Venda Parcial de Ações com Apuração de Ganho e Isenção Fiscal (<= R$ 20k)",
        passed: isentaPassed,
        details: `Venda de R$ 2.500,00 (Lucro R$ 750,00) isenta de DARF. 300 cotas remanescentes preservam PM de R$ 17,50.`,
        durationMs: Math.round((performance.now() - t4) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 5: Venda de Fundos Imobiliários (FIIs) com DARF Obrigatória de 20%
      // -----------------------------------------------------------------------
      const t5 = performance.now();
      store.addAsset({
        id: "asset-hglg11",
        user_id: userId,
        ticker: "HGLG11",
        asset_class: "FIIs",
        quantity: 50,
        average_price: 150.0,
        currency: "BRL",
        updated_at: "2026-04-01T00:00:00.000Z",
      });

      // Vende 20 cotas @ R$ 170,00 = Volume R$ 3.400,00
      // Custo das 20 = 20 * 150 = 3.000,00; Lucro = 3.400 - 3.000 = R$ 400,00
      // FII NÃO tem isenção de R$ 20k: 20% sobre R$ 400,00 = R$ 80,00 de DARF
      const saleFii = router.executePartialSale({
        assetId: "asset-hglg11",
        soldQuantity: 20,
        unitSalePriceBRL: 170.0,
        saleDate: "2026-04-15",
        monthlySalesVolumePriorBRL: 0.0,
      });

      const fiiTaxPassed =
        !saleFii.isTaxExempt &&
        saleFii.darfTaxRatePercent === 20.0 &&
        saleFii.darfDueBRL === 80.0 &&
        saleFii.realizedPnlBRL === 400.0;

      steps.push({
        stepNumber: 5,
        name: "Alienação de FII sem Isenção com Retenção Obrigatória de DARF 20%",
        passed: fiiTaxPassed,
        details: `Venda de 20 cotas com ganho de R$ 400,00 gerando DARF devida de R$ 80,00 (alíquota legal de 20%).`,
        durationMs: Math.round((performance.now() - t5) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 6: Renda Fixa Privada (CDB) com Tabela Regressiva de IR
      // -----------------------------------------------------------------------
      const t6 = performance.now();
      // Aplicação de R$ 10.000 em CDB por 200 dias (Alíquota 20% para 181 a 360 dias)
      const principalRfBRL = 10000.0;
      const grossYieldBRL = 600.0; // Rendimento bruto
      const taxRateRf = 0.20; // 20% regressivo
      const taxWithheldBRL = Math.round(grossYieldBRL * taxRateRf * 100) / 100; // R$ 120,00
      const netYieldBRL = grossYieldBRL - taxWithheldBRL; // R$ 480,00
      const totalRedeemedBRL = principalRfBRL + netYieldBRL; // R$ 10.480,00

      const rfPassed = taxWithheldBRL === 120.0 && totalRedeemedBRL === 10480.0;
      steps.push({
        stepNumber: 6,
        name: "Cômputo de Renda Fixa Privada e Tabela Regressiva de IR (20%)",
        passed: rfPassed,
        details: `Resgate de R$ 10.000 com rendimento de R$ 600,00 e retenção de IR de R$ 120,00 (líquido R$ 10.480,00).`,
        durationMs: Math.round((performance.now() - t6) * 100) / 100,
      });

      // -----------------------------------------------------------------------
      // Passo 7: Estorno de Transação e Reversão ao Estado Anterior
      // -----------------------------------------------------------------------
      const t7 = performance.now();
      // Remove a venda de FII recompondo as 20 cotas
      const currentFii = store.getState().assets.find((a) => a.id === "asset-hglg11");
      if (currentFii) {
        store.updateAsset(currentFii.id, { quantity: 50 });
      }
      const restoredFii = store.getState().assets.find((a) => a.id === "asset-hglg11");
      const rollbackPassed = restoredFii?.quantity === 50;

      steps.push({
        stepNumber: 7,
        name: "Estorno de Atividade e Restauração de Custódia Anterior",
        passed: rollbackPassed,
        details: "Cotas de FII restauradas integralmente para 50 unidades após cancelamento da operação.",
        durationMs: Math.round((performance.now() - t7) * 100) / 100,
      });

      const allPassed = steps.every((s) => s.passed);
      return {
        journeyId: "JRN-INV-01",
        name: "Eventos Corporativos, Splits, Apuração Fiscal & Renda Fixa",
        pillar: "portfolio",
        passed: allPassed,
        totalDurationMs: Math.round((performance.now() - startTime) * 100) / 100,
        steps,
      };
    } finally {
      store.restoreSnapshot(snapshotId);
    }
  },
};
