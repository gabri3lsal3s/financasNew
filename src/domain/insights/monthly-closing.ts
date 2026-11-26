/**
 * Ritual de Fechamento Mensal (dias 1 a 5 sobre M-1 encerrado) — PLANO MESTRE FASE 6.
 *
 * Gera resumo do mês encerrado: resultado real (receitas, despesas, saldo, taxa de poupança),
 * 1 conquista destacada e até 2 ajustes estruturais de orçamento via `buildLimitSuggestions`.
 *
 * 100% puro — zero dependências de React, UI ou Supabase.
 */

import { budgetLimitsByCategory, resolveEffectiveLimit, spentByCategoryMap } from "@/domain/budgets/index";
import { numberToCents } from "@/domain/money/parse";
import { buildLimitSuggestions, type BudgetUsage, type LimitSuggestion } from "@/domain/savings/index";
import { shiftMonth } from "@/lib/date";
import type { Budget, Category, Expense, Income } from "@/types";
import { resolveCategorySemantics } from "./category-semantics";

export interface MonthlyClosingSummary {
  closedMonth: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  savingsRatePercent: number | null;
  highlightAchievement: string;
  limitSuggestions: LimitSuggestion[];
}

export interface BuildMonthlyClosingInput {
  currentMonth: string;
  dayOfMonth: number;
  dismissedMonth?: string | null;
  closedMonthExpenses: readonly Expense[];
  closedMonthIncomes: readonly Income[];
  budgets: readonly Budget[];
  categories: readonly Category[];
}

/**
 * Avalia se o Ritual de Fechamento Mensal deve ser exibido (dias 1 a 5, não dispensado,
 * e com movimentação real em M-1) e constrói o resumo consolidado.
 */
export function buildMonthlyClosingSummary(
  input: BuildMonthlyClosingInput,
): MonthlyClosingSummary | null {
  if (input.dayOfMonth < 1 || input.dayOfMonth > 5) {
    return null;
  }

  const closedMonth = shiftMonth(input.currentMonth, -1);
  if (input.dismissedMonth === closedMonth) {
    return null;
  }

  if (input.closedMonthExpenses.length === 0 && input.closedMonthIncomes.length === 0) {
    return null;
  }

  const incomeCents = input.closedMonthIncomes
    .filter((i) => !i.source_ref?.startsWith("[REFUND]"))
    .reduce((acc, i) => acc + numberToCents(i.value * (i.report_weight ?? 1)), 0);

  const expenseCents = input.closedMonthExpenses.reduce(
    (acc, e) => acc + numberToCents(e.value * (e.report_weight ?? 1)),
    0,
  );

  const balanceCents = incomeCents - expenseCents;
  const savingsRatePercent =
    incomeCents > 0 ? Math.round((balanceCents / incomeCents) * 100) : null;

  const limitsByCategory = budgetLimitsByCategory(input.budgets);
  const spentByCategory = spentByCategoryMap(input.closedMonthExpenses);

  const usages: BudgetUsage[] = input.categories
    .filter((c) => c.type === "expense" && c.is_active)
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      icon: c.icon,
      limitCents: resolveEffectiveLimit(limitsByCategory.get(c.id) ?? [], closedMonth),
      spentCents: spentByCategory.get(c.id) ?? 0,
      essential: !resolveCategorySemantics({ name: c.name, icon: c.icon }).isCuttableCategory,
    }))
    .filter((u) => u.limitCents > 0);

  const limitSuggestions = buildLimitSuggestions(usages, incomeCents, 2, {
    isMonthClosedOrLate: true,
  });

  const allBudgetsRespected =
    usages.length > 0 && usages.every((u) => u.spentCents <= u.limitCents);

  let highlightAchievement = "Mês encerrado e consolidado no seu histórico.";
  if (savingsRatePercent !== null && savingsRatePercent >= 20) {
    highlightAchievement = `Você poupou ${savingsRatePercent}% da renda no mês encerrado.`;
  } else if (allBudgetsRespected) {
    highlightAchievement = "Todas as categorias com teto ficaram dentro do limite.";
  } else if (balanceCents > 0) {
    highlightAchievement = "Você fechou o mês anterior no azul.";
  }

  return {
    closedMonth,
    incomeCents,
    expenseCents,
    balanceCents,
    savingsRatePercent,
    highlightAchievement,
    limitSuggestions,
  };
}
