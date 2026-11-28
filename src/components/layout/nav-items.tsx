import {
  ArrowLeftRight,
  Bell,
  Briefcase,
  ChartLine,
  ChartPie,
  CreditCard,
  HandCoins,
  House,
  PiggyBank,
  Settings,
  Sparkles,
  Tags,
  Users,
  Plane,
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
  familyOnly?: boolean;
  tripOnly?: boolean;
  businessOnly?: boolean;
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
  { label: "Contas & Dívidas", shortLabel: "Contas", path: "/dividas", icon: HandCoins, featureKey: "debts" },
  { label: "Meu Negócio", shortLabel: "Negócio", path: "/negocio", icon: Briefcase, featureKey: "business", businessOnly: true },
  { label: "Modo Viagem", shortLabel: "Viagens", path: "/viagens", icon: Plane, featureKey: "trips", tripOnly: true },
  { label: "Investimentos", shortLabel: "Carteira", path: "/investments", icon: ChartLine, featureKey: "investments" },
  { label: "Orçamentos", shortLabel: "Orçamentos", path: "/orcamentos", icon: PiggyBank, featureKey: "budgets" },
  { label: "Categorias", shortLabel: "Categorias", path: "/categorias", icon: Tags, featureKey: "budgets" },
  { label: "Modo Família", shortLabel: "Família", path: "/familia", icon: Users, featureKey: "family", familyOnly: true },
  { label: "Relatórios", shortLabel: "Relatórios", path: "/relatorios", icon: ChartPie, featureKey: "reports" },
  { label: "Insights", shortLabel: "Insights", path: "/insights", icon: Sparkles, featureKey: "insights" },
  { label: "Lembretes", shortLabel: "Lembretes", path: "/lembretes", icon: Bell, featureKey: "reminders" },
  { label: "Configurações", shortLabel: "Ajustes", path: "/configuracoes", icon: Settings },
];

/** Grupos semânticos para organização na Sidebar desktop e menu Mais no mobile. */
export const navGroups: NavGroup[] = [
  {
    title: "Operações",
    items: [
      { label: "Início", shortLabel: "Início", path: "/", icon: House, featureKey: "overview" },
      { label: "Transações", shortLabel: "Extrato", path: "/transacoes", icon: ArrowLeftRight, featureKey: "transactions" },
      { label: "Cartões", shortLabel: "Cartões", path: "/cartoes", icon: CreditCard, featureKey: "cards" },
      { label: "Contas & Dívidas", shortLabel: "Contas", path: "/dividas", icon: HandCoins, featureKey: "debts" },
      { label: "Meu Negócio", shortLabel: "Negócio", path: "/negocio", icon: Briefcase, featureKey: "business", businessOnly: true },
      { label: "Modo Viagem", shortLabel: "Viagens", path: "/viagens", icon: Plane, featureKey: "trips", tripOnly: true },
    ],
  },
  {
    title: "Estratégia & Análise",
    items: [
      { label: "Investimentos", shortLabel: "Carteira", path: "/investments", icon: ChartLine, featureKey: "investments" },
      { label: "Orçamentos", shortLabel: "Orçamentos", path: "/orcamentos", icon: PiggyBank, featureKey: "budgets" },
      { label: "Categorias", shortLabel: "Categorias", path: "/categorias", icon: Tags, featureKey: "budgets" },
      { label: "Modo Família", shortLabel: "Família", path: "/familia", icon: Users, featureKey: "family", familyOnly: true },
      { label: "Relatórios", shortLabel: "Relatórios", path: "/relatorios", icon: ChartPie, featureKey: "reports" },
      { label: "Insights", shortLabel: "Insights", path: "/insights", icon: Sparkles, featureKey: "insights" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Lembretes", shortLabel: "Lembretes", path: "/lembretes", icon: Bell, featureKey: "reminders" },
      { label: "Configurações", shortLabel: "Ajustes", path: "/configuracoes", icon: Settings },
    ],
  },
];

/**
 * Filtra itens de navegação baseado no status administrativo, presença de família ativa,
 * modo viagem ativo, modo negócio ativo e nas Feature Flags ativas.
 */
export function filterNavItems(
  items: readonly NavItem[],
  isAdmin: boolean,
  hasFeature: (key: string) => boolean,
  isFamilyActive = false,
  isTripActive = false,
  isBusinessActive = false,
): NavItem[] {
  return items.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.familyOnly && !isFamilyActive) return false;
    if (item.tripOnly && !isTripActive) return false;
    if (item.businessOnly && !isBusinessActive) return false;
    if (item.featureKey && !hasFeature(item.featureKey)) return false;
    return true;
  });
}
