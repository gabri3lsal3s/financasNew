import { describe, expect, it } from "vitest";
import {
  sellAssetPosition,
  splitAssetPosition,
  buildInitialPositionOperations,
  calculateReconciledAssetPosition,
} from "./operations";

describe("domain/portfolio/operations — Vendas e Desinvestimentos", () => {
  it("venda parcial mantém o Preço Médio das cotas remanescentes inalterado", () => {
    // 100 cotas a R$ 30,00 de PM. Vende 40 cotas a R$ 35,00.
    const result = sellAssetPosition({
      currentQuantity: 100,
      currentAveragePrice: 30,
      sellQuantity: 40,
      sellPrice: 35,
      assetClass: "Ações",
    });

    expect(result.remainingQuantity).toBe(60);
    expect(result.remainingAveragePrice).toBe(30); // PM rigorosamente mantido
    expect(result.remainingTotalCost).toBe(1800);
    expect(result.grossAmount).toBe(1400); // 40 * 35
    expect(result.costOfSoldQuantity).toBe(1200); // 40 * 30
    expect(result.realizedPnl).toBe(200); // R$ 200 de lucro realizado
    expect(result.realizedPnlPct).toBeCloseTo(16.67, 1);
    expect(result.isFullyExited).toBe(false);
  });

  it("venda total zera a posição e o PM", () => {
    const result = sellAssetPosition({
      currentQuantity: 50,
      currentAveragePrice: 10,
      sellQuantity: 50,
      sellPrice: 12,
      assetClass: "FIIs",
    });

    expect(result.remainingQuantity).toBe(0);
    expect(result.remainingAveragePrice).toBe(0);
    expect(result.remainingTotalCost).toBe(0);
    expect(result.grossAmount).toBe(600);
    expect(result.realizedPnl).toBe(100);
    expect(result.isFullyExited).toBe(true);
  });

  it("aplica isenção de R$ 20.000 para vendas de ações", () => {
    const resultUnderLimit = sellAssetPosition({
      currentQuantity: 500,
      currentAveragePrice: 20,
      sellQuantity: 200,
      sellPrice: 25, // Total R$ 5.000
      assetClass: "Ações",
      monthlyAccumulatedStockSales: 10_000,
    });

    expect(resultUnderLimit.taxInfo.isStock).toBe(true);
    expect(resultUnderLimit.taxInfo.accumulatedSalesAfter).toBe(15_000);
    expect(resultUnderLimit.taxInfo.isTaxExempt).toBe(true);
    expect(resultUnderLimit.taxInfo.estimatedTaxPayable).toBe(0);
  });

  it("calcula DARF estimado de 15% para ações quando ultrapassa o teto de 20k no mês", () => {
    const resultOverLimit = sellAssetPosition({
      currentQuantity: 1000,
      currentAveragePrice: 20,
      sellQuantity: 500,
      sellPrice: 30, // Total R$ 15.000
      assetClass: "Ações",
      monthlyAccumulatedStockSales: 10_000, // Total acumulado = 25.000 (> 20k)
    });

    expect(resultOverLimit.taxInfo.isStock).toBe(true);
    expect(resultOverLimit.taxInfo.accumulatedSalesAfter).toBe(25_000);
    expect(resultOverLimit.taxInfo.isTaxExempt).toBe(false);
    expect(resultOverLimit.realizedPnl).toBe(5000); // 500 * (30 - 20)
    expect(resultOverLimit.taxInfo.estimatedTaxPayable).toBe(750); // 15% de 5000
  });

  it("aplica tributação fixa de 20% para FIIs sem isenção de 20k", () => {
    const resultFii = sellAssetPosition({
      currentQuantity: 100,
      currentAveragePrice: 10,
      sellQuantity: 50,
      sellPrice: 12, // Total R$ 600
      assetClass: "FIIs",
      monthlyAccumulatedStockSales: 0,
    });

    expect(resultFii.taxInfo.isFii).toBe(true);
    expect(resultFii.taxInfo.isTaxExempt).toBe(false);
    expect(resultFii.realizedPnl).toBe(100);
    expect(resultFii.taxInfo.estimatedTaxPayable).toBe(20); // 20% de 100
    expect(resultFii.netCreditAmount).toBe(600); // Renda variável credita o bruto no caixa
  });

  it("calcula retenção na fonte e crédito líquido no caixa para resgate de Renda Fixa tributada (ex.: CDB)", () => {
    // CDB aplicado a R$ 10.000, resgatado a R$ 12.000 (lucro R$ 2.000) após 400 dias (alíquota 17.5%)
    const resultCdb = sellAssetPosition({
      currentQuantity: 1,
      currentAveragePrice: 10000,
      sellQuantity: 1,
      sellPrice: 12000,
      assetClass: "Renda Fixa",
      calendarDays: 400,
      isTaxExemptFixedIncome: false,
    });

    expect(resultCdb.taxInfo.isFixedIncome).toBe(true);
    expect(resultCdb.taxInfo.isTaxExempt).toBe(false);
    expect(resultCdb.taxInfo.taxRate).toBe(0.175);
    expect(resultCdb.realizedPnl).toBe(2000);
    expect(resultCdb.taxInfo.estimatedTaxPayable).toBe(350); // 17.5% de 2000
    expect(resultCdb.netCreditAmount).toBe(11650); // R$ 12.000 - R$ 350 de IRRF
  });

  it("credita valor integral para resgate de Renda Fixa isenta (ex.: LCI / LCA)", () => {
    const resultLci = sellAssetPosition({
      currentQuantity: 1,
      currentAveragePrice: 10000,
      sellQuantity: 1,
      sellPrice: 11500,
      assetClass: "Renda Fixa",
      calendarDays: 300,
      isTaxExemptFixedIncome: true,
    });

    expect(resultLci.taxInfo.isTaxExempt).toBe(true);
    expect(resultLci.taxInfo.estimatedTaxPayable).toBe(0);
    expect(resultLci.netCreditAmount).toBe(11500); // 100% creditado no caixa
  });
});

describe("domain/portfolio/operations — Splits (Desdobramento e Grupamento)", () => {
  it("desdobramento 1 para 10 multiplica cotas por 10, divide PM por 10 e mantém custo invariante", () => {
    const split = splitAssetPosition({
      currentQuantity: 100,
      currentAveragePrice: 50,
      ratioFrom: 1,
      ratioTo: 10,
    });

    expect(split.newQuantity).toBe(1000);
    expect(split.newAveragePrice).toBe(5);
    expect(split.totalCostBefore).toBe(5000);
    expect(split.totalCostAfter).toBe(5000);
  });

  it("grupamento 10 para 1 divide cotas por 10, multiplica PM por 10 e mantém custo invariante", () => {
    const split = splitAssetPosition({
      currentQuantity: 1000,
      currentAveragePrice: 2,
      ratioFrom: 10,
      ratioTo: 1,
    });

    expect(split.newQuantity).toBe(100);
    expect(split.newAveragePrice).toBe(20);
    expect(split.totalCostBefore).toBe(2000);
    expect(split.totalCostAfter).toBe(2000);
  });
});

describe("domain/portfolio/operations — Adição Inicial e Reconciliação do Ledger", () => {
  describe("buildInitialPositionOperations", () => {
    it("gera transação e aporte em BRL para ativo nacional de renda variável", () => {
      const ops = buildInitialPositionOperations({
        assetId: "a1",
        ticker: "PETR4",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 100,
        averagePrice: 30,
        initialDate: "2026-03-10",
      });

      expect(ops.transaction).not.toBeNull();
      expect(ops.transaction?.type).toBe("buy");
      expect(ops.transaction?.quantity).toBe(100);
      expect(ops.transaction?.price).toBe(30);
      expect(ops.transaction?.total).toBe(3000);
      expect(ops.transaction?.date).toBe("2026-03-10");

      expect(ops.contribution).not.toBeNull();
      expect(ops.contribution?.amount).toBe(3000);
      expect(ops.contribution?.date).toBe("2026-03-10");
      expect(ops.contribution?.notes).toContain("PETR4");
    });

    it("converte aporte para BRL com usdRate para ativo internacional em dólar", () => {
      const ops = buildInitialPositionOperations({
        assetId: "a2",
        ticker: "VEA",
        assetClass: "Internacional",
        currency: "USD",
        quantity: 10,
        averagePrice: 50,
        usdRate: 5.5,
        initialDate: "2026-04-15",
      });

      // Transação na moeda nativa (USD)
      expect(ops.transaction?.total).toBe(500); // 10 * $50
      expect(ops.transaction?.price).toBe(50);

      // Aporte convertido para BRL
      expect(ops.contribution?.amount).toBe(2750); // $500 * 5.50
      expect(ops.contribution?.notes).toContain("$500.00");
    });

    it("gera transação e aporte unitário para Caixa", () => {
      const ops = buildInitialPositionOperations({
        assetId: "c1",
        ticker: "CAIXA",
        assetClass: "Caixa",
        currency: "BRL",
        quantity: 5000,
        averagePrice: 1,
        isCash: true,
      });

      expect(ops.transaction?.quantity).toBe(5000);
      expect(ops.transaction?.price).toBe(1);
      expect(ops.transaction?.total).toBe(5000);
      expect(ops.contribution?.amount).toBe(5000);
    });

    it("clampAppDate limita datas anteriores a 2026-01-01", () => {
      const ops = buildInitialPositionOperations({
        assetId: "a3",
        ticker: "VALE3",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 10,
        averagePrice: 60,
        initialDate: "2024-05-10", // Data antiga
      });

      expect(ops.transaction?.date).toBe("2026-01-01");
      expect(ops.contribution?.date).toBe("2026-01-01");
    });
  });

  describe("calculateReconciledAssetPosition", () => {
    it("exclusão de compra recalcula o Preço Médio e cotas para o patamar anterior a partir das transações restantes", () => {
      // Cenário: ativo tinha compra inicial de 10 a 20 e segunda compra de 10 a 40.
      // A segunda compra (10 a 40) está sendo excluída.
      const result = calculateReconciledAssetPosition({
        currentQuantity: 20,
        currentAveragePrice: 30,
        assetClass: "Ações",
        removedTransaction: {
          type: "buy",
          quantity: 10,
          price: 40,
          total: 400,
        },
        remainingTransactions: [
          { type: "buy", quantity: 10, price: 20, total: 200, date: "2026-02-01" },
        ],
      });

      expect(result.newQuantity).toBe(10);
      expect(result.newAveragePrice).toBe(20); // Volta perfeitamente ao PM da primeira compra
      expect(result.newTotalCost).toBe(200);
    });

    it("exclusão da única transação zera a posição e o preço médio do ativo", () => {
      const result = calculateReconciledAssetPosition({
        currentQuantity: 50,
        currentAveragePrice: 30,
        assetClass: "Ações",
        removedTransaction: {
          type: "buy",
          quantity: 50,
          price: 30,
          total: 1500,
        },
        remainingTransactions: [],
      });

      expect(result.newQuantity).toBe(0);
      expect(result.newAveragePrice).toBe(0);
      expect(result.newTotalCost).toBe(0);
    });

    it("salvaguarda de dados legados: preserva PM original caso restem cotas sem transações no ledger", () => {
      // Ativo tinha 100 cotas a R$ 25 de cadastro legado. Comprou 10 a R$ 35 (total 110 cotas a R$ 25,91).
      // Ao excluir a compra de 10 cotas, sobram 100 cotas. Como não há transações remanescentes no ledger,
      // preserva o PM original de R$ 25,00.
      const result = calculateReconciledAssetPosition({
        currentQuantity: 110,
        currentAveragePrice: 25.91,
        assetClass: "Ações",
        removedTransaction: {
          type: "buy",
          quantity: 10,
          price: 35,
          total: 350,
        },
        remainingTransactions: [],
      });

      expect(result.newQuantity).toBe(100);
      expect(result.newAveragePrice).toBe(25.91);
      expect(result.newTotalCost).toBe(2591);
    });

    it("exclusão de venda restaura a quantidade vendida mantendo o PM inalterado", () => {
      const result = calculateReconciledAssetPosition({
        currentQuantity: 15,
        currentAveragePrice: 28,
        assetClass: "Ações",
        removedTransaction: {
          type: "sell",
          quantity: 5,
          price: 32,
          total: 160,
        },
        remainingTransactions: [
          { type: "buy", quantity: 20, price: 28, total: 560, date: "2026-01-10" },
        ],
      });

      expect(result.newQuantity).toBe(20); // 15 + 5
      expect(result.newAveragePrice).toBe(28); // PM mantido
      expect(result.newTotalCost).toBe(560);
    });

    it("exclusão de compra em Caixa reduz o saldo na quantia exata", () => {
      const result = calculateReconciledAssetPosition({
        currentQuantity: 5000,
        currentAveragePrice: 1,
        isCash: true,
        removedTransaction: {
          type: "buy",
          quantity: 2000,
          price: 1,
          total: 2000,
        },
        remainingTransactions: [
          { type: "buy", quantity: 3000, price: 1, total: 3000, date: "2026-01-05" },
        ],
      });

      expect(result.newQuantity).toBe(3000);
      expect(result.newAveragePrice).toBe(1);
    });

    it("exclusão de aporte em Renda Fixa regride o saldo aplicado e o base_value", () => {
      const result = calculateReconciledAssetPosition({
        currentQuantity: 1,
        currentAveragePrice: 15000,
        isTotalValue: true,
        assetClass: "Renda Fixa",
        fixedIncomeMetadata: {
          rate_type: "cdi",
          rate_value: 120,
          base_date: "2026-02-01",
          base_value: 15000,
          initial_investment_value: 10000,
        },
        removedTransaction: {
          type: "buy",
          quantity: 1,
          price: 5000,
          total: 5000,
        },
        remainingTransactions: [
          { type: "buy", quantity: 1, price: 10000, total: 10000, date: "2026-01-01" },
        ],
      });

      expect(result.newQuantity).toBe(1);
      expect(result.newAveragePrice).toBe(10000);
      expect(result.updatedFixedIncomeMetadata?.base_value).toBe(10000);
    });
  });
});
