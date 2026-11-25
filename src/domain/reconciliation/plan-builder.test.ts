import { describe, expect, it } from "vitest";
import type { ReconciliationItem, StatementTransaction } from "./contracts";
import { buildReconciliationPlan, toCommitReconciliationPlanPayload } from "./plan-builder";

function makeTx(
  id: string,
  overrides: Partial<StatementTransaction> = {},
): StatementTransaction {
  return {
    id,
    index: 0,
    occurrenceIndex: 0,
    date: "2026-11-10",
    rawDescription: `COMPRA ${id}`,
    cleanDescription: `COMPRA ${id}`,
    merchantCleanRaw: `COMPRA ${id}`,
    amountCents: 10000,
    isRefund: false,
    isPayment: false,
    statementHash: `hash-${id}`,
    ...overrides,
  };
}

function makeItem(
  id: string,
  overrides: Partial<ReconciliationItem> = {},
  txOverrides: Partial<StatementTransaction> = {},
): ReconciliationItem {
  return {
    transaction: makeTx(id, txOverrides),
    status: "unmatched_new",
    score: 0,
    suggestedCategoryId: "cat-default",
    selectedCategoryId: "cat-food",
    selected: true,
    ignoredByDefault: false,
    ...overrides,
  };
}

describe("plan-builder — ReconciliationPlan, D2 Opt-out/Opt-in, D9 Staging, D14 e G9", () => {
  it("aplica D2 opt-out (novas compras, projeção K+1..N, estornos, microajuste <= R$0,05) vs opt-in e compartilha installment_group_id (G9)", () => {
    const newInst = makeItem(
      "inst-2-4",
      {
        selectedCategoryId: "cat-tech",
        projectSeries: true,
        seriesAnalysis: {
          state: "state_2_orphan_series",
          installment: { current: 2, total: 4 },
          currentAlreadyExists: false,
          previousExists: false,
          existingInstallmentGroupId: "group-uuid-existing",
          futureProjectedCount: 0,
          missingFutureInstallments: [3, 4],
          badgeLabel: "Série sem futuras",
          suggestedActionLabel: "Projetar parcelas restantes",
        },
      },
      {
        cleanDescription: "LOJA PARCELADA",
        amountCents: 15000,
        installment: { current: 2, total: 4 },
        inferredChargeKind: "regular",
      },
    );

    const newIof = makeItem(
      "iof",
      { selectedCategoryId: "cat-other" },
      {
        cleanDescription: "IOF COMPRA INTERNACIONAL",
        amountCents: 1200,
        inferredChargeKind: "tax",
      },
    );

    const refundNew = makeItem(
      "ref-1",
      { selected: true },
      {
        cleanDescription: "ESTORNO COMPRA",
        amountCents: 4500,
        isRefund: true,
      },
    );

    const microAdj = makeItem(
      "adj-micro",
      {
        status: "probable_match",
        selected: false,
        score: 75,
        hasStrongSemanticSignal: true,
        matchedExpenseId: "exp-1",
        matchedExpenseDescription: "Mercado",
        matchedExpenseValueCents: 9997,
      },
      { amountCents: 10000 },
    );

    const manualAdjPending = makeItem(
      "adj-big",
      {
        status: "probable_match",
        selected: false,
        score: 65,
        hasStrongSemanticSignal: true,
        matchedExpenseId: "exp-2",
        matchedExpenseDescription: "Farmacia",
        matchedExpenseValueCents: 5000,
      },
      { amountCents: 5800 },
    );

    const crossCompPending = makeItem("cross-1", {
      selected: false,
      crossCompetenceMatch: {
        expenseId: "exp-prev",
        expenseDescription: "Restaurante M-1",
        expenseDate: "2026-10-28",
        expenseValueCents: 10000,
        score: 85,
        currentBillCompetence: "2026-10",
        statementHash: "hash-cross",
      },
    });

    const plan = buildReconciliationPlan({
      cardId: "card-1",
      competenceMonth: "2026-11",
      cardScope: "personal",
      items: [newInst, newIof, refundNew, microAdj, manualAdjPending, crossCompPending],
      fallbackCategoryId: "cat-default",
      reservedChargesCategoryId: "cat-charges",
      queuedDeleteExpenseIds: ["exp-del-1"],
      generateGroupId: () => "generated-group-uuid",
    });

    expect(plan.blockedByRollover).toBe(false);
    expect(plan.newExpensesToCreate).toHaveLength(2);
    // D12: encargo resolve para categoria reservada
    expect(plan.newExpensesToCreate[1]?.categoryId).toBe("cat-charges");
    // G9: K/N e K+1..N compartilham exatamente o mesmo installmentGroupId
    expect(plan.newExpensesToCreate[0]?.installmentGroupId).toBe("group-uuid-existing");
    expect(plan.futureInstallmentsToProject).toHaveLength(2);
    expect(
      plan.futureInstallmentsToProject.every(
        (p) => p.installmentGroupId === "group-uuid-existing",
      ),
    ).toBe(true);
    expect(plan.refundsToRegister).toHaveLength(1);
    expect(plan.microAdjustmentsToApply).toHaveLength(1);
    expect(plan.manualLinkAdjustments).toHaveLength(0);
    expect(plan.competenceMovesToApply).toHaveLength(0);
    expect(plan.expenseIdsToDelete).toEqual(["exp-del-1"]);
    expect(plan.pendingOptInCount).toBe(2); // adj-big + cross-1

    const payload = toCommitReconciliationPlanPayload(plan);
    expect(payload.expenses).toHaveLength(4);
  });

  it("serializa valores BRL decimais e snapshot snake_case corretamente via toCommitReconciliationPlanPayload", () => {
    const newInst = makeItem(
      "new-inst",
      {
        selectedCategoryId: "cat-tech",
        projectSeries: true,
      },
      {
        amountCents: 12550,
        installment: { current: 1, total: 2 },
      },
    );

    const plan = buildReconciliationPlan({
      cardId: "card-1",
      competenceMonth: "2026-11",
      items: [newInst],
      fallbackCategoryId: "cat-default",
      generateGroupId: () => "11111111-1111-4111-8111-111111111111",
    });

    const payload = toCommitReconciliationPlanPayload(plan);
    expect(payload.expenses).toHaveLength(2);
    expect(payload.expenses[0]).toMatchObject({
      value: 125.5,
      installments_total: 2,
      installment_number: 1,
      installment_group_id: "11111111-1111-4111-8111-111111111111",
      is_projected: false,
    });
    expect(payload.expenses[1]).toMatchObject({
      value: 125.5,
      installments_total: 2,
      installment_number: 2,
      installment_group_id: "11111111-1111-4111-8111-111111111111",
      is_projected: true,
    });
  });

  it("aplica D14: fatura rolada bloqueia 100%; fatura quitada permite Blocos D/E e bloqueia Blocos A/B/C", () => {
    const newPurchase = makeItem("new-1");
    const newRefund = makeItem("ref-1", { selected: true }, { isRefund: true, amountCents: 3000 });
    const microAdj = makeItem("adj-1", {
      status: "probable_match",
      score: 80,
      hasStrongSemanticSignal: true,
      matchedExpenseId: "exp-1",
      matchedExpenseValueCents: 9998,
    });
    const crossApproved = makeItem("cross-1", {
      selected: false,
      crossCompetenceMatch: {
        expenseId: "exp-prev",
        expenseDescription: "Loja",
        expenseDate: "2026-10-20",
        expenseValueCents: 10000,
        score: 85,
        currentBillCompetence: "2026-10",
        statementHash: "hash-cross-1",
      },
    });

    const rolledPlan = buildReconciliationPlan({
      cardId: "card-1",
      competenceMonth: "2026-11",
      items: [newPurchase, newRefund, microAdj, crossApproved],
      fallbackCategoryId: "cat-default",
      queuedDeleteExpenseIds: ["exp-del"],
      isRolledOver: true,
    });
    expect(rolledPlan.blockedByRollover).toBe(true);
    expect(rolledPlan.totalActionCount).toBe(0);

    const paidPlan = buildReconciliationPlan({
      cardId: "card-1",
      competenceMonth: "2026-11",
      items: [newPurchase, newRefund, microAdj, crossApproved],
      fallbackCategoryId: "cat-default",
      approvedCompetenceMoveTxIds: new Set(["cross-1"]),
      queuedDeleteExpenseIds: ["exp-del"],
      isPaidBill: true,
    });
    expect(paidPlan.blockedByRollover).toBe(false);
    expect(paidPlan.paidBillLocksRestricted).toBe(true);
    // Blocos D e E permanecem permitidos:
    expect(paidPlan.newExpensesToCreate).toHaveLength(1);
    expect(paidPlan.refundsToRegister).toHaveLength(1);
    // Blocos A, B e C bloqueados:
    expect(paidPlan.expenseIdsToDelete).toHaveLength(0);
    expect(paidPlan.microAdjustmentsToApply).toHaveLength(0);
    expect(paidPlan.manualLinkAdjustments).toHaveLength(0);
    expect(paidPlan.competenceMovesToApply).toHaveLength(0);
  });
});
