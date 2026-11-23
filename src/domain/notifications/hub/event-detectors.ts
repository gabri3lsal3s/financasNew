import {
  budgetLimitsByCategory,
  exceededCents,
  resolveEffectiveLimit,
  spentByCategoryMap,
} from "@/domain/budgets";
import {
  buildCompetenceSummaries,
  invoiceDueDate,
  shiftMonth,
} from "@/domain/cards";
import { addDaysISO, todayISO } from "@/domain/debts";
import type {
  Budget,
  CardPayment,
  Category,
  CreditCard,
  Expense,
  MyFamilyData,
  NotificationCategoryPreferences,
} from "@/types";
import type { Trip } from "@/types/trips";

export const DEFAULT_NOTIFICATION_CATEGORY_PREFERENCES: Required<NotificationCategoryPreferences> = {
  billClosing: false,
  receivablesAndSplits: true,
  budgetsAndPace: true,
  advisorInsights: false,
  familyAndTrips: true,
};

export function resolveNotificationCategoryPreferences(
  prefs?: NotificationCategoryPreferences | null,
): Required<NotificationCategoryPreferences> {
  return {
    billClosing: prefs?.billClosing === true,
    receivablesAndSplits: prefs?.receivablesAndSplits !== false,
    budgetsAndPace: prefs?.budgetsAndPace !== false,
    advisorInsights: prefs?.advisorInsights === true,
    familyAndTrips: prefs?.familyAndTrips !== false,
  };
}

export interface ClosedCardBillAlert {
  /** Chave determinística `bill_closed:${cardId}:${competenceMonth}` */
  key: string;
  cardId: string;
  cardName: string;
  competenceMonth: string;
  closingDate: string;
  dueDate: string;
  balanceCents: number;
  targetRoute: string;
}

export interface DetectClosedCardBillsInput {
  cards: readonly CreditCard[];
  cardExpenses: readonly Expense[];
  cardPayments: readonly CardPayment[];
  today?: string;
  /** Janela de dias após o fechamento para continuar sinalizando antes do vencimento (padrão: 3). */
  lookbackDays?: number;
}

/**
 * Resolve a data civil (YYYY-MM-DD) de fechamento da fatura de uma competência.
 * Quando closingDay >= dueDay, o corte ocorre no mês anterior ao vencimento.
 */
export function invoiceClosingDate(
  competenceMonth: string,
  closingDay: number,
  dueDay: number,
): string {
  const closingMonth =
    closingDay >= dueDay ? shiftMonth(competenceMonth, -1) : competenceMonth;
  return invoiceDueDate(closingMonth, closingDay);
}

/**
 * Detecta faturas recentemente fechadas (opt-in `billClosing`) com saldo em aberto,
 * que ainda não atingiram a data de vencimento.
 */
export function detectClosedCardBills(
  input: DetectClosedCardBillsInput,
): ClosedCardBillAlert[] {
  const today = input.today ?? todayISO();
  const lookbackDays = Math.max(0, input.lookbackDays ?? 3);
  const alerts: ClosedCardBillAlert[] = [];

  for (const card of input.cards) {
    if (!card.is_active || typeof card.closing_day !== "number") continue;
    const expenses = input.cardExpenses.filter((e) => e.card_id === card.id);
    const payments = input.cardPayments.filter((p) => p.card_id === card.id);
    const summaries = buildCompetenceSummaries(expenses, payments);

    for (const summary of summaries) {
      if (summary.saldoCents <= 0) continue;

      const closingDate = invoiceClosingDate(
        summary.month,
        card.closing_day,
        card.due_day,
      );
      const dueDate = invoiceDueDate(summary.month, card.due_day);
      const windowEnd = addDaysISO(closingDate, lookbackDays);

      // Só sinaliza fechamento quando já fechou (<= lookbackDays atrás) e ainda não venceu
      if (today >= closingDate && today <= windowEnd && dueDate > today) {
        alerts.push({
          key: `bill_closed:${card.id}:${summary.month}`,
          cardId: card.id,
          cardName: card.name,
          competenceMonth: summary.month,
          closingDate,
          dueDate,
          balanceCents: summary.saldoCents,
          targetRoute: `/cartoes?card=${encodeURIComponent(card.id)}&month=${encodeURIComponent(summary.month)}`,
        });
      }
    }
  }

  return alerts.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export interface BudgetOverrunCategoryItem {
  categoryId: string;
  categoryName: string;
  limitCents: number;
  spentCents: number;
  excessCents: number;
}

export interface BudgetOverrunAlert {
  id: string;
  month: string;
  exceededCount: number;
  totalExcessCents: number;
  topCategories: readonly BudgetOverrunCategoryItem[];
  entityRefs: string[];
  targetRoute: string;
}

export interface DetectBudgetOverrunInput {
  month: string;
  budgets: readonly Budget[];
  expenses: readonly Expense[];
  categories: readonly Category[];
}

/**
 * Consolida estouramentos de orçamento (> 100% do limite efetivo no mês)
 * em um único alerta mensal para evitar spam por categoria.
 */
export function detectConsolidatedBudgetOverrun(
  input: DetectBudgetOverrunInput,
): BudgetOverrunAlert | null {
  const monthExpenses = input.expenses.filter((e) =>
    e.date.startsWith(input.month),
  );
  const limitsByCategory = budgetLimitsByCategory([...input.budgets]);
  const spentMap = spentByCategoryMap([...monthExpenses]);

  const exceededItems: BudgetOverrunCategoryItem[] = [];

  for (const category of input.categories) {
    if (category.type !== "expense") continue;
    const limitCents = resolveEffectiveLimit(
      limitsByCategory.get(category.id) ?? [],
      input.month,
    );
    if (limitCents <= 0) continue;

    const spentCents = spentMap.get(category.id) ?? 0;
    const overCents = exceededCents(spentCents, limitCents);
    if (overCents > 0) {
      exceededItems.push({
        categoryId: category.id,
        categoryName: category.name,
        limitCents,
        spentCents,
        excessCents: overCents,
      });
    }
  }

  if (exceededItems.length === 0) {
    return null;
  }

  exceededItems.sort((a, b) => b.excessCents - a.excessCents);
  const totalExcessCents = exceededItems.reduce(
    (acc, item) => acc + item.excessCents,
    0,
  );

  return {
    id: `budget:overrun:${input.month}`,
    month: input.month,
    exceededCount: exceededItems.length,
    totalExcessCents,
    topCategories: exceededItems.slice(0, 3),
    entityRefs: [`budget:overrun:${input.month}`],
    targetRoute: "/orcamentos?tab=limits",
  };
}

export interface TripFamilyAlert {
  id: string;
  kind: "trip_settlement" | "family_invite";
  settlementPending?: boolean;
  title: string;
  body: string;
  badgeLabel: string;
  targetRoute: string;
  entityRefs: string[];
}

export interface DetectTripAndFamilyAlertsInput {
  trips?: readonly Trip[];
  familyData?: MyFamilyData | null;
  today?: string;
  nowMs?: number;
}

function formatDayMonthPtBr(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}`;
}

/**
 * Detecta viagens encerradas ou em liquidação pendente e convites familiares ativos
 * aguardando aceite.
 */
export function detectTripAndFamilyPendingAlerts(
  input: DetectTripAndFamilyAlertsInput,
): TripFamilyAlert[] {
  const today = input.today ?? todayISO();
  const nowMs = input.nowMs ?? Date.now();
  const alerts: TripFamilyAlert[] = [];

  for (const trip of input.trips ?? []) {
    if (trip.status === "completed" || trip.status === "archived") continue;

    const isSettling = trip.status === "settling";
    const isEndedWhileActive = trip.status === "active" && trip.end_date < today;
    if (!isSettling && !isEndedWhileActive) continue;

    alerts.push({
      id: `trip:settlement:${trip.id}`,
      kind: "trip_settlement",
      settlementPending: isSettling,
      title: isSettling ? `Acerto em aberto: ${trip.title}` : `Viagem encerrada: ${trip.title}`,
      body: isSettling
        ? "Esta viagem está em fase de acerto. Confirme os pagamentos pendentes para concluir."
        : `Viagem encerrada em ${formatDayMonthPtBr(trip.end_date)}. Confira os saldos para fechar o acerto do grupo.`,
      badgeLabel: "Viagem",
      targetRoute: `/viagens/${trip.id}`,
      entityRefs: [`trip:${trip.id}`],
    });
  }

  for (const invite of input.familyData?.invites ?? []) {
    if (invite.status !== "pending") continue;
    if (invite.expires_at && new Date(invite.expires_at).getTime() <= nowMs) {
      continue;
    }

    const targetLabel = invite.invited_email
      ? `para ${invite.invited_email}`
      : "aguardando confirmação do parceiro";
    alerts.push({
      id: `family:invite:${invite.id}`,
      kind: "family_invite",
      title: "Convite familiar pendente",
      body: `Convite enviado ${targetLabel} aguardando resposta no Modo Família.`,
      badgeLabel: "Família",
      targetRoute: "/familia",
      entityRefs: [`family:invite:${invite.id}`],
    });
  }

  return alerts;
}
