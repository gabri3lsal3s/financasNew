/**
 * Suíte de Testes do Portão de Qualidade 6 — Núcleo Headless Store & Fuzzing Engine.
 *
 * Valida:
 * 1. HeadlessStateStore: mutações em memória, reversibilidade de snapshots e proteção relacional.
 * 2. FuzzingEngine: resiliência de schemas Zod contra injeção e transbordamento.
 * 3. HeadlessTransactionRouter: roteamento de parcelamentos, corte de fatura, CDC 52, splits e Min-Cash-Flow.
 *
 * Conforme AGENTS.md (TypeScript estrito, centavos inteiros, sem emojis).
 */

import { describe, expect, it } from "vitest";
import { HeadlessStateStore } from "./headless-state-store";
import { HeadlessTransactionRouter } from "./headless-transaction-router";
import { FuzzingEngine } from "./fuzzing-engine";
import { creditCardFormSchema } from "@/domain/cards/schemas";
import { debtInputSchema } from "@/domain/debts";
import { budgetLimitInputSchema } from "@/domain/budgets";
import { step1ValueSchema } from "@/features/transactions/wizard/wizard-schemas";
import { createModularInviteSchema } from "@/domain/admin/schemas";

describe("Portão de Qualidade 6 — Fundação Headless Store & Fuzzing Engine", () => {
  describe("1. HeadlessStateStore: Integridade e Reversibilidade de Estado", () => {
    it("inicializa estado padrão determinístico com perfil e categorias", () => {
      const store = new HeadlessStateStore();
      const state = store.getState();

      expect(state.profile.email).toBe("forensics.seed@axir.app");
      expect(state.profile.tier).toBe("pro_monthly");
      expect(state.categories.length).toBeGreaterThanOrEqual(8);
      expect(state.creditCards).toHaveLength(1);
    });

    it("salva snapshot e restaura estado imutavelmente sem poluição residual", () => {
      const store = new HeadlessStateStore();
      store.addCategory({
        id: "cat-extra",
        userId: "usr-1",
        name: "Extra",
        icon: "compras",
        color: "#000",
        type: "expense",
      });

      expect(store.getState().categories.some((c) => c.id === "cat-extra")).toBe(true);
      store.saveSnapshot("checkpoint-com-extra");

      // Adiciona transação
      store.addTransaction({
        id: "tx-temp",
        userId: "usr-1",
        type: "expense",
        amountCents: 5000,
        description: "Teste Temp",
        categoryId: "cat-extra",
        date: "2026-05-10",
        competenceMonth: "2026-05",
        isPaid: true,
        reportWeight: 1,
        createdAt: new Date().toISOString(),
      });
      expect(store.getState().transactions).toHaveLength(1);

      // Restaura para o checkpoint
      const restored = store.restoreSnapshot("checkpoint-com-extra");
      expect(restored).toBe(true);
      expect(store.getState().transactions).toHaveLength(0);
      expect(store.getState().categories.some((c) => c.id === "cat-extra")).toBe(true);
    });

    it("bloqueia exclusão de categoria com transações vinculadas sem categoria de realocação", () => {
      const store = new HeadlessStateStore();
      const categoryId = "cat-alimentacao";

      store.addTransaction({
        id: "tx-1",
        userId: "usr-seed",
        type: "expense",
        amountCents: 10000,
        description: "Almoço",
        categoryId,
        date: "2026-05-01",
        competenceMonth: "2026-05",
        isPaid: true,
        reportWeight: 1,
        createdAt: new Date().toISOString(),
      });

      // Tentativa de excluir sem fornecer nova categoria deve retornar false
      const result = store.deleteCategory(categoryId);
      expect(result).toBe(false);
      expect(store.getState().categories.some((c) => c.id === categoryId)).toBe(true);

      // Excluir fornecendo categoria de destino válida deve transferir e remover
      const success = store.deleteCategory(categoryId, "cat-moradia");
      expect(success).toBe(true);
      expect(store.getState().categories.some((c) => c.id === categoryId)).toBe(false);
      const reallocatedTx = store.getState().transactions.find((t) => t.id === "tx-1");
      expect(reallocatedTx?.categoryId).toBe("cat-moradia");
    });
  });

  describe("2. FuzzingEngine: Teste de Estresse em Schemas Zod de Formulários", () => {
    it("submete creditCardFormSchema a fuzzing sem vazamento de exceções", () => {
      const baseValid = {
        name: "Cartão Teste",
        brand: "Visa",
        creditLimit: 5000,
        closingDay: 10,
        dueDay: 18,
        color: "#1E293B",
      };

      const results = FuzzingEngine.testSchemaField(creditCardFormSchema, baseValid, "name");
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it("submete debtInputSchema a fuzzing bloqueando valores monetários negativos e HTML", () => {
      const baseValid = {
        name: "Financiamento Imobiliário",
        type: "payable",
        amount: 250000,
        dueDate: "2026-12-31",
      };

      const results = FuzzingEngine.testNumericField(debtInputSchema, baseValid, "amount");
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it("submete budgetLimitInputSchema e step1ValueSchema a fuzzing", () => {
      const baseBudget = {
        categoryId: "cat-alimentacao",
        month: "2026-05",
        amount: 1500,
      };

      const results = FuzzingEngine.testNumericField(budgetLimitInputSchema, baseBudget, "amount");
      expect(results.every((r) => r.passed)).toBe(true);

      const baseStep1 = {
        type: "expense" as const,
        valueCents: 35050,
        installments: 1,
      };
      const resultsStep1 = FuzzingEngine.testNumericField(step1ValueSchema, baseStep1, "valueCents");
      expect(resultsStep1.every((r) => r.passed)).toBe(true);
    });

    it("submete createModularInviteSchema a fuzzing garantindo higienização de notas e código", () => {
      const baseValid = {
        code: "CONVITE2026",
        target_tier: "trial",
        notes: "Convite institucional",
        module_grants: { investments: "none", trips: "write" },
      };

      const results = FuzzingEngine.testTextField(createModularInviteSchema, baseValid, "notes");
      expect(results.every((r) => r.passed)).toBe(true);
    });
  });

  describe("3. HeadlessTransactionRouter: Execução de Mutações de Domínio", () => {
    it("cria despesa parcelada com conservação exata de centavos e ajuste de competência", () => {
      const store = new HeadlessStateStore();
      const router = new HeadlessTransactionRouter(store);

      // Compra no dia 10 em cartão com fechamento no dia 10 -> fatura do mês seguinte
      const txs = router.createExpenseWithInstallments({
        userId: "usr-1",
        description: "Notebook Pro",
        totalAmountCents: 1000_00, // R$ 1.000,00
        installmentsCount: 7, // 1.000 / 7 resulta em dízima periódica
        purchaseDate: "2026-05-10",
        categoryId: "cat-outros",
        cardId: "card-principal", // closing_day = 10
      });

      expect(txs).toHaveLength(7);

      // Invariante de Competência no Fechamento: compra no dia 10 deve ir para Junho/2026 (mês seguinte)
      expect(txs[0]?.competenceMonth).toBe("2026-06");
      expect(txs[6]?.competenceMonth).toBe("2026-12");

      // Invariante de Conservação de Centavos: soma rigorosa de todas as parcelas
      const totalSum = txs.reduce((acc, t) => acc + t.amountCents, 0);
      expect(totalSum).toBe(1000_00);
      // R$ 1.000,00 / 7: R$ 142,90 na primeira (host remainder) e R$ 142,85 nas demais
      expect(txs[0]?.amountCents).toBe(14290);
      expect(txs[1]?.amountCents).toBe(14285);
    });

    it("executa desdobramento de ações (Split 1:2) conservando rigorosamente o Custo Total da Posição", () => {
      const store = new HeadlessStateStore();
      const router = new HeadlessTransactionRouter(store);

      store.addAsset({
        id: "asset-petr4",
        user_id: "usr-1",
        ticker: "PETR4",
        asset_class: "Ações",
        quantity: 100,
        average_price: 30.0, // Custo: R$ 3.000,00
        currency: "BRL",
        updated_at: new Date().toISOString(),
      });

      router.executeStockSplit("asset-petr4", 2.0); // 1:2

      const updatedAsset = store.getState().assets.find((a) => a.id === "asset-petr4");
      expect(updatedAsset?.quantity).toBe(200);
      expect(updatedAsset?.average_price).toBe(15.0);

      // Custo Total Conservado: 200 * 15.0 = 3000.0
      const totalCost = (updatedAsset?.quantity ?? 0) * (updatedAsset?.average_price ?? 0);
      expect(totalCost).toBe(3000.0);
    });

    it("executa venda parcial de ações apurando ganho de capital e aplicando isenção fiscal até R$ 20.000/mês", () => {
      const store = new HeadlessStateStore();
      const router = new HeadlessTransactionRouter(store);

      store.addAsset({
        id: "asset-vale3",
        user_id: "usr-1",
        ticker: "VALE3",
        asset_class: "Ações",
        quantity: 200,
        average_price: 50.0,
        currency: "BRL",
        updated_at: new Date().toISOString(),
      });

      // Venda de 100 cotas a R$ 60,00 (Total R$ 6.000,00 <= R$ 20.000,00)
      const saleResult = router.executeStockSaleWithTax({
        assetId: "asset-vale3",
        soldQuantity: 100,
        salePrice: 60.0,
        saleDate: "2026-05-15",
        monthlySalesVolumePriorBRL: 0,
      });

      expect(saleResult.saleTotalBRL).toBe(6000.0);
      expect(saleResult.costOfSoldSharesBRL).toBe(5000.0);
      expect(saleResult.realizedPnlBRL).toBe(1000.0); // R$ 1.000,00 de lucro
      expect(saleResult.isTaxExempt).toBe(true); // Isento pelo art. 22 Lei 9.250/95
      expect(saleResult.darfDueBRL).toBe(0.0);

      // As 100 cotas remanescentes preservam exatamente o mesmo preço médio de R$ 50,00
      const updatedAsset = store.getState().assets.find((a) => a.id === "asset-vale3");
      expect(updatedAsset?.quantity).toBe(100);
      expect(updatedAsset?.average_price).toBe(50.0);
    });

    it("rebalanceia viagem com múltiplos participantes comprovando balanço zero-sum", () => {
      const store = new HeadlessStateStore();
      const router = new HeadlessTransactionRouter(store);

      const tripId = "trip-1";
      store.addTrip({
        id: tripId,
        userId: "usr-1",
        title: "Viagem Praia",
        destination: "Ubatuba",
        currency: "BRL",
        exchangeRate: 1.0,
        startDate: "2026-01-10",
        endDate: "2026-01-15",
      });

      store.addTripMember({ id: "mem-1", tripId, name: "Alice", isHost: true });
      store.addTripMember({ id: "mem-2", tripId, name: "Bob", isHost: false });
      store.addTripMember({ id: "mem-3", tripId, name: "Carol", isHost: false });

      // Alice pagou R$ 300,00 dividido igualmente pelos 3 (R$ 100,00 cada)
      store.addTripExpense({
        id: "exp-1",
        tripId,
        description: "Almoço",
        amountBaseCents: 30000,
        currency: "BRL",
        payerMemberId: "mem-1",
        splits: [
          { memberId: "mem-1", shareCents: 10000 },
          { memberId: "mem-2", shareCents: 10000 },
          { memberId: "mem-3", shareCents: 10000 },
        ],
      });

      const { balances, simplifiedSettlements } = router.rebalanceTripSplitsMinCashFlow(tripId);

      // Invariante de Conservação Zero-Sum: a soma dos saldos líquidos de todos os membros é rigorosamente 0
      const sumBalances = balances.reduce((acc, b) => acc + b.netBalanceCents, 0);
      expect(sumBalances).toBe(0);

      const alice = balances.find((b) => b.memberId === "mem-1");
      const bob = balances.find((b) => b.memberId === "mem-2");
      const carol = balances.find((b) => b.memberId === "mem-3");

      expect(alice?.netBalanceCents).toBe(20000); // Alice tem a receber R$ 200,00
      expect(bob?.netBalanceCents).toBe(-10000); // Bob deve R$ 100,00
      expect(carol?.netBalanceCents).toBe(-10000); // Carol deve R$ 100,00

      // Min-Cash-Flow: Bob e Carol pagam R$ 100,00 diretamente para Alice
      expect(simplifiedSettlements).toHaveLength(2);
      expect(simplifiedSettlements.every((s) => s.toMemberId === "mem-1")).toBe(true);
    });
  });
});
