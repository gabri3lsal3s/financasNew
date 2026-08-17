/**
 * Motor puro de cálculo e agregação de despesas por natureza/encargo (charge_kind).
 *
 * ESPECIFICAÇÃO §3 e Módulo de Natureza da Despesa.
 * Fornece métricas de Dinheiro Queimado (Juros e Multas) vs Tributos vs Tarifas.
 */

import type { ChargeKind } from "@/types";

export interface ChargesBreakdownItemInput {
  value: number;
  report_weight: number;
  charge_kind?: ChargeKind | null;
}

export interface ChargesBreakdown {
  wastedGrossCents: number; // Juros + Multas (Bruto)
  wastedWeightedCents: number; // Juros + Multas (Ponderado)

  interestGrossCents: number;
  interestWeightedCents: number;

  fineGrossCents: number;
  fineWeightedCents: number;

  taxGrossCents: number; // Impostos e Tributos
  taxWeightedCents: number;

  feeGrossCents: number; // Taxas e Tarifas Bancárias
  feeWeightedCents: number;

  regularGrossCents: number; // Consumo regular
  regularWeightedCents: number;

  totalChargesGrossCents: number; // Juros + Multas + Impostos + Taxas
  totalChargesWeightedCents: number;
}

export const CHARGE_KIND_LABELS: Record<ChargeKind, string> = {
  regular: "Despesa comum",
  interest: "Juros e encargos",
  fine: "Multa por atraso",
  tax: "Imposto / Tributo",
  bank_fee: "Taxa / Tarifa bancária",
};

/**
 * Agrega e calcula os totais de despesas discriminados por tipo de encargo.
 */
export function calculateChargesBreakdown(
  expenses: readonly ChargesBreakdownItemInput[]
): ChargesBreakdown {
  let interestGross = 0;
  let interestWeighted = 0;
  let fineGross = 0;
  let fineWeighted = 0;
  let taxGross = 0;
  let taxWeighted = 0;
  let feeGross = 0;
  let feeWeighted = 0;
  let regularGross = 0;
  let regularWeighted = 0;

  for (const exp of expenses) {
    const gross = Math.round(exp.value * 100);
    const weighted = Math.round(exp.value * exp.report_weight * 100);
    const kind = exp.charge_kind ?? "regular";

    switch (kind) {
      case "interest":
        interestGross += gross;
        interestWeighted += weighted;
        break;
      case "fine":
        fineGross += gross;
        fineWeighted += weighted;
        break;
      case "tax":
        taxGross += gross;
        taxWeighted += weighted;
        break;
      case "bank_fee":
        feeGross += gross;
        feeWeighted += weighted;
        break;
      case "regular":
      default:
        regularGross += gross;
        regularWeighted += weighted;
        break;
    }
  }

  const wastedGrossCents = interestGross + fineGross;
  const wastedWeightedCents = interestWeighted + fineWeighted;
  const totalChargesGrossCents = wastedGrossCents + taxGross + feeGross;
  const totalChargesWeightedCents = wastedWeightedCents + taxWeighted + feeWeighted;

  return {
    wastedGrossCents,
    wastedWeightedCents,
    interestGrossCents: interestGross,
    interestWeightedCents: interestWeighted,
    fineGrossCents: fineGross,
    fineWeightedCents: fineWeighted,
    taxGrossCents: taxGross,
    taxWeightedCents: taxWeighted,
    feeGrossCents: feeGross,
    feeWeightedCents: feeWeighted,
    regularGrossCents: regularGross,
    regularWeightedCents: regularWeighted,
    totalChargesGrossCents,
    totalChargesWeightedCents,
  };
}
