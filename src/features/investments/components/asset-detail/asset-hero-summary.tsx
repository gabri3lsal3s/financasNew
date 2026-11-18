import { ArrowDownLeft, ArrowRight, Edit2, Plus, Receipt, Scissors, SlidersHorizontal } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { formatFixedIncomeRateLabel } from "@/domain/portfolio/fixed-income";
import { formatDateBR } from "@/lib/date";
import type { AssetDetailMetrics } from "./use-asset-detail-metrics";

export interface AssetHeroSummaryProps {
  metrics: AssetDetailMetrics;
  onQuickAction: (action: "buy" | "sell" | "dividend", label: string) => void;
  onOpenSplit: () => void;
  onOpenCalibrate: () => void;
  onOpenEdit: () => void;
}

export function AssetHeroSummary({
  metrics,
  onQuickAction,
  onOpenSplit,
  onOpenCalibrate,
  onOpenEdit,
}: AssetHeroSummaryProps) {
  const {
    currentAsset,
    positionRow,
    isSharedWithFamily,
    isClosed,
    isTotalValue,
    isCash,
    quantity,
    totalDividendsNative,
  } = metrics;

  const fiMeta = currentAsset.fixed_income_metadata;
  const fiResult = positionRow?.fixedIncomeResult;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        {isSharedWithFamily ? <Badge variant="portfolio" size="xs">Patrimônio Familiar</Badge> : null}
        {isClosed ? <Badge variant="muted" size="xs">Posição Encerrada</Badge> : null}
        {currentAsset.currency !== "BRL" ? <Badge variant="muted" size="xs">{currentAsset.currency}</Badge> : null}

        {!isClosed && fiMeta && fiMeta.rate_value > 0 ? (
          <Badge variant="default" size="xs">
            {formatFixedIncomeRateLabel(fiMeta)} · Projetado
          </Badge>
        ) : null}

        {!isClosed && positionRow?.isMatured ? (
          <Badge variant="negative" size="xs">
            Vencido em {formatDateBR(positionRow.maturityDate ?? "")}
          </Badge>
        ) : !isClosed && positionRow?.maturityDate ? (
          <Badge variant="warning" size="xs">
            Vence em {formatDateBR(positionRow.maturityDate)}
          </Badge>
        ) : null}

        {!isClosed && fiResult && fiResult.businessDaysAccrued > 0 ? (
          <Badge variant="muted" size="xs">
            {fiResult.businessDaysAccrued}d úteis desde {formatDateBR(fiMeta?.base_date ?? "")}
          </Badge>
        ) : null}

        {!isClosed && fiMeta?.is_tax_exempt ? (
          <Badge variant="positive" size="xs">Isento de IR</Badge>
        ) : !isClosed && fiResult?.hasExplicitTaxInfo ? (
          fiResult.taxCountdown ? (
            <Badge variant="muted" size="xs">
              IR {positionRow?.taxRatePct}% <ArrowRight className="size-2.5 inline-block mx-0.5" aria-hidden="true" />{" "}
              {fiResult.taxCountdown.nextRatePct}% em {fiResult.taxCountdown.daysRemaining}d
            </Badge>
          ) : (
            <Badge variant="muted" size="xs">IR {positionRow?.taxRatePct ?? 22.5}%</Badge>
          )
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onQuickAction("buy", "Registrar Aporte")}
          className="gap-1 text-xs text-primary-strong flex-1 sm:flex-initial"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          <span>Aportar</span>
        </Button>

        {!isClosed ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onQuickAction("sell", "Registrar Resgate")}
            className={`gap-1 text-xs flex-1 sm:flex-initial ${
              positionRow?.isMatured ? "border-critical-strong/60 text-critical-strong" : ""
            }`}
          >
            <ArrowDownLeft className="size-3.5" aria-hidden="true" />
            <span>{positionRow?.isMatured ? "Liquidar Caixa" : isTotalValue ? "Resgatar" : "Vender"}</span>
          </Button>
        ) : null}

        {isTotalValue && !isClosed ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenCalibrate}
            className="size-8 p-0 shrink-0 text-muted-foreground"
            title="Calibrar com saldo do extrato"
            aria-label="Calibrar com saldo do extrato"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Calibrar com saldo do extrato</span>
          </Button>
        ) : null}

        {!isTotalValue || totalDividendsNative > 0 || (currentAsset.accumulated_dividends ?? 0) > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onQuickAction("dividend", "Lançar Proventos")}
            className="gap-1 text-xs text-positive-strong flex-1 sm:flex-initial"
          >
            <Receipt className="size-3.5" aria-hidden="true" />
            <span>{isTotalValue ? "Rendimento" : "Provento"}</span>
          </Button>
        ) : null}

        {!isTotalValue && !isCash && !isClosed && quantity > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenSplit}
            className="size-8 p-0 shrink-0 text-muted-foreground"
            title="Desdobramento ou grupamento de cotas"
            aria-label="Desdobramento ou grupamento de cotas"
          >
            <Scissors className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Desdobrar ou agrupar cotas</span>
          </Button>
        ) : null}

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onOpenEdit}
          className="size-8 p-0 shrink-0 text-muted-foreground"
          title="Editar Ativo"
          aria-label="Editar Ativo"
        >
          <Edit2 className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Editar Ativo</span>
        </Button>
      </div>
    </div>
  );
}
