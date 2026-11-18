import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export type InsightTone = "positive" | "warning" | "critical" | "primary" | "portfolio";

const TONE_ICON_STYLES: Record<InsightTone, string> = {
  positive: "bg-positive/10 border-positive/20 text-positive-strong",
  warning: "bg-warning/15 border-warning/20 text-warning-strong",
  critical: "bg-critical/10 border-critical/20 text-critical-strong",
  primary: "bg-primary/10 border-primary/20 text-primary-strong",
  portfolio: "bg-portfolio/10 border-portfolio/20 text-portfolio",
};

export interface InsightSlideProps {
  tone: InsightTone;
  icon: ReactNode;
  title: string;
  badgeText: string;
  badgeVariant?: BadgeProps["variant"];
  description: ReactNode;
  actions: ReactNode;
  onDismiss?: (days: 7 | 30) => void;
  className?: string;
}

/**
 * Slide canônico Nível 2 para carrosséis de alertas e insights da carteira (AGENTS.md §4.13 e §4.19).
 */
export function InsightSlide({
  tone,
  icon,
  title,
  badgeText,
  badgeVariant = "muted",
  description,
  actions,
  onDismiss,
  className,
}: InsightSlideProps) {
  const [dismissOpen, setDismissOpen] = useState(false);

  return (
    <div
      role="alert"
      className={cn(
        "w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs",
        className,
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border",
            TONE_ICON_STYLES[tone],
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <h4 className="text-xs sm:text-sm font-semibold tracking-tight text-foreground truncate min-w-0">
              {title}
            </h4>
            <Badge size="xs" variant={badgeVariant} className="shrink-0 max-w-full truncate">
              {badgeText}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
        </div>
      </div>

      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 self-stretch sm:self-center mt-auto sm:mt-0 shrink-0">
        {actions}
        {onDismiss ? (
          <Popover open={dismissOpen} onOpenChange={setDismissOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Dispensar alerta"
                title="Dispensar alerta"
                className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1.5">
              <div className="flex flex-col gap-0.5">
                <span className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                  Ocultar este aviso
                </span>
                <button
                  type="button"
                  onClick={() => {
                    triggerSensory("selection");
                    setDismissOpen(false);
                    onDismiss(7);
                  }}
                  className="flex min-h-11 sm:min-h-8 items-center justify-between rounded-lg px-2.5 py-2 sm:py-1.5 text-xs text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors text-left cursor-pointer"
                >
                  <span>Dispensar por 7 dias</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerSensory("selection");
                    setDismissOpen(false);
                    onDismiss(30);
                  }}
                  className="flex min-h-11 sm:min-h-8 items-center justify-between rounded-lg px-2.5 py-2 sm:py-1.5 text-xs text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors text-left cursor-pointer"
                >
                  <span>Lembrar no próximo mês</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </div>
  );
}
