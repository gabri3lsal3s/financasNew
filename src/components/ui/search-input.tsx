import { forwardRef, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "./input";
import { triggerSensory } from "@/services/sensory";

export interface SearchInputProps extends InputProps {
  onClear?: () => void;
  showClear?: boolean;
  searchIconClassName?: string;
  wrapperClassName?: string;
}

/**
 * Primitivo canônico de campo de busca do sistema (Regra 4 e Regra 7 de AGENTS.md).
 * Padroniza o ícone de lupa sóbrio alinhado à esquerda, espaçamento interno
 * e botão de limpeza interativo com gatilho sensorial e suporte a teclado (Esc).
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      showClear = true,
      searchIconClassName,
      wrapperClassName,
      className,
      placeholder = "Buscar…",
      "aria-label": ariaLabel = "Buscar",
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const hasValue = Boolean(value && String(value).length > 0);

    const handleClear = () => {
      triggerSensory("action");
      if (onClear) {
        onClear();
      } else if (onChange) {
        const syntheticEvent = {
          target: { value: "" },
          currentTarget: { value: "" },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape" && hasValue) {
        event.preventDefault();
        handleClear();
      }
      onKeyDown?.(event);
    };

    return (
      <div className={cn("relative flex-1 min-w-0", wrapperClassName)}>
        <Search
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none",
            searchIconClassName,
          )}
          aria-hidden="true"
        />

        <Input
          ref={ref}
          type="search"
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={cn("pl-9", hasValue && showClear ? "pr-9" : "", className)}
          {...props}
        />

        {hasValue && showClear ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Limpar campo de busca"
            title="Limpar busca"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-surface-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  },
);

SearchInput.displayName = "SearchInput";
