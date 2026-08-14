import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperProps {
  /** Rótulos dos passos, em ordem. */
  steps: string[];
  /** Passo atual (1-based). */
  current: number;
}

/** Indicador de progresso de passos — usado pelo wizard de lançamento (D10). */
export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progresso">
      {steps.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        const isLast = step === steps.length;
        return (
          <li key={label} className={cn("flex items-center gap-2", isLast ? "flex-none" : "flex-1")}>
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                done
                  ? "border-primary-strong bg-primary-strong text-primary-foreground"
                  : active
                    ? "border-primary text-primary-strong ring-2 ring-primary/20"
                    : "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" aria-hidden="true" /> : step}
            </span>
            <span className={cn("hidden text-xs font-medium sm:block", active ? "text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
            {!isLast ? (
              <span className={cn("h-px flex-1", done ? "bg-primary-strong" : "bg-border")} aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
