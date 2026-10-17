import { describe, expect, it } from "vitest";
import { formatCentsAsBRL, formatCentsAsCurrency } from "./money";

describe("formatCentsAsBRL (máscara de moeda pt-BR)", () => {
  it("formata com R$, milhar com ponto e decimal com vírgula", () => {
    expect(formatCentsAsBRL(150000)).toBe("R$\u00a01.500,00");
    expect(formatCentsAsBRL(1500)).toBe("R$\u00a015,00");
    expect(formatCentsAsBRL(150)).toBe("R$\u00a01,50");
    expect(formatCentsAsBRL(1)).toBe("R$\u00a00,01");
    expect(formatCentsAsBRL(0)).toBe("R$\u00a00,00");
  });

  it("trata valores inválidos/negativos como R$ 0,00 (input só aceita positivos)", () => {
    expect(formatCentsAsBRL(-5)).toBe("R$\u00a00,00");
    expect(formatCentsAsBRL(Number.NaN)).toBe("R$\u00a00,00");
    expect(formatCentsAsBRL(Number.POSITIVE_INFINITY)).toBe("R$\u00a00,00");
  });

  it("formata USD em formato pt-BR com prefixo US$", () => {
    expect(formatCentsAsCurrency(43048, "USD")).toBe("US$\u00a0430,48");
    expect(formatCentsAsCurrency(162010, "USD")).toBe("US$\u00a01.620,10");
  });

  it("formata sem centavos quando hideCents for true", () => {
    expect(formatCentsAsBRL(150000, { hideCents: true })).toBe("R$\u00a01.500");
    expect(formatCentsAsBRL(125000, { hideCents: true })).toBe("R$\u00a01.250");
    expect(formatCentsAsBRL(1500, { hideCents: true })).toBe("R$\u00a015");
    expect(formatCentsAsBRL(0, { hideCents: true })).toBe("R$\u00a00");
    expect(formatCentsAsCurrency(43048, "USD", { hideCents: true })).toBe("US$\u00a0430");
  });
});
