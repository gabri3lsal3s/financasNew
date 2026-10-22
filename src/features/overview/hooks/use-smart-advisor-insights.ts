import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { currentMonth, shiftMonth, todayLocalIso } from "@/lib/date";
import { budgetLimitsByCategory, resolveEffectiveLimit } from "@/domain/budgets";
import { numberToCents, sumGrossCents } from "@/domain/money";
import {
  detectIncomeRecurrences,
  detectRecurrences,
  type ExpenseLike,
  type IncomeLike,
} from "@/domain/insights/recurrences";
import type { FeedbackMap } from "@/domain/insights/feedback";
import { normalizeText } from "@/domain/insights/shared";
import {
  DEFAULT_DISMISS_DAYS,
  filterAndRankAdvisorInsights,
  generateSmartAdvisorInsights,
  SMART_ADVISOR_DISMISSALS_KEY,
  SMART_ADVISOR_LAST_DISMISSED_DAY_KEY,
  type SmartAdvisorInsight,
} from "@/domain/insights/advisor";
import {
  useBudgets,
  useCategories,
  useCreateIncome,
  useExpenses,
  useFeedback,
  useIncomes,
  useSetFeedback,
} from "@/state";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import type { Budget, Category } from "@/types";

let memoryDismissals: Record<string, number> = {};
let memoryLastDismissedDay: string | null = null;
let storageInitialized = false;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((fn) => fn());
}

function initStorageIfNeeded() {
  if (storageInitialized) return;
  if (typeof window === "undefined" || !window.localStorage) {
    storageInitialized = true;
    return;
  }
  try {
    const raw = window.localStorage.getItem(SMART_ADVISOR_DISMISSALS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, number>;
      const now = Date.now();
      const valid: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "number" && v > now) {
          valid[k] = v;
        }
      }
      memoryDismissals = valid;
    }
  } catch {
    memoryDismissals = {};
  }

  try {
    memoryLastDismissedDay = window.localStorage.getItem(SMART_ADVISOR_LAST_DISMISSED_DAY_KEY);
  } catch {
    memoryLastDismissedDay = null;
  }
  storageInitialized = true;
}

function getDismissalsSnapshot(): Record<string, number> {
  initStorageIfNeeded();
  return memoryDismissals;
}

function getLastDismissedDaySnapshot(): string | null {
  initStorageIfNeeded();
  return memoryLastDismissedDay;
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function resetSmartAdvisorCooldowns() {
  memoryDismissals = {};
  memoryLastDismissedDay = null;
  storageInitialized = true;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(SMART_ADVISOR_DISMISSALS_KEY);
      window.localStorage.removeItem(SMART_ADVISOR_LAST_DISMISSED_DAY_KEY);
    } catch {
      // Ignora erro
    }
  }
  notifySubscribers();
}

export interface UseSmartAdvisorInsightsOptions {
  /** Mês de referência YYYY-MM (padrão: mês corrente). */
  month?: string;
  /** Data de referência ISO YYYY-MM-DD (padrão: hoje no fuso local). */
  todayISO?: string;
  /** Timestamp atual em milissegundos (padrão: Date.now()). */
  nowMs?: number;
  /** Despesas pré-carregadas ou mockadas. Se fornecido, pula queries de despesas. */
  expenses?: readonly ExpenseLike[];
  /** Rendas pré-carregadas ou mockadas. Se fornecido, pula queries de rendas. */
  incomes?: readonly IncomeLike[];
  /** Categorias pré-carregadas ou mockadas. */
  categories?: readonly Category[];
  /** Orçamentos pré-carregados ou mockados. */
  budgets?: readonly Budget[];
  /** Feedback pré-carregado ou mockado. */
  feedbackMap?: FeedbackMap;
  /** Dismissals iniciais injetados diretamente (ignora localStorage). */
  initialDismissals?: Record<string, number>;
  /** Último dia dispensado inicial injetado diretamente (ignora localStorage). */
  initialLastDismissedDay?: string;
  /** Se as queries internas devem ser ativadas. */
  enabled?: boolean;
}

export interface UseSmartAdvisorInsightsResult {
  /** Insight priorizado a ser exibido no card da Home, ou null se dispensado/regular. */
  insight: SmartAdvisorInsight | null;
  /** Todos os candidatos gerados antes do ranqueamento e filtros de discrição. */
  allCandidates: SmartAdvisorInsight[];
  /** Indica se os dados necessários estão sendo carregados. */
  isLoading: boolean;
  /** Indica se houve erro em alguma das consultas. */
  isError: boolean;
  /** Erro disparado por alguma das consultas, se houver. */
  error: unknown;
  /** Dispensa o insight atual ou um tema específico por N dias (padrão 30) e silencia hoje. */
  dismiss: (themeKey?: string, days?: number) => void;
  /** Confirma o monitoramento contínuo de uma recorrência (ensina o motor). */
  confirmRecurrence: (occurrenceKey: string) => Promise<void>;
  /** Ignora uma despesa recorrente pontual (ensina o motor). */
  ignoreRecurrence: (occurrenceKey: string) => Promise<void>;
  /** Confirma recebimento de renda em 1 clique e cria a entrada correspondente. */
  confirmIncome: (payload: {
    name: string;
    valueCents: number;
    categoryId: string;
    date?: string;
  }) => Promise<void>;
  /** Atualiza manualmente os dados do assistente. */
  refetch: () => Promise<void>;
}

/**
 * Hook unificado do Assistente Proativo de Insights (SmartAdvisor).
 *
 * Cruza dados dos últimos 4 meses de despesas e rendas, orçamentos e feedback do usuário,
 * aplicando a Matriz Canônica de Prioridades (1. Crítica -> 2. Entrada -> 3. Economia -> 4. Calibração)
 * e as Regras de Discrição Antirruído (máximo de 1 insight por dia, cooldown de 30 dias por tema).
 */
export function useSmartAdvisorInsights(
  options: UseSmartAdvisorInsightsOptions = {},
): UseSmartAdvisorInsightsResult {
  const refMonth = options.month ?? currentMonth();
  const todayISOStr = options.todayISO ?? todayLocalIso();
  const [defaultNowMs] = useState(() => Date.now());
  const nowMs = options.nowMs ?? defaultNowMs;

  const queryEnabled = options.enabled ?? (options.expenses == null || options.incomes == null);

  // Queries dos últimos 4 meses
  const month0Expenses = useExpenses(refMonth, { enabled: queryEnabled });
  const month1Expenses = useExpenses(shiftMonth(refMonth, -1), { enabled: queryEnabled });
  const month2Expenses = useExpenses(shiftMonth(refMonth, -2), { enabled: queryEnabled });
  const month3Expenses = useExpenses(shiftMonth(refMonth, -3), { enabled: queryEnabled });

  const month0Incomes = useIncomes(refMonth, { enabled: queryEnabled });
  const month1Incomes = useIncomes(shiftMonth(refMonth, -1), { enabled: queryEnabled });
  const month2Incomes = useIncomes(shiftMonth(refMonth, -2), { enabled: queryEnabled });
  const month3Incomes = useIncomes(shiftMonth(refMonth, -3), { enabled: queryEnabled });

  const budgetsQuery = useBudgets();
  const categoriesQuery = useCategories();
  const feedbackQuery = useFeedback();

  const setFeedbackMutation = useSetFeedback();
  const createIncomeMutation = useCreateIncome();

  // Estados locais para injeção em testes (opcional)
  const [localDismissals, setLocalDismissals] = useState<Record<string, number> | undefined>(
    options.initialDismissals,
  );
  const [localLastDismissedDay, setLocalLastDismissedDay] = useState<string | undefined>(
    options.initialLastDismissedDay,
  );

  // External store com snapshot do localStorage
  const storeDismissals = useSyncExternalStore(subscribe, getDismissalsSnapshot, () => ({}));
  const storeLastDismissedDay = useSyncExternalStore(subscribe, getLastDismissedDaySnapshot, () => null);

  const effectiveDismissals = localDismissals ?? storeDismissals;
  const effectiveLastDismissedDay = localLastDismissedDay ?? storeLastDismissedDay;

  // Montagem das categorias
  const categories = useMemo(
    () => options.categories ?? categoriesQuery.data ?? [],
    [options.categories, categoriesQuery.data],
  );
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const m0ExpData = month0Expenses.data;
  const m1ExpData = month1Expenses.data;
  const m2ExpData = month2Expenses.data;
  const m3ExpData = month3Expenses.data;

  // Montagem das despesas dos últimos 4 meses
  const allExpenses = useMemo<readonly ExpenseLike[]>(() => {
    if (options.expenses) return options.expenses;

    const queryDataList = [m0ExpData, m1ExpData, m2ExpData, m3ExpData];
    return queryDataList.flatMap((data, index) =>
      (data ?? []).map((e) => ({
        id: e.id,
        description: e.description,
        date: e.date,
        month: shiftMonth(refMonth, -index),
        valueCents: numberToCents(e.value * (e.report_weight ?? 1.0)),
        categoryId: e.category_id,
        categoryName: categoryById.get(e.category_id)?.name ?? null,
        categoryIcon: categoryById.get(e.category_id)?.icon ?? null,
        installmentGroupId: e.installment_group_id,
        recurrenceId: e.recurrence_id,
      })),
    );
  }, [
    options.expenses,
    m0ExpData,
    m1ExpData,
    m2ExpData,
    m3ExpData,
    refMonth,
    categoryById,
  ]);

  const m0IncData = month0Incomes.data;
  const m1IncData = month1Incomes.data;
  const m2IncData = month2Incomes.data;
  const m3IncData = month3Incomes.data;

  // Montagem das rendas dos últimos 4 meses
  const allIncomes = useMemo<readonly IncomeLike[]>(() => {
    if (options.incomes) return options.incomes;

    const queryDataList = [m0IncData, m1IncData, m2IncData, m3IncData];
    return queryDataList.flatMap((data, index) =>
      (data ?? []).map((i) => ({
        id: i.id,
        description: i.description,
        date: i.date,
        month: shiftMonth(refMonth, -index),
        valueCents: numberToCents(i.value * (i.report_weight ?? 1.0)),
        categoryId: i.category_id,
        categoryName: categoryById.get(i.category_id)?.name ?? null,
        categoryIcon: categoryById.get(i.category_id)?.icon ?? null,
        installmentGroupId: i.installment_group_id,
        recurrenceId: i.recurrence_id,
      })),
    );
  }, [
    options.incomes,
    m0IncData,
    m1IncData,
    m2IncData,
    m3IncData,
    refMonth,
    categoryById,
  ]);

  // Orçamentos por categoria e renda mensal corrente
  const budgets = useMemo(
    () => options.budgets ?? budgetsQuery.data ?? [],
    [options.budgets, budgetsQuery.data],
  );

  const categoryBudgetsMap = useMemo(() => {
    const limitsByCategory = budgetLimitsByCategory(budgets);
    const map = new Map<string, number>();
    for (const cat of categories) {
      const limitCents = resolveEffectiveLimit(limitsByCategory.get(cat.id) ?? [], refMonth);
      if (limitCents > 0) {
        map.set(cat.id, limitCents);
      }
    }
    return map;
  }, [budgets, categories, refMonth]);

  const monthlyIncomeCents = useMemo(() => {
    if (options.incomes) {
      const current = options.incomes.filter((i) => i.month === refMonth);
      return current.reduce((sum, item) => sum + item.valueCents, 0);
    }
    return sumGrossCents(month0Incomes.data ?? []);
  }, [options.incomes, refMonth, month0Incomes.data]);

  // Feedback do usuário
  const feedbackMap: FeedbackMap = useMemo(() => {
    if (options.feedbackMap) return options.feedbackMap;
    return (feedbackQuery.data ?? {}) as FeedbackMap;
  }, [options.feedbackMap, feedbackQuery.data]);

  // Candidatos e ranqueamento
  const { allCandidates, rankedInsight } = useMemo(() => {
    const occurrences = detectRecurrences(allExpenses, {
      todayISO: todayISOStr,
      monthlyIncomeCents,
      categoryBudgets: categoryBudgetsMap,
    });

    const incomeOccurrences = detectIncomeRecurrences(allIncomes, {
      todayISO: todayISOStr,
    });

    const candidates = generateSmartAdvisorInsights({
      occurrences,
      incomes: incomeOccurrences,
      feedbackMap,
      todayISO: todayISOStr,
    });

    const ranked = filterAndRankAdvisorInsights(candidates, {
      dismissals: effectiveDismissals,
      lastDismissedDay: effectiveLastDismissedDay ?? undefined,
      currentDayISO: todayISOStr,
      nowMs,
    });

    return { allCandidates: candidates, rankedInsight: ranked };
  }, [
    allExpenses,
    allIncomes,
    todayISOStr,
    monthlyIncomeCents,
    categoryBudgetsMap,
    feedbackMap,
    effectiveDismissals,
    effectiveLastDismissedDay,
    nowMs,
  ]);

  // Ação de dispensa com cooldown
  const dismiss = useCallback(
    (themeKey?: string, days = DEFAULT_DISMISS_DAYS) => {
      const effectiveDay = todayISOStr;
      const keyToDismiss = themeKey ?? rankedInsight?.themeKey;

      if (localDismissals !== undefined || localLastDismissedDay !== undefined) {
        setLocalLastDismissedDay(effectiveDay);
        if (keyToDismiss) {
          const expiry = nowMs + days * 24 * 60 * 60 * 1000;
          setLocalDismissals((prev) => ({ ...(prev ?? {}), [keyToDismiss]: expiry }));
        }
      } else {
        initStorageIfNeeded();
        memoryLastDismissedDay = effectiveDay;
        if (keyToDismiss) {
          const expiry = nowMs + days * 24 * 60 * 60 * 1000;
          memoryDismissals = {
            ...memoryDismissals,
            [keyToDismiss]: expiry,
          };
        }

        if (typeof window !== "undefined" && window.localStorage) {
          try {
            window.localStorage.setItem(SMART_ADVISOR_LAST_DISMISSED_DAY_KEY, effectiveDay);
            if (keyToDismiss) {
              window.localStorage.setItem(
                SMART_ADVISOR_DISMISSALS_KEY,
                JSON.stringify(memoryDismissals),
              );
            }
          } catch {
            // Ignora erro de cota no localStorage
          }
        }
        notifySubscribers();
      }

      triggerSensory("action");
    },
    [todayISOStr, rankedInsight?.themeKey, localDismissals, localLastDismissedDay, nowMs],
  );

  // Confirmação de recorrência (calibração)
  const confirmRecurrence = useCallback(
    async (occurrenceKey: string) => {
      await setFeedbackMutation.mutateAsync({
        occurrenceKey,
        decision: "confirm",
      });
      triggerSensory("success");
      pushToast({
        title: "Recorrência confirmada",
        description: "O motor agora monitora esse gasto como fixo.",
      });
    },
    [setFeedbackMutation],
  );

  // Ignorar recorrência (calibração)
  const ignoreRecurrence = useCallback(
    async (occurrenceKey: string) => {
      await setFeedbackMutation.mutateAsync({
        occurrenceKey,
        decision: "ignore",
      });
      triggerSensory("action");
      pushToast({
        title: "Gasto ignorado",
        description: "Esta despesa não será mais sugerida como recorrente.",
      });
    },
    [setFeedbackMutation],
  );

  // Confirmação de renda em 1 clique
  const confirmIncome = useCallback(
    async (payload: {
      name: string;
      valueCents: number;
      categoryId: string;
      date?: string;
    }) => {
      const value = payload.valueCents / 100;
      await createIncomeMutation.mutateAsync({
        description: payload.name,
        value,
        category_id: payload.categoryId,
        date: payload.date ?? todayISOStr,
        receive_type: "pix",
        report_weight: 1,
        source_ref: null,
      });

      const keyToDismiss = rankedInsight?.themeKey ?? `income:${normalizeText(payload.name)}`;
      dismiss(keyToDismiss, DEFAULT_DISMISS_DAYS);
      triggerSensory("success");
      pushToast({
        title: "Entrada confirmada",
        description: `Renda de ${payload.name} registrada com sucesso.`,
      });
    },
    [createIncomeMutation, todayISOStr, rankedInsight?.themeKey, dismiss],
  );

  const isLoading =
    queryEnabled &&
    (month0Expenses.isLoading ||
      month1Expenses.isLoading ||
      month2Expenses.isLoading ||
      month3Expenses.isLoading ||
      month0Incomes.isLoading ||
      month1Incomes.isLoading ||
      month2Incomes.isLoading ||
      month3Incomes.isLoading ||
      budgetsQuery.isLoading ||
      categoriesQuery.isLoading ||
      feedbackQuery.isLoading);

  const isError =
    queryEnabled &&
    (month0Expenses.isError ||
      month1Expenses.isError ||
      month2Expenses.isError ||
      month3Expenses.isError ||
      month0Incomes.isError ||
      month1Incomes.isError ||
      month2Incomes.isError ||
      month3Incomes.isError ||
      budgetsQuery.isError ||
      categoriesQuery.isError ||
      feedbackQuery.isError);

  const error =
    month0Expenses.error ??
    month1Expenses.error ??
    month2Expenses.error ??
    month3Expenses.error ??
    month0Incomes.error ??
    month1Incomes.error ??
    month2Incomes.error ??
    month3Incomes.error ??
    budgetsQuery.error ??
    categoriesQuery.error ??
    feedbackQuery.error ??
    null;

  const refetch = useCallback(async () => {
    await Promise.all([
      month0Expenses.refetch(),
      month1Expenses.refetch(),
      month2Expenses.refetch(),
      month3Expenses.refetch(),
      month0Incomes.refetch(),
      month1Incomes.refetch(),
      month2Incomes.refetch(),
      month3Incomes.refetch(),
      budgetsQuery.refetch(),
      categoriesQuery.refetch(),
      feedbackQuery.refetch(),
    ]);
  }, [
    month0Expenses,
    month1Expenses,
    month2Expenses,
    month3Expenses,
    month0Incomes,
    month1Incomes,
    month2Incomes,
    month3Incomes,
    budgetsQuery,
    categoriesQuery,
    feedbackQuery,
  ]);

  return {
    insight: rankedInsight,
    allCandidates,
    isLoading,
    isError,
    error,
    dismiss,
    confirmRecurrence,
    ignoreRecurrence,
    confirmIncome,
    refetch,
  };
}
