import React from "react";
import { AlertTriangle, RefreshCw, RotateCcw, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupportChatDialog } from "@/components/modules/support";
import { reportError } from "@/services/observability";

export interface AppErrorBoundaryProps {
  children: React.ReactNode;
  /** Fallback customizado opcional */
  fallback?: React.ReactNode;
  /** Callback acionado quando um erro é capturado */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  supportChatOpen: boolean;
}

/**
 * ErrorBoundary global do aplicativo (React 18+).
 * Captura exceções não tratadas na árvore de componentes, impedindo
 * desmontagem de tela branca, registrando o incidente no Sentry
 * e permitindo recuperação imediata ou contato com o suporte técnico.
 */
export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      supportChatOpen: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Encaminha ao Sentry com stack trace higienizado de PII
    void reportError(error, {
      componentStack: errorInfo.componentStack,
    });

    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      supportChatOpen: false,
    });
  };

  handleReload = (): void => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleOpenSupport = (): void => {
    this.setState({ supportChatOpen: true });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || "Exceção não identificada";

      return (
        <div className="min-h-dvh w-full flex items-center justify-center p-4 bg-background selection:bg-primary/20">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-surface p-6 sm:p-8 shadow-lg text-center space-y-6">
            {/* Ícone de Atenção Semântico */}
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-danger-surface text-danger">
              <AlertTriangle className="size-6" aria-hidden="true" />
            </div>

            {/* Mensagem Amigável sem Vazamento de Detalhes Internos */}
            <div className="space-y-2">
              <h2 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Algo inesperado aconteceu
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Ocorreu um comportamento não previsto na aplicação. Seus dados estão seguros e não foram afetados.
              </p>
            </div>

            {/* Ações de Recuperação */}
            <div className="flex flex-col gap-2.5 pt-2">
              <Button
                type="button"
                variant="default"
                onClick={this.handleReset}
                className="w-full gap-2 font-medium"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                <span>Tentar novamente</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={this.handleReload}
                className="w-full gap-2 font-medium"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                <span>Recarregar Aplicativo</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={this.handleOpenSupport}
                className="w-full gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <MessageSquare className="size-3.5" aria-hidden="true" />
                <span>Reportar ao Suporte</span>
              </Button>
            </div>
          </div>

          {/* Diálogo de Suporte com Categoria Bug Pré-Selecionada */}
          <SupportChatDialog
            open={this.state.supportChatOpen}
            onOpenChange={(open) => this.setState({ supportChatOpen: open })}
            defaultType="bug"
            initialMessage={`[Falha de renderização capturada pelo ErrorBoundary]\nDetalhe: ${errorMessage}`}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
