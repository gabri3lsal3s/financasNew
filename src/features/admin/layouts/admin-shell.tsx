import { useLayoutEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  Activity,
  ExternalLink,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import { Badge, Button, buttonVariants } from "@/components/ui";
import { BrandLogo, ThemeToggle } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { useUserAccess } from "@/state";
import { cn } from "@/lib/utils";
import { resetPageScroll } from "@/services/scroll";
import { triggerSensory } from "@/services/sensory";
import { ADMIN_NAV_ITEMS } from "./admin-nav-config";
import { AdminMobileDrawer } from "./admin-mobile-drawer";

export function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const { signOut } = useSignOut();
  const { profile, role, isSuperAdmin } = useUserAccess(session?.user?.id);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useLayoutEffect(() => {
    resetPageScroll({ containerId: "admin-main-content" });
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-sidebar flex min-h-16 pt-safe w-full items-center justify-between gap-2 border-b border-border/80 bg-surface/95 px-4 backdrop-blur-xs sm:px-6">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Button
            type="button"
            variant="outline"
            size="icon"
            sensoryIntent="selection"
            className="size-9 md:hidden text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu administrativo"}
          >
            {mobileMenuOpen ? (
              <X className="size-4.5" aria-hidden="true" />
            ) : (
              <Menu className="size-4.5" aria-hidden="true" />
            )}
          </Button>

          <Link to="/admin/dashboard" className="flex items-center gap-2.5 min-w-0">
            <BrandLogo markClassName="size-8 drop-shadow-xs shrink-0" showWordmark={false} />
            <div className="flex flex-col min-w-0">
              <span className="font-display text-sm font-bold tracking-tight text-foreground sm:text-base leading-none truncate">
                Axir Command Center
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
                Governança &amp; Operações
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-2 rounded-full border border-border/80 bg-background/60 px-3 py-1 text-xs text-muted-foreground">
            <span className="flex size-2 rounded-full bg-positive-strong" />
            <Activity className="size-3.5 text-positive-strong" aria-hidden="true" />
            <span className="font-mono text-[11px]">Banco &amp; Serviços Operacionais</span>
          </div>

          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "hidden sm:inline-flex gap-1.5 text-xs text-muted-foreground hover:text-foreground",
            )}
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            <span>Ver App de Finanças</span>
          </Link>

          <ThemeToggle className="rounded-lg border border-border/80 hover:bg-surface-hover" />

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
              type="button"
              variant="outline"
              size="icon"
              sensoryIntent="action"
              onClick={handleSignOut}
              className="size-9 shrink-0 text-muted-foreground hover:text-critical-strong hover:border-critical/40"
              title="Encerrar sessão de administrador"
              aria-label="Sair do painel administrativo"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 w-full min-w-0">
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/80 bg-surface/50 p-4">
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary-strong" aria-hidden="true" />
            <span>Navegação Operacional</span>
          </div>

          <nav className="flex flex-col gap-1 mt-2" aria-label="Navegação administrativa">
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
            <div className="rounded-xl bg-surface-raised p-3 text-xs text-muted-foreground flex flex-col gap-1">
              <span className="font-semibold text-foreground">Ambiente Seguro</span>
              <p className="text-[11px] leading-relaxed">
                Todas as ações administrativas geram registros imutáveis em trilha de auditoria (LGPD).
              </p>
            </div>
          </div>
        </aside>

        <AdminMobileDrawer
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          onSignOut={handleSignOut}
        />

        <main
          id="admin-main-content"
          className="flex-1 w-full min-w-0 p-4 sm:p-6 lg:p-8 pb-28 sm:pb-32 lg:pb-8 pb-safe overflow-y-auto"
        >
          <div key={location.pathname} className="animate-route-in min-w-0 w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
