import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { MoneyText } from "@/components/ui/money-text";
import { NumericInput } from "@/components/ui/numeric-input";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import { formatAssetQuantity } from "@/services/formatting";
import { formatPercent } from "@/services/masks";
import { AporteRowActions } from "./aporte-row-actions";
import type { AporteRouteRow, EffectiveAporteRouteState } from "./aporte-result-types";

export interface AporteDesktopTableProps {
  routes: AporteRouteRow[];
  effectiveRouteMap: ReadonlyMap<string, EffectiveAporteRouteState>;
  quantityOverrides: ReadonlyMap<string, number>;
  quantityDrafts: ReadonlyMap<string, string>;
  completedTickers: ReadonlySet<string>;
  onToggleAssetSelection: (assetId: string, checked: boolean) => void;
  onQuantityChange: (assetId: string, rawStr: string) => void;
  onToggleTicker: (ticker: string) => void;
  onOpenWizard?: (ticker: string, quantity: number, allocatedBRL?: number) => void;
}

export function AporteDesktopTable({
  routes,
  effectiveRouteMap,
  quantityOverrides,
  quantityDrafts,
  completedTickers,
  onToggleAssetSelection,
  onQuantityChange,
  onToggleTicker,
  onOpenWizard,
}: AporteDesktopTableProps) {
  const columns: DataListColumn<AporteRouteRow>[] = [
    {
      key: "select",
      header: <span className="sr-only">Selecionar</span>,
      className: "flex-none w-7 min-w-0",
      cell: (row) => {
        const eff = effectiveRouteMap.get(row.assetId);
        return (
          <Checkbox
            checked={eff?.isSelected ?? false}
            disabled={row.quantity <= 0}
            onCheckedChange={(checked) => onToggleAssetSelection(row.assetId, checked)}
            aria-label={`Selecionar ${row.ticker} para aporte`}
          />
        );
      },
    },
    {
      key: "ticker",
      header: "Ativo",
      className: "flex-[1.8] min-w-[190px]",
      cell: (row) => {
        const isDone = completedTickers.has(row.ticker);
        const metaLine = [
          row.assetClass,
          row.sector,
          row.effectiveTargetPct !== undefined && row.effectiveTargetPct > 0
            ? `Meta ${formatPercent(row.effectiveTargetPct)}%`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <div className={cn("flex min-w-0 flex-col gap-0.5 transition-opacity duration-150", isDone && "opacity-60")}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="truncate font-mono text-sm font-semibold text-foreground">{row.ticker}</span>
              {row.rawScore !== undefined ? (
                <Badge variant={row.rawScore === null ? "warning" : "muted"} size="xs">
                  {row.rawScore === null ? "Sem nota" : `Nota ${row.rawScore}/10`}
                </Badge>
              ) : null}
            </div>
            {metaLine ? (
              <span
                className="text-[11px] text-muted-foreground truncate"
                title={row.formulaLabel ? `${metaLine} — ${row.formulaLabel}` : metaLine}
              >
                {metaLine}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "target",
      header: "Valor alvo",
      align: "right",
      className: "flex-1 min-w-[105px]",
      cell: (row) => <MoneyText cents={numberToCents(row.targetValueBRL)} tone="default" />,
    },
    {
      key: "current",
      header: "Atual",
      align: "right",
      className: "flex-1 min-w-[95px]",
      cell: (row) => (
        <MoneyText cents={numberToCents(row.currentValueBRL)} tone="default" className="text-muted-foreground" />
      ),
    },
    {
      key: "allocated",
      header: "Aporte sugerido",
      align: "right",
      className: "flex-1 min-w-[125px]",
      cell: (row) => {
        const eff = effectiveRouteMap.get(row.assetId);
        return (
          <MoneyText
            cents={numberToCents(eff?.effectiveAllocatedBRL ?? row.allocatedBRL)}
            tone="portfolio"
            className="font-semibold"
          />
        );
      },
    },
    {
      key: "quantity",
      header: "Quantidade",
      align: "right",
      className: "flex-none w-[115px] min-w-[115px]",
      cell: (row) => {
        const eff = effectiveRouteMap.get(row.assetId);
        const currentQty = quantityOverrides.get(row.assetId) ?? row.quantity;
        const draftValue = quantityDrafts.get(row.assetId) ?? String(currentQty);
        return (
          <div className="flex flex-col items-end gap-0.5">
            <NumericInput
              size="sm"
              value={draftValue}
              onValueChange={(raw) => onQuantityChange(row.assetId, raw)}
              aria-label={`Quantidade de cotas para ${row.ticker}`}
              className="w-20 px-2 text-right"
            />
            {eff?.isQuantityCustom ? (
              <span
                className="text-[10px] text-muted-foreground font-mono"
                title={`Sugerido originalmente: ${formatAssetQuantity(row.quantity, row.assetClass ?? undefined)}`}
              >
                (sug: {formatAssetQuantity(row.quantity, row.assetClass ?? undefined)})
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "price",
      header: "Preço",
      align: "right",
      className: "flex-none w-[100px] min-w-[100px]",
      cell: (row) => (
        <MoneyText cents={numberToCents(row.priceBRL)} tone="default" className="text-muted-foreground" />
      ),
    },
    {
      key: "status",
      header: "Execução",
      align: "right",
      className: "flex-none w-[190px] min-w-[190px]",
      cell: (row): ReactNode => {
        const eff = effectiveRouteMap.get(row.assetId);
        return (
          <AporteRowActions
            ticker={row.ticker}
            isDone={completedTickers.has(row.ticker)}
            quantity={eff?.effectiveQuantity ?? row.quantity}
            allocatedBRL={eff?.effectiveAllocatedBRL ?? row.allocatedBRL}
            onToggleDone={onToggleTicker}
            onOpenWizard={onOpenWizard}
          />
        );
      },
    },
  ];

  return (
    <div className="hidden lg:block overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 bg-surface shadow-xs">
      <DataList
        columns={columns}
        rows={routes}
        rowKey={(row, index) => `${row.ticker}:${index}`}
        density="compact"
        className="border-none shadow-none min-w-[960px]"
        emptyMessage="Sem sugestão de aporte."
      />
    </div>
  );
}
