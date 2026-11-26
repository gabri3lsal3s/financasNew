import { budgetLimitsByCategory, exceededCents, resolveEffectiveLimit, spentByCategoryMap } from "@/domain/budgets/index";
import { buildCompetenceSummaries, invoiceClosingDate, invoiceDueDate } from "@/domain/cards/index";

export { invoiceClosingDate };
import { addDaysISO, todayISO } from "@/domain/debts/index";
import { todaySaoPauloISO } from "@/domain/portfolio/dividend-suggester";
import type { SuggestedDividendItem } from "@/domain/portfolio";
import type {
  Budget,
  CardPayment,
  Category,
  CreditCard,
  Expense,
  MyFamilyData,
  NotificationCategoryPreferences,
  UserDividendEvent,
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

/** Detecta faturas recentemente fechadas (opt-in `billClosing`). */
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

export interface DividendNotificationAlert {
  id: string;
  kind: "pending_confirmation" | "provisioned" | "settled";
  title: string;
  body: string;
  badgeLabel: string;
  count: number;
  tickersPreview: string;
  totalBRLCents: number;
  hasUncertainTax: boolean;
  targetRoute: string;
  entityRefs: string[];
}

export interface DetectDividendNotificationAlertsInput {
  pendingConfirmation?: ReadonlyArray<
    Pick<SuggestedDividendItem, "ticker" | "totalAmount" | "currency" | "isTypeUncertain">
  >;
  provisioned?: ReadonlyArray<
    Pick<SuggestedDividendItem, "ticker" | "totalAmount" | "currency" | "isTypeUncertain">
  >;
  recentlySettled?: ReadonlyArray<
    Pick<
      UserDividendEvent,
      "ticker" | "net_amount" | "currency" | "fx_rate_applied" | "payment_date" | "updated_at" | "com_date"
    >
  >;
  today?: string;
  fxRate?: number;
  notifyOnProvisioned?: boolean;
  notifyOnPayment?: boolean;
}

function buildTickersPreview(tickers: readonly string[]): string {
  const unique = Array.from(
    new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean)),
  );
  if (unique.length === 0) return "";
  if (unique.length <= 3) return unique.join(", ");
  return `${unique.slice(0, 3).join(", ")} +${unique.length - 3}`;
}

function sumSuggestedBRLCents(
  items: ReadonlyArray<Pick<SuggestedDividendItem, "totalAmount" | "currency">>,
  fxRate: number,
): number {
  let cents = 0;
  for (const item of items) {
    const rawCents = Math.round((Number(item.totalAmount) || 0) * 100);
    if (rawCents <= 0) continue;
    cents += item.currency === "USD" ? Math.round(rawCents * fxRate) : rawCents;
  }
  return cents;
}

function buildDeterministicDividendSignature(
  items: ReadonlyArray<Pick<SuggestedDividendItem, "ticker" | "totalAmount" | "isTypeUncertain">>,
  scope: string,
): string {
  const parts = items
    .map(
      (item) =>
        `${item.ticker.trim().toUpperCase()}:${Math.round((Number(item.totalAmount) || 0) * 100)}:${item.isTypeUncertain ? 1 : 0}`,
    )
    .sort()
    .join(",");
  let hash = 2166136261;
  const payload = `${scope}|${parts}`;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Agrupa proventos corporativos/manuais da carteira em até 3 alertas determinísticos
 * para a Central de Notificações e o Sininho (a confirmar, provisionados e liquidados).
 */
export function detectDividendNotificationAlerts(
  input: DetectDividendNotificationAlertsInput,
): DividendNotificationAlert[] {
  const today = (input.today ?? todaySaoPauloISO()).slice(0, 10);
  const fx = input.fxRate && input.fxRate > 0 ? input.fxRate : 5.25;
  const alerts: DividendNotificationAlert[] = [];

  const pending = input.pendingConfirmation ?? [];
  if (input.notifyOnPayment !== false && pending.length > 0) {
    const tickersPreview = buildTickersPreview(pending.map((p) => p.ticker));
    const hasUncertainTax = pending.some((p) => Boolean(p.isTypeUncertain));
    const totalBRLCents = sumSuggestedBRLCents(pending, fx);
    const sig = buildDeterministicDividendSignature(pending, today);
    const key = `dividends:pending:${sig}`;
    alerts.push({
      id: key,
      kind: "pending_confirmation",
      title:
        pending.length === 1
          ? `Provento de ${tickersPreview || "ativo"} aguardando confirmação`
          : `${pending.length} proventos aguardando confirmação`,
      body: hasUncertainTax
        ? `Inclui eventos sem distinção Dividendo/JCP (${tickersPreview}). Revise IR/tipo antes de creditar no Caixa.`
        : `Confira e confirme o lançamento de ${tickersPreview} no extrato e no Caixa.`,
      badgeLabel: hasUncertainTax ? "Conferir IR" : "A confirmar",
      count: pending.length,
      tickersPreview,
      totalBRLCents,
      hasUncertainTax,
      targetRoute: "/investments?tab=proventos&review=1",
      entityRefs: [key],
    });
  }

  const provisioned = input.provisioned ?? [];
  if (input.notifyOnProvisioned !== false && provisioned.length > 0) {
    const tickersPreview = buildTickersPreview(provisioned.map((p) => p.ticker));
    const hasUncertainTax = provisioned.some((p) => Boolean(p.isTypeUncertain));
    const totalBRLCents = sumSuggestedBRLCents(provisioned, fx);
    const sig = buildDeterministicDividendSignature(provisioned, today.slice(0, 7));
    const key = `dividends:provisioned:${sig}`;
    alerts.push({
      id: key,
      kind: "provisioned",
      title:
        provisioned.length === 1
          ? `Provento provisionado: ${tickersPreview || "Carteira"}`
          : `${provisioned.length} proventos provisionados na agenda`,
      body: `Data COM cumprida para ${tickersPreview}. Fora do Patrimônio e do Caixa até o pagamento.`,
      badgeLabel: "Provisionado",
      count: provisioned.length,
      tickersPreview,
      totalBRLCents,
      hasUncertainTax,
      targetRoute: "/investments?tab=proventos&subtab=calendario",
      entityRefs: [key],
    });
  }

  const settledCutoff = addDaysISO(today, -3);
  const settledRecent = (input.recentlySettled ?? []).filter((ev) => {
    const refDay = (ev.payment_date ?? ev.updated_at ?? ev.com_date).slice(0, 10);
    return refDay >= settledCutoff && refDay <= today;
  });

  if (input.notifyOnPayment !== false && settledRecent.length > 0) {
    const latestDate = settledRecent.reduce((max, ev) => {
      const refDay = (ev.payment_date ?? ev.updated_at ?? ev.com_date).slice(0, 10);
      return refDay > max ? refDay : max;
    }, settledCutoff);
    const tickersPreview = buildTickersPreview(settledRecent.map((s) => s.ticker));
    let totalBRLCents = 0;
    for (const ev of settledRecent) {
      const rawCents = Math.round((Number(ev.net_amount) || 0) * 100);
      if (rawCents <= 0) continue;
      const evFx = ev.fx_rate_applied && ev.fx_rate_applied > 0 ? ev.fx_rate_applied : fx;
      totalBRLCents += ev.currency === "USD" ? Math.round(rawCents * evFx) : rawCents;
    }
    const key = `dividends:settled:${latestDate}`;
    alerts.push({
      id: key,
      kind: "settled",
      title:
        settledRecent.length === 1
          ? `Provento creditado: ${tickersPreview || "Carteira"}`
          : `${settledRecent.length} proventos creditados automaticamente`,
      body: `Liquidados recentemente na carteira (${tickersPreview}).`,
      badgeLabel: "Creditado",
      count: settledRecent.length,
      tickersPreview,
      totalBRLCents,
      hasUncertainTax: false,
      targetRoute: "/investments?tab=proventos&subtab=mensal",
      entityRefs: [key],
    });
  }

  return alerts;
}
