/**
 * Motor puro de DRE Simplificado Mensal (Regime de Competência PJ — Fase 2B).
 *
 * Todos os cálculos em centavos inteiros. Zero dependências de React/Supabase.
 * Regras de desambiguação de charge_kind = 'tax':
 *   - IOF de cartão (card_id !== null ou payment_method === 'credit_card')
 *     compõe Custos Operacionais, NUNCA Impostos Fiscais Pagos.
 *   - Imposto fiscal pago do negócio (DAS MEI, ISS, Carnê-Leão, Simples):
 *     scope === 'business' && !is_internal_transfer && charge_kind === 'tax'
 *     && !card_id && payment_method !== 'credit_card'.
 */

import { sumWeightedCents } from "@/domain/money";
import type { ChargeKind, DebtType, InternalTransferKind, PaymentMethod, TransactionScope } from "@/types";

export interface DreIncomeInput {
  value: number;
  report_weight?: number | null;
  scope?: TransactionScope | null;
  is_internal_transfer?: boolean | null;
}

export interface DreExpenseInput {
  value: number;
  report_weight?: number | null;
  scope?: TransactionScope | null;
  is_internal_transfer?: boolean | null;
  transfer_kind?: InternalTransferKind | null;
  charge_kind?: ChargeKind | null;
  payment_method?: PaymentMethod | string | null;
  card_id?: string | null;
}

export interface DreDebtInput {
  amount: number;
  type: DebtType;
  paid_at?: string | null;
  scope?: TransactionScope | null;
}

export interface BusinessDreResult {
  grossRevenueCents: number;
  operationalCostsCents: number;
  operationalProfitCents: number;
  fiscalTaxesPaidCents: number;
  netProfitAfterTaxCents: number;
  proLaboreWithdrawnCents: number;
  retainedEarningsCents: number;
  pendingReceivablesCents: number;
  marginPct: number;
}

/**
 * Identifica de forma determinística se uma despesa representa imposto fiscal pago do negócio
 * (ex.: DAS MEI, Carnê-Leão, ISS) — excluindo estritamente IOF de cartão de crédito.
 */
export function isBusinessFiscalTaxExpense(exp: Pick<
  DreExpenseInput,
  "scope" | "is_internal_transfer" | "charge_kind" | "card_id" | "payment_method"
>): boolean {
  if ((exp.scope ?? "personal") !== "business") return false;
  if (exp.is_internal_transfer) return false;
  if (exp.charge_kind !== "tax") return false;
  if (exp.card_id != null && exp.card_id !== "") return false;
  if (exp.payment_method === "credit_card") return false;
  return true;
}

export function calculateBusinessDre(params: {
  incomes: readonly DreIncomeInput[];
  expenses: readonly DreExpenseInput[];
  debts?: readonly DreDebtInput[];
}): BusinessDreResult {
  const businessIncomes = params.incomes
    .filter((i) => (i.scope ?? "personal") === "business" && !i.is_internal_transfer)
    .map((i) => ({ value: i.value, report_weight: i.report_weight ?? 1 }));

  const grossRevenueCents = sumWeightedCents(businessIncomes);

  const nonTransferBusinessExpenses = params.expenses.filter(
    (e) => (e.scope ?? "personal") === "business" && !e.is_internal_transfer,
  );

  const fiscalTaxExpenses = nonTransferBusinessExpenses
    .filter((e) => isBusinessFiscalTaxExpense(e))
    .map((e) => ({ value: e.value, report_weight: e.report_weight ?? 1 }));

  const operationalExpenses = nonTransferBusinessExpenses
    .filter((e) => !isBusinessFiscalTaxExpense(e))
    .map((e) => ({ value: e.value, report_weight: e.report_weight ?? 1 }));

  const operationalCostsCents = sumWeightedCents(operationalExpenses);
  const fiscalTaxesPaidCents = sumWeightedCents(fiscalTaxExpenses);
  const operationalProfitCents = grossRevenueCents - operationalCostsCents;
  const netProfitAfterTaxCents = operationalProfitCents - fiscalTaxesPaidCents;

  const proLaboreExpenses = params.expenses
    .filter(
      (e) =>
        (e.scope ?? "personal") === "business" &&
        Boolean(e.is_internal_transfer) &&
        e.transfer_kind === "pro_labore",
    )
    .map((e) => ({ value: e.value, report_weight: e.report_weight ?? 1 }));

  const proLaboreWithdrawnCents = sumWeightedCents(proLaboreExpenses);
  const retainedEarningsCents = netProfitAfterTaxCents - proLaboreWithdrawnCents;

  const pendingReceivablesCents = sumWeightedCents(
    (params.debts ?? [])
      .filter(
        (d) =>
          (d.scope ?? "personal") === "business" &&
          d.type === "receivable" &&
          !d.paid_at,
      )
      .map((d) => ({ value: d.amount, report_weight: 1 })),
  );

  const marginPct =
    grossRevenueCents > 0
      ? Number(((netProfitAfterTaxCents / grossRevenueCents) * 100).toFixed(2))
      : 0;

  return {
    grossRevenueCents,
    operationalCostsCents,
    operationalProfitCents,
    fiscalTaxesPaidCents,
    netProfitAfterTaxCents,
    proLaboreWithdrawnCents,
    retainedEarningsCents,
    pendingReceivablesCents,
    marginPct,
  };
}
