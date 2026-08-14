import { describe, expect, it } from "vitest";
import {
  CURRENCY_INPUT_MAX_DIGITS,
  appendDigit,
  brlFromCents,
  centsFromDigits,
  digitsFromCents,
  extractDigits,
  removeLastDigit,
} from "./currency-input";

describe("currency-input (padrão Nubank — digitação da direita para a esquerda)", () => {
  it("sequência 1 → 5 → 0 → 0 → 0 → 0 desloca o valor para a esquerda", () => {
    let digits = appendDigit("", "1"); // R$ 0,01
    expect(centsFromDigits(digits)).toBe(1);

    digits = appendDigit(digits, "5"); // R$ 0,15
    expect(centsFromDigits(digits)).toBe(15);

    digits = appendDigit(digits, "0"); // R$ 1,50
    expect(centsFromDigits(digits)).toBe(150);

    digits = appendDigit(digits, "0"); // R$ 15,00
    expect(centsFromDigits(digits)).toBe(1500);

    digits = appendDigit(digits, "0"); // R$ 150,00
    expect(centsFromDigits(digits)).toBe(15000);

    digits = appendDigit(digits, "0"); // R$ 1.500,00
    expect(centsFromDigits(digits)).toBe(150000);
  });

  it("backspace recua na ordem inversa", () => {
    // R$ 15,00 → R$ 1,50
    expect(removeLastDigit("1500")).toBe("150");
    expect(centsFromDigits(removeLastDigit("1500"))).toBe(150);
    // R$ 0,01 → R$ 0,00
    expect(removeLastDigit("1")).toBe("");
    expect(centsFromDigits(removeLastDigit("1"))).toBe(0);
  });

  it("zeros à esquerda são descartados pela interpretação em centavos", () => {
    expect(centsFromDigits("007")).toBe(7); // R$ 0,07
  });

  it("extractDigits limpa entrada formatada ou colada", () => {
    expect(extractDigits("R$ 1.500,00")).toBe("150000");
    expect(extractDigits("12a3,4.5")).toBe("12345");
    expect(extractDigits("")).toBe("");
  });

  it("respeita o limite de 12 dígitos (numeric(12,2))", () => {
    const raw = "1".repeat(CURRENCY_INPUT_MAX_DIGITS + 5);
    expect(extractDigits(raw)).toHaveLength(CURRENCY_INPUT_MAX_DIGITS);
    const digits = "9".repeat(CURRENCY_INPUT_MAX_DIGITS);
    expect(appendDigit(digits, "1")).toBe(digits); // não estoura o limite
  });

  it("appendDigit ignora caracteres não numéricos", () => {
    expect(appendDigit("12", ",")).toBe("12");
    expect(appendDigit("12", "x")).toBe("12");
  });

  it("converte centavos para reais e vice-versa", () => {
    expect(brlFromCents(150000)).toBe(1500);
    expect(brlFromCents(1)).toBe(0.01);
    expect(digitsFromCents(1500)).toBe("1500");
    expect(digitsFromCents(0)).toBe("");
    expect(digitsFromCents(-5)).toBe("");
  });

});
