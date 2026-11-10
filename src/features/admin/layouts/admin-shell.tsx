import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import {
  Activity,
  BellRing,
  Database,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { BrandLogo } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { useUserAccess } from "@/state";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

interface AdminNavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
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

export function AdminShell() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { signOut } = useSignOut();
  const { profile, role, isSuperAdmin } = useUserAccess(session?.user?.id);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    triggerSensory("action");
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* --- TOPBAR INSTITUCIONAL ADMINISTRATIVA --- */}
      <header className="sticky top-0 z-40 flex h-[calc(4rem+max(env(safe-area-inset-top,0px),var(--safe-area-top,0px)))] pt-[max(env(safe-area-inset-top,0px),var(--safe-area-top,0px))] w-full items-center justify-between border-b border-border/80 bg-surface/95 px-4 backdrop-blur-xs sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-xl border border-border/80 bg-surface text-muted-foreground hover:text-foreground md:hidden"
            onClick={() => {
              triggerSensory("selection");
              setMobileMenuOpen((prev) => !prev);
            }}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu administrativo"}
          >
            {mobileMenuOpen ? (
              <X className="size-4.5" aria-hidden="true" />
            ) : (
              <Menu className="size-4.5" aria-hidden="true" />
            )}
          </button>

          <Link to="/admin/dashboard" className="flex items-center gap-2.5">
            <BrandLogo markClassName="size-8 drop-shadow-xs" showWordmark={false} />
            <div className="flex flex-col">
              <span className="font-display text-sm font-bold tracking-tight text-foreground sm:text-base leading-none">
                Axir Command Center
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Governança &amp; Operações
              </span>
            </div>
          </Link>
        </div>

        {/* Telemetria de Produção e Ações de Operador */}
        <div className="flex items-center gap-3">
          {/* Indicador de Saúde do Sistema */}
          <div className="hidden lg:flex items-center gap-2 rounded-full border border-border/80 bg-background/60 px-3 py-1 text-xs text-muted-foreground">
            <span className="flex size-2 rounded-full bg-positive-strong animate-pulse" />
            <Activity className="size-3.5 text-positive-strong" aria-hidden="true" />
            <span className="font-mono text-[11px]">Banco &amp; Serviços Operacionais</span>
          </div>

          {/* Atalho de Retorno para o App de Clientes */}
          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            <span>Ver App de Finanças</span>
          </Link>

          {/* Perfil do Operador */}
          <div className="flex items-center gap-2 pl-2 border-l border-border/80">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-foreground truncate max-w-[130px]">
                {profile?.name || session?.user?.email}
              </span>
              <Badge variant={isSuperAdmin ? "default" : "muted"} size="xs" className="uppercase font-mono">
                {role || "admin"}
              </Badge>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="size-8 p-0 shrink-0 text-muted-foreground hover:text-critical-strong hover:border-critical/40"
              title="Encerrar sessão de administrador"
              aria-label="Sair do painel administrativo"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      {/* --- CORPO PRINCIPAL COM SIDEBAR EXECUTIVA --- */}
      <div className="flex flex-1 w-full min-w-0">
        {/* Sidebar Desktop */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/80 bg-surface/50 p-4">
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary-strong" aria-hidden="true" />
            <span>Navegação Operacional</span>
          </div>

          <nav className="flex flex-col gap-1 mt-2">
            {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon, badge }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => triggerSensory("selection")}
                className={({ isActive }) =>
                  cn(
                    "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 font-semibold text-primary-strong border border-primary/20"
                      : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                  )
                }
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </div>
                {badge && (
                  <Badge variant="muted" size="xs">
                    {badge}
                  </Badge>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto pt-4 border-t border-border/80 flex flex-col gap-2">
            <div className="rounded-xl border border-border/80 bg-background/50 p-3 text-xs text-muted-foreground flex flex-col gap-1">
              <span className="font-semibold text-foreground">Ambiente Seguro</span>
              <p className="text-[11px] leading-relaxed">
                Todas as ações administrativas geram registros imutáveis em trilha de auditoria (LGPD).
              </p>
            </div>
          </div>
        </aside>

        {/* Menu Móvel Deslizante (< md) */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 top-[calc(4rem+max(env(safe-area-inset-top,0px),var(--safe-area-top,0px)))] z-30 flex flex-col bg-background/95 backdrop-blur-xs p-4 md:hidden border-b border-border/80">
            <nav className="flex flex-col gap-1">
              {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => {
                    triggerSensory("selection");
                    setMobileMenuOpen(false);
                  }}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 font-semibold text-primary-strong border border-primary/20"
                        : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                    )
                  }
                >
                  <Icon className="size-4.5 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto pt-4 border-t border-border/80 flex flex-col gap-2">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-surface px-4 py-2 text-xs font-semibold text-foreground"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span>Abrir App de Finanças</span>
              </Link>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2"
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span>Sair do Painel</span>
              </Button>
            </div>
          </div>
        )}

        {/* Conteúdo da Sub-página Administrativa */}
        <main className="flex-1 w-full min-w-0 p-4 sm:p-6 lg:p-8 pb-[calc(6rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px)))] sm:pb-28 lg:pb-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
