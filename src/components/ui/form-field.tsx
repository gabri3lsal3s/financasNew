import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FormFieldProps extends ComponentPropsWithoutRef<"div"> {
  label?: ReactNode;
  htmlFor?: string;
  optional?: boolean;
  required?: boolean;
  helperText?: ReactNode;
  error?: string;
  layout?: "vertical" | "horizontal";
  labelClassName?: string;
  children: ReactNode;
}

/**
 * Primitivo canônico de campo de formulário (Regra 15 de AGENTS.md).
 * Encapsula a anatomia de:
 * - Label: `text-xs font-semibold text-foreground`
 * - Indicador opcional: `(opcional)` em `text-[11px] font-normal text-muted-foreground`
 * - Helper text: `text-[11px] text-muted-foreground`
 * - Error text: `text-[11px] font-medium text-critical-strong`
 */
export function FormField({
  label,
  htmlFor,
  optional,
  required,
  helperText,
  error,
  layout = "vertical",
  labelClassName,
  className,
  children,
  ...props
}: FormFieldProps) {
  const isHorizontal = layout === "horizontal";
  const helperId = htmlFor && helperText ? `${htmlFor}-helper` : undefined;
  const errorId = htmlFor && error ? `${htmlFor}-error` : undefined;

  return (
    <div
      className={cn(
        isHorizontal
          ? "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
          : "flex flex-col gap-1.5",
        className,
      )}
      {...props}
    >
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={htmlFor}
            className={cn("text-xs font-semibold text-foreground select-none", labelClassName)}
          >
            {label}
            {required ? <span className="text-critical ml-0.5" aria-hidden="true">*</span> : null}
            {optional ? (
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                (opcional)
              </span>
            ) : null}
          </label>
        </div>
      ) : null}

      <div className={cn("min-w-0 flex-1 flex flex-col gap-1")}>
        {children}

        {error ? (
          <p
            id={errorId}
            role="alert"
            className="text-[11px] font-medium text-critical-strong leading-tight animate-fade-in"
          >
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-[11px] text-muted-foreground leading-tight">
            {helperText}
          </p>
        ) : null}
      </div>
    </div>
  );
}
