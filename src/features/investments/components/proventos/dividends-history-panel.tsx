import { Coins, Plus, TrendingUp } from "lucide-react";
import { KpiCard, MonthPicker } from "@/components/modules";
import { Badge, Button, EmptyState, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import type { DividendPositionRef } from "@/domain/portfolio/dividends-analytics";
import { monthLabel } from "@/lib/date";
import type { PortfolioAsset, PortfolioDividend } from "@/types";
import { DividendsMonthExtractCard } from "./dividends-month-extract-card";

export interface DividendsHistoryPanelProps {
  month: string;
  onMonthChange: (next: string) => void;
  hasAny: boolean;
  extract: readonly PortfolioDividend[];
  monthTotal: number;
  uniqueTickersCount: number;
  topPayer: { ticker: string; amount: number } | null;
  projectedCount: number;
  projectedTotal: number;
  assetById: ReadonlyMap<string, PortfolioAsset>;
  rowByAssetId: ReadonlyMap<string, DividendPositionRef>;
  onOpenNewDividend: () => void;
  onEditDividend: (entry: PortfolioDividend) => void;
  onDeleteDividend: (entry: PortfolioDividend) => void;
  onOpenPendingDividends: () => void;
}

export function DividendsHistoryPanel({
  month,
  onMonthChange,
  hasAny,
  extract,
  monthTotal,
  uniqueTickersCount,
  topPayer,
  projectedCount,
  projectedTotal,
  assetById,
  rowByAssetId,
  onOpenNewDividend,
  onEditDividend,
  onDeleteDividend,
  onOpenPendingDividends,
}: DividendsHistoryPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center min-w-0">
        <MonthPicker value={month} onValueChange={onMonthChange} aria-label="Mês dos proventos" />
      </div>

      {!hasAny ? (
        <EmptyState
          icon={<TrendingUp className="size-6" aria-hidden="true" />}
          title="Sem proventos ainda"
          description="Registre os rendimentos e dividendos recebidos das suas cotas para acompanhar o extrato e calendário anual."
          tone="default"
          headingLevel="h2"
          action={
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onOpenNewDividend}
              className="gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Registrar primeiro provento</span>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KpiCard
              label={`Recebido em ${monthLabel(month)}`}
              cents={numberToCents(monthTotal)}
              tone="positive"
              hint={
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span>Créditos de rendimentos no mês</span>
                  <Badge variant={extract.length > 0 ? "positive" : "muted"} size="xs">
                    {extract.length} {extract.length === 1 ? "provento" : "proventos"}
                  </Badge>
                </div>
              }
            />

            <KpiCard
              label="Ativos Pagadores"
              value={String(uniqueTickersCount)}
              hint={
                uniqueTickersCount === 1
                  ? "Ativo pagou neste mês"
                  : "Ativos pagaram neste mês"
              }
            />

            <KpiCard
              label="Maior Pagador"
              value={topPayer ? topPayer.ticker : "—"}
              hint={
                topPayer ? (
                  <span className="inline-flex items-center gap-1">
                    <MoneyText
                      cents={numberToCents(topPayer.amount)}
                      tone="positive"
                      variant="caption"
                    />
                    <span>recebidos</span>
                  </span>
                ) : (
                  "Sem proventos neste mês"
                )
              }
            />
          </div>

          {projectedCount > 0 ? (
            <div className="rounded-2xl border border-portfolio/20 bg-portfolio/5 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-portfolio/10 border-portfolio/20 text-portfolio"
                  aria-hidden="true"
                >
                  <Coins className="size-4.5" />
                </span>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground truncate">
                      Proventos Provisionados da B3
                    </span>
                    <Badge size="xs" variant="portfolio" className="font-medium">
                      PROVISIONADO
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {projectedCount}{" "}
                    {projectedCount === 1
                      ? "provento com Data COM cumprida previsto totalizando"
                      : "proventos com Data COM cumprida previstos totalizando"}{" "}
                    <MoneyText
                      cents={numberToCents(projectedTotal)}
                      tone="positive"
                      className="font-semibold inline"
                    />{" "}
                    (sem somar no caixa).
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onOpenPendingDividends}
                className="shrink-0 text-xs self-stretch sm:self-center font-medium"
              >
                Conferir Proventos
              </Button>
            </div>
          ) : null}

          <DividendsMonthExtractCard
            month={month}
            extract={extract}
            assetById={assetById}
            rowByAssetId={rowByAssetId}
            onEditDividend={onEditDividend}
            onDeleteDividend={onDeleteDividend}
          />
        </>
      )}
    </div>
  );
}
