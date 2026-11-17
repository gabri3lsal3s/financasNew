import { LogoIcon } from "@/components/layout/logo-icon";
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
 * Tela de carregamento oficial minimalista, serena e fluida — Axir.
 * Apresenta o símbolo oficial centralizado (sem wordmark e sem halos luminosos),
 * acompanhado de 3 micro-pontos flutuantes com dinâmica sutil e status textual reativo.
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
      <div className="relative flex flex-col items-center justify-center">
        {/* Símbolo Oficial Centralizado — Zero brilho, zero wordmark, decodificação síncrona prioritária */}
        <div className="flex items-center justify-center size-16">
          <LogoIcon
            size={64}
            priority
            className="transition-transform duration-300 ease-out"
          />
        </div>

        {/* Três micro-pontos flutuantes e status textual ancorados estavelmente abaixo do centro */}
        <div className="absolute top-full mt-4 flex flex-col items-center gap-2 w-64 text-center pointer-events-none">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-1 rounded-full bg-primary/75 animate-dot-float [animation-delay:-0.32s]" />
            <span className="size-1 rounded-full bg-primary/75 animate-dot-float [animation-delay:-0.16s]" />
            <span className="size-1 rounded-full bg-primary/75 animate-dot-float" />
          </div>

          {/* Status textual discreto e dinâmico */}
          {statusText ? (
            <p className="text-xs text-muted-foreground font-medium tracking-tight animate-fade-in truncate max-w-full">
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
