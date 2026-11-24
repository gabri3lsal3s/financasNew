/**
 * Motor puro de conversão cambial e detecção de moeda estrangeira em recibos de viagem (Fase 4).
 *
 * Toda conversão utiliza aritmética inteira com escala de 4 casas decimais (10.000x)
 * sobre centavos inteiros, sem floats intermediários acumulados e sem imports de UI/Supabase.
 */

export const TRIP_FOREIGN_CURRENCIES = ["USD", "EUR", "GBP", "ARS", "CLP", "UYU"] as const;
export type TripForeignCurrencyCode = (typeof TRIP_FOREIGN_CURRENCIES)[number];
export type TripCurrencyCode = "BRL" | TripForeignCurrencyCode;

export const TRIP_CURRENCY_LABELS: Record<TripCurrencyCode, string> = {
  BRL: "Real (R$)",
  USD: "Dólar (USD)",
  EUR: "Euro (EUR)",
  GBP: "Libra (GBP)",
  ARS: "Peso Argentino (ARS)",
  CLP: "Peso Chileno (CLP)",
  UYU: "Peso Uruguaio (UYU)",
};

const FOREIGN_CURRENCY_SET = new Set<string>(TRIP_FOREIGN_CURRENCIES);

/**
 * Normaliza código ISO-4217 para moeda de viagem suportada, ou null se não suportado.
 */
export function normalizeTripCurrencyCode(raw?: string | null): TripCurrencyCode | null {
  if (!raw || typeof raw !== "string") return null;
  const upper = raw.trim().toUpperCase();
  if (upper === "BRL") return "BRL";
  if (FOREIGN_CURRENCY_SET.has(upper)) return upper as TripForeignCurrencyCode;
  return null;
}

/**
 * Detecta moeda estrangeira explícita em texto de comprovante ou descrição,
 * sem confundir cifrão brasileiro (`R$`) com dólar ou peso.
 */
export function detectForeignCurrencyFromText(
  text?: string | null,
): TripForeignCurrencyCode | null {
  if (!text || typeof text !== "string") return null;

  if (/\bEUR\b|€/i.test(text)) return "EUR";
  if (/\bGBP\b|£/i.test(text)) return "GBP";
  if (/\bARS\b|\bPESOS?\s+ARGENTIN/i.test(text)) return "ARS";
  if (/\bCLP\b|\bPESOS?\s+CHILEN/i.test(text)) return "CLP";
  if (/\bUYU\b|\$U\b|\bPESOS?\s+URUGUAI/i.test(text)) return "UYU";
  if (/\bUSD\b|\bUS\s*\$|\bU\$[DS]\b/i.test(text)) return "USD";

  // Símbolo `$` isolado seguido de dígito somente quando não houver `R$` brasileiro no documento
  if (!/\bR\$\s*\d/i.test(text) && /(?:^|[\s(])\$\s*\d+(?:[.,]\d{2})?\b/.test(text)) {
    return "USD";
  }

  return null;
}

/**
 * Converte centavos na moeda estrangeira para centavos em BRL usando escala inteira de 4 casas.
 */
export function convertForeignCentsToBrlCents(
  foreignCents: number,
  exchangeRateBrl: number,
): number {
  if (
    !Number.isFinite(foreignCents) ||
    !Number.isFinite(exchangeRateBrl) ||
    foreignCents <= 0 ||
    exchangeRateBrl <= 0
  ) {
    return 0;
  }

  const rateScaled = Math.round(exchangeRateBrl * 10_000);
  if (rateScaled <= 0) return 0;

  return Math.max(1, Math.round((Math.round(foreignCents) * rateScaled) / 10_000));
}

/**
 * Formata um valor em centavos da moeda estrangeira para exibição calma na UI (sem emojis).
 */
export function formatForeignCurrencyAmount(
  cents: number,
  currency: TripCurrencyCode,
): string {
  const safeCents = Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0;
  try {
    return (safeCents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency,
    });
  } catch {
    return `${currency} ${(safeCents / 100).toFixed(2).replace(".", ",")}`;
  }
}
