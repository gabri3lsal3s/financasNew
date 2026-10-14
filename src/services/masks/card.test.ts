import { describe, expect, it } from "vitest";
import { formatCardNumber, formatCardExpiry } from "./card";

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
});
