import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearCalculatorTargets,
  getActiveDecimalDisplay,
  getActiveTargetCents,
  getActiveTargetLabel,
  getCalculatorTarget,
  hasActiveTarget,
  injectCalculatedValue,
  injectDecimalValue,
  registerCalculatorTarget,
  subscribeCalculatorTarget,
  unregisterCalculatorTarget,
} from "./calculator-bridge";

afterEach(() => {
  clearCalculatorTargets();
});

describe("calculator-bridge (F9 — Decisão C)", () => {
  it("injeta o valor em centavos no campo registrado", () => {
    const setter = vi.fn();
    registerCalculatorTarget(setter);

    expect(injectCalculatedValue(12345)).toBe(true);
    expect(setter).toHaveBeenCalledWith(12345);
  });

  it("o último campo registrado vence (topo da pilha LIFO)", () => {
    const first = vi.fn();
    const second = vi.fn();
    registerCalculatorTarget(first);
    registerCalculatorTarget(second);

    injectCalculatedValue(500);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(500);
  });

  it("retorna false e não lança sem campo ativo", () => {
    expect(injectCalculatedValue(100)).toBe(false);
  });

  it("unregister do campo desmontado remove apenas ele e restaura o anterior (LIFO)", () => {
    const first = vi.fn();
    const second = vi.fn();
    registerCalculatorTarget(first);
    registerCalculatorTarget(second);

    // Desmonta o segundo (topo) -> restaura o primeiro automaticamente.
    unregisterCalculatorTarget(second);
    expect(getCalculatorTarget()).toBe(first);

    // Re-registra o segundo e remove o primeiro (base) -> segundo segue no topo.
    registerCalculatorTarget(second);
    unregisterCalculatorTarget(first);
    expect(getCalculatorTarget()).toBe(second);

    unregisterCalculatorTarget(second);
    expect(getCalculatorTarget()).toBeNull();
  });

  it("permite promover campo anterior para o topo sem duplicar entrada na pilha", () => {
    const primary = vi.fn();
    const secondary = vi.fn();
    registerCalculatorTarget(primary);
    registerCalculatorTarget(secondary);

    // Usuário foca o campo principal novamente.
    registerCalculatorTarget(primary);
    expect(getCalculatorTarget()).toBe(primary);

    // Quando o principal desmonta, o secundário volta sem duplicatas.
    unregisterCalculatorTarget(primary);
    expect(getCalculatorTarget()).toBe(secondary);

    unregisterCalculatorTarget(secondary);
    expect(getCalculatorTarget()).toBeNull();
  });

  it("suporta alvo como objeto com getCents e inject", () => {
    const inject = vi.fn();
    const getCents = vi.fn(() => 4560);
    const target = { inject, getCents, label: "Valor Principal" };

    registerCalculatorTarget(target);

    expect(hasActiveTarget()).toBe(true);
    expect(getActiveTargetCents()).toBe(4560);
    expect(getActiveTargetLabel()).toBe("Valor Principal");

    expect(injectCalculatedValue(9999)).toBe(true);
    expect(inject).toHaveBeenCalledWith(9999);

    unregisterCalculatorTarget(target);
    expect(hasActiveTarget()).toBe(false);
    expect(getActiveTargetCents()).toBeNull();
    expect(getActiveTargetLabel()).toBeUndefined();
  });

  it("suporta alvo decimal com getDecimalDisplay e injectDecimal", () => {
    const injectDecimal = vi.fn();
    const getDecimalDisplay = vi.fn(() => "270.5");
    const decimalTarget = {
      mode: "decimal" as const,
      injectDecimal,
      getDecimalDisplay,
      label: "Quantidade de Cotas",
    };

    registerCalculatorTarget(decimalTarget);

    expect(hasActiveTarget()).toBe(true);
    expect(getActiveTargetCents()).toBeNull();
    expect(getActiveDecimalDisplay()).toBe("270.5");
    expect(getActiveTargetLabel()).toBe("Quantidade de Cotas");

    // injectCalculatedValue deve retornar false para target decimal
    expect(injectCalculatedValue(1000)).toBe(false);
    expect(injectDecimal).not.toHaveBeenCalled();

    // injectDecimalValue deve funcionar
    expect(injectDecimalValue("350")).toBe(true);
    expect(injectDecimal).toHaveBeenCalledWith("350");

    unregisterCalculatorTarget(decimalTarget);
    expect(hasActiveTarget()).toBe(false);
    expect(getActiveDecimalDisplay()).toBeNull();
  });

  it("notifica ouvintes quando o alvo é registrado ou desregistrado", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCalculatorTarget(listener);

    const setter = vi.fn();
    registerCalculatorTarget(setter);
    expect(listener).toHaveBeenCalledTimes(1);

    unregisterCalculatorTarget(setter);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    registerCalculatorTarget(setter);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
