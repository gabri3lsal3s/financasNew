import { describe, expect, it } from "vitest";
import { formatPercent, formatSignedPct } from "./percent";

describe("formatPercent (máscara percentual pt-BR)", () => {
  it("formata com vírgula decimal e 1 casa", () => {
    expect(formatPercent(12.345)).toBe("12,3");
    expect(formatPercent(3)).toBe("3,0");
    expect(formatPercent(0)).toBe("0,0");
  });

  it("trata valores inválidos como 0", () => {
    expect(formatPercent(Number.NaN)).toBe("0,0");
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe("0,0");
  });
});

describe("formatSignedPct (percentual com sinal e sufixo)", () => {
  it("formata com sinal, vírgula decimal e %", () => {
    expect(formatSignedPct(12.345)).toBe("+12,3%");
    expect(formatSignedPct(-3)).toBe("-3,0%");
    expect(formatSignedPct(0)).toBe("0,0%");
  });

  it("retorna — para null ou inválidos", () => {
    expect(formatSignedPct(null)).toBe("—");
    expect(formatSignedPct(Number.NaN)).toBe("—");
    expect(formatSignedPct(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
