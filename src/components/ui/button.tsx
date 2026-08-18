import { forwardRef, useState } from "react";
import type { ButtonHTMLAttributes, MouseEvent } from "react";
import type { VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/services/haptics";
import { playSound } from "@/services/audio-fx";
import { getVisualCustomization } from "@/hooks/use-visual-customization";
import { buttonVariants } from "./button-variants";

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
