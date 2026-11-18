import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { INSTITUTIONAL_CONFIG } from "@/lib/institutional";
import { cn } from "@/lib/utils";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { LegalHeader } from "./legal-header";
import { LegalFooter } from "./legal-footer";

export interface LegalPageShellProps {
  /** Identificador da aba/documento legal ativo ('terms' | 'privacy'). */
  activeTab: "terms" | "privacy";
  /** Título principal do documento legal. */
  title: string;
  /** Subtítulo ou descrição contextual do documento. */
  description?: string;
  /** Data da última revisão/atualização (ex: "23 de Outubro de 2026"). */
  lastUpdated?: string;
  /** Versão documental opcional (ex: "v2.0" ou "2026.1"). */
  version?: string;
  /** Classes adicionais para customização do contêiner do documento. */
  className?: string;
  /** Conteúdo legal completo (seções, cláusulas, avisos). */
  children: ReactNode;
}

export function LegalPageShell({
  activeTab,
  title,
  description,
  lastUpdated,
  version,
  className,
  children,
}: LegalPageShellProps) {
  useDocumentMeta({
    title: `${title} — Axir`,
    description,
    canonicalPath: activeTab === "privacy" ? "/privacidade" : "/termos",
  });

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground selection:bg-primary/20">
      <a
        href="#conteudo-legal"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-toast bg-primary-strong text-primary-foreground dark:bg-primary px-4 py-2.5 rounded-lg font-medium text-xs sm:text-sm shadow-lg ring-2 ring-primary ring-offset-2 ring-offset-background transition-all outline-none"
      >
        Pular para o conteúdo principal
      </a>

      <LegalHeader activeTab={activeTab} />

      <main
        id="conteudo-legal"
        tabIndex={-1}
        className={cn(
          "focus-visible:outline-none flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12",
          className,
        )}
      >
        <div className="flex flex-col gap-3 pb-6 sm:pb-8 border-b border-border/80">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default" size="sm">
              {INSTITUTIONAL_CONFIG.appName}
            </Badge>
            <Badge variant="muted" size="sm">
              Jurisdição: República Federativa do Brasil
            </Badge>
            {version ? (
              <Badge variant="muted" size="sm">
                Versão {version}
              </Badge>
            ) : null}
          </div>

          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
            {title}
          </h1>

          {description ? (
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
              {description}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-muted-foreground">
            {lastUpdated ? (
              <div>
                <span className="font-semibold text-foreground">Última atualização:</span>{" "}
                {lastUpdated}
              </div>
            ) : null}
            <div>
              <span className="font-semibold text-foreground">Foro Legal:</span>{" "}
              {INSTITUTIONAL_CONFIG.legalJurisdiction}
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-8 text-foreground leading-relaxed">{children}</div>
      </main>

      <LegalFooter activeTab={activeTab} />
    </div>
  );
}
