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
import { resolveCategorySemantics } from "./category-semantics";

export interface ExpenseLike {
  id: string;
  description: string | null;
  /** YYYY-MM */
  month: string;
  /** YYYY-MM-DD (opcional — para cálculo do dia típico de cobrança). */
  date?: string;
  valueCents: number;
  categoryId: string;
  /** Nome legível da categoria (ex.: "Supermercado Compre Bem", "Mensalidades"). */
  categoryName?: string | null;
  /** Nome do ícone da categoria (para sinais de assinatura). */
  categoryIcon?: string | null;
  installmentGroupId?: string | null;
  /** Recorrência formal (Fase 32) — nunca é "detecção" (já é conhecida). */
  recurrenceId?: string | null;
}

export interface IncomeLike {
  id: string;
  description: string | null;
  /** YYYY-MM */
  month: string;
  /** YYYY-MM-DD (opcional — para cálculo do dia típico de recebimento). */
  date?: string;
  valueCents: number;
  categoryId: string;
  categoryName?: string | null;
  categoryIcon?: string | null;
  installmentGroupId?: string | null;
  /** Recorrência formal (Fase 32) — nunca é "detecção" (já é conhecida). */
  recurrenceId?: string | null;
}

export type IncomeProfile = "fixed" | "frequent_client";
export type IncomeSuggestedAction = "one_touch_confirm" | "open_value_input";

export interface RecurringIncomeOccurrence {
  /** Chave estável para identificação/feedback. */
  key: string;
  /** Nome ou descrição do pagador/cliente. */
  name: string;
  /** Perfil da renda: fixa/CLT ou cliente frequente/variável. */
  profile: IncomeProfile;
  /** Ação recomendada para a UX de captura rápida (Fase 5). */
  suggestedAction: IncomeSuggestedAction;
  /** Meses em que houve recebimento. */
  months: string[];
  /** Valor médio mensal (centavos). */
  averageCents: number;
  /** Último valor recebido (centavos) — base para sugerir valor preenchido no Perfil 1. */
  lastValueCents: number;
  /** Confiança matemática do padrão (0–1). */
  confidence: number;
  /** Categoria associada. */
  categoryId?: string;
  /** Dia típico do mês em que costuma ser recebido (1–31). */
  typicalDayOfMonth?: number;
  /** Data prevista para o próximo recebimento (YYYY-MM-DD). */
  expectedDate?: string;
  /** Dias restantes até a data prevista. */
  daysUntilExpected?: number;
  /** Verdadeiro se a receita era regular nos meses anteriores e ainda não foi registrada no mês atual após o dia típico. */
  missingThisMonth?: boolean;
  /** Coeficiente de variação de valor em relação à mediana (0 = perfeitamente fixo). */
  valueVariationRatio: number;
}

export interface DetectIncomeRecurrencesOptions {
  todayISO?: string;
  historyMonthsLimit?: number;
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

export interface RecurringTotalsResult {
  totalRecurringCents: number;
  totalAnnualRecurringCents: number;
  canCutRecurringCents: number;
  canCutAnnualCents: number;
}

/**
 * Calcula os totais recorrentes mensais e anuais, bem como a economia potencial de corte (tier "can_cut").
 */
export function calculateRecurringTotals(
  activeOccurrences: readonly { averageCents: number; tier?: CutTier; savingsIfCutCents?: number }[],
): RecurringTotalsResult {
  let totalRecurringCents = 0;
  let canCutRecurringCents = 0;

  for (const o of activeOccurrences) {
    totalRecurringCents += o.averageCents;
    if (o.tier === "can_cut") {
      canCutRecurringCents += o.savingsIfCutCents ?? o.averageCents;
    }
  }

  return {
    totalRecurringCents,
    totalAnnualRecurringCents: totalRecurringCents * 12,
    canCutRecurringCents,
    canCutAnnualCents: canCutRecurringCents * 12,
  };
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
function valuesWithinToleranceOfMedian(values: readonly number[], tolerance: number): boolean {
  if (values.length < 2) return false;
  const median = medianOf(values);
  if (median <= 0) return false;
  return values.every((value) => Math.abs(value - median) / median <= tolerance);
}

/** Meses distintos de um conjunto de ocorrências. */
function monthsWith(values: readonly string[]): number {
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
  // Parcelamento e recorrência formal são filtrados — não são repetições
  // "aprendidas": parcelas não são recorrência (§3.7.3) e recorrências
  // formais já são conhecidas do usuário (Fase 32).
  const active = expenses.filter((e) => e.installmentGroupId == null && e.recurrenceId == null);

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
      categoryName: first.categoryName,
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
      const segment = segmentOf(first.description ?? "", categoryIcons[0], first.categoryName);
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
    const categoryName = group[0]?.categoryName;
    const sem = resolveCategorySemantics({ name: categoryName, icon: categoryIcon });
    if (sem.isAggregator) continue;
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

/**
 * Detecta rendas previsíveis e recorrentes com classificação dual (Fase 4, Tarefa 4.1).
 *
 * Classificação Dual:
 *   • Perfil 1 — Renda Fixa/CLT: Dia típico fixo (± 2 dias) e valor estável (± 10%).
 *     Sugere confirmação em 1 toque com valor preenchido (`one_touch_confirm`).
 *   • Perfil 2 — Renda Recorrente de Cliente Frequente (Freelancer): Mesma fonte/cliente habitual,
 *     frequência mensal e valor flutuante. Sugere card com campo de valor aberto para digitação (`open_value_input`).
 *
 * Analisa o histórico dos últimos 3 a 6 meses e detecta `missingThisMonth` para receitas previstas no mês corrente.
 */
export function detectIncomeRecurrences(
  incomes: readonly IncomeLike[],
  options: DetectIncomeRecurrencesOptions = {},
): RecurringIncomeOccurrence[] {
  const { todayISO, historyMonthsLimit = 6 } = options;

  // Filtra parcelas e recorrências formais (já conhecidas pelo usuário)
  const active = incomes.filter(
    (i) => i.installmentGroupId == null && i.recurrenceId == null && i.valueCents > 0,
  );

  // Agrupa por descrição normalizada (fonte / pagador / cliente habitual)
  const byName = new Map<string, IncomeLike[]>();
  for (const income of active) {
    const rawName = (income.description || "").trim();
    const key = normalizeText(rawName || income.id);
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push(income);
    byName.set(key, list);
  }

  const occurrences: RecurringIncomeOccurrence[] = [];

  for (const [key, group] of byName) {
    if (group.length < 2) continue;
    const first = group[0];
    if (!first) continue;

    // Agrupa por mês (YYYY-MM)
    const monthMap = new Map<string, IncomeLike[]>();
    for (const inc of group) {
      const list = monthMap.get(inc.month) ?? [];
      list.push(inc);
      monthMap.set(inc.month, list);
    }

    const allMonths = [...monthMap.keys()].sort();
    if (allMonths.length < 2) continue;

    // Limita à janela histórica recente (3 a 6 meses)
    const months = allMonths.slice(-historyMonthsLimit);
    if (months.length < 2) continue;

    // Total de receitas por mês desse pagador
    const monthlyTotals = months.map((m) => {
      const monthIncomes = monthMap.get(m) ?? [];
      return monthIncomes.reduce((acc, i) => acc + i.valueCents, 0);
    });

    const averageCents = Math.round(
      monthlyTotals.reduce((acc, v) => acc + v, 0) / monthlyTotals.length,
    );
    const median = medianOf(monthlyTotals);

    // Variação de valor: tolerância de ±10% para Renda Fixa
    const isValueStable = valuesWithinToleranceOfMedian(monthlyTotals, 0.10);
    const maxDev = median > 0
      ? Math.max(...monthlyTotals.map((v) => Math.abs(v - median) / median))
      : 0;
    const valueVariationRatio = Number(maxDev.toFixed(4));

    // Dia típico e desvios de datas
    const dates = group.map((i) => i.date).filter(Boolean);
    const typicalDayOfMonth = calculateTypicalDay(dates);

    const dayNumbers = dates
      .map((d) => (d ? parseInt(d.slice(8, 10), 10) : NaN))
      .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 31);

    const dayDeviations = dayNumbers.map((d) => Math.abs(d - typicalDayOfMonth));
    const avgDayDeviation =
      dayDeviations.length > 0
        ? dayDeviations.reduce((a, b) => a + b, 0) / dayDeviations.length
        : 0;
    const isDayStable = dayDeviations.length === 0 || avgDayDeviation <= 2;

    // Classificação Dual: Perfil 1 (Fixa/CLT) vs Perfil 2 (Cliente Frequente)
    const isFixed = isValueStable && isDayStable;
    const profile: IncomeProfile = isFixed ? "fixed" : "frequent_client";
    const suggestedAction: IncomeSuggestedAction = isFixed ? "one_touch_confirm" : "open_value_input";

    const variance = varianceOf(monthlyTotals);
    const baseConfidence = isFixed ? 0.85 : 0.70;
    const confidence = confidenceScore({
      base: baseConfidence,
      monthsHistory: months.length,
      kind: "recurring",
      variance,
    });

    // Último valor recebido
    const latestMonth = months[months.length - 1];
    const latestIncomes = latestMonth ? (monthMap.get(latestMonth) ?? []) : [];
    const lastValueCents =
      latestIncomes[latestIncomes.length - 1]?.valueCents ??
      monthlyTotals[monthlyTotals.length - 1] ??
      averageCents;

    // Previsão temporal e status missingThisMonth
    let expectedDate: string | undefined;
    let daysUntilExpected: number | undefined;
    let missingThisMonth = false;

    if (todayISO && todayISO.length >= 10) {
      const currentMonth = todayISO.slice(0, 7);
      const currentDay = parseInt(todayISO.slice(8, 10), 10);
      const alreadyReceivedThisMonth = latestMonth === currentMonth;

      if (alreadyReceivedThisMonth) {
        // Já recebido neste mês -> previsão para o mês seguinte
        const { nextDueDate, daysUntilNextDue } = estimateNextDueDate(
          typicalDayOfMonth,
          currentMonth,
          todayISO,
        );
        expectedDate = nextDueDate;
        daysUntilExpected = daysUntilNextDue;
        missingThisMonth = false;
      } else {
        // Não recebido ainda no mês corrente -> esperado no mês corrente
        const paddedDay = String(Math.min(typicalDayOfMonth, 28)).padStart(2, "0");
        expectedDate = `${currentMonth}-${paddedDay}`;
        const todayDate = new Date(`${todayISO.slice(0, 10)}T00:00:00`);
        const nextDate = new Date(`${expectedDate}T00:00:00`);
        daysUntilExpected = Math.round((nextDate.getTime() - todayDate.getTime()) / 86_400_000);
        missingThisMonth = currentDay > typicalDayOfMonth;
      }
    }

    occurrences.push({
      key: `income:${profile}:${key}`,
      name: first.description?.trim() || key,
      profile,
      suggestedAction,
      months,
      averageCents,
      lastValueCents,
      confidence,
      categoryId: first.categoryId,
      typicalDayOfMonth,
      expectedDate,
      daysUntilExpected,
      missingThisMonth,
      valueVariationRatio,
    });
  }

  return occurrences.sort((a, b) => b.confidence - a.confidence);
}

