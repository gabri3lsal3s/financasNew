export { criticalAlerts } from "./alerts";
export type { InsightAlert, AlertSeverity, CriticalAlertInput } from "./alerts";
export { classifySubscription, findMatchingServiceKey, segmentOf, SERVICE_SEGMENT_LABELS } from "./subscriptions";
export type { CutTier, ServiceSegment, SubscriptionCandidate, SubscriptionClassification } from "./subscriptions";
export {
  detectRecurrences,
  detectIncomeRecurrences,
  calculateTypicalDay,
  estimateNextDueDate,
  calculateRecurringTotals,
  calculateFixedCommitmentRate,
  filterRecurrencesByTab,
  isRecurrenceAlert,
  isSubscriptionRecurrence,
  isFixedBillRecurrence,
  evaluateBudgetImpact,
  classifyPriceAdjustment,
  detectDuplicateChargesInMonth,
  formatBRL,
  VAMPIRE_INCOME_IMPACT_THRESHOLD_PERCENT,
  VAMPIRE_CATEGORY_BUDGET_IMPACT_THRESHOLD_PERCENT,
} from "./recurrences";
export { ESSENTIAL_CATEGORY_ICONS, stripTemporalSuffixes } from "./shared";
export type {
  ExpenseLike,
  IncomeLike,
  IncomeProfile,
  IncomeSuggestedAction,
  RecurringIncomeOccurrence,
  DetectIncomeRecurrencesOptions,
  PriceAdjustment,
  PriceAdjustmentKind,
  RecurrenceOccurrence,
  DetectRecurrencesOptions,
  RecurringTotalsResult,
  BudgetImpactOccurrence,
  BudgetImpactEvaluation,
  RecurrenceFilterTab,
} from "./recurrences";
export { confidenceScore, historyBonus, varianceOf } from "./confidence";
export type { ConfidenceParams, RecurrenceKind } from "./confidence";
export { applyFeedback, partitionFeedback, isOccurrenceIgnored, getDismissReason, QUALIFIED_DISMISS_OPTIONS } from "./feedback";
export type { FeedbackDecision, FeedbackMap, QualifiedDismissReason, QualifiedDismissOption, FeedbackOccurrenceItem } from "./feedback";
export {
  ESSENTIAL_STATUS_LABELS,
  SAVINGS_HEALTH_LABELS,
  WEEKEND_RATIO_LIMIT,
  calculateWeekdayWeekendDailyAverages,
  essentialSpendingRatio,
  incomeConcentration,
  isSignificantTrend,
  savingsHealth,
  weekendSpendingRatio,
} from "./diagnostics";
export type {
  EssentialSpendingResult,
  IncomeConcentration,
  IncomeConcentrationOptions,
  SavingsHealth,
  WeekdayAverageOptions,
  WeekdayTotalItem,
} from "./diagnostics";
export { resolveCategorySemantics, findBestMatchingCategory } from "./category-semantics";
export type { CategorySemantics, CategoryNature } from "./category-semantics";
export {
  generateSmartAdvisorInsights,
  filterAndRankAdvisorInsights,
  SMART_ADVISOR_DISMISSALS_KEY,
  SMART_ADVISOR_LAST_DISMISSED_DAY_KEY,
  DEFAULT_DISMISS_DAYS,
} from "./advisor";
export type {
  SmartAdvisorCategory,
  SmartAdvisorAction,
  SmartAdvisorInsight,
  GenerateSmartAdvisorInsightsInput,
  FilterAndRankAdvisorInsightsOptions,
} from "./advisor";
export {
  getNextInvoiceClosingDate,
  isSubscriptionDueBeforeClosing,
  calculateCardSubscriptionImpact,
  calculateAllCardsSubscriptionImpact,
} from "./card-radar";
export type {
  CardForImpact,
  CardSubscriptionImpactOptions,
  ProjectedSubscriptionItem,
  CardSubscriptionImpact,
} from "./card-radar";
export {
  isBrokerExpense,
  extractBrokerName,
  learnBrokerAportePattern,
} from "./aporte-learning";
export type {
  LearnedBrokerPattern,
  LearnBrokerAportePatternParams,
} from "./aporte-learning";
export {
  detectAnnualCommitments,
  detectWeeklyCommitments,
  MONTH_NAMES_FULL_PTBR,
  DAY_OF_WEEK_LABELS_PTBR,
} from "./extended-periodicity";
export type {
  AnnualCommitment,
  DetectAnnualCommitmentsOptions,
  WeeklyCommitment,
  DetectWeeklyCommitmentsOptions,
} from "./extended-periodicity";
export {
  formatAdvisorThemeKey,
  formatCooldownExpiry,
  MEMORIZED_FEEDBACK_LABELS,
} from "./assistant-memory";
export type { FormattedThemeKey } from "./assistant-memory";




