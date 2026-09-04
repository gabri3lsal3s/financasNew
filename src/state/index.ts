export { useCategories, useAllCategories, useCategoryUsage } from "./queries/use-categories";
export { useActiveCreditCards, useCreditCards } from "./queries/use-credit-cards";
export { useCardPayments, useCardExpenses } from "./queries/use-card-payments";
export { useAllCardExpenses, useAllCardPayments } from "./queries/use-overview";
export { useDebts } from "./queries/use-debts";
export { useBudgets } from "./queries/use-budgets";
export { useIncomeGoals } from "./queries/use-income-goals";
export { useExpenses, useExpense, useExpensesByRange } from "./queries/use-expenses";
export { useIncomes, useIncomesByRange } from "./queries/use-incomes";
export { useRecurrences } from "./queries/use-recurrences";
export { useCreateExpense, useDeleteExpense, useUpdateExpense, useUpdateExpenseGrouped } from "./mutations/use-expense-mutations";
export {
  useCreateIncome,
  useCreateIncomeInstallments,
  useDeleteIncome,
  useUpdateIncome,
  useDeleteIncomeGrouped,
  useUpdateIncomeGrouped,
} from "./mutations/use-income-mutations";
export {
  useCreateRecurrence,
  useDeleteRecurrenceOccurrences,
  useUpdateRecurrenceOccurrences,
} from "./mutations/use-recurrence-mutations";
export {
  useCreateCard,
  useUpdateCard,
  useDeleteCard,
  useCreateCardPayment,
  useCreateRefund,
  useDeleteCardPayment,
  useRefinanceCreditCardBill,
} from "./mutations/use-card-mutations";
export { useImportStatementExpenses, useImportBankTransactions } from "./mutations/use-statement-mutations";
export { useLoans } from "./queries/use-loans";
export {
  useCreateLoanContract,
  useEarlyAmortizeLoan,
  useDeleteLoan,
  useUpdateLoan,
} from "./mutations/use-loan-mutations";
export {
  useCreateDebt,
  useUpdateDebt,
  useDeleteDebt,
  usePayDebt,
  useReceiveDebt,
  useSettleIntegratedReceivable,
} from "./mutations/use-debt-mutations";
export {
  useSetBudgetLimit,
  useRemoveBudgetLimit,
  useSetIncomeGoal,
  useRemoveIncomeGoal,
  useReallocateBudget,
} from "./mutations/use-budget-mutations";
export {
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "./mutations/use-category-mutations";
export { useFeedback, useSetFeedback } from "./queries/use-insight-feedback";
export {
  useReminderStates,
  useSetReminderState,
  useMarkAllRemindersAsRead,
} from "./queries/use-reminder-states";
export { useUserPreferences } from "./queries/use-user-preferences";
export { useUpdateReminderPreferences, useUpdateCustomSettings } from "./mutations/use-preference-mutations";
export { useReminders } from "./queries/use-reminders";
export type { RemindersData } from "./queries/use-reminders";
export {
  usePortfolioAssets,
  useAssetPosition,
  useAllPortfolioTransactions,
  useCreatePortfolioAsset,
  useUpdatePortfolioAsset,
  useDeletePortfolioAsset,
  useUpsertPortfolioAssetsBatch,
  usePortfolioSnapshots,
  useUpsertPortfolioSnapshot,
  usePortfolioContributions,
  useCreatePortfolioContribution,
  useDeletePortfolioContribution,
  useUpsertMarcoZero,
  useCreateHistoricalContribution,
  usePortfolioDividends,
  useCreatePortfolioDividend,
  useDeletePortfolioDividend,
  useCreatePortfolioTransaction,
  useCreatePortfolioTransactionsBatch,
  useUpdatePortfolioTransaction,
  useDeletePortfolioTransaction,
  useRecordOrder,
  useExecutePortfolioBatchAporte,
  reconcileAssetCustody,
  PORTFOLIO_QUERY_KEYS,
} from "./queries/use-portfolio";
export { useAssetPrices, useSetManualPrice, useRemoveManualPrice, useSyncQuotes } from "./queries/use-asset-prices";
export { usePortfolioPosition } from "./queries/use-portfolio-position";
export type { PortfolioPosition, PortfolioPositionRow } from "./queries/use-portfolio-position";
export { useMacroIndicators, type MacroIndicatorsData, MACRO_INDICATORS_QUERY_KEY } from "./queries/use-macro-indicators";

export {
  useAllocationTargets,
  useSaveAllocationTargets,
  useGroupTargets,
  useSaveGroupTarget,
  useRemoveGroupTarget,
} from "./queries/use-allocation";
export {
  useAllocationPresets,
  useCreateAllocationPreset,
  useUpdateAllocationPreset,
  useDeleteAllocationPreset,
} from "./queries/use-allocation-presets";
export { useGlobalSearchEntries } from "./queries/use-search";
export { usePredictionHistory } from "./queries/use-prediction-history";
export { useOnboardingCounts } from "./queries/use-onboarding";

export { useUserAccess, USER_ACCESS_KEY, USER_FEATURES_KEY } from "./queries/use-user-access";
export type { UserAccessResult } from "./queries/use-user-access";

export {
  useAdminMetrics,
  useAdminUsers,
  useAdminFeatures,
  useAdminInvites,
  useAdminAuditLogs,
  useUserOverrides,
  useAdminPlans,
  useAdminUserSubscription,
  useAdminUserModulePermissions,
  ADMIN_METRICS_KEY,
  ADMIN_USERS_KEY,
  ADMIN_FEATURES_KEY,
  ADMIN_INVITES_KEY,
  ADMIN_AUDIT_KEY,
  ADMIN_USER_OVERRIDES_KEY,
  ADMIN_PLANS_KEY,
  ADMIN_USER_SUBSCRIPTION_KEY,
  ADMIN_USER_MODULE_PERMISSIONS_KEY,
} from "./queries/use-admin";


export {
  useAdminUpdateUserStatus,
  useAdminSetUserRole,
  useAdminSetFeatureOverride,
  useAdminRemoveFeatureOverride,
  useAdminToggleGlobalFeature,
  useAdminCreateInvite,
  useAdminRevokeInvite,
  useAdminSetUserSubscription,
  useAdminSetUserModulePermission,
  useAdminRemoveUserModulePermission,
  useAdminCreateModularInvite,
} from "./mutations/use-admin-mutations";

export {
  useCashCheckpoints,
  useLatestCashCheckpoint,
  cashCheckpointsKey,
} from "./queries/use-cash-checkpoints";
export {
  useRealCashBalance,
  type UseRealCashBalanceResult,
} from "./queries/use-real-cash-balance";
export {
  useCreateCashCheckpoint,
  useDeleteCashCheckpoint,
} from "./mutations/use-cash-checkpoint-mutations";
export { useExportData, EXPORT_DATA_QUERY_KEY } from "./queries/use-export-data";
export { useRestoreBackup } from "./mutations/use-restore-backup";

export { useUserSubscription } from "./queries/use-user-subscription";
export { usePermission, type PermissionResult } from "./queries/use-permission";
export type { SubscriptionStatus } from "@/types";
