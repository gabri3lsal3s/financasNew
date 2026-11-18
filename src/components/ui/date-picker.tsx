import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarDays, X } from "lucide-react";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import { CalendarMonthGrid, type CalendarViewMode } from "./calendar-month-grid";
import { toDate } from "./date-picker-utils";

export interface DatePickerProps {
  id?: string;
  /** Data selecionada (ISO yyyy-MM-dd) ou vazia. */
  value: string;
  onValueChange?: (value: string) => void;
  /** Alias retrocompatível para onValueChange. */
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

/** DatePicker próprio do app (Radix Popover + Grade de Dias/Mês/Ano) — substitui `<input type="date">` nativo. */
export function DatePicker({
  id,
  value,
  onValueChange,
  onChange,
  placeholder = "Selecione a data",
  disabled,
  ariaLabel,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("days");
  const selected = toDate(value);
  const [displayedMonth, setDisplayedMonth] = useState<Date>(() => selected ?? new Date());

  const emitChange = (val: string) => {
    if (onValueChange) {
      onValueChange(val);
    } else if (onChange) {
      onChange(val);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && selected) {
      setDisplayedMonth(selected);
    }
    setViewMode("days");
  };

  const handleSelectIso = (iso: string) => {
    emitChange(iso);
    triggerSensory("selection");
    setOpen(false);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <div className={cn("relative flex w-full items-center", className)}>
        <PopoverPrimitive.Trigger asChild disabled={disabled}>
          <button
            id={id}
            type="button"
            aria-label={ariaLabel}
            className={cn(
              "flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-surface px-3.5 text-base sm:text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
              value && !disabled && "pr-10",
              !value && "text-muted-foreground",
            )}
          >
            <span className="truncate">
              {value ? toDate(value)?.toLocaleDateString("pt-BR") : placeholder}
            </span>
            {!value || disabled ? (
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : null}
          </button>
        </PopoverPrimitive.Trigger>

        {value && !disabled ? (
          <button
            type="button"
            aria-label="Limpar data"
            onClick={(event) => {
              event.stopPropagation();
              emitChange("");
              triggerSensory("selection");
            }}
            className="absolute right-2.5 flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-sm:after:absolute max-sm:after:-inset-2"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={{ top: 8, left: 8, right: 8, bottom: 80 }}
          className="z-floating-tools max-h-[85dvh] w-[calc(100vw-1.5rem)] max-w-sm overflow-y-auto rounded-xl border border-primary/25 bg-surface p-2 shadow-xl backdrop-blur-md focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <CalendarMonthGrid
            selected={selected}
            displayedMonth={displayedMonth}
            viewMode={viewMode}
            onDisplayedMonthChange={setDisplayedMonth}
            onViewModeChange={setViewMode}
            onSelectIso={handleSelectIso}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
