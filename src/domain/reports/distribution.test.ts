import { describe, expect, it } from "vitest";
import { normalizePercentagesTo100 } from "./distribution";

describe("normalizePercentagesTo100 (Largest Remainder Method / Hamilton-Hare)", () => {
  it("retorna array vazio para entrada vazia", () => {
    expect(normalizePercentagesTo100([])).toEqual([]);
  });

  it("retorna zeros quando a soma for zero", () => {
    const items = [{ name: "A", rawPct: 0 }, { name: "B", rawPct: 0 }];
    const result = normalizePercentagesTo100(items);
    expect(result).toHaveLength(2);
    expect(result[0]?.formattedPct).toBe(0);
    expect(result[1]?.formattedPct).toBe(0);
  });

  it("resolve caso auditado do plano [23.84, 23.86, 29.96, 0.54, 21.72] somando exatamente 100,0%", () => {
    // Arredondamento ingênuo daria: 23.8 + 23.9 + 30.0 + 0.5 + 21.7 = 99.9%
    const items = [
      { name: "Ações", rawPct: 23.84 },
      { name: "FIIs", rawPct: 23.86 },
      { name: "Renda Fixa", rawPct: 29.96 },
      { name: "Caixa", rawPct: 0.54 },
      { name: "Internacional", rawPct: 21.72 },
    ];

    const result = normalizePercentagesTo100(items);

    const sum = result.reduce((acc, item) => acc + item.formattedPct, 0);
    const sumRounded = Math.round(sum * 10) / 10;
    expect(sumRounded).toBe(100.0);

    // O item com maior resto recebeu o centésimo deficitário
    expect(result.map((r) => r.displayPctStr)).toEqual([
      "23,9%",
      "23,9%",
      "30,0%",
      "0,5%",
      "21,7%",
    ]);
  });

  it("resolve caso onde arredondamento simples estouraria 100,1%", () => {
    // 33.36 (33.4), 33.36 (33.4), 33.28 (33.3) -> soma 100.1% ingênuo
    const items = [
      { id: "1", rawPct: 33.36 },
      { id: "2", rawPct: 33.36 },
      { id: "3", rawPct: 33.28 },
    ];

    const result = normalizePercentagesTo100(items);
    const sum = result.reduce((acc, item) => acc + item.formattedPct, 0);
    expect(Math.round(sum * 10) / 10).toBe(100.0);
  });

  it("preserva propriedades adicionais dos objetos genéricos", () => {
    const items = [
      { ticker: "VALE3", color: "#333", rawPct: 60 },
      { ticker: "PETR4", color: "#444", rawPct: 40 },
    ];

    const result = normalizePercentagesTo100(items);
    expect(result[0]?.ticker).toBe("VALE3");
    expect(result[0]?.color).toBe("#333");
    expect(result[0]?.formattedPct).toBe(60);
    expect(result[0]?.displayPctStr).toBe("60,0%");

    expect(result[1]?.ticker).toBe("PETR4");
    expect(result[1]?.formattedPct).toBe(40);
    expect(result[1]?.displayPctStr).toBe("40,0%");
  });
});
