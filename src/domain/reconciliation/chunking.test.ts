import { describe, expect, it } from "vitest";
import {
  STATEMENT_IMPORT_CHUNK_SIZE,
  chunkArray,
  chunkBankStatementBatch,
} from "./chunking";

describe("chunkBankStatementBatch", () => {
  it("retorna array vazio quando ambas as listas de entrada estão vazias", () => {
    const result = chunkBankStatementBatch([], []);
    expect(result).toEqual([]);
  });

  it("retorna lote único quando total de itens é inferior ou igual a 250", () => {
    const expenses = Array.from({ length: 150 }, (_, i) => ({ id: `exp-${i}` }));
    const incomes = Array.from({ length: 100 }, (_, i) => ({ id: `inc-${i}` }));

    const chunks = chunkBankStatementBatch(expenses, incomes, STATEMENT_IMPORT_CHUNK_SIZE);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.expenses).toHaveLength(150);
    expect(chunks[0]!.incomes).toHaveLength(100);
    expect(chunks[0]!.expenses[0]!.id).toBe("exp-0");
    expect(chunks[0]!.incomes[99]!.id).toBe("inc-99");
  });

  it("particiona corretamente quando total de despesas excede 250 itens", () => {
    const expenses = Array.from({ length: 300 }, (_, i) => ({ id: `exp-${i}` }));
    const incomes: { id: string }[] = [];

    const chunks = chunkBankStatementBatch(expenses, incomes, 250);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.expenses).toHaveLength(250);
    expect(chunks[0]!.incomes).toHaveLength(0);
    expect(chunks[1]!.expenses).toHaveLength(50);
    expect(chunks[1]!.incomes).toHaveLength(0);

    // Garante que todos os itens foram preservados e na mesma ordem
    expect(chunks[0]!.expenses[0]!.id).toBe("exp-0");
    expect(chunks[0]!.expenses[249]!.id).toBe("exp-249");
    expect(chunks[1]!.expenses[0]!.id).toBe("exp-250");
    expect(chunks[1]!.expenses[49]!.id).toBe("exp-299");
  });

  it("combina despesas e receitas no mesmo chunk respeitando o teto de 250", () => {
    // 200 despesas + 100 receitas = 300 total
    // Lote 1: 200 despesas + 50 receitas (250)
    // Lote 2: 0 despesas + 50 receitas (50)
    const expenses = Array.from({ length: 200 }, (_, i) => ({ id: `exp-${i}` }));
    const incomes = Array.from({ length: 100 }, (_, i) => ({ id: `inc-${i}` }));

    const chunks = chunkBankStatementBatch(expenses, incomes, 250);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.expenses).toHaveLength(200);
    expect(chunks[0]!.incomes).toHaveLength(50);
    expect(chunks[0]!.expenses.length + chunks[0]!.incomes.length).toBe(250);

    expect(chunks[1]!.expenses).toHaveLength(0);
    expect(chunks[1]!.incomes).toHaveLength(50);
    expect(chunks[1]!.expenses.length + chunks[1]!.incomes.length).toBe(50);

    // Verifica continuidade das receitas entre o lote 1 e 2
    expect(chunks[0]!.incomes[0]!.id).toBe("inc-0");
    expect(chunks[0]!.incomes[49]!.id).toBe("inc-49");
    expect(chunks[1]!.incomes[0]!.id).toBe("inc-50");
    expect(chunks[1]!.incomes[49]!.id).toBe("inc-99");
  });

  it("particiona apenas receitas quando não há despesas", () => {
    const incomes = Array.from({ length: 550 }, (_, i) => ({ id: `inc-${i}` }));

    const chunks = chunkBankStatementBatch([], incomes, 250);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]!.incomes).toHaveLength(250);
    expect(chunks[1]!.incomes).toHaveLength(250);
    expect(chunks[2]!.incomes).toHaveLength(50);
  });

  it("lança erro se maxChunkSize for menor ou igual a 0", () => {
    expect(() => chunkBankStatementBatch([{ id: 1 }], [], 0)).toThrow(
      "maxChunkSize deve ser maior que zero.",
    );
    expect(() => chunkBankStatementBatch([{ id: 1 }], [], -10)).toThrow(
      "maxChunkSize deve ser maior que zero.",
    );
  });
});

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
