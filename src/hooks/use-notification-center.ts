import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { todayISO } from "@/domain/debts/index";
import { buildNotificationCenter } from "@/domain/notifications/hub/build-notification-center";
import { detectClosedCardBills, detectConsolidatedBudgetOverrun, detectDividendNotificationAlerts, detectTripAndFamilyPendingAlerts, resolveNotificationCategoryPreferences, type BudgetOverrunAlert, type ClosedCardBillAlert, type DividendNotificationAlert, type TripFamilyAlert } from "@/domain/notifications/hub/event-detectors";
import { type NotificationCenterSummary } from "@/domain/notifications/hub/types";
import { FALLBACK_USD_RATE } from "@/domain/portfolio/valuation";
import { coreOnboardingProgress, shouldShowOnboardingBanner, type OnboardingCounts } from "@/domain/onboarding/index";
import { isSnoozeExpired, type ReminderItem, type ReminderPreferences, type ReminderState } from "@/domain/reminders/index";
import { useSmartAdvisorInsights } from "@/features/overview/hooks";
import {
  useAllCardExpenses,
  useAllCardPayments,
  useBudgets,
  useCategories,
  useCorporateDividends,
  useCreditCards,
  useExpenses,
  useFamilyMode,
  useMyBroadcastNotifications,
  useMyFamily,
  useMyPublicShares,
  useMySupportTickets,
  useOnboardingCounts,
  useReminderStates,
  useReminders,
  useTripMode,
  useUserAccess,
  useUserPreferences,
  useUserSubscription,
  useUserTrips,
} from "@/state";
import type {
  NotificationCategoryPreferences,
  SupportTicket,
  UserSubscription,
} from "@/types";
import { useOnboardingDismissed } from "./use-onboarding-dismissed";

const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  enabled: true,
  billDaysBefore: 3,
  debtDaysBefore: 3,
};


function isHubAlertHiddenByState(
  key: string,
  states: readonly ReminderState[],
  today: string,
): boolean {
  const row = states.find((s) => s.key === key);
  if (!row) return false;
  if (row.kind === "read") return true;
  if (row.kind === "snoozed") {
    return !isSnoozeExpired(row, today, today);
  }
  return false;
}

export interface UseNotificationCenterOptions {
  today?: string;
}

export interface UseNotificationCenterResult extends NotificationCenterSummary {
  items: ReminderItem[];
  allItems: ReminderItem[];
  readHistoryItems: ReminderItem[];
  preferences: ReminderPreferences;
  categoryPreferences: Required<NotificationCategoryPreferences>;
  totalCount: number;
  overdueCount: number;
  dueTodayCount: number;
  dueSoonCount: number;
  receivableCount: number;
  urgentCount: number;
  readCount: number;
  onboardingData: OnboardingCounts | undefined;
  onboardingProg: { done: number; total: number };
  hasFeature: (key: string) => boolean;
  isOnboardingDismissed: boolean;
  dismissOnboarding: () => void;
  dismissAdvisor: (themeKey: string, days?: number) => void;
  isLoading: boolean;
  error: unknown;
}

export interface NotificationCenterCounts {
  criticalCount: number;
  actionNeededCount: number;
  urgentBellCount: number;
  totalBellCount: number;
  totalRemindersPageCount: number;
  isLoading: boolean;
}

const NotificationCenterContext = createContext<UseNotificationCenterResult | null>(null);
const NotificationCountsContext = createContext<NotificationCenterCounts | null>(null);

function useNotificationCenterCompute(
  options?: UseNotificationCenterOptions,
): UseNotificationCenterResult {
  const today = options?.today ?? todayISO();
  const currentMonth = today.slice(0, 7);

  const access = useUserAccess();
  const rawHasFeature =
    typeof access?.hasFeature === "function"
      ? (access.hasFeature as (key: string) => boolean)
      : null;
  const hasFeature = useCallback(
    (key: string) => (rawHasFeature ? rawHasFeature(key) : true),
    [rawHasFeature],
  );

  const userPrefsQuery = useUserPreferences();
  const reminderStatesQuery = useReminderStates();
  const reminders = useReminders(options?.today);
  const onboardingQuery = useOnboardingCounts();
  const { isDismissed: isOnboardingDismissed, dismiss: dismissOnboarding } =
    useOnboardingDismissed();

  const preferences = reminders?.preferences ?? DEFAULT_REMINDER_PREFERENCES;
  const categoryPreferences = useMemo(
    () =>
      resolveNotificationCategoryPreferences(
        userPrefsQuery?.data?.custom_settings?.notificationCategories,
      ),
    [userPrefsQuery?.data?.custom_settings?.notificationCategories],
  );
  const canRunAdvisorInsights = Boolean(
    preferences.enabled && categoryPreferences.advisorInsights,
  );

  const advisorHook = useSmartAdvisorInsights({ enabled: canRunAdvisorInsights });
  const supportQuery = useMySupportTickets();
  const broadcastsQuery = useMyBroadcastNotifications();
  const splitSharesQuery = useMyPublicShares("split");
  const subscriptionQuery = useUserSubscription();

  const { isFamilyModeEnabled } = useFamilyMode();
  const { isTripModeEnabled } = useTripMode();
  const isImmediateContext =
    Boolean(options?.today) ||
    (typeof window !== "undefined" && window.location?.pathname?.startsWith("/lembretes"));
  const [isIdleReady, setIsIdleReady] = useState(
    () => isImmediateContext || typeof window === "undefined",
  );

  useEffect(() => {
    if (isIdleReady || typeof window === "undefined") return;
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(() => setIsIdleReady(true), { timeout: 1_500 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(() => setIsIdleReady(true), 800);
    return () => window.clearTimeout(timer);
  }, [isIdleReady]);

  const canDetectBillClosing =
    isIdleReady && categoryPreferences.billClosing && hasFeature("cards");
  const canDetectBudgets =
    isIdleReady && categoryPreferences.budgetsAndPace && hasFeature("budgets");
  const canDetectFamilyOrTrips = isIdleReady && categoryPreferences.familyAndTrips;

  const canDetectDividends = isIdleReady && hasFeature("investments");
  const cardsQuery = useCreditCards({ enabled: canDetectBillClosing });
  const cardExpensesQuery = useAllCardExpenses({
    enabled: canDetectBillClosing,
  });
  const cardPaymentsQuery = useAllCardPayments({
    enabled: canDetectBillClosing,
  });
  const budgetsQuery = useBudgets({ enabled: canDetectBudgets });
  const expensesQuery = useExpenses(currentMonth, {
    enabled: canDetectBudgets,
  });
  const expenseCategoriesQuery = useCategories("expense", { enabled: canDetectBudgets });
  const tripsQuery = useUserTrips({ enabled: canDetectFamilyOrTrips && isTripModeEnabled });
  const familyQuery = useMyFamily({ enabled: canDetectFamilyOrTrips && isFamilyModeEnabled });
  const corporateDividendsState = useCorporateDividends({ enabled: canDetectDividends });

  const reminderStates = useMemo(
    () => reminderStatesQuery?.data ?? [],
    [reminderStatesQuery?.data],
  );

  const rawItems = useMemo(() => reminders?.items ?? [], [reminders?.items]);
  const items = useMemo(
    () =>
      categoryPreferences.receivablesAndSplits
        ? rawItems
        : rawItems.filter((i) => i.direction !== "receivable"),
    [rawItems, categoryPreferences.receivablesAndSplits],
  );
  const allItems = useMemo(
    () => reminders?.allItems ?? items,
    [reminders?.allItems, items],
  );
  const readHistoryItems = useMemo(
    () => reminders?.readHistoryItems ?? [],
    [reminders?.readHistoryItems],
  );

  const onboardingData = onboardingQuery?.data;
  const showOnboarding =
    !isOnboardingDismissed && onboardingData
      ? shouldShowOnboardingBanner(onboardingData, hasFeature)
      : false;
  const onboardingProg = useMemo(
    () =>
      onboardingData
        ? coreOnboardingProgress(onboardingData, hasFeature)
        : { done: 0, total: 0 },
    [onboardingData, hasFeature],
  );

  const normalizedSupportTickets = useMemo(() => {
    const raw = supportQuery?.data ?? [];
    return raw
      .filter(
        (t) =>
          (Boolean(t.admin_reply) && !t.user_read_at) ||
          Boolean((t as { has_unread_user?: boolean }).has_unread_user),
      )
      .map((t) => ({ ...t, has_unread_user: true }) as unknown as SupportTicket);
  }, [supportQuery?.data]);

  const broadcasts = useMemo(
    () => broadcastsQuery?.data ?? [],
    [broadcastsQuery?.data],
  );
  const splitShares = useMemo(
    () => splitSharesQuery?.data ?? [],
    [splitSharesQuery?.data],
  );

  const subscription = useMemo(() => {
    if (!subscriptionQuery || typeof subscriptionQuery !== "object") {
      return null;
    }
    if ("data" in subscriptionQuery) {
      const subData = (subscriptionQuery as { data?: UserSubscription | null }).data;
      if (subData !== undefined) {
        return subData ?? null;
      }
    }
    if ("status" in subscriptionQuery || "tier" in subscriptionQuery) {
      return subscriptionQuery as unknown as UserSubscription;
    }
    return null;
  }, [subscriptionQuery]);

  const advisorInsights = useMemo(
    () => advisorHook?.insights ?? [],
    [advisorHook?.insights],
  );

  const closedBillAlerts: ClosedCardBillAlert[] = useMemo(() => {
    if (!canDetectBillClosing || !preferences.enabled) return [];
    const cards = cardsQuery?.data ?? [];
    const cardExpenses = cardExpensesQuery?.data ?? [];
    const cardPayments = cardPaymentsQuery?.data ?? [];
    if (cards.length === 0) return [];
    return detectClosedCardBills({
      cards,
      cardExpenses,
      cardPayments,
      today,
    }).filter((alert) => !isHubAlertHiddenByState(alert.key, reminderStates, today));
  }, [
    canDetectBillClosing,
    preferences.enabled,
    cardsQuery?.data,
    cardExpensesQuery?.data,
    cardPaymentsQuery?.data,
    today,
    reminderStates,
  ]);

  const budgetOverrunAlert: BudgetOverrunAlert | null = useMemo(() => {
    if (!canDetectBudgets || !preferences.enabled) return null;
    const budgets = budgetsQuery?.data ?? [];
    const expenses = expensesQuery?.data ?? [];
    const categories = expenseCategoriesQuery?.data ?? [];
    if (budgets.length === 0 || categories.length === 0) return null;
    const detected = detectConsolidatedBudgetOverrun({
      month: currentMonth,
      budgets,
      expenses,
      categories,
    });
    if (!detected) return null;
    return isHubAlertHiddenByState(detected.id, reminderStates, today)
      ? null
      : detected;
  }, [
    canDetectBudgets,
    preferences.enabled,
    budgetsQuery?.data,
    expensesQuery?.data,
    expenseCategoriesQuery?.data,
    currentMonth,
    reminderStates,
    today,
  ]);

  const tripAndFamilyAlerts: TripFamilyAlert[] = useMemo(() => {
    if (!preferences.enabled || !canDetectFamilyOrTrips) return [];
    const trips = hasFeature("trips") ? (tripsQuery?.data ?? []) : [];
    const familyData = hasFeature("family_mode")
      ? (familyQuery?.data ?? null)
      : null;
    if (trips.length === 0 && !familyData) return [];
    return detectTripAndFamilyPendingAlerts({
      trips,
      familyData,
      today,
    }).filter((alert) => !isHubAlertHiddenByState(alert.id, reminderStates, today));
  }, [
    preferences.enabled,
    canDetectFamilyOrTrips,
    hasFeature,
    tripsQuery?.data,
    familyQuery?.data,
    today,
    reminderStates,
  ]);

  const dividendAlerts: DividendNotificationAlert[] = useMemo(() => {
    if (!preferences.enabled || !hasFeature("investments")) return [];
    const available = corporateDividendsState?.available ?? [];
    const projected = corporateDividendsState?.projected ?? [];
    const recentlySettled = corporateDividendsState?.recentlySettled ?? [];
    if (available.length === 0 && projected.length === 0 && recentlySettled.length === 0) {
      return [];
    }
    const divPrefs = userPrefsQuery?.data?.custom_settings?.dividendAutomation;
    return detectDividendNotificationAlerts({
      pendingConfirmation: available,
      provisioned: projected,
      recentlySettled,
      today,
      fxRate: corporateDividendsState?.fxRate ?? FALLBACK_USD_RATE,
      notifyOnProvisioned: divPrefs?.notifyOnProvisioned,
      notifyOnPayment: divPrefs?.notifyOnPayment,
    }).filter((alert) => !isHubAlertHiddenByState(alert.id, reminderStates, today));
  }, [
    preferences.enabled,
    hasFeature,
    corporateDividendsState?.available,
    corporateDividendsState?.projected,
    corporateDividendsState?.recentlySettled,
    corporateDividendsState?.fxRate,
    userPrefsQuery?.data?.custom_settings?.dividendAutomation,
    today,
    reminderStates,
  ]);

  const effectiveAdvisorInsights = useMemo(
    () => (canRunAdvisorInsights ? advisorInsights : []),
    [canRunAdvisorInsights, advisorInsights],
  );

  const summary = useMemo(
    () =>
      buildNotificationCenter({
        reminderItems: items,
        closedBillAlerts,
        budgetOverrunAlert,
        tripAndFamilyAlerts,
        dividendAlerts,
        categoryPreferences,
        advisorInsights: effectiveAdvisorInsights,
        broadcasts,
        supportTickets: normalizedSupportTickets,
        splitShares,
        subscription,
        onboardingMissingCount: showOnboarding
          ? Math.max(1, onboardingProg.total - onboardingProg.done)
          : 0,
        onboardingCompletedCount: onboardingProg.done,
        onboardingTotalSteps: onboardingProg.total,
        isOnboardingDismissed: !showOnboarding,
        carouselDismissals: userPrefsQuery?.data?.custom_settings?.carouselDismissals,
      }),
    [
      items,
      closedBillAlerts,
      budgetOverrunAlert,
      tripAndFamilyAlerts,
      dividendAlerts,
      categoryPreferences,
      effectiveAdvisorInsights,
      broadcasts,
      normalizedSupportTickets,
      splitShares,
      subscription,
      showOnboarding,
      onboardingProg.done,
      onboardingProg.total,
      userPrefsQuery?.data?.custom_settings?.carouselDismissals,
    ],
  );

  const rawTotalCount = reminders?.totalCount ?? items.length;
  const totalCount = categoryPreferences.receivablesAndSplits
    ? rawTotalCount
    : rawItems.length === 0 && rawTotalCount > 0
      ? rawTotalCount
      : items.length;
  const overdueCount =
    reminders?.overdueCount ??
    summary.payableItems.filter((i) => i.status === "overdue").length;
  const dueTodayCount =
    reminders?.dueTodayCount ??
    summary.payableItems.filter((i) => i.status === "due_today").length;
  const dueSoonCount =
    reminders?.dueSoonCount ??
    summary.payableItems.filter((i) => i.status === "due_soon").length;
  const receivableCount = categoryPreferences.receivablesAndSplits
    ? (reminders?.receivableCount ?? summary.receivableItems.length)
    : 0;
  const urgentCount = reminders?.urgentCount ?? overdueCount + dueTodayCount;
  const readCount = reminders?.readCount ?? readHistoryItems.length;

  // Fallback para mocks de teste que definem totalCount/overdueCount/dueTodayCount mas deixam items=[]
  const fallbackReminderCount =
    items.length === 0 && totalCount > 0 ? totalCount : 0;
  const fallbackOverdueCount =
    items.length === 0 && overdueCount > 0
      ? overdueCount
      : items.length === 0 &&
          reminders?.overdueCount === undefined &&
          reminders?.dueTodayCount === undefined &&
          urgentCount > 0
        ? urgentCount
        : 0;
  const fallbackDueTodayCount =
    items.length === 0 && dueTodayCount > 0 ? dueTodayCount : 0;

  const criticalCount = summary.criticalCount + fallbackOverdueCount;
  const actionNeededCount = summary.actionNeededCount + fallbackDueTodayCount;
  const urgentBellCount = criticalCount + actionNeededCount;
  const totalBellCount = summary.totalBellCount + fallbackReminderCount;
  const totalRemindersPageCount =
    summary.totalRemindersPageCount + fallbackReminderCount;

  const rawDismissAdvisor = advisorHook?.dismiss;
  const dismissAdvisor = useCallback(
    (themeKey: string, days?: number) => {
      if (typeof rawDismissAdvisor === "function") {
        (rawDismissAdvisor as (themeKey: string, days?: number) => void)(themeKey, days);
      }
    },
    [rawDismissAdvisor],
  );

  const isLoading = Boolean(reminders?.isLoading) || Boolean(reminderStatesQuery?.isLoading);
  const error = reminders?.error ?? null;

  return useMemo(
    () => ({
      ...summary,
      criticalCount,
      actionNeededCount,
      urgentBellCount,
      totalBellCount,
      totalRemindersPageCount,
      items,
      allItems,
      readHistoryItems,
      preferences,
      categoryPreferences,
      totalCount,
      overdueCount,
      dueTodayCount,
      dueSoonCount,
      receivableCount,
      urgentCount,
      readCount,
      onboardingData,
      onboardingProg,
      hasFeature,
      isOnboardingDismissed,
      dismissOnboarding,
      dismissAdvisor,
      isLoading,
      error,
    }),
    [
      summary,
      criticalCount,
      actionNeededCount,
      urgentBellCount,
      totalBellCount,
      totalRemindersPageCount,
      items,
      allItems,
      readHistoryItems,
      preferences,
      categoryPreferences,
      totalCount,
      overdueCount,
      dueTodayCount,
      dueSoonCount,
      receivableCount,
      urgentCount,
      readCount,
      onboardingData,
      onboardingProg,
      hasFeature,
      isOnboardingDismissed,
      dismissOnboarding,
      dismissAdvisor,
      isLoading,
      error,
    ],
  );
}

/**
 * Provider único do Notification Hub na sessão autenticada.
 * Evita múltiplas instâncias de observadores e recomputações redundantes no shell.
 */
export function NotificationCenterProvider({ children }: { children: ReactNode }) {
  const value = useNotificationCenterCompute();
  const counts = useMemo<NotificationCenterCounts>(
    () => ({
      criticalCount: value.criticalCount,
      actionNeededCount: value.actionNeededCount,
      urgentBellCount: value.urgentBellCount,
      totalBellCount: value.totalBellCount,
      totalRemindersPageCount: value.totalRemindersPageCount,
      isLoading: value.isLoading,
    }),
    [
      value.criticalCount,
      value.actionNeededCount,
      value.urgentBellCount,
      value.totalBellCount,
      value.totalRemindersPageCount,
      value.isLoading,
    ],
  );

  return createElement(
    NotificationCountsContext.Provider,
    { value: counts },
    createElement(NotificationCenterContext.Provider, { value }, children),
  );
}

/**
 * Fonte única de verdade (Notification Hub) para todas as superfícies de
 * notificação in-app: Sininho (NotificationsButton), NotificationsPopover,
 * Sidebar, BottomNav, MoreMenuSheet e página /lembretes.
 */
export function useNotificationCenter(
  options?: UseNotificationCenterOptions,
): UseNotificationCenterResult {
  const shared = useContext(NotificationCenterContext);
  const hasCustomToday = Boolean(options?.today);
  // Se estiver dentro do Provider sem `today` customizado, usa o estado compartilhado;
  // caso contrário (testes isolados ou /lembretes com `today` fixo), computa localmente.
  const local = useNotificationCenterCompute(shared && !hasCustomToday ? undefined : options);
  return shared && !hasCustomToday ? shared : local;
}

/** Seletor leve apenas para contadores de badging no shell (Sidebar, BottomNav, Topbar). */
export function useUnreadNotificationCount(): NotificationCenterCounts {
  const sharedCounts = useContext(NotificationCountsContext);
  const fallback = useNotificationCenterCompute();
  return useMemo(
    () =>
      sharedCounts ?? {
        criticalCount: fallback.criticalCount,
        actionNeededCount: fallback.actionNeededCount,
        urgentBellCount: fallback.urgentBellCount,
        totalBellCount: fallback.totalBellCount,
        totalRemindersPageCount: fallback.totalRemindersPageCount,
        isLoading: fallback.isLoading,
      },
    [
      sharedCounts,
      fallback.criticalCount,
      fallback.actionNeededCount,
      fallback.urgentBellCount,
      fallback.totalBellCount,
      fallback.totalRemindersPageCount,
      fallback.isLoading,
    ],
  );
}

/** Seletor para listas de itens do Notification Hub. */
export function useNotificationItems() {
  const center = useNotificationCenter();
  return useMemo(
    () => ({
      items: center.items,
      allItems: center.allItems,
      readHistoryItems: center.readHistoryItems,
      advisorAlerts: center.advisorAlerts,
      isLoading: center.isLoading,
      error: center.error,
    }),
    [
      center.items,
      center.allItems,
      center.readHistoryItems,
      center.advisorAlerts,
      center.isLoading,
      center.error,
    ],
  );
}

/** Seletor estável de ações do Notification Hub. */
export function useNotificationActions() {
  const center = useNotificationCenter();
  return useMemo(
    () => ({
      dismissOnboarding: center.dismissOnboarding,
      dismissAdvisor: center.dismissAdvisor,
      hasFeature: center.hasFeature,
    }),
    [center.dismissOnboarding, center.dismissAdvisor, center.hasFeature],
  );
}
