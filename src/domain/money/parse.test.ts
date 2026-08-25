import { describe, expect, it } from "vitest";
import { formatDecimalNumber, numberToCents, parseBRLToCents, parseDecimalNumber } from "./parse";
import { formatCentsAsBRL } from "@/services/masks/money";

describe("parseBRLToCents", () => {
  it("interpreta formatos pt-BR comuns", () => {
    expect(parseBRLToCents("R$ 1.500,00")).toBe(150000);
    expect(parseBRLToCents("1.500,00")).toBe(150000);
    expect(parseBRLToCents("1500,5")).toBe(150050);
    expect(parseBRLToCents("1500")).toBe(150000);
    expect(parseBRLToCents("0,01")).toBe(1);
    expect(parseBRLToCents("0")).toBe(0);
  });

  it("retorna null para entradas inválidas", () => {
    expect(parseBRLToCents("")).toBeNull();
    expect(parseBRLToCents("abc")).toBeNull();
    expect(parseBRLToCents("-10")).toBeNull();
    expect(parseBRLToCents("1.500,123")).toBeNull();
    expect(parseBRLToCents("R$")).toBeNull();
  });
});

// A formatação exibível vive em services/masks/money (fonte única — DRY);
// este teste garante que o contrato de formatação permanece o esperado.
describe("formatação canônica (formatCentsAsBRL)", () => {
  it("formata em pt-BR com R$ e milhar", () => {
    expect(formatCentsAsBRL(150000)).toBe("R$\u00a01.500,00");
    expect(formatCentsAsBRL(1)).toBe("R$\u00a00,01");
  });
});

describe("numberToCents (F19 — helper canônico)", () => {
  it("converte valores finitos com arredondamento", () => {
    expect(numberToCents(42.5)).toBe(4250);
    expect(numberToCents(0)).toBe(0);
    expect(numberToCents(-3.25)).toBe(-325);
  });

  it("zera NaN/Infinity (guarda isFinite — contrato único)", () => {
    expect(numberToCents(Number.NaN)).toBe(0);
    expect(numberToCents(Number.POSITIVE_INFINITY)).toBe(0);
    expect(numberToCents(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("parseDecimalNumber", () => {
  it("trata números com vírgula e ponto com robustez", () => {
    expect(parseDecimalNumber("8,52")).toBe(8.52);
    expect(parseDecimalNumber("8.52")).toBe(8.52);
    expect(parseDecimalNumber("110")).toBe(110);
    expect(parseDecimalNumber("12,5%")).toBe(12.5);
    expect(parseDecimalNumber(" 1.234,56 ")).toBe(1234.56);
    expect(parseDecimalNumber("1234.56")).toBe(1234.56);
    expect(parseDecimalNumber(8.52)).toBe(8.52);
    expect(parseDecimalNumber(null)).toBe(0);
    expect(parseDecimalNumber("")).toBe(0);
    expect(parseDecimalNumber("abc")).toBe(0);
  });
});

describe("formatDecimalNumber", () => {
  it("formata inteiros e decimais amigavelmente em pt-BR", () => {
    expect(formatDecimalNumber(100)).toBe("100");
    expect(formatDecimalNumber(8.52)).toBe("8,52");
    expect(formatDecimalNumber(12.5)).toBe("12,5");
    expect(formatDecimalNumber(null)).toBe("");
  });
});
