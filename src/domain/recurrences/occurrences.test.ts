import { describe, expect, it } from "vitest";
import { buildRecurrenceOccurrences, occurrencesForMonth, MAX_RECURRENCE_OCCURRENCES } from "./occurrences";
import type { RecurrenceRule } from "./types";

function makeRule(overrides: Partial<RecurrenceRule>): RecurrenceRule {
  return {
    id: "r1",
    kind: "expense",
    frequency: "monthly",
    valueCents: 9990,
    startDate: "2026-01-10",
    endDate: null,
    occurrencesTotal: 3,
    reportWeight: 1,
    isActive: true,
    ...overrides,
  };
}

const dates = (rule: RecurrenceRule) => buildRecurrenceOccurrences(rule).map((o) => o.date);

describe("buildRecurrenceOccurrences", () => {
  it("gera ocorrências mensais 1-based a partir da data inicial", () => {
    const occurrences = buildRecurrenceOccurrences(makeRule({}));
    expect(occurrences).toEqual([
      { id: "r1:2026-01-10", recurrenceId: "r1", date: "2026-01-10", occurrenceNumber: 1, valueCents: 9990 },
      { id: "r1:2026-02-10", recurrenceId: "r1", date: "2026-02-10", occurrenceNumber: 2, valueCents: 9990 },
      { id: "r1:2026-03-10", recurrenceId: "r1", date: "2026-03-10", occurrenceNumber: 3, valueCents: 9990 },
    ]);
  });

  it("mensal clampa o dia ao último dia do mês destino (31 → 28 → 28)", () => {
    expect(dates(makeRule({ startDate: "2026-01-31", occurrencesTotal: 3 }))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-28",
    ]);
  });

  it("mensal respeita fevereiro de ano bissexto (2028-01-31 → 2028-02-29)", () => {
    expect(dates(makeRule({ startDate: "2028-01-31", occurrencesTotal: 2 }))).toEqual(["2028-01-31", "2028-02-29"]);
  });

  it("semanal soma 7 dias preservando o dia da semana", () => {
    expect(dates(makeRule({ frequency: "weekly", startDate: "2026-01-05", occurrencesTotal: 4 }))).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
      "2026-01-26",
    ]);
  });

  it("semanal atravessa virada de ano", () => {
    expect(dates(makeRule({ frequency: "weekly", startDate: "2026-12-28", occurrencesTotal: 3 }))).toEqual([
      "2026-12-28",
      "2027-01-04",
      "2027-01-11",
    ]);
  });

  it("trimestral avança 3 meses com clamp", () => {
    expect(dates(makeRule({ frequency: "quarterly", startDate: "2026-01-15", occurrencesTotal: 3 }))).toEqual([
      "2026-01-15",
      "2026-04-15",
      "2026-07-15",
    ]);
  });

  it("anual avança 12 meses com clamp (29/02 → 28/02)", () => {
    expect(dates(makeRule({ frequency: "yearly", startDate: "2028-02-29", occurrencesTotal: 2 }))).toEqual([
      "2028-02-29",
      "2029-02-28",
    ]);
  });

  it("fim por data é inclusivo e limita as ocorrências", () => {
    const byDate = buildRecurrenceOccurrences(makeRule({ endDate: "2026-03-10", occurrencesTotal: null }));
    expect(byDate).toHaveLength(3);
    expect(byDate[2]?.date).toBe("2026-03-10");
  });

  it("fim por data exclui a ocorrência após o limite", () => {
    const byDate = buildRecurrenceOccurrences(makeRule({ endDate: "2026-03-09", occurrencesTotal: null }));
    expect(byDate.map((o) => o.date)).toEqual(["2026-01-10", "2026-02-10"]);
  });

  it("fim por contagem limita exatamente em N ocorrências", () => {
    expect(buildRecurrenceOccurrences(makeRule({ occurrencesTotal: 1 }))).toHaveLength(1);
  });

  it("lança quando data de fim e número de ocorrências estão ambos presentes", () => {
    expect(() => buildRecurrenceOccurrences(makeRule({ endDate: "2026-06-01", occurrencesTotal: 3 }))).toThrow(
      "exatamente um limite",
    );
  });

  it("lança quando nenhum limite é definido", () => {
    expect(() => buildRecurrenceOccurrences(makeRule({ endDate: null, occurrencesTotal: null }))).toThrow(
      "exatamente um limite",
    );
  });

  it("lança quando a data de fim precede a data de início", () => {
    expect(() => buildRecurrenceOccurrences(makeRule({ endDate: "2025-12-31", occurrencesTotal: null }))).toThrow(
      "anterior à data de início",
    );
  });

  it("lança com número de ocorrências inválido (zero ou não inteiro)", () => {
    expect(() => buildRecurrenceOccurrences(makeRule({ occurrencesTotal: 0 }))).toThrow("inteiro maior que zero");
    expect(() => buildRecurrenceOccurrences(makeRule({ occurrencesTotal: 1.5 }))).toThrow("inteiro maior que zero");
  });

  it("lança com valor inválido (não inteiro ou não positivo)", () => {
    expect(() => buildRecurrenceOccurrences(makeRule({ valueCents: 0 }))).toThrow("inteiro positivo");
    expect(() => buildRecurrenceOccurrences(makeRule({ valueCents: 10.5 }))).toThrow("inteiro positivo");
  });

  it("lança com data de início anterior a APP_START_DATE", () => {
    expect(() => buildRecurrenceOccurrences(makeRule({ startDate: "2025-12-31" }))).toThrow("2026-01-01");
  });

  it("lança acima do limite defensivo de ocorrências", () => {
    const rule = makeRule({ frequency: "weekly", startDate: "2026-01-01", endDate: null, occurrencesTotal: null });
    rule.endDate = "2100-01-01";
    expect(() => buildRecurrenceOccurrences(rule)).toThrow(String(MAX_RECURRENCE_OCCURRENCES));
  });
});

describe("occurrencesForMonth", () => {
  it("retorna apenas as ocorrências do mês informado", () => {
    const rule = makeRule({ startDate: "2026-01-31", occurrencesTotal: 12 });
    const feb = occurrencesForMonth(rule, "2026-02");
    expect(feb).toEqual([
      { id: "r1:2026-02-28", recurrenceId: "r1", date: "2026-02-28", occurrenceNumber: 2, valueCents: 9990 },
    ]);
    expect(occurrencesForMonth(rule, "2026-03").map((o) => o.date)).toEqual(["2026-03-28"]);
  });

  it("retorna lista vazia quando o mês não tem ocorrência", () => {
    expect(occurrencesForMonth(makeRule({ occurrencesTotal: 1 }), "2026-05")).toEqual([]);
  });

  it("lança com mês malformado", () => {
    expect(() => occurrencesForMonth(makeRule({}), "2026-13")).toThrow("AAAA-MM");
    expect(() => occurrencesForMonth(makeRule({}), "agosto")).toThrow("AAAA-MM");
  });
});
