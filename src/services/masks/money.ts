import type { AssetCurrency } from "@/types";

/**
 * Formatação monetária pt-BR / USD — camada de apresentação.
 * Recebe CENTAVOS (inteiro) e devolve a string exibível ("R$ 1.500,00" ou "$ 1,500.00").
 * Usada pelo MoneyInput e por todas as telas de valores (DRY).
 * Sem importar o domínio financeiro: conversão local e formatação via Intl.
 */
const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const brlNoCentsFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const usdFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdNoCentsFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export interface FormatCurrencyOptions {
  /** Se true, oculta os centavos da formatação (ex: "R$ 1.250"). */
  hideCents?: boolean;
  /** Se true, permite a formatação com sinal de valores negativos (ex: "-R$ 975,00" ou "-US$ 10,00"). */
  allowNegative?: boolean;
}

/** Formata centavos na moeda especificada (BRL por padrão). */
export function formatCentsAsCurrency(
  cents: number,
  currency: AssetCurrency = "BRL",
  options?: FormatCurrencyOptions,
): string {
  const allowNegative = options?.allowNegative ?? false;
  const safe = Number.isFinite(cents)
    ? allowNegative
      ? Math.round(cents)
      : cents >= 0
      ? Math.round(cents)
      : 0
    : 0;
  const hideCents = options?.hideCents ?? false;

  if (currency === "USD") {
    return hideCents ? usdNoCentsFormatter.format(safe / 100) : usdFormatter.format(safe / 100);
  }

  return hideCents ? brlNoCentsFormatter.format(safe / 100) : brlFormatter.format(safe / 100);
}

/** 150000 -> "R$ 1.500,00" · 1 -> "R$ 0,01" · valores inválidos -> "R$ 0,00" */
export function formatCentsAsBRL(cents: number, options?: FormatCurrencyOptions): string {
  return formatCentsAsCurrency(cents, "BRL", options);
}

const fxRateFormatter4 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

/** Formata taxa de câmbio USD/BRL em pt-BR (ex: 5.25 -> "5,2500"). */
export function formatFxRate(rate: number, decimals = 4): string {
  const safeDecimals = Number.isInteger(decimals) && decimals >= 0 && decimals <= 6 ? decimals : 4;
  if (!Number.isFinite(rate) || rate <= 0) {
    return safeDecimals === 4
      ? "0,0000"
      : new Intl.NumberFormat("pt-BR", {
          minimumFractionDigits: safeDecimals,
          maximumFractionDigits: safeDecimals,
        }).format(0);
  }
  if (safeDecimals === 4) {
    return fxRateFormatter4.format(rate);
  }
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: safeDecimals,
    maximumFractionDigits: safeDecimals,
  }).format(rate);
}
