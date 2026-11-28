import {
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
    label: "Operação",
    items: [
      { to: "/admin/dashboard", label: "Visão Geral", icon: LayoutDashboard },
      { to: "/admin/usuarios", label: "Usuários", icon: Users, badgeKey: "pendingUsers" },
      { to: "/admin/chamados", label: "Chamados", icon: LifeBuoy, badgeKey: "openTickets" },
    ],
  },
  {
    id: "receita",
    label: "Receita e crescimento",
    items: [
      { to: "/admin/faturamento", label: "Faturamento", icon: Receipt, badgeKey: "pastDue" },
      { to: "/admin/convites", label: "Convites", icon: KeyRound },
    ],
  },
  {
    id: "plataforma",
    label: "Plataforma",
    items: [
      {
        to: "/admin/sistema",
        label: "Sistema",
        icon: SlidersHorizontal,
        badgeKey: "pendingBlueprints",
      },
    ],
  },
  {
    id: "governanca",
    label: "Governança",
    items: [{ to: "/admin/seguranca", label: "Auditoria", icon: ShieldAlert }],
  },
];

export const ADMIN_FORENSICS_NAV_ITEM: AdminNavItem = {
  to: "/admin/laboratorio-forense",
  label: "Laboratório Forense",
  icon: Microscope,
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
