import type { ReactElement } from "react";
import { OverviewPage } from "@/features/overview";
import { TransactionListPage } from "@/features/transactions";
import { CardsPage } from "@/features/cards";
import { DebtsPage } from "@/features/debts";
import { BudgetsPage } from "@/features/budgets";
import { ReportsPage } from "@/features/reports";
import { InsightsPage } from "@/features/insights";
import { PortfolioPage } from "@/features/portfolio";
import { RemindersPage } from "@/features/reminders";
import { SettingsPage } from "@/features/settings";

export interface AppRoute {
  path: string;
  element: ReactElement;
}

/** Mapa de rotas — deep-links (?card=, ?month=, ?q=) são parseados nas features (F1+). */
export const appRoutes: AppRoute[] = [
  { path: "/", element: <OverviewPage /> },
  { path: "/transacoes", element: <TransactionListPage /> },
  { path: "/cartoes", element: <CardsPage /> },
  { path: "/dividas", element: <DebtsPage /> },
  { path: "/orcamentos", element: <BudgetsPage /> },
  { path: "/relatorios", element: <ReportsPage /> },
  { path: "/insights", element: <InsightsPage /> },
  { path: "/carteira", element: <PortfolioPage /> },
  { path: "/lembretes", element: <RemindersPage /> },
  { path: "/configuracoes", element: <SettingsPage /> },
];
