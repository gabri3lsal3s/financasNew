export { criticalAlerts } from "./alerts";
export type { InsightAlert, AlertSeverity, CriticalAlertInput } from "./alerts";
export { classifySubscription, findMatchingServiceKey, segmentOf, SERVICE_SEGMENT_LABELS } from "./subscriptions";
export type { CutTier, ServiceSegment, SubscriptionCandidate, SubscriptionClassification } from "./subscriptions";
export {
  detectRecurrences,
  detectIncomeRecurrences,
  calculateTypicalDay,
  estimateNextDueDate,
  diffMonths,
  calculateMonthIntervals,
  inferRecurrenceCadence,
  RECURRENCE_CADENCE_LABELS,
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
  evaluateExpensePriceEvolution,
  VAMPIRE_INCOME_IMPACT_THRESHOLD_PERCENT,
  VAMPIRE_CATEGORY_BUDGET_IMPACT_THRESHOLD_PERCENT,
} from "./recurrences";
export { ESSENTIAL_CATEGORY_ICONS, normalizeText, stripTemporalSuffixes } from "./shared";
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
  RecurrenceCadence,
  RecurrenceLifecycle,
  DetectRecurrencesOptions,
  RecurringTotalsResult,
  BudgetImpactOccurrence,
  BudgetImpactEvaluation,
  RecurrenceFilterTab,
  ExpensePriceEvolution,
  ExpensePriceEvolutionItem,
} from "./recurrences";
export { confidenceScore, historyBonus, varianceOf } from "./confidence";
export type { ConfidenceParams, RecurrenceKind } from "./confidence";
export {
  applyFeedback,
  partitionFeedback,
  isOccurrenceIgnored,
  isOccurrenceEssential,
  getDismissReason,
  QUALIFIED_DISMISS_OPTIONS,
  QUALIFIED_CALIBRATION_OPTIONS,
} from "./feedback";
export type {
  FeedbackDecision,
  FeedbackMap,
  QualifiedDismissReason,
  QualifiedDismissOption,
  CalibrationDecision,
  CalibrationOption,
  FeedbackOccurrenceItem,
} from "./feedback";
export {
  ESSENTIAL_STATUS_LABELS,
  SAVINGS_HEALTH_LABELS,
  WEEKEND_RATIO_LIMIT,
  calculateProRataTrend,
  calculateWeekdayWeekendDailyAverages,
  essentialSpendingRatio,
  incomeConcentration,
  isSignificantTrend,
  isWeekendComparisonReliable,
  savingsHealth,
  weekendSpendingRatio,
} from "./diagnostics";
export type {
  EssentialSpendingOptions,
  EssentialSpendingResult,
  IncomeConcentration,
  IncomeConcentrationOptions,
  ProRataTrendResult,
  SavingsHealth,
  WeekdayAverageOptions,
  WeekdayTotalItem,
  WeekendComparisonContext,
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
  INSIGHT_FAMILY_LABELS,
  MEMORIZED_FEEDBACK_LABELS,
  PAYDAY_PATTERN_LABELS,
} from "./assistant-memory";
export type { FormattedThemeKey } from "./assistant-memory";
export { buildMonthlyClosingSummary } from "./monthly-closing";
export type { BuildMonthlyClosingInput, MonthlyClosingSummary } from "./monthly-closing";
export {
  extractHabitClusterKey,
  inferIntentFromDescription,
  INTENT_DESCRIPTORS,
} from "./intent-semantics";
export type {
  IntentKind,
  IntentDescriptor,
  HabitClusterResult,
} from "./intent-semantics";
export {
  detectSpendingHabits,
  MICRO_LEAKAGE_TICKET_CEILING_CENTS,
  MICRO_LEAKAGE_MIN_TOTAL_CENTS,
} from "./habits";
export type {
  SpendingHabit,
  DetectSpendingHabitsOptions,
} from "./habits";
export {
  detectCrossMethodDuplicateSubscriptions,
  computeEndingInstallmentsRelief,
  computeOptimalSurplusAllocation,
} from "./holistic-opportunities";
export type {
  CrossMethodDuplicateSubscription,
  DetectCrossMethodDuplicatesOptions,
  EndingInstallmentExpenseInput,
  EndingInstallmentItem,
  EndingInstallmentsReliefResult,
  OptimalSurplusDestination,
  OptimalSurplusAllocationInput,
  OptimalSurplusAllocationPlan,
} from "./holistic-opportunities";
export {
  buildUnifiedLearningGraph,
  buildTxOneOffKey,
  buildScopedOneOffKey,
  stripOccurrencePrefix,
  inferPaydayProfile,
  estimateUpcomingCycleInflowsCents,
} from "./learning-graph";
export type {
  FeedbackEntry,
  PaydayPattern,
  PaydayProfile,
  InsightThemeFamily,
  SmartDecayRecord,
  LearningMerchantRecordLike,
  LearnedServiceInfo,
  LearningIncomeInput,
  LearningBudgetInput,
  BuildUnifiedLearningGraphInput,
  UnifiedLearningGraph,
} from "./learning-graph";
export {
  buildUserFinancialContext,
  classifyExpensePartitionBucket,
  partitionAndNormalizeCycleExpenses,
  resolveMonthlyReferenceBudget,
  resolveAccountMaturityStage,
} from "./financial-context";
export type {
  AccountMaturityStage,
  ReferenceBudgetSource,
  ExpensePartitionBucket,
  ContextCategoryLike,
  ContextIncomeLike,
  ContextExpenseLike,
  PendingRecurringCommitmentLike,
  NormalizedCycleLens,
  UserFinancialContext,
  BuildUserFinancialContextInput,
  PartitionedExpensesResult,
  MonthlyReferenceBudgetResult,
} from "./financial-context";
export {
  DEFAULT_ATTENTION_BUDGET_POLICY,
  SMART_DECAY_STEPS_DAYS,
  applyHomeCarouselAttentionBudget,
  selectOperationalHomeBanner,
  advanceSmartDecay,
  isFamilyUnderDecay,
  muteInsightFamily,
  unmuteInsightFamily,
} from "./attention-budget";
export type {
  InsightSurfaceLayer,
  InsightTone,
  GovernedInsightItem,
  AttentionBudgetPolicy,
  HomeCarouselBudgetResult,
  OperationalHomeBannerKind,
  OperationalHomeBannerCandidate,
  OperationalHomeBannerPlan,
  SmartDecayEvaluation,
} from "./attention-budget";




