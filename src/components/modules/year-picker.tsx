import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isValidYear } from "@/lib/date";

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

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2" role="group" aria-label="Selecionar ano">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Ano anterior"
          disabled={disabled || value <= minYear}
          onClick={() => onValueChange(value - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span className="min-w-32 text-center text-sm font-medium text-foreground">
          {value}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Próximo ano"
          disabled={disabled || value >= maxYear}
          onClick={() => onValueChange(value + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
