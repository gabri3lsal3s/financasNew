import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

/** Select próprio do app (Radix) — substitui o `<select>` nativo (DESIGN_SYSTEM §13). */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Selecione…",
  disabled,
  ariaLabel,
  className,
}: SelectProps) {
  const handleValueChange = (next: string) => {
    onValueChange(next);
    triggerSensory("selection");
  };

  return (
    <SelectPrimitive.Root value={value} onValueChange={handleValueChange} disabled={disabled}>

      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-surface px-4 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground",
          className,
        )}
      >
        <span className="truncate min-w-0 flex-1 text-left">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        {/* `position="popper"` (hotfix): configuração recomendada para Select
            dentro de Dialogs/containers roláveis — mede com colisão de viewport
            e não depende do alinhamento com o item selecionado (item-aligned
            falha dentro do bottom sheet do Modal com transform/overflow). */}
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          align="start"
          className="z-modal max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 pr-8 text-sm text-foreground outline-none transition-colors focus:bg-primary/10 data-[state=checked]:font-medium"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2">
                  <Check className="size-4 text-primary-strong" aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
