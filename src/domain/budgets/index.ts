import { numberToCents } from "@/domain/money/parse";

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

export interface CategoryRule {
  /** Nome do ícone (schema `categories.icon` — ver CATEGORY_ICON_MAP). */
  icon: string;
  /** Cor sugerida (hex). */
  color: string;
  /** % da renda sugerida como limite (0–100). */
  limitPercent: number;
}

/** Regras por palavra-chave do nome da categoria (moradia, alimentação, transporte…). */
export const CATEGORY_RULES: Record<string, CategoryRule> = {
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

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  ok: "Dentro do limite",
  attention: "Atenção (≥85%)",
  high: "Alta (≥90%)",
  critical: "Crítica (≥95%)",
  exceeded: "Excedida",
};

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

/** Limite efetivo de um mês: definido, senão o mais recente ANTERIOR (nunca futuro). */
export function resolveEffectiveLimit(
  limits: readonly { month: string; limitCents: number }[],
  month: string,
): number {
  const own = limits.find((l) => l.month === month);
  if (own) return own.limitCents;
  const previous = limits
    .filter((l) => l.month < month)
    .sort((a, b) => (a.month < b.month ? 1 : -1));
  return previous[0]?.limitCents ?? 0;
}

/** Indica se o limite efetivo veio de herança (não definido no mês). */
export function isInheritedLimit(limits: readonly { month: string }[], month: string): boolean {
  return !limits.some((l) => l.month === month);
}

// ---------------------------------------------------------------------------
// Realocação automática (§3.5.2)
// ---------------------------------------------------------------------------

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
    .filter((row) => row.slackCents >= 1000) // folga mínima de R$ 10
    .sort((a, b) => b.slackCents - a.slackCents);

  const from = overspent[0];
  const to = slack[0];
  if (!from || !to || from.categoryId === to.categoryId) return null;

  const transfer = Math.min(from.excessCents, to.slackCents);
  // Arredonda para baixo ao múltiplo de R$ 10 (mínimo R$ 10).
  const rounded = Math.floor(transfer / 1000) * 1000;
  if (rounded < 1000) return null;

  return { fromCategoryId: from.categoryId, toCategoryId: to.categoryId, amountCents: rounded };
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
  expenses: readonly { category_id: string; value: number; report_weight: number }[],
): Map<string, number> {
  const spent = new Map<string, number>();
  for (const expense of expenses) {
    spent.set(expense.category_id, (spent.get(expense.category_id) ?? 0) + numberToCents(expense.value * expense.report_weight));
  }
  return spent;
}
