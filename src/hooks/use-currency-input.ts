import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import {
  CURRENCY_INPUT_MAX_DIGITS,
  centsFromDigits,
  digitsFromCents,
  extractDigits,
} from "@/domain/money";
import { formatCentsAsBRL } from "@/services/masks";

export interface UseCurrencyInputOptions {
  /** Valor inicial em centavos (default 0). */
  initialCents?: number;
  /** Limite de dígitos (default CURRENCY_INPUT_MAX_DIGITS = 12). */
  maxDigits?: number;
}

export interface UseCurrencyInputReturn {
  /** String de dígitos crus (ex.: "1500" = R$ 15,00). */
  digits: string;
  /** Valor em centavos (inteiro). */
  valueCents: number;
  /** Valor em reais (number). */
  value: number;
  /** Texto formatado para exibição (ex.: "R$ 15,00") — nunca vazio. */
  display: string;
  /** True quando não há dígitos digitados. */
  isEmpty: boolean;
  /** Handler para <input onChange> — retorna os novos centavos (uso síncrono). */
  handleChange: (event: ChangeEvent<HTMLInputElement>) => number;
  /** Bloqueia teclas imprimíveis não numéricas no desktop (digitação só números). */
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** Define o valor programaticamente a partir de centavos (reset/controle). */
  setCents: (cents: number) => void;
  /** Limpa o valor (volta para R$ 0,00). */
  clear: () => void;
}

export function useCurrencyInput(options: UseCurrencyInputOptions = {}): UseCurrencyInputReturn {
  const { initialCents = 0, maxDigits = CURRENCY_INPUT_MAX_DIGITS } = options;

  const [digits, setDigits] = useState<string>(() => digitsFromCents(initialCents, maxDigits));

  const valueCents = useMemo(() => centsFromDigits(digits), [digits]);
  const display = useMemo(() => formatCentsAsBRL(valueCents), [valueCents]);
  const isEmpty = digits.length === 0;

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = extractDigits(event.target.value).slice(0, maxDigits);
      setDigits(next);
      return centsFromDigits(next);
    },
    [maxDigits],
  );

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    // Permite atalhos (Ctrl/Cmd/Alt) e teclas de controle (Backspace, setas, Tab…).
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1) return;
    // Bloqueia qualquer caractere imprimível que não seja dígito.
    if (!/\d/.test(event.key)) event.preventDefault();
  }, []);

  const setCents = useCallback(
    (cents: number) => setDigits(digitsFromCents(cents, maxDigits)),
    [maxDigits],
  );

  const clear = useCallback(() => setDigits(""), []);

  return {
    digits,
    valueCents,
    value: valueCents / 100,
    display,
    isEmpty,
    handleChange,
    handleKeyDown,
    setCents,
    clear,
  };
}
