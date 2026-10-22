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
