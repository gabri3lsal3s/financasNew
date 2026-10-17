/**
 * Status derivado de dívidas — ESPECIFICAÇÃO §3.4.
 *
 * O status NUNCA é armazenado: é derivado de `due_date` + `paid_at` em tempo
 * de exibição. `paid` é decidido por `paid_at`; a quitação é persistida
 * apenas pela data (schema §2: `debts.paid_at`).
 *
 * Motor puro — testável isoladamente.
 */

import { numberToCents } from "@/domain/money";

export type DebtStatus = "paid" | "overdue" | "due_today" | "due_soon" | "pending";

/** Hoje em ISO local (YYYY-MM-DD) — injetável nos testes. */
export function todayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Soma dias a uma data ISO (YYYY-MM-DD) preservando timezone local. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y ?? 2000, (m ?? 1) - 1, (d ?? 1) + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}


/**
 * Status derivado da dívida.
 * @param dueDate data de vencimento (YYYY-MM-DD)
 * @param paidAt data de quitação (ISO) ou null quando pendente
 * @param today referência de hoje (YYYY-MM-DD) — default local; injetável
 */
export function debtStatus(dueDate: string, paidAt: string | null, today: string = todayISO()): DebtStatus {
  if (paidAt) return "paid";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "due_today";
  if (dueDate <= addDaysISO(today, 3)) return "due_soon";
  return "pending";
}

/** Rótulos pt-BR para exibição. */
export const DEBT_STATUS_LABELS: Record<DebtStatus, string> = {
  paid: "Quitada",
  overdue: "Vencida",
  due_today: "Vence hoje",
  due_soon: "Vence em breve",
  pending: "Pendente",
};

export interface DebtAggregateItem {
  type: "payable" | "receivable";
  amount: number;
  paid_at: string | null;
  due_date?: string | null;
}

export interface DebtsSummary {
  payablePendingCents: number;
  receivablePendingCents: number;
  netPendingCents: number;
  paidCount: number;
  pendingCount: number;
}

/**
 * Agrega os totais e status de pendências a pagar e a receber em centavos inteiros.
 * Suporta filtro opcional de data limite exclusiva (`beforeDueDateExclusive`).
 */
export function calculateDebtsSummary(
  debts: readonly DebtAggregateItem[],
  options?: { beforeDueDateExclusive?: string },
): DebtsSummary {
  let payablePendingCents = 0;
  let receivablePendingCents = 0;
  let paidCount = 0;
  let pendingCount = 0;

  for (const debt of debts) {
    if (debt.paid_at !== null) {
      paidCount++;
      continue;
    }

    if (
      options?.beforeDueDateExclusive &&
      debt.due_date &&
      debt.due_date >= options.beforeDueDateExclusive
    ) {
      continue;
    }

    pendingCount++;
    const cents = numberToCents(debt.amount);
    if (debt.type === "payable") {
      payablePendingCents += cents;
    } else {
      receivablePendingCents += cents;
    }
  }

  return {
    payablePendingCents,
    receivablePendingCents,
    netPendingCents: receivablePendingCents - payablePendingCents,
    paidCount,
    pendingCount,
  };
}

export * from "./penalty";
export * from "./schemas";
