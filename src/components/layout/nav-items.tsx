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
import type { SystemFeatureKey } from "@/types";

export interface NavItem {
  label: string;
  shortLabel?: string;
  path: string;
  icon: LucideIcon;
  featureKey?: SystemFeatureKey | string;
  adminOnly?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Fonte única da navegação — usada pela Sidebar, BottomNav e menu "Mais". */
export const navItems: NavItem[] = [
  { label: "Início", shortLabel: "Início", path: "/", icon: House, featureKey: "overview" },
  { label: "Transações", shortLabel: "Extrato", path: "/transacoes", icon: ArrowLeftRight, featureKey: "transactions" },
  { label: "Cartões", shortLabel: "Cartões", path: "/cartoes", icon: CreditCard, featureKey: "cards" },
  { label: "Dívidas", shortLabel: "Dívidas", path: "/dividas", icon: HandCoins, featureKey: "debts" },
  { label: "Investimentos", shortLabel: "Carteira", path: "/investments", icon: ChartLine, featureKey: "investments" },
  { label: "Relatórios", shortLabel: "Relatórios", path: "/relatorios", icon: ChartPie, featureKey: "reports" },
  { label: "Insights", shortLabel: "Insights", path: "/insights", icon: Lightbulb, featureKey: "insights" },
  { label: "Categorias", shortLabel: "Orçamento", path: "/orcamentos", icon: PiggyBank, featureKey: "budgets" },
  { label: "Lembretes", shortLabel: "Lembretes", path: "/lembretes", icon: Bell, featureKey: "reminders" },
  { label: "Configurações", shortLabel: "Ajustes", path: "/configuracoes", icon: Settings },
  { label: "Administração", shortLabel: "Admin", path: "/admin", icon: ShieldCheck, adminOnly: true },
];

/** Grupos semânticos para organização na Sidebar desktop e menu Mais no mobile. */
export const navGroups: NavGroup[] = [
  {
    title: "Dia a Dia",
    items: [
      { label: "Início", shortLabel: "Início", path: "/", icon: House, featureKey: "overview" },
      { label: "Transações", shortLabel: "Extrato", path: "/transacoes", icon: ArrowLeftRight, featureKey: "transactions" },
      { label: "Cartões", shortLabel: "Cartões", path: "/cartoes", icon: CreditCard, featureKey: "cards" },
    ],
  },
  {
    title: "Planejamento & Análise",
    items: [
      { label: "Dívidas", shortLabel: "Dívidas", path: "/dividas", icon: HandCoins, featureKey: "debts" },
      { label: "Investimentos", shortLabel: "Carteira", path: "/investments", icon: ChartLine, featureKey: "investments" },
      { label: "Relatórios", shortLabel: "Relatórios", path: "/relatorios", icon: ChartPie, featureKey: "reports" },
      { label: "Insights", shortLabel: "Insights", path: "/insights", icon: Lightbulb, featureKey: "insights" },
      { label: "Categorias", shortLabel: "Orçamento", path: "/orcamentos", icon: PiggyBank, featureKey: "budgets" },
    ],
  },
  {
    title: "Notificações & Sistema",
    items: [
      { label: "Lembretes", shortLabel: "Lembretes", path: "/lembretes", icon: Bell, featureKey: "reminders" },
      { label: "Configurações", shortLabel: "Ajustes", path: "/configuracoes", icon: Settings },
      { label: "Administração", shortLabel: "Admin", path: "/admin", icon: ShieldCheck, adminOnly: true },
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
