import { useMemo, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CalculationBreakdown } from "@/domain/calculation-memory";
import { useVisualCustomization } from "@/hooks/use-visual-customization";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import { CalculationMemoryTrigger } from "./calculation-memory-trigger";
import { CalculationMemoryView } from "./calculation-memory-view";

export interface CalculationMemoryModalProps {
  /** Dados estruturados da memória de cálculo (SSOT do domínio). */
  breakdown?: CalculationBreakdown;
  /** Gerador sob demanda de memória de cálculo (Lazy evaluation). */
  getBreakdown?: () => CalculationBreakdown;
  /** Rótulo acessível opcional do botão (?) */
  label?: string;
  /** Modo de apresentação no desktop: "auto" (decide por densidade), "popover" ou "modal". */
  displayMode?: "auto" | "popover" | "modal";
  /** Alinhamento do popover no desktop (default "end"). */
  align?: "start" | "center" | "end";
  /** Gatilho customizado opcional. Se omitido, renderiza o botão (?) padrão. */
  trigger?: ReactNode;
  /** Estado controlado aberto/fechado (opcional). */
  open?: boolean;
  /** Callback acionado na mudança de abertura (opcional). */
  onOpenChange?: (open: boolean) => void;
  className?: string;
  /**
   * Nível de relevância mobile para conforto e curadoria visual:
   * - "p0": métricas complexas/sintéticas (visíveis suavemente no mobile).
   * - "p1": métricas complementares (ocultas no mobile, visíveis no hover no desktop).
   * Default: "p1".
   */
  priority?: "p0" | "p1";
}

/**
 * Container Adaptativo de Memória de Cálculo e Explicabilidade Ativa.
 *
 * Cumpre a Regra 18 e 33 do AGENTS.md:
 * - Mobile (< md): Bottom Sheet nativa deslizante com alça de arraste (pill handle) e safe-area;
 * - Desktop (md+): Popover ancorado para memórias leves ou Modal centralizado para memórias densas;
 * - Zero dependências extras de bundle (reutiliza os primitivos Radix do projeto).
 */
export function CalculationMemoryModal({
  breakdown,
  getBreakdown,
  label,
  displayMode = "auto",
  align = "end",
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  className,
  priority = "p1",
}: CalculationMemoryModalProps) {
  const { showCalculationMemory } = useVisualCustomization();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) triggerSensory("selection");
    if (isControlled) {
      setControlledOpen?.(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }
  };

  const activeBreakdown = useMemo(() => {
    if (breakdown) return breakdown;
    if (getBreakdown) {
      try {
        return getBreakdown();
      } catch {
        return undefined;
      }
    }
    return undefined;
  }, [breakdown, getBreakdown]);

  // Se a memória for muito densa (> 5 passos ou com muitas notas), prioriza Modal no desktop
  const isDenseBreakdown = useMemo(() => {
    if (!activeBreakdown) return false;
    return (
      activeBreakdown.steps.length > 5 ||
      Boolean(activeBreakdown.inclusions?.length && activeBreakdown.exclusions?.length)
    );
  }, [activeBreakdown]);

  // Se o usuário optou por ocultar a memória de cálculo nas preferências, não renderiza nada
  if (!showCalculationMemory) return null;
  if (!activeBreakdown) return null;

  // Por padrão canônico (Regra 18 e 33 do AGENTS.md), memórias de cálculo utilizam
  // Modal padronizado (Bottom Sheet no mobile e Diálogo centralizado no desktop).
  // O modo popover é reservado exclusivamente para quando explicitamente requisitado.
  const resolvedDisplayMode = displayMode === "auto" ? "modal" : displayMode;

  const triggerNode = trigger ?? (
    <CalculationMemoryTrigger
      metricTitle={label ?? activeBreakdown.title}
      priority={priority}
      onClick={() => handleOpenChange(true)}
    />
  );

  // Se displayMode for explicitamente "popover"
  if (resolvedDisplayMode === "popover") {
    return (
      <div
        className={cn("items-center", priority === "p0" ? "inline-flex" : "hidden md:inline-flex")}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <span
              className="inline-flex cursor-pointer"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {triggerNode}
            </span>
          </PopoverTrigger>
          <PopoverContent
            align={align}
            sideOffset={6}
            collisionPadding={{ top: 12, left: 12, right: 12, bottom: 80 }}
            className={cn(
              "w-84 lg:w-92 max-w-[calc(100vw-2rem)] p-4 text-xs shadow-xl border-border/80 bg-surface/98 backdrop-blur-md rounded-2xl",
              className,
            )}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onPointerDownOutside={(e) => {
              // Previne disparo de cliques acidentais em cards/botões de fundo ao fechar
              e.preventDefault();
              handleOpenChange(false);
            }}
            data-testid="calculation-memory-popover"
          >
            <CalculationMemoryView
              breakdown={activeBreakdown}
              onNavigateAction={() => handleOpenChange(false)}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Padrão adaptativo unificado (Regra 18 do AGENTS.md):
  // - Mobile (< md): Bottom Sheet nativa deslizante com alça de arraste (pill handle) e safe-area
  // - Desktop (md+): Diálogo centralizado com largura proporcional (sm ou md)
  // - Zero duplicação de triggers no DOM
  return (
    <div
      className={cn("items-center", priority === "p0" ? "inline-flex" : "hidden md:inline-flex")}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {triggerNode}
      <Modal
        open={isOpen}
        onOpenChange={handleOpenChange}
        title={activeBreakdown.title}
        description={activeBreakdown.description}
        size={isDenseBreakdown ? "md" : "sm"}
        className={className}
      >
        <div className="py-2">
          <CalculationMemoryView
            breakdown={activeBreakdown}
            onNavigateAction={() => handleOpenChange(false)}
          />
        </div>
      </Modal>
    </div>
  );
}
