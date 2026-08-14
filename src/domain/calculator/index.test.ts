import { describe, expect, it } from "vitest";
import {
  INITIAL_STATE,
  addHistory,
  centsToDecimal,
  computeCents,
  decimalToCents,
  pressBackspace,
  pressDigit,
  pressEquals,
  pressOperator,
  splitInstallments,
} from "./index";

describe("conversões decimal ↔ centavos", () => {
  it("decimalToCents converte strings decimais", () => {
    expect(decimalToCents("12.5")).toBe(1250);
    expect(decimalToCents("0")).toBe(0);
    expect(decimalToCents("33.333")).toBe(3333);
    expect(decimalToCents("")).toBe(0);
  });

  it("centsToDecimal produz string decimal", () => {
    expect(centsToDecimal(250)).toBe("2.5");
    expect(centsToDecimal(3333)).toBe("33.33");
    expect(centsToDecimal(0)).toBe("0");
  });
});

describe("computeCents — operações em centavos", () => {
  it("soma e subtração", () => {
    expect(computeCents(1000, "+", 2500)).toBe(3500);
    expect(computeCents(1000, "−", 2500)).toBe(-1500);
  });

  it("multiplicação com decimais (round)", () => {
    // 2.5 × 3 = 7.5
    expect(computeCents(250, "×", 300)).toBe(750);
  });

  it("divisão produz decimais", () => {
    // 10 ÷ 4 = 2.5
    expect(computeCents(1000, "÷", 400)).toBe(250);
    // 100 ÷ 3 = 33.33
    expect(computeCents(10000, "÷", 300)).toBe(3333);
  });

  it("divisão por zero retorna null", () => {
    expect(computeCents(1000, "÷", 0)).toBeNull();
  });
});

describe("entrada de dígitos", () => {
  it("dígitos constroem o display (zero à esquerda trocado)", () => {
    let state = pressDigit(INITIAL_STATE, "5");
    state = pressDigit(state, "0");
    state = pressDigit(state, "0");
    expect(state.display).toBe("500");
  });

  it("vírgula decimal única", () => {
    const state = pressDigit(pressDigit(pressDigit(INITIAL_STATE, "1"), "."), ".");
    expect(state.display).toBe("1.");
    const withFrac = pressDigit(state, "5");
    expect(withFrac.display).toBe("1.5");
  });

  it("após '=' o próximo dígito recomeça", () => {
    let state = pressDigit(INITIAL_STATE, "2");
    state = pressOperator(state, "+");
    state = pressDigit(state, "3");
    const sum = pressEquals(state);
    const after = pressDigit(pressDigit(sum, "3"), "7");
    expect(after.display).toBe("37");
  });

  it("após operador o próximo dígito substitui o display (novo operando)", () => {
    let state = pressDigit(INITIAL_STATE, "2");
    state = pressOperator(state, "+");
    const operand = pressDigit(pressDigit(state, "3"), "4");
    expect(operand.display).toBe("34");
  });

  it("backspace remove o último caractere", () => {
    const state = pressBackspace(pressDigit(pressDigit(INITIAL_STATE, "1"), "2"));
    expect(state.display).toBe("1");
    expect(pressBackspace(pressDigit(INITIAL_STATE, "1")).display).toBe("0");
  });
});

describe("avaliação de expressões", () => {
  it("2 + 3 = 5", () => {
    let state = pressDigit(INITIAL_STATE, "2");
    state = pressOperator(state, "+");
    state = pressDigit(state, "3");
    state = pressEquals(state);
    expect(state.display).toBe("5");
    expect(state.justEvaluated).toBe(true);
  });

  it("encadeamento avalia da esquerda para a direita (100 + 2 × 3 = 306)", () => {
    let state = pressDigit(pressDigit(pressDigit(INITIAL_STATE, "1"), "0"), "0");
    state = pressOperator(state, "+");
    state = pressDigit(state, "2");
    state = pressOperator(state, "×"); // avalia 100 + 2 = 102
    state = pressDigit(state, "3");
    state = pressEquals(state); // 102 × 3
    expect(decimalToCents(state.display)).toBe(30600);
  });

  it("operador repetido sem operando novo apenas troca a operação", () => {
    let state = pressDigit(INITIAL_STATE, "2");
    state = pressOperator(state, "+");
    state = pressOperator(state, "÷"); // 2 + × → 2 ÷
    state = pressDigit(state, "4");
    state = pressEquals(state);
    expect(decimalToCents(state.display)).toBe(50); // 2 ÷ 4 = 0.5
  });

  it("divisão por zero marca erro e qualquer tecla recomeça", () => {
    let state = pressDigit(INITIAL_STATE, "5");
    state = pressOperator(state, "÷");
    state = pressDigit(state, "0");
    state = pressEquals(state);
    expect(state.error).toBe(true);

    const next = pressDigit(state, "7");
    expect(next.error).toBe(false);
    expect(next.display).toBe("7");
  });
});

describe("splitInstallments — divisão exata em centavos (F9)", () => {
  it("100 ÷ 3 → 33,34 / 33,33 / 33,33 (resto nas primeiras)", () => {
    const parts = splitInstallments(10000, 3);
    expect(parts).toEqual([3334, 3333, 3333]);
    expect(parts.reduce((acc, value) => acc + value, 0)).toBe(10000);
  });

  it("rejeita contagens fora de 1–60 (invariante do parcelamento)", () => {
    expect(() => splitInstallments(1000, 0)).toThrow();
    expect(() => splitInstallments(1000, 61)).toThrow();
  });
});

describe("addHistory — histórico limitado", () => {
  it("mais recente primeiro, máx. 5 entradas", () => {
    let history: ReturnType<typeof addHistory> = [];
    for (let index = 1; index <= 7; index += 1) {
      history = addHistory(history, { expression: `${index}`, resultCents: index * 100 });
    }
    expect(history).toHaveLength(5);
    expect(history[0]?.resultCents).toBe(700);
    expect(history[4]?.resultCents).toBe(300);
  });
});
