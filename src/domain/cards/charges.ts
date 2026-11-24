/**
 * Encargos de fatura de cartão de crédito — Blueprint v2.1 (Fase 1).
 *
 * Motor puro de cálculo e classificação de encargos (`charge_kind`):
 * - Sumarização de consumo vs. juros, multa, IOF e tarifas em centavos inteiros.
 * - Inferência determinística de `charge_kind` a partir da descrição da transação
 *   para reconciliação bancária, importador de extrato (OFX/PDF/CSV) e notificações.
 */

import { numberToCents } from "@/domain/money/parse";
import type { ChargeKind, Expense } from "@/types";

export interface InvoiceChargesSummary {
  consumptionCents: number;
  interestCents: number;
  fineCents: number;
  taxCents: number;
  bankFeeCents: number;
  totalChargesCents: number;
  totalInvoiceCents: number;
  chargesPercentage: number;
  hasCharges: boolean;
}

export type ExpenseChargeInput = {
  value: number;
  charge_kind?: ChargeKind | null;
  report_weight?: number;
};

/**
 * Sumariza os encargos de uma lista de despesas de fatura em centavos inteiros.
 * Proteção total contra divisão por zero (retorna 0% se `totalInvoiceCents === 0`).
 */
export function summarizeInvoiceCharges(
  expenses: readonly (Pick<Expense, "value" | "charge_kind"> | ExpenseChargeInput)[],
): InvoiceChargesSummary {
  let consumptionCents = 0;
  let interestCents = 0;
  let fineCents = 0;
  let taxCents = 0;
  let bankFeeCents = 0;

  for (const exp of expenses) {
    const cents = numberToCents(exp.value);
    const kind = exp.charge_kind ?? "regular";

    switch (kind) {
      case "interest":
        interestCents += cents;
        break;
      case "fine":
        fineCents += cents;
        break;
      case "tax":
        taxCents += cents;
        break;
      case "bank_fee":
        bankFeeCents += cents;
        break;
      case "regular":
      default:
        consumptionCents += cents;
        break;
    }
  }

  const totalChargesCents = interestCents + fineCents + taxCents + bankFeeCents;
  const totalInvoiceCents = consumptionCents + totalChargesCents;
  const chargesPercentage = totalInvoiceCents > 0
    ? (totalChargesCents / totalInvoiceCents) * 100
    : 0;

  return {
    consumptionCents,
    interestCents,
    fineCents,
    taxCents,
    bankFeeCents,
    totalChargesCents,
    totalInvoiceCents,
    chargesPercentage,
    hasCharges: totalChargesCents > 0,
  };
}

/**
 * Normaliza uma descrição removendo acentos e convertendo para minúsculas.
 */
function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Infere determinísticamente o `charge_kind` com base no texto da transação.
 * Usado pelo importador de extrato, reconciliador e notificações bancárias.
 */
export function inferChargeKindFromDescription(description: string | null | undefined): ChargeKind {
  if (!description) return "regular";

  const norm = normalizeText(description);

  // 1. IOF e tributos (deve ter precedência sobre rotativo, ex: "IOF DIARIO ROTATIVO")
  if (
    /\b(iof|imposto|tributo|tributos)\b/i.test(norm) ||
    /iof\s*(diario|adicional|compra|fatura)/i.test(norm)
  ) {
    return "tax";
  }

  // 2. Juros de rotativo / mora / refinanciamento
  if (
    /\b(juros|rotativo|refinanciamento|moratorio|moratorios|remuneratorio|remuneratorios)\b/i.test(norm) ||
    /juros\s*(de\s*)?(mora|fatura|atraso|rotativo)/i.test(norm)
  ) {
    return "interest";
  }

  // 3. Multa por atraso
  if (
    /\b(multa|mora)\b/i.test(norm) ||
    /multa\s*(por\s*)?(atraso|inadimplencia)/i.test(norm)
  ) {
    return "fine";
  }

  // 4. Tarifas, anuidades e encargos de serviço
  if (
    /\b(tarifa|tarifas|anuidade|taxa|taxas|encargo|encargos)\b/i.test(norm) ||
    /tarifa\s*(bancaria|servico|manutencao|emissao)/i.test(norm)
  ) {
    return "bank_fee";
  }

  return "regular";
}
