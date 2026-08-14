import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

export interface RadioOption {
  value: string;
  label: string;
}

export interface RadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  options: RadioOption[];
  name?: string;
  disabled?: boolean;
  className?: string;
}

/** RadioGroup próprio do app (Radix) — substitui `<input type="radio">` nativo (DESIGN_SYSTEM §13). */
export function RadioGroup({ value, onValueChange, options, name, disabled, className }: RadioGroupProps) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      name={name}
      disabled={disabled}
      className={cn("flex flex-col gap-2", className)}
    >
      {options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <RadioGroupPrimitive.Item
            value={option.value}
            className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary-strong"
          >
            <RadioGroupPrimitive.Indicator className="flex size-2 rounded-full bg-primary-strong" />
          </RadioGroupPrimitive.Item>
          {option.label}
        </label>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
