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

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formata centavos na moeda especificada (BRL por padrão). */
export function formatCentsAsCurrency(cents: number, currency: AssetCurrency = "BRL"): string {
  const safe = Number.isFinite(cents) && cents >= 0 ? Math.round(cents) : 0;
  return currency === "USD" ? usdFormatter.format(safe / 100) : brlFormatter.format(safe / 100);
}

/** 150000 -> "R$ 1.500,00" · 1 -> "R$ 0,01" · valores inválidos -> "R$ 0,00" */
export function formatCentsAsBRL(cents: number): string {
  return formatCentsAsCurrency(cents, "BRL");
}

