import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { ptBR } from "react-day-picker/locale";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import type { ChevronProps, DayButtonProps } from "react-day-picker";
import { toISODate } from "@/domain/money";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  /** Data selecionada (ISO yyyy-MM-dd) ou vazia. */
  value: string;
  onValueChange?: (value: string) => void;
  /** Alias retrocompatível para onValueChange */
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

type ViewMode = "days" | "months" | "years";

const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const MONTH_FULL_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

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

const getTodayISO = (): string => toISODate(new Date());

const getYesterdayISO = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toISODate(d);
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
 * Botão de dia (F25 + hotfix): célula quadrada e flexível que acompanha a
 * largura da coluna (`w-full max-w-9 aspect-square`, centralizada) — os 7 dias
 * (Dom a Sáb) cabem sempre na largura disponível, sem overflow horizontal no
 * mobile. Dia selecionado com fundo sólido em gradiente sutil da cor primária
 * ativa do tema + texto de alto contraste; dia atual (today) com ponto
 * indicador; disabled/outside com opacidade reduzida; foco visível `ring-2`.
 */
function ThemedDayButton({ modifiers, className, ...props }: DayButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "mx-auto flex aspect-square w-full max-w-9 items-center justify-center rounded-full text-sm font-medium text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
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

/** DatePicker próprio do app (Radix Popover + DayPicker com Grade de Mês e Ano §F75) — substitui `<input type="date">` nativo. */
export function DatePicker({
  value,
  onValueChange,
  onChange,
  placeholder = "Selecione a data",
  disabled,
  ariaLabel,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("days");
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
    if (nextOpen) {
      if (selected) {
        setDisplayedMonth(selected);
      }
      setViewMode("days");
    } else {
      setViewMode("days");
    }
  };

  const base = getDefaultClassNames();
  const dayPickerClassNames = {
    ...base,
    root: cn(base.root, "p-3 pb-1"),
    month: cn(base.month, "relative flex flex-col"),
    month_caption: cn(base.month_caption, "flex h-8 items-center justify-center px-12"),
    caption_label: cn(base.caption_label, "font-display text-sm font-semibold text-foreground"),
    month_grid: cn(base.month_grid, "w-full table-fixed border-collapse"),
    weekday: cn(base.weekday, "py-1 text-center text-xs font-medium text-muted-foreground"),
    day: cn(base.day, "p-0 text-center"),
    button_previous: cn(
      base.button_previous,
      "absolute left-1 top-1 z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
    ),
    button_next: cn(
      base.button_next,
      "absolute right-1 top-1 z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
    ),
    chevron: cn(base.chevron, "size-4"),
    outside: cn(base.outside, "text-muted-foreground opacity-50"),
    disabled: cn(base.disabled, "text-muted-foreground opacity-40"),
  };

  const handleSelectDay = (date: Date | undefined) => {
    if (date) {
      emitChange(toISO(date));
      triggerSensory("selection");
      setOpen(false);
    }
  };

  const handleShortcut = (dateIso: string) => {
    emitChange(dateIso);
    triggerSensory("selection");
    setOpen(false);
  };

  // Cálculo da janela de 12 anos para a visão de anos (década base com 12 anos)
  const currentYear = displayedMonth.getFullYear();
  const startYear = Math.floor(currentYear / 10) * 10;
  const endYear = startYear + 11;
  const yearsList = Array.from({ length: 12 }, (_, i) => startYear + i);

  const today = new Date();

  /** Renderiza a grade de seleção de 12 meses */
  const renderMonthsView = () => (
    <div className="flex flex-col p-2">
      {/* Cabeçalho de Ano com Navegação */}
      <div className="flex h-9 items-center justify-between px-1 mb-1">
        <button
          type="button"
          onClick={() => {
            triggerSensory("selection");
            setDisplayedMonth(new Date(displayedMonth.getFullYear() - 1, displayedMonth.getMonth(), 1));
          }}
          aria-label="Ano anterior"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => {
            triggerSensory("selection");
            setViewMode("years");
          }}
          aria-label={`Mudar bloco de anos, atualmente ${displayedMonth.getFullYear()}`}
          className="group inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-display text-sm font-bold text-foreground transition-colors hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <span>{displayedMonth.getFullYear()}</span>
          <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-hover:text-primary" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => {
            triggerSensory("selection");
            setDisplayedMonth(new Date(displayedMonth.getFullYear() + 1, displayedMonth.getMonth(), 1));
          }}
          aria-label="Próximo ano"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Grade 3x4 de 12 Meses */}
      <div className="grid grid-cols-3 gap-2 py-1">
        {MONTH_LABELS.map((label, monthIndex) => {
          const isSelected =
            selected &&
            selected.getFullYear() === displayedMonth.getFullYear() &&
            selected.getMonth() === monthIndex;
          const isCurrentMonth =
            today.getFullYear() === displayedMonth.getFullYear() &&
            today.getMonth() === monthIndex;

          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                triggerSensory("selection");
                setDisplayedMonth(new Date(displayedMonth.getFullYear(), monthIndex, 1));
                setViewMode("days");
              }}
              aria-label={`${MONTH_FULL_NAMES[monthIndex]} de ${displayedMonth.getFullYear()}`}
              className={cn(
                "flex h-11 items-center justify-center rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
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

  /** Renderiza a grade de seleção de 12 anos */
  const renderYearsView = () => (
    <div className="flex flex-col p-2">
      {/* Cabeçalho de Década com Navegação */}
      <div className="flex h-9 items-center justify-between px-1 mb-1">
        <button
          type="button"
          onClick={() => {
            triggerSensory("selection");
            setDisplayedMonth(new Date(displayedMonth.getFullYear() - 10, displayedMonth.getMonth(), 1));
          }}
          aria-label="Bloco de anos anterior"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
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
            setDisplayedMonth(new Date(displayedMonth.getFullYear() + 10, displayedMonth.getMonth(), 1));
          }}
          aria-label="Próximo bloco de anos"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Grade 3x4 de 12 Anos */}
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
                setDisplayedMonth(new Date(year, displayedMonth.getMonth(), 1));
                setViewMode("months");
              }}
              aria-label={`Ano ${year}`}
              className={cn(
                "flex h-11 items-center justify-center rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
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

  /** Componente customizado de CaptionLabel com botão interativo para abrir o seletor de mês */
  const ThemedCaptionLabel = ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement>) => {
    return (
      <span className={cn(className, "inline-flex items-center justify-center")} {...props}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerSensory("selection");
            setViewMode("months");
          }}
          aria-label="Selecionar mês e ano"
          className="group inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-display text-sm font-semibold text-foreground transition-colors hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <span className="capitalize">{children}</span>
          <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-hover:text-primary" aria-hidden="true" />
        </button>
      </span>
    );
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
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
                emitChange("");
                triggerSensory("selection");
              }}
              className="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              <X className="size-4" aria-hidden="true" />
            </span>
          ) : (
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        {/* Container responsivo (hotfix): no mobile o calendário ocupa a largura
            do viewport menos uma margem (`calc(100vw - 1.5rem)`) e no desktop
            limita a `max-w-sm`; `max-h-[85dvh]` + scroll interno evitam barras
            de rolagem da página ao abrir dentro de modais. */}
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-modal max-h-[85dvh] w-[calc(100vw-1.5rem)] max-w-sm overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-lg focus:outline-none"
        >
          {viewMode === "days" ? (
            <DayPicker
              mode="single"
              month={displayedMonth}
              onMonthChange={setDisplayedMonth}
              selected={selected}
              onSelect={handleSelectDay}
              locale={ptBR}
              weekStartsOn={0}
              disabled={{ before: new Date("2000-01-01") }}
              classNames={dayPickerClassNames}
              components={{
                Chevron: ThemedChevron,
                DayButton: ThemedDayButton,
                CaptionLabel: ThemedCaptionLabel,
              }}
              navLayout="around"
            />
          ) : viewMode === "months" ? (
            renderMonthsView()
          ) : (
            renderYearsView()
          )}

          <div className="mt-1 flex items-center justify-between border-t border-border/60 px-2 pt-2">
            {viewMode !== "days" ? (
              <button
                type="button"
                onClick={() => {
                  triggerSensory("selection");
                  setViewMode("days");
                }}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                Voltar aos dias
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleShortcut(getYesterdayISO())}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                Ontem
              </button>
              <button
                type="button"
                onClick={() => handleShortcut(getTodayISO())}
                className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                Hoje
              </button>
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}


