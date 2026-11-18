/**
 * Injeção Contextual da Calculadora (F9 — Decisão C): "Usar Valor".
 *
 * Ponte bidirecional entre inputs do app e a calculadora flutuante com pilha
 * LIFO de alvos: o campo focado/montado mais recentemente assume o topo, e ao
 * desmontar um campo ou sub-modal secundário o alvo anterior é restaurado.
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

let targetStack: CalculatorTarget[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function getActiveTarget(): CalculatorTarget | null {
  return targetStack.length > 0 ? targetStack[targetStack.length - 1]! : null;
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

/** Registra ou promove o campo ao topo da pilha LIFO de alvos da calculadora. */
export function registerCalculatorTarget(target: CalculatorTarget): void {
  if (getActiveTarget() === target) return;
  targetStack = targetStack.filter((item) => item !== target);
  targetStack.push(target);
  notify();
}

/** Remove o alvo da pilha LIFO (restaurando o anterior caso fosse o topo). */
export function unregisterCalculatorTarget(target: CalculatorTarget): void {
  const previousLength = targetStack.length;
  if (previousLength === 0) return;
  targetStack = targetStack.filter((item) => item !== target);
  if (targetStack.length !== previousLength) {
    notify();
  }
}

/** Limpa toda a pilha de alvos (uso exclusivo de isolamento em testes). */
export function clearCalculatorTargets(): void {
  if (targetStack.length === 0) return;
  targetStack = [];
  notify();
}

/** Campo atualmente ativo no topo da pilha (para testes/inspeção). */
export function getCalculatorTarget(): CalculatorTarget | null {
  return getActiveTarget();
}

/** Retorna se há um campo registrado atualmente como alvo ativo. */
export function hasActiveTarget(): boolean {
  return getActiveTarget() !== null;
}

/** Modo do alvo ativo: "money" | "decimal" | null. */
export function getActiveTargetMode(): "money" | "decimal" | null {
  const active = getActiveTarget();
  if (!active) return null;
  if (isDecimalTarget(active)) return "decimal";
  return "money";
}

/**
 * Lê o valor atual em centavos do campo ativo (modo "money").
 * Retorna `null` para alvos decimais ou quando não há alvo.
 */
export function getActiveTargetCents(): number | null {
  const active = getActiveTarget();
  if (!active) return null;
  if (isTargetObject(active)) return active.getCents();
  return null;
}

/**
 * Lê o valor decimal do campo ativo (modo "decimal").
 * Retorna `null` para alvos money ou quando não há alvo.
 */
export function getActiveDecimalDisplay(): string | null {
  const active = getActiveTarget();
  if (!active) return null;
  if (isDecimalTarget(active)) return active.getDecimalDisplay();
  return null;
}

/** Rótulo contextual do campo ativo, se fornecido. */
export function getActiveTargetLabel(): string | undefined {
  const active = getActiveTarget();
  if (!active) return undefined;
  if (isTargetObject(active)) return active.label;
  if (isDecimalTarget(active)) return active.label;
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
  const active = getActiveTarget();
  if (!active) return false;
  if (isDecimalTarget(active)) return false;
  if (isTargetObject(active)) {
    active.inject(cents);
  } else {
    active(cents);
  }
  return true;
}

/**
 * Injeta o display decimal (string) no campo decimal ativo. Retorna `false`
 * quando nenhum campo está registrado ou o alvo é money.
 */
export function injectDecimalValue(display: string): boolean {
  const active = getActiveTarget();
  if (!active) return false;
  if (!isDecimalTarget(active)) return false;
  active.injectDecimal(display);
  return true;
}
