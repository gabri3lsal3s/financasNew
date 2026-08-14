import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarDays, X } from "lucide-react";
import { ptBR } from "react-day-picker/locale";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  /** Data selecionada (ISO yyyy-MM-dd) ou vazia. */
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

const toDate = (iso: string): Date | undefined => {
  if (!iso) return undefined;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const toISO = (date: Date | undefined): string => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** DatePicker próprio do app (Radix Popover + DayPicker) — substitui `<input type="date">` nativo (DESIGN_SYSTEM §13). */
export function DatePicker({
  value,
  onValueChange,
  placeholder = "Selecione a data",
  disabled,
  ariaLabel,
  className,
}: DatePickerProps) {
  const selected = toDate(value);
  const base = getDefaultClassNames();
  const dayPickerClassNames = {
    ...base,
    root: cn(base.root, "p-3"),
    month_caption: cn(base.month_caption, "font-display text-sm font-semibold text-foreground"),
    weekday: cn(base.weekday, "text-xs font-medium text-muted-foreground"),
    day: cn(base.day, "h-9 w-9"),
    day_button: cn(
      base.day_button,
      "size-9 rounded-full text-sm text-foreground transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    ),
    selected: cn(base.selected, "bg-primary-strong text-primary-foreground hover:bg-primary-strong"),
    today: cn(base.today, "ring-2 ring-primary/40 ring-inset"),
    outside: cn(base.outside, "text-muted-foreground opacity-50"),
    disabled: cn(base.disabled, "text-muted-foreground opacity-40"),
    button_previous: cn(
      base.button_previous,
      "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    ),
    button_next: cn(
      base.button_next,
      "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    ),
  };

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-surface px-4 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value ? toDate(value)?.toLocaleDateString("pt-BR") : placeholder}</span>
          {value ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Limpar data"
              onClick={(event) => {
                event.stopPropagation();
                onValueChange("");
              }}
              className="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </span>
          ) : (
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 rounded-xl border border-border bg-surface p-2 shadow-lg focus:outline-none"
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(date) => onValueChange(toISO(date))}
            locale={ptBR}
            weekStartsOn={0}
            disabled={{ before: new Date("2000-01-01") }}
            classNames={dayPickerClassNames}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
