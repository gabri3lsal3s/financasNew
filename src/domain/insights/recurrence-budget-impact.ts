/**
 * Avaliação de impacto orçamentário e identificação de "gastos vampiros" em custos fixos e assinaturas.
 * Extraído de recurrences.ts para modularização canônica.
 */

import type { CutTier } from "./subscriptions";
import type { RecurrenceKind } from "./confidence";

export const VAMPIRE_INCOME_IMPACT_THRESHOLD_PERCENT = 15;
export const VAMPIRE_CATEGORY_BUDGET_IMPACT_THRESHOLD_PERCENT = 30;

export interface BudgetImpactOccurrence {
  name?: string;
  averageCents: number;
  tier?: CutTier;
  level?: RecurrenceKind;
  key?: string;
}

export interface BudgetImpactEvaluation {
  /** Custo projetado anual em centavos (averageCents * 12). */
  annualCostCents: number;
  /** Valor monetário anual formatado (ex.: "R$ 1.080,00"). */
  annualCostFormatted: string;
  /** Mensagem editorial canônica com o custo anual projetado (ex.: "Essa assinatura custa R$ 1.080,00 por ano"). */
  annualCostMessage: string;
  /** Percentual da renda mensal comprometido por este gasto recorrente (0–100). */
  incomeSharePercent: number;
  /** Sinaliza se o gasto compromete >= 15% da renda mensal. */
  highIncomeImpact: boolean;
  /** Percentual do orçamento da categoria comprometido (0–100). */
  categoryBudgetSharePercent: number;
  /** Sinaliza se o gasto compromete >= 30% do orçamento da categoria. */
  highCategoryBudgetImpact: boolean;
  /** Sinaliza alto impacto orçamentário geral (renda >= 15% OU categoria >= 30%). */
  hasHighBudgetImpact: boolean;
  /**
   * Sinaliza se é considerado "gasto vampiro":
   * Assinatura ou recorrência com potencial de corte (can_cut / review)
   * ou com alto impacto orçamentário sem ser uma despesa essencial.
   */
  isVampire: boolean;
  /** Mensagem editorial de recomendação ou alerta para apresentação (ex.: no SmartAdvisorCard). */
  recommendationMessage?: string;
}

/** Formata centavos em moeda BRL pura (ex.: 108000 -> "R$ 1.080,00"). */
export function formatBRL(cents: number): string {
  const safe = Number.isFinite(cents) && cents >= 0 ? Math.round(cents) : 0;
  const reais = (safe / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `R$ ${reais}`;
}

/**
 * Avalia o impacto orçamentário e identifica "gastos vampiros" (Fase 4, Tarefa 4.2).
 *
 * Função pura que:
 *   1. Calcula o custo anual projetado (`averageCents * 12`) e gera a mensagem editorial
 *      (ex.: "Essa assinatura custa R$ 1.080,00 por ano");
 *   2. Sinaliza alto impacto quando compromete >= 15% da renda mensal ou >= 30% do orçamento da categoria;
 *   3. Identifica "gastos vampiros" (assinaturas com potencial de corte/revisão ou com alto impacto
 *      orçamentário que não sejam despesas essenciais).
 */
export function evaluateBudgetImpact(
  occurrence: BudgetImpactOccurrence,
  monthlyIncomeCents?: number,
  categoryBudgetCents?: number,
): BudgetImpactEvaluation {
  const safeAverageCents =
    Number.isFinite(occurrence.averageCents) && occurrence.averageCents > 0
      ? Math.round(occurrence.averageCents)
      : 0;

  const annualCostCents = safeAverageCents * 12;
  const annualCostFormatted = formatBRL(annualCostCents);
  const annualCostMessage = `Essa assinatura custa ${annualCostFormatted} por ano`;

  let incomeSharePercent = 0;
  let highIncomeImpact = false;
  if (typeof monthlyIncomeCents === "number" && monthlyIncomeCents > 0 && safeAverageCents > 0) {
    const rawShare = (safeAverageCents / monthlyIncomeCents) * 100;
    incomeSharePercent = Number(rawShare.toFixed(2));
    highIncomeImpact = rawShare >= VAMPIRE_INCOME_IMPACT_THRESHOLD_PERCENT - 1e-9;
  }

  let categoryBudgetSharePercent = 0;
  let highCategoryBudgetImpact = false;
  if (typeof categoryBudgetCents === "number" && categoryBudgetCents > 0 && safeAverageCents > 0) {
    const rawShare = (safeAverageCents / categoryBudgetCents) * 100;
    categoryBudgetSharePercent = Number(rawShare.toFixed(2));
    highCategoryBudgetImpact = rawShare >= VAMPIRE_CATEGORY_BUDGET_IMPACT_THRESHOLD_PERCENT - 1e-9;
  }

  const hasHighBudgetImpact = highIncomeImpact || highCategoryBudgetImpact;
  const isEssential = occurrence.tier === "essential";
  const isVampire =
    safeAverageCents > 0 &&
    !isEssential &&
    (occurrence.tier === "can_cut" || occurrence.tier === "discretionary" || hasHighBudgetImpact);

  let recommendationMessage: string | undefined;
  if (highIncomeImpact && highCategoryBudgetImpact) {
    recommendationMessage = `Compromete ${incomeSharePercent}% da sua renda e ${categoryBudgetSharePercent}% do orçamento da categoria.`;
  } else if (highIncomeImpact) {
    recommendationMessage = `Compromete ${incomeSharePercent}% da sua renda mensal.`;
  } else if (highCategoryBudgetImpact) {
    recommendationMessage = `Compromete ${categoryBudgetSharePercent}% do orçamento da categoria.`;
  } else if (occurrence.tier === "can_cut") {
    recommendationMessage = `Assinatura com potencial de corte. Economia projetada de ${annualCostFormatted} por ano.`;
  } else if (occurrence.tier === "discretionary") {
    recommendationMessage = `Gasto discricionário sugerido para revisão.`;
  }

  return {
    annualCostCents,
    annualCostFormatted,
    annualCostMessage,
    incomeSharePercent,
    highIncomeImpact,
    categoryBudgetSharePercent,
    highCategoryBudgetImpact,
    hasHighBudgetImpact,
    isVampire,
    recommendationMessage,
  };
}
