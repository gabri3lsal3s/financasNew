import * as React from "react";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * Switch primitivo do app — atende a AGENTS.md §4 (Regra DRY / Zero controles nativos)
 * e DESIGN_SYSTEM §13.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  description,
  id,
  className,
  "aria-label": ariaLabel,
}: SwitchProps) {
  const switchId =
    id ??
    (typeof label === "string"
      ? `switch-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
      : undefined);

  const handleClick = () => {
    if (disabled) return;
    triggerSensory("toggle");
    onCheckedChange(!checked);
  };

  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <button
        type="button"
        role="switch"
        id={switchId}
        aria-checked={checked}
        disabled={disabled}
        aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
        onClick={handleClick}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 mt-0.5",
          checked ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block size-4 rounded-full bg-background shadow-xs ring-0 transition duration-200 ease-in-out",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
      {label || description ? (
        <div
          className={cn("flex flex-col gap-0.5 min-w-0 select-none", !disabled && "cursor-pointer")}
          onClick={handleClick}
        >
          {label && (
            <label
              htmlFor={switchId}
              className={cn(
                "text-xs font-semibold text-foreground leading-snug",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              )}
            >
              {label}
            </label>
          )}
          {description && (
            <p className={cn("text-[11px] text-muted-foreground leading-normal", disabled && "opacity-50")}>
              {description}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
