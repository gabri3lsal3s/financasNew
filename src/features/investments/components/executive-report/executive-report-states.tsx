import { AlertCircle, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Button, MoneyText, Skeleton } from "@/components/ui";
import { numberToCents } from "@/domain/money";

export function ExecutiveReportLoadingSkeleton() {
  return (
    <div
      data-testid="report-loading-skeleton"
      className="flex flex-col gap-4 w-full p-4 sm:p-6 rounded-2xl border border-border/80 bg-surface shadow-xs my-2"
    >
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function ExecutiveReportErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-border/80 bg-surface shadow-xs gap-4 my-2">
      <div className="flex items-center justify-center size-12 rounded-2xl border border-critical/20 bg-critical/10 text-critical-strong">
        <AlertCircle className="size-6" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1.5 max-w-lg">
        <h3 className="font-display text-base font-bold text-foreground">
          Falha ao Carregar Competência Histórica
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Não foi possível recuperar os dados desta competência. Verifique sua conexão e tente novamente.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="size-3.5 text-muted-foreground" aria-hidden="true" />
        <span>Tentar novamente</span>
      </Button>
    </div>
  );
}

export function ExecutiveReportInsufficientState({
  reason,
  snapshotTotalValue,
  onOpenClosing,
}: {
  reason?: string;
  snapshotTotalValue?: number | null;
  onOpenClosing: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-border/80 bg-surface shadow-xs gap-4 my-2">
      <div className="flex items-center justify-center size-12 rounded-2xl border border-border/80 bg-surface-raised text-muted-foreground">
        <AlertCircle className="size-6" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1.5 max-w-lg">
        <h3 className="font-display text-base font-bold text-foreground">
          Relatório Analítico Não Disponível para esta Competência
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {reason ??
            "Esta competência possui apenas registro consolidado de saldo patrimonial (TWA). Não há arquivo auditado de ativos e cotações para este mês."}
        </p>
      </div>

      {snapshotTotalValue ? (
        <div className="flex flex-wrap items-center justify-center gap-3 p-3 rounded-xl bg-surface-raised text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Saldo Registrado (TWA):</span>
            <MoneyText
              cents={numberToCents(snapshotTotalValue)}
              tone="portfolio"
              className="font-bold"
            />
          </div>
          <span className="text-border hidden sm:inline" aria-hidden="true">·</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Custódia Analítica:</span>
            <span className="font-semibold text-warning-strong">Pendente de calibração</span>
          </div>
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground max-w-md">
        Para manter a fidedignidade institucional (padrão CVM/Anbima), relatórios analíticos oficiais de custódia não são gerados com dados incompletos. Você pode calibrar as cotações e oficializar este fechamento.
      </p>

      <Button type="button" variant="default" size="sm" onClick={onOpenClosing} className="gap-2 mt-1 font-semibold">
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        <span>Conferir &amp; Calibrar Fechamento</span>
      </Button>
    </div>
  );
}
