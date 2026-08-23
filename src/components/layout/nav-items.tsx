import {
  ArrowLeftRight,
  Bell,
  ChartLine,
  ChartPie,
  CreditCard,
  HandCoins,
  House,
  Lightbulb,
  PiggyBank,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  featureKey?: string;
  adminOnly?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Fonte única da navegação — usada pela Sidebar, BottomNav e menu "Mais". */
export const navItems: NavItem[] = [
  { label: "Início", path: "/", icon: House },
  { label: "Transações", path: "/transacoes", icon: ArrowLeftRight },
  { label: "Cartões", path: "/cartoes", icon: CreditCard },
  { label: "Dívidas", path: "/dividas", icon: HandCoins, featureKey: "debts" },
  { label: "Investimentos", path: "/investments", icon: ChartLine, featureKey: "investments" },
  { label: "Relatórios", path: "/relatorios", icon: ChartPie, featureKey: "reports" },
  { label: "Insights", path: "/insights", icon: Lightbulb, featureKey: "insights" },
  { label: "Categorias", path: "/orcamentos", icon: PiggyBank, featureKey: "budgets" },
  { label: "Lembretes", path: "/lembretes", icon: Bell, featureKey: "reminders" },
  { label: "Configurações", path: "/configuracoes", icon: Settings },
  { label: "Administração", path: "/admin", icon: ShieldCheck, adminOnly: true },
];

/** Grupos semânticos para organização na Sidebar desktop e menu Mais no mobile. */
export const navGroups: NavGroup[] = [
  {
    title: "Dia a Dia",
    items: [
      { label: "Início", path: "/", icon: House },
      { label: "Transações", path: "/transacoes", icon: ArrowLeftRight },
      { label: "Cartões", path: "/cartoes", icon: CreditCard },
    ],
  },
  {
    title: "Planejamento & Análise",
    items: [
      { label: "Dívidas", path: "/dividas", icon: HandCoins, featureKey: "debts" },
      { label: "Investimentos", path: "/investments", icon: ChartLine, featureKey: "investments" },
      { label: "Relatórios", path: "/relatorios", icon: ChartPie, featureKey: "reports" },
      { label: "Insights", path: "/insights", icon: Lightbulb, featureKey: "insights" },
      { label: "Categorias", path: "/orcamentos", icon: PiggyBank, featureKey: "budgets" },
    ],
  },
  {
    title: "Notificações & Sistema",
    items: [
      { label: "Lembretes", path: "/lembretes", icon: Bell, featureKey: "reminders" },
      { label: "Configurações", path: "/configuracoes", icon: Settings },
      { label: "Administração", path: "/admin", icon: ShieldCheck, adminOnly: true },
    ],
  },
];

/**
 * Filtra itens de navegação baseado no status administrativo e nas Feature Flags ativas.
 */
export function filterNavItems(
  items: readonly NavItem[],
  isAdmin: boolean,
  hasFeature: (key: string) => boolean,
): NavItem[] {
  return items.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.featureKey && !hasFeature(item.featureKey)) return false;
    return true;
  });
}
