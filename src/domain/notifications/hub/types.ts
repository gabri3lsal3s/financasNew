import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import type { ReminderItem } from "@/domain/reminders";
import type {
  NotificationCategoryPreferences,
  PublicShare,
  SplitPaymentSignal,
  SupportTicket,
  UserBroadcastNotification,
  UserSubscription,
} from "@/types";
import type {
  BudgetOverrunAlert,
  ClosedCardBillAlert,
  DividendNotificationAlert,
  TripFamilyAlert,
} from "./event-detectors";

export type NotificationSeverity =
  | "P0_CRITICAL"
  | "P1_ACTION_NEEDED"
  | "P2_ADVISORY"
  | "P3_OPPORTUNITY";

export type NotificationDomain =
  | "payable"
  | "receivable"
  | "split"
  | "budget_pace"
  | "cashflow"
  | "income"
  | "portfolio"
  | "family"
  | "system_billing"
  | "broadcast"
  | "onboarding";

export type NotificationChannel =
  | "bell"
  | "reminders_page"
  | "home_carousel"
  | "os_push"
  | "email_digest";

export type NotificationTone =
  | "critical"
  | "warning"
  | "positive"
  | "portfolio"
  | "info"
  | "muted";

export type NotificationBadgeVariant =
  | "critical"
  | "warning"
  | "positive"
  | "portfolio"
  | "default"
  | "muted";

export type NotificationIconName =
  | "alert-triangle"
  | "credit-card"
  | "file-warning"
  | "hand-coins"
  | "megaphone"
  | "message-square"
  | "sparkles"
  | "shield-alert"
  | "users"
  | "trending-up"
  | "wallet";

export interface PendingSplitSignalSummary {
  shareId: string;
  token: string;
  title: string;
  signals: SplitPaymentSignal[];
  totalCents: number;
  latestNotifiedAt: string;
}

export interface AppNotification {
  /** Unique deterministic key (e.g. `bill:cardId:2026-08`, `debt:id`, `split_signal:shareId`, `broadcast:id`, `support:id`, `advisor:id`, `subscription:past_due`) */
  id: string;
  domain: NotificationDomain;
  severity: NotificationSeverity;
  title: string;
  subtitle?: string;
  body: string;
  badgeLabel: string;
  badgeVariant: NotificationBadgeVariant;
  tone: NotificationTone;
  iconName: NotificationIconName;
  amountCents?: number;
  dueDate?: string;
  createdAt?: string;
  targetRoute: string;
  channels: NotificationChannel[];
  /** Reference IDs used for cross-source deduplication (cardId, debtId, shareId, categoryId) */
  entityRefs: string[];
  state: "unread" | "read" | "snoozed" | "dismissed";
  snoozeUntil?: string | null;
}

export interface BuildNotificationCenterInput {
  reminderItems?: ReminderItem[];
  closedBillAlerts?: ClosedCardBillAlert[];
  budgetOverrunAlert?: BudgetOverrunAlert | null;
  tripAndFamilyAlerts?: TripFamilyAlert[];
  dividendAlerts?: DividendNotificationAlert[];
  categoryPreferences?: NotificationCategoryPreferences | null;
  advisorInsights?: SmartAdvisorInsight[];
  broadcasts?: UserBroadcastNotification[];
  supportTickets?: SupportTicket[];
  splitShares?: PublicShare[];
  subscription?: UserSubscription | null;
  onboardingMissingCount?: number;
  onboardingCompletedCount?: number;
  onboardingTotalSteps?: number;
  isOnboardingDismissed?: boolean;
}

export interface NotificationCenterSummary {
  notifications: AppNotification[];
  bellNotifications: AppNotification[];
  payableItems: ReminderItem[];
  receivableItems: ReminderItem[];
  closedBillAlerts: ClosedCardBillAlert[];
  budgetOverrunAlert: BudgetOverrunAlert | null;
  tripAndFamilyAlerts: TripFamilyAlert[];
  dividendAlerts: DividendNotificationAlert[];
  advisorAlerts: SmartAdvisorInsight[];
  unreadBroadcasts: UserBroadcastNotification[];
  unreadSupportTickets: SupportTicket[];
  pendingSplitSignals: PendingSplitSignalSummary[];
  hasPastDueSubscription: boolean;
  showOnboarding: boolean;
  totalBellCount: number;
  totalRemindersPageCount: number;
  criticalCount: number;
  actionNeededCount: number;
  urgentBellCount: number;
  highestSeverity: NotificationSeverity | null;
}
