import { beforeEach, describe, expect, it, vi } from "vitest";
import { isCalculatorOpen, setCalculatorOpen, subscribeCalculatorOpen } from "./calculator-open";

describe("calculator-open — store de abertura da calculadora (pós-F10)", () => {
  beforeEach(() => {
    setCalculatorOpen(false);
  });

  it("começa fechada", () => {
    expect(isCalculatorOpen()).toBe(false);
  });

  it("abre e fecha via setter", () => {
    setCalculatorOpen(true);
    expect(isCalculatorOpen()).toBe(true);
    setCalculatorOpen(false);
    expect(isCalculatorOpen()).toBe(false);
  });

  it("notifica assinantes apenas quando o estado muda", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCalculatorOpen(listener);

    setCalculatorOpen(true);
    expect(listener).toHaveBeenCalledTimes(1);

    // Mesmo valor: sem notificação (idempotente).
    setCalculatorOpen(true);
    expect(listener).toHaveBeenCalledTimes(1);

    setCalculatorOpen(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("para de notificar após unsubscribe", () => {
    const listener = vi.fn();
    subscribeCalculatorOpen(listener)();

    setCalculatorOpen(true);
    expect(listener).not.toHaveBeenCalled();
  });
});
