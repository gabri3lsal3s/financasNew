import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isValidMonthKey } from "@/domain/competence";
import { shiftMonth } from "@/lib/date";
import { cn } from "@/lib/utils";

export interface MonthPickerProps {
  /** YYYY-MM */
  value: string;
  onValueChange: (month: string) => void;
  disabled?: boolean;
  className?: string;
}

function fullMonthLabel(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  const raw = new Date(year ?? 0, (monthNum ?? 1) - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "";
}

/** Seletor de mês por botões (sem `<select>` nativo — DESIGN_SYSTEM §13). */
export function MonthPicker({ value, onValueChange, disabled, className }: MonthPickerProps) {
  if (!isValidMonthKey(value)) {
    throw new Error(`MonthPicker: mês inválido "${value}" (esperado YYYY-MM).`);
  }

  return (
    <div
      className={cn("flex items-center justify-between gap-2 w-full", className)}
      role="group"
      aria-label="Selecionar mês"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        sensoryIntent="selection"
        aria-label="Mês anterior"
        disabled={disabled}
        onClick={() => onValueChange(shiftMonth(value, -1))}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <span
        key={value}
        className="flex-1 min-w-32 text-center text-sm font-medium text-foreground animate-fade-slide-in"
      >
        {fullMonthLabel(value)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        sensoryIntent="selection"
        aria-label="Próximo mês"
        disabled={disabled}
        onClick={() => onValueChange(shiftMonth(value, 1))}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}
