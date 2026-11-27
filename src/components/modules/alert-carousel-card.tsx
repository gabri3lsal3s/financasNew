import { useState, type ReactNode } from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CalculationBreakdown } from "@/domain/calculation-memory";
import type { CarouselDismissPreset } from "@/domain/notifications/hub";
import { cn } from "@/lib/utils";
import { CalculationMemoryModal } from "./calculation-memory";
import { CarouselDismissPopover } from "./carousel-dismiss-popover";
import { useCarouselPauseLock } from "./carousel-pause-context";

export type AlertCarouselCardTone =
  | "critical"
  | "warning"
  | "positive"
  | "portfolio"
  | "info";

export interface AlertCarouselCardAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "destructive" | "warning" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

export interface AlertCarouselCardProps {
  id: string;
  tone: AlertCarouselCardTone;
  icon: ReactNode;
  title: string;
  description: ReactNode;
  /** Versão textual acessível da descrição (para `title`/leitores de tela quando `description` é JSX). */
  descriptionText?: string;
  badge?: {
    label: ReactNode;
    variant?: BadgeProps["variant"];
  };
  primaryAction?: AlertCarouselCardAction;
  secondaryAction?: AlertCarouselCardAction;
  calculationBreakdown?: CalculationBreakdown;
  calculationMemoryLabel?: string;
  dismissPolicy?: {
    allowedPresets: readonly CarouselDismissPreset[];
    onSelectPreset: (preset: CarouselDismissPreset) => void;
    label?: string;
    nowMs?: number;
  };
  role?: "alert" | "region";
  className?: string;
}

const ICON_SHELL_TONES: Record<AlertCarouselCardTone, string> = {
  critical: "bg-critical/10 border-critical/20 text-critical-strong",
  warning: "bg-warning/15 border-warning/20 text-warning-strong",
  positive: "bg-positive/10 border-positive/20 text-positive-strong",
  portfolio: "bg-portfolio/10 border-portfolio/20 text-portfolio",
  info: "bg-primary/10 border-primary/20 text-primary-strong",
};

/**
 * Card canônico único dos carrosséis da Home e de Investimentos (AGENTS.md §§4.13, 4.19, 4.23, 4.33).
 * Puramente presentacional — sem queries, sem truncamento cego de títulos, com slot de memória e dispensa.
 */
export function AlertCarouselCard({
  id,
  tone,
  icon,
  title,
  description,
  descriptionText,
  badge,
  primaryAction,
  secondaryAction,
  calculationBreakdown,
  calculationMemoryLabel,
  dismissPolicy,
  role,
  className,
}: AlertCarouselCardProps) {
  const [memoryOpen, setMemoryOpen] = useState(false);
  useCarouselPauseLock(memoryOpen, `memory-modal:${id}`);

  const isDismissible = Boolean(
    dismissPolicy && dismissPolicy.allowedPresets.length > 0,
  );
  const hasActions = Boolean(primaryAction || secondaryAction);
  const hasTwoActions = Boolean(primaryAction && secondaryAction);

  return (
    <div
      data-card-id={id}
      role={role ?? (tone === "critical" ? "alert" : "region")}
      aria-label={title}
      className={cn(
        "relative w-full h-full min-h-[104px] sm:min-h-[84px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border p-3.5 sm:p-4 shadow-xs transition-colors",
        tone === "critical"
          ? "border-critical/30 bg-critical/5 text-foreground"
          : "border-border/80 bg-surface text-foreground",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-start sm:items-center gap-3 min-w-0 flex-1",
          isDismissible && "pr-9 sm:pr-0",
        )}
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border",
            ICON_SHELL_TONES[tone],
          )}
          aria-hidden="true"
        >
          {icon}
        </span>

        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-foreground line-clamp-2 break-words">
              {title}
            </h3>
            {badge ? (
              <Badge
                variant={badge.variant ?? "default"}
                size="xs"
                className="max-w-full truncate shrink-0"
              >
                {badge.label}
              </Badge>
            ) : null}
            {calculationBreakdown ? (
              <CalculationMemoryModal
                breakdown={calculationBreakdown}
                label={calculationMemoryLabel ?? `Memória de cálculo: ${title}`}
                priority="p0"
                open={memoryOpen}
                onOpenChange={setMemoryOpen}
              />
            ) : null}
          </div>

          <p
            className="text-xs text-muted-foreground leading-relaxed line-clamp-2 break-words"
            title={
              descriptionText ??
              (typeof description === "string" ? description : undefined)
            }
          >
            {description}
          </p>
        </div>
      </div>

      {hasActions ? (
        <div className="flex shrink-0 items-center gap-2 self-stretch sm:self-center mt-auto sm:mt-0">
          <div
            className={cn(
              "w-full sm:w-auto",
              hasTwoActions
                ? "grid grid-cols-2 gap-2 sm:flex sm:items-center"
                : "flex items-center",
            )}
          >
            {secondaryAction ? (
              <Button
                type="button"
                variant={secondaryAction.variant ?? "ghost"}
                size="sm"
                disabled={secondaryAction.disabled || secondaryAction.loading}
                onClick={secondaryAction.onClick}
                className={cn(
                  "h-8 text-xs font-medium justify-center",
                  !hasTwoActions && "w-full sm:w-auto",
                )}
              >
                {secondaryAction.icon}
                <span>{secondaryAction.label}</span>
              </Button>
            ) : null}
            {primaryAction ? (
              <Button
                type="button"
                variant={
                  primaryAction.variant ??
                  (tone === "critical" ? "destructive" : "outline")
                }
                size="sm"
                disabled={primaryAction.disabled || primaryAction.loading}
                onClick={primaryAction.onClick}
                className={cn(
                  "h-8 text-xs font-medium justify-center",
                  !hasTwoActions && "w-full sm:w-auto",
                )}
              >
                {primaryAction.icon}
                <span>{primaryAction.label}</span>
              </Button>
            ) : null}
          </div>

          {isDismissible && dismissPolicy ? (
            <div className="absolute top-3 right-3 sm:static">
              <CarouselDismissPopover
                allowedPresets={dismissPolicy.allowedPresets}
                onSelectPreset={dismissPolicy.onSelectPreset}
                label={dismissPolicy.label ?? `Dispensar ${title}`}
                nowMs={dismissPolicy.nowMs}
              />
            </div>
          ) : null}
        </div>
      ) : isDismissible && dismissPolicy ? (
        <div className="absolute top-3 right-3 sm:static sm:self-center shrink-0">
          <CarouselDismissPopover
            allowedPresets={dismissPolicy.allowedPresets}
            onSelectPreset={dismissPolicy.onSelectPreset}
            label={dismissPolicy.label ?? `Dispensar ${title}`}
            nowMs={dismissPolicy.nowMs}
          />
        </div>
      ) : null}
    </div>
  );
}
