import { describe, expect, it } from "vitest";
import { currentMonth, currentYear, formatDateBR, isValidMonth, isValidYear, monthLabel, monthRange, shiftMonth, yearRange } from "./date";

describe("lib/date (§4.1 — meses e anos em timezone local, sem toISOString)", () => {
  it("isValidMonth aceita apenas YYYY-MM", () => {
    expect(isValidMonth("2026-08")).toBe(true);
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("2026-8")).toBe(false);
    expect(isValidMonth("202608")).toBe(false);
    expect(isValidMonth("")).toBe(false);
  });

  it("shiftMonth desloca sem salto de mês (dez→jan, jan→dez)", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-06", 6)).toBe("2026-12");
    expect(shiftMonth("2026-06", -6)).toBe("2025-12");
    expect(shiftMonth("2026-08", 0)).toBe("2026-08");
  });

  it("monthRange: [primeiro dia do mês, primeiro dia do seguinte) — exclusivo no fim", () => {
    expect(monthRange("2026-08")).toEqual({ start: "2026-08-01", end: "2026-09-01" });
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });

  it("monthRange rejeita mês inválido com erro claro", () => {
    expect(() => monthRange("2026-13")).toThrow(/Mês inválido/);
  });

  it("monthLabel formata pt-BR curto", () => {
    expect(monthLabel("2026-08")).toMatch(/ago/i);
  });

  it("currentMonth retorna o mês corrente no fuso local", () => {
    const now = new Date();
    expect(currentMonth()).toBe(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  });

  it("currentYear retorna o ano corrente", () => {
    expect(currentYear()).toBe(new Date().getFullYear());
  });

  it("isValidYear valida anos plausíveis", () => {
    expect(isValidYear(2026)).toBe(true);
    expect(isValidYear(1899)).toBe(false);
    expect(isValidYear(2101)).toBe(false);
    expect(isValidYear(2026.5)).toBe(false);
  });

  it("yearRange retorna intervalo do ano de 01/01 até 01/01 do ano seguinte", () => {
    expect(yearRange(2026)).toEqual({ start: "2026-01-01", end: "2027-01-01" });
  });

  it("yearRange rejeita ano inválido com erro claro", () => {
    expect(() => yearRange(1800)).toThrow(/Ano inválido/);
  });

  describe("formatDateBR (data ISO → dd/mm/aaaa)", () => {
    it("formata data pura", () => {
      expect(formatDateBR("2026-08-15")).toBe("15/08/2026");
      expect(formatDateBR("2026-01-05")).toBe("05/01/2026");
    });

    it("ignora componente de hora", () => {
      expect(formatDateBR("2026-08-15T12:00:00")).toBe("15/08/2026");
    });

    it("retorna o próprio valor quando o formato é inválido (fallback seguro)", () => {
      expect(formatDateBR("invalido")).toBe("invalido");
      expect(formatDateBR("2026-13-99")).toBe("2026-13-99");
      expect(formatDateBR("")).toBe("");
    });
  });
});

