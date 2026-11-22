import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export interface CarouselDismissPopoverProps {
  onDismiss: (days: 7 | 30) => void;
  label?: string;
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * Controle padronizado de dispensa temporária (7 dias ou 30 dias) para cards
 * dos carrosséis de alertas da Home e de Investimentos (§AGENTS.md §4.19).
 */
export function CarouselDismissPopover({
  onDismiss,
  label = "Dispensar aviso",
  align = "end",
  className,
}: CarouselDismissPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          title={label}
          className={cn(
            "relative size-7 sm:size-8 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer max-sm:after:absolute max-sm:after:-inset-2",
            className,
          )}
        >
          <X className="size-3.5 sm:size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-52 p-1.5 shadow-md border-border/80 bg-surface rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-0.5">
          <span className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
            Ocultar este aviso
          </span>
          <button
            type="button"
            onClick={() => {
              triggerSensory("selection");
              setOpen(false);
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
              setOpen(false);
              onDismiss(30);
            }}
            className="flex min-h-11 sm:min-h-8 items-center justify-between rounded-lg px-2.5 py-2 sm:py-1.5 text-xs text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors text-left cursor-pointer"
          >
            <span>Lembrar no próximo mês</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
