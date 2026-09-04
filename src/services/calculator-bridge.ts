/**
 * Injeção Contextual da Calculadora (F9 — Decisão C): "Usar Valor".
 *
 * Ponte bidirecional entre inputs do app e a calculadora flutuante.
 * Suporta dois modos:
 *  - "money": MoneyInput (centavos inteiros). A calculadora exibe em R$/$.
 *  - "decimal": campos numéricos livres (quantidade de cotas, taxa, saldo).
 *    A calculadora exibe como número formatado e injeta state.display diretamente.
 */

export interface CalculatorTargetObject {
  inject: (cents: number) => void;
  getCents: () => number;
  label?: string;
}

export interface CalculatorDecimalTarget {
  /** Discriminador de modo: campos de quantidade / decimal livre. */
  mode: "decimal";
  injectDecimal: (display: string) => void;
  getDecimalDisplay: () => string;
  label?: string;
}

export type CalculatorTargetCallback = (cents: number) => void;

export type CalculatorTarget =
  | CalculatorTargetObject
  | CalculatorDecimalTarget
  | CalculatorTargetCallback;

let activeTarget: CalculatorTarget | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function isTargetObject(target: CalculatorTarget): target is CalculatorTargetObject {
  return typeof target === "object" && target !== null && "inject" in target;
}

function isDecimalTarget(target: CalculatorTarget): target is CalculatorDecimalTarget {
  return (
    typeof target === "object" &&
    target !== null &&
    (target as CalculatorDecimalTarget).mode === "decimal"
  );
}

/** Registra o campo ativo (chamado no focus do MoneyInput/NumericInput). */
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

/** Modo do alvo ativo: "money" | "decimal" | null. */
export function getActiveTargetMode(): "money" | "decimal" | null {
  if (!activeTarget) return null;
  if (isDecimalTarget(activeTarget)) return "decimal";
  return "money";
}

/**
 * Lê o valor atual em centavos do campo ativo (modo "money").
 * Retorna `null` para alvos decimais ou quando não há alvo.
 */
export function getActiveTargetCents(): number | null {
  if (!activeTarget) return null;
  if (isTargetObject(activeTarget)) return activeTarget.getCents();
  return null;
}

/**
 * Lê o valor decimal do campo ativo (modo "decimal").
 * Retorna `null` para alvos money ou quando não há alvo.
 */
export function getActiveDecimalDisplay(): string | null {
  if (!activeTarget) return null;
  if (isDecimalTarget(activeTarget)) return activeTarget.getDecimalDisplay();
  return null;
}

/** Rótulo contextual do campo ativo, se fornecido. */
export function getActiveTargetLabel(): string | undefined {
  if (!activeTarget) return undefined;
  if (isTargetObject(activeTarget)) return activeTarget.label;
  if (isDecimalTarget(activeTarget)) return activeTarget.label;
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
 * Injeta o valor calculado (centavos) no campo money ativo. Retorna `false`
 * quando nenhum campo está registrado ou o alvo é decimal.
 */
export function injectCalculatedValue(cents: number): boolean {
  if (!activeTarget) return false;
  if (isDecimalTarget(activeTarget)) return false;
  if (isTargetObject(activeTarget)) {
    activeTarget.inject(cents);
  } else {
    activeTarget(cents);
  }
  return true;
}

/**
 * Injeta o display decimal (string) no campo decimal ativo. Retorna `false`
 * quando nenhum campo está registrado ou o alvo é money.
 */
export function injectDecimalValue(display: string): boolean {
  if (!activeTarget) return false;
  if (!isDecimalTarget(activeTarget)) return false;
  activeTarget.injectDecimal(display);
  return true;
}
