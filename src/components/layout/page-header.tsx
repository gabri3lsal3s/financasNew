import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  /** Título principal da página */
  title: ReactNode;
  /** Subtítulo ou descrição contextual */
  description?: ReactNode;
  /** Badge ou chip de status colocalizado ao lado do título */
  badge?: ReactNode;
  /** Rota ou função para o botão de voltar */
  backTo?: string | (() => void);
  /** Rótulo acessível para o botão de voltar */
  backLabel?: string;
  /** Botões ou ferramentas de ação à direita/topo */
  actions?: ReactNode;
  /** Classes extras para o contêiner raiz do cabeçalho */
  className?: string;
}

/**
 * PageHeader — Componente canônico unificado para cabeçalhos de tela (Regra 21 do AGENTS.md).
 * Garante padronização visual, layout responsivo mobile-first, eliminação de cortes de botões
 * e prevenção de quebras assimétricas entre diferentes resoluções.
 */
export function PageHeader({
  title,
  description,
  badge,
  backTo,
  backLabel = "Voltar",
  actions,
  className,
}: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof backTo === "function") {
      backTo();
    } else if (typeof backTo === "string") {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <header
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-1",
        className,
      )}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {backTo !== undefined && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleBack}
            aria-label={backLabel}
            className="size-8 sm:size-8.5 shrink-0 text-muted-foreground hover:text-foreground mt-0.5 cursor-pointer"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
        )}

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
              {title}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>

          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center justify-start sm:justify-end gap-2 flex-wrap sm:flex-nowrap shrink-0 w-full sm:w-auto">
          {actions}
        </div>
      )}
    </header>
  );
}
