/**
 * Radar dos Próximos 7 Dias — Função Pura de Projeção Financeira Semanal.
 *
 * Mapeia as obrigações imediatas (faturas de cartão e contas a pagar) com vencimento
 * entre hoje e D+7 (incluindo contas vencidas imediatas até 7 dias atrás).
 * Confronta o total de saídas da semana com o saldo bancário real disponível,
 * indicando a margem de liquidez semanal ("saldo livre da semana").
 */

import { addDaysISO, todayISO } from "@/domain/debts";

/** Calcula a diferença em dias entre duas datas ISO YYYY-MM-DD (positivo se toIso for no futuro). */
export function diffDaysISO(fromIso: string, toIso: string): number {
  const fromMs = Date.parse(`${fromIso}T00:00:00Z`);
  const toMs = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((toMs - fromMs) / (1000 * 60 * 60 * 24));
}

export interface WeeklyRadarObligation {
  id: string;
  key: string;
  kind: "bill" | "debt";
  name: string;
  dueDate: string;
  amountCents: number;
  status: "overdue" | "due_today" | "due_soon";
  daysUntilDue: number; // < 0: vencido, 0: vence hoje, 1: amanhã, etc.
  link: { path: string; params?: Record<string, string> };
}

export interface WeeklyRadarDebtInput {
  id: string;
  name: string;
  type: "payable" | "receivable";
  amount: number;
  due_date: string;
  paid_at: string | null;
}

export interface WeeklyRadarInvoiceInput {
  id: string;
  name: string;
  dueDate: string;
  amountCents: number;
  kind?: string;
  cardId?: string;
  competenceMonth?: string;
}

export interface ComputeWeeklyRadarParams {
  debts: readonly WeeklyRadarDebtInput[];
  invoices: readonly WeeklyRadarInvoiceInput[];
  realCashCents: number;
  today?: string;
}

export interface WeeklyRadarSummary {
  items: WeeklyRadarObligation[];
  totalDueCents: number;
  realCashCents: number;
  freeBalanceCents: number;
  isDeficitRisk: boolean;
  hasObligations: boolean;
}

/**
 * Calcula o radar de vencimentos dos próximos 7 dias.
 * Se não houver obrigações no horizonte, retorna hasObligations: false (para auto-ocultação estrita em empty state).
 */
export function computeWeeklyDueRadar({
  debts,
  invoices,
  realCashCents,
  today = todayISO(),
}: ComputeWeeklyRadarParams): WeeklyRadarSummary {
  const horizonEnd = addDaysISO(today, 7);
  // Aceita vencidas recentes (até 7 dias atrás) e obrigações até D+7
  const horizonStart = addDaysISO(today, -7);

  const obligations: WeeklyRadarObligation[] = [];

  // 1. Processa Dívidas a Pagar
  for (const debt of debts) {
    if (debt.type !== "payable" || debt.paid_at !== null) continue;
    if (debt.due_date < horizonStart || debt.due_date > horizonEnd) continue;

    const daysUntilDue = diffDaysISO(today, debt.due_date);
    const status: WeeklyRadarObligation["status"] =
      daysUntilDue < 0 ? "overdue" : daysUntilDue === 0 ? "due_today" : "due_soon";

    obligations.push({
      id: debt.id,
      key: `debt:${debt.id}`,
      kind: "debt",
      name: debt.name,
      dueDate: debt.due_date,
      amountCents: Math.round(debt.amount * 100),
      status,
      daysUntilDue,
      link: { path: "/dividas", params: { q: debt.id } },
    });
  }

  // 2. Processa Faturas de Cartão
  for (const inv of invoices) {
    if (inv.amountCents <= 0) continue;
    if (inv.dueDate < horizonStart || inv.dueDate > horizonEnd) continue;

    const daysUntilDue = diffDaysISO(today, inv.dueDate);
    const status: WeeklyRadarObligation["status"] =
      daysUntilDue < 0 ? "overdue" : daysUntilDue === 0 ? "due_today" : "due_soon";

    const linkParams: Record<string, string> = {};
    if (inv.cardId) linkParams.card = inv.cardId;
    if (inv.competenceMonth) linkParams.month = inv.competenceMonth;

    obligations.push({
      id: inv.id,
      key: inv.id.startsWith("bill:") ? inv.id : `bill:${inv.id}`,
      kind: "bill",
      name: inv.name,
      dueDate: inv.dueDate,
      amountCents: inv.amountCents,
      status,
      daysUntilDue,
      link: { path: "/cartoes", params: linkParams },
    });
  }

  // 3. Ordenação estrita: mais urgentes primeiro (menor dueDate e menor daysUntilDue)
  obligations.sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    return b.amountCents - a.amountCents;
  });

  const totalDueCents = obligations.reduce((acc, curr) => acc + curr.amountCents, 0);
  const freeBalanceCents = realCashCents - totalDueCents;
  const isDeficitRisk = freeBalanceCents < 0;
  const hasObligations = obligations.length > 0;

  return {
    items: obligations,
    totalDueCents,
    realCashCents,
    freeBalanceCents,
    isDeficitRisk,
    hasObligations,
  };
}
