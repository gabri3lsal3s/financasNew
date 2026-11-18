import { createContext, useContext } from "react";
import type { HTMLAttributes } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { ptBR } from "react-day-picker/locale";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import type { ChevronProps, DayButtonProps } from "react-day-picker";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import { CalendarMonthsGrid, CalendarYearsGrid } from "./calendar-period-grids";
import { getTodayISO, getYesterdayISO, toISO } from "./date-picker-utils";

export type CalendarViewMode = "days" | "months" | "years";

const CaptionActionContext = createContext<(() => void) | null>(null);

function ThemedChevron({ orientation = "left", className, ...props }: ChevronProps) {
  const Icon = orientation === "right" ? ChevronRight : ChevronLeft;
  return <Icon className={cn("size-4", className)} aria-hidden="true" {...props} />;
}

function ThemedDayButton({ modifiers, className, ...props }: DayButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "mx-auto flex aspect-square w-full max-w-9 items-center justify-center rounded-full text-sm font-medium text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
        modifiers.selected &&
          "bg-gradient-to-b from-primary to-primary/90 font-semibold text-primary-foreground shadow-sm hover:from-primary hover:to-primary",
        modifiers.today &&
          !modifiers.selected &&
          "relative after:absolute after:bottom-0.5 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
        modifiers.outside && "text-muted-foreground opacity-50",
        modifiers.disabled && "text-muted-foreground opacity-40",
        className,
      )}
    />
  );
}

function ThemedCaptionLabel({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  const openMonths = useContext(CaptionActionContext);
  return (
    <span className={cn(className, "inline-flex items-center justify-center")} {...props}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          triggerSensory("selection");
          openMonths?.();
        }}
        aria-label="Selecionar mês e ano"
        className="group inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-display text-sm font-semibold text-foreground transition-colors hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
      >
        <span className="capitalize">{children}</span>
        <ChevronDown
          className="size-3.5 text-muted-foreground transition-transform group-hover:text-primary"
          aria-hidden="true"
        />
      </button>
    </span>
  );
}

const BASE_CLASSES = getDefaultClassNames();
const DAY_PICKER_CLASS_NAMES = {
  ...BASE_CLASSES,
  root: cn(BASE_CLASSES.root, "p-3 pb-1"),
  month: cn(BASE_CLASSES.month, "relative flex flex-col"),
  month_caption: cn(BASE_CLASSES.month_caption, "flex h-8 items-center justify-center px-12"),
  caption_label: cn(BASE_CLASSES.caption_label, "font-display text-sm font-semibold text-foreground"),
  month_grid: cn(BASE_CLASSES.month_grid, "w-full table-fixed border-collapse"),
  weekday: cn(BASE_CLASSES.weekday, "py-1 text-center text-xs font-medium text-muted-foreground"),
  day: cn(BASE_CLASSES.day, "p-0 text-center"),
  button_previous: cn(
    BASE_CLASSES.button_previous,
    "absolute left-1 top-1 z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
  ),
  button_next: cn(
    BASE_CLASSES.button_next,
    "absolute right-1 top-1 z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
  ),
  chevron: cn(BASE_CLASSES.chevron, "size-4"),
  outside: cn(BASE_CLASSES.outside, "text-muted-foreground opacity-50"),
  disabled: cn(BASE_CLASSES.disabled, "text-muted-foreground opacity-40"),
};

export interface CalendarMonthGridProps {
  selected: Date | undefined;
  displayedMonth: Date;
  viewMode: CalendarViewMode;
  onDisplayedMonthChange: (month: Date) => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onSelectIso: (iso: string) => void;
}

/**
 * Grade de calendário com seleção de dias, meses e anos + atalhos Ontem/Hoje.
 */
export function CalendarMonthGrid({
  selected,
  displayedMonth,
  viewMode,
  onDisplayedMonthChange,
  onViewModeChange,
  onSelectIso,
}: CalendarMonthGridProps) {
  const handleSelectDay = (date: Date | undefined) => {
    if (date) onSelectIso(toISO(date));
  };

  return (
    <>
      {viewMode === "days" ? (
        <CaptionActionContext.Provider value={() => onViewModeChange("months")}>
          <DayPicker
            mode="single"
            month={displayedMonth}
            onMonthChange={onDisplayedMonthChange}
            selected={selected}
            onSelect={handleSelectDay}
            locale={ptBR}
            weekStartsOn={0}
            disabled={{ before: new Date("2000-01-01") }}
            classNames={DAY_PICKER_CLASS_NAMES}
            components={{
              Chevron: ThemedChevron,
              DayButton: ThemedDayButton,
              CaptionLabel: ThemedCaptionLabel,
            }}
            navLayout="around"
          />
        </CaptionActionContext.Provider>
      ) : viewMode === "months" ? (
        <CalendarMonthsGrid
          selected={selected}
          displayedMonth={displayedMonth}
          onDisplayedMonthChange={onDisplayedMonthChange}
          onSelectMonth={(monthIndex) => {
            onDisplayedMonthChange(new Date(displayedMonth.getFullYear(), monthIndex, 1));
            onViewModeChange("days");
          }}
          onOpenYears={() => onViewModeChange("years")}
        />
      ) : (
        <CalendarYearsGrid
          selected={selected}
          displayedMonth={displayedMonth}
          onDisplayedMonthChange={onDisplayedMonthChange}
          onSelectYear={(year) => {
            onDisplayedMonthChange(new Date(year, displayedMonth.getMonth(), 1));
            onViewModeChange("months");
          }}
        />
      )}

      <div className="mt-1 flex items-center justify-between border-t border-primary/20 px-2 pt-2">
        {viewMode !== "days" ? (
          <button
            type="button"
            onClick={() => {
              triggerSensory("selection");
              onViewModeChange("days");
            }}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            Voltar aos dias
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectIso(getYesterdayISO())}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            Ontem
          </button>
          <button
            type="button"
            onClick={() => onSelectIso(getTodayISO())}
            className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            Hoje
          </button>
        </div>
      </div>
    </>
  );
}
