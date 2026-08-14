import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronDown, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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

/**
 * IconPicker próprio do app (Radix Popover) — grade de ícones `lucide-react`
 * com busca, substituindo o select textual de ícones (DESIGN_SYSTEM §13).
 * Primitivo agnóstico de domínio: os ícones vêm via `options` (as telas
 * montam a lista a partir de CATEGORY_ICON_MAP, sem emojis).
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

  const selected = options.find((option) => option.value === value) ?? null;
  const filtered = query.trim()
    ? options.filter((option) =>
        (option.label ?? option.value).toLowerCase().includes(query.trim().toLowerCase()),
      )
    : options;

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
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-surface px-3 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
          className="z-modal w-72 rounded-xl border border-border bg-surface p-3 shadow-lg focus:outline-none"
        >
          <div className="flex flex-col gap-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar ícone…"
              aria-label="Buscar ícone"
              className="h-9 px-3 text-sm"
            />

            {filtered.length > 0 ? (
              <div
                className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto"
                role="radiogroup"
                aria-label="Ícones disponíveis"
              >
                {filtered.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={option.label ?? option.value}
                      title={option.label ?? option.value}
                      onClick={() => {
                        onValueChange(option.value);
                      }}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
