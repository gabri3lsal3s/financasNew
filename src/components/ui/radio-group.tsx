import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

export interface RadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  options: RadioOption[];
  name?: string;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "cards";
}

/** RadioGroup próprio do app (Radix) — substitui `<input type="radio">` nativo (DESIGN_SYSTEM §13). */
export function RadioGroup({
  value,
  onValueChange,
  options,
  name,
  disabled,
  className,
  variant = "default",
}: RadioGroupProps) {
  const handleValueChange = (next: string) => {
    onValueChange(next);
    triggerSensory("selection");
  };

  const isCards = variant === "cards";

  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={handleValueChange}
      name={name}
      disabled={disabled}
      className={cn(isCards ? "flex flex-col gap-2.5" : "flex flex-col gap-2", className)}
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        if (isCards) {
          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border border-border/80 bg-surface p-3 transition-colors hover:bg-surface-hover/50",
                isSelected && "border-primary/50 bg-primary/5 text-foreground",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              <RadioGroupPrimitive.Item
                value={option.value}
                className="mt-0.5 flex !size-4 !min-w-4 !max-w-4 shrink-0 items-center justify-center rounded-full border border-input bg-surface transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary-strong"
              >
                <RadioGroupPrimitive.Indicator className="flex size-2 rounded-full bg-primary-strong" />
              </RadioGroupPrimitive.Item>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-foreground">{option.label}</span>
                {option.description && (
                  <span className="text-[11px] text-muted-foreground leading-relaxed">{option.description}</span>
                )}
              </div>
            </label>
          );
        }

        return (
          <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <RadioGroupPrimitive.Item
              value={option.value}
              className="flex !size-4 !min-w-4 !max-w-4 shrink-0 items-center justify-center rounded-full border border-input bg-surface transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary-strong"
            >
              <RadioGroupPrimitive.Indicator className="flex size-2 rounded-full bg-primary-strong" />
            </RadioGroupPrimitive.Item>
            <div className="flex flex-col">
              <span>{option.label}</span>
              {option.description && (
                <span className="text-xs text-muted-foreground">{option.description}</span>
              )}
            </div>
          </label>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}
