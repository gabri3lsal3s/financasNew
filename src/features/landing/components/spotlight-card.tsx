import { useRef, useState, type MouseEvent, type ReactNode, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
}

/**
 * Card com efeito interativo de iluminação por cursor (Spotlight / Glow).
 * O feixe de luz segue as coordenadas do mouse no desktop para criar acabamento refinado de profundidade.
 */
export function SpotlightCard({
  children,
  className,
  spotlightColor = "rgba(var(--primary), 0.12)",
  ...props
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setCoords({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative rounded-xl border border-border/80 bg-surface shadow-xs transition-all duration-200 overflow-hidden",
        "hover:border-primary/40 hover:shadow-md",
        className,
      )}
      {...props}
    >
      {/* Efeito Glow / Iluminação Radial */}
      <div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 -z-0"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(450px circle at ${coords.x}px ${coords.y}px, ${spotlightColor}, transparent 70%)`,
        }}
        aria-hidden="true"
      />

      {/* Conteúdo do Card */}
      <div className="relative z-10 h-full flex flex-col justify-between">
        {children}
      </div>
    </div>
  );
}
