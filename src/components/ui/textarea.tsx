import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

/**
 * Textarea próprio do app (DESIGN_SYSTEM §13).
 */
export function Textarea({ className, label, error, id, ...props }: TextareaProps) {
  const inputId = id ?? (label ? `textarea-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label ? (
        <label htmlFor={inputId} className="text-xs font-medium text-foreground">
          {label}
        </label>
      ) : null}
      <textarea
        id={inputId}
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          error && "border-critical focus-visible:ring-critical",
          className,
        )}
        {...props}
      />
      {error ? <span className="text-xs text-critical">{error}</span> : null}
    </div>
  );
}
