import { Link } from "react-router";
import { BrandLogo } from "@/components/layout/brand-logo";
import { navItems } from "@/components/layout/nav-items";
import { InstallAppButton } from "@/components/modules/install-app-button";

export function MoreMenu() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-xs">
        <BrandLogo markClassName="size-10" showSubtitle />
      </div>
      <h1 className="sr-only">Mais</h1>
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
