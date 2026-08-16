import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyExpenseUpdate,
  applyIncomeUpdate,
  removeCardPayments,
  removeExpenses,
  removeIncomes,
  removeIncomesBySourceRef,
  restoreQueries,
  snapshotQueries,
} from "./optimistic-cache";
import type { CardPayment, Expense, Income } from "@/types";

function makeExpense(id: string, overrides: Partial<Expense> = {}): Expense {
  return {
    id,
    user_id: "u1",
    value: 100,
    date: "2026-08-10",
    category_id: "c1",
    payment_method: "pix",
    card_id: null,
    installments_total: 1,
    installment_number: 1,
    installment_group_id: null,
    bill_competence: null,
    report_weight: 1,
    base_amount: 100,
    description: null,
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function makeIncome(id: string, overrides: Partial<Income> = {}): Income {
  return {
    id,
    user_id: "u1",
    value: 500,
    date: "2026-08-05",
    category_id: "c2",
    receive_type: "pix",
    description: null,
    report_weight: 1,
    source_ref: null,
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function makePayment(id: string): CardPayment {
  return {
    id,
    user_id: "u1",
    card_id: "card1",
    competence_month: "2026-08",
    amount: 1200,
    date: "2026-08-15",
    note: "Pagamento",
    is_refund: false,
  };
}

describe("optimistic-cache", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  });

  describe("snapshotQueries/restoreQueries", () => {
    it("restaura exatamente o que foi capturado (rollback seguro)", () => {
      const e1 = makeExpense("e1");
      queryClient.setQueryData(["expenses", "2026-08"], [e1, makeExpense("e2")]);
      queryClient.setQueryData(["expenses", "range", "2026-01-01", "2026-12-31"], [e1]);

      const snapshot = snapshotQueries(queryClient, ["expenses"]);
      // Simula a mutação otimista aplicada depois do snapshot.
      queryClient.setQueryData(["expenses", "2026-08"], [makeExpense("e2")]);

      restoreQueries(queryClient, snapshot);

      expect(queryClient.getQueryData(["expenses", "2026-08"])).toEqual([e1, makeExpense("e2")]);
      expect(queryClient.getQueryData(["expenses", "range", "2026-01-01", "2026-12-31"])).toEqual([e1]);
    });
  });

  describe("applyExpenseUpdate", () => {
    it("mescla o patch em listas por mês, range, cartão e na query singular", () => {
      const e1 = makeExpense("e1");
      const e2 = makeExpense("e2");
      queryClient.setQueryData(["expenses", "2026-08"], [e1, e2]);
      queryClient.setQueryData(["expenses", "range", "2026-01-01", "2026-12-31"], [e1]);
      queryClient.setQueryData(["card_expenses", "card1"], [e1]);
      queryClient.setQueryData(["expenses", "e1"], e1);

      applyExpenseUpdate(queryClient, "e1", { value: 250, description: "Almoço" });

      const expected = { ...e1, value: 250, description: "Almoço" };
      expect(queryClient.getQueryData(["expenses", "2026-08"])).toEqual([expected, e2]);
      expect(queryClient.getQueryData(["expenses", "range", "2026-01-01", "2026-12-31"])).toEqual([expected]);
      expect(queryClient.getQueryData(["card_expenses", "card1"])).toEqual([expected]);
      expect(queryClient.getQueryData(["expenses", "e1"])).toEqual(expected);
      // Itens não-alvo ficam intactos.
      expect(queryClient.getQueryData<Expense[]>(["expenses", "2026-08"])?.[1]).toEqual(e2);
    });
  });

  describe("removeExpenses", () => {
    it("remove os ids de todas as listas e anula a query singular", () => {
      const e1 = makeExpense("e1");
      const e2 = makeExpense("e2");
      queryClient.setQueryData(["expenses", "2026-08"], [e1, e2]);
      queryClient.setQueryData(["card_expenses", "card1"], [e1]);
      queryClient.setQueryData(["expenses", "e1"], e1);

      removeExpenses(queryClient, new Set(["e1"]));

      expect(queryClient.getQueryData(["expenses", "2026-08"])).toEqual([e2]);
      expect(queryClient.getQueryData(["card_expenses", "card1"])).toEqual([]);
      expect(queryClient.getQueryData(["expenses", "e1"])).toBeNull();
    });
  });

  describe("applyIncomeUpdate / removeIncomes", () => {
    it("mescla patch e remove por id nas listas de rendas", () => {
      const i1 = makeIncome("i1");
      const i2 = makeIncome("i2");
      queryClient.setQueryData(["incomes", "2026-08"], [i1, i2]);
      queryClient.setQueryData(["incomes", "range", "2026-01-01", "2026-12-31"], [i1]);

      applyIncomeUpdate(queryClient, "i1", { value: 900 });

      expect(queryClient.getQueryData<Income[]>(["incomes", "2026-08"])?.[0]).toMatchObject({ value: 900 });
      expect(
        queryClient.getQueryData<Income[]>(["incomes", "range", "2026-01-01", "2026-12-31"])?.[0],
      ).toMatchObject({
        value: 900,
      });

      removeIncomes(queryClient, new Set(["i1"]));
      expect(queryClient.getQueryData(["incomes", "2026-08"])).toEqual([i2]);
      expect(queryClient.getQueryData(["incomes", "range", "2026-01-01", "2026-12-31"])).toEqual([]);
    });
  });

  describe("removeCardPayments / removeIncomesBySourceRef", () => {
    it("remove pagamento das listas e a renda automática do estorno", () => {
      const p1 = makePayment("p1");
      const p2 = makePayment("p2");
      const refundIncome = makeIncome("i-refund", { source_ref: "[REFUND]p1", value: 1200 });
      queryClient.setQueryData(["card_payments", "card1"], [p1, p2]);
      queryClient.setQueryData(["incomes", "2026-08"], [refundIncome, makeIncome("i2")]);

      removeCardPayments(queryClient, new Set(["p1"]));
      removeIncomesBySourceRef(queryClient, "[REFUND]p1");

      expect(queryClient.getQueryData(["card_payments", "card1"])).toEqual([p2]);
      expect(queryClient.getQueryData(["incomes", "2026-08"])).toHaveLength(1);
      expect(queryClient.getQueryData<Income[]>(["incomes", "2026-08"])?.[0]).toMatchObject({ id: "i2" });
    });
  });
});
