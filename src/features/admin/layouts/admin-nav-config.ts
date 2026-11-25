import {
  BellRing,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Microscope,
  Receipt,
  ShieldAlert,
  SlidersHorizontal,
  Users,
} from "lucide-react";

export type AdminNavBadgeKey =
  | "pendingUsers"
  | "openTickets"
  | "pastDue"
  | "pendingBlueprints";

export interface AdminNavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badgeKey?: AdminNavBadgeKey;
}

export interface AdminNavGroup {
  id: string;
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "operacao",
    label: "Operação Diária",
    items: [
      { to: "/admin/dashboard", label: "Visão Geral", icon: LayoutDashboard },
      { to: "/admin/usuarios", label: "Usuários", icon: Users, badgeKey: "pendingUsers" },
      { to: "/admin/chamados", label: "Chamados", icon: LifeBuoy, badgeKey: "openTickets" },
    ],
  },
  {
    id: "receita",
    label: "Receita & Crescimento",
    items: [
      { to: "/admin/faturamento", label: "Faturamento", icon: Receipt, badgeKey: "pastDue" },
      { to: "/admin/convites", label: "Convites", icon: KeyRound },
      { to: "/admin/notificacoes", label: "Comunicados", icon: BellRing },
    ],
  },
  {
    id: "plataforma",
    label: "Plataforma & Governança",
    items: [
      {
        to: "/admin/configuracoes",
        label: "Configurações",
        icon: SlidersHorizontal,
        badgeKey: "pendingBlueprints",
      },
      { to: "/admin/seguranca", label: "Auditoria", icon: ShieldAlert },
    ],
  },
];

export const ADMIN_FORENSICS_NAV_ITEM: AdminNavItem = {
  to: "/admin/laboratorio-forense",
  label: "Laboratório Forense",
  icon: Microscope,
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
