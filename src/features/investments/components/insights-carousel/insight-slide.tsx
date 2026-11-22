import { type ReactNode } from "react";
import { CarouselDismissPopover } from "@/components/modules/carousel-dismiss-popover";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  return (
    <div
      role={tone === "critical" ? "alert" : "region"}
      aria-label={title}
      className={cn(
        "relative w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs",
        className,
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1 pr-8 sm:pr-0">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border",
            TONE_ICON_STYLES[tone],
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="flex flex-col min-w-0 flex-1 gap-1">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h4 className="text-xs sm:text-sm font-semibold tracking-tight text-foreground truncate min-w-0">
              {title}
            </h4>
            <Badge size="xs" variant={badgeVariant} className="shrink-0 max-w-full truncate">
              {badgeText}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-1 leading-relaxed break-words">
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-stretch sm:self-center mt-auto sm:mt-0 shrink-0">
        <div className="flex items-center gap-2 w-full sm:w-auto [&>button]:flex-1 [&>button]:sm:flex-initial [&>button]:w-full [&>button]:sm:w-auto">
          {actions}
        </div>
        {onDismiss ? (
          <div className="absolute top-3 right-3 sm:static">
            <CarouselDismissPopover onDismiss={onDismiss} label="Dispensar alerta" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
