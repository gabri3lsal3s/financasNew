/**
 * Status derivado de dívidas — ESPECIFICAÇÃO §3.4.
 *
 * O status NUNCA é armazenado: é derivado de `due_date` + `paid_at` em tempo
 * de exibição. `paid` é decidido por `paid_at`; a quitação é persistida
 * apenas pela data (schema §2: `debts.paid_at`).
 *
 * Motor puro — testável isoladamente.
 */

export type DebtStatus = "paid" | "overdue" | "due_today" | "due_soon" | "pending";

/** Hoje em ISO local (YYYY-MM-DD) — injetável nos testes. */
export function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Soma dias a uma data ISO (YYYY-MM-DD) usando UTC (evita timezone). */
export function addDaysISO(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  return date.toISOString().slice(0, 10);
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
