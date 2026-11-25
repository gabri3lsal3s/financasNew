import { inferBusinessTaxDeductibility } from "@/domain/business";
import { buildCompetenceSummaries } from "@/domain/cards";
import { numberToCents } from "@/domain/money";
import {
  reconcileStatementTransactions,
  type CategoryPredictionSource,
  type DetectedStatementMetadata,
  type ExistingExpenseForReconciliation,
  type ExistingRefundForReconciliation,
  type StatementTransaction,
} from "@/domain/reconciliation";
import type { CardBillRollover, CardPayment, Category, CreditCard, Expense } from "@/types";
import type { BillProtectionState } from "./statement-import-types";

export function shiftCompetenceMonth(competenceMonth: string, deltaMonths: number): string {
  const [yStr, mStr] = competenceMonth.split("-");
  const y = Number.parseInt(yStr ?? "", 10);
  const m = Number.parseInt(mStr ?? "", 10);
  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) return competenceMonth;
  const total = y * 12 + (m - 1) + deltaMonths;
  const nextY = Math.floor(total / 12);
  const nextM = ((total % 12) + 12) % 12;
  return `${nextY}-${String(nextM + 1).padStart(2, "0")}`;
}

export function isDateNearCardClosingDay(
  dateIso: string,
  closingDay?: number | null,
  windowDays = 5,
): boolean {
  if (!closingDay || closingDay < 1 || closingDay > 31) return false;
  const day = Number.parseInt(dateIso.slice(8, 10), 10);
  if (Number.isNaN(day)) return false;
  const directDiff = Math.abs(day - closingDay);
  return Math.min(directDiff, 30 - directDiff) <= windowDays;
}

function toExistingExpense(expense: Expense): ExistingExpenseForReconciliation {
  return {
    id: expense.id,
    date: expense.date,
    description: expense.description ?? "",
    valueCents: numberToCents(expense.value),
    categoryId: expense.category_id,
    installmentNumber: expense.installment_number,
    installmentsTotal: expense.installments_total,
    statementHash: expense.statement_hash,
    chargeKind: expense.charge_kind,
    billCompetence: expense.bill_competence ?? undefined,
    installmentGroupId: expense.installment_group_id,
  };
}

export function mapAllCardExpensesForReconciliation(
  expenses: readonly Expense[],
): ExistingExpenseForReconciliation[] {
  return expenses.map(toExistingExpense);
}

export function mapExpensesForReconciliation(
  expenses: readonly Expense[],
  competenceMonth: string,
): ExistingExpenseForReconciliation[] {
  return expenses.filter((e) => e.bill_competence === competenceMonth).map(toExistingExpense);
}

export function mapAdjacentExpensesForReconciliation(
  expenses: readonly Expense[],
  competenceMonth: string,
): ExistingExpenseForReconciliation[] {
  const prevMonth = shiftCompetenceMonth(competenceMonth, -1);
  const nextMonth = shiftCompetenceMonth(competenceMonth, 1);
  return expenses
    .filter((e) => e.bill_competence === prevMonth || e.bill_competence === nextMonth)
    .map(toExistingExpense);
}

/** Mapeia estornos já registrados em `card_payments` para evitar duplicação na reimportação (G10). */
export function mapCardRefundsForReconciliation(
  payments: readonly CardPayment[],
  competenceMonth: string,
): ExistingRefundForReconciliation[] {
  return payments
    .filter((p) => p.competence_month === competenceMonth && (p.is_refund === true || p.amount < 0))
    .map((p) => ({
      id: p.id,
      date: p.date,
      amountCents: Math.abs(numberToCents(p.amount)),
      competenceMonth: p.competence_month,
      note: p.note ?? undefined,
      statementHash: p.statement_hash ?? undefined,
    }));
}

/** Calcula estado de proteção D14 (fatura rolada vs quitada) usando a soma oficial do domínio. */
export function computeBillProtectionState(params: {
  competenceMonth: string;
  expenses: readonly Expense[];
  payments: readonly CardPayment[];
  rollovers: readonly CardBillRollover[];
}): BillProtectionState {
  const { competenceMonth, expenses, payments, rollovers } = params;
  const rolledOverMonths = new Set(rollovers.map((r) => r.from_competence_month));
  const isRolledOver = rolledOverMonths.has(competenceMonth);
  const summaries = buildCompetenceSummaries(expenses, payments, rollovers);
  const lockedCompetences = new Set<string>(rolledOverMonths);

  for (const s of summaries) {
    const hasPositivePayment = payments.some(
      (p) => p.competence_month === s.month && !p.is_refund && p.amount > 0,
    );
    if (hasPositivePayment && s.saldoCents <= 0) lockedCompetences.add(s.month);
  }

  const activeSummary = summaries.find((s) => s.month === competenceMonth);
  const openBalanceCents = activeSummary?.saldoCents ?? 0;
  return {
    isRolledOver,
    isPaidBill: !isRolledOver && lockedCompetences.has(competenceMonth),
    openBalanceCents,
    lockedCompetences,
  };
}

function normalizeMatchToken(text?: string | null): string {
  return (text ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Localiza cartão cadastrado compatível com dígitos finais ou marca detectada (D17). */
export function findMatchingCardForMismatch(params: {
  detectedMeta: DetectedStatementMetadata | null;
  cards: readonly CreditCard[];
  currentCardId: string;
}): CreditCard | null {
  const { detectedMeta, cards, currentCardId } = params;
  if (!detectedMeta?.hasCardMismatch) return null;
  const others = cards.filter((c) => c.id !== currentCardId && c.is_active !== false);
  if (others.length === 0) return null;

  if (detectedMeta.detectedCardLast4) {
    const last4Matches = others.filter(
      (c) => (c.last_four_digits ?? "").trim() === detectedMeta.detectedCardLast4,
    );
    if (last4Matches.length === 1) return last4Matches[0]!;
  }

  if (detectedMeta.detectedBankBrand) {
    const brandNorm = normalizeMatchToken(detectedMeta.detectedBankBrand);
    const brandMatches = others.filter((c) => {
      const nameNorm = normalizeMatchToken(c.name);
      const cardBrandNorm = normalizeMatchToken(c.brand);
      return nameNorm.includes(brandNorm) || cardBrandNorm.includes(brandNorm);
    });
    if (brandMatches.length === 1) return brandMatches[0]!;
  }
  return null;
}

export function resolveReservedChargesCategoryId(
  categories: readonly Pick<Category, "id" | "name">[],
): string | null {
  const hit = categories.find((c) => {
    const n = normalizeMatchToken(c.name);
    return n === "tarifas e encargos" || n === "encargos" || n === "tarifas";
  });
  return hit?.id ?? null;
}

export function runStatementReconciliation(params: {
  transactions: StatementTransaction[];
  existingExpenses: ExistingExpenseForReconciliation[];
  adjacentExpenses?: ExistingExpenseForReconciliation[];
  existingRefunds?: ExistingRefundForReconciliation[];
  history: CategoryPredictionSource[];
  defaultCategoryId: string;
  reservedChargesCategoryId?: string | null;
  cardScope?: "personal" | "business" | "mixed";
  officialTotalValidated?: boolean;
  isMultiImageOverlapRisk?: boolean;
}) {
  return reconcileStatementTransactions({
    statementTransactions: params.transactions,
    existingExpenses: params.existingExpenses,
    adjacentExpenses: params.adjacentExpenses,
    existingRefunds: params.existingRefunds,
    history: params.history,
    defaultCategoryId: params.defaultCategoryId,
    reservedChargesCategoryId: params.reservedChargesCategoryId,
    cardScope: params.cardScope,
    officialTotalValidated: params.officialTotalValidated,
    isMultiImageOverlapRisk: params.isMultiImageOverlapRisk,
  });
}

export function computeBusinessDeductibilityForPatch(description: string): boolean {
  return inferBusinessTaxDeductibility({ description }).isDeductible;
}
