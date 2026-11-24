/**
 * Motor puro de filtragem por escopo PF x PJ (Fase 2A).
 *
 * Regras contábeis:
 * - Visão "all" (Consolidada): exclui sempre `is_internal_transfer === true` para eliminar
 *   dupla contagem mesmo após eventual desativação do Modo Negócio.
 * - Visão "personal": inclui lançamentos `scope = 'personal'` (incluindo entradas de
 *   pró-labore/reembolso de cartão e saídas de aporte de capital PF para PJ).
 * - Visão "business":
 *     - mode "dre" (padrão): apenas `scope = 'business'` e `!is_internal_transfer`;
 *     - mode "cashflow": todo `scope = 'business'` (inclui saídas de pró-labore/reembolso
 *       e entradas de capital injection no caixa PJ).
 */

import type { CreditCardScope, TransactionScope, ViewScope } from "@/types";

export interface ScopedTransactionLike {
  scope?: TransactionScope | null;
  is_internal_transfer?: boolean | null;
}

export interface ScopedDebtLike {
  scope?: TransactionScope | null;
}

export interface ScopedCardLike {
  scope?: CreditCardScope | null;
}

export interface ScopedCategoryLike {
  scope?: "personal" | "business" | "both" | null;
}

export interface ScopeFilterOptions {
  mode?: "dre" | "cashflow";
}

export function filterExpensesByViewScope<T extends ScopedTransactionLike>(
  expenses: readonly T[],
  viewScope: ViewScope,
  options: ScopeFilterOptions = {},
): T[] {
  const mode = options.mode ?? "dre";

  if (viewScope === "all") {
    return expenses.filter((e) => !e.is_internal_transfer);
  }

  if (viewScope === "personal") {
    return expenses.filter((e) => (e.scope ?? "personal") === "personal");
  }

  // viewScope === "business"
  return expenses.filter((e) => {
    if ((e.scope ?? "personal") !== "business") return false;
    if (mode === "dre" && e.is_internal_transfer) return false;
    return true;
  });
}

export function filterIncomesByViewScope<T extends ScopedTransactionLike>(
  incomes: readonly T[],
  viewScope: ViewScope,
  options: ScopeFilterOptions = {},
): T[] {
  const mode = options.mode ?? "dre";

  if (viewScope === "all") {
    return incomes.filter((i) => !i.is_internal_transfer);
  }

  if (viewScope === "personal") {
    return incomes.filter((i) => (i.scope ?? "personal") === "personal");
  }

  // viewScope === "business"
  return incomes.filter((i) => {
    if ((i.scope ?? "personal") !== "business") return false;
    if (mode === "dre" && i.is_internal_transfer) return false;
    return true;
  });
}

export function filterDebtsByViewScope<T extends ScopedDebtLike>(
  debts: readonly T[],
  viewScope: ViewScope,
): T[] {
  if (viewScope === "all") return [...debts];
  return debts.filter((d) => (d.scope ?? "personal") === viewScope);
}

export function filterCardsByViewScope<T extends ScopedCardLike>(
  cards: readonly T[],
  viewScope: ViewScope,
): T[] {
  if (viewScope === "all") return [...cards];
  if (viewScope === "personal") {
    return cards.filter((c) => {
      const s = c.scope ?? "personal";
      return s === "personal" || s === "mixed";
    });
  }
  return cards.filter((c) => c.scope === "business" || c.scope === "mixed");
}

/**
 * Filtra categorias compatíveis com o escopo de lançamento, com fallback seguro
 * para todas as categorias caso não exista nenhuma categoria compatível.
 */
export function filterCategoriesForScope<T extends ScopedCategoryLike>(
  categories: readonly T[],
  targetScope: TransactionScope,
  showAll = false,
): T[] {
  if (showAll) return [...categories];
  const filtered = categories.filter((c) => {
    const s = c.scope ?? "personal";
    return s === "both" || s === targetScope;
  });
  return filtered.length > 0 ? filtered : [...categories];
}

const SCOPED_ROUTE_PREFIXES = [
  "/visao-geral",
  "/transacoes",
  "/cartoes",
  "/orcamentos",
  "/dividas",
  "/relatorios",
  "/insights",
] as const;

/**
 * Indica se a rota atual comporta alternância de visão PF x PJ no <ViewScopeSwitcher />.
 */
export function isScopedRoute(pathname: string): boolean {
  const clean = pathname.trim() || "/";
  if (clean === "/") return true;
  return SCOPED_ROUTE_PREFIXES.some(
    (prefix) => clean === prefix || clean.startsWith(`${prefix}/`),
  );
}
