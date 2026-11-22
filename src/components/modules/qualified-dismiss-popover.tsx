import { useState, type ReactNode } from "react";
import { Ban, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CalibrationDecision } from "@/domain/insights/feedback";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export interface QualifiedDismissPopoverProps {
  children: ReactNode;
  occurrenceName: string;
  averageCents?: number;
  onSelectReason: (reason: CalibrationDecision) => void;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

/**
 * Popover de micro-feedback qualificado de 1 toque para calibração e descarte (§F23).
 */
export function QualifiedDismissPopover({
  children,
  occurrenceName,
  averageCents = 0,
  onSelectReason,
  align = "end",
  side = "bottom",
  className,
}: QualifiedDismissPopoverProps) {
  const [open, setOpen] = useState(false);
  const annualSavingsCents = averageCents * 12;

  const handleSelect = (reason: CalibrationDecision) => {
    setOpen(false);
    if (reason === "already_cancelled" || reason === "essential") {
      triggerSensory("success");
    } else {
      triggerSensory("action");
    }
    onSelectReason(reason);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={6}
        collisionPadding={{ top: 8, left: 8, right: 8, bottom: 80 }}
        className={cn(
          "w-80 max-w-[calc(100vw-1.5rem)] p-3 shadow-lg border-border/80 bg-surface rounded-2xl flex flex-col gap-2.5",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-0.5 px-1">
          <h4 className="text-xs font-semibold text-foreground tracking-tight truncate">
            Calibrar ou dispensar {occurrenceName}
          </h4>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Selecione uma opção para ajustar o assistente:
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => handleSelect("essential")}
            className="flex items-start gap-2.5 rounded-xl p-2 min-h-11 sm:min-h-0 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 group cursor-pointer"
          >
            <span className="mt-0.5 flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-strong border border-primary/20">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground group-hover:text-primary-strong transition-colors">
                É gasto essencial
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">
                Mantém nos custos fixos ativos e silencia sugestões de corte.
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelect("already_cancelled")}
            className="flex items-start gap-2.5 rounded-xl p-2 min-h-11 sm:min-h-0 text-left transition-colors hover:bg-positive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-positive/30 group cursor-pointer"
          >
            <span className="mt-0.5 flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-lg bg-positive/15 text-positive-strong border border-positive/20">
              <Sparkles className="size-3.5" aria-hidden="true" />
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground group-hover:text-positive-strong transition-colors">
                Já cancelei
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">
                {annualSavingsCents > 0 ? (
                  <>
                    Celebra a economia de{" "}
                    <MoneyText cents={annualSavingsCents} tone="positive" className="font-semibold" />
                    /ano e remove dos custos fixos.
                  </>
                ) : (
                  "Remove dos custos fixos ativos e celebra a economia."
                )}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelect("one_off")}
            className="flex items-start gap-2.5 rounded-xl p-2 min-h-11 sm:min-h-0 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group cursor-pointer"
          >
            <span className="mt-0.5 flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-muted-foreground border border-border/80">
              <Clock className="size-3.5" aria-hidden="true" />
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground transition-colors">
                É despesa pontual
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">
                Silencia apenas no ciclo corrente sem afetar suas outras recomendações.
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelect("not_subscription")}
            className="flex items-start gap-2.5 rounded-xl p-2 min-h-11 sm:min-h-0 text-left transition-colors hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-warning/30 group cursor-pointer"
          >
            <span className="mt-0.5 flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning-strong border border-warning/20">
              <Ban className="size-3.5" aria-hidden="true" />
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground group-hover:text-warning-strong transition-colors">
                Não é assinatura
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">
                Evita que esse estabelecimento volte a ser sugerido como assinatura.
              </span>
            </div>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
