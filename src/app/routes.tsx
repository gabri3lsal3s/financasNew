import { lazy } from "react";
import type { ComponentType } from "react";
import { Navigate } from "react-router";

type PageModule = { default: ComponentType };

/**
 * Loaders das páginas — fonte única para o `lazy` das rotas e para o
 * pre-fetching discreto de chunks (F23): `import()` cacheia o módulo, então
 * `lazy(loader)` e `prefetchPageChunks` compartilham o mesmo chunk.
 */
const pageLoaders: Record<string, () => Promise<PageModule>> = {
  "/": () => import("@/features/overview/pages/overview-page").then((m) => ({ default: m.OverviewPage })),
  "/transacoes": () =>
    import("@/features/transactions/pages/transaction-list-page").then((m) => ({ default: m.TransactionListPage })),
  "/cartoes": () => import("@/features/cards/pages/cards-page").then((m) => ({ default: m.CardsPage })),
  "/dividas": () => import("@/features/debts/pages/debts-page").then((m) => ({ default: m.DebtsPage })),
  "/orcamentos": () => import("@/features/budgets/pages/budgets-page").then((m) => ({ default: m.BudgetsPage })),
  "/categorias": () =>
    import("@/features/categories/pages/categories-page").then((m) => ({ default: m.CategoriesPage })),
  "/relatorios": () => import("@/features/reports/pages/reports-page").then((m) => ({ default: m.ReportsPage })),
  "/insights": () => import("@/features/insights/pages/insights-page").then((m) => ({ default: m.InsightsPage })),
  "/investments": () =>
    import("@/features/investments/pages/investments-page").then((m) => ({ default: m.InvestmentsPage })),
  "/lembretes": () => import("@/features/reminders/pages/reminders-page").then((m) => ({ default: m.RemindersPage })),
  "/configuracoes": () =>
    import("@/features/settings/pages/settings-page").then((m) => ({ default: m.SettingsPage })),
};

export interface AppRoute {
  path: string;
  /** Componente lazy da página — carregado no primeiro acesso (bundle splitting, F5.5). */
  Component: ComponentType;
}

/**
 * Unificação da carteira (2026-08-15): a antiga rota `/carteira` foi absorvida
 * pela área única de investimentos (abas Resumo/Metas/Aporte). Redireciona os
 * deep-links antigos (Home, FAB, favoritos) para o hub `/investments`.
 */
function RedirectToInvestments() {
  return <Navigate to="/investments" replace />;
}

/** Mapa de rotas — deep-links (?card=, ?month=, ?q=) são parseados nas features (F1+). */
export const appRoutes: AppRoute[] = [
  ...Object.entries(pageLoaders).map(([path, loader]) => ({ path, Component: lazy(loader) })),
  // /carteira não tem loader próprio — é redirect puro para o hub.
  { path: "/carteira", Component: RedirectToInvestments },
];

/**
 * Pre-fetching discreto de chunks (F23, entrega 3): pré-carrega os módulos
 * das rotas listadas sem renderizá-los. Idempotente (o `import()` cacheia) e
 * silencioso (falha de rede é ignorada — Online First com retry natural na
 * navegação real).
 */
export function prefetchPageChunks(paths: readonly string[]): void {
  for (const path of paths) {
    const loader = pageLoaders[path];
    if (loader) void loader().catch(() => undefined);
  }
}
