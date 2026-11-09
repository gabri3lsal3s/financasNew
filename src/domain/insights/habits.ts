/**
 * Motor de Detecção de Hábitos de Consumo e Microvazamentos — ESPECIFICAÇÃO & F30.
 *
 * Função pura e determinística responsável por:
 *   1. Agrupar despesas pelo cluster semântico de intenção (HabitClusterKey);
 *   2. Calcular frequência, volume acumulado, tíquete médio e impacto anual;
 *   3. Identificar vazamentos silenciosos (micro-leakages: pequenos gastos frequentes com alto peso acumulado);
 *   4. Identificar dias predominantes de consumo (ex.: rotina de trabalho híbrido).
 */

import type { ExpenseLike } from "./recurrences";
import { extractHabitClusterKey, type IntentKind } from "./intent-semantics";
import { DAY_OF_WEEK_LABELS_PTBR } from "./extended-periodicity";
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
  /** Projeção de impacto anual em centavos (totalMonthCents * 12). */
  annualProjectedCents: number;
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
}

/** Teto de valor médio para enquadramento como microdespesa (R$ 30,00). */
export const MICRO_LEAKAGE_TICKET_CEILING_CENTS = 3000;
/** Piso de impacto mensal acumulado para alertar sobre microvazamento (R$ 150,00). */
export const MICRO_LEAKAGE_MIN_TOTAL_CENTS = 15000;

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

  // Filtra parcelas e despesas formais com recorrência contratual conhecida
  const activeExpenses = expenses.filter(
    (e) => e.installmentGroupId == null && e.recurrenceId == null && e.valueCents > 0,
  );

  // Agrupa despesas do mês por cluster semântico
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
    const annualProjectedCents = totalMonthCents * 12;

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
