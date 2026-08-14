import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface NumberStepperProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Rótulo acessível do botão de diminuir (ex.: "Diminuir parcelas"). */
  decreaseLabel: string;
  /** Rótulo acessível do botão de aumentar (ex.: "Aumentar parcelas"). */
  increaseLabel: string;
  /** Formatação do valor exibido (default: número puro). */
  format?: (value: number) => string;
  className?: string;
}

/**
 * NumberStepper — controle de incremento/decremento com botões +/−.
 * Substitui inputs numéricos nativos em controles contínuos (parcelas,
 * dias de fechamento/vencimento, janelas de lembrete) — DRY: um único
 * componente para todos os usos (DESIGN_SYSTEM §13).
 */
export function NumberStepper({
  value,
  onValueChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  decreaseLabel,
  increaseLabel,
  format,
  className,
}: NumberStepperProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={decreaseLabel}
        disabled={value <= min}
        onClick={() => onValueChange(clamp(value - 1))}
      >
        <Minus aria-hidden="true" />
      </Button>
      <span className="num flex-1 text-center text-2xl font-semibold">{format ? format(value) : value}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={increaseLabel}
        disabled={value >= max}
        onClick={() => onValueChange(clamp(value + 1))}
      >
        <Plus aria-hidden="true" />
      </Button>
    </div>
  );
}
