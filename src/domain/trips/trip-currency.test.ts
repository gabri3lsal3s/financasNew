import { describe, expect, it } from "vitest";
import {
  convertForeignCentsToBrlCents,
  detectForeignCurrencyFromText,
  formatForeignCurrencyAmount,
  normalizeTripCurrencyCode,
} from "./trip-currency";

describe("trip-currency — Conversão e Detecção Cambial Pura", () => {
  it("converte moeda estrangeira para centavos BRL usando escala inteira determinística", () => {
    // US$ 45,50 * 5,82 = R$ 264,81 (26.481 centavos)
    expect(convertForeignCentsToBrlCents(4550, 5.82)).toBe(26_481);
    // EUR 100,00 * 6,154 = R$ 615,40 (61.540 centavos)
    expect(convertForeignCentsToBrlCents(10_000, 6.154)).toBe(61_540);
    // Entradas inválidas ou zeradas retornam 0
    expect(convertForeignCentsToBrlCents(0, 5.8)).toBe(0);
    expect(convertForeignCentsToBrlCents(1000, 0)).toBe(0);
    expect(convertForeignCentsToBrlCents(-500, 5.8)).toBe(0);
  });

  it("detecta USD, EUR, GBP, ARS, CLP e UYU sem confundir R$ brasileiro", () => {
    expect(detectForeignCurrencyFromText("Recibo Hotel Paris € 120,00")).toBe("EUR");
    expect(detectForeignCurrencyFromText("Uber Heathrow GBP 32.50")).toBe("GBP");
    expect(detectForeignCurrencyFromText("Cafe Palermo ARS 18.500,00")).toBe("ARS");
    expect(detectForeignCurrencyFromText("Compra Miami US$ 75.00")).toBe("USD");
    expect(detectForeignCurrencyFromText("Invoice NY $49.90")).toBe("USD");
    // Cupom fiscal brasileiro jamais vira USD
    expect(detectForeignCurrencyFromText("REDE MOLEZA Valor a Pagar R$ 270,00")).toBeNull();
  });

  it("normaliza códigos ISO suportados e formata moeda estrangeira", () => {
    expect(normalizeTripCurrencyCode("eur")).toBe("EUR");
    expect(normalizeTripCurrencyCode("brl")).toBe("BRL");
    expect(normalizeTripCurrencyCode("JPY")).toBeNull();
    expect(formatForeignCurrencyAmount(4550, "USD")).toContain("45,50");
  });
});
