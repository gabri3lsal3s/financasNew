import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface BackToTopProps {
  /** Se o botão deve estar visível com base na rolagem da página. */
  visible: boolean;
  /** Se o dock inferior mobile estiver ativo, eleva o botão para não colidir. */
  hasBottomDock?: boolean;
}

/**
 * Botão flutuante ergonômico no canto inferior direito para retorno ao topo.
 * Surge suavemente após rolagem profunda e oferece toque suave sem colidir com safe areas ou bottom docks.
 */
export function BackToTop({ visible, hasBottomDock = false }: BackToTopProps) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      className={cn(
        "fixed right-4 sm:right-8 sm:bottom-8 z-30 transition-all duration-300",
        hasBottomDock
          ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]"
          : "bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))]",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto scale-100"
          : "opacity-0 translate-y-3 pointer-events-none scale-95",
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={scrollToTop}
        aria-label="Voltar ao topo da página"
        className="size-11 rounded-full border-border/80 bg-surface/90 shadow-md backdrop-blur-md transition-colors hover:border-primary/50 hover:bg-surface-hover cursor-pointer"
      >
        <ArrowUp className="size-5 text-foreground" aria-hidden="true" />
      </Button>
    </div>
  );
}
