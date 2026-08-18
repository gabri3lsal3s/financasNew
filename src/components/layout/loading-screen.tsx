import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { cn } from "@/lib/utils";

export interface LoadingScreenProps {
  /** Log ou mensagem inicial/customizada (opcional). Se não fornecido, alterna logs dinâmicos. */
  statusText?: string;
  /** Lista customizada de etapas do log com progresso alvo (opcional). */
  customSteps?: Array<{ progress: number; text: string }>;
  /** Valor de progresso fixo (0 a 100). Se omitido, avança dinamicamente em tempo real. */
  progress?: number;
  /** Classes CSS adicionais para o container externo. */
  className?: string;
  /** Se deve ocupar a tela inteira com min-h-dvh (padrão: true). */
  fullScreen?: boolean;
}

const DEFAULT_STAGES = [
  { progress: 22, text: "Iniciando sessão segura…" },
  { progress: 54, text: "Sincronizando preferências e categorias…" },
  { progress: 82, text: "Carregando transações e dados…" },
  { progress: 96, text: "Preparando painel financeiro…" },
];

/**
 * Tela de carregamento oficial otimizada — "Guia Financeiro".
 * Apresenta somente a logo com brilho orbital sutil e barra de progresso
 * responsiva com avanço dinâmico e log em tempo real das etapas em execução.
 */
export function LoadingScreen({
  statusText,
  customSteps,
  progress: externalProgress,
  className,
  fullScreen = true,
}: LoadingScreenProps) {
  const steps = customSteps ?? DEFAULT_STAGES;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [simulatedProgress, setSimulatedProgress] = useState(steps[0]?.progress ?? 15);

  // Avanço dinâmico e realista do progresso e dos logs
  useEffect(() => {
    if (externalProgress !== undefined) return;

    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        const next = prev + 1;
        if (next < steps.length) {
          setSimulatedProgress(steps[next]!.progress);
          return next;
        }
        setSimulatedProgress((p) => Math.min(98, p + 1));
        return prev;
      });
    }, 450);

    return () => clearInterval(interval);
  }, [externalProgress, steps]);

  const activeProgress = Math.min(
    100,
    Math.max(0, externalProgress ?? simulatedProgress),
  );

  const activeLogText =
    statusText ??
    steps[currentStepIndex]?.text ??
    "Carregando informações…";

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
      <div className="flex flex-col items-center gap-8 w-full max-w-xs text-center animate-fade-slide-in">
        {/* Logo Oficial com Brilho Orbital Suave */}
        <div className="relative flex items-center justify-center">
          <div
            className="absolute -inset-4 rounded-full bg-primary/15 blur-xl animate-pulse"
            aria-hidden="true"
          />
          <BrandLogo
            markClassName="size-16 transition-transform duration-300"
            wordmarkClassName="text-xl font-bold tracking-tight"
            showSubtitle={false}
          />
        </div>

        {/* Barra de Carregamento Responsiva com Progresso Dinâmico e Log */}
        <div className="flex flex-col items-center gap-2.5 w-full">
          {/* Barra de Progresso */}
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(activeProgress)}
            className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/80 shadow-inner"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-primary transition-all duration-500 ease-out animate-shimmer bg-[length:200%_100%]"
              style={{ width: `${activeProgress}%` }}
            />
          </div>

          {/* Log Dinâmico de Ações em Execução + Porcentagem */}
          <div className="flex items-center justify-between w-full text-xs px-0.5 min-h-[1.25rem]">
            <span
              key={activeLogText}
              className="text-muted-foreground font-medium tracking-tight animate-fade-slide-in text-left truncate flex-1"
            >
              {activeLogText}
            </span>
            <span className="num font-mono text-[11px] font-semibold text-primary-strong pl-2 shrink-0">
              {Math.round(activeProgress)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
