import { cva } from "class-variance-authority";

/**
 * Variantes de estilo do Chip (CVA).
 * Separado do componente para compatibilidade com React Refresh
 * (react-refresh/only-export-components).
 */
export const chipVariants = cva(
  "inline-flex items-center justify-center shrink-0 font-medium transition-colors cursor-pointer select-none border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-border/80 bg-surface-raised text-foreground hover:border-border hover:bg-surface-hover",
        outline:
          "border-border/80 bg-transparent text-foreground hover:border-border hover:bg-surface-hover",
        selected:
          "border-primary bg-primary/10 text-primary font-semibold hover:bg-primary/15",
      },
      size: {
        sm: "py-1 px-2.5 text-xs gap-1.5 rounded-lg",
        md: "py-1.5 px-3 text-xs sm:text-sm gap-2 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);
