import { type ElementType, type ReactNode, type HTMLAttributes } from "react";
import { useInView, useScrollRevealContext } from "@/features/landing/hooks";
import { cn } from "@/lib/utils";

export interface ScrollRevealProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** Atraso na animação em milissegundos para efeito escalonado (padrão: 0). */
  delay?: number;
  /** Direção do deslocamento de entrada (padrão: "up"). */
  direction?: "up" | "none";
  /** Limiar de visibilidade para disparar a animação (padrão: 0.12). */
  threshold?: number;
  /** Elemento HTML a ser renderizado (padrão: "div"). */
  as?: ElementType;
  /** Chave opcional de reset manual. Se não fornecida, usa o contexto da página. */
  resetKey?: number;
  className?: string;
}

/**
 * Componente que envolve blocos da landing page com uma revelação suave ao rolar a página.
 * Suporta escalonamento via prop `delay`, respeita movimento reduzido e reanima quando
 * o usuário retorna ao topo da página.
 */
export function ScrollReveal({
  children,
  delay = 0,
  direction = "up",
  threshold = 0.12,
  as: Component = "div",
  resetKey: manualResetKey,
  className,
  style,
  ...props
}: ScrollRevealProps) {
  const { resetKey: contextResetKey } = useScrollRevealContext();
  const resetKey = manualResetKey ?? contextResetKey;

  const [ref, isInView] = useInView<HTMLElement>({
    threshold,
    triggerOnce: true,
    resetKey,
  });

  const getTransitionStyle = () => {
    if (delay <= 0) return style;
    return {
      ...style,
      transitionDelay: `${delay}ms`,
    };
  };

  return (
    <Component
      ref={ref}
      style={getTransitionStyle()}
      className={cn(
        "transition-all duration-700 ease-out",
        isInView
          ? "opacity-100 translate-y-0"
          : direction === "up"
            ? "opacity-0 translate-y-3 sm:translate-y-4"
            : "opacity-0",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
