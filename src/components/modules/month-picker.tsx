import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerHaptic } from "@/services/haptics";
import { isValidMonthKey } from "@/domain/competence";
import { cn } from "@/lib/utils";

export interface MonthPickerProps {
  /** YYYY-MM */
  value: string;
  onValueChange: (month: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Soma `delta` meses a uma chave YYYY-MM (aritmética pura de string). */
function addMonths(month: string, delta: number): string {
  const [year, monthNum] = month.split("-").map(Number);
  const total = (year ?? 0) * 12 + ((monthNum ?? 1) - 1) + delta;
  const y = Math.floor(total / 12);
  const m = (((total % 12) + 12) % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Rótulo pt-BR ("agosto de 2026"). */
function monthLabel(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(year ?? 0, (monthNum ?? 1) - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

/** Seletor de mês por botões (sem `<select>` nativo — DESIGN_SYSTEM §13). */
export function MonthPicker({ value, onValueChange, disabled, className }: MonthPickerProps) {
  if (!isValidMonthKey(value)) {
    throw new Error(`MonthPicker: mês inválido "${value}" (esperado YYYY-MM).`);
  }

  const handleChange = (delta: number) => {
    triggerHaptic("light");
    onValueChange(addMonths(value, delta));
  };

  return (
    <div className={cn("flex items-center justify-between gap-2", className)} role="group" aria-label="Selecionar mês">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Mês anterior"
        disabled={disabled}
        onClick={() => handleChange(-1)}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <span key={value} className="flex-1 min-w-32 text-center text-sm font-medium capitalize text-foreground animate-fade-slide-in">
        {monthLabel(value)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Próximo mês"
        disabled={disabled}
        onClick={() => handleChange(1)}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}
