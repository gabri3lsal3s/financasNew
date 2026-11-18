import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { useVisualCustomization } from "@/hooks/use-visual-customization";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  id?: string;
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
  id,
  value,
  onValueChange,
  options,
  placeholder = "Selecione…",
  disabled,
  ariaLabel,
  className,
}: SelectProps) {
  const visual = useVisualCustomization();
  const isFlat = visual.surfaceStyle === "flat";

  const handleValueChange = (next: string) => {
    if (!next && !options.some((opt) => opt.value === "")) return;
    onValueChange(next);
    triggerSensory("selection");
  };

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <SelectPrimitive.Root value={value} onValueChange={handleValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-surface px-3.5 text-base sm:text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground",
          isFlat ? "shadow-none" : "shadow-xs",
          className,
        )}
      >
        <span className="truncate min-w-0 flex-1 text-left">
          <SelectPrimitive.Value placeholder={placeholder}>
            {selectedOption?.label}
          </SelectPrimitive.Value>
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          collisionPadding={{ top: 8, left: 8, right: 8, bottom: 80 }}
          align="start"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
          }}
          className={cn(
            "z-floating-tools max-h-72 w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-primary/25 p-1 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            isFlat ? "bg-surface shadow-none" : "bg-surface/95 shadow-xl backdrop-blur-md",
          )}
        >
          <SelectPrimitive.Viewport className="w-full">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="relative flex w-full cursor-pointer select-none items-center rounded-md px-3 py-2.5 pr-8 text-sm text-foreground outline-none transition-colors focus:bg-primary/10 data-[state=checked]:font-medium data-[state=checked]:text-primary"
              >
                <span className="whitespace-normal break-words leading-snug text-left">
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </span>
                <SelectPrimitive.ItemIndicator className="absolute right-2 top-3">
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
