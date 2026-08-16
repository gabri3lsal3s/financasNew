import { describe, expect, it } from "vitest";
import { resolveExpenseDeleteIds } from "./index";
import type { Expense } from "@/types";

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    id: "e1",
    user_id: "u1",
    value: 100,
    date: "2026-01-10",
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
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const GROUP = "g1";

const installments: Expense[] = [
  makeExpense({ id: "e1", installments_total: 3, installment_number: 1, installment_group_id: GROUP }),
  makeExpense({ id: "e2", installments_total: 3, installment_number: 2, installment_group_id: GROUP }),
  makeExpense({ id: "e3", installments_total: 3, installment_number: 3, installment_group_id: GROUP }),
];

describe("resolveExpenseDeleteIds", () => {
  it("exclusão single remove apenas a despesa-alvo", () => {
    expect(resolveExpenseDeleteIds(installments, "e2", "single")).toEqual(["e2"]);
  });

  it("exclusão single em avulsa remove apenas o id", () => {
    const avulsa = makeExpense({ id: "e9" });
    expect(resolveExpenseDeleteIds([avulsa], "e9", "single")).toEqual(["e9"]);
  });

  it("exclusão all remove o grupo inteiro de parcelas", () => {
    expect(resolveExpenseDeleteIds(installments, "e2", "all").sort()).toEqual(["e1", "e2", "e3"]);
  });

  it("exclusão subsequent remove a parcela e as seguintes", () => {
    expect(resolveExpenseDeleteIds(installments, "e2", "subsequent")).toEqual(["e2", "e3"]);
  });

  it("exclusão subsequent da primeira parcela remove o grupo inteiro", () => {
    expect(resolveExpenseDeleteIds(installments, "e1", "subsequent")).toEqual(["e1", "e2", "e3"]);
  });

  it("parcelas de grupos distintos não são misturadas em all", () => {
    const other = makeExpense({
      id: "e9",
      installments_total: 2,
      installment_number: 1,
      installment_group_id: "g2",
    });
    expect(resolveExpenseDeleteIds([...installments, other], "e1", "all")).toEqual(["e1", "e2", "e3"]);
  });

  it("despesa fora da lista (cache vazio) remove apenas o id informado", () => {
    expect(resolveExpenseDeleteIds([], "desconhecida", "all")).toEqual(["desconhecida"]);
  });
});
