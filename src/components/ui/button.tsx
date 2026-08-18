import { forwardRef, useState } from "react";
import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/services/haptics";
import { playSound } from "@/services/audio-fx";
import { getVisualCustomization } from "@/hooks/use-visual-customization";

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

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  disableRipple?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading = false, disableRipple = false, disabled, children, onClick, ...props },
  ref,
) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;

    // Feedback sensorial
    triggerHaptic("light");
    const visual = getVisualCustomization();
    playSound("click", visual.soundEnabled);

    // Efeito ripple dinâmico no ponto do clique (F11: só no nível "fluid";
    // eco/reduzido desligam a física elástica).
    if (!disableRipple && visual.motionLevel === "fluid") {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const rippleSize = Math.max(rect.width, rect.height) * 2;

      const newRipple: Ripple = {
        id: Date.now() + Math.random(),
        x: clickX - rippleSize / 2,
        y: clickY - rippleSize / 2,
        size: rippleSize,
      };

      setRipples((prev) => [...prev.slice(-3), newRipple]);
    }

    onClick?.(e);
  };

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading ? "true" : undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      onClick={handleClick}
      {...props}
    >
      {/* Camada de Ripples */}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute rounded-full bg-foreground/15 animate-ripple"
          style={{
            left: r.x,
            top: r.y,
            width: r.size,
            height: r.size,
          }}
          onAnimationEnd={() => {
            setRipples((prev) => prev.filter((item) => item.id !== r.id));
          }}
        />
      ))}

      {/* Conteúdo com Morphing Loading */}
      {loading ? (
        <>
          <Loader2 className="animate-spin" />
          <span>Carregando...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
});
