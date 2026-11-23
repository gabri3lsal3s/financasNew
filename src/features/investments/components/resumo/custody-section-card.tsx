import { useMemo } from "react";
import { FileText, RefreshCw, TrendingUp } from "lucide-react";
import { PositionTable, type PositionRow } from "@/components/modules";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import { Button } from "@/components/ui";
import { buildConsolidatedPositionQuotesBreakdown } from "@/domain/calculation-memory";
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
 *   - Concentra referências de cotações B3 / EUA / Câmbio USD-BRL e diagnóstico de ativos com
 *     cotação desatualizada dentro do card de Memória de Cálculo no cabeçalho;
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
  const activeAssetsCount = useMemo(
    () => rows.filter((r) => (Number(r.quantity) || 0) > 0 || (Number(r.valueBRL) || 0) > 0).length,
    [rows],
  );

  const quotesBreakdown = useMemo(
    () =>
      buildConsolidatedPositionQuotesBreakdown({
        activeAssetsCount,
        marketSummary,
        staleGuard,
        degradedTickers,
      }),
    [activeAssetsCount, marketSummary, staleGuard, degradedTickers],
  );

  const hasRetryableIssue = degradedTickers.length > 0 && Boolean(onRetryDegraded);

  return (
    <section
      aria-label="Posições da Carteira"
      className="group rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden"
    >
      <div className="mb-3 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground truncate">Posição Consolidada</h2>
          <CalculationMemoryModal
            breakdown={quotesBreakdown}
            label="Posição Consolidada & Status das Cotações"
            priority="p0"
          />
          {isSyncingQuotes ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-normal shrink-0">
              <RefreshCw className="size-3 animate-spin shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Sincronizando...</span>
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
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
              <span className="hidden sm:inline">Tentar novamente</span>
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenExecutiveReport}
            className="size-8 p-0 sm:w-auto sm:h-8 sm:px-3 text-xs gap-1.5 shrink-0"
            title="Visualizar e Imprimir Relatório Executivo da Carteira"
            aria-label="Relatório Executivo"
          >
            <FileText aria-hidden="true" className="size-3.5" />
            <span className="hidden sm:inline">Relatório</span>
          </Button>
        </div>
      </div>

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
