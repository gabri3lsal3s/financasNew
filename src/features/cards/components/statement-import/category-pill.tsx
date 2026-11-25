import { useMemo, useState } from "react";
import { Check, Tag } from "lucide-react";
import {
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  type SelectOption,
} from "@/components/ui";

export interface CategoryPillProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Seletor rápido de categoria em popover com busca interna (16px no mobile, sem autoFocus).
 */
export function CategoryPill({
  value,
  options,
  onChange,
  disabled = false,
}: CategoryPillProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(lower));
  }, [options, search]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border/80 bg-surface hover:bg-surface-raised active:bg-surface-raised text-foreground transition-colors w-full sm:w-44 min-w-0 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 cursor-pointer"
          aria-label={`Categoria: ${selectedOption?.label ?? "Selecionar categoria"}`}
        >
          <span className="truncate flex-1">
            {selectedOption?.label ?? "Selecionar categoria"}
          </span>
          <Tag className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        elevated
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-60 p-2 space-y-1.5 z-floating-tools bg-surface/98 border border-border/80 rounded-xl shadow-xl"
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Buscar categoria..."
          aria-label="Buscar categoria"
          className="h-9 text-base sm:text-sm"
        />
        <div
          className="max-h-48 overflow-y-auto no-scrollbar space-y-0.5"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {filteredOptions.length === 0 ? (
            <div className="p-2 text-center text-xs text-muted-foreground">
              Nenhuma categoria encontrada.
            </div>
          ) : (
            filteredOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(opt.value);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                  opt.value === value
                    ? "bg-primary/10 text-primary-strong font-semibold"
                    : "text-foreground hover:bg-surface-raised"
                }`}
              >
                <span className="line-clamp-2 break-words">{opt.label}</span>
                {opt.value === value ? (
                  <Check className="size-3.5 shrink-0 text-primary-strong" aria-hidden="true" />
                ) : null}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
