import { describe, expect, it } from "vitest";
import { chunkArray } from "./chunking";

describe("chunkArray", () => {
  it("retorna array vazio para entrada vazia", () => {
    expect(chunkArray([], 250)).toEqual([]);
  });

  it("divide array corretamente pelo chunkSize fornecido", () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const chunks = chunkArray(items, 3);

    expect(chunks).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7],
    ]);
  });

  it("lança erro se chunkSize <= 0", () => {
    expect(() => chunkArray([1, 2, 3], 0)).toThrow("chunkSize deve ser maior que zero.");
  });
});

import {
  buildStatementCommitChunks,
  STATEMENT_COMMIT_CHUNK_SIZE,
  type StatementCommitExpenseChunkItem,
} from "./chunking";

describe("buildStatementCommitChunks (G11 / Chunking Transacional 500)", () => {
  it("usa STATEMENT_COMMIT_CHUNK_SIZE = 500 e gera 1 lote mesmo sem expenses quando há ações estruturais", () => {
    expect(STATEMENT_COMMIT_CHUNK_SIZE).toBe(500);

    const chunks = buildStatementCommitChunks({
      expenses: [],
      deleteExpenseIds: ["del-1"],
      linkAdjustments: [{ id: "adj-1", valueCents: 5000 }],
      competenceMoves: [{ id: "mov-1", billCompetence: "2026-11" }],
      refunds: [
        {
          amountCents: 2500,
          date: "2026-11-10",
          description: "Estorno Loja",
          billCompetence: "2026-11",
          statementHash: "h-ref-1",
        },
      ],
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.deleteExpenseIds).toEqual(["del-1"]);
    expect(chunks[0]?.linkAdjustments).toHaveLength(1);
    expect(chunks[0]?.competenceMoves).toHaveLength(1);
    expect(chunks[0]?.refunds).toHaveLength(1);
    expect(chunks[0]?.expenses).toEqual([]);
  });

  it("nunca divide uma mesma série (installmentGroupId) entre dois lotes ao cruzar o limite de 500", () => {
    // 495 itens avulsos + 12 parcelas com o mesmo installment_group_id = 507 itens
    const expenses: Array<StatementCommitExpenseChunkItem & { description: string }> = [
      ...Array.from({ length: 495 }, (_, idx) => ({
        description: `Avulsa ${idx}`,
        valueCents: 1000,
        date: "2026-11-10",
        categoryId: "cat-1",
        billCompetence: "2026-11",
        statementHash: `h-avulsa-${idx}`,
      })),
      ...Array.from({ length: 12 }, (_, idx) => ({
        description: `TV Parcela ${idx + 1}/12`,
        valueCents: 25000,
        date: "2026-11-10",
        categoryId: "cat-1",
        billCompetence: "2026-11",
        installmentCurrent: idx + 1,
        installmentTotal: 12,
        installment_group_id: "group-tv-12",
        statementHash: `h-tv-${idx}`,
      })),
    ];

    const chunks = buildStatementCommitChunks(
      {
        expenses,
        deleteExpenseIds: ["del-header"],
      },
      500,
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.deleteExpenseIds).toEqual(["del-header"]);
    expect(chunks[0]?.expenses).toHaveLength(495);
    expect(chunks[1]?.deleteExpenseIds).toEqual([]);
    expect(chunks[1]?.expenses).toHaveLength(12);
    expect(chunks[1]?.expenses.every((item) => item.installment_group_id === "group-tv-12")).toBe(
      true,
    );
  });
});
