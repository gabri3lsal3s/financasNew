import { describe, expect, it } from "vitest";
import {
  calculateMatchScore,
  hasStrongMatchSemanticSignal,
  reconcileStatementTransactions,
} from "./scorer";
import type {
  ExistingExpenseForReconciliation,
  ExistingRefundForReconciliation,
  StatementTransaction,
} from "./contracts";

function makeStatementTx(
  overrides: Partial<StatementTransaction> & { id: string; rawDescription: string; amountCents: number },
): StatementTransaction {
  return {
    index: 0,
    occurrenceIndex: 0,
    date: "2026-11-10",
    cleanDescription: overrides.rawDescription,
    isRefund: false,
    isPayment: false,
    statementHash: `hash-${overrides.id}`,
    ...overrides,
  };
}

describe("Motor de Conciliação Onda 1 — Guardas G7, G8, G10 e D12", () => {
  it("G7: bloqueia match automático sem score textual ou sinal forte mesmo com valor e data idênticos (Farmácia vs Posto R$ 50)", () => {
    const stmt = makeStatementTx({
      id: "tx-farmacia",
      rawDescription: "FARMACIA POPULAR",
      amountCents: 5000,
      date: "2026-11-10",
    });
    const existing: ExistingExpenseForReconciliation = {
      id: "exp-posto",
      description: "POSTO IPIRANGA",
      valueCents: 5000,
      date: "2026-11-10",
      categoryId: "cat-transporte",
      installmentNumber: null,
      installmentsTotal: null,
    };

    const score = calculateMatchScore(stmt, existing, {
      predictedCategoryId: "cat-transporte",
    });
    expect(score).toBeLessThanOrEqual(70);

    const result = reconcileStatementTransactions({
      statementTransactions: [stmt],
      existingExpenses: [existing],
      history: [{ description: "FARMACIA POPULAR", categoryId: "cat-transporte" }],
      defaultCategoryId: "cat-outros",
    });

    expect(result.items[0]?.status).toBe("probable_match");
    expect(result.items[0]?.score).toBeLessThanOrEqual(70);
    expect(result.items[0]?.selected).toBe(false);
    expect(hasStrongMatchSemanticSignal(stmt, existing, { predictedCategoryId: "cat-transporte" })).toBe(true);
    expect(hasStrongMatchSemanticSignal(stmt, existing, { predictedCategoryId: "cat-saude" })).toBe(false);
  });

  it("Matching Ótimo Global 1:1 (Score DESC): não rouba candidato melhor independente da ordem do array", () => {
    const expAmazon: ExistingExpenseForReconciliation = {
      id: "exp-amazon",
      description: "AMAZON BR",
      valueCents: 10000,
      date: "2026-11-10",
      categoryId: "cat-compras",
      installmentNumber: null,
      installmentsTotal: null,
    };

    // Primeiro item tem valor+data idênticos mas descrição totalmente distinta; segundo item é "AMAZON"
    const stmtUnrelated = makeStatementTx({
      id: "tx-unrelated",
      index: 0,
      rawDescription: "PADARIA SOL",
      amountCents: 10000,
      date: "2026-11-10",
    });
    const stmtAmazon = makeStatementTx({
      id: "tx-amazon",
      index: 1,
      rawDescription: "AMAZON MARKETPLACE",
      amountCents: 10000,
      date: "2026-11-10",
    });

    const result = reconcileStatementTransactions({
      statementTransactions: [stmtUnrelated, stmtAmazon],
      existingExpenses: [expAmazon],
      history: [],
      defaultCategoryId: "cat-outros",
    });

    expect(result.items[1]?.status).toBe("exact_match");
    expect(result.items[1]?.matchedExpenseId).toBe("exp-amazon");
    expect(result.items[0]?.status).toBe("unmatched_new");
    expect(result.items[0]?.matchedExpenseId).toBeUndefined();
  });

  it("G8: mantém duas corridas idênticas no mesmo dia pré-selecionadas quando officialTotalValidated=true e sem risco de sobreposição de prints", () => {
    const rides: StatementTransaction[] = [
      makeStatementTx({
        id: "uber-1",
        index: 0,
        occurrenceIndex: 0,
        rawDescription: "UBER TRIP",
        amountCents: 1990,
        date: "2026-11-10",
      }),
      makeStatementTx({
        id: "uber-2",
        index: 1,
        occurrenceIndex: 1,
        rawDescription: "UBER TRIP",
        amountCents: 1990,
        date: "2026-11-10",
      }),
    ];

    const confirmed = reconcileStatementTransactions({
      statementTransactions: rides,
      existingExpenses: [],
      history: [],
      defaultCategoryId: "cat-outros",
      officialTotalValidated: true,
      isMultiImageOverlapRisk: false,
    });

    expect(confirmed.items[0]?.selected).toBe(true);
    expect(confirmed.items[1]?.selected).toBe(true);
    expect(confirmed.items[1]?.repeatedSameDayConfirmed).toBe(true);

    const unconfirmed = reconcileStatementTransactions({
      statementTransactions: rides,
      existingExpenses: [],
      history: [],
      defaultCategoryId: "cat-outros",
      officialTotalValidated: false,
    });

    expect(unconfirmed.items[0]?.selected).toBe(true);
    expect(unconfirmed.items[1]?.selected).toBe(false);
    expect(unconfirmed.items[1]?.repeatedSameDayConfirmed).toBeUndefined();
  });

  it("G10: pré-seleciona estornos novos (selected=true) e marca exact_match quando já conciliados em existingRefunds", () => {
    const newRefund = makeStatementTx({
      id: "ref-new",
      rawDescription: "ESTORNO AMAZON",
      amountCents: 8900,
      date: "2026-11-10",
      isRefund: true,
      statementHash: "hash-ref-new",
    });
    const existingRefundTx = makeStatementTx({
      id: "ref-dup",
      rawDescription: "ESTORNO IFOOD",
      amountCents: 3500,
      date: "2026-11-09",
      isRefund: true,
      statementHash: "hash-ref-existing",
    });

    const existingRefunds: ExistingRefundForReconciliation[] = [
      {
        id: "inc-refund-1",
        competenceMonth: "2026-11",
        amountCents: 3500,
        date: "2026-11-09",
        statementHash: "hash-ref-existing",
      },
    ];

    const res = reconcileStatementTransactions({
      statementTransactions: [newRefund, existingRefundTx],
      existingExpenses: [],
      existingRefunds,
      history: [],
      defaultCategoryId: "cat-outros",
    });

    expect(res.items[0]?.selected).toBe(true);
    expect(res.items[0]?.status).toBe("unmatched_new");

    expect(res.items[1]?.selected).toBe(false);
    expect(res.items[1]?.status).toBe("exact_match");
    expect(res.items[1]?.matchedRefundId).toBe("inc-refund-1");
  });

  it("D12: vincula automaticamente IOF, Juros e Multas à reservedChargesCategoryId quando inferido no parser", () => {
    const iofTx = makeStatementTx({
      id: "tx-iof",
      rawDescription: "IOF COMPRA INTERNACIONAL",
      amountCents: 1420,
      inferredChargeKind: "tax",
    });

    const res = reconcileStatementTransactions({
      statementTransactions: [iofTx],
      existingExpenses: [],
      history: [],
      defaultCategoryId: "cat-outros",
      reservedChargesCategoryId: "cat-encargos-reservada",
    });

    expect(res.items[0]?.suggestedCategoryId).toBe("cat-encargos-reservada");
  });
});
