import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
  className?: string;
}

/** Checkbox próprio do app (Radix) — substitui o `<input type="checkbox">` nativo (DESIGN_SYSTEM §13). */
export function Checkbox({ checked, onCheckedChange, disabled, label, id, className }: CheckboxProps) {
  return (
    <div className="flex items-center gap-2">
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={(state) => onCheckedChange(state === true)}
        disabled={disabled}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded border border-input bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary-strong data-[state=checked]:bg-primary-strong",
          className,
        )}
      >
        <CheckboxPrimitive.Indicator>
          <Check className="size-3 text-primary-foreground" aria-hidden="true" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label ? (
        <label htmlFor={id} className="text-sm text-foreground">
          {label}
        </label>
      ) : null}
    </div>
  );
}
