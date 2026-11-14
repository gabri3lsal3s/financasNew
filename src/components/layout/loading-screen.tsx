import { BrandLogo } from "@/components/layout/brand-logo";
import { cn } from "@/lib/utils";

export interface LoadingScreenProps {
  /** Mensagem opcional de acessibilidade ou subtítulo discreto. */
  statusText?: string;
  /** Mantido para compatibilidade retroativa com chamadas existentes. */
  customSteps?: Array<{ progress?: number; text?: string }>;
  /** Mantido para compatibilidade retroativa. */
  progress?: number;
  /**
   * Quando `true`, aciona o fade-out rápido de fechamento.
   */
  isClosing?: boolean;
  /** Classes CSS adicionais para o container externo. */
  className?: string;
  /** Se deve ocupar a tela inteira com min-h-dvh (padrão: true). */
  fullScreen?: boolean;
}

/**
 * Tela de carregamento oficial minimalista e fluida — "Axir".
 * Apresenta o símbolo oficial centralizado com pulso sutil e brilho orbital suave,
 * eliminando barras de progresso simuladas e logs textuais dinâmicos.
 */
export function LoadingScreen({
  statusText,
  isClosing = false,
  className,
  fullScreen = true,
}: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center p-6 select-none transition-opacity duration-300 ease-out",
        isClosing && "opacity-0 pointer-events-none",
        fullScreen ? "min-h-dvh w-full bg-background" : "w-full py-16",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4 w-full max-w-xs text-center animate-fade-slide-in">
        {/* Logo Oficial com Brilho Orbital Suave */}
        <div className="relative flex items-center justify-center">
          <div
            className="absolute -inset-4 rounded-full bg-primary/15 blur-xl animate-pulse"
            aria-hidden="true"
          />
          <BrandLogo
            showWordmark
            markClassName="size-16 transition-transform duration-300"
            wordmarkClassName="text-xl font-bold tracking-tight"
            showSubtitle={false}
          />
        </div>

        {/* Indicador de pulso discreto e acessibilidade */}
        <div className="flex flex-col items-center gap-1.5 pt-2">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
            <span className="size-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
            <span className="size-1.5 rounded-full bg-primary/60 animate-bounce" />
          </div>
          {statusText ? (
            <p className="text-xs text-muted-foreground font-medium tracking-tight animate-fade-slide-in">
              {statusText}
            </p>
          ) : (
            <span className="sr-only">Carregando…</span>
          )}
        </div>
      </div>
    </div>
  );
}
