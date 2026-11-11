import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { triggerSensory, type SensoryIntent } from "@/services/sensory";
import { chipVariants } from "./chip-variants";

export interface ChipProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof chipVariants> {
  selected?: boolean;
  icon?: ReactNode;
  sensoryIntent?: SensoryIntent | false;
}

/**
 * Primitivo canônico `<Chip />` para filtros, atalhos de 1 toque, contextos e seleção rápida.
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  {
    className,
    variant,
    size,
    selected,
    icon,
    sensoryIntent,
    type = "button",
    disabled,
    onClick,
    children,
    ...props
  },
  ref,
) {
  const effectiveVariant = selected ? "selected" : (variant ?? "default");

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (sensoryIntent !== false) {
      triggerSensory(sensoryIntent ?? "action");
    }
    onClick?.(e);
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={handleClick}
      aria-pressed={selected !== undefined ? selected : undefined}
      className={cn(chipVariants({ variant: effectiveVariant, size }), className)}
      {...props}
    >
      {icon && <span className="shrink-0 flex items-center justify-center" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
});
