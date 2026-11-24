import { describe, expect, it } from "vitest";
import {
  detectInstallmentSeriesState,
  projectFutureInstallments,
} from "./series-detector";
import type { ExistingExpenseForReconciliation, StatementTransaction } from "./types";

function createMockTransaction(overrides: Partial<StatementTransaction> = {}): StatementTransaction {
  return {
    id: "stmt-0",
    index: 0,
    occurrenceIndex: 0,
    date: "2026-03-15",
    rawDescription: "MAGALU (01/05)",
    cleanDescription: "MAGALU",
    amountCents: 10000,
    isRefund: false,
    isPayment: false,
    statementHash: "hash-mock",
    installment: { current: 1, total: 5 },
    ...overrides,
  };
}

describe("series-detector — Classificador dos 4 Estados de Séries de Parcelamento", () => {
  it("retorna null para transações à vista ou sem parcelamento", () => {
    const tx = createMockTransaction({ installment: undefined });
    expect(detectInstallmentSeriesState({ transaction: tx, competenceMonth: "2026-03", existingExpenses: [] })).toBeNull();

    const txSingle = createMockTransaction({ installment: { current: 1, total: 1 } });
    expect(detectInstallmentSeriesState({ transaction: txSingle, competenceMonth: "2026-03", existingExpenses: [] })).toBeNull();
  });

  it("Estado 1: Detecta compra inédita 1/N e projeta faltantes 2..N", () => {
    const tx = createMockTransaction({
      installment: { current: 1, total: 4 },
      cleanDescription: "Curso Online",
      amountCents: 5000,
    });

    const analysis = detectInstallmentSeriesState({
      transaction: tx,
      competenceMonth: "2026-03",
      existingExpenses: [],
    });

    expect(analysis).not.toBeNull();
    expect(analysis?.state).toBe("state_1_new_series");
    expect(analysis?.currentAlreadyExists).toBe(false);
    expect(analysis?.previousExists).toBe(false);
    expect(analysis?.missingFutureInstallments).toEqual([2, 3, 4]);
    expect(analysis?.futureProjectedCount).toBe(0);
    expect(analysis?.badgeLabel).toContain("1/4");
  });

  it("Estado 2: Detecta parcela órfã K/N (K >= 2) sem série prévia e sem retroagir passado", () => {
    const tx = createMockTransaction({
      installment: { current: 3, total: 10 },
      cleanDescription: "Smart TV",
      amountCents: 25000,
    });

    const analysis = detectInstallmentSeriesState({
      transaction: tx,
      competenceMonth: "2026-03",
      existingExpenses: [],
    });

    expect(analysis).not.toBeNull();
    expect(analysis?.state).toBe("state_2_orphan_series");
    expect(analysis?.currentAlreadyExists).toBe(false);
    expect(analysis?.previousExists).toBe(false);
    expect(analysis?.missingFutureInstallments).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(analysis?.badgeLabel).toContain("3/10 sem histórico");
  });

  it("Estado 3: Detecta continuação de série quando parcela K-1 existe sem futuras", () => {
    const tx = createMockTransaction({
      installment: { current: 2, total: 5 },
      cleanDescription: "Geladeira Frost Free",
      amountCents: 80000,
    });

    const existing: ExistingExpenseForReconciliation[] = [
      {
        id: "exp-k-minus-1",
        date: "2026-02-15",
        description: "Geladeira Frost Free",
        valueCents: 80000,
        categoryId: "cat-casa",
        installmentNumber: 1,
        installmentsTotal: 5,
      },
    ];

    const analysis = detectInstallmentSeriesState({
      transaction: tx,
      competenceMonth: "2026-03",
      existingExpenses: existing,
    });

    expect(analysis).not.toBeNull();
    expect(analysis?.state).toBe("state_3_continuation_without_projection");
    expect(analysis?.currentAlreadyExists).toBe(false);
    expect(analysis?.previousExists).toBe(true);
    expect(analysis?.previousExpenseId).toBe("exp-k-minus-1");
    expect(analysis?.missingFutureInstallments).toEqual([3, 4, 5]);
  });

  it("Estado 4: Bloqueia duplicação quando a parcela atual K já existe no banco", () => {
    const tx = createMockTransaction({
      installment: { current: 2, total: 4 },
      cleanDescription: "Notebook Dell",
      amountCents: 120000,
    });

    const existing: ExistingExpenseForReconciliation[] = [
      {
        id: "exp-current",
        date: "2026-03-15",
        description: "Notebook Dell",
        valueCents: 120000,
        categoryId: "cat-tech",
        installmentNumber: 2,
        installmentsTotal: 4,
      },
    ];

    const analysis = detectInstallmentSeriesState({
      transaction: tx,
      competenceMonth: "2026-03",
      existingExpenses: existing,
    });

    expect(analysis).not.toBeNull();
    expect(analysis?.state).toBe("state_4_already_projected");
    expect(analysis?.currentAlreadyExists).toBe(true);
    expect(analysis?.existingCurrentExpenseId).toBe("exp-current");
  });

  it("Estado 4: Bloqueia duplicação quando futuras K+1..N já foram projetadas no banco", () => {
    const tx = createMockTransaction({
      installment: { current: 2, total: 4 },
      cleanDescription: "Notebook Dell",
      amountCents: 120000,
    });

    const existing: ExistingExpenseForReconciliation[] = [
      {
        id: "exp-future-3",
        date: "2026-04-15",
        description: "Notebook Dell",
        valueCents: 120000,
        categoryId: "cat-tech",
        installmentNumber: 3,
        installmentsTotal: 4,
      },
      {
        id: "exp-future-4",
        date: "2026-05-15",
        description: "Notebook Dell",
        valueCents: 120000,
        categoryId: "cat-tech",
        installmentNumber: 4,
        installmentsTotal: 4,
      },
    ];

    const analysis = detectInstallmentSeriesState({
      transaction: tx,
      competenceMonth: "2026-03",
      existingExpenses: existing,
    });

    expect(analysis).not.toBeNull();
    expect(analysis?.state).toBe("state_4_already_projected");
    expect(analysis?.futureProjectedCount).toBe(2);
    expect(analysis?.missingFutureInstallments).toEqual([]);
  });

  describe("projectFutureInstallments — Projeção com Zero Inflação de Centavos", () => {
    it("projeta parcelas futuras avançando meses com addMonthsClamped e preservando o valor exato", () => {
      const projected = projectFutureInstallments({
        currentInstallment: 1,
        totalInstallments: 3,
        installmentValueCents: 3334, // R$ 100 / 3 primeira parcela
        baseDate: "2026-01-31",
        baseCompetence: "2026-01",
        description: "Assinatura Trimestral",
        categoryId: "cat-servicos",
      });

      expect(projected).toHaveLength(2);

      // Parcela 2: Fevereiro clampado
      expect(projected[0]?.installmentNumber).toBe(2);
      expect(projected[0]?.installmentsTotal).toBe(3);
      expect(projected[0]?.date).toBe("2026-02-28");
      expect(projected[0]?.billCompetence).toBe("2026-02");
      expect(projected[0]?.valueCents).toBe(3334); // Não sofre inflação por recálculo

      // Parcela 3: Março
      expect(projected[1]?.installmentNumber).toBe(3);
      expect(projected[1]?.installmentsTotal).toBe(3);
      expect(projected[1]?.date).toBe("2026-03-31");
      expect(projected[1]?.billCompetence).toBe("2026-03");
      expect(projected[1]?.valueCents).toBe(3334);
    });

    it("retorna lista vazia quando K >= N", () => {
      const projected = projectFutureInstallments({
        currentInstallment: 3,
        totalInstallments: 3,
        installmentValueCents: 5000,
        baseDate: "2026-03-10",
        baseCompetence: "2026-03",
        description: "Compra Final",
        categoryId: "cat-geral",
      });
      expect(projected).toEqual([]);
    });
  });
});
