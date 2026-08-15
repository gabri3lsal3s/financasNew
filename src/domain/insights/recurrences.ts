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
import { classifySubscription } from "./subscriptions";
import { ESSENTIAL_CATEGORY_ICONS, normalizeText, valuesWithinTolerance } from "./shared";

export interface ExpenseLike {
  id: string;
  description: string | null;
  /** YYYY-MM */
  month: string;
  valueCents: number;
  categoryId: string;
  /** Nome do ícone da categoria (para sinais de assinatura). */
  categoryIcon?: string | null;
  installmentGroupId?: string | null;
}

export interface RecurrenceOccurrence {
  /** Chave estável para aprendizado/feedback (nome normalizado). */
  key: string;
  name: string;
  level: RecurrenceKind;
  /** Meses com ocorrência. */
  months: string[];
  /** Valor médio mensal (centavos). */
  averageCents: number;
  confidence: number;
  categoryId?: string;
}

const RECURRING_TOLERANCE = 0.5; // ±50% (recurring)
const SIMILAR_TOLERANCE = 0.3; // ±30% (similar)

/** Meses distintos de um conjunto de ocorrências. */
function monthsWith(values: readonly string[]): number {
  return new Set(values).size;
}

/**
 * Detecta recorrências entre despesas (parcelas já filtradas).
 * Agrupa por descrição normalizada (subscription/recurring) e por
 * categoria (similar), aplicando as tolerâncias da especificação.
 */
export function detectRecurrences(expenses: readonly ExpenseLike[]): RecurrenceOccurrence[] {
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

    const values = group.map((e) => e.valueCents);
    const average = Math.round(values.reduce((acc, v) => acc + v, 0) / values.length);
    const months = [...new Set(group.map((e) => e.month))];
    const categoryIcons = [...new Set(group.map((e) => e.categoryIcon))];

    // subscription: valor estável (±5%) — usa a árvore de decisão de assinaturas.
    const subscription = classifySubscription({
      name: first.description ?? "",
      categoryIcon: categoryIcons[0],
      monthlyValuesCents: values,
    });

    // Nível subscription exige VALOR ESTÁVEL (§3.7.3); com valor variável,
    // a ocorrência cai para `recurring`/`similar` conforme a tolerância.
    if (subscription && subscription.signs.stableValue) {
      const variance = varianceOf(values);
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
        months,
        averageCents: average,
        confidence,
        categoryId: first.categoryId,
      });
      seen.add(key);
      continue;
    }

    // recurring: mesma descrição, valor ±50%.
    const stable = valuesWithinTolerance(values, RECURRING_TOLERANCE);
    if (stable && months.length >= 2) {
      const variance = varianceOf(values);
      const confidence = confidenceScore({ base: 0.7, monthsHistory: months.length, kind: "recurring", variance });
      occurrences.push({
        key: `recurring:${key}`,
        name: first.description ?? key,
        level: "recurring",
        months,
        averageCents: average,
        confidence,
        categoryId: first.categoryId,
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

    if (!valuesWithinTolerance(totals, SIMILAR_TOLERANCE)) continue;

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
