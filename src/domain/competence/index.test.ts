import { describe, expect, it } from "vitest";
import { clampDay, dueDateOfCompetence, resolveBillCompetence, resolveBillCompetenceWithOverrides } from "./index";

describe("clampDay", () => {
  it("limita o dia ao último dia do mês", () => {
    expect(clampDay(31, 2026, 0)).toBe(31); // jan
    expect(clampDay(31, 2026, 1)).toBe(28); // fev
    expect(clampDay(31, 2024, 1)).toBe(29); // fev bissexto
    expect(clampDay(31, 2026, 3)).toBe(30); // abr
    expect(clampDay(0, 2026, 0)).toBe(1);
    expect(clampDay(-5, 2026, 0)).toBe(1);
  });
});

describe("resolveBillCompetence (§3.3.2)", () => {
  it("dia da compra < closing → fatura do mês atual", () => {
    expect(resolveBillCompetence(new Date(2026, 3, 5), 10)).toBe("2026-04");
  });

  it("dia da compra ≥ closing → fatura do mês seguinte", () => {
    expect(resolveBillCompetence(new Date(2026, 3, 10), 10)).toBe("2026-05");
    expect(resolveBillCompetence(new Date(2026, 3, 25), 10)).toBe("2026-05");
  });

  it("cruza o ano (compra em dezembro após closing → janeiro)", () => {
    expect(resolveBillCompetence(new Date(2026, 11, 20), 10)).toBe("2027-01");
  });

  it("usa o clamp no mês da compra (closing 31 em abril → 30)", () => {
    // 30/04 ≥ 30 → maio; 29/04 < 30 → abril
    expect(resolveBillCompetence(new Date(2026, 3, 30), 31)).toBe("2026-05");
    expect(resolveBillCompetence(new Date(2026, 3, 29), 31)).toBe("2026-04");
  });
});

describe("resolveBillCompetenceWithOverrides (D3)", () => {
  const overrides = [{ month: "2026-04", closingDay: 5, dueDay: 20 }];

  it("override prevalece sobre o padrão", () => {
    // Com padrão 10: 07/04 → abril; com override 5: 07/04 ≥ 5 → maio.
    expect(resolveBillCompetenceWithOverrides(new Date(2026, 3, 7), 10, overrides)).toBe("2026-05");
  });

  it("sem override do mês, usa o padrão", () => {
    expect(resolveBillCompetenceWithOverrides(new Date(2026, 5, 7), 10, overrides)).toBe("2026-06");
  });
});

describe("dueDateOfCompetence", () => {
  it("calcula o vencimento com clamp do due day", () => {
    expect(dueDateOfCompetence("2026-02", 10)).toBe("2026-02-10");
    expect(dueDateOfCompetence("2026-02", 31)).toBe("2026-02-28");
    expect(dueDateOfCompetence("2026-04", 30)).toBe("2026-04-30");
  });

  it("rejeita mês inválido", () => {
    expect(() => dueDateOfCompetence("2026-13", 10)).toThrow();
  });
});
