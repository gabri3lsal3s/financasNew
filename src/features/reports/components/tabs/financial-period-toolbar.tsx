import { type Dispatch, type SetStateAction } from "react";
import { SegmentedControl } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { MonthPicker, YearPicker } from "@/components/modules";
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

        <SegmentedControl
          value={mode}
          onChange={(val) => setMode(val as PeriodMode)}
          options={PERIOD_OPTIONS}
          ariaLabel="Periodicidade do relatório"
          className="self-start sm:self-auto"
        />
      </div>
    </div>
  );
}
