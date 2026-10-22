import { useState, type ReactNode } from "react";
import { Ban, Clock, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCentsAsBRL } from "@/services/masks/money";
import { triggerSensory } from "@/services/sensory";
import type { QualifiedDismissReason } from "@/domain/insights/feedback";

export interface QualifiedDismissPopoverProps {
  /** Elemento gatilho do popover (ex.: botão dispensar ou ícone X) */
  children: ReactNode;
  /** Nome legível do fornecedor ou ocorrência */
  occurrenceName: string;
  /** Valor médio em centavos para projeção de economia anual (opcional) */
  averageCents?: number;
  /** Callback ao selecionar uma das opções qualificadas */
  onSelectReason: (reason: QualifiedDismissReason) => void;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

/**
 * Popover sutil de micro-feedback qualificado de 1 toque no descarte (§F23).
 *
 * Oferece 3 opções claras de descarte com aprendizado imediato:
 *   1. "Já cancelei" ➔ silencia ocorrência, celebra a economia anual e atualiza potencial de corte.
 *   2. "É despesa pontual" ➔ silencia apenas para o ciclo corrente sem penalizar o classificador.
 *   3. "Não é assinatura" ➔ rebaixa de imediato a probabilidade daquele fornecedor virar recorrência.
 */
export function QualifiedDismissPopover({
  children,
  occurrenceName,
  averageCents = 0,
  onSelectReason,
  align = "end",
  side = "bottom",
}: QualifiedDismissPopoverProps) {
  const [open, setOpen] = useState(false);
  const annualSavingsCents = averageCents * 12;

  const handleSelect = (reason: QualifiedDismissReason) => {
    setOpen(false);
    if (reason === "already_cancelled") {
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
        className="w-80 p-3 shadow-lg border-border/80 bg-surface rounded-2xl flex flex-col gap-2.5 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-0.5 px-1">
          <h4 className="text-xs font-semibold text-foreground tracking-tight truncate">
            Dispensar {occurrenceName}
          </h4>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Selecione o motivo para calibrar o assistente:
          </p>
        </div>

        <div className="flex flex-col gap-1">
          {/* Opção 1: Já cancelei */}
          <button
            type="button"
            onClick={() => handleSelect("already_cancelled")}
            className="flex items-start gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-positive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-positive/30 group"
          >
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-positive/15 text-positive-strong border border-positive/20">
              <Sparkles className="size-3.5" aria-hidden="true" />
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground group-hover:text-positive-strong transition-colors">
                Já cancelei
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">
                {annualSavingsCents > 0
                  ? `Celebra a economia de ${formatCentsAsBRL(annualSavingsCents)}/ano e remove dos custos fixos.`
                  : "Remove dos custos fixos ativos e celebra a economia."}
              </span>
            </div>
          </button>

          {/* Opção 2: É despesa pontual */}
          <button
            type="button"
            onClick={() => handleSelect("one_off")}
            className="flex items-start gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border group"
          >
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-muted-foreground border border-border/80">
              <Clock className="size-3.5" aria-hidden="true" />
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground transition-colors">
                É despesa pontual
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">
                Silencia apenas no ciclo corrente sem penalizar o motor.
              </span>
            </div>
          </button>

          {/* Opção 3: Não é assinatura */}
          <button
            type="button"
            onClick={() => handleSelect("not_subscription")}
            className="flex items-start gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-warning/30 group"
          >
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning-strong border border-warning/20">
              <Ban className="size-3.5" aria-hidden="true" />
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground group-hover:text-warning-strong transition-colors">
                Não é assinatura
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">
                Rebaixa de imediato a probabilidade deste fornecedor virar recorrência.
              </span>
            </div>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
