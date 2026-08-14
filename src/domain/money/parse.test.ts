import { describe, expect, it } from "vitest";
import { centsToBRL, parseBRLToCents } from "./parse";

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

describe("centsToBRL", () => {
  it("formata em pt-BR com R$ e milhar", () => {
    expect(centsToBRL(150000)).toBe("R$\u00a01.500,00");
    expect(centsToBRL(1)).toBe("R$\u00a00,01");
  });
});
