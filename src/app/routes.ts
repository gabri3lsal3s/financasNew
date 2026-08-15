import { lazy } from "react";
import type { ComponentType } from "react";

const OverviewPage = lazy(() => import("@/features/overview/pages/overview-page").then((m) => ({ default: m.OverviewPage })));
const TransactionListPage = lazy(() =>
  import("@/features/transactions/pages/transaction-list-page").then((m) => ({ default: m.TransactionListPage })),
);
const CardsPage = lazy(() => import("@/features/cards/pages/cards-page").then((m) => ({ default: m.CardsPage })));
const DebtsPage = lazy(() => import("@/features/debts/pages/debts-page").then((m) => ({ default: m.DebtsPage })));
const BudgetsPage = lazy(() => import("@/features/budgets/pages/budgets-page").then((m) => ({ default: m.BudgetsPage })));
const CategoriesPage = lazy(() =>
  import("@/features/categories/pages/categories-page").then((m) => ({ default: m.CategoriesPage })),
);
const ReportsPage = lazy(() => import("@/features/reports/pages/reports-page").then((m) => ({ default: m.ReportsPage })));
const InsightsPage = lazy(() => import("@/features/insights/pages/insights-page").then((m) => ({ default: m.InsightsPage })));
const PortfolioPage = lazy(() => import("@/features/portfolio/pages/portfolio-page").then((m) => ({ default: m.PortfolioPage })));
const InvestmentsPage = lazy(() =>
  import("@/features/investments/pages/investments-page").then((m) => ({ default: m.InvestmentsPage })),
);
const RemindersPage = lazy(() => import("@/features/reminders/pages/reminders-page").then((m) => ({ default: m.RemindersPage })));
const SettingsPage = lazy(() => import("@/features/settings/pages/settings-page").then((m) => ({ default: m.SettingsPage })));

export interface AppRoute {
  path: string;
  /** Componente lazy da página — carregado no primeiro acesso (bundle splitting, F5.5). */
  Component: ComponentType;
}

/** Mapa de rotas — deep-links (?card=, ?month=, ?q=) são parseados nas features (F1+). */
export const appRoutes: AppRoute[] = [
  { path: "/", Component: OverviewPage },
  { path: "/transacoes", Component: TransactionListPage },
  { path: "/cartoes", Component: CardsPage },
  { path: "/dividas", Component: DebtsPage },
  { path: "/orcamentos", Component: BudgetsPage },
  { path: "/categorias", Component: CategoriesPage },
  { path: "/relatorios", Component: ReportsPage },
  { path: "/insights", Component: InsightsPage },
  { path: "/carteira", Component: PortfolioPage },
  { path: "/investments", Component: InvestmentsPage },
  { path: "/lembretes", Component: RemindersPage },
  { path: "/configuracoes", Component: SettingsPage },
];
