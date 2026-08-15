/**
 * Estado de abertura da calculadora.
 *
 * Store externo mínimo (subscribe/getSnapshot) para que o botão do header
 * (`CalculatorButton`) e os botões nos cabeçalhos de modais abram o MESMO painel — o
 * `FloatingCalculator` consome via `useSyncExternalStore`.
 */

let isOpen = false;
const listeners = new Set<() => void>();

export function isCalculatorOpen(): boolean {
  return isOpen;
}

export function setCalculatorOpen(next: boolean): void {
  if (isOpen === next) return;
  isOpen = next;
  for (const listener of listeners) listener();
}

export function subscribeCalculatorOpen(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
