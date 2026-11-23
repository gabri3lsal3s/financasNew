import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StaleQuoteGuardResult } from "@/domain/portfolio";

export interface ReportQuoteStatusBannerProps {
  isRefreshing?: boolean;
  staleGuard?: StaleQuoteGuardResult | null;
  onRetry?: () => void;
}

/**
 * Banner editorial de pré-visualização para relatórios/PDFs (`print:hidden`).
 * Sinaliza sincronização pré-relatório em andamento ou pendências apontadas pelo StaleQuoteGuard.
 */
export function ReportQuoteStatusBanner({
  isRefreshing = false,
  staleGuard,
  onRetry,
}: ReportQuoteStatusBannerProps) {
  const hasIssue = Boolean(staleGuard?.hasAnyIssue);
  if (!isRefreshing && !hasIssue) return null;

  if (isRefreshing) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border/80 bg-muted/30 text-xs text-muted-foreground print:hidden">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary-strong">
          <RefreshCw className="size-4.5 animate-spin" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-semibold text-foreground">
            Validando cotações e câmbio PTAX para este relatório...
          </span>
          <span className="text-[11px] text-muted-foreground">
            Consultando fechamento oficial e atualizando ativos com mercado aberto.
          </span>
        </div>
      </div>
    );
  }

  const issueLines: string[] = [];
  if (staleGuard?.postTradeStaleTickers.length) {
    issueLines.push(
      `Ordens de hoje aguardando cotação atual: ${staleGuard.postTradeStaleTickers.join(", ")}`,
    );
  }
  if (staleGuard?.fallbackTickers.length) {
    issueLines.push(
      `Preços estimados (fallback): ${staleGuard.fallbackTickers.join(", ")}`,
    );
  }
  if (staleGuard?.staleMarketTickers.length) {
    issueLines.push(
      `Cotações defasadas: ${staleGuard.staleMarketTickers.join(", ")}`,
    );
  }
  if (staleGuard?.fxWarning) {
    issueLines.push(staleGuard.fxWarning);
  }

  return (
    <div
      role="status"
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-warning/30 bg-warning/5 text-xs text-foreground print:hidden"
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-warning/20 bg-warning/15 text-warning-strong">
          <AlertTriangle className="size-4.5" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-semibold text-warning-strong">
            Atenção às referências de mercado na prévia
          </span>
          <span className="text-[11px] text-muted-foreground leading-snug">
            {issueLines.join(" | ")}
          </span>
        </div>
      </div>

      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="shrink-0 gap-1.5 font-medium self-stretch sm:self-auto"
        >
          <RefreshCw className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span>Tentar novamente</span>
        </Button>
      ) : null}
    </div>
  );
}
