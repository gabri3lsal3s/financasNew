import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import type { ReminderItem } from "@/domain/reminders";
import type {
  PublicShare,
  SplitPaymentSignal,
  SplitSharePayload,
  SupportTicket,
  UserBroadcastNotification,
} from "@/types";
import type {
  AppNotification,
  BuildNotificationCenterInput,
  NotificationBadgeVariant,
  NotificationCenterSummary,
  NotificationDomain,
  NotificationIconName,
  NotificationSeverity,
  NotificationTone,
  PendingSplitSignalSummary,
} from "./types";
import {
  resolveNotificationCategoryPreferences,
  type BudgetOverrunAlert,
  type ClosedCardBillAlert,
  type TripFamilyAlert,
} from "./event-detectors";

export const SEVERITY_RANK: Record<NotificationSeverity, number> = {
  P0_CRITICAL: 0,
  P1_ACTION_NEEDED: 1,
  P2_ADVISORY: 2,
  P3_OPPORTUNITY: 3,
};

function isSplitSharePayload(payload: unknown): payload is SplitSharePayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    ("payment_signals" in payload || "participants" in payload || "title" in payload)
  );
}

const MONTH_SHORT_PT_BR = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export function formatIsoDateShortPtBr(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  return `${m[3]}/${m[2]}`;
}

export function formatCompetenceMonthPtBr(competenceMonth: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(competenceMonth);
  if (!m) return competenceMonth;
  const idx = Number(m[2]) - 1;
  const label = MONTH_SHORT_PT_BR[idx];
  return label ? `${label}/${m[1]}` : competenceMonth;
}

function extractReminderEntityRefs(item: ReminderItem): string[] {
  if (item.kind === "bill") {
    const parts = item.key.split(":");
    const cardId = parts[1] || item.link?.params?.card;
    const month = parts[2] || item.link?.params?.month;
    const refs = new Set<string>([item.key]);
    if (cardId && month) {
      refs.add(`bill:${cardId}:${month}`);
    }
    return Array.from(refs);
  }
  const debtId = item.key.startsWith("debt:")
    ? item.key.slice("debt:".length)
    : item.link?.params?.q;
  return debtId ? [`debt:${debtId}`] : [item.key];
}

function extractReminderCardId(item: ReminderItem): string | null {
  if (item.kind !== "bill") return null;
  const parts = item.key.split(":");
  return parts[1] || item.link?.params?.card || null;
}

/**
 * Extrai sinalizações de pagamento Pix pendentes de rachas ativos do usuário.
 */
export function extractPendingSplitSignals(
  splitShares: PublicShare[] = [],
  nowMs: number = Date.now(),
): PendingSplitSignalSummary[] {
  const result: PendingSplitSignalSummary[] = [];

  for (const share of splitShares) {
    if (share.is_revoked) continue;
    if (share.expires_at && new Date(share.expires_at).getTime() <= nowMs) continue;
    if (!isSplitSharePayload(share.payload)) continue;
    if (share.payload.is_completed) continue;

    const participantsById = new Map(
      (share.payload.participants ?? []).map((p) => [p.id, p]),
    );
    const rawSignals = share.payload.payment_signals ?? [];
    const pending: SplitPaymentSignal[] = rawSignals.filter((signal: SplitPaymentSignal) => {
      if (signal.status !== "pending") return false;
      if (signal.participant_id && participantsById.get(signal.participant_id)?.is_host) {
        return false;
      }
      return true;
    });
    if (pending.length === 0) continue;

    const totalCents = pending.reduce(
      (acc: number, signal: SplitPaymentSignal) => acc + signal.amount_cents,
      0,
    );
    const latestNotifiedAt = pending.reduce(
      (latest: string, signal: SplitPaymentSignal) =>
        signal.created_at > latest ? signal.created_at : latest,
      pending[0]!.created_at,
    );

    result.push({
      shareId: share.id,
      token: share.token,
      title: share.payload.title || "Divisão de Despesa",
      signals: pending,
      totalCents,
      latestNotifiedAt,
    });
  }

  return result.sort((a, b) => b.latestNotifiedAt.localeCompare(a.latestNotifiedAt));
}

function mapReminderToNotification(item: ReminderItem): AppNotification {
  const entityRefs = extractReminderEntityRefs(item);

  if (item.direction === "receivable") {
    return {
      id: item.key,
      domain: "receivable",
      severity: "P2_ADVISORY",
      title: item.title,
      subtitle: item.subtitle,
      body: `Previsto para ${formatIsoDateShortPtBr(item.dueDate)}`,
      badgeLabel: "A receber",
      badgeVariant: "portfolio",
      tone: "portfolio",
      iconName: "hand-coins",
      amountCents: item.amountCents,
      dueDate: item.dueDate,
      targetRoute: "/dividas",
      channels: ["bell", "reminders_page"],
      entityRefs,
      state: "unread",
    };
  }

  const isOverdue = item.status === "overdue";
  const severity: NotificationSeverity = isOverdue ? "P0_CRITICAL" : "P1_ACTION_NEEDED";
  const badgeLabel =
    item.status === "overdue"
      ? "Vencido"
      : item.status === "due_today"
        ? "Vence hoje"
        : "Em breve";
  const badgeVariant: NotificationBadgeVariant = isOverdue ? "critical" : "warning";
  const tone: NotificationTone = isOverdue ? "critical" : "warning";

  return {
    id: item.key,
    domain: "payable",
    severity,
    title: item.title,
    subtitle: item.subtitle,
    body: item.subtitle ?? "",
    badgeLabel,
    badgeVariant,
    tone,
    iconName: item.kind === "bill" ? "credit-card" : "file-warning",
    amountCents: item.amountCents,
    dueDate: item.dueDate,
    targetRoute: item.kind === "bill" ? "/cartoes" : "/dividas",
    channels: ["bell", "reminders_page", "os_push", "email_digest"],
    entityRefs,
    state: "unread",
  };
}

function mapBroadcastToNotification(broadcast: UserBroadcastNotification): AppNotification {
  const severity: NotificationSeverity =
    broadcast.type === "critical"
      ? "P0_CRITICAL"
      : broadcast.type === "warning"
        ? "P1_ACTION_NEEDED"
        : broadcast.type === "promotion"
          ? "P3_OPPORTUNITY"
          : "P2_ADVISORY";

  const badgeLabel =
    broadcast.type === "critical"
      ? "Urgente"
      : broadcast.type === "warning"
        ? "Importante"
        : broadcast.type === "promotion"
          ? "Novidade"
          : broadcast.type === "system"
            ? "Sistema"
            : "Comunicado";

  const badgeVariant: NotificationBadgeVariant =
    broadcast.type === "critical"
      ? "critical"
      : broadcast.type === "warning"
        ? "warning"
        : broadcast.type === "promotion"
          ? "portfolio"
          : "default";

  const tone: NotificationTone =
    broadcast.type === "critical"
      ? "critical"
      : broadcast.type === "warning"
        ? "warning"
        : broadcast.type === "promotion"
          ? "portfolio"
          : "info";

  return {
    id: `broadcast:${broadcast.id}`,
    domain: "broadcast",
    severity,
    title: broadcast.title,
    body: broadcast.message,
    badgeLabel,
    badgeVariant,
    tone,
    iconName: "megaphone",
    createdAt: broadcast.created_at,
    targetRoute: broadcast.action_url || "/lembretes",
    channels: ["bell", "reminders_page"],
    entityRefs: [`broadcast:${broadcast.id}`],
    state: broadcast.is_read ? "read" : "unread",
  };
}

function mapSupportTicketToNotification(ticket: SupportTicket): AppNotification {
  return {
    id: `support:${ticket.id}`,
    domain: "system_billing",
    severity: "P1_ACTION_NEEDED",
    title: "Nova resposta do suporte",
    subtitle: ticket.subject ?? undefined,
    body: ticket.admin_reply || ticket.subject || "Chamado atualizado",
    badgeLabel: "Suporte",
    badgeVariant: "default",
    tone: "info",
    iconName: "message-square",
    createdAt: ticket.updated_at,
    targetRoute: "/configuracoes?tab=support",
    channels: ["bell", "reminders_page", "os_push"],
    entityRefs: [`support:${ticket.id}`],
    state: "unread",
  };
}

function extractAdvisorEntityRefs(insight: SmartAdvisorInsight): string[] {
  const id = insight.id;
  if (id.startsWith("bill_overdue:") || id.startsWith("bill_due:")) {
    const parts = id.split(":");
    if (parts[1]) return [`card:${parts[1]}`];
  }
  if (id.startsWith("debt_overdue:") || id.startsWith("debt_due:")) {
    const parts = id.split(":");
    if (parts[1]) return [`debt:${parts[1]}`];
  }
  return [`advisor:${id}`];
}

function mapAdvisorToNotification(insight: SmartAdvisorInsight): AppNotification {
  const id = insight.id;
  const kind = insight.primaryAction?.kind;
  const isFamily =
    id.startsWith("household:") ||
    insight.themeKey?.startsWith("household:") ||
    kind === "navigate_family" ||
    kind === "open_family_settlement";
  const isIncome =
    insight.category === "income" ||
    id.startsWith("expected_income:") ||
    id.startsWith("income_goal:") ||
    kind === "open_income" ||
    kind === "confirm_income" ||
    kind === "open_income_goals";

  const domain: NotificationDomain = isFamily
    ? "family"
    : isIncome
      ? "income"
      : insight.category === "savings"
        ? "portfolio"
        : "cashflow";

  const isDowngradedHeuristicCritical =
    id.startsWith("household:ceiling_exceeded") || id.startsWith("dup:");

  const severity: NotificationSeverity =
    insight.priority === 1 && insight.category === "critical" && !isDowngradedHeuristicCritical
      ? "P0_CRITICAL"
      : insight.priority === 1 || (insight.priority === 2 && insight.category === "critical")
        ? "P1_ACTION_NEEDED"
        : insight.priority === 2
          ? "P2_ADVISORY"
          : "P3_OPPORTUNITY";

  const isIncomeGoal = id.startsWith("income_goal:");
  const badgeLabel = isIncomeGoal
    ? "Meta de receita"
    : isIncome && !isFamily
      ? "Renda prevista"
      : isFamily && insight.category === "income"
        ? "Acerto a receber"
        : isFamily
          ? "Acerto familiar"
          : id.startsWith("missing_expense:")
            ? "Recorrência"
            : id.startsWith("annual:")
              ? "Sazonal"
              : severity === "P0_CRITICAL"
                ? "Crítico"
                : insight.category === "critical"
                  ? "Atenção"
                  : insight.category === "savings"
                    ? "Oportunidade"
                    : "Aviso";

  const badgeVariant: NotificationBadgeVariant =
    badgeLabel === "Crítico" || (isFamily && insight.category === "critical" && severity === "P0_CRITICAL")
      ? "critical"
      : badgeLabel === "Atenção" ||
          badgeLabel === "Recorrência" ||
          badgeLabel === "Meta de receita" ||
          (isFamily && insight.category === "critical")
        ? "warning"
        : badgeLabel === "Renda prevista"
          ? "positive"
          : badgeLabel === "Oportunidade" ||
              badgeLabel === "Sazonal" ||
              badgeLabel === "Acerto a receber"
            ? "portfolio"
            : "default";

  const tone: NotificationTone =
    badgeVariant === "critical"
      ? "critical"
      : badgeVariant === "warning"
        ? "warning"
        : badgeVariant === "positive"
          ? "positive"
          : badgeVariant === "portfolio"
            ? "portfolio"
            : "info";

  const iconName: NotificationIconName = isFamily
    ? "users"
    : isIncome
      ? "wallet"
      : insight.category === "critical"
        ? "alert-triangle"
        : insight.category === "savings"
          ? "trending-up"
          : "sparkles";

  const targetRoute = isFamily
    ? "/familia"
    : kind === "open_income_goals"
      ? "/orcamentos?tab=goals"
      : isIncome
        ? "/receitas"
        : kind === "navigate_aporte"
          ? "/investments?tab=aporte"
          : kind === "set_category_budget"
            ? "/orcamentos?tab=limits"
            : "/despesas";

  return {
    id: `advisor:${insight.id}`,
    domain,
    severity,
    title: insight.title,
    body: insight.description,
    badgeLabel,
    badgeVariant,
    tone,
    iconName,
    amountCents: insight.metadata?.valueCents,
    targetRoute,
    channels:
      insight.priority <= 2
        ? ["bell", "reminders_page", "home_carousel"]
        : ["home_carousel"],
    entityRefs: extractAdvisorEntityRefs(insight),
    state: "unread",
  };
}

/**
 * Deduplica notificações por `id` e por `entityRefs`, priorizando sempre a maior severidade
 * (menor `SEVERITY_RANK`) e mantendo a ordem determinística.
 */
export function deduplicateNotifications(
  notifications: AppNotification[],
): AppNotification[] {
  const sorted = [...notifications].sort((a, b) => {
    const rankDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (rankDiff !== 0) return rankDiff;
    const dueA = a.dueDate ?? "9999-99-99";
    const dueB = b.dueDate ?? "9999-99-99";
    if (dueA !== dueB) return dueA.localeCompare(dueB);
    return a.id.localeCompare(b.id);
  });

  const seenIds = new Set<string>();
  const seenEntityRefs = new Set<string>();
  const deduplicated: AppNotification[] = [];

  for (const notification of sorted) {
    if (seenIds.has(notification.id)) continue;

    const hasConflictingEntity =
      notification.entityRefs.length > 0 &&
      notification.entityRefs.some((ref) => seenEntityRefs.has(ref));

    if (hasConflictingEntity) continue;

    seenIds.add(notification.id);
    for (const ref of notification.entityRefs) {
      seenEntityRefs.add(ref);
    }
    deduplicated.push(notification);
  }

  return deduplicated;
}

function mapClosedBillToNotification(alert: ClosedCardBillAlert): AppNotification {
  const competenceLabel = formatCompetenceMonthPtBr(alert.competenceMonth);
  const dueDateLabel = formatIsoDateShortPtBr(alert.dueDate);
  return {
    id: alert.key,
    domain: "payable",
    severity: "P2_ADVISORY",
    title: `Fatura ${alert.cardName} fechada · ${competenceLabel}`,
    subtitle: `Vencimento em ${dueDateLabel}`,
    body: `Fatura fechada aguardando pagamento até ${dueDateLabel}.`,
    badgeLabel: "Fatura fechada",
    badgeVariant: "default",
    tone: "info",
    iconName: "credit-card",
    amountCents: alert.balanceCents,
    dueDate: alert.dueDate,
    targetRoute: alert.targetRoute,
    channels: ["bell", "reminders_page"],
    entityRefs: [alert.key],
    state: "unread",
  };
}

function mapBudgetOverrunToNotification(alert: BudgetOverrunAlert): AppNotification {
  const names = alert.topCategories.map((c) => c.categoryName).join(", ");
  const title =
    alert.exceededCount === 1
      ? `Orçamento excedido (${alert.topCategories[0]?.categoryName ?? "Categoria"})`
      : `${alert.exceededCount} orçamentos excedidos no mês`;
  const body =
    alert.exceededCount === 1
      ? `Categoria acima do teto definido em ${formatCompetenceMonthPtBr(alert.month)}.`
      : `Excesso concentrado em ${names}.`;

  return {
    id: alert.id,
    domain: "budget_pace",
    severity: "P1_ACTION_NEEDED",
    title,
    body,
    badgeLabel: "Orçamento",
    badgeVariant: "warning",
    tone: "warning",
    iconName: "alert-triangle",
    amountCents: alert.totalExcessCents,
    targetRoute: alert.targetRoute,
    channels: ["bell", "reminders_page"],
    entityRefs: alert.entityRefs,
    state: "unread",
  };
}

function mapTripFamilyToNotification(alert: TripFamilyAlert): AppNotification {
  const isPassiveAdvisory =
    alert.kind === "family_invite" ||
    (alert.kind === "trip_settlement" && alert.settlementPending === false);
  return {
    id: alert.id,
    domain: "family",
    severity: isPassiveAdvisory ? "P2_ADVISORY" : "P1_ACTION_NEEDED",
    title: alert.title,
    body: alert.body,
    badgeLabel: alert.badgeLabel,
    badgeVariant: isPassiveAdvisory ? "default" : "warning",
    tone: isPassiveAdvisory ? "info" : "warning",
    iconName: "users",
    targetRoute: alert.targetRoute,
    channels: ["bell", "reminders_page"],
    entityRefs: alert.entityRefs,
    state: "unread",
  };
}

/**
 * Constrói o estado consolidado, priorizado e deduplicado do Notification Hub.
 */
export function buildNotificationCenter(
  input: BuildNotificationCenterInput,
): NotificationCenterSummary {
  const categoryPrefs = resolveNotificationCategoryPreferences(input.categoryPreferences);
  const rawReminderItems = input.reminderItems ?? [];
  const payableItems = rawReminderItems.filter((item) => item.direction !== "receivable");
  const receivableItems = categoryPrefs.receivablesAndSplits
    ? rawReminderItems.filter((item) => item.direction === "receivable")
    : [];
  const reminderItems = [...payableItems, ...receivableItems];

  const nowMs = Date.now();
  const unreadBroadcasts = (input.broadcasts ?? []).filter((b) => {
    if (b.is_read) return false;
    if (b.expires_at && new Date(b.expires_at).getTime() <= nowMs) return false;
    return true;
  });

  const unreadSupportTickets = (input.supportTickets ?? []).filter(
    (t) =>
      (Boolean(t.admin_reply) && !t.user_read_at) ||
      Boolean((t as { has_unread_user?: boolean }).has_unread_user),
  );

  const pendingSplitSignals = categoryPrefs.receivablesAndSplits
    ? extractPendingSplitSignals(input.splitShares ?? [], nowMs)
    : [];

  const hasPastDueSubscription =
    input.subscription?.status === "past_due" ||
    input.subscription?.status === "unpaid" ||
    (input.subscription as { billingPhase?: string } | null | undefined)?.billingPhase ===
      "past_due";

  const onboardingMissingCount = input.onboardingMissingCount ?? 0;
  const isOnboardingDismissed = Boolean(input.isOnboardingDismissed);
  const showOnboarding = onboardingMissingCount > 0 && !isOnboardingDismissed;

  // Coletar referências de entidades já cobertas por lembretes para não duplicar no SmartAdvisor ou Fechamento
  const reminderEntityRefs = new Set<string>();
  const activeBillKeys = new Set<string>();
  const activeBillCardIds = new Set<string>();
  for (const item of reminderItems) {
    if (item.kind === "bill") {
      activeBillKeys.add(item.key);
      const cardId = extractReminderCardId(item);
      if (cardId) activeBillCardIds.add(cardId);
    }
    for (const ref of extractReminderEntityRefs(item)) {
      reminderEntityRefs.add(ref);
    }
  }

  const closedBillAlerts = categoryPrefs.billClosing
    ? (input.closedBillAlerts ?? []).filter(
        (alert) => !activeBillKeys.has(`bill:${alert.cardId}:${alert.competenceMonth}`),
      )
    : [];

  const budgetOverrunAlert = categoryPrefs.budgetsAndPace
    ? (input.budgetOverrunAlert ?? null)
    : null;

  const tripAndFamilyAlerts = categoryPrefs.familyAndTrips
    ? (input.tripAndFamilyAlerts ?? [])
    : [];

  const advisorAlerts = categoryPrefs.advisorInsights
    ? (input.advisorInsights ?? []).filter((insight) => {
        if (insight.priority > 2) return false;
        const isBudgetOrPace =
          insight.id.startsWith("pace") ||
          insight.id.startsWith("budget") ||
          Boolean(insight.themeKey?.startsWith("pace")) ||
          Boolean(insight.themeKey?.startsWith("budget"));
        if (isBudgetOrPace && !categoryPrefs.budgetsAndPace) return false;
        const isHousehold =
          insight.id.startsWith("household:") ||
          Boolean(insight.themeKey?.startsWith("household:"));
        if (isHousehold && !categoryPrefs.familyAndTrips) return false;
        const refs = extractAdvisorEntityRefs(insight);
        if (refs.some((ref) => reminderEntityRefs.has(ref))) return false;
        if (refs.some((ref) => ref.startsWith("card:") && activeBillCardIds.has(ref.slice("card:".length)))) {
          return false;
        }
        return true;
      })
    : [];

  const rawNotifications: AppNotification[] = [];

  if (hasPastDueSubscription) {
    rawNotifications.push({
      id: "subscription:past_due",
      domain: "system_billing",
      severity: "P0_CRITICAL",
      title: "Pagamento da assinatura pendente",
      body: "Regularize o método de pagamento para manter os recursos Pro ativos sem interrupção.",
      badgeLabel: "Assinatura",
      badgeVariant: "critical",
      tone: "critical",
      iconName: "shield-alert",
      targetRoute: "/configuracoes?tab=subscription",
      channels: ["bell", "reminders_page", "home_carousel", "os_push"],
      entityRefs: ["subscription:past_due"],
      state: "unread",
    });
  }

  for (const item of reminderItems) {
    rawNotifications.push(mapReminderToNotification(item));
  }

  for (const closedAlert of closedBillAlerts) {
    rawNotifications.push(mapClosedBillToNotification(closedAlert));
  }

  if (budgetOverrunAlert) {
    rawNotifications.push(mapBudgetOverrunToNotification(budgetOverrunAlert));
  }

  for (const tfAlert of tripAndFamilyAlerts) {
    rawNotifications.push(mapTripFamilyToNotification(tfAlert));
  }

  for (const signalGroup of pendingSplitSignals) {
    rawNotifications.push({
      id: `split_signal:${signalGroup.shareId}`,
      domain: "split",
      severity: "P1_ACTION_NEEDED",
      title: `Pagamento sinalizado: ${signalGroup.title}`,
      body:
        signalGroup.signals.length === 1
          ? `${signalGroup.signals[0]!.participant_name} sinalizou um pagamento via Pix.`
          : `${signalGroup.signals.length} participantes sinalizaram pagamento via Pix.`,
      badgeLabel: "Pix Sinalizado",
      badgeVariant: "portfolio",
      tone: "portfolio",
      iconName: "hand-coins",
      amountCents: signalGroup.totalCents,
      createdAt: signalGroup.latestNotifiedAt,
      targetRoute: "/dividas",
      channels: ["bell", "reminders_page", "home_carousel", "os_push"],
      entityRefs: [`split:${signalGroup.shareId}`],
      state: "unread",
    });
  }

  for (const broadcast of unreadBroadcasts) {
    rawNotifications.push(mapBroadcastToNotification(broadcast));
  }

  for (const ticket of unreadSupportTickets) {
    rawNotifications.push(mapSupportTicketToNotification(ticket));
  }

  for (const insight of advisorAlerts) {
    rawNotifications.push(mapAdvisorToNotification(insight));
  }

  if (showOnboarding) {
    const completed = input.onboardingCompletedCount ?? 0;
    const total = input.onboardingTotalSteps ?? 4;
    rawNotifications.push({
      id: "onboarding:pending",
      domain: "onboarding",
      severity: "P2_ADVISORY",
      title: "Concluir configuração inicial",
      body: "Finalize os passos iniciais para destravar projeções e alertas precisos.",
      badgeLabel: `${completed}/${total}`,
      badgeVariant: "warning",
      tone: "warning",
      iconName: "sparkles",
      targetRoute: "/configuracoes",
      channels: ["bell"],
      entityRefs: ["onboarding:pending"],
      state: "unread",
    });
  }

  const notifications = deduplicateNotifications(rawNotifications);
  const bellNotifications = notifications.filter((n) => n.channels.includes("bell"));
  const remindersPageNotifications = notifications.filter((n) =>
    n.channels.includes("reminders_page"),
  );

  const criticalCount = bellNotifications.filter(
    (n) => n.severity === "P0_CRITICAL",
  ).length;
  const actionNeededCount = bellNotifications.filter(
    (n) => n.severity === "P1_ACTION_NEEDED",
  ).length;
  const urgentBellCount = criticalCount + actionNeededCount;

  const highestSeverity: NotificationSeverity | null =
    bellNotifications.length > 0 ? bellNotifications[0]!.severity : null;

  return {
    notifications,
    bellNotifications,
    payableItems,
    receivableItems,
    closedBillAlerts,
    budgetOverrunAlert,
    tripAndFamilyAlerts,
    advisorAlerts,
    unreadBroadcasts,
    unreadSupportTickets,
    pendingSplitSignals,
    hasPastDueSubscription,
    showOnboarding,
    totalBellCount: bellNotifications.length,
    totalRemindersPageCount: remindersPageNotifications.length,
    criticalCount,
    actionNeededCount,
    urgentBellCount,
    highestSeverity,
  };
}
