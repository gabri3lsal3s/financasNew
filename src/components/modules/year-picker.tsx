import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerHaptic } from "@/services/haptics";
import { isValidYear } from "@/lib/date";
import { cn } from "@/lib/utils";

export interface YearPickerProps {
  /** Ano (número inteiro de 4 dígitos, ex.: 2026). */
  value: number;
  onValueChange: (year: number) => void;
  disabled?: boolean;
  className?: string;
  minYear?: number;
  maxYear?: number;
}

/** Seletor de ano por botões (sem `<select>` nativo — DESIGN_SYSTEM §13). */
export function YearPicker({
  value,
  onValueChange,
  disabled,
  className,
  minYear = 2000,
  maxYear = 2100,
}: YearPickerProps) {
  if (!isValidYear(value)) {
    throw new Error(`YearPicker: ano inválido "${value}" (esperado número entre 1900 e 2100).`);
  }

  const handleChange = (delta: number) => {
    triggerHaptic("light");
    onValueChange(value + delta);
  };

  return (
    <div className={cn("flex items-center justify-between gap-2 w-full", className)} role="group" aria-label="Selecionar ano">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Ano anterior"
        disabled={disabled || value <= minYear}
        onClick={() => handleChange(-1)}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <span key={value} className="flex-1 min-w-32 text-center text-sm font-medium text-foreground animate-fade-slide-in">
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Próximo ano"
        disabled={disabled || value >= maxYear}
        onClick={() => handleChange(1)}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}
