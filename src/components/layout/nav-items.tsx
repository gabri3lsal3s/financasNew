import {
  ArrowLeftRight,
  Bell,
  ChartPie,
  CreditCard,
  HandCoins,
  House,
  Lightbulb,
  PiggyBank,
  Settings,
  Tags,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

/** Fonte única da navegação — usada pela Sidebar, BottomNav e menu "Mais". */
export const navItems: NavItem[] = [
  { label: "Início", path: "/", icon: House },
  { label: "Transações", path: "/transacoes", icon: ArrowLeftRight },
  { label: "Cartões", path: "/cartoes", icon: CreditCard },
  { label: "Dívidas", path: "/dividas", icon: HandCoins },
  { label: "Orçamentos", path: "/orcamentos", icon: PiggyBank },
  { label: "Categorias", path: "/categorias", icon: Tags },
  { label: "Relatórios", path: "/relatorios", icon: ChartPie },
  { label: "Insights", path: "/insights", icon: Lightbulb },
  { label: "Carteira", path: "/carteira", icon: Wallet },
  { label: "Lembretes", path: "/lembretes", icon: Bell },
  { label: "Configurações", path: "/configuracoes", icon: Settings },
];
