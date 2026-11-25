import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode, TouchEvent } from "react";
import { HelpCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CalculationMemoryTriggerProps {
  /** Rótulo da métrica para acessibilidade (ex: "Saldo Disponível em Conta"). */
  metricTitle: string;
  /** Tipo de ícone visual (default: "help"). */
  iconVariant?: "help" | "info";
  /** Callback acionado ao tocar/clicar no gatilho. */
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  /** Classes extras de estilo. */
  className?: string;
  /** Elemento customizado para atuar como gatilho. */
  children?: ReactNode;
  /**
   * Nível de relevância mobile para conforto e curadoria visual:
   * - "p0": métricas complexas/sintéticas (visíveis suavemente no mobile).
   * - "p1": métricas complementares (ocultas no mobile, visíveis no hover no desktop).
   * Default: "p1".
   */
  priority?: "p0" | "p1";
}

/**
 * Gatilho (?) Padronizado de Memória de Cálculo.
 *
 * Cumpre a Regra 33 do AGENTS.md e as diretrizes de ergonomia móvel:
 * - Área de toque mínima de 44x44px no mobile via pseudo-elemento invisível (after:-inset-2.5);
 * - Ícone sóbrio (size-3.5 a size-4) com contraste suave no repouso;
 * - Isolamento estrito de todos os eventos (pointer, touch, mouse, keyboard)
 *   para blindar contra duplo disparo em contêineres interativos (KpiCard, links, botões);
 * - Acessibilidade completa com aria-label descritivo e foco visível.
 */
export function CalculationMemoryTrigger({
  metricTitle,
  iconVariant = "help",
  onClick,
  className,
  children,
  priority = "p1",
}: CalculationMemoryTriggerProps) {
  const handleClick = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.(e);
  };

  const handlePointerDown = (e: PointerEvent<HTMLElement>) => {
    e.stopPropagation();
  };

  const handlePointerUp = (e: PointerEvent<HTMLElement>) => {
    e.stopPropagation();
  };

  const handleMouseDown = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  };

  const handleMouseUp = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  };

  const handleTouchStart = (e: TouchEvent<HTMLElement>) => {
    e.stopPropagation();
  };

  const handleTouchEnd = (e: TouchEvent<HTMLElement>) => {
    e.stopPropagation();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onClick?.(e as unknown as MouseEvent<HTMLElement>);
    }
  };

  const visibilityClass =
    priority === "p0"
      ? "inline-flex text-muted-foreground/60 hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 focus-visible:opacity-100 hover:opacity-100 transition-opacity duration-150"
      : "hidden md:inline-flex text-muted-foreground/60 hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 focus-visible:opacity-100 hover:opacity-100 transition-opacity duration-150";

  if (children) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onKeyDown={handleKeyDown}
        className={cn(visibilityClass, "cursor-pointer items-center", className)}
      >
        {children}
      </span>
    );
  }

  const Icon = iconVariant === "info" ? Info : HelpCircle;

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      sensoryIntent={false}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      aria-label={`Ver memória de cálculo de ${metricTitle}`}
      title={`Como ${metricTitle} é calculado`}
      className={cn(
        "relative size-6 shrink-0 rounded-full p-0 transition-all cursor-pointer",
        "max-sm:after:absolute max-sm:after:-inset-2.5 max-sm:after:content-['']",
        visibilityClass,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">Ver memória de cálculo de {metricTitle}</span>
    </Button>
  );
}
