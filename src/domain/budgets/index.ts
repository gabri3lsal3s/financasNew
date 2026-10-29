import { numberToCents } from "@/domain/money";

/**
 * Orçamentos e metas de renda — ESPECIFICAÇÃO §3.5.2 / §3.5.3.
 *
 * Motores puros (testáveis isoladamente):
 *   • Sugestão inteligente por nome de categoria (ícone/cor/% da renda);
 *   • Faixas de atenção 85/90/95% + excedido;
 *   • KPI global (% usado com fallback para rendas);
 *   • Herança de limite do mês anterior;
 *   • Recomendação de realocação (maior excesso → maior folga).
 */

// ---------------------------------------------------------------------------
// Sugestão inteligente por nome (§3.5.1)
// ---------------------------------------------------------------------------

export interface DefaultCategorySeed {
  name: string;
  type: "expense" | "income";
  icon: string;
  color: string;
}

export const CANONICAL_DEFAULT_CATEGORIES: readonly DefaultCategorySeed[] = [
  // Despesas Essenciais (Necessidades 50%)
  { name: "Alimentação", type: "expense", icon: "alimentacao", color: "#DDA726" },
  { name: "Moradia", type: "expense", icon: "moradia", color: "#8B5CF6" },
  { name: "Transporte", type: "expense", icon: "transporte", color: "#3B82F6" },
  { name: "Saúde", type: "expense", icon: "saude", color: "#EF4444" },
  { name: "Educação", type: "expense", icon: "educacao", color: "#2A9D8F" },
  // Despesas de Estilo de Vida (Desejos 30% / Radar de Assinaturas)
  { name: "Lazer", type: "expense", icon: "lazer", color: "#EC4899" },
  { name: "Compras", type: "expense", icon: "compras", color: "#06B6D4" },
  { name: "Assinaturas", type: "expense", icon: "assinaturas", color: "#6366F1" },
  // Receitas
  { name: "Salário", type: "income", icon: "salario", color: "#10B981" },
  { name: "Investimentos", type: "income", icon: "investimentos", color: "#3B82F6" },
  { name: "Outras Rendas", type: "income", icon: "salario", color: "#8B5CF6" },
] as const;

export interface CategoryRule {
  /** Nome do ícone (schema `categories.icon` — ver CATEGORY_ICON_MAP). */
  icon: string;
  /** Cor sugerida (hex). */
  color: string;
  /** % da renda sugerida como limite (0–100). */
  limitPercent: number;
}

/** Regras por palavra-chave do nome da categoria (moradia, alimentação, transporte…). */
const CATEGORY_RULES: Record<string, CategoryRule> = {
  moradia: { icon: "moradia", color: "#8B5CF6", limitPercent: 30 },
  aluguel: { icon: "moradia", color: "#8B5CF6", limitPercent: 30 },
  casa: { icon: "moradia", color: "#8B5CF6", limitPercent: 30 },
  alimentacao: { icon: "alimentacao", color: "#DDA726", limitPercent: 15 },
  mercado: { icon: "mercado", color: "#DDA726", limitPercent: 15 },
  supermercado: { icon: "mercado", color: "#DDA726", limitPercent: 15 },
  restaurante: { icon: "alimentacao", color: "#DDA726", limitPercent: 10 },
  transporte: { icon: "transporte", color: "#3B82F6", limitPercent: 10 },
  combustivel: { icon: "transporte", color: "#3B82F6", limitPercent: 10 },
  saude: { icon: "saude", color: "#EF4444", limitPercent: 10 },
  farmacia: { icon: "saude", color: "#EF4444", limitPercent: 10 },
  medico: { icon: "saude", color: "#EF4444", limitPercent: 10 },
  educacao: { icon: "educacao", color: "#2A9D8F", limitPercent: 10 },
  curso: { icon: "educacao", color: "#2A9D8F", limitPercent: 10 },
  escola: { icon: "educacao", color: "#2A9D8F", limitPercent: 10 },
  faculdade: { icon: "educacao", color: "#2A9D8F", limitPercent: 10 },
  lazer: { icon: "lazer", color: "#EC4899", limitPercent: 5 },
  entretenimento: { icon: "lazer", color: "#EC4899", limitPercent: 5 },
  compras: { icon: "compras", color: "#06B6D4", limitPercent: 10 },
  vestuario: { icon: "vestuario", color: "#06B6D4", limitPercent: 10 },
  roupas: { icon: "vestuario", color: "#06B6D4", limitPercent: 10 },
  assinatura: { icon: "assinaturas", color: "#6366F1", limitPercent: 5 },
  assinaturas: { icon: "assinaturas", color: "#6366F1", limitPercent: 5 },
  telefone: { icon: "telefone", color: "#6366F1", limitPercent: 5 },
  internet: { icon: "internet", color: "#6366F1", limitPercent: 5 },
  energia: { icon: "energia", color: "#FACC15", limitPercent: 8 },
  agua: { icon: "agua", color: "#38BDF8", limitPercent: 5 },
};

/** Remove acentos ("Alimentação" → "alimentacao") para casar com as regras. */
function normalizeKeyword(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Sugestão para o nome de uma categoria de despesa (ícone/cor/% da renda). */
export function suggestCategory(name: string): CategoryRule | null {
  const normalized = normalizeKeyword(name);
  if (!normalized) return null;
  for (const [keyword, rule] of Object.entries(CATEGORY_RULES)) {
    if (normalized.includes(keyword)) return rule;
  }
  return null;
}

/** Limite sugerido em centavos a partir da renda mensal (arredondado para baixo a R$ 10). */
export function suggestLimitCents(monthlyIncomeCents: number, limitPercent: number): number {
  if (monthlyIncomeCents <= 0 || limitPercent <= 0) return 0;
  const raw = Math.floor((monthlyIncomeCents * limitPercent) / 100);
  return Math.max(1000, Math.floor(raw / 1000) * 1000);
}

// ---------------------------------------------------------------------------
// Faixas de atenção (§3.5.2) — 85/90/95/excedido
// ---------------------------------------------------------------------------

export type BudgetStatus = "ok" | "attention" | "high" | "critical" | "exceeded";


/** Faixa de atenção pelo percentual de uso (0–100+). */
export function budgetStatus(usedCents: number, limitCents: number): BudgetStatus {
  if (limitCents <= 0) return "ok";
  const percent = (usedCents / limitCents) * 100;
  if (percent > 100) return "exceeded";
  if (percent >= 95) return "critical";
  if (percent >= 90) return "high";
  if (percent >= 85) return "attention";
  return "ok";
}

/** Valor excedido em centavos (> 0 quando a categoria estourou). */
export function exceededCents(usedCents: number, limitCents: number): number {
  return Math.max(0, usedCents - limitCents);
}

/** Cor do progresso global (§3.5.2): ≥85% vermelho, ≥70% amarelo, senão verde. */
export function progressTone(percent: number): "critical" | "warning" | "positive" {
  if (percent >= 85) return "critical";
  if (percent >= 70) return "warning";
  return "positive";
}

/** % global usado: min(100, despesas ÷ (totalLimites || rendas)) — 0 quando não há base. */
export function globalUsedPercent(expensesCents: number, totalLimitsCents: number, incomesCents: number): number {
  const base = totalLimitsCents > 0 ? totalLimitsCents : incomesCents;
  if (base <= 0) return 0;
  return Math.min(100, (expensesCents / base) * 100);
}

// ---------------------------------------------------------------------------
// Herança de limite (§3.5.2) — fallback para exibição/alerta
// ---------------------------------------------------------------------------

export type BudgetLimitType = "explicit" | "inherited" | "none";

export interface ResolvedBudgetLimit {
  limitCents: number;
  type: BudgetLimitType;
  /** Se o limite é zero explícito definido pelo usuário no próprio mês */
  isExplicitZero: boolean;
  /** Se o limite veio herdado de um mês anterior */
  isInherited: boolean;
  /** Se a categoria possui limite ativo (próprio ou herdado, inclusive limite 0) */
  hasLimit: boolean;
}

/**
 * Resolve detalhadamente a vigência e a origem do limite orçamentário.
 * Diferencia explicitamente:
 * 1. Limite explícito no mês atual (inclusive zero explícito `limitCents === 0`);
 * 2. Ausência de limite no mês atual que herda o limite do mês anterior mais recente;
 * 3. Ausência total de limites cadastrados (nem atual nem anterior).
 */
export function resolveBudgetLimitDetails(
  limits: readonly { month: string; limitCents?: number | null }[],
  month: string,
): ResolvedBudgetLimit {
  const own = limits.find((l) => l.month === month);
  const hasOwnDefined = own !== undefined && own.limitCents !== null && own.limitCents !== undefined;

  if (hasOwnDefined) {
    const limitCents = own.limitCents ?? 0;
    return {
      limitCents,
      type: "explicit",
      isExplicitZero: limitCents === 0,
      isInherited: false,
      hasLimit: true,
    };
  }

  const previous = limits
    .filter((l) => l.month < month && l.limitCents !== null && l.limitCents !== undefined)
    .sort((a, b) => (a.month < b.month ? 1 : -1));

  const prevEntry = previous[0];
  if (prevEntry !== undefined && prevEntry.limitCents !== null && prevEntry.limitCents !== undefined) {
    const limitCents = prevEntry.limitCents;
    return {
      limitCents,
      type: "inherited",
      isExplicitZero: false,
      isInherited: true,
      hasLimit: true,
    };
  }

  return {
    limitCents: 0,
    type: "none",
    isExplicitZero: false,
    isInherited: false,
    hasLimit: false,
  };
}

/** Limite efetivo de um mês: definido (inclusive 0 explícito), senão o mais recente ANTERIOR (nunca futuro). */
export function resolveEffectiveLimit(
  limits: readonly { month: string; limitCents?: number | null }[],
  month: string,
): number {
  return resolveBudgetLimitDetails(limits, month).limitCents;
}

/**
 * Indica se o limite efetivo veio de herança:
 * Retorna true se e somente se o mês atual NÃO possui limite próprio definido
 * E existe um limite anterior válido que foi herdado.
 */
export function isInheritedLimit(
  limits: readonly { month: string; limitCents?: number | null }[],
  month: string,
): boolean {
  const own = limits.find((l) => l.month === month);
  const hasOwnDefined = own !== undefined && own.limitCents !== null && own.limitCents !== undefined;
  if (hasOwnDefined) {
    return false;
  }
  return limits.some(
    (l) => l.month < month && l.limitCents !== null,
  );
}

/**
 * Verifica se a categoria possui um limite zero explícito definido no mês
 * (intencionalmente zerada, em oposição a ausência de limite).
 */
export function isExplicitZeroLimit(
  limits: readonly { month: string; limitCents?: number | null }[],
  month: string,
): boolean {
  const own = limits.find((l) => l.month === month);
  return own !== undefined && own.limitCents === 0;
}

// ---------------------------------------------------------------------------
// Realocação automática (§3.5.2)
// ---------------------------------------------------------------------------

/** Múltiplo mínimo e piso de realocação de orçamentos: R$ 10,00 (1.000 centavos) — ESPECIFICAÇÃO §3.5.2. */
export const REALLOCATION_MIN_CENTS = 1000;

/**
 * Arredonda um valor em centavos para o múltiplo inferior de R$ 10 (1.000 centavos).
 * Valores menores que o piso de R$ 10 retornam 0.
 */
export function roundToReallocationMultiple(cents: number): number {
  if (cents < REALLOCATION_MIN_CENTS) return 0;
  return Math.floor(cents / REALLOCATION_MIN_CENTS) * REALLOCATION_MIN_CENTS;
}

/**
 * Valida se um valor de realocação respeita estritamente as regras de negócio (§3.5.2):
 *   • Número inteiro estrito (centavos);
 *   • Maior ou igual a R$ 10 (1.000 centavos);
 *   • Múltiplo exato de R$ 10 (resto zero na divisão por 1.000 centavos).
 */
export function isValidReallocationAmount(amountCents: number): boolean {
  return (
    Number.isInteger(amountCents) &&
    amountCents >= REALLOCATION_MIN_CENTS &&
    amountCents % REALLOCATION_MIN_CENTS === 0
  );
}

export interface BudgetRow {
  categoryId: string;
  /** Limite efetivo do mês (com herança). */
  limitCents: number;
  /** Gastos do mês na categoria (com peso). */
  spentCents: number;
}

export interface ReallocationSuggestion {
  fromCategoryId: string;
  toCategoryId: string;
  /** Valor a transferir em centavos (múltiplo de 10, mínimo R$ 10). */
  amountCents: number;
}

/**
 * Categoria com MAIOR excesso transfere para a com MAIOR folga.
 * Valor = min(excesso, folga) arredondado ao múltiplo de R$ 10 (mínimo R$ 10);
 * origem nunca fica negativa (garantido por min). `null` quando não há
 * realocação possível (sem excesso ou sem folga suficiente p/ R$ 10).
 */
export function reallocationSuggestion(rows: readonly BudgetRow[]): ReallocationSuggestion | null {
  const overspent = rows
    .map((row) => ({ ...row, excessCents: exceededCents(row.spentCents, row.limitCents) }))
    .filter((row) => row.excessCents > 0)
    .sort((a, b) => b.excessCents - a.excessCents);
  const slack = rows
    .map((row) => ({ ...row, slackCents: Math.max(0, row.limitCents - row.spentCents) }))
    .filter((row) => row.slackCents >= REALLOCATION_MIN_CENTS) // folga mínima de R$ 10
    .sort((a, b) => b.slackCents - a.slackCents);

  const overspentCat = overspent[0];
  const slackCat = slack[0];
  if (!overspentCat || !slackCat || overspentCat.categoryId === slackCat.categoryId) return null;

  const transfer = Math.min(overspentCat.excessCents, slackCat.slackCents);
  // Arredonda para baixo ao múltiplo de R$ 10 (mínimo R$ 10).
  const rounded = roundToReallocationMultiple(transfer);
  if (rounded < REALLOCATION_MIN_CENTS) return null;

  // Origem: categoria com folga/sobra; Destino: categoria com excesso/estouro.
  return { fromCategoryId: slackCat.categoryId, toCategoryId: overspentCat.categoryId, amountCents: rounded };
}

// ---------------------------------------------------------------------------
// Metas de renda (§3.5.3)
// ---------------------------------------------------------------------------

export type IncomeGoalStatus = "deficit" | "on_track" | "surplus";

/** Compara realizado × esperado por categoria de renda (déficit de receita). */
export function incomeGoalStatus(realizedCents: number, expectedCents: number): IncomeGoalStatus {
  if (expectedCents <= 0) return "on_track";
  if (realizedCents < expectedCents) return "deficit";
  if (realizedCents > expectedCents) return "surplus";
  return "on_track";
}

export const INCOME_GOAL_LABELS: Record<IncomeGoalStatus, string> = {
  deficit: "Abaixo da meta",
  on_track: "Na meta",
  surplus: "Acima da meta",
};

// ---------------------------------------------------------------------------
// Helpers compartilhados de agregação (F19) — usados em Overview, Budgets e
// Insights (DRY: o padrão limitsByCategory/spentByCategory se repetia em 3 páginas)
// ---------------------------------------------------------------------------

/** Limite mensal de uma categoria, já em centavos. */
export interface BudgetLimitEntry {
  /** YYYY-MM */
  month: string;
  limitCents: number;
}

/**
 * Agrupa os limites mensais por categoria (histórico de cada categoria —
 * necessário para a herança `resolveEffectiveLimit`). Converte `limit`
 * (reais) para centavos na borda — fonte única da agregação.
 */
export function budgetLimitsByCategory(
  budgets: readonly { category_id: string; month: string; limit: number }[],
): Map<string, BudgetLimitEntry[]> {
  const byCategory = new Map<string, BudgetLimitEntry[]>();
  for (const budget of budgets) {
    const list = byCategory.get(budget.category_id) ?? [];
    list.push({ month: budget.month, limitCents: numberToCents(budget.limit) });
    byCategory.set(budget.category_id, list);
  }
  return byCategory;
}

/**
 * Soma os gastos ponderados (peso de relatório) por categoria — fonte única
 * da agregação usada em Overview/Budgets/Insights.
 */
export function spentByCategoryMap(
  expenses: readonly { category_id: string; value: number; report_weight?: number | null }[],
): Map<string, number> {
  const spent = new Map<string, number>();
  for (const expense of expenses) {
    const rawWeight = expense.report_weight;
    const cents =
      rawWeight === undefined || rawWeight === null || rawWeight === 1
        ? numberToCents(expense.value)
        : Math.round(numberToCents(expense.value) * (Number.isFinite(rawWeight) ? Math.max(0, rawWeight) : 1));
    spent.set(expense.category_id, (spent.get(expense.category_id) ?? 0) + cents);
  }
  return spent;
}

/**
 * Soma os gastos brutos (valor total nominal sem ponderação) por categoria.
 */
export function spentGrossByCategoryMap(
  expenses: readonly { category_id: string; value: number }[],
): Map<string, number> {
  const spent = new Map<string, number>();
  for (const expense of expenses) {
    spent.set(expense.category_id, (spent.get(expense.category_id) ?? 0) + numberToCents(expense.value));
  }
  return spent;
}

/**
 * Soma as receitas realizadas ponderadas (peso de relatório) por categoria — fonte única
 * da agregação usada em Budgets e Insights.
 */
export function realizedByCategoryMap(
  incomes: readonly { category_id: string; value: number; report_weight?: number | null }[],
): Map<string, number> {
  const realized = new Map<string, number>();
  for (const income of incomes) {
    const rawWeight = income.report_weight;
    const cents =
      rawWeight === undefined || rawWeight === null || rawWeight === 1
        ? numberToCents(income.value)
        : Math.round(numberToCents(income.value) * (Number.isFinite(rawWeight) ? Math.max(0, rawWeight) : 1));
    realized.set(
      income.category_id,
      (realized.get(income.category_id) ?? 0) + cents,
    );
  }
  return realized;
}


export {
  redistributeProportionalBudget,
  redistributeProportionalBudgetByPercent,
} from "./proportional";
export type {
  ProportionalCategoryInput,
  ProportionalCategoryOutput,
  ProportionalBudgetResult,
} from "./proportional";
export * from "./schemas";

