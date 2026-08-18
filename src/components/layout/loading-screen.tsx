import { BrandLogo } from "@/components/layout/brand-logo";
import { cn } from "@/lib/utils";

export interface LoadingScreenProps {
  /** Mensagem explicativa abaixo da marca (padrão: "Carregando suas finanças…"). */
  message?: string;
  /** Subtítulo auxiliar ou status secundário. */
  hint?: string;
  /** Classes CSS adicionais para o container externo. */
  className?: string;
  /** Se deve ocupar a tela inteira com min-h-dvh (padrão: true). */
  fullScreen?: boolean;
}

/**
 * Tela de carregamento oficial — "Guia Financeiro" (Obsidian Glass / Teal Petróleo).
 * Apresenta a marca oficial, pulso orbital sutil e barra de progresso indeterminada,
 * mantendo a harmonia visual durante transições de autenticação e trocas de conta.
 */
export function LoadingScreen({
  message = "Carregando suas finanças…",
  hint,
  className,
  fullScreen = true,
}: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center p-6 select-none",
        fullScreen ? "min-h-dvh w-full bg-background" : "w-full py-16",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-6 max-w-xs text-center animate-fade-slide-in">
        {/* Marca Oficial com Símbolo em Destaque */}
        <div className="relative flex items-center justify-center">
          <div
            className="absolute -inset-3 rounded-full bg-primary/10 blur-md animate-pulse"
            aria-hidden="true"
          />
          <BrandLogo
            markClassName="size-14 transition-transform duration-300"
            wordmarkClassName="text-xl"
            showSubtitle
          />
        </div>

        {/* Indicador de Carregamento — Linha Indeterminada com Tokens de Design */}
        <div
          className="relative h-1 w-48 overflow-hidden rounded-full bg-muted"
          aria-hidden="true"
        >
          <div className="absolute inset-y-0 w-1/2 rounded-full bg-primary animate-shimmer bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--color-primary)_0%,var(--color-secondary)_50%,var(--color-primary)_100%)]" />
        </div>

        {/* Mensagem e Status Acessível */}
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium text-foreground tracking-tight">
            {message}
          </p>
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
