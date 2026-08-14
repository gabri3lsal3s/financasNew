/**
 * Calculadora flutuante — FASE 9 (Decisões B/C).
 *
 * Motor puro e testável: operações aritméticas em CENTAVOS (inteiros — sem
 * erro de ponto flutuante), entrada decimal como string (controle de digitação),
 * divisão de parcelas EXATA (reusa `splitCents` de domain/money — DRY) e
 * histórico limitado. Nenhum import de UI/Supabase.
 */

import { splitCents } from "@/domain/money/parcelar";

export type CalcOperator = "+" | "−" | "×" | "÷";

export interface CalculatorState {
  /** Display decimal (ex.: "12.5") — string para controle da digitação. */
  display: string;
  /** Acumulador em centavos (operando anterior) — null antes do 1º operador. */
  accumulator: number | null;
  operator: CalcOperator | null;
  /** True logo após "=" — o próximo dígito recomeça a entrada. */
  justEvaluated: boolean;
  /**
   * True quando o display ainda é o operando anterior (após operador ou
   * avaliação encadeada) — o próximo dígito SUBSTITUI o display.
   */
  entering: boolean;
  /** Divisão por zero — qualquer tecla recomeça. */
  error: boolean;
}

export const INITIAL_STATE: CalculatorState = {
  display: "0",
  accumulator: null,
  operator: null,
  justEvaluated: false,
  entering: false,
  error: false,
};

const MAX_DIGITS = 12;

/** Converte um decimal em string para centavos (inteiro). */
export function decimalToCents(decimal: string): number {
  return Math.round(Number.parseFloat(decimal || "0") * 100);
}

/** Converte centavos (inteiro) para decimal em string (ex.: 250 → "2.5"). */
export function centsToDecimal(cents: number): string {
  return String(cents / 100);
}

/** Operação binária em centavos. `null` = divisão por zero. */
export function computeCents(a: number, operator: CalcOperator, b: number): number | null {
  switch (operator) {
    case "+":
      return a + b;
    case "−":
      return a - b;
    case "×":
      return Math.round((a * b) / 100);
    case "÷":
      if (b === 0) return null;
      return Math.round((a / b) * 100);
  }
}

/** Digita um dígito ou a vírgula decimal. */
export function pressDigit(state: CalculatorState, digit: string): CalculatorState {
  if (state.error) return { ...INITIAL_STATE, display: digit === "." ? "0." : digit };
  if (state.entering || state.justEvaluated) {
    // Novo operando — preserva a operação pendente (acumulador/operador).
    return {
      ...INITIAL_STATE,
      accumulator: state.accumulator,
      operator: state.operator,
      display: digit === "." ? "0." : digit,
    };
  }
  let next = state.display;
  if (digit === ".") {
    next = next.includes(".") ? next : `${next}.`;
  } else {
    const digits = next.replace(/[^0-9]/g, "");
    if (digits.length >= MAX_DIGITS) return state;
    next = next === "0" ? digit : `${next}${digit}`;
  }
  return { ...state, display: next };
}

/** Apaga o último caractere (volta a "0" quando vazio). */
export function pressBackspace(state: CalculatorState): CalculatorState {
  if (state.error || state.justEvaluated) return INITIAL_STATE;
  if (state.entering) return { ...state, display: "0", entering: false };
  const next = state.display.length > 1 ? state.display.slice(0, -1) : "0";
  return { ...state, display: next };
}

/**
 * Define um operador. Encadeamentos avaliam da esquerda para a direita;
 * operador repetido sem operando novo apenas troca a operação.
 */
export function pressOperator(state: CalculatorState, operator: CalcOperator): CalculatorState {
  if (state.error) return state;
  if (state.justEvaluated) {
    return {
      accumulator: decimalToCents(state.display),
      operator,
      display: state.display,
      justEvaluated: false,
      entering: true,
      error: false,
    };
  }
  if (state.operator !== null && state.accumulator !== null) {
    if (state.entering) {
      // Operador trocado sem operando novo (ex.: 2 + ×).
      return { ...state, operator };
    }
    const current = decimalToCents(state.display);
    const result = computeCents(state.accumulator, state.operator, current);
    if (result === null) return { ...INITIAL_STATE, error: true };
    return {
      accumulator: result,
      operator,
      display: centsToDecimal(result),
      justEvaluated: false,
      entering: true,
      error: false,
    };
  }
  // Primeiro operador.
  return {
    accumulator: decimalToCents(state.display),
    operator,
    display: state.display,
    justEvaluated: false,
    entering: true,
    error: false,
  };
}

/** Avalia a expressão pendente. `error` em divisão por zero. */
export function pressEquals(state: CalculatorState): CalculatorState {
  if (state.error || state.operator === null || state.accumulator === null) return state;
  const current = decimalToCents(state.display);
  const result = computeCents(state.accumulator, state.operator, current);
  if (result === null) return { ...INITIAL_STATE, error: true };
  return {
    display: centsToDecimal(result),
    accumulator: result,
    operator: null,
    justEvaluated: true,
    entering: false,
    error: false,
  };
}

/**
 * Divisão de parcelas exatas em centavos (resto nas primeiras) — delega para
 * `domain/money/parcelar` (mesma invariante: soma = total, 1–60 parcelas).
 */
export function splitInstallments(cents: number, count: number): number[] {
  return splitCents(cents, count);
}

export interface HistoryEntry {
  /** Expressão textual (ex.: "100 ÷ 3 ="). */
  expression: string;
  resultCents: number;
}

const MAX_HISTORY = 5;

/** Adiciona um resultado ao histórico (mais recente primeiro, limitado). */
export function addHistory(history: readonly HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...history].slice(0, MAX_HISTORY);
}
