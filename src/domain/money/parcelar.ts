/**
 * Parcelamento — ESPECIFICAÇÃO §3.2.2 (D12).
 *
 * A divisão é EXATA em centavos: o resto de `total ÷ N` é distribuído nas
 * PRIMEIRAS parcelas (R$ 100 ÷ 3 → 33,34 / 33,33 / 33,33). A soma é sempre
 * idêntica ao original. O cliente calcula; o servidor valida invariantes.
 *
 * Motor puro: sem imports de UI/Supabase — testável isoladamente.
 */

import { MAX_INSTALLMENTS } from "@/types/schema";

export interface Parcela {
  /** Valor da parcela em centavos. */
  valueCents: number;
  /** Data da parcela (ISO YYYY-MM-DD, timezone local). */
  date: string;
  /** Número da parcela (1-based). */
  number: number;
  /** Total de parcelas. */
  total: number;
}

/** Divide o total em `count` partes exatas em centavos (resto nas primeiras). */
export function splitCents(totalCents: number, count: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error("Total deve ser um inteiro não-negativo (centavos).");
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) {
    throw new Error(`Parcelas devem estar entre 1 e ${MAX_INSTALLMENTS}.`);
  }
  const base = Math.floor(totalCents / count);
  const resto = totalCents % count;
  return Array.from({ length: count }, (_, index) => base + (index < resto ? 1 : 0));
}

/** Soma dos valores — deve ser idêntica ao total original (invariante). */
export function somaCents(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

/** Soma `months` ao mês, ajustando o dia ao último dia do mês destino (clamp). */
export function addMonthsClamped(date: Date, months: number): Date {
  const targetYear = date.getFullYear() + Math.floor((date.getMonth() + months) / 12);
  const targetMonth = ((date.getMonth() + months) % 12 + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return new Date(targetYear, targetMonth, Math.min(date.getDate(), lastDay));
}

/** ISO local (YYYY-MM-DD) — evita deslocamento de timezone do toISOString. */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Gera o plano de parcelas a partir da data inicial: uma parcela por mês,
 * com `installment_number` 1-based e divisão exata em centavos.
 */
export function parcelar(totalCents: number, count: number, startDate: Date): Parcela[] {
  const values = splitCents(totalCents, count);
  return values.map((valueCents, index) => ({
    valueCents,
    date: toISODate(addMonthsClamped(startDate, index)),
    number: index + 1,
    total: count,
  }));
}
