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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
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
  { label: "Dívidas", path: "/dividas", icon: HandCoins },
  { label: "Investimentos", path: "/investments", icon: ChartLine },
  { label: "Relatórios", path: "/relatorios", icon: ChartPie },
  { label: "Insights", path: "/insights", icon: Lightbulb },
  { label: "Categorias", path: "/orcamentos", icon: PiggyBank },
  { label: "Lembretes", path: "/lembretes", icon: Bell },
  { label: "Configurações", path: "/configuracoes", icon: Settings },
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
      { label: "Dívidas", path: "/dividas", icon: HandCoins },
      { label: "Investimentos", path: "/investments", icon: ChartLine },
      { label: "Relatórios", path: "/relatorios", icon: ChartPie },
      { label: "Insights", path: "/insights", icon: Lightbulb },
      { label: "Categorias", path: "/orcamentos", icon: PiggyBank },
    ],
  },
  {
    title: "Notificações & Sistema",
    items: [
      { label: "Lembretes", path: "/lembretes", icon: Bell },
      { label: "Configurações", path: "/configuracoes", icon: Settings },
    ],
  },
];



