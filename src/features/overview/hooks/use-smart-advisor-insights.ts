import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { currentMonth, shiftMonth, todayLocalIso } from "@/lib/date";
import { budgetLimitsByCategory, resolveEffectiveLimit } from "@/domain/budgets";
import { numberToCents, sumGrossCents } from "@/domain/money";
import {
  detectIncomeRecurrences,
  detectRecurrences,
  type ExpenseLike,
  type IncomeLike,
} from "@/domain/insights/recurrences";
import type { FeedbackMap, QualifiedDismissReason } from "@/domain/insights/feedback";
import { normalizeText } from "@/domain/insights/shared";
import {
  DEFAULT_DISMISS_DAYS,
  filterAndRankAllAdvisorInsights,
  generateSmartAdvisorInsights,
  SMART_ADVISOR_DISMISSALS_KEY,
  SMART_ADVISOR_LAST_DISMISSED_DAY_KEY,
  type CardForAdvisorContext,
  type SmartAdvisorInsight,
} from "@/domain/insights/advisor";
import {
  useBudgets,
  useCategories,
  useCreateExpense,
  useCreateIncome,
  useCreditCards,
  useDeleteExpense,
  useDeleteIncome,
  useExpenses,
  useFeedback,
  useIncomes,
  useSetFeedback,
  useUpdateCustomSettings,
  useUserPreferences,
} from "@/state";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { subscribeInsightsReevaluation } from "@/services/merchant-learning";
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

/**
 * Revoga um descarte específico sob cooldown ativo pelo themeKey, reintroduzindo
 * o tema correspondente no fluxo de detecção do assistente proativo.
 */
export function revokeSmartAdvisorDismissal(themeKey: string) {
  initStorageIfNeeded();
  const next = { ...memoryDismissals };
  delete next[themeKey];
  memoryDismissals = next;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(SMART_ADVISOR_DISMISSALS_KEY, JSON.stringify(next));
    } catch {
      // Ignora erro
    }
  }
  notifySubscribers();
}

/**
 * Hook reativo para leitura e gerenciamento de descartes temporários (cooldowns) do assistente.
 */
export function useSmartAdvisorDismissals() {
  const dismissals = useSyncExternalStore(subscribe, getDismissalsSnapshot, () => ({}));

  const revokeDismissal = useCallback((themeKey: string) => {
    revokeSmartAdvisorDismissal(themeKey);
  }, []);

  const resetAll = useCallback(() => {
    resetSmartAdvisorCooldowns();
  }, []);

  return {
    dismissals,
    revokeDismissal,
    resetAll,
  };
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
  /** Poupança (sobra líquida) do ciclo em centavos para sugerir aporte (§Eixo 3). */
  savingsSurplusCents?: number;
  /** Meta mensal de aporte planejada em centavos. */
  plannedAporteCents?: number;
  /** Total de aportes já efetuados no mês vigente em centavos. */
  currentMonthAportesCents?: number;
  /** Cartões pré-carregados ou mockados com contexto de fatura/limite (F28 / Tarefa 8.4). */
  cards?: readonly CardForAdvisorContext[];
}

export interface UseSmartAdvisorInsightsResult {
  /** Insight priorizado atualmente selecionado na fila, ou null se não houver. */
  insight: SmartAdvisorInsight | null;
  /** Lista ordenada de todos os insights elegíveis no momento (sem cooldown). */
  insights: SmartAdvisorInsight[];
  /** Índice da sugestão ativa na fila (0 a totalCount - 1). */
  currentIndex: number;
  /** Total de sugestões ativas na fila. */
  totalCount: number;
  /** Avança para a próxima sugestão da fila. */
  nextInsight: () => void;
  /** Retorna à sugestão anterior da fila. */
  prevInsight: () => void;
  /** Seleciona uma sugestão específica pelo índice. */
  goToInsight: (index: number) => void;
  /** Todos os candidatos gerados antes do ranqueamento e filtros de discrição. */
  allCandidates: SmartAdvisorInsight[];
  /** Indica se os dados necessários estão sendo carregados. */
  isLoading: boolean;
  /** Indica se houve erro em alguma das consultas. */
  isError: boolean;
  /** Erro disparado por alguma das consultas, se houver. */
  error: unknown;
  /** Dispensa o insight atual ou um tema específico por N dias (padrão 30). */
  dismiss: (themeKey?: string, days?: number) => void;
  /** Confirma o monitoramento contínuo de uma recorrência (ensina o motor). */
  confirmRecurrence: (occurrenceKey: string) => Promise<void>;
  /** Ignora uma despesa com motivo qualificado (ensina o motor) (§F23). */
  ignoreRecurrence: (occurrenceKey: string, reason?: QualifiedDismissReason | "ignore") => Promise<void>;
  /** Confirma recebimento de renda em 1 clique e cria a entrada correspondente. */
  confirmIncome: (payload: {
    name: string;
    valueCents: number;
    categoryId: string;
    date?: string;
  }) => Promise<void>;
  /** Marca expressamente uma despesa recorrente como essencial com sincronização na nuvem e reversibilidade. */
  markAsEssential: (occurrenceKey: string, displayName?: string) => Promise<void>;
  /** Confirma expressamente despesa fixa em 1 toque com toast de reversão (F27). */
  confirmExpense: (payload: {
    name: string;
    valueCents: number;
    categoryId: string;
    date?: string;
    forma?: string;
    cardId?: string;
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
  const month11Expenses = useExpenses(shiftMonth(refMonth, -11), { enabled: queryEnabled });
  const month12Expenses = useExpenses(shiftMonth(refMonth, -12), { enabled: queryEnabled });

  const month0Incomes = useIncomes(refMonth, { enabled: queryEnabled });
  const month1Incomes = useIncomes(shiftMonth(refMonth, -1), { enabled: queryEnabled });
  const month2Incomes = useIncomes(shiftMonth(refMonth, -2), { enabled: queryEnabled });
  const month3Incomes = useIncomes(shiftMonth(refMonth, -3), { enabled: queryEnabled });

  const budgetsQuery = useBudgets();
  const categoriesQuery = useCategories();
  const feedbackQuery = useFeedback();
  const creditCardsQuery = useCreditCards({ enabled: queryEnabled });

  const setFeedbackMutation = useSetFeedback();
  const createIncomeMutation = useCreateIncome();
  const deleteIncomeMutation = useDeleteIncome();
  const createExpenseMutation = useCreateExpense();
  const deleteExpenseMutation = useDeleteExpense();

  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  // Estados locais para injeção em testes (opcional)
  const [localDismissals, setLocalDismissals] = useState<Record<string, number> | undefined>(
    options.initialDismissals,
  );
  const [localLastDismissedDay, setLocalLastDismissedDay] = useState<string | undefined>(
    options.initialLastDismissedDay,
  );

  const cloudDismissals = userPreferencesQuery.data?.custom_settings?.advisorDismissals;
  const cloudLastDismissedDay = userPreferencesQuery.data?.custom_settings?.advisorLastDismissedDay;

  // External store com snapshot do localStorage
  const storeDismissals = useSyncExternalStore(subscribe, getDismissalsSnapshot, () => ({}));
  const storeLastDismissedDay = useSyncExternalStore(subscribe, getLastDismissedDaySnapshot, () => null);

  const effectiveDismissals = useMemo(() => {
    if (localDismissals !== undefined) return localDismissals;
    if (!cloudDismissals) return storeDismissals;
    const merged = { ...storeDismissals, ...cloudDismissals };
    const valid: Record<string, number> = {};
    for (const [k, v] of Object.entries(merged)) {
      if (typeof v === "number" && v > nowMs) {
        valid[k] = v;
      }
    }
    return valid;
  }, [localDismissals, storeDismissals, cloudDismissals, nowMs]);

  const effectiveLastDismissedDay = localLastDismissedDay ?? cloudLastDismissedDay ?? storeLastDismissedDay;

  // Montagem das categorias
  const categories = useMemo(
    () => options.categories ?? categoriesQuery.data ?? [],
    [options.categories, categoriesQuery.data],
  );
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Montagem dos cartões de crédito
  const cards = useMemo<readonly CardForAdvisorContext[]>(
    () => options.cards ?? creditCardsQuery.data ?? [],
    [options.cards, creditCardsQuery.data],
  );

  const m0ExpData = month0Expenses.data;
  const m1ExpData = month1Expenses.data;
  const m2ExpData = month2Expenses.data;
  const m3ExpData = month3Expenses.data;
  const m11ExpData = month11Expenses.data;
  const m12ExpData = month12Expenses.data;

  // Montagem das despesas recentes e históricas para detecção anual (F21)
  const allExpenses = useMemo<readonly ExpenseLike[]>(() => {
    if (options.expenses) return options.expenses;

    const queryDataList = [
      { data: m0ExpData, month: refMonth },
      { data: m1ExpData, month: shiftMonth(refMonth, -1) },
      { data: m2ExpData, month: shiftMonth(refMonth, -2) },
      { data: m3ExpData, month: shiftMonth(refMonth, -3) },
      { data: m11ExpData, month: shiftMonth(refMonth, -11) },
      { data: m12ExpData, month: shiftMonth(refMonth, -12) },
    ];
    return queryDataList.flatMap(({ data, month }) =>
      (data ?? []).map((e) => ({
        id: e.id,
        description: e.description,
        date: e.date,
        month: e.date ? e.date.slice(0, 7) : month,
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
    m11ExpData,
    m12ExpData,
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

  const monthlyExpensesCents = useMemo(() => {
    if (options.expenses) {
      const current = options.expenses.filter((e) => e.month === refMonth);
      return current.reduce((sum, item) => sum + item.valueCents, 0);
    }
    return sumGrossCents(month0Expenses.data ?? []);
  }, [options.expenses, refMonth, month0Expenses.data]);

  const effectiveSurplusCents = useMemo(() => {
    if (options.savingsSurplusCents !== undefined) {
      return options.savingsSurplusCents;
    }
    const diff = monthlyIncomeCents - monthlyExpensesCents;
    return diff > 0 ? diff : 0;
  }, [options.savingsSurplusCents, monthlyIncomeCents, monthlyExpensesCents]);

  // Feedback do usuário
  const feedbackMap: FeedbackMap = useMemo(() => {
    if (options.feedbackMap) return options.feedbackMap;
    return (feedbackQuery.data ?? {}) as FeedbackMap;
  }, [options.feedbackMap, feedbackQuery.data]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Candidatos e ranqueamento
  const { allCandidates, eligibleInsights } = useMemo(() => {
    // Prevenção de condição de corrida e flashes efêmeros (ghost insights):
    // Não avalia nem emite candidatos com dados parciais enquanto consultas cadastrais,
    // de feedback ou despesas recentes ainda estão em carregamento inicial.
    if (queryEnabled && (feedbackQuery.isLoading || categoriesQuery.isLoading || month0Expenses.isLoading)) {
      return { allCandidates: [], eligibleInsights: [] };
    }

    const recentExpenses = allExpenses.filter((e) => {
      const m = e.date ? e.date.slice(0, 7) : e.month;
      return m >= shiftMonth(refMonth, -3);
    });

    const occurrences = detectRecurrences(recentExpenses, {
      todayISO: todayISOStr,
      monthlyIncomeCents,
      categoryBudgets: categoryBudgetsMap,
      feedbackMap,
    });

    const incomeOccurrences = detectIncomeRecurrences(allIncomes, {
      todayISO: todayISOStr,
    });

    const candidates = generateSmartAdvisorInsights({
      occurrences,
      incomes: incomeOccurrences,
      feedbackMap,
      todayISO: todayISOStr,
      savingsSurplusCents: effectiveSurplusCents,
      plannedAporteCents: options.plannedAporteCents,
      currentMonthAportesCents: options.currentMonthAportesCents,
      allExpenses,
      cards,
    });

    const eligible = filterAndRankAllAdvisorInsights(candidates, {
      dismissals: effectiveDismissals,
      lastDismissedDay: effectiveLastDismissedDay ?? undefined,
      currentDayISO: todayISOStr,
      nowMs,
    });

    return { allCandidates: candidates, eligibleInsights: eligible };
  }, [
    queryEnabled,
    feedbackQuery.isLoading,
    categoriesQuery.isLoading,
    month0Expenses.isLoading,
    allExpenses,
    allIncomes,
    refMonth,
    todayISOStr,
    monthlyIncomeCents,
    effectiveSurplusCents,
    options.plannedAporteCents,
    options.currentMonthAportesCents,
    categoryBudgetsMap,
    feedbackMap,
    effectiveDismissals,
    effectiveLastDismissedDay,
    nowMs,
    cards,
  ]);

  const totalCount = eligibleInsights.length;
  const safeIndex = totalCount > 0 ? Math.min(currentIndex, totalCount - 1) : 0;
  const activeInsight = eligibleInsights[safeIndex] ?? null;

  const nextInsight = useCallback(() => {
    if (totalCount <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % totalCount);
    triggerSensory("selection");
  }, [totalCount]);

  const prevInsight = useCallback(() => {
    if (totalCount <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + totalCount) % totalCount);
    triggerSensory("selection");
  }, [totalCount]);

  const goToInsight = useCallback(
    (index: number) => {
      if (totalCount === 0) return;
      const clamped = Math.max(0, Math.min(index, totalCount - 1));
      setCurrentIndex(clamped);
      triggerSensory("selection");
    },
    [totalCount],
  );

  // Ação de dispensa com cooldown e avanço sequencial
  const dismiss = useCallback(
    (themeKey?: string, days = DEFAULT_DISMISS_DAYS) => {
      const keyToDismiss = themeKey ?? activeInsight?.themeKey;
      const isLastRemaining =
        eligibleInsights.length <= 1 ||
        (keyToDismiss != null &&
          eligibleInsights.length === 1 &&
          eligibleInsights[0]?.themeKey === keyToDismiss);

      const effectiveDay = isLastRemaining ? todayISOStr : null;

      if (localDismissals !== undefined || localLastDismissedDay !== undefined) {
        if (effectiveDay) {
          setLocalLastDismissedDay(effectiveDay);
        }
        if (keyToDismiss) {
          const expiry = nowMs + days * 24 * 60 * 60 * 1000;
          setLocalDismissals((prev) => ({ ...(prev ?? {}), [keyToDismiss]: expiry }));
        }
      } else {
        initStorageIfNeeded();
        if (effectiveDay) {
          memoryLastDismissedDay = effectiveDay;
        }
        if (keyToDismiss) {
          const expiry = nowMs + days * 24 * 60 * 60 * 1000;
          memoryDismissals = {
            ...memoryDismissals,
            [keyToDismiss]: expiry,
          };
          updateCustomSettingsMutation.mutate({
            advisorDismissals: {
              ...(cloudDismissals ?? {}),
              ...memoryDismissals,
            },
            advisorLastDismissedDay: effectiveDay ?? undefined,
          });
        }

        if (typeof window !== "undefined" && window.localStorage) {
          try {
            if (effectiveDay) {
              window.localStorage.setItem(SMART_ADVISOR_LAST_DISMISSED_DAY_KEY, effectiveDay);
            }
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

      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : 0));
    },
    [
      todayISOStr,
      activeInsight?.themeKey,
      eligibleInsights,
      localDismissals,
      localLastDismissedDay,
      nowMs,
      cloudDismissals,
      updateCustomSettingsMutation,
    ],
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

  // Ignorar recorrência (calibração e micro-feedback qualificado §F23)
  const ignoreRecurrence = useCallback(
    async (occurrenceKey: string, reason: QualifiedDismissReason | "ignore" = "ignore") => {
      await setFeedbackMutation.mutateAsync({
        occurrenceKey,
        decision: reason,
      });

      if (reason === "already_cancelled") {
        triggerSensory("success");
        pushToast({
          title: "Assinatura cancelada celebrada",
          description: "Economia celebrada e removida dos custos fixos ativos.",
          variant: "success",
        });
      } else if (reason === "not_subscription") {
        triggerSensory("action");
        pushToast({
          title: "Despesa reclassificada",
          description: "Probabilidade de recorrência deste fornecedor rebaixada no motor.",
          variant: "info",
        });
      } else if (reason === "one_off") {
        triggerSensory("action");
        pushToast({
          title: "Despesa pontual silenciada",
          description: "Esta despesa foi silenciada neste ciclo.",
          variant: "default",
        });
      } else {
        triggerSensory("action");
        pushToast({
          title: "Gasto ignorado",
          description: "Esta despesa não será mais sugerida como recorrente.",
        });
      }
    },
    [setFeedbackMutation],
  );

  // Marcação expressa como essencial (sincronizada na nuvem com feedback de reversão imediata)
  const markAsEssential = useCallback(
    async (occurrenceKey: string, displayName?: string) => {
      await setFeedbackMutation.mutateAsync({
        occurrenceKey,
        decision: "essential",
      });

      triggerSensory("action");
      const name = displayName ?? "Esta despesa";
      pushToast({
        title: "Marcado como essencial",
        description: `${name} foi classificado como essencial e não será sugerido para corte.`,
        duration: 5000,
        variant: "success",
        action: {
          label: "Desfazer",
          onClick: () => {
            void setFeedbackMutation.mutateAsync({
              occurrenceKey,
              decision: null,
            });
            triggerSensory("action");
            pushToast({
              title: "Decisão desfeita",
              description: `${name} voltou ao monitoramento regular de sugestões.`,
              variant: "info",
            });
          },
        },
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
      const created = await createIncomeMutation.mutateAsync({
        description: payload.name,
        value,
        category_id: payload.categoryId,
        date: payload.date ?? todayISOStr,
        receive_type: "pix",
        report_weight: 1,
        source_ref: null,
      });

      const keyToDismiss = activeInsight?.themeKey ?? `income:${normalizeText(payload.name)}`;
      dismiss(keyToDismiss, DEFAULT_DISMISS_DAYS);
      triggerSensory("success");
      pushToast({
        title: "Entrada confirmada",
        description: `Renda de ${payload.name} registrada com sucesso.`,
        action: {
          label: "Desfazer",
          onClick: () => {
            if (created?.id) {
              void deleteIncomeMutation.mutateAsync(created.id);
              triggerSensory("action");
              pushToast({
                title: "Entrada desfeita",
                description: `Renda de ${payload.name} foi removida.`,
              });
            }
          },
        },
      });
    },
    [createIncomeMutation, deleteIncomeMutation, todayISOStr, activeInsight?.themeKey, dismiss],
  );

  // Confirmação expressa de despesa fixa em 1 toque com toast de reversão (F27 / Tarefa 8.3)
  const confirmExpense = useCallback(
    async (payload: {
      name: string;
      valueCents: number;
      categoryId: string;
      date?: string;
      forma?: string;
      cardId?: string;
    }) => {
      const value = payload.valueCents / 100;
      const targetDate = payload.date ?? todayISOStr;
      const createdId = await createExpenseMutation.mutateAsync({
        value,
        date: targetDate,
        categoryId: payload.categoryId,
        paymentMethod: payload.forma ?? (payload.cardId ? "credit_card" : "pix"),
        cardId: payload.cardId ?? null,
        description: payload.name,
        reportWeight: 1,
        installments: [
          {
            date: targetDate,
            value,
            billCompetence: null,
          },
        ],
      });

      const keyToDismiss = activeInsight?.themeKey ?? `missing_expense:${normalizeText(payload.name)}`;
      dismiss(keyToDismiss, DEFAULT_DISMISS_DAYS);
      triggerSensory("success");
      pushToast({
        title: "Pagamento confirmado",
        description: `Despesa de ${payload.name} registrada com sucesso.`,
        duration: 5000,
        variant: "success",
        action: {
          label: "Desfazer",
          onClick: () => {
            if (createdId) {
              void deleteExpenseMutation.mutateAsync({ expenseId: createdId, mode: "single" });
              triggerSensory("action");
              pushToast({
                title: "Pagamento desfeito",
                description: `Despesa de ${payload.name} foi removida.`,
                variant: "info",
              });
            }
          },
        },
      });
    },
    [createExpenseMutation, deleteExpenseMutation, todayISOStr, activeInsight?.themeKey, dismiss],
  );

  const isLoading =
    queryEnabled &&
    (month0Expenses.isLoading ||
      month1Expenses.isLoading ||
      month2Expenses.isLoading ||
      month3Expenses.isLoading ||
      month11Expenses.isLoading ||
      month12Expenses.isLoading ||
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
      month11Expenses.isError ||
      month12Expenses.isError ||
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

  useEffect(() => {
    return subscribeInsightsReevaluation(() => {
      void refetch();
    });
  }, [refetch]);

  return {
    insight: activeInsight,
    insights: eligibleInsights,
    currentIndex: safeIndex,
    totalCount,
    nextInsight,
    prevInsight,
    goToInsight,
    allCandidates,
    isLoading,
    isError,
    error,
    dismiss,
    confirmRecurrence,
    ignoreRecurrence,
    markAsEssential,
    confirmIncome,
    confirmExpense,
    refetch,
  };
}
