export { criticalAlerts } from "./alerts";
export type { InsightAlert, AlertSeverity, CriticalAlertInput } from "./alerts";
export {
  KNOWN_SERVICES,
  classifySubscription,
  hasStableValue,
  isKnownService,
  isSubscriptionCategory,
  tierOf,
} from "./subscriptions";
export type { CutTier, SubscriptionCandidate, SubscriptionClassification } from "./subscriptions";
export { detectRecurrences } from "./recurrences";
export { ESSENTIAL_CATEGORY_ICONS, normalizeServiceKey, normalizeText, valuesWithinTolerance } from "./shared";
export type { ExpenseLike, RecurrenceOccurrence } from "./recurrences";
export { confidenceScore, historyBonus, varianceOf } from "./confidence";
export type { ConfidenceParams, RecurrenceKind } from "./confidence";
export { applyFeedback } from "./feedback";
export type { FeedbackDecision, FeedbackMap } from "./feedback";
export {
  SAVINGS_HEALTH_LABELS,
  WEEKEND_RATIO_LIMIT,
  incomeConcentration,
  isSignificantTrend,
  savingsHealth,
  weekendSpendingRatio,
} from "./diagnostics";
export type { IncomeConcentration, SavingsHealth } from "./diagnostics";
