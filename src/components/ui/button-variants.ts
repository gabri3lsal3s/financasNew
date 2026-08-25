import { cva } from "class-variance-authority";

/**
 * Variantes de estilo do Button (CVA).
 * Separado do componente para compatibilidade com React Refresh
 * (react-refresh/only-export-components).
 */
export const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-lg text-sm font-medium transition-[color,background-color,box-shadow,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
  {
    variants: {
      // Estilo discreto (pós-F10): sem fundo sólido — borda de cor + texto
      // colorido, hover com tinta suave. Contraste AA nos 3 temas.
      variant: {
        default: "border border-primary/25 bg-primary/10 text-primary-strong hover:bg-primary/20 hover:border-primary/40 shadow-sm",
        secondary: "bg-secondary/15 text-foreground hover:bg-secondary/25",
        outline: "border border-border bg-surface text-foreground hover:bg-surface-hover hover:border-primary/40",
        ghost: "text-foreground hover:bg-surface-hover hover:text-primary",
        destructive: "border border-critical/40 bg-critical/10 text-critical-strong hover:bg-critical/20",
        positive: "border border-positive/40 bg-positive/10 text-positive-strong hover:bg-positive/20",
      },
      size: {
        xs: "h-7 px-2.5 text-xs [&_svg]:size-3",
        sm: "h-8 px-3 text-xs [&_svg]:size-3.5 sm:[&_svg]:size-4",
        default: "h-9 sm:h-10 px-3.5 sm:px-4 text-sm [&_svg]:size-4 sm:[&_svg]:size-4.5",
        lg: "h-11 sm:h-12 px-5 sm:px-6 text-sm sm:text-base font-semibold [&_svg]:size-4.5 sm:[&_svg]:size-5",
        icon: "size-9 sm:size-10 [&_svg]:size-4.5 sm:[&_svg]:size-5",
      },

    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
