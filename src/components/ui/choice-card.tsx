import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge, type BadgeVariant } from "./badge";
import { triggerSensory } from "@/services/sensory";

export interface ChoiceCardProps extends Omit<ComponentPropsWithoutRef<"button">, "title"> {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  badgeVariant?: BadgeVariant;
  selected?: boolean;
  action?: ReactNode;
}

/**
 * Primitivo canônico de cartão de seleção e opção (Regras 4, 13 e 23 de AGENTS.md).
 * Garante:
 * - Anti-truncamento em títulos com `line-clamp-2 break-words leading-tight`.
 * - Alinhamento harmonioso com badges (`shrink-0` no topo).
 * - Feedback tátil de seleção integrado via Gateway Sensorial.
 * - Estados visuais acessíveis para radio cards e opções clicáveis.
 */
export function ChoiceCard({
  title,
  description,
  icon,
  badge,
  badgeVariant = "default",
  selected = false,
  disabled = false,
  action,
  onClick,
  className,
  type = "button",
  role = "radio",
  "aria-checked": ariaChecked,
  ...props
}: ChoiceCardProps) {
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    triggerSensory("selection");
    onClick?.(event);
  };

  return (
    <button
      type={type}
      role={role}
      aria-checked={ariaChecked ?? (role === "radio" ? selected : undefined)}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        "flex flex-col text-left rounded-xl border p-3.5 sm:p-4 transition-all relative cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        selected
          ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40"
          : "border-border/80 bg-surface hover:bg-surface-hover/80 hover:border-border",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2.5 w-full mb-1.5">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {icon ? (
            <span
              className={cn(
                "shrink-0 mt-0.5 transition-colors",
                selected ? "text-primary-strong" : "text-muted-foreground group-hover:text-foreground",
              )}
              aria-hidden="true"
            >
              {icon}
            </span>
          ) : null}

          <h4 className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 break-words leading-snug">
            {title}
          </h4>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {badge ? (
            <Badge variant={selected ? "default" : badgeVariant} size="xs" className="shrink-0">
              {badge}
            </Badge>
          ) : null}
          {action}
        </div>
      </div>

      {description ? (
        <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed mt-0.5">
          {description}
        </p>
      ) : null}
    </button>
  );
}
