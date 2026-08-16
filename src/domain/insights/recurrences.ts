/**
 * Detecção de recorrências — ESPECIFICAÇÃO §3.7.3.
 *
 * 3 níveis:
 *   • subscription — mesmo nome + valor/categoria estável;
 *   • recurring — mesma descrição, valor com tolerância ±50%;
 *   • similar — mesma categoria com total ±30% (categorias agregadoras
 *     excluídas, checagem de dispersão interna, 2+ meses quando há 3+
 *     meses de histórico).
 * Parcelas (`installment_group_id`) são SEMPRE filtradas — parcelamento
 * não é recorrência.
 */

import { confidenceScore, varianceOf, type RecurrenceKind } from "./confidence";
import { classifySubscription, segmentOf, type CutTier, type ServiceSegment } from "./subscriptions";
import { ESSENTIAL_CATEGORY_ICONS, normalizeText } from "./shared";

export interface ExpenseLike {
  id: string;
  description: string | null;
  /** YYYY-MM */
  month: string;
  /** YYYY-MM-DD (opcional — para cálculo do dia típico de cobrança). */
  date?: string;
  valueCents: number;
  categoryId: string;
  /** Nome do ícone da categoria (para sinais de assinatura). */
  categoryIcon?: string | null;
  installmentGroupId?: string | null;
}

export interface PriceAdjustment {
  oldCents: number;
  newCents: number;
  percentIncrease: number;
}

export interface RecurrenceOccurrence {
  /** Chave estável para aprendizado/feedback (nome normalizado). */
  key: string;
  name: string;
  level: RecurrenceKind;
  /** Segmento do serviço (streaming, fitness, cloud_ai, etc.). */
  segment?: ServiceSegment;
  /** Meses com ocorrência. */
  months: string[];
  /** Valor médio mensal (centavos). */
  averageCents: number;
  confidence: number;
  categoryId?: string;
  /** Tier de corte quando aplicável. */
  tier?: CutTier;
  /** Economia mensal estimada se cortada (centavos). */
  savingsIfCutCents?: number;
  /** Dia típico do mês em que a despesa costuma ser cobrada (1–31). */
  typicalDayOfMonth?: number;
  /** Data ISO da próxima cobrança estimada (YYYY-MM-DD). */
  nextDueDate?: string;
  /** Dias restantes até a próxima cobrança estimada. */
  daysUntilNextDue?: number;
  /** Verdadeiro se a despesa era regular nos meses anteriores e ainda não foi cobrada no mês atual após o dia típico. */
  missingThisMonth?: boolean;
  /** Reajuste de preço detectado (aumento >= 10% vs meses anteriores). */
  priceAdjustment?: PriceAdjustment | null;
  /** Quantidade de cobranças no mês mais recente se houver duplicidade (>= 2). */
  duplicateChargesThisMonth?: number;
}

const RECURRING_TOLERANCE = 0.5; // ±50% (recurring)
const SIMILAR_TOLERANCE = 0.3; // ±30% (similar)

/** Calcula a mediana de um conjunto de valores. */
export function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
}

/** Calcula o dia do mês típico da despesa (1–31) a partir das datas históricas. */
export function calculateTypicalDay(dates: readonly (string | undefined)[]): number {
  const days = dates
    .filter((d): d is string => d != null && d.length >= 10)
    .map((d) => parseInt(d.slice(8, 10), 10))
    .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 31);

  if (days.length === 0) return 1;
  return medianOf(days);
}

/**
 * Estima a próxima data de cobrança e a contagem de dias restantes.
 */
export function estimateNextDueDate(
  typicalDay: number,
  latestMonthCharged: string,
  todayISO?: string,
): { nextDueDate?: string; daysUntilNextDue?: number; missingThisMonth?: boolean } {
  if (!todayISO || todayISO.length < 10) return {};
  const currentMonth = todayISO.slice(0, 7);
  const currentDay = parseInt(todayISO.slice(8, 10), 10);

  let targetYearMonth = currentMonth;
  const alreadyChargedThisMonth = latestMonthCharged >= currentMonth;

  if (alreadyChargedThisMonth) {
    // Já cobrada neste mês -> próxima cobrança é no mês seguinte
    const [yearStr, monthStr] = currentMonth.split("-");
    let y = parseInt(yearStr!, 10);
    let m = parseInt(monthStr!, 10) + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    targetYearMonth = `${y}-${String(m).padStart(2, "0")}`;
  }

  const paddedDay = String(Math.min(typicalDay, 28)).padStart(2, "0");
  const nextDueDate = `${targetYearMonth}-${paddedDay}`;

  const todayDate = new Date(`${todayISO.slice(0, 10)}T00:00:00`);
  const nextDate = new Date(`${nextDueDate}T00:00:00`);
  const daysUntilNextDue = Math.round((nextDate.getTime() - todayDate.getTime()) / 86_400_000);

  // Considera ausente/pendente se não foi cobrada neste mês e o dia típico já passou
  const missingThisMonth = !alreadyChargedThisMonth && currentDay > typicalDay;

  return { nextDueDate, daysUntilNextDue, missingThisMonth };
}

/**
 * Tolerância relativa à MEDIANA (robusta a outliers e à ordem dos meses).
 */
export function valuesWithinToleranceOfMedian(values: readonly number[], tolerance: number): boolean {
  if (values.length < 2) return false;
  const median = medianOf(values);
  if (median <= 0) return false;
  return values.every((value) => Math.abs(value - median) / median <= tolerance);
}

/** Meses distintos de um conjunto de ocorrências. */
export function monthsWith(values: readonly string[]): number {
  return new Set(values).size;
}

export interface DetectRecurrencesOptions {
  todayISO?: string;
}

/**
 * Detecta recorrências entre despesas (parcelas já filtradas).
 * Agrupa por descrição normalizada (subscription/recurring) e por
 * categoria (similar), aplicando as tolerâncias da especificação.
 */
export function detectRecurrences(
  expenses: readonly ExpenseLike[],
  options: DetectRecurrencesOptions = {},
): RecurrenceOccurrence[] {
  const { todayISO } = options;
  const active = expenses.filter((e) => e.installmentGroupId == null);

  // Agrupa por descrição normalizada (níveis subscription/recurring).
  const byName = new Map<string, ExpenseLike[]>();
  for (const expense of active) {
    const key = normalizeText(expense.description ?? expense.id);
    const list = byName.get(key) ?? [];
    list.push(expense);
    byName.set(key, list);
  }

  // Agrupa por categoria (nível similar).
  const byCategory = new Map<string, ExpenseLike[]>();
  for (const expense of active) {
    const list = byCategory.get(expense.categoryId) ?? [];
    list.push(expense);
    byCategory.set(expense.categoryId, list);
  }

  const occurrences: RecurrenceOccurrence[] = [];
  const seen = new Set<string>();

  for (const [key, group] of byName) {
    if (group.length < 2) continue;
    const first = group[0] ?? group[1];
    if (!first) continue;

    // Agregação mensal real: agrupa despesas por mês.
    const monthMap = new Map<string, ExpenseLike[]>();
    for (const exp of group) {
      const list = monthMap.get(exp.month) ?? [];
      list.push(exp);
      monthMap.set(exp.month, list);
    }

    const months = [...monthMap.keys()].sort();
    if (months.length < 2) continue;

    const monthlyTotals = months.map((m) => {
      const monthExpenses = monthMap.get(m) ?? [];
      return monthExpenses.reduce((acc, e) => acc + e.valueCents, 0);
    });

    const averageMonthlyCents = Math.round(monthlyTotals.reduce((acc, v) => acc + v, 0) / monthlyTotals.length);
    const categoryIcons = [...new Set(group.map((e) => e.categoryIcon))];

    // Diagnóstico de cobranças duplicadas no mês mais recente.
    const latestMonth = months[months.length - 1];
    const latestExpenses = latestMonth ? (monthMap.get(latestMonth) ?? []) : [];
    const duplicateChargesThisMonth = latestExpenses.length > 1 ? latestExpenses.length : undefined;

    // Previsão temporal de próximo vencimento e dia típico
    const dates = group.map((e) => e.date).filter(Boolean);
    const typicalDayOfMonth = calculateTypicalDay(dates);
    const { nextDueDate, daysUntilNextDue, missingThisMonth } = estimateNextDueDate(
      typicalDayOfMonth,
      latestMonth ?? "",
      todayISO,
    );

    // Diagnóstico de reajuste de preço (aumento >= 10% vs mediana histórica anterior).
    let priceAdjustment: PriceAdjustment | null = null;
    if (monthlyTotals.length >= 2) {
      const previousTotals = monthlyTotals.slice(0, -1);
      const prevMedian = medianOf(previousTotals);
      const latestTotal = monthlyTotals[monthlyTotals.length - 1] ?? 0;
      if (prevMedian > 0 && latestTotal > prevMedian) {
        const increaseRatio = (latestTotal - prevMedian) / prevMedian;
        if (increaseRatio >= 0.1) {
          priceAdjustment = {
            oldCents: prevMedian,
            newCents: latestTotal,
            percentIncrease: Math.round(increaseRatio * 100),
          };
        }
      }
    }

    // subscription: usa a árvore de decisão de assinaturas (nome conhecido
    // no catálogo OU categoria de assinatura são sinais fortes).
    const subscription = classifySubscription({
      name: first.description ?? "",
      categoryIcon: categoryIcons[0],
      monthlyValuesCents: monthlyTotals,
    });

    if (subscription !== null && months.length >= 2) {
      const variance = varianceOf(monthlyTotals);
      const confidence = confidenceScore({
        base: subscription.confidence,
        monthsHistory: months.length,
        kind: "subscription",
        variance,
      });
      occurrences.push({
        key: `sub:${key}`,
        name: first.description ?? key,
        level: "subscription",
        segment: subscription.segment,
        months,
        averageCents: averageMonthlyCents,
        confidence,
        categoryId: first.categoryId,
        tier: subscription.tier,
        savingsIfCutCents: subscription.savingsIfCutCents,
        typicalDayOfMonth,
        nextDueDate,
        daysUntilNextDue,
        missingThisMonth,
        priceAdjustment,
        duplicateChargesThisMonth,
      });
      seen.add(key);
      continue;
    }

    // recurring: mesma descrição, valor ±50% relativo à MEDIANA.
    const stable = valuesWithinToleranceOfMedian(monthlyTotals, RECURRING_TOLERANCE);
    if (stable && months.length >= 2) {
      const variance = varianceOf(monthlyTotals);
      const confidence = confidenceScore({ base: 0.7, monthsHistory: months.length, kind: "recurring", variance });
      const segment = segmentOf(first.description ?? "", categoryIcons[0]);
      occurrences.push({
        key: `recurring:${key}`,
        name: first.description ?? key,
        level: "recurring",
        segment,
        months,
        averageCents: averageMonthlyCents,
        confidence,
        categoryId: first.categoryId,
        typicalDayOfMonth,
        nextDueDate,
        daysUntilNextDue,
        missingThisMonth,
        priceAdjustment,
        duplicateChargesThisMonth,
      });
      seen.add(key);
    }
  }

  // similar: mesma categoria, totais mensais ±30%, sem categorias agregadoras.
  for (const [categoryId, group] of byCategory) {
    const categoryIcon = group[0]?.categoryIcon;
    if (categoryIcon && ESSENTIAL_CATEGORY_ICONS.has(categoryIcon)) continue;
    if (seen.has(categoryId)) continue;

    // Total por mês dentro da categoria.
    const totalsByMonth = new Map<string, number>();
    for (const expense of group) {
      totalsByMonth.set(expense.month, (totalsByMonth.get(expense.month) ?? 0) + expense.valueCents);
    }
    const months = [...totalsByMonth.keys()].sort();
    const totals = months.map((m) => totalsByMonth.get(m) ?? 0);
    if (totals.length < 2) continue;

    // 2+ meses quando há 3+ meses de histórico.
    const distinctMonths = monthsWith(months);
    if (distinctMonths < 2) continue;

    if (!valuesWithinToleranceOfMedian(totals, SIMILAR_TOLERANCE)) continue;

    const variance = varianceOf(totals);
    const confidence = confidenceScore({ base: 0.6, monthsHistory: distinctMonths, kind: "similar", variance });
    occurrences.push({
      key: `similar:${categoryId}`,
      name: "Gastos similares na categoria",
      level: "similar",
      months,
      averageCents: Math.round(totals.reduce((acc, v) => acc + v, 0) / totals.length),
      confidence,
      categoryId,
    });
  }

  return occurrences.sort((a, b) => b.confidence - a.confidence);
}

