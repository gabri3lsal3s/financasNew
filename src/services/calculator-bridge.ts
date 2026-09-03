/**
 * Injeção Contextual da Calculadora (F9 — Decisão C): "Usar Valor".
 *
 * Emissor leve: o `MoneyInput` se registra ao receber foco (o campo "ativo" do
 * formulário) e a calculadora despacha o valor em CENTAVOS com 1 toque. O
 * alvo permanece o último campo focado — funciona mesmo quando o foco foi
 * para o botão da calculadora.
 */

export interface CalculatorTargetObject {
  inject: (cents: number) => void;
  getCents: () => number;
  label?: string;
}

export type CalculatorTargetCallback = (cents: number) => void;

export type CalculatorTarget = CalculatorTargetObject | CalculatorTargetCallback;

let activeTarget: CalculatorTarget | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function isTargetObject(target: CalculatorTarget): target is CalculatorTargetObject {
  return typeof target === "object" && target !== null && "inject" in target;
}

/** Registra o campo ativo (chamado no focus do MoneyInput). */
export function registerCalculatorTarget(target: CalculatorTarget): void {
  activeTarget = target;
  notify();
}

/** Remove o registro quando o campo desmonta (apenas se ainda é o ativo). */
export function unregisterCalculatorTarget(target: CalculatorTarget): void {
  if (activeTarget === target) {
    activeTarget = null;
    notify();
  }
}

/** Campo atualmente ativo (para testes/inspeção). */
export function getCalculatorTarget(): CalculatorTarget | null {
  return activeTarget;
}

/** Retorna se há um campo registrado atualmente como alvo ativo. */
export function hasActiveTarget(): boolean {
  return activeTarget !== null;
}

/**
 * Lê o valor atual em centavos do campo ativo. Retorna `null` se nenhum
 * campo estiver registrado ou se o campo for um callback legado sem getter.
 */
export function getActiveTargetCents(): number | null {
  if (!activeTarget) return null;
  if (isTargetObject(activeTarget)) {
    return activeTarget.getCents();
  }
  return null;
}

/** Rótulo contextual do campo ativo, se fornecido. */
export function getActiveTargetLabel(): string | undefined {
  if (activeTarget && isTargetObject(activeTarget)) {
    return activeTarget.label;
  }
  return undefined;
}

/** Assinatura para a UI reagir a mudanças de alvo registrado. */
export function subscribeCalculatorTarget(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Injeta o valor calculado (centavos) no campo ativo. Retorna `false` quando
 * nenhum campo está registrado (ex.: sem MoneyInput focado na tela).
 */
export function injectCalculatedValue(cents: number): boolean {
  if (!activeTarget) return false;
  if (isTargetObject(activeTarget)) {
    activeTarget.inject(cents);
  } else {
    activeTarget(cents);
  }
  return true;
}
