import { cva } from "class-variance-authority";

/**
 * Variantes de estilo do Button (CVA).
 * Separado do componente para compatibilidade com React Refresh
 * (react-refresh/only-export-components).
 */
export const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[color,background-color,box-shadow,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
  {
    variants: {
      // Estilo discreto (pós-F10): sem fundo sólido — borda de cor + texto
      // colorido, hover com tinta suave. Contraste AA nos 3 temas.
      // Variante `solid` (M3): reservada ao CTA primário único de conclusão.
      variant: {
        default: "border border-primary/25 bg-primary/10 text-primary-strong hover:bg-primary/20 hover:border-primary/40 shadow-sm",
        solid:
          "border border-transparent bg-primary-strong text-primary-foreground hover:bg-primary-strong/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 shadow-xs",
        secondary: "bg-secondary/15 text-foreground hover:bg-secondary/25",
        outline: "border border-border bg-surface text-foreground hover:bg-surface-hover hover:border-primary/40",
        ghost: "text-foreground hover:bg-surface-hover hover:text-primary",
        destructive: "border border-critical/40 bg-critical/10 text-critical-strong hover:bg-critical/20",
        warning: "border border-warning/40 bg-warning/10 text-warning-strong hover:bg-warning/20",
        positive: "border border-positive/40 bg-positive/10 text-positive-strong hover:bg-positive/20",
        portfolio: "border border-portfolio/40 bg-portfolio/10 text-portfolio-strong hover:bg-portfolio/20",
      },
      size: {
        xs: "h-7 px-2.5 text-xs [&_svg]:size-3 max-sm:after:absolute max-sm:after:-inset-2",
        sm: "h-8 px-3 text-xs [&_svg]:size-3.5 sm:[&_svg]:size-4 max-sm:after:absolute max-sm:after:-inset-1.5",
        default: "h-10 max-sm:min-h-11 px-3.5 sm:px-4 text-sm [&_svg]:size-4 sm:[&_svg]:size-4.5",
        lg: "h-11 sm:h-12 px-5 sm:px-6 text-sm sm:text-base font-semibold [&_svg]:size-4.5 sm:[&_svg]:size-5",
        icon: "size-10 [&_svg]:size-4.5 sm:[&_svg]:size-5 max-sm:after:absolute max-sm:after:-inset-1.5",
      },

    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
