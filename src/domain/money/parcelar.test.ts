import { describe, expect, it } from "vitest";
import { addMonthsClamped, parcelar, somaCents, splitCents, toISODate } from "./parcelar";

describe("splitCents — divisão exata em centavos (§3.2.2)", () => {
  it("distribui o resto nas primeiras parcelas (R$ 100 ÷ 3 → 33,34/33,33/33,33)", () => {
    expect(splitCents(10000, 3)).toEqual([3334, 3333, 3333]);
  });

  it("mantém a soma idêntica ao total (invariante D12)", () => {
    for (const [total, count] of [
      [10000, 3],
      [150000, 60],
      [1, 1],
      [999, 7],
      [123456, 12],
    ] as const) {
      const parts = splitCents(total, count);
      expect(somaCents(parts)).toBe(total);
    }
  });

  it("divide valores divisíveis exatamente", () => {
    expect(splitCents(100, 4)).toEqual([25, 25, 25, 25]);
    expect(splitCents(0, 1)).toEqual([0]);
  });

  it("valida o intervalo 1–60", () => {
    expect(() => splitCents(1000, 0)).toThrow();
    expect(() => splitCents(1000, 61)).toThrow();
    expect(() => splitCents(1000, 60)).not.toThrow();
  });

  it("rejeita totais negativos ou não inteiros", () => {
    expect(() => splitCents(-1, 2)).toThrow();
    expect(() => splitCents(10.5, 2)).toThrow();
  });
});

describe("parcelar — plano com datas mensais", () => {
  it("gera uma parcela por mês com número 1-based", () => {
    const plano = parcelar(10000, 3, new Date(2026, 0, 15));
    expect(plano).toHaveLength(3);
    expect(plano.map((p) => p.number)).toEqual([1, 2, 3]);
    expect(plano.map((p) => p.total)).toEqual([3, 3, 3]);
    expect(plano.map((p) => p.date)).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
    expect(somaCents(plano.map((p) => p.valueCents))).toBe(10000);
  });

  it("clampa o dia ao fim de mês (31/01 + 1 mês → 28/02)", () => {
    expect(toISODate(addMonthsClamped(new Date(2026, 0, 31), 1))).toBe("2026-02-28");
    expect(toISODate(addMonthsClamped(new Date(2024, 0, 31), 1))).toBe("2024-02-29"); // bissexto
    expect(toISODate(addMonthsClamped(new Date(2026, 2, 31), 1))).toBe("2026-04-30");
  });

  it("cruza o ano corretamente", () => {
    const plano = parcelar(1000, 2, new Date(2026, 10, 10));
    expect(plano.map((p) => p.date)).toEqual(["2026-11-10", "2026-12-10"]);
    const cruza = parcelar(1000, 2, new Date(2026, 11, 10));
    expect(cruza.map((p) => p.date)).toEqual(["2026-12-10", "2027-01-10"]);
  });
});
