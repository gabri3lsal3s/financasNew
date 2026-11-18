import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import { MONTH_FULL_NAMES, MONTH_LABELS } from "./date-picker-utils";

interface CalendarMonthsGridProps {
  selected: Date | undefined;
  displayedMonth: Date;
  onDisplayedMonthChange: (month: Date) => void;
  onSelectMonth: (monthIndex: number) => void;
  onOpenYears: () => void;
}

export function CalendarMonthsGrid({
  selected,
  displayedMonth,
  onDisplayedMonthChange,
  onSelectMonth,
  onOpenYears,
}: CalendarMonthsGridProps) {
  const today = new Date();
  const currentYear = displayedMonth.getFullYear();

  return (
    <div className="flex flex-col p-2">
      <div className="flex h-9 items-center justify-between px-1 mb-1">
        <button
          type="button"
          onClick={() => {
            triggerSensory("selection");
            onDisplayedMonthChange(new Date(currentYear - 1, displayedMonth.getMonth(), 1));
          }}
          aria-label="Ano anterior"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => {
            triggerSensory("selection");
            onOpenYears();
          }}
          aria-label={`Mudar bloco de anos, atualmente ${currentYear}`}
          className="group inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-display text-sm font-bold text-foreground transition-colors hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
        >
          <span>{currentYear}</span>
          <ChevronDown
            className="size-3.5 text-muted-foreground transition-transform group-hover:text-primary"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          onClick={() => {
            triggerSensory("selection");
            onDisplayedMonthChange(new Date(currentYear + 1, displayedMonth.getMonth(), 1));
          }}
          aria-label="Próximo ano"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 py-1">
        {MONTH_LABELS.map((label, monthIndex) => {
          const isSelected =
            selected && selected.getFullYear() === currentYear && selected.getMonth() === monthIndex;
          const isCurrentMonth =
            today.getFullYear() === currentYear && today.getMonth() === monthIndex;
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                triggerSensory("selection");
                onSelectMonth(monthIndex);
              }}
              aria-label={`${MONTH_FULL_NAMES[monthIndex]} de ${currentYear}`}
              className={cn(
                "flex h-11 items-center justify-center rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
                isSelected
                  ? "bg-gradient-to-b from-primary to-primary/90 font-semibold text-primary-foreground shadow-sm hover:from-primary hover:to-primary"
                  : isCurrentMonth
                    ? "border border-primary/50 text-primary font-semibold hover:bg-primary/15"
                    : "text-foreground bg-surface-hover/40 hover:bg-primary/15 hover:text-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface CalendarYearsGridProps {
  selected: Date | undefined;
  displayedMonth: Date;
  onDisplayedMonthChange: (month: Date) => void;
  onSelectYear: (year: number) => void;
}

export function CalendarYearsGrid({
  selected,
  displayedMonth,
  onDisplayedMonthChange,
  onSelectYear,
}: CalendarYearsGridProps) {
  const today = new Date();
  const currentYear = displayedMonth.getFullYear();
  const startYear = Math.floor(currentYear / 10) * 10;
  const endYear = startYear + 11;
  const yearsList = Array.from({ length: 12 }, (_, i) => startYear + i);

  return (
    <div className="flex flex-col p-2">
      <div className="flex h-9 items-center justify-between px-1 mb-1">
        <button
          type="button"
          onClick={() => {
            triggerSensory("selection");
            onDisplayedMonthChange(new Date(currentYear - 10, displayedMonth.getMonth(), 1));
          }}
          aria-label="Bloco de anos anterior"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <span className="font-display text-sm font-bold text-foreground px-3 py-1">
          {startYear} – {endYear}
        </span>
        <button
          type="button"
          onClick={() => {
            triggerSensory("selection");
            onDisplayedMonthChange(new Date(currentYear + 10, displayedMonth.getMonth(), 1));
          }}
          aria-label="Próximo bloco de anos"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 py-1">
        {yearsList.map((year) => {
          const isSelected = selected && selected.getFullYear() === year;
          const isCurrentYear = today.getFullYear() === year;
          return (
            <button
              key={year}
              type="button"
              onClick={() => {
                triggerSensory("selection");
                onSelectYear(year);
              }}
              aria-label={`Ano ${year}`}
              className={cn(
                "flex h-11 items-center justify-center rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
                isSelected
                  ? "bg-gradient-to-b from-primary to-primary/90 font-semibold text-primary-foreground shadow-sm hover:from-primary hover:to-primary"
                  : isCurrentYear
                    ? "border border-primary/50 text-primary font-semibold hover:bg-primary/15"
                    : "text-foreground bg-surface-hover/40 hover:bg-primary/15 hover:text-foreground",
              )}
            >
              {year}
            </button>
          );
        })}
      </div>
    </div>
  );
}
