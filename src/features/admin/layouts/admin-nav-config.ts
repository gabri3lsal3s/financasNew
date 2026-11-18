import {
  BellRing,
  Database,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  ShieldAlert,
  SlidersHorizontal,
  Users,
} from "lucide-react";

export interface AdminNavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard & Métricas", icon: LayoutDashboard },
  { to: "/admin/usuarios", label: "Gestão de Usuários", icon: Users },
  { to: "/admin/notificacoes", label: "Notificações & Push", icon: BellRing },
  { to: "/admin/faturamento", label: "Faturamento & Asaas", icon: Receipt },
  { to: "/admin/chamados", label: "Chamados de Suporte", icon: LifeBuoy },
  { to: "/admin/convites", label: "Convites & Allowlist", icon: KeyRound },
  { to: "/admin/backups", label: "Backups & DRP", icon: Database },
  { to: "/admin/seguranca", label: "Auditoria & LGPD", icon: ShieldAlert },
  { to: "/admin/configuracoes", label: "Sistema & APK Beta", icon: SlidersHorizontal },
];
