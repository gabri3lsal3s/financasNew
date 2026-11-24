import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PageGuideButtonProps {
  /** Callback acionado ao clicar no botão de guia */
  onClick: () => void;
  /** Rótulo acessível (padrão: "Guia") */
  label?: string;
  /** Tooltip explicativo */
  title?: string;
  /** Classes extras */
  className?: string;
}

/**
 * Botão utilitário compacto (ícone-only) para abertura de guias metodológicos no PageHeader.
 * Mantém o slot de ações principais limpo e padronizado entre todas as páginas.
 */
export function PageGuideButton({
  onClick,
  label = "Guia",
  title = "Abrir guia da página",
  className,
}: PageGuideButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      sensoryIntent="selection"
      onClick={onClick}
      aria-label={label}
      title={title}
      className={cn("size-8 !w-8 !min-w-8 p-0 shrink-0", className)}
    >
      <BookOpen aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
