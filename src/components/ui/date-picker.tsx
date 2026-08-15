import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { ptBR } from "react-day-picker/locale";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import type { ChevronProps, DayButtonProps } from "react-day-picker";
import { toISODate } from "@/domain/money";
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
  // Fonte única de ISO local (DRY): domain/money/parcelar.toISODate.
  return toISODate(date);
};

/**
 * Chevron próprio (F25/pós-F13): substitui o polígono SVG padrão do DayPicker
 * por `Lucide ChevronLeft/ChevronRight`, com contraste garantido em qualquer
 * tema (Dark/Light/acento customizado).
 */
function ThemedChevron({ orientation = "left", className, ...props }: ChevronProps) {
  const Icon = orientation === "right" ? ChevronRight : ChevronLeft;
  return <Icon className={cn("size-4", className)} aria-hidden="true" {...props} />;
}

/**
 * Botão de dia (F25): dia selecionado com fundo sólido em gradiente sutil da
 * cor primária ativa do tema + texto de alto contraste; dia atual (today) com
 * ponto indicador; disabled/outside com opacidade reduzida.
 */
function ThemedDayButton({ modifiers, className, ...props }: DayButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "size-9 rounded-full text-sm font-medium text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
    // Header centralizado (F25): `navLayout="around"` coloca as setas nas
    // extremidades do mês e o seletor de Mês/Ano centralizado (flex-1).
    month: cn(base.month, "flex items-center justify-between gap-1"),
    month_caption: cn(base.month_caption, "flex-1 text-center"),
    caption_label: cn(base.caption_label, "font-display text-sm font-semibold text-foreground"),
    weekday: cn(base.weekday, "text-xs font-medium text-muted-foreground"),
    day: cn(base.day, "h-9 w-9"),
    button_previous: cn(
      base.button_previous,
      "flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    ),
    button_next: cn(
      base.button_next,
      "flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    ),
    chevron: cn(base.chevron, "size-4"),
    outside: cn(base.outside, "text-muted-foreground opacity-50"),
    disabled: cn(base.disabled, "text-muted-foreground opacity-40"),
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
          className="z-modal rounded-xl border border-border bg-surface p-2 shadow-lg focus:outline-none"
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(date) => onValueChange(toISO(date))}
            locale={ptBR}
            weekStartsOn={0}
            disabled={{ before: new Date("2000-01-01") }}
            classNames={dayPickerClassNames}
            components={{ Chevron: ThemedChevron, DayButton: ThemedDayButton }}
            navLayout="around"
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
