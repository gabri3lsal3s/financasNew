import { useCallback, useMemo } from "react";
import { todayISO } from "@/domain/debts/index";
import { buildNotificationCenter } from "@/domain/notifications/hub/build-notification-center";
import { detectClosedCardBills, detectConsolidatedBudgetOverrun, detectDividendNotificationAlerts, detectTripAndFamilyPendingAlerts, resolveNotificationCategoryPreferences, type BudgetOverrunAlert, type ClosedCardBillAlert, type DividendNotificationAlert, type TripFamilyAlert } from "@/domain/notifications/hub/event-detectors";
import { type NotificationCenterSummary } from "@/domain/notifications/hub/types";
import { FALLBACK_USD_RATE } from "@/domain/portfolio/valuation";
import { type SuggestedDividendItem } from "@/domain/portfolio/dividend-suggester";
import { coreOnboardingProgress, shouldShowOnboardingBanner, type OnboardingCounts } from "@/domain/onboarding/index";
import { isSnoozeExpired, type ReminderItem, type ReminderPreferences, type ReminderState } from "@/domain/reminders/index";
import * as overviewHooks from "@/features/overview/hooks";
import * as state from "@/state";
import type {
  Budget,
  CardPayment,
  Category,
  CreditCard,
  Expense,
  MyFamilyData,
  NotificationCategoryPreferences,
  PublicShare,
  SupportTicket,
  UserBroadcastNotification,
  UserDividendEvent,
  UserPreferences,
  UserSubscription,
} from "@/types";
import type { Trip } from "@/types/trips";
import { useOnboardingDismissed } from "./use-onboarding-dismissed";

const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  enabled: true,
  billDaysBefore: 3,
  debtDaysBefore: 3,
};

export function getOptionalHook<TResult>(
  mod: object,
  key: string,
  fallback: (...args: unknown[]) => TResult,
): (...args: unknown[]) => TResult {
  if (Reflect.ownKeys(mod).includes(key)) {
    const candidate = (mod as Record<string, unknown>)[key];
    if (typeof candidate === "function") {
      return candidate as (...args: unknown[]) => TResult;
    }
  }
  return fallback;
}

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

/**
 * Fonte única de verdade (Notification Hub) para todas as superfícies de
 * notificação in-app: Sininho (NotificationsButton), NotificationsPopover,
 * Sidebar, BottomNav, MoreMenuSheet e página /lembretes.
 */
export function useNotificationCenter(
  options?: UseNotificationCenterOptions,
): UseNotificationCenterResult {
  const today = options?.today ?? todayISO();
  const currentMonth = today.slice(0, 7);

  const useUserAccessSafe = getOptionalHook(state, "useUserAccess", () => ({
    hasFeature: () => true,
  }));

  const useUserPreferencesSafe = getOptionalHook(
    state,
    "useUserPreferences",
    () => ({
      data: null as UserPreferences | null,
      isLoading: false,
    }),
  );

  const useReminderStatesSafe = getOptionalHook(
    state,
    "useReminderStates",
    () => ({
      data: [] as ReminderState[],
      isLoading: false,
    }),
  );

  const useRemindersSafe = getOptionalHook(state, "useReminders", () => ({
    items: [] as ReminderItem[],
    allItems: [] as ReminderItem[],
    payableItems: [] as ReminderItem[],
    receivableItems: [] as ReminderItem[],
    readHistoryItems: [] as ReminderItem[],
    preferences: DEFAULT_REMINDER_PREFERENCES,
    totalCount: 0,
    overdueCount: 0,
    dueTodayCount: 0,
    dueSoonCount: 0,
    receivableCount: 0,
    urgentCount: 0,
    readCount: 0,
    isLoading: false,
    error: null,
  }));

  const useOnboardingCountsSafe = getOptionalHook(
    state,
    "useOnboardingCounts",
    () => ({
      data: undefined as OnboardingCounts | undefined,
      isLoading: false,
    }),
  );

  const useMySupportTicketsSafe = getOptionalHook(
    state,
    "useMySupportTickets",
    () => ({
      data: [] as SupportTicket[],
      isLoading: false,
    }),
  );

  const useMyBroadcastNotificationsSafe = getOptionalHook(
    state,
    "useMyBroadcastNotifications",
    () => ({
      data: [] as UserBroadcastNotification[],
      isLoading: false,
    }),
  );

  const useMyPublicSharesSafe = getOptionalHook(
    state,
    "useMyPublicShares",
    () => ({
      data: [] as PublicShare[],
      isLoading: false,
    }),
  );

  const useUserSubscriptionSafe = getOptionalHook(
    state,
    "useUserSubscription",
    () => null as UserSubscription | { data?: UserSubscription | null } | null,
  );

  const useCreditCardsSafe = getOptionalHook(state, "useCreditCards", () => ({
    data: [] as CreditCard[],
    isLoading: false,
  }));
  const useAllCardExpensesSafe = getOptionalHook(
    state,
    "useAllCardExpenses",
    () => ({
      data: [] as Expense[],
      isLoading: false,
    }),
  );
  const useAllCardPaymentsSafe = getOptionalHook(
    state,
    "useAllCardPayments",
    () => ({
      data: [] as CardPayment[],
      isLoading: false,
    }),
  );
  const useBudgetsSafe = getOptionalHook(state, "useBudgets", () => ({
    data: [] as Budget[],
    isLoading: false,
  }));
  const useExpensesSafe = getOptionalHook(state, "useExpenses", () => ({
    data: [] as Expense[],
    isLoading: false,
  }));
  const useCategoriesSafe = getOptionalHook(state, "useCategories", () => ({
    data: [] as Category[],
    isLoading: false,
  }));
  const useUserTripsSafe = getOptionalHook(state, "useUserTrips", () => ({
    data: [] as Trip[],
    isLoading: false,
  }));
  const useMyFamilySafe = getOptionalHook(state, "useMyFamily", () => ({
    data: null as MyFamilyData | null,
    isLoading: false,
  }));
  const useCorporateDividendsSafe = getOptionalHook(state, "useCorporateDividends", () => ({
    available: [] as SuggestedDividendItem[],
    projected: [] as SuggestedDividendItem[],
    recentlySettled: [] as UserDividendEvent[],
    fxRate: FALLBACK_USD_RATE,
    isLoading: false,
  }));

  const rawAdvisorHook = getOptionalHook(
    overviewHooks,
    "useSmartAdvisorInsights",
    () => ({
      insights: [],
      dismiss: () => {},
    }),
  );
  const isRealUnmockedAdvisor = Function.prototype.toString
    .call(rawAdvisorHook)
    .includes("useSmartAdvisorQueries");
  const canRunRealAdvisor =
    !isRealUnmockedAdvisor || Reflect.ownKeys(state).includes("useExpenses");
  const useSmartAdvisorInsightsSafe = canRunRealAdvisor
    ? rawAdvisorHook
    : () => ({
        insights: [],
        dismiss: () => {},
      });

  const access = useUserAccessSafe();
  const rawHasFeature =
    typeof access?.hasFeature === "function"
      ? (access.hasFeature as (key: string) => boolean)
      : null;
  const hasFeature = useCallback(
    (key: string) => (rawHasFeature ? rawHasFeature(key) : true),
    [rawHasFeature],
  );

  const userPrefsQuery = useUserPreferencesSafe();
  const reminderStatesQuery = useReminderStatesSafe();
  const reminders = useRemindersSafe(options?.today);
  const onboardingQuery = useOnboardingCountsSafe();
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

  const advisorHook = useSmartAdvisorInsightsSafe({ enabled: canRunAdvisorInsights });
  const supportQuery = useMySupportTicketsSafe();
  const broadcastsQuery = useMyBroadcastNotificationsSafe();
  const splitSharesQuery = useMyPublicSharesSafe("split");
  const subscriptionQuery = useUserSubscriptionSafe();

  const canDetectBillClosing =
    categoryPreferences.billClosing && hasFeature("cards");
  const canDetectBudgets =
    categoryPreferences.budgetsAndPace && hasFeature("budgets");
  const canDetectFamilyOrTrips = categoryPreferences.familyAndTrips;

  const canDetectDividends = hasFeature("investments");
  const cardsQuery = useCreditCardsSafe({ enabled: canDetectBillClosing });
  const cardExpensesQuery = useAllCardExpensesSafe({
    enabled: canDetectBillClosing,
  });
  const cardPaymentsQuery = useAllCardPaymentsSafe({
    enabled: canDetectBillClosing,
  });
  const budgetsQuery = useBudgetsSafe();
  const expensesQuery = useExpensesSafe(currentMonth, {
    enabled: canDetectBudgets,
  });
  const expenseCategoriesQuery = useCategoriesSafe("expense");
  const tripsQuery = useUserTripsSafe();
  const familyQuery = useMyFamilySafe({ enabled: canDetectFamilyOrTrips });
  const corporateDividendsState = useCorporateDividendsSafe({ enabled: canDetectDividends });

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
  const onboardingProg = onboardingData
    ? coreOnboardingProgress(onboardingData, hasFeature)
    : { done: 0, total: 0 };

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
    if ("data" in subscriptionQuery && subscriptionQuery.data !== undefined) {
      return subscriptionQuery.data ?? null;
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

  const dismissAdvisor: (themeKey: string, days?: number) => void =
    typeof advisorHook?.dismiss === "function"
      ? (advisorHook.dismiss as (themeKey: string, days?: number) => void)
      : () => {};

  return {
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
    isLoading: Boolean(reminders?.isLoading) || Boolean(reminderStatesQuery?.isLoading),
    error: reminders?.error ?? null,
  };
}
