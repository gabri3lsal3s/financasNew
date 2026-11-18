import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { scrollToTop } from "@/services/scroll";

export interface BackToTopProps {
  /** Controla se o botão está visível na tela. */
  visible: boolean;
  /** ID do contêiner de rolagem alvo (padrão: "main-content"). */
  containerId?: string;
  /** Aplica offset para posicionar confortavelmente acima da BottomNav no mobile (padrão: true). */
  bottomNavOffset?: boolean;
  /** Offset alternativo para a Landing Page quando houver MobileCtaDock visível. */
  hasBottomDock?: boolean;
  className?: string;
}

/**
 * Botão flutuante único para retornar suavemente ao topo do contêiner principal ou da janela.
 * Utiliza a camada semântica z-page-floating (abaixo dos modais e abaixo da BottomNav)
 * e o serviço canônico scrollToTop com suporte a acessibilidade e feedback sensorial.
 */
export function BackToTop({
  visible,
  containerId = "main-content",
  bottomNavOffset = true,
  hasBottomDock,
  className,
}: BackToTopProps) {
  const handleClick = () => {
    scrollToTop({ containerId, sensoryFeedback: true });
  };

  const bottomClass =
    hasBottomDock !== undefined
      ? hasBottomDock
        ? "bottom-[calc(4.75rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px)))] md:bottom-8"
        : "bottom-[calc(1.25rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px)))] md:bottom-8"
      : bottomNavOffset
        ? "bottom-[calc(5.5rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px)))] md:bottom-8"
        : "bottom-6 md:bottom-8";

  return (
    <div
      className={cn(
        "fixed z-page-floating right-4 md:right-8 transition-all duration-200",
        bottomClass,
        visible
          ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
          : "opacity-0 translate-y-3 scale-95 pointer-events-none",
        className,
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleClick}
        aria-label="Voltar ao topo da página"
        className="size-11 rounded-full border-border/80 bg-surface/90 shadow-md backdrop-blur-md hover:border-primary/50 hover:bg-surface-hover cursor-pointer"
      >
        <ArrowUp className="size-5 text-foreground" aria-hidden="true" />
      </Button>
    </div>
  );
}
