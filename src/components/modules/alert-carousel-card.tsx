import { isValidElement, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CalculationBreakdown } from "@/domain/calculation-memory";
import type { CarouselDismissPreset } from "@/domain/notifications/hub";
import { cn } from "@/lib/utils";
import { CalculationMemoryModal } from "./calculation-memory";
import { CarouselDismissPopover } from "./carousel-dismiss-popover";
import { useCarouselPauseLock } from "./carousel-pause-context-def";

export type AlertCarouselCardTone =
  | "critical"
  | "warning"
  | "positive"
  | "portfolio"
  | "info";

export interface AlertCarouselCardAction {
  label: string;
  onClick: () => void;
  variant?:
    | "default"
    | "outline"
    | "destructive"
    | "warning"
    | "ghost"
    | "positive"
    | "portfolio";
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  ariaLabel?: string;
  title?: string;
}

export interface AlertCarouselCardEssentialAction {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
  sensoryIntent?: "action" | "selection" | "success" | false;
}

export interface AlertCarouselCardProps {
  id: string;
  tone: AlertCarouselCardTone;
  icon: ReactNode;
  title: string;
  description: ReactNode;
  /** Versão textual acessível da descrição (para `title`/leitores de tela quando `description` é JSX). */
  descriptionText?: string;
  badge?:
    | {
        label: ReactNode;
        variant?: BadgeProps["variant"];
      }
    | ReactNode;
  primaryAction?: AlertCarouselCardAction;
  secondaryAction?: AlertCarouselCardAction;
  /** Slot opcional para fluxos especiais (ex.: popover de calibração no SmartAdvisor). */
  customActions?: ReactNode;
  /** Botão utilitário compacto (ícone de escudo) para marcar recorrência/economia como essencial. */
  essentialAction?: AlertCarouselCardEssentialAction;
  calculationBreakdown?: CalculationBreakdown;
  calculationMemoryLabel?: string;
  dismissPolicy?: {
    allowedPresets: readonly CarouselDismissPreset[];
    onSelectPreset?: (preset: CarouselDismissPreset) => void;
    onDismiss?: (days: 7 | 30) => void;
    label?: string;
    nowMs?: number;
  };
  role?: "alert" | "region";
  ariaLabel?: string;
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
 * Anatomia responsiva em 3 zonas fixas:
 * - Mobile (< sm): Cabeçalho [Ícone + Badge/Título + Utilitários (?, Escudo, X)] → Descrição largura total → CTA;
 * - Tablet/Desktop (sm+): Faixa horizontal [Ícone] [Título+Badge / Descrição] [CTA] | [?, Escudo, X].
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
  customActions,
  essentialAction,
  calculationBreakdown,
  calculationMemoryLabel,
  dismissPolicy,
  role,
  ariaLabel,
  className,
}: AlertCarouselCardProps) {
  const [memoryOpen, setMemoryOpen] = useState(false);
  useCarouselPauseLock(memoryOpen, `memory-modal:${id}`);

  const isDismissible = Boolean(
    dismissPolicy &&
      dismissPolicy.allowedPresets.length > 0 &&
      (dismissPolicy.onSelectPreset || dismissPolicy.onDismiss),
  );
  const hasActions = Boolean(primaryAction || secondaryAction || customActions);
  const hasTwoActions = Boolean(primaryAction && secondaryAction);
  const hasUtilities = Boolean(calculationBreakdown || essentialAction || isDismissible);

  return (
    <div
      data-card-id={id}
      role={role ?? (tone === "critical" ? "alert" : "region")}
      aria-label={ariaLabel ?? title}
      className={cn(
        "group relative w-full h-full min-h-[104px] sm:min-h-[84px] flex-1 grid grid-cols-[auto_minmax(0,1fr)_auto] sm:content-center items-start sm:items-center gap-x-3 gap-y-2.5 sm:gap-x-4 sm:gap-y-0.5 rounded-2xl border p-3.5 sm:p-4 shadow-xs transition-colors",
        hasActions
          ? "content-start grid-rows-[auto_1fr_auto] sm:grid-rows-none sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
          : "content-center sm:grid-cols-[auto_minmax(0,1fr)_auto]",
        tone === "critical"
          ? "border-critical/30 bg-critical/5 text-foreground"
          : "border-border/80 bg-surface text-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "col-start-1 row-start-1 sm:row-span-2 sm:self-center flex size-9 shrink-0 items-center justify-center rounded-xl border",
          ICON_SHELL_TONES[tone],
        )}
        aria-hidden="true"
      >
        {icon}
      </span>

      <div className="col-start-2 row-start-1 min-w-0 flex flex-col-reverse items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground line-clamp-2 break-words min-w-0">
          {title}
        </h3>
        {badge ? (
          isValidElement(badge) ? (
            badge
          ) : typeof badge === "object" && "label" in badge ? (
            <Badge
              variant={badge.variant ?? "default"}
              size="xs"
              className="max-w-full truncate shrink-0"
            >
              {badge.label}
            </Badge>
          ) : (
            badge
          )
        ) : null}
      </div>

      <p
        className="col-span-3 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-2 text-xs text-muted-foreground leading-relaxed break-words min-w-0"
        title={
          descriptionText ??
          (typeof description === "string" ? description : undefined)
        }
      >
        {description}
      </p>

      {hasActions ? (
        <div className="col-span-3 row-start-3 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:row-span-2 flex shrink-0 items-center gap-2 self-stretch sm:self-center mt-auto sm:mt-0">
          {customActions ? (
            customActions
          ) : (
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
                  aria-label={secondaryAction.ariaLabel ?? secondaryAction.label}
                  title={secondaryAction.title}
                  className={cn(
                    "h-8 text-xs font-medium justify-center cursor-pointer",
                    !hasTwoActions && "w-full sm:w-auto",
                  )}
                >
                  {secondaryAction.icon}
                  <span>{secondaryAction.label}</span>
                  {secondaryAction.trailingIcon}
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
                  aria-label={primaryAction.ariaLabel ?? primaryAction.label}
                  title={primaryAction.title}
                  className={cn(
                    "h-8 text-xs font-medium justify-center cursor-pointer",
                    !hasTwoActions && "w-full sm:w-auto",
                  )}
                >
                  {primaryAction.icon}
                  <span>{primaryAction.label}</span>
                  {primaryAction.trailingIcon}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {hasUtilities ? (
        <div
          className={cn(
            "col-start-3 row-start-1 sm:row-start-1 sm:row-span-2 sm:self-center flex items-center gap-1 shrink-0",
            hasActions ? "sm:col-start-4 sm:border-l sm:border-border/70 sm:pl-2.5" : "sm:col-start-3",
          )}
        >
          {calculationBreakdown ? (
            <CalculationMemoryModal
              breakdown={calculationBreakdown}
              label={calculationMemoryLabel ?? `Memória de cálculo: ${title}`}
              priority="p0"
              open={memoryOpen}
              onOpenChange={setMemoryOpen}
            />
          ) : null}

          {essentialAction ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={essentialAction.label ?? "Manter como essencial"}
              title={essentialAction.label ?? "Manter como essencial"}
              sensoryIntent={essentialAction.sensoryIntent ?? "action"}
              onClick={essentialAction.onClick}
              disabled={essentialAction.disabled}
              className="relative size-8 !w-8 !min-w-8 p-0 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer max-sm:after:absolute max-sm:after:-inset-1.5"
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              <span className="sr-only">
                {essentialAction.label ?? "Manter como essencial"}
              </span>
            </Button>
          ) : null}

          {isDismissible && dismissPolicy ? (
            <CarouselDismissPopover
              allowedPresets={dismissPolicy.allowedPresets}
              onSelectPreset={dismissPolicy.onSelectPreset}
              onDismiss={dismissPolicy.onDismiss}
              label={dismissPolicy.label ?? `Dispensar ${title}`}
              nowMs={dismissPolicy.nowMs}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
