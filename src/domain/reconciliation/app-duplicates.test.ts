import { describe, expect, it } from "vitest";
import {
  findAppDuplicateCandidates,
  reconcileStatementTransactions,
  type ExistingExpenseForReconciliation,
  type StatementTransaction,
} from "./index";

function makeStatementTx(
  id: string,
  date: string,
  desc: string,
  amountCents: number,
): StatementTransaction {
  return {
    id,
    index: 0,
    occurrenceIndex: 0,
    date,
    rawDescription: desc,
    cleanDescription: desc,
    amountCents,
    isRefund: false,
    isPayment: false,
    statementHash: `hash-${id}`,
  };
}

function makeExisting(
  id: string,
  date: string,
  description: string,
  valueCents: number,
  overrides?: Partial<ExistingExpenseForReconciliation>,
): ExistingExpenseForReconciliation {
  return {
    id,
    date,
    description,
    valueCents,
    categoryId: "cat-1",
    installmentNumber: null,
    installmentsTotal: null,
    billCompetence: "2026-11",
    ...overrides,
  };
}

describe("app-duplicates e conciliação cross-competência", () => {
  it("detecta despesa duplicada cadastrada no app no dia seguinte quando a principal já conciliou com a fatura", () => {
    const stmt = [makeStatementTx("tx-1", "2026-11-10", "Padaria Estrela", 4070)];
    const existing = [
      makeExisting("exp-1", "2026-11-10", "Padaria Estrela", 4070),
      makeExisting("exp-2", "2026-11-11", "Padaria Estrela", 4070),
    ];

    const res = reconcileStatementTransactions({
      statementTransactions: stmt,
      existingExpenses: existing,
      history: [],
      defaultCategoryId: "cat-1",
    });

    expect(res.items[0]?.status).toBe("exact_match");
    // Conciliado limpo não deve carregar duplicateReason amarelo quando não há duplicata no arquivo
    expect(res.items[0]?.duplicateReason).toBeUndefined();

    expect(res.unmatchedExistingExpenses.map((e) => e.id)).toEqual(["exp-2"]);
    expect(res.appDuplicates).toHaveLength(1);
    expect(res.appDuplicates?.[0]?.keepExpense.id).toBe("exp-1");
    expect(res.appDuplicates?.[0]?.duplicateExpense.id).toBe("exp-2");
    expect(res.appDuplicates?.[0]?.keepIsMatchedOnStatement).toBe(true);
  });

  it("detecta duplicata entre duas despesas excedentes no app mantendo a mais antiga", () => {
    const expOld = makeExisting("exp-old", "2026-11-05", "Uber Trip", 2490);
    const expNew = makeExisting("exp-new", "2026-11-06", "Uber Trip Centro", 2490);

    const dups = findAppDuplicateCandidates({
      items: [],
      existingExpenses: [expOld, expNew],
      unmatchedExistingExpenses: [expOld, expNew],
    });

    expect(dups).toHaveLength(1);
    expect(dups[0]?.keepExpense.id).toBe("exp-old");
    expect(dups[0]?.duplicateExpense.id).toBe("exp-new");
    expect(dups[0]?.keepIsMatchedOnStatement).toBe(false);
  });

  it("não acusa duplicata entre parcelas distintas de mesmo valor", () => {
    const p1 = makeExisting("exp-p1", "2026-11-10", "Loja Moveis", 25000, {
      installmentNumber: 1,
      installmentsTotal: 3,
    });
    const p2 = makeExisting("exp-p2", "2026-11-10", "Loja Moveis", 25000, {
      installmentNumber: 2,
      installmentsTotal: 3,
    });

    const dups = findAppDuplicateCandidates({
      items: [],
      existingExpenses: [p1, p2],
      unmatchedExistingExpenses: [p1, p2],
    });

    expect(dups).toHaveLength(0);
  });

  it("identifica compra da fatura que foi lançada no app na competência vizinha (M-1) e desmarca para evitar duplicação", () => {
    const stmt = [makeStatementTx("tx-12", "2026-11-28", "Amazon Brasil", 19990)];
    const adjacent = [
      makeExisting("exp-wrong-month", "2026-11-28", "Amazon Brasil", 19990, {
        billCompetence: "2026-11",
      }),
    ];

    const res = reconcileStatementTransactions({
      statementTransactions: stmt,
      existingExpenses: [],
      adjacentExpenses: adjacent,
      history: [],
      defaultCategoryId: "cat-1",
    });

    expect(res.items[0]?.status).toBe("unmatched_new");
    expect(res.items[0]?.selected).toBe(false);
    expect(res.items[0]?.crossCompetenceMatch).toEqual(
      expect.objectContaining({
        expenseId: "exp-wrong-month",
        currentBillCompetence: "2026-11",
        expenseValueCents: 19990,
      }),
    );
  });
});
