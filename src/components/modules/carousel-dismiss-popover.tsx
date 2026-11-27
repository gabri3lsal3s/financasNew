import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  computeCarouselDismissalUntil,
  formatCarouselReturnDate,
  type CarouselDismissPreset,
} from "@/domain/notifications/hub";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import { useCarouselPauseLock } from "./carousel-pause-context-def";

export interface CarouselDismissPopoverProps {
  /** Callback canônico (Onda 1). */
  onSelectPreset?: (preset: CarouselDismissPreset) => void;
  /** Presets permitidos pela política do card (padrão: ["7d", "1m"]). */
  allowedPresets?: readonly CarouselDismissPreset[];
  /** Data de referência para exibir a data prevista de retorno. */
  nowMs?: number;
  /** Callback legado mantido durante a transição até a Fase 4. */
  onDismiss?: (days: 7 | 30) => void;
  label?: string;
  align?: "start" | "center" | "end";
  className?: string;
}

const PRESET_TITLES: Record<CarouselDismissPreset, string> = {
  "7d": "Dispensar por 7 dias",
  "1m": "Dispensar em 1 mês",
  "6m": "Dispensar em 6 meses",
};

/**
 * Controle padronizado de dispensa temporária (7d | 1m | 6m) com data prevista de retorno
 * e lock automático do autoplay no `CarouselPauseContext` (§AGENTS.md §§4.19, 4.35).
 */
export function CarouselDismissPopover({
  onSelectPreset,
  allowedPresets = ["7d", "1m"],
  nowMs,
  onDismiss,
  label = "Dispensar aviso",
  align = "end",
  className,
}: CarouselDismissPopoverProps) {
  const [open, setOpen] = useState(false);
  const [openedAtMs, setOpenedAtMs] = useState<number>(() => nowMs ?? Date.now());
  useCarouselPauseLock(open, "carousel-dismiss-popover");

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && nowMs === undefined) {
      setOpenedAtMs(Date.now());
    }
    setOpen(nextOpen);
  };

  const effectivePresets = useMemo<readonly CarouselDismissPreset[]>(() => {
    if (allowedPresets.length === 0) return [];
    if (!onSelectPreset && onDismiss) {
      return allowedPresets.filter((p) => p === "7d" || p === "1m");
    }
    return allowedPresets;
  }, [allowedPresets, onSelectPreset, onDismiss]);

  const refNowMs = nowMs ?? openedAtMs;

  if (effectivePresets.length === 0) {
    return null;
  }

  const handleSelect = (preset: CarouselDismissPreset) => {
    triggerSensory("selection");
    setOpen(false);
    if (onSelectPreset) {
      onSelectPreset(preset);
    } else if (onDismiss) {
      onDismiss(preset === "7d" ? 7 : 30);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={label}
          title={label}
          className={cn(
            "relative size-8 !w-8 !min-w-8 p-0 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer max-sm:after:absolute max-sm:after:-inset-1.5",
            className,
          )}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-56 p-1.5 shadow-md border-border/80 bg-surface rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-0.5">
          <span className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
            Ocultar este aviso
          </span>
          {effectivePresets.map((preset) => {
            const returnDate = formatCarouselReturnDate(
              computeCarouselDismissalUntil(refNowMs, preset),
              refNowMs,
            );
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelect(preset)}
                className="flex min-h-11 sm:min-h-8 items-center justify-between gap-2 rounded-lg px-2.5 py-2 sm:py-1.5 text-xs text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors text-left cursor-pointer"
              >
                <span>{PRESET_TITLES[preset]}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  até {returnDate}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
