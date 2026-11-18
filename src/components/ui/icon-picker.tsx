import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronDown, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import { Input } from "./input";

export interface IconPickerOption {
  /** Valor salvo no schema (ex.: nome do ícone em `categories.icon`). */
  value: string;
  /** Rótulo exibido (padrão: o próprio value). */
  label?: string;
  /** Ícone lucide-react renderizado na grade e no trigger. */
  icon: LucideIcon;
}

export interface IconPickerProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly IconPickerOption[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

const GRID_COLUMNS = 6;

/**
 * IconPicker próprio do app (Radix Popover) — grade de ícones `lucide-react`
 * com busca e navegação por setas no `radiogroup` (DESIGN_SYSTEM §13).
 */
export function IconPicker({
  value,
  onValueChange,
  options,
  placeholder = "Escolha um ícone",
  disabled,
  ariaLabel,
  className,
}: IconPickerProps) {
  const [query, setQuery] = useState("");
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selected = options.find((option) => option.value === value) ?? null;
  const filtered = query.trim()
    ? options.filter((option) =>
        (option.label ?? option.value).toLowerCase().includes(query.trim().toLowerCase()),
      )
    : options;

  const selectedFilteredIndex = filtered.findIndex((option) => option.value === value);

  const handleRadioKeyDown = (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (filtered.length === 0) return;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % filtered.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + filtered.length) % filtered.length;
    } else if (event.key === "ArrowDown") {
      nextIndex = Math.min(filtered.length - 1, index + GRID_COLUMNS);
    } else if (event.key === "ArrowUp") {
      nextIndex = Math.max(0, index - GRID_COLUMNS);
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = filtered.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const targetOption = filtered[nextIndex];
    if (!targetOption) return;
    triggerSensory("selection");
    onValueChange(targetOption.value);
    itemRefs.current[nextIndex]?.focus();
  };

  return (
    <PopoverPrimitive.Root
      onOpenChange={(open) => {
        if (open) setQuery("");
      }}
    >
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-surface px-3.5 text-base sm:text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected ? (
              <selected.icon className="size-4 shrink-0 text-primary-strong" aria-hidden="true" />
            ) : (
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <span className="truncate">{selected ? (selected.label ?? selected.value) : placeholder}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={{ top: 8, left: 8, right: 8, bottom: 80 }}
          className="z-floating-tools w-72 rounded-xl border border-primary/25 bg-surface p-3 shadow-xl backdrop-blur-md focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <div className="flex flex-col gap-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar ícone…"
              aria-label="Buscar ícone"
              className="h-9 px-3.5 text-base sm:text-sm"
            />

            {filtered.length > 0 ? (
              <div
                className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto p-0.5"
                role="radiogroup"
                aria-label="Ícones disponíveis"
              >
                {filtered.map((option, index) => {
                  const isSelected = option.value === value;
                  const isFocusable =
                    selectedFilteredIndex >= 0 ? isSelected : index === 0;
                  return (
                    <button
                      key={option.value}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      type="button"
                      role="radio"
                      tabIndex={isFocusable ? 0 : -1}
                      aria-checked={isSelected}
                      aria-label={option.label ?? option.value}
                      title={option.label ?? option.value}
                      onKeyDown={handleRadioKeyDown(index)}
                      onClick={() => {
                        triggerSensory("selection");
                        onValueChange(option.value);
                      }}
                      className={cn(
                        "flex aspect-square cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        isSelected && "bg-primary/10 text-primary-strong ring-1 ring-ring",
                      )}
                    >
                      <option.icon className="size-5" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum ícone encontrado.</p>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export type { LucideIcon };
