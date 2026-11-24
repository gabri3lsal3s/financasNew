/**
 * Motor Puro de Caixa Operacional Derivado do Negócio (PJ) — Fase 1 (v2.1).
 *
 * Responsável por:
 *   • Apurar o saldo financeiro real disponível no caixa da empresa sem exigir conta bancária formal separada;
 *   • Incorporar saldo inicial virtual (openingBalanceCents do perfil);
 *   • Incorporar aportes de capital (PF -> PJ);
 *   • Computar receitas compensadas descontando retenções na fonte (IRRF/ISS);
 *   • Descontar despesas pagas em conta corrente/PIX/débito (isolando compras parceladas no cartão pessoal);
 *   • Descontar retiradas de pró-labore e reembolsos de faturas de cartão já liquidados.
 *
 * 100% puro — sem dependências de React/Supabase. Moeda em centavos inteiros.
 */

import { numberToCents } from "@/domain/money";
import type { Expense, Income } from "@/types";

export interface DerivedBusinessCashComponents {
  openingBalanceCents: number;
  capitalInjectionsCents: number;
  grossRevenueCents: number;
  taxWithheldCents: number;
  netRevenueReceivedCents: number;
  cashExpensesCents: number;
  proLaboreWithdrawnCents: number;
  cardReimbursementsPaidCents: number;
  derivedCashBalanceCents: number;
}

export interface CalculateDerivedCashFromTransactionsParams {
  openingBalanceCents?: number;
  incomes: readonly Income[];
  expenses: readonly Expense[];
}

/**
 * Calcula o Caixa Derivado PJ diretamente a partir das listas de receitas e despesas.
 */
export function calculateDerivedBusinessCashFromTransactions(
  params: CalculateDerivedCashFromTransactionsParams,
): DerivedBusinessCashComponents {
  const openingBalanceCents = Math.round(params.openingBalanceCents ?? 0);

  let capitalInjectionsCents = 0;
  let grossRevenueCents = 0;
  let taxWithheldCents = 0;

  for (const inc of params.incomes) {
    // Aporte de Capital PF -> PJ: entra no caixa da empresa com transfer_kind = 'capital_injection'
    if (inc.is_internal_transfer && inc.transfer_kind === "capital_injection") {
      capitalInjectionsCents += numberToCents(inc.value);
      continue;
    }

    // Receitas da empresa: scope = 'business' e não transferência interna
    if ((inc.scope ?? "personal") === "business" && !inc.is_internal_transfer) {
      const rawCents = numberToCents(inc.value);
      const withheldCents = inc.tax_withheld ? numberToCents(inc.tax_withheld) : 0;
      grossRevenueCents += rawCents;
      taxWithheldCents += Math.min(rawCents, withheldCents);
    }
  }

  const netRevenueReceivedCents = Math.max(0, grossRevenueCents - taxWithheldCents);

  let cashExpensesCents = 0;
  let proLaboreWithdrawnCents = 0;
  let cardReimbursementsPaidCents = 0;

  for (const exp of params.expenses) {
    if ((exp.scope ?? "personal") !== "business") continue;

    // Pró-labore retirado PJ -> PF
    if (exp.is_internal_transfer && exp.transfer_kind === "pro_labore") {
      proLaboreWithdrawnCents += numberToCents(exp.value);
      continue;
    }

    // Reembolso de cartão pago PJ -> PF
    if (exp.is_internal_transfer && exp.transfer_kind === "card_reimbursement") {
      cardReimbursementsPaidCents += numberToCents(exp.value);
      continue;
    }

    // Despesa operacional comum do negócio:
    // Compras em cartão de crédito (credit_card ou card_id) NÃO saem do caixa agora!
    // Elas só saem quando reembolsadas à PF via card_reimbursement acima.
    const isCreditCard =
      exp.payment_method === "credit_card" ||
      Boolean(exp.card_id);

    if (!isCreditCard && !exp.is_internal_transfer) {
      cashExpensesCents += numberToCents(exp.value);
    }
  }

  const derivedCashBalanceCents =
    openingBalanceCents +
    capitalInjectionsCents +
    netRevenueReceivedCents -
    cashExpensesCents -
    proLaboreWithdrawnCents -
    cardReimbursementsPaidCents;

  return {
    openingBalanceCents,
    capitalInjectionsCents,
    grossRevenueCents,
    taxWithheldCents,
    netRevenueReceivedCents,
    cashExpensesCents,
    proLaboreWithdrawnCents,
    cardReimbursementsPaidCents,
    derivedCashBalanceCents,
  };
}

/**
 * Calcula o Caixa Derivado a partir de valores pré-consolidados em centavos.
 */
export function calculateDerivedBusinessCashDirect(params: {
  openingBalanceCents?: number;
  capitalInjectionsCents?: number;
  grossRevenueCents?: number;
  taxWithheldCents?: number;
  cashExpensesCents?: number;
  proLaboreWithdrawnCents?: number;
  cardReimbursementsPaidCents?: number;
}): DerivedBusinessCashComponents {
  const openingBalanceCents = Math.round(params.openingBalanceCents ?? 0);
  const capitalInjectionsCents = Math.max(0, Math.round(params.capitalInjectionsCents ?? 0));
  const grossRevenueCents = Math.max(0, Math.round(params.grossRevenueCents ?? 0));
  const taxWithheldCents = Math.max(0, Math.min(grossRevenueCents, Math.round(params.taxWithheldCents ?? 0)));
  const netRevenueReceivedCents = grossRevenueCents - taxWithheldCents;
  const cashExpensesCents = Math.max(0, Math.round(params.cashExpensesCents ?? 0));
  const proLaboreWithdrawnCents = Math.max(0, Math.round(params.proLaboreWithdrawnCents ?? 0));
  const cardReimbursementsPaidCents = Math.max(0, Math.round(params.cardReimbursementsPaidCents ?? 0));

  const derivedCashBalanceCents =
    openingBalanceCents +
    capitalInjectionsCents +
    netRevenueReceivedCents -
    cashExpensesCents -
    proLaboreWithdrawnCents -
    cardReimbursementsPaidCents;

  return {
    openingBalanceCents,
    capitalInjectionsCents,
    grossRevenueCents,
    taxWithheldCents,
    netRevenueReceivedCents,
    cashExpensesCents,
    proLaboreWithdrawnCents,
    cardReimbursementsPaidCents,
    derivedCashBalanceCents,
  };
}
