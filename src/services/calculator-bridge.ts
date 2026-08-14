/**
 * Injeção Contextual da Calculadora (F9 — Decisão C): "Usar Valor".
 *
 * Emissor leve: o `MoneyInput` se registra ao receber foco (o campo "ativo" do
 * formulário) e a calculadora despacha o valor em CENTAVOS com 1 toque. O
 * alvo permanece o último campo focado — funciona mesmo quando o foco foi
 * para o botão da calculadora.
 */

type CalculatorTarget = (cents: number) => void;

let activeTarget: CalculatorTarget | null = null;

/** Registra o campo ativo (chamado no focus do MoneyInput). */
export function registerCalculatorTarget(target: CalculatorTarget): void {
  activeTarget = target;
}

/** Remove o registro quando o campo desmonta (apenas se ainda é o ativo). */
export function unregisterCalculatorTarget(target: CalculatorTarget): void {
  if (activeTarget === target) activeTarget = null;
}

/** Campo atualmente ativo (para testes/inspeção). */
export function getCalculatorTarget(): CalculatorTarget | null {
  return activeTarget;
}

/**
 * Injeta o valor calculado (centavos) no campo ativo. Retorna `false` quando
 * nenhum campo está registrado (ex.: sem MoneyInput focado na tela).
 */
export function injectCalculatedValue(cents: number): boolean {
  if (!activeTarget) return false;
  activeTarget(cents);
  return true;
}
