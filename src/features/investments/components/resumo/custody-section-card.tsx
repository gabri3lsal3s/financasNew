import { AlertTriangle, FileText, RefreshCw, TrendingUp } from "lucide-react";
import { PositionTable, type PositionRow } from "@/components/modules";
import { Button } from "@/components/ui";
import type { MarketReferenceSummary, PriceSource, StaleQuoteGuardResult } from "@/domain/portfolio";
import type { AssetCurrency } from "@/types";

export interface CustodySectionCardProps {
  rows: PositionRow[];
  highlightId: string | null;
  isSyncingQuotes?: boolean;
  degradedTickers?: readonly string[];
  onRetryDegraded?: () => void;
  marketSummary?: MarketReferenceSummary | null;
  staleGuard?: StaleQuoteGuardResult | null;
  onOpenExecutiveReport: () => void;
  onOpenDetail: (assetId: string) => void;
  onOpenEdit: (assetId: string) => void;
  onCalibrateAsset: (assetId: string, ticker: string, currentValueCents: number) => void;
  onSetManualPrice: (
    assetId: string,
    ticker: string,
    currency: AssetCurrency,
    priceBRL: number,
    source: PriceSource,
    priceQuote?: number,
    pricingMode?: string,
    usdRate?: number,
  ) => void;
  onEvaluateScore: (assetId: string) => void;
}

/**
 * Painel Passivo de Posição Consolidada:
 *   - Sem botão manual fixo de "Atualizar cotações" (atualização automática via SWR/EOD Guard);
 *   - Exibe referência editorial de cotações B3 / EUA / Câmbio USD-BRL e revalidação silenciosa;
 *   - Oferece botão contextual discreto "Tentar novamente" apenas quando há ativo degradado/em erro.
 */
export function CustodySectionCard({
  rows,
  highlightId,
  isSyncingQuotes = false,
  degradedTickers = [],
  onRetryDegraded,
  marketSummary,
  staleGuard,
  onOpenExecutiveReport,
  onOpenDetail,
  onOpenEdit,
  onCalibrateAsset,
  onSetManualPrice,
  onEvaluateScore,
}: CustodySectionCardProps) {
  const refParts: string[] = [];
  if (marketSummary?.hasB3Custody) {
    refParts.push(
      marketSummary.b3RefLabel ? `B3: ${marketSummary.b3RefLabel}` : "B3: ref. pendente",
    );
  }
  if (marketSummary?.hasForeignCustody) {
    refParts.push(
      marketSummary.usdRefLabel ? `Exterior USD: ${marketSummary.usdRefLabel}` : "Exterior USD: ref. pendente",
    );
    refParts.push(
      `USD/BRL: R$ ${marketSummary.fxRate.toFixed(4).replace(".", ",")} (${marketSummary.fxSourceLabel}${marketSummary.fxRefLabel ? `, ${marketSummary.fxRefLabel}` : ""})`,
    );
  }

  const hasRetryableIssue = degradedTickers.length > 0 && Boolean(onRetryDegraded);

  return (
    <section
      aria-label="Posições da Carteira"
      className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden"
    >
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Posição Consolidada</h2>
          {isSyncingQuotes ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-normal">
              <RefreshCw className="size-3 animate-spin shrink-0" aria-hidden="true" />
              <span>Sincronizando...</span>
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {hasRetryableIssue ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetryDegraded}
              disabled={isSyncingQuotes}
              className="h-8 px-2.5 text-xs gap-1.5 shrink-0 text-warning-strong border-warning/30 hover:bg-warning/10"
              title={`Revalidar ${degradedTickers.length} cotação(ões) indisponível(is)`}
            >
              <RefreshCw
                aria-hidden="true"
                className={`size-3.5 ${isSyncingQuotes ? "animate-spin" : ""}`}
              />
              <span>Tentar novamente</span>
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenExecutiveReport}
            className="size-9 p-0 sm:w-auto sm:h-8 sm:px-3 text-xs gap-1.5 shrink-0"
            title="Visualizar e Imprimir Relatório Executivo da Carteira"
            aria-label="Relatório Executivo"
          >
            <FileText aria-hidden="true" className="size-3.5" />
            <span className="hidden md:inline">Relatório</span>
          </Button>
        </div>
      </div>

      {refParts.length > 0 || staleGuard?.hasAnyIssue ? (
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 rounded-xl border border-border/60 bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="font-mono leading-relaxed break-words">
            {refParts.length > 0 ? refParts.join(" | ") : "Cotações automáticas de mercado"}
          </span>
          {staleGuard?.hasAnyIssue ? (
            <span className="inline-flex items-center gap-1.5 text-warning-strong font-medium shrink-0">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {staleGuard.hasPostTradeStale
                  ? `Operação de hoje pendente de cotação atual (${staleGuard.postTradeStaleTickers.join(", ")})`
                  : staleGuard.hasFallback
                    ? `${staleGuard.fallbackTickers.length} ativo(s) em estimativa (fallback)`
                    : staleGuard.fxWarning ?? "Algumas cotações aguardam fechamento"}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}

      <PositionTable
        rows={rows}
        sortable
        highlightId={highlightId}
        onListTransactions={onOpenDetail}
        onEditAsset={onOpenEdit}
        onCalibrateAsset={onCalibrateAsset}
        onSetManualPrice={onSetManualPrice}
        onEvaluateScore={onEvaluateScore}
      />
    </section>
  );
}
