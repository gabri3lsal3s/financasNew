import { type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { MonthPicker, YearPicker } from "@/components/modules";
import { cn } from "@/lib/utils";
import type { PeriodMode } from "./financial-tab";

export interface FinancialPeriodToolbarProps {
  mode: PeriodMode;
  setMode: Dispatch<SetStateAction<PeriodMode>>;
  month: string;
  setMonth: (month: string) => void;
  year: number;
  setYear: (year: number) => void;
  customStart: string;
  setCustomStart: (start: string) => void;
  customEnd: string;
  setCustomEnd: (end: string) => void;
}

const PERIOD_OPTIONS: readonly { value: PeriodMode; label: string }[] = [
  { value: "month", label: "Mensal" },
  { value: "year", label: "Anual" },
  { value: "custom", label: "Personalizado" },
];

/** Seletor de data e alternador de periodicidade (Mensal / Anual / Personalizado) da aba Finanças. */
export function FinancialPeriodToolbar({
  mode,
  setMode,
  month,
  setMonth,
  year,
  setYear,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
}: FinancialPeriodToolbarProps) {
  return (
    <div className="flex flex-col gap-4">
      {mode === "month" ? (
        <MonthPicker value={month} onValueChange={setMonth} />
      ) : mode === "year" ? (
        <YearPicker value={year} onValueChange={setYear} />
      ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 w-full py-1">
          <DatePicker
            value={customStart}
            onValueChange={setCustomStart}
            placeholder="Início"
            ariaLabel="Data inicial do período"
            className="w-full sm:w-auto"
          />
          <span className="text-xs text-muted-foreground text-center">até</span>
          <DatePicker
            value={customEnd}
            onValueChange={setCustomEnd}
            placeholder="Fim"
            ariaLabel="Data final do período"
            className="w-full sm:w-auto"
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="hidden text-xs text-muted-foreground sm:block sm:text-sm">
          Acompanhe o fluxo de caixa, DRE pessoal e taxas de poupança da competência.
        </p>

        <div
          role="group"
          aria-label="Periodicidade do relatório"
          className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto no-scrollbar scroll-smooth py-1 -my-1"
        >
          {PERIOD_OPTIONS.map((option) => {
            const isActive = mode === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={isActive ? "default" : "outline"}
                onClick={() => setMode(option.value)}
                className={cn(
                  "shrink-0 gap-1.5 text-xs px-3.5 rounded-pill transition-all",
                  isActive
                    ? "shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={isActive}
                sensoryIntent="selection"
              >
                <span>{option.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
