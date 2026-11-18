import { forwardRef, useId } from "react";
import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

/**
 * Textarea próprio do app (DESIGN_SYSTEM §13).
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, label, error, id, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedBy, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label ? (
        <label htmlFor={inputId} className="text-xs font-semibold text-foreground select-none">
          {label}
        </label>
      ) : null}
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error) || ariaInvalid}
        aria-describedby={errorId ?? ariaDescribedBy}
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-surface px-3.5 py-2 text-base sm:text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          error && "border-critical-strong focus-visible:border-critical-strong focus-visible:ring-critical/20",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-[11px] font-medium text-critical-strong leading-tight">
          {error}
        </p>
      ) : null}
    </div>
  );
});
