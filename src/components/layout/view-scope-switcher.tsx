import { useLocation } from "react-router";
import { Briefcase, Layers, User } from "lucide-react";
import { isScopedRoute } from "@/domain/business";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import { useViewScope } from "@/state";
import type { ViewScope } from "@/types";

const SCOPE_OPTIONS: ReadonlyArray<{
  value: ViewScope;
  label: string;
  icon: typeof Layers;
}> = [
  { value: "all", label: "Tudo", icon: Layers },
  { value: "personal", label: "Pessoal", icon: User },
  { value: "business", label: "Negócio", icon: Briefcase },
];

/**
 * Alternador de visão consolidada / Pessoal / Negócio (Fase 2A).
 * Renderizado exclusivamente quando `businessModeEnabled === true` e na rota com escopo.
 * Em telas menores (< lg), ocupa 100% da largura logo abaixo do cabeçalho (zero overflow).
 */
export function ViewScopeSwitcher({ className }: { className?: string }) {
  const location = useLocation();
  const { effectiveViewScope, setViewScope, isBusinessModeEnabled } = useViewScope();

  if (!isBusinessModeEnabled || !isScopedRoute(location.pathname)) {
    return null;
  }

  return (
    <div
      className={cn("flex justify-start lg:justify-end mb-3 sm:mb-4", className)}
      data-testid="view-scope-switcher"
    >
      <div
        role="radiogroup"
        aria-label="Visão financeira PF e PJ"
        className="grid grid-cols-3 w-full lg:w-auto lg:inline-flex items-center gap-1 rounded-xl border border-border/80 bg-surface-raised p-1 shadow-xs"
      >
        {SCOPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = effectiveViewScope === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                if (active) return;
                triggerSensory("selection");
                setViewScope(option.value);
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap min-h-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-surface text-foreground font-semibold shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface/60",
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
