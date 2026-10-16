import { describe, expect, it } from "vitest";
import { formatCardNumber, formatCardExpiry, detectCardBrand } from "./card";

describe("Card Masks", () => {
  it("formata número de cartão em blocos de 4", () => {
    expect(formatCardNumber("4111")).toBe("4111");
    expect(formatCardNumber("41111111")).toBe("4111 1111");
    expect(formatCardNumber("4111111111111111")).toBe("4111 1111 1111 1111");
    expect(formatCardNumber("41111111111111119999")).toBe("4111 1111 1111 1111");
  });

  it("formata validade no padrão MM/AA", () => {
    expect(formatCardExpiry("1")).toBe("1");
    expect(formatCardExpiry("12")).toBe("12");
    expect(formatCardExpiry("1228")).toBe("12/28");
    expect(formatCardExpiry("122899")).toBe("12/28");
  });

  it("detecta a bandeira de cartão a partir do prefixo de dígitos", () => {
    expect(detectCardBrand("4111 2222 3333 4444")).toBe("Visa");
    expect(detectCardBrand("5500 0000 0000 0000")).toBe("Mastercard");
    expect(detectCardBrand("2221 0000 0000 0000")).toBe("Mastercard");
    expect(detectCardBrand("4011 0000 0000 0000")).toBe("Elo");
    expect(detectCardBrand("3400 0000 0000 000")).toBe("Amex");
    expect(detectCardBrand("3700 0000 0000 000")).toBe("Amex");
    expect(detectCardBrand("6062 0000 0000 0000")).toBe("Hipercard");
    expect(detectCardBrand("")).toBeNull();
    expect(detectCardBrand("9999 0000")).toBeNull();
  });
});
