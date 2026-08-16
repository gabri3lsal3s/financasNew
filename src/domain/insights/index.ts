export { criticalAlerts } from "./alerts";
export type { InsightAlert, AlertSeverity, CriticalAlertInput } from "./alerts";
export { classifySubscription, segmentOf, SERVICE_SEGMENT_LABELS } from "./subscriptions";
export type { CutTier, ServiceSegment, SubscriptionCandidate, SubscriptionClassification } from "./subscriptions";
export { detectRecurrences, calculateTypicalDay, estimateNextDueDate } from "./recurrences";
export { ESSENTIAL_CATEGORY_ICONS } from "./shared";
export type { ExpenseLike, PriceAdjustment, RecurrenceOccurrence, DetectRecurrencesOptions } from "./recurrences";
export { confidenceScore, historyBonus, varianceOf } from "./confidence";
export type { ConfidenceParams, RecurrenceKind } from "./confidence";
export { applyFeedback, partitionFeedback } from "./feedback";
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

