import { Link } from "react-router";
import { navItems } from "@/components/layout/nav-items";
import { InstallAppButton } from "@/components/modules/install-app-button";

export function MoreMenu() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Mais</h1>
      <nav className="grid gap-2" aria-label="Todas as áreas">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-hover"
          >
            <item.icon className="size-5 text-muted-foreground" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
      </nav>
      {/* PWA: instalação no menu (nunca popup intrusivo) — PWA_GUIDELINES §6 */}
      <InstallAppButton />
    </div>
  );
}
