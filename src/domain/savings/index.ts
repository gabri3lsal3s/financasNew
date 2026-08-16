/**
 * Desafios de economia e sugestões de limite — ESPECIFICAÇÃO §3.7.5.
 *
 * Motores puros (testáveis isoladamente):
 *   • Limite mínimo dinâmico: max(R$ 20, 0,5% da renda);
 *   • Desafios de economia: por categoria de alto gasto (10/20/30%) +
 *     desafio "30% em não essenciais"; máx. 4 simultâneos;
 *   • Sugestões de limite: estourou → aumento; uso < 50% com folga
 *     > R$ 50 → redução mantendo 30% de margem; máx. 3/mês.
 *
 * Sem persistência própria: aplicar uma sugestão = definir o limite via
 * `set_budget_limit` existente (o estado dos desafios ativos é derivado).
 */

// ---------------------------------------------------------------------------
// Limite mínimo dinâmico (§3.7.5)
// ---------------------------------------------------------------------------

/** Mínimo fixo de R$ 20. */
export const MIN_FLOOR_CENTS = 2000;

/**
 * Limite mínimo dinâmico = max(R$ 20, 0,5% da renda mensal).
 * Garante que um limite sugerido nunca seja irrealisticamente baixo.
 */
export function dynamicMinLimitCents(monthlyIncomeCents: number): number {
  const percentFloor = Math.round(monthlyIncomeCents * 0.005);
  return Math.max(MIN_FLOOR_CENTS, percentFloor);
}

// ---------------------------------------------------------------------------
// Desafios de economia (§3.7.5)
// ---------------------------------------------------------------------------

export type ChallengePercent = 10 | 20 | 30;

export interface CategorySpend {
  categoryId: string;
  /** Nome da categoria (para exibição). */
  name: string;
  /** Ícone da categoria. */
  icon?: string | null;
  /** Gastos mensais (centavos). */
  monthlyAvgCents: number;
  /** Categoria é essencial (moradia, saúde, educação…)? */
  essential: boolean;
}

export interface ChallengeOption {
  categoryId: string;
  name: string;
  icon?: string | null;
  /** Redução alvo: 10, 20 ou 30%. */
  percent: ChallengePercent;
  /** Meta do desafio = média × (1 − percent/100). */
  targetCents: number;
  /** Economia mensal se atingido = média × percent/100. */
  savingsCents: number;
  /** Limite mínimo dinâmico aplicável (não pode ficar abaixo dele). */
  minLimitCents: number;
}

/** Categoria é de "alto gasto" quando a média mensal ≥ 10% da renda. */
export const HIGH_SPEND_THRESHOLD_PERCENT = 0.1;

/** Máximo de desafios simultâneos. */
export const MAX_ACTIVE_CHALLENGES = 4;

/**
 * Gera as opções de desafio por categoria de alto gasto não essencial:
 * para cada uma, as 3 intensidades (10/20/30%). A meta respeita o limite
 * mínimo dinâmico (uma categoria já perto do piso só recebe 10%).
 */
export function buildChallengeOptions(
  categories: readonly CategorySpend[],
  monthlyIncomeCents: number,
): ChallengeOption[] {
  const minLimit = dynamicMinLimitCents(monthlyIncomeCents);
  const highSpendFloor = Math.round(monthlyIncomeCents * HIGH_SPEND_THRESHOLD_PERCENT);

  const options: ChallengeOption[] = [];
  for (const category of categories) {
    if (category.essential) continue;
    if (category.monthlyAvgCents < highSpendFloor) continue;

    for (const percent of [10, 20, 30] as const) {
      const targetCents = Math.round(category.monthlyAvgCents * (1 - percent / 100));
      // Desafio inviável: a meta cairia abaixo do piso dinâmico.
      if (targetCents < minLimit) continue;
      options.push({
        categoryId: category.categoryId,
        name: category.name,
        icon: category.icon,
        percent,
        targetCents,
        savingsCents: Math.round(category.monthlyAvgCents * (percent / 100)),
        minLimitCents: minLimit,
      });
    }
  }
  return options;
}

/**
 * Seleciona até `max` desafios (default 4), priorizando o maior impacto
 * financeiro e mantendo no máximo uma opção por categoria (a mais forte).
 */
export function pickTopChallenges(options: readonly ChallengeOption[], max = MAX_ACTIVE_CHALLENGES): ChallengeOption[] {
  const byCategory = new Map<string, ChallengeOption>();
  for (const option of [...options].sort((a, b) => b.savingsCents - a.savingsCents)) {
    const current = byCategory.get(option.categoryId);
    if (!current || option.savingsCents > current.savingsCents) {
      byCategory.set(option.categoryId, option);
    }
  }
  return [...byCategory.values()].sort((a, b) => b.savingsCents - a.savingsCents).slice(0, max);
}

export interface DiscretionaryChallenge {
  /** Percentual fixo de redução: 30%. */
  percent: 30;
  /** Soma das médias das categorias não essenciais. */
  totalAvgCents: number;
  /** Meta = total × 0,70. */
  targetCents: number;
  /** Economia mensal = total × 0,30. */
  savingsCents: number;
  /**
   * Quantidade de categorias na base do corte (F27) — permite à UI ocultar
   * a linha agregada quando ela duplica um desafio individual (1 categoria).
   */
  categoryCount: number;
}

/**
 * Desafio "30% em não essenciais": soma de todas as categorias não
 * essenciais com alto gasto; `null` quando não há base de corte.
 */
export function discretionaryChallenge(
  categories: readonly CategorySpend[],
  monthlyIncomeCents: number,
): DiscretionaryChallenge | null {
  const highSpendFloor = Math.round(monthlyIncomeCents * HIGH_SPEND_THRESHOLD_PERCENT);
  const eligible = categories.filter(
    (category) => !category.essential && category.monthlyAvgCents >= highSpendFloor,
  );
  const totalAvgCents = eligible.reduce((acc, category) => acc + category.monthlyAvgCents, 0);
  if (totalAvgCents <= 0) return null;

  return {
    percent: 30,
    totalAvgCents,
    targetCents: Math.round(totalAvgCents * 0.7),
    savingsCents: Math.round(totalAvgCents * 0.3),
    categoryCount: eligible.length,
  };
}

/**
 * Média mensal típica de uma categoria (F27 — precisão dos desafios).
 *
 * Espec §3.7.5 pede "média mensal" — antes a UI passava o gasto do mês
 * atual como se fosse média (impreciso para meses parciais ou atípicos).
 * Média apenas dos meses com gasto > 0: um mês sem consumo não dilui a
 * referência de corte; `0` quando a categoria não gastou em nenhum mês.
 */
export function typicalMonthlySpendCents(monthlyValues: readonly number[]): number {
  const withSpend = monthlyValues.filter((value) => value > 0);
  if (withSpend.length === 0) return 0;
  const total = withSpend.reduce((acc, value) => acc + value, 0);
  return Math.round(total / withSpend.length);
}

// ---------------------------------------------------------------------------
// Sugestões de limite (§3.7.5)
// ---------------------------------------------------------------------------

export type LimitSuggestionKind = "increase" | "reduce";

export interface BudgetUsage {
  categoryId: string;
  name: string;
  icon?: string | null;
  /** Limite efetivo do mês (com herança). */
  limitCents: number;
  /** Gastos do mês na categoria. */
  spentCents: number;
}

export interface LimitSuggestion {
  categoryId: string;
  name: string;
  icon?: string | null;
  kind: LimitSuggestionKind;
  /** Limite atual (efetivo). */
  currentLimitCents: number;
  /** Limite sugerido após a mudança. */
  suggestedLimitCents: number;
  /** Motivo legível (ex.: "Estourou o limite em R$ 40"). */
  reason: string;
}

// Mensagens de motivo das sugestões (F19 — constantes, sem strings soltas).
const INCREASE_REASON = "Estourou o limite (excesso de {amount}).";
const REDUCE_REASON = "Usou só {percent}% do limite — dá para reduzir.";

/** Formata centavos como "R$ 1.234" (sem casas decimais) para mensagens. */
function formatCents(cents: number): string {
  const reais = Math.round(cents / 100);
  return `R$ ${reais.toLocaleString("pt-BR")}`;
}

/** Motivo de aumento (estouro). */
function increaseReason(excessCents: number): string {
  return INCREASE_REASON.replace("{amount}", formatCents(excessCents));
}

/** Motivo de redução (subutilização). */
function reduceReason(percentUsed: number): string {
  return REDUCE_REASON.replace("{percent}", String(Math.round(percentUsed)));
}

/** Folga mínima para sugerir redução: > R$ 50. */
export const REDUCE_SLACK_FLOOR_CENTS = 5000;
/** Uso abaixo de 50% do limite habilita sugestão de redução. */
export const REDUCE_USAGE_PERCENT = 0.5;
/** Margem mantida na redução: 30% do limite. */
export const REDUCE_MARGIN_PERCENT = 0.3;
/** Máximo de sugestões por mês. */
export const MAX_LIMIT_SUGGESTIONS = 3;

/** Arredonda para cima ao múltiplo de R$ 10 (mínimo R$ 10). */
function roundUpToTen(cents: number): number {
  return Math.max(1000, Math.ceil(cents / 1000) * 1000);
}

/**
 * Sugestão de aumento: categoria estourou → novo limite = atual +
 * max(excesso, 15% do limite). Retorna `null` quando não estourou.
 */
export function suggestIncrease(limitCents: number, spentCents: number): number | null {
  if (limitCents <= 0 || spentCents <= limitCents) return null;
  const excess = spentCents - limitCents;
  const buffer = Math.round(limitCents * 0.15);
  return limitCents + Math.max(excess, buffer);
}

/**
 * Sugestão de redução: uso < 50% e folga > R$ 50 → novo limite mantendo
 * 30% de margem (`spent ÷ 0,7`), arredondado para cima a R$ 10 e nunca
 * abaixo do piso dinâmico. Retorna `null` quando não há folga a cortar.
 */
export function suggestReduction(
  limitCents: number,
  spentCents: number,
  monthlyIncomeCents: number,
): number | null {
  if (limitCents <= 0) return null;
  const slack = limitCents - spentCents;
  if (slack <= REDUCE_SLACK_FLOOR_CENTS) return null;
  if (spentCents > limitCents * REDUCE_USAGE_PERCENT) return null;

  const minLimit = dynamicMinLimitCents(monthlyIncomeCents);
  const rawTarget = spentCents / (1 - REDUCE_MARGIN_PERCENT);
  const suggested = roundUpToTen(rawTarget);
  if (suggested >= limitCents) return null;
  return Math.max(minLimit, suggested);
}

/**
 * Gera as sugestões de limite do mês: aumentos para categorias estouradas
 * e reduções para subutilizadas, priorizadas por impacto e limitadas a
 * `max` (default 3). Reduções só quando a folga cortada ≥ R$ 10.
 */
export function buildLimitSuggestions(
  usages: readonly BudgetUsage[],
  monthlyIncomeCents: number,
  max = MAX_LIMIT_SUGGESTIONS,
): LimitSuggestion[] {
  const suggestions: LimitSuggestion[] = [];

  for (const usage of usages) {
    const increase = suggestIncrease(usage.limitCents, usage.spentCents);
    if (increase !== null) {
      suggestions.push({
        categoryId: usage.categoryId,
        name: usage.name,
        icon: usage.icon,
        kind: "increase",
        currentLimitCents: usage.limitCents,
        suggestedLimitCents: increase,
        reason: increaseReason(increase - usage.limitCents),
      });
      continue;
    }

    const reduction = suggestReduction(usage.limitCents, usage.spentCents, monthlyIncomeCents);
    if (reduction !== null && usage.limitCents - reduction >= 1000) {
      suggestions.push({
        categoryId: usage.categoryId,
        name: usage.name,
        icon: usage.icon,
        kind: "reduce",
        currentLimitCents: usage.limitCents,
        suggestedLimitCents: reduction,
        reason: reduceReason((usage.spentCents / usage.limitCents) * 100),
      });
    }
  }

  // Prioriza por impacto absoluto (maior mudança primeiro).
  return suggestions
    .sort((a, b) => Math.abs(b.suggestedLimitCents - b.currentLimitCents) - Math.abs(a.suggestedLimitCents - a.currentLimitCents))
    .slice(0, max);
}
