import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { isFixedIncomeClass } from "@/domain/portfolio/valuation";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import { formatAssetQuantity } from "@/services/formatting";
import {
  buildPositionPriceTooltip,
  type PositionRow,
  type PositionTableProps,
  type SortKey,
  type SortState,
} from "@/components/modules/portfolio/position-types";
import { SortableHeader } from "@/components/modules/portfolio/position-table-header";
import { PositionActionMoneyCell, PositionTickerCell } from "./position-cells";
import { PositionRentabilityCell } from "./position-rentability-cell";

export interface PositionColumnDef {
  key: string;
  header: ReactNode;
  align?: "left" | "right";
  className?: string;
  cell: (row: PositionRow) => ReactNode;
}

export interface BuildPositionColumnsParams {
  sortable: boolean;
  sort: SortState | null;
  onToggleSort: (key: SortKey) => void;
  onOpen?: (assetId: string, ticker: string) => void;
  onCalibrateAsset?: PositionTableProps["onCalibrateAsset"];
  onSetManualPrice?: PositionTableProps["onSetManualPrice"];
  onEvaluateScore?: PositionTableProps["onEvaluateScore"];
}

export function buildPositionColumns(params: BuildPositionColumnsParams): {
  getColumnsForClass: (className: string | null) => PositionColumnDef[];
} {
  const { sortable, sort, onToggleSort, onOpen, onCalibrateAsset, onSetManualPrice, onEvaluateScore } =
    params;

  const headerFor = (key: SortKey, label: string): ReactNode =>
    sortable ? (
      <SortableHeader
        label={label}
        active={sort?.key === key}
        direction={sort?.direction ?? "asc"}
        onClick={() => onToggleSort(key)}
      />
    ) : (
      label
    );

  const tickerColumn: PositionColumnDef = {
    key: "ticker",
    header: headerFor("ticker", "Ativo"),
    className: "flex-[1.4] min-w-[160px]",
    cell: (row) => (
      <PositionTickerCell row={row} onOpen={onOpen} onEvaluateScore={onEvaluateScore} />
    ),
  };

  const triggerManualPrice = (row: PositionRow) =>
    onSetManualPrice?.(
      row.assetId,
      row.ticker,
      row.currency,
      row.priceBRL,
      row.source,
      row.priceQuote,
      row.pricingMode,
      row.usdRate,
    );

  const pnlColumn = (headerLabel: string): PositionColumnDef => ({
    key: "unrealizedPnl",
    header: headerFor("unrealizedPnl", headerLabel),
    align: "right",
    className: "flex-1 min-w-[110px]",
    cell: (row) => <MoneyText cents={numberToCents(row.unrealizedPnl)} tone="auto" sign="explicit" />,
  });

  const rentabilityColumn = (includeYoC: boolean): PositionColumnDef => ({
    key: "unrealizedPct",
    header: headerFor("unrealizedPct", "Rentab."),
    align: "right",
    className: includeYoC ? "flex-1 min-w-[105px]" : "flex-1 min-w-[90px]",
    cell: (row) => <PositionRentabilityCell row={row} includeYoC={includeYoC} />,
  });

  const fixedIncomeColumns: PositionColumnDef[] = [
    tickerColumn,
    {
      key: "averageCost",
      header: headerFor("averageCost", "Valor Aplicado"),
      align: "right",
      className: "flex-1 min-w-[115px]",
      cell: (row) => (
        <MoneyText
          cents={numberToCents(row.totalCostBRL ?? row.totalCost ?? row.averageCost)}
          currency={row.currency}
          tone="default"
          className="text-muted-foreground"
        />
      ),
    },
    {
      key: "value",
      header: headerFor("value", "Saldo Atual"),
      align: "right",
      className: "flex-1 min-w-[115px]",
      cell: (row) => {
        const hasRate = Boolean(row.fixedIncomeMetadata?.rate_value && row.fixedIncomeMetadata.rate_value > 0);
        const isAuto = hasRate && row.source !== "manual";
        const valueCents = numberToCents(row.valueBRL);
        const tooltipTitle = isAuto
          ? row.fixedIncomeResult && row.fixedIncomeResult.businessDaysAccrued > 0
            ? `Saldo projetado automaticamente (+${row.fixedIncomeResult.businessDaysAccrued}d úteis desde ${formatDateBR(row.fixedIncomeMetadata?.base_date ?? "")}) — clique para calibrar`
            : "Saldo com rentabilidade calculada automaticamente — clique para calibrar com o extrato"
          : "Saldo manual estático — informe a taxa contratada para ativar o cálculo automático ou calibre com o extrato";

        const actionHandler = onCalibrateAsset
          ? () => onCalibrateAsset(row.assetId, row.ticker, valueCents)
          : onSetManualPrice
            ? () => triggerManualPrice(row)
            : undefined;

        return (
          <PositionActionMoneyCell
            cents={valueCents}
            ariaLabel={onCalibrateAsset ? `Calibrar saldo de ${row.ticker}` : `Saldo de ${row.ticker}`}
            tooltipTitle={tooltipTitle}
            onAction={actionHandler}
            dotTone={isAuto ? "auto" : "manual"}
            manualTitle="Saldo cadastrado manual — informe a taxa para cálculo automático"
            autoTitle="Cálculo automático ativo — clique para calibrar"
            emphasized
          />
        );
      },
    },
    pnlColumn("Rendimento"),
    rentabilityColumn(false),
    {
      key: "maturityDate",
      header: headerFor("maturityDate", "Vencimento"),
      align: "right",
      className: "flex-1 min-w-[100px]",
      cell: (row) => {
        const rawDate = row.fixedIncomeMetadata?.maturity_date || row.maturityDate;
        if (!rawDate) return <span className="num text-sm text-muted-foreground">—</span>;
        return (
          <span
            className={cn(
              "num text-sm font-medium whitespace-nowrap",
              row.isMatured ? "text-critical-strong font-semibold" : "text-muted-foreground",
            )}
          >
            {formatDateBR(rawDate)}
          </span>
        );
      },
    },
  ];

  const variableIncomeColumns: PositionColumnDef[] = [
    tickerColumn,
    {
      key: "quantity",
      header: headerFor("quantity", "Quantidade"),
      align: "right",
      className: "flex-1 min-w-[95px]",
      cell: (row) => (
        <span className="num text-sm text-muted-foreground whitespace-nowrap">
          {row.quantity === 0 ? (
            <Badge variant="muted" size="xs">
              Zerada
            </Badge>
          ) : (
            formatAssetQuantity(row.quantity, row.assetClass ?? undefined)
          )}
        </span>
      ),
    },
    {
      key: "price",
      header: headerFor("price", "Preço"),
      align: "right",
      className: "flex-1 min-w-[105px]",
      cell: (row) => {
        const dotTone =
          row.source === "manual"
            ? "manual"
            : row.source === "fallback" || row.isEstimate || row.staleIssue
              ? "fallback"
              : "auto";
        const fallbackTitle = row.staleIssue?.message ?? "Preço estimado ou defasado";
        return (
          <div className="flex flex-col items-end">
            <PositionActionMoneyCell
              cents={numberToCents(row.priceBRL)}
              ariaLabel={`Cotação de ${row.ticker}`}
              tooltipTitle={buildPositionPriceTooltip(row)}
              onAction={onSetManualPrice ? () => triggerManualPrice(row) : undefined}
              dotTone={dotTone}
              manualTitle="Preço manual"
              fallbackTitle={fallbackTitle}
            />
            {row.currency === "USD" && row.priceQuote ? (
              <span
                className="text-[10.5px] text-muted-foreground font-mono tabular-nums pr-1.5"
                title={`Cotação em Dólar: US$ ${row.priceQuote.toFixed(2)}`}
              >
                US$ {row.priceQuote.toFixed(2)}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "averageCost",
      header: headerFor("averageCost", "Custo médio"),
      align: "right",
      className: "flex-1 min-w-[105px]",
      cell: (row) => (
        <MoneyText
          cents={numberToCents(row.averageCost)}
          currency={row.currency}
          tone="default"
          className="text-muted-foreground"
        />
      ),
    },
    {
      key: "value",
      header: headerFor("value", "Valor"),
      align: "right",
      className: "flex-1 min-w-[105px]",
      cell: (row) => <MoneyText cents={numberToCents(row.valueBRL)} tone="default" />,
    },
    pnlColumn("Lucro/Prejuízo"),
    rentabilityColumn(true),
  ];

  return {
    getColumnsForClass: (className) =>
      isFixedIncomeClass(className) ? fixedIncomeColumns : variableIncomeColumns,
  };
}
