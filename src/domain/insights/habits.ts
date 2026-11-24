/**
 * Motor de Detecção de Hábitos de Consumo e Microvazamentos — ESPECIFICAÇÃO & F30.
 *
 * Função pura e determinística responsável por:
 *   1. Agrupar despesas pelo cluster semântico de intenção (HabitClusterKey);
 *   2. Calcular frequência, volume acumulado, tíquete médio e impacto anual;
 *   3. Identificar vazamentos silenciosos (micro-leakages: pequenos gastos frequentes com alto peso acumulado);
 *   4. Identificar dias predominantes de consumo (ex.: rotina de trabalho híbrido).
 */

import { diffMonths, medianOf, type ExpenseLike } from "./recurrences";
import { extractHabitClusterKey, type IntentKind } from "./intent-semantics";
import { DAY_OF_WEEK_LABELS_PTBR } from "./extended-periodicity";
import { normalizeText, stripTemporalSuffixes } from "./shared";
import { todayISO as getTodayISO } from "@/domain/debts";

export interface SpendingHabit {
  /** Chave estável de clusterização do hábito (ex.: habit:cat_transporte:mobility:commute). */
  key: string;
  categoryId: string;
  categoryName?: string;
  categoryIcon?: string | null;
  intentKind: IntentKind;
  /** Nome editorial canônico amigável (ex.: "Deslocamentos e transporte", "Refeições e almoços fora"). */
  name: string;
  /** Ação recomendada para orientar o usuário (ex.: "Definir teto para transporte"). */
  actionLabel: string;
  /** Total de gastos acumulado no mês de referência em centavos. */
  totalMonthCents: number;
  /** Quantidade de transações registradas no período. */
  occurrencesCount: number;
  /** Tíquete médio por transação em centavos. */
  averageTicketCents: number;
  /** Projeção de impacto anual em centavos (suavizada pelo histórico M-1..M-3 quando disponível). */
  annualProjectedCents: number;
  /** Verdadeiro quando o mesmo hábito ocorreu em pelo menos 1 dos 3 meses anteriores (M-1..M-3). */
  isRecurringAcrossMonths: boolean;
  /** Mediana mensal do hábito nos meses anteriores M-1..M-3 (presente quando isRecurringAcrossMonths). */
  historicalMonthlyMedianCents?: number;
  /** Teto de orçamento configurado para a categoria no mês atual, se houver (centavos). */
  categoryBudgetCents?: number;
  /**
   * Sinaliza se é considerado um "microvazamento" (micro-leakage):
   * Pequenos gastos individuais (<= R$ 30,00) que, somados pela alta frequência,
   * acumulam impacto expressivo (>= R$ 150,00 ou >= 5% da renda).
   */
  isMicroLeakage: boolean;
  /** Dia da semana predominante (0 = Domingo a 6 = Sábado). */
  predominantDayOfWeek?: number;
  /** Rótulo do dia de maior intensidade (ex.: "Toda terça-feira", "Dias úteis"). */
  predominantDayLabel?: string;
  /** Lançamentos que compõem este hábito (ordenados do mais recente ao mais antigo). */
  expenses: ExpenseLike[];
  /** Indica se houve atividade registrada no mês atual. */
  activeThisMonth: boolean;
}

export interface DetectSpendingHabitsOptions {
  todayISO?: string;
  /** Mês de análise (YYYY-MM). Se omitido, infere de todayISO ou do mês atual. */
  targetMonth?: string;
  /** Renda mensal estimada para calibrar microvazamentos. */
  monthlyIncomeCents?: number;
  /** Limite mínimo de ocorrências para caracterizar hábito no mês (default: 3). */
  minOccurrences?: number;
  /** Despesas de meses anteriores (M-1..M-3) para suavizar projeção anual de meses atípicos. */
  historicalExpenses?: readonly ExpenseLike[];
  /** IDs exatos de despesas marcadas como `tx_one_off:<id>` pelo usuário. */
  oneOffExpenseIds?: ReadonlySet<string>;
  /** Chaves de hábitos/estabelecimentos marcados como `one_off` no ciclo corrente. */
  currentMonthOneOffKeys?: ReadonlySet<string>;
  /** Limites de orçamento ativos por categoria (categoryId -> centavos). */
  categoryBudgets?: ReadonlyMap<string, number> | Readonly<Record<string, number>>;
}

/** Teto de valor médio para enquadramento como microdespesa (R$ 30,00). */
export const MICRO_LEAKAGE_TICKET_CEILING_CENTS = 3000;
/** Piso de impacto mensal acumulado para alertar sobre microvazamento (R$ 150,00). */
export const MICRO_LEAKAGE_MIN_TOTAL_CENTS = 15000;

function isEligibleHabitExpense(
  exp: ExpenseLike,
  oneOffExpenseIds?: ReadonlySet<string>,
): boolean {
  if (exp.installmentGroupId != null || exp.recurrenceId != null) return false;
  if (exp.valueCents <= 0) return false;
  if (exp.tripId != null || exp.rawExpense?.trip_id != null) return false;
  if (oneOffExpenseIds?.has(exp.id)) return false;
  return true;
}

function resolveCategoryBudgetCents(
  categoryId: string,
  categoryBudgets?: ReadonlyMap<string, number> | Readonly<Record<string, number>>,
): number | undefined {
  if (!categoryBudgets) return undefined;
  const val =
    categoryBudgets instanceof Map
      ? categoryBudgets.get(categoryId)
      : (categoryBudgets as Readonly<Record<string, number | undefined>>)[categoryId];
  return typeof val === "number" && val > 0 ? val : undefined;
}

/**
 * Detecta hábitos de consumo frequente e microvazamentos a partir do histórico de despesas.
 */
export function detectSpendingHabits(
  expenses: readonly ExpenseLike[],
  options: DetectSpendingHabitsOptions = {},
): SpendingHabit[] {
  const todayISO = options.todayISO ?? getTodayISO();
  const currentMonth = options.targetMonth ?? todayISO.slice(0, 7);
  const minOccurrences = Math.max(2, options.minOccurrences ?? 3);
  const monthlyIncomeCents = options.monthlyIncomeCents ?? 0;
  const { oneOffExpenseIds, currentMonthOneOffKeys, categoryBudgets } = options;

  // 1. Filtra viagens, parcelas, recorrências formais e despesas `tx_one_off`
  const activeExpenses = expenses.filter((e) => isEligibleHabitExpense(e, oneOffExpenseIds));

  // 2. Indexa janela histórica M-1..M-3 para suavização e continuidade intermensal
  const priorPoolById = new Map<string, ExpenseLike>();
  for (const exp of [...expenses, ...(options.historicalExpenses ?? [])]) {
    if (!priorPoolById.has(exp.id)) {
      priorPoolById.set(exp.id, exp);
    }
  }

  const observedPriorMonths = new Set<string>();
  const priorTotalsByClusterAndMonth = new Map<string, Map<string, number>>();

  for (const exp of priorPoolById.values()) {
    if (!isEligibleHabitExpense(exp, oneOffExpenseIds)) continue;
    const monthsAgo = diffMonths(exp.month, currentMonth);
    if (monthsAgo < 1 || monthsAgo > 3) continue;

    observedPriorMonths.add(exp.month);

    const cluster = extractHabitClusterKey(exp);
    if (cluster.isSubscription) continue;

    const clusterMonths = priorTotalsByClusterAndMonth.get(cluster.clusterKey) ?? new Map<string, number>();
    clusterMonths.set(exp.month, (clusterMonths.get(exp.month) ?? 0) + exp.valueCents);
    priorTotalsByClusterAndMonth.set(cluster.clusterKey, clusterMonths);
  }

  const observedPriorMonthsCount = observedPriorMonths.size;

  // 3. Agrupa despesas do mês de referência por cluster semântico
  const groups = new Map<
    string,
    {
      categoryId: string;
      categoryName?: string;
      categoryIcon?: string | null;
      intentKind: IntentKind;
      name: string;
      actionLabel: string;
      expenses: ExpenseLike[];
    }
  >();

  for (const exp of activeExpenses) {
    // Foca prioritariamente no mês de análise
    if (exp.month !== currentMonth) continue;

    const cluster = extractHabitClusterKey(exp);
    // Assinaturas contratuais puras seguem o trilho de Fixed Bills / Subscriptions
    if (cluster.isSubscription) continue;

    if (currentMonthOneOffKeys && currentMonthOneOffKeys.size > 0) {
      const cleanDesc = normalizeText(stripTemporalSuffixes(exp.description ?? ""));
      if (
        currentMonthOneOffKeys.has(cluster.clusterKey) ||
        (cleanDesc &&
          (currentMonthOneOffKeys.has(cleanDesc) ||
            currentMonthOneOffKeys.has(`habit:${exp.categoryId}:${cleanDesc}`)))
      ) {
        continue;
      }
    }

    const existing = groups.get(cluster.clusterKey);
    if (existing) {
      existing.expenses.push(exp);
    } else {
      groups.set(cluster.clusterKey, {
        categoryId: exp.categoryId,
        categoryName: exp.categoryName ?? undefined,
        categoryIcon: exp.categoryIcon,
        intentKind: cluster.intentKind,
        name: cluster.canonicalLabel,
        actionLabel: cluster.defaultActionLabel,
        expenses: [exp],
      });
    }
  }

  const habits: SpendingHabit[] = [];

  for (const [key, group] of groups.entries()) {
    if (group.expenses.length < minOccurrences) continue;

    const occurrencesCount = group.expenses.length;
    const totalMonthCents = group.expenses.reduce((acc, e) => acc + e.valueCents, 0);
    const averageTicketCents = Math.round(totalMonthCents / occurrencesCount);

    const priorClusterMap = priorTotalsByClusterAndMonth.get(key);
    const priorClusterTotals = priorClusterMap
      ? [...priorClusterMap.values()].filter((v) => v > 0)
      : [];
    const isRecurringAcrossMonths = priorClusterTotals.length >= 1;
    const historicalMonthlyMedianCents = isRecurringAcrossMonths
      ? medianOf(priorClusterTotals)
      : undefined;

    // Suavização histórica: evita multiplicar semana atípica isolada por 12 quando há histórico M-1..M-3
    const annualProjectedCents = isRecurringAcrossMonths
      ? medianOf([...priorClusterTotals, totalMonthCents]) * 12
      : observedPriorMonthsCount > 0
        ? Math.round((totalMonthCents / (observedPriorMonthsCount + 1)) * 12)
        : totalMonthCents * 12;

    const categoryBudgetCents = resolveCategoryBudgetCents(group.categoryId, categoryBudgets);

    // Avaliação de microvazamento
    const hasMicroTicket = averageTicketCents <= MICRO_LEAKAGE_TICKET_CEILING_CENTS;
    const hasSubstantialTotal =
      totalMonthCents >= MICRO_LEAKAGE_MIN_TOTAL_CENTS ||
      (monthlyIncomeCents > 0 && totalMonthCents >= monthlyIncomeCents * 0.05);

    const isMicroLeakage = hasMicroTicket && hasSubstantialTotal;

    // Análise de dias predominantes da semana
    const dayCounts = new Map<number, number>();
    for (const exp of group.expenses) {
      if (exp.date && exp.date.length >= 10) {
        const d = new Date(`${exp.date.slice(0, 10)}T00:00:00`);
        const day = d.getDay();
        dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
      }
    }

    let predominantDayOfWeek: number | undefined;
    let predominantDayLabel: string | undefined;

    if (dayCounts.size > 0) {
      let maxCount = -1;
      for (const [day, count] of dayCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          predominantDayOfWeek = day;
        }
      }

      if (predominantDayOfWeek !== undefined) {
        // Se a frequência for muito distribuída em dias úteis
        const weekdayCount =
          (dayCounts.get(1) ?? 0) +
          (dayCounts.get(2) ?? 0) +
          (dayCounts.get(3) ?? 0) +
          (dayCounts.get(4) ?? 0) +
          (dayCounts.get(5) ?? 0);

        if (weekdayCount / occurrencesCount >= 0.75) {
          predominantDayLabel = "Dias úteis";
        } else {
          predominantDayLabel = DAY_OF_WEEK_LABELS_PTBR[predominantDayOfWeek];
        }
      }
    }

    // Ordena do mais recente ao mais antigo
    const sortedExpenses = [...group.expenses].sort((a, b) => {
      const dateA = a.date ?? `${a.month}-01`;
      const dateB = b.date ?? `${b.month}-01`;
      return dateB.localeCompare(dateA);
    });

    habits.push({
      key,
      categoryId: group.categoryId,
      categoryName: group.categoryName,
      categoryIcon: group.categoryIcon,
      intentKind: group.intentKind,
      name: group.name,
      actionLabel: group.actionLabel,
      totalMonthCents,
      occurrencesCount,
      averageTicketCents,
      annualProjectedCents,
      isRecurringAcrossMonths,
      ...(historicalMonthlyMedianCents !== undefined ? { historicalMonthlyMedianCents } : {}),
      ...(categoryBudgetCents !== undefined ? { categoryBudgetCents } : {}),
      isMicroLeakage,
      predominantDayOfWeek,
      predominantDayLabel,
      expenses: sortedExpenses,
      activeThisMonth: true,
    });
  }

  // Ordena pelo maior impacto financeiro mensal acumulado
  return habits.sort((a, b) => b.totalMonthCents - a.totalMonthCents);
}
