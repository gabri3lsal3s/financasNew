import { describe, expect, it } from "vitest";
import {
  detectInstallmentSeriesState,
  projectFutureInstallments,
} from "./series-detector";
import type { ExistingExpenseForReconciliation, StatementTransaction } from "./contracts";

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

    it("D13 + Histórico Completo: reconhece série já projetada (3..10 em outras competências), isola compras distintas de meses passados e herda existingInstallmentGroupId", () => {
      const tx = createMockTransaction({
        id: "stmt-2-10",
        date: "2026-10-12",
        rawDescription: "LOJAS RENNER 02/10",
        cleanDescription: "LOJAS RENNER",
        amountCents: 10000,
        installment: { current: 2, total: 10 },
      });

      // Compra antiga disjunta (2026-08) aparece antes no array, mas não deve colidir com a competência futura 2026-11;
      // compra atual tem 3..10 projetadas em 2026-11..2027-06 com group-atual.
      const futureExpenses: ExistingExpenseForReconciliation[] = [
        {
          id: "exp-antiga-disjunta",
          description: "LOJAS RENNER 3/10",
          valueCents: 10000,
          date: "2026-08-12",
          categoryId: "cat-vestuario",
          installmentNumber: 3,
          installmentsTotal: 10,
          billCompetence: "2026-08",
          installmentGroupId: "group-antigo",
        },
        ...Array.from({ length: 8 }, (_, idx) => {
          const instNum = 3 + idx;
          const compDate = new Date(Date.UTC(2026, 9 + instNum - 2, 12));
          const y = compDate.getUTCFullYear();
          const m = String(compDate.getUTCMonth() + 1).padStart(2, "0");
          return {
            id: `exp-future-${instNum}`,
            description: `LOJAS RENNER ${instNum}/10`,
            valueCents: 10000,
            date: `${y}-${m}-12`,
            categoryId: "cat-vestuario",
            installmentNumber: instNum,
            installmentsTotal: 10,
            billCompetence: `${y}-${m}`,
            installmentGroupId: "group-atual",
          };
        }),
      ];

      const analysis = detectInstallmentSeriesState({
        transaction: tx,
        competenceMonth: "2026-10",
        existingExpenses: futureExpenses,
      });

      expect(analysis).not.toBeNull();
      expect(analysis?.state).toBe("state_4_already_projected");
      expect(analysis?.existingInstallmentGroupId).toBe("group-atual");
      expect(analysis?.futureProjectedCount).toBe(8);
      expect(analysis?.missingFutureInstallments).toEqual([]);
    });

    it("projeta apenas missingInstallments com groupId compartilhado, baseDate alinhada e statementHash determinístico", () => {
      const projected = projectFutureInstallments({
        currentInstallment: 3,
        totalInstallments: 6,
        installmentValueCents: 15000,
        baseDate: "2026-10-15",
        baseCompetence: "2026-10",
        description: "Notebook",
        categoryId: "cat-eletronicos",
        cardId: "card-abc",
        installmentGroupId: "group-xyz",
        missingInstallments: [4, 6],
      });

      expect(projected).toHaveLength(2);
      expect(projected[0]).toMatchObject({
        installmentNumber: 4,
        installmentsTotal: 6,
        billCompetence: "2026-11",
        date: "2026-11-15",
        installmentGroupId: "group-xyz",
      });
      expect(projected[1]).toMatchObject({
        installmentNumber: 6,
        installmentsTotal: 6,
        billCompetence: "2027-01",
        date: "2027-01-15",
        installmentGroupId: "group-xyz",
      });
      expect(projected[0]?.statementHash).toBeTruthy();
      expect(projected[0]?.statementHash).not.toBe(projected[1]?.statementHash);
    });
  });
});
