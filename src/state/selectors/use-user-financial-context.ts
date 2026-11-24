import { useEffect, useMemo, useState } from "react";
import { filterExpensesByViewScope, filterIncomesByViewScope } from "@/domain/business";
import { todayISO } from "@/domain/debts";
import {
  buildUserFinancialContext,
  buildUnifiedLearningGraph,
  detectRecurrences,
  stripOccurrencePrefix,
  type FeedbackEntry,
  type PendingRecurringCommitmentLike,
  type RecurrenceOccurrence,
  type UserFinancialContext,
} from "@/domain/insights";
import { mapRawExpensesToAdvisorLikes } from "@/domain/insights/smart-advisor-rules";
import { numberToCents } from "@/domain/money";
import {
  buildPredictedUpcomingCashInflows,
  type OverviewPortfolioPositionLike,
} from "@/domain/overview";
import { contributionsInMonthCents } from "@/domain/portfolio";
import {
  DEFAULT_EMERGENCY_CONFIG,
  resolveEmergencyFundComposition,
  type CashGapInflow,
  type PortfolioPositionRowLike,
} from "@/domain/projection";
import { currentMonth, shiftMonth } from "@/lib/date";
import {
  getMerchantLearningMemory,
  subscribeInsightsReevaluation,
} from "@/services/merchant-learning";
import * as state from "@/state";
import type {
  Budget,
  Category,
  Expense,
  Income,
  IncomeGoal,
  PortfolioContribution,
  Recurrence,
  UserDividendEvent,
  UserPreferences,
  ViewScope,
} from "@/types";

function getOptionalStateHook<TResult>(
  key: string,
  fallback: (...args: unknown[]) => TResult,
): (...args: unknown[]) => TResult {
  if (Reflect.ownKeys(state).includes(key)) {
    const candidate = (state as Record<string, unknown>)[key];
    if (typeof candidate === "function") {
      return candidate as (...args: unknown[]) => TResult;
    }
  }
  return fallback;
}

const EMPTY_INCOMES: readonly Income[] = [];
const EMPTY_EXPENSES: readonly Expense[] = [];
const EMPTY_BUDGETS: readonly Budget[] = [];
const EMPTY_CATEGORIES: readonly Category[] = [];
const EMPTY_RECURRENCES: readonly Recurrence[] = [];
const EMPTY_INCOME_GOALS: readonly IncomeGoal[] = [];
const EMPTY_CONTRIBUTIONS: readonly PortfolioContribution[] = [];
const EMPTY_DIVIDENDS: readonly UserDividendEvent[] = [];

export interface UseUserFinancialContextOptions {
  month?: string;
  todayISO?: string;
  isCurrentMonth?: boolean;
  enabled?: boolean;
  realCashBalanceCents?: number;
  hasCashCheckpoint?: boolean;
  hasCashHistory?: boolean;
  committedObligationsCents?: number;
  safeToSpendCents?: number;
  positionRows?: readonly OverviewPortfolioPositionLike[];
  /** Escopo para apuração do contexto financeiro pessoal/familiar (default 'personal' para blindar Reserva de Emergência). */
  scopeOverride?: ViewScope;
}

export interface UseUserFinancialContextResult {
  context: UserFinancialContext;
  predictedUpcomingInflows: CashGapInflow[];
  detectedRecurrences: RecurrenceOccurrence[];
  isLoading: boolean;
}

/**
 * Seletor reativo compartilhado (camada neutra `src/state/selectors/`) que monta e memoriza
 * o `UserFinancialContext` completo a partir dos dados já cacheados no TanStack Query.
 */
export function useUserFinancialContext(
  options: UseUserFinancialContextOptions = {},
): UseUserFinancialContextResult {
  const month = options.month ?? currentMonth();
  const today = options.todayISO ?? todayISO();
  const isCurrentMonth = options.isCurrentMonth ?? today.slice(0, 7) === month;
  const queryEnabled = options.enabled ?? true;

  const m1 = shiftMonth(month, -1);
  const m2 = shiftMonth(month, -2);
  const m3 = shiftMonth(month, -3);

  const useIncomesSafe = getOptionalStateHook("useIncomes", () => ({
    data: EMPTY_INCOMES,
    isLoading: false,
  }));
  const useExpensesSafe = getOptionalStateHook("useExpenses", () => ({
    data: EMPTY_EXPENSES,
    isLoading: false,
  }));
  const useBudgetsSafe = getOptionalStateHook("useBudgets", () => ({
    data: EMPTY_BUDGETS,
    isLoading: false,
  }));
  const useCategoriesSafe = getOptionalStateHook("useCategories", () => ({
    data: EMPTY_CATEGORIES,
    isLoading: false,
  }));
  const useFeedbackEntriesSafe = getOptionalStateHook("useFeedbackEntries", () => ({
    data: undefined as FeedbackEntry[] | undefined,
    isLoading: false,
  }));
  const useFeedbackSafe = getOptionalStateHook("useFeedback", () => ({
    data: {} as Record<string, FeedbackEntry["decision"]>,
    isLoading: false,
  }));
  const useRecurrencesSafe = getOptionalStateHook("useRecurrences", () => ({
    data: EMPTY_RECURRENCES,
    isLoading: false,
  }));
  const useIncomeGoalsSafe = getOptionalStateHook("useIncomeGoals", () => ({
    data: EMPTY_INCOME_GOALS,
    isLoading: false,
  }));
  const usePortfolioContributionsSafe = getOptionalStateHook("usePortfolioContributions", () => ({
    data: EMPTY_CONTRIBUTIONS,
    isLoading: false,
  }));
  const useCorporateDividendsSafe = getOptionalStateHook("useCorporateDividends", () => ({
    recentlySettled: EMPTY_DIVIDENDS,
    fxRate: 1,
    isLoading: false,
  }));
  const useUserPreferencesSafe = getOptionalStateHook("useUserPreferences", () => ({
    data: null as UserPreferences | null,
    isLoading: false,
  }));
  const useUserAccessSafe = getOptionalStateHook("useUserAccess", () => ({
    hasFeature: (() => true) as (feature?: string) => boolean,
  }));
  const useRealCashBalanceSafe = getOptionalStateHook("useRealCashBalance", () => ({
    cashBalance: {
      currentBalanceCents: 0,
      latestCheckpoint: null,
      inflowSinceCheckpointCents: 0,
      outflowSinceCheckpointCents: 0,
      eventsSinceCheckpoint: [],
    },
    safeToSpend: {
      committedObligationsCents: 0,
      safeToSpendCents: 0,
    },
    isLoading: false,
  }));
  const usePortfolioPositionSafe = getOptionalStateHook("usePortfolioPosition", () => ({
    rows: [] as OverviewPortfolioPositionLike[],
    isLoading: false,
  }));
  const m0IncomesQ = useIncomesSafe(month, { enabled: queryEnabled });
  const m1IncomesQ = useIncomesSafe(m1, { enabled: queryEnabled });
  const m2IncomesQ = useIncomesSafe(m2, { enabled: queryEnabled });
  const m3IncomesQ = useIncomesSafe(m3, { enabled: queryEnabled });

  const m0ExpensesQ = useExpensesSafe(month, { enabled: queryEnabled });
  const m1ExpensesQ = useExpensesSafe(m1, { enabled: queryEnabled });
  const m2ExpensesQ = useExpensesSafe(m2, { enabled: queryEnabled });
  const m3ExpensesQ = useExpensesSafe(m3, { enabled: queryEnabled });

  const budgetsQ = useBudgetsSafe();
  const categoriesQ = useCategoriesSafe(undefined, { enabled: queryEnabled });
  const expenseCategoriesQ = useCategoriesSafe("expense", { enabled: queryEnabled });
  const incomeCategoriesQ = useCategoriesSafe("income", { enabled: queryEnabled });
  const feedbackEntriesQ = useFeedbackEntriesSafe();
  const feedbackMapQ = useFeedbackSafe();
  const recurrencesQ = useRecurrencesSafe();
  const incomeGoalsQ = useIncomeGoalsSafe();
  const contributionsQ = usePortfolioContributionsSafe();
  const userPrefsQ = useUserPreferencesSafe();
  const access = useUserAccessSafe();
  const hasInvestmentsAccess =
    typeof access?.hasFeature === "function" ? access.hasFeature("investments") : true;
  const corporateDividendsQ = useCorporateDividendsSafe({
    enabled: queryEnabled && hasInvestmentsAccess,
  });

  const realCashFallbackQ = useRealCashBalanceSafe(isCurrentMonth ? today : `${month}-01`);
  const portfolioPositionFallbackQ = usePortfolioPositionSafe();

  const [merchantVersion, setMerchantVersion] = useState(0);
  useEffect(
    () =>
      subscribeInsightsReevaluation(() => {
        setMerchantVersion((v) => v + 1);
      }),
    [],
  );

  // Contexto financeiro pessoal da família (Reserva de Emergência, taxa de poupança e custo de vida)
  // deve SEMPRE filtrar por 'personal' por padrão para não contaminar o orçamento doméstico com compras PJ.
  const targetScope: ViewScope = options.scopeOverride ?? "personal";

  const m0Incomes = useMemo(
    () => filterIncomesByViewScope(m0IncomesQ?.data ?? EMPTY_INCOMES, targetScope, { mode: "dre" }),
    [m0IncomesQ?.data, targetScope],
  );
  const m1Incomes = useMemo(
    () => filterIncomesByViewScope(m1IncomesQ?.data ?? EMPTY_INCOMES, targetScope, { mode: "dre" }),
    [m1IncomesQ?.data, targetScope],
  );
  const m2Incomes = useMemo(
    () => filterIncomesByViewScope(m2IncomesQ?.data ?? EMPTY_INCOMES, targetScope, { mode: "dre" }),
    [m2IncomesQ?.data, targetScope],
  );
  const m3Incomes = useMemo(
    () => filterIncomesByViewScope(m3IncomesQ?.data ?? EMPTY_INCOMES, targetScope, { mode: "dre" }),
    [m3IncomesQ?.data, targetScope],
  );

  const m0Expenses = useMemo(
    () => filterExpensesByViewScope(m0ExpensesQ?.data ?? EMPTY_EXPENSES, targetScope, { mode: "dre" }),
    [m0ExpensesQ?.data, targetScope],
  );
  const m1Expenses = useMemo(
    () => filterExpensesByViewScope(m1ExpensesQ?.data ?? EMPTY_EXPENSES, targetScope, { mode: "dre" }),
    [m1ExpensesQ?.data, targetScope],
  );
  const m2Expenses = useMemo(
    () => filterExpensesByViewScope(m2ExpensesQ?.data ?? EMPTY_EXPENSES, targetScope, { mode: "dre" }),
    [m2ExpensesQ?.data, targetScope],
  );
  const m3Expenses = useMemo(
    () => filterExpensesByViewScope(m3ExpensesQ?.data ?? EMPTY_EXPENSES, targetScope, { mode: "dre" }),
    [m3ExpensesQ?.data, targetScope],
  );

  const budgets = useMemo(() => budgetsQ?.data ?? EMPTY_BUDGETS, [budgetsQ?.data]);
  const categories = useMemo(() => {
    const direct = categoriesQ?.data ?? [];
    if (direct.length > 0) return direct;
    const combined = [
      ...(expenseCategoriesQ?.data ?? []),
      ...(incomeCategoriesQ?.data ?? []),
    ];
    if (combined.length === 0) return EMPTY_CATEGORIES;
    const map = new Map<string, Category>();
    for (const c of combined) {
      if (c && c.id && !map.has(c.id)) {
        map.set(c.id, c);
      }
    }
    return Array.from(map.values());
  }, [categoriesQ?.data, expenseCategoriesQ?.data, incomeCategoriesQ?.data]);
  const recurrences = useMemo(() => recurrencesQ?.data ?? EMPTY_RECURRENCES, [recurrencesQ?.data]);
  const incomeGoals = useMemo(() => incomeGoalsQ?.data ?? EMPTY_INCOME_GOALS, [incomeGoalsQ?.data]);
  const contributions = useMemo(
    () => contributionsQ?.data ?? EMPTY_CONTRIBUTIONS,
    [contributionsQ?.data],
  );
  const userPrefs = userPrefsQ?.data ?? null;

  const feedbackEntries = useMemo<FeedbackEntry[]>(() => {
    if (Array.isArray(feedbackEntriesQ?.data)) {
      return feedbackEntriesQ.data;
    }
    const rawMap = feedbackMapQ?.data ?? {};
    return Object.entries(rawMap).map(([occurrenceKey, decision]) => ({
      occurrenceKey,
      decision,
      createdAt: null,
    }));
  }, [feedbackEntriesQ?.data, feedbackMapQ?.data]);

  const effectiveRealCashBalanceCents =
    options.realCashBalanceCents ?? realCashFallbackQ?.cashBalance?.currentBalanceCents ?? 0;
  const effectiveHasCheckpoint =
    options.hasCashCheckpoint ?? realCashFallbackQ?.cashBalance?.latestCheckpoint !== null;
  const effectiveHasCashHistory =
    options.hasCashHistory ??
    Boolean(
      (realCashFallbackQ?.cashBalance?.inflowSinceCheckpointCents ?? 0) > 0 ||
        (realCashFallbackQ?.cashBalance?.outflowSinceCheckpointCents ?? 0) > 0 ||
        (realCashFallbackQ?.cashBalance?.eventsSinceCheckpoint?.length ?? 0) > 0,
    );
  const effectiveCommittedObligationsCents =
    options.committedObligationsCents ??
    realCashFallbackQ?.safeToSpend?.committedObligationsCents ??
    0;
  const effectiveSafeToSpendCents =
    options.safeToSpendCents ?? realCashFallbackQ?.safeToSpend?.safeToSpendCents ?? 0;

  const effectivePositionRows = useMemo(
    () => options.positionRows ?? portfolioPositionFallbackQ?.rows ?? [],
    [options.positionRows, portfolioPositionFallbackQ?.rows],
  );

  const { context, predictedUpcomingInflows, detectedRecurrences } = useMemo(() => {
    const seenIncomeIds = new Set(m0Incomes.map((i) => i.id));
    const historicalIncomes: Income[] = [];
    for (const bucket of [m3Incomes, m2Incomes, m1Incomes]) {
      for (const inc of bucket) {
        if (seenIncomeIds.has(inc.id)) continue;
        seenIncomeIds.add(inc.id);
        historicalIncomes.push(inc);
      }
    }

    const seenExpenseIds = new Set(m0Expenses.map((e) => e.id));
    const filterHistoricalBucket = (bucket: readonly Expense[], targetMonth: string): Expense[] => {
      const out: Expense[] = [];
      for (const exp of bucket) {
        if (seenExpenseIds.has(exp.id)) continue;
        if (exp.date && exp.date.slice(0, 7) !== targetMonth) continue;
        seenExpenseIds.add(exp.id);
        out.push(exp);
      }
      return out;
    };

    const hist1 = filterHistoricalBucket(m1Expenses, m1);
    const hist2 = filterHistoricalBucket(m2Expenses, m2);
    const hist3 = filterHistoricalBucket(m3Expenses, m3);

    const incomeGoalsForMonthCents = incomeGoals
      .filter((g) => g.month === month)
      .reduce((acc, g) => acc + Math.max(0, numberToCents(g.expected)), 0);

    const localMerchantMemory = getMerchantLearningMemory();
    const cloudMerchantLearning = userPrefs?.custom_settings?.merchantLearning as
      | Record<string, { friendlyName?: string; rawAliases?: readonly string[] }>
      | undefined;
    const mergedMerchantLearning = {
      ...(cloudMerchantLearning ?? {}),
      ...localMerchantMemory,
    };

    const learning = buildUnifiedLearningGraph({
      referenceMonth: month,
      feedbackEntries,
      budgets,
      merchantLearning: mergedMerchantLearning,
      historicalIncomes: [...historicalIncomes, ...m0Incomes],
      incomeGoalsForMonthCents,
      decayByFamily: userPrefs?.custom_settings?.advisorDecayMeta,
    });

    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const advisorExpenseLikes = mapRawExpensesToAdvisorLikes(
      [
        { data: m0Expenses, month },
        { data: hist1, month: m1 },
        { data: hist2, month: m2 },
        { data: hist3, month: m3 },
      ],
      categoryById,
    );

    const detected = detectRecurrences(advisorExpenseLikes, {
      todayISO: today,
      includeFormalRecurrences: true,
      merchantAliasMap: learning.merchantAliasMap,
    });

    const knownRecurringKeys = new Set<string>();
    const recurringCommitments: PendingRecurringCommitmentLike[] = [];
    const coveredFormalIds = new Set<string>();

    for (const occ of detected) {
      knownRecurringKeys.add(occ.key);
      const stripped = stripOccurrencePrefix(occ.key);
      if (stripped) knownRecurringKeys.add(stripped);

      if (occ.expenses) {
        for (const exp of occ.expenses) {
          if (exp.recurrenceId) coveredFormalIds.add(exp.recurrenceId);
        }
      }

      if (occ.lifecycle === "lapsed") continue;

      const alreadyPaidThisMonth =
        occ.months.includes(month) ||
        (!occ.missingThisMonth &&
          Boolean(occ.nextDueDate && occ.nextDueDate.slice(0, 7) > month));

      recurringCommitments.push({
        key: occ.key,
        amountCents: occ.averageCents,
        isFormal: Boolean(occ.isFormalRecurrence),
        alreadyPaidThisMonth,
      });
    }

    // Garante inclusão de recorrências formais ativas recém-criadas que ainda não geraram histórico em 2+ meses
    for (const rec of recurrences) {
      if (!rec.is_active || rec.kind !== "expense") continue;
      if (coveredFormalIds.has(rec.id)) continue;
      if (rec.start_date.slice(0, 7) > month) continue;
      if (rec.end_date && rec.end_date.slice(0, 7) < month) continue;

      const paidInMonth = m0Expenses.some((e) => e.recurrence_id === rec.id);
      const amountCents = numberToCents(rec.value * (rec.report_weight ?? 1));
      if (amountCents <= 0) continue;

      recurringCommitments.push({
        key: `formal_rec:${rec.id}`,
        amountCents,
        isFormal: true,
        alreadyPaidThisMonth: paidInMonth,
      });
      if (rec.description) {
        const cleanDesc = stripOccurrencePrefix(rec.description);
        if (cleanDesc) knownRecurringKeys.add(cleanDesc);
      }
    }

    const emergencyConfig = {
      ...DEFAULT_EMERGENCY_CONFIG,
      ...(userPrefs?.custom_settings?.emergencyFundConfig ?? {}),
    };

    const portfolioRowsForReserve: PortfolioPositionRowLike[] = effectivePositionRows.map((row) => {
      const candidate = row as OverviewPortfolioPositionLike & Partial<PortfolioPositionRowLike>;
      return {
        assetId: candidate.assetId,
        ticker: candidate.ticker,
        assetClass: candidate.assetClass,
        quantity: candidate.quantity,
        valueBRL: candidate.valueBRL,
        netValueBRL: candidate.netValueBRL,
        isCash: candidate.isCash,
        isMatured: candidate.isMatured,
        maturityDate: candidate.maturityDate,
      };
    });

    const reserveComposition = resolveEmergencyFundComposition({
      config: emergencyConfig,
      realCashCents: Math.max(0, effectiveRealCashBalanceCents),
      portfolioRows: portfolioRowsForReserve,
    });

    const monthlyContributionsCents = contributionsInMonthCents(contributions, month);
    const fxRate = corporateDividendsQ?.fxRate ?? 1;
    const monthlySettledDividendsCents = (corporateDividendsQ?.recentlySettled ?? [])
      .filter((ev) => {
        if (ev.status !== "SETTLED") return false;
        const settledDate = ev.payment_date ?? ev.com_date;
        return Boolean(settledDate && settledDate.startsWith(month));
      })
      .reduce((acc, ev) => {
        const rate = ev.currency === "USD" ? (ev.fx_rate_applied ?? fxRate) : 1;
        return acc + numberToCents(ev.net_amount * rate);
      }, 0);

    const builtContext = buildUserFinancialContext({
      month,
      todayISO: today,
      isCurrentMonth,
      monthIncomes: m0Incomes,
      monthExpenses: m0Expenses,
      historicalIncomes,
      historicalExpensesByMonth: [hist1, hist2, hist3],
      categories,
      learning,
      knownRecurringKeys,
      recurringCommitments,
      incomeGoalsForMonthCents,
      liquidity: {
        hasCheckpoint: effectiveHasCheckpoint,
        hasCashHistory: effectiveHasCashHistory,
        realCashBalanceCents: effectiveRealCashBalanceCents,
        committedObligationsCents: effectiveCommittedObligationsCents,
        safeToSpendCents: effectiveSafeToSpendCents,
      },
      wealth: {
        hasInvestmentsAccess,
        monthlyContributionsCents,
        monthlySettledDividendsCents,
        emergencyReserveCents: reserveComposition.totalReserveCents,
        emergencyTargetMonths: emergencyConfig.targetMonths ?? 6,
        hasExternalEmergencyFund: Boolean(emergencyConfig.hasExternalEmergencyFund),
      },
    });

    const activeFormalIncomeRecurrences = recurrences.filter(
      (rec) => rec.is_active && rec.kind === "income",
    );

    const inflows = buildPredictedUpcomingCashInflows({
      month,
      today,
      isCurrentMonth,
      monthIncomes: m0Incomes,
      paydayProfile: builtContext.learning.paydayProfile,
      expectedUpcomingInflowsCents: builtContext.lens.liquidity.expectedUpcomingInflowsCents,
      formalIncomeRecurrences: activeFormalIncomeRecurrences,
    });

    return {
      context: builtContext,
      predictedUpcomingInflows: inflows,
      detectedRecurrences: detected,
    };
    // `merchantVersion` força recomputação quando o usuário registra novo alias em tempo de sessão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    month,
    today,
    isCurrentMonth,
    m1,
    m2,
    m3,
    m0Incomes,
    m1Incomes,
    m2Incomes,
    m3Incomes,
    m0Expenses,
    m1Expenses,
    m2Expenses,
    m3Expenses,
    budgets,
    categories,
    feedbackEntries,
    recurrences,
    incomeGoals,
    contributions,
    corporateDividendsQ?.recentlySettled,
    corporateDividendsQ?.fxRate,
    userPrefs,
    effectiveRealCashBalanceCents,
    effectiveHasCheckpoint,
    effectiveHasCashHistory,
    effectiveCommittedObligationsCents,
    effectiveSafeToSpendCents,
    effectivePositionRows,
    hasInvestmentsAccess,
    merchantVersion,
  ]);

  const isLoading = Boolean(
    m0IncomesQ?.isLoading ||
      m0ExpensesQ?.isLoading ||
      categoriesQ?.isLoading ||
      (options.realCashBalanceCents === undefined && realCashFallbackQ?.isLoading) ||
      (options.positionRows === undefined && portfolioPositionFallbackQ?.isLoading),
  );

  return {
    context,
    predictedUpcomingInflows,
    detectedRecurrences,
    isLoading,
  };
}
