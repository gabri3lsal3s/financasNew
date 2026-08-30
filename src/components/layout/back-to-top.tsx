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
  className?: string;
}

/**
 * Botão flutuante para retornar suavemente ao topo do contêiner principal ou da página.
 * Utiliza a camada semântica z-floating-tools (abaixo dos modais e acima da BottomNav)
 * e o serviço canônico scrollToTop com suporte a acessibilidade e feedback sensorial.
 */
export function BackToTop({
  visible,
  containerId = "main-content",
  bottomNavOffset = true,
  className,
}: BackToTopProps) {
  const handleClick = () => {
    scrollToTop({ containerId, sensoryFeedback: true });
  };

  return (
    <div
      className={cn(
        "fixed z-floating-tools transition-all duration-300",
        bottomNavOffset
          ? "bottom-20 md:bottom-8 right-4 md:right-8"
          : "bottom-6 md:bottom-8 right-4 md:right-8",
        visible
          ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
          : "opacity-0 translate-y-3 scale-95 pointer-events-none",
        className,
      )}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={handleClick}
        aria-label="Voltar ao topo da página"
        className="size-10 sm:size-11 rounded-full border-border/80 bg-surface/90 shadow-md backdrop-blur-md hover:border-primary/50 hover:bg-surface-hover cursor-pointer"
      >
        <ArrowUp className="size-5 text-foreground" aria-hidden="true" />
      </Button>
    </div>
  );
}
