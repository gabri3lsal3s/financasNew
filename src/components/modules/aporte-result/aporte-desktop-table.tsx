import type { ReactNode } from "react";
import { Clock, RotateCcw } from "lucide-react";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { MoneyText } from "@/components/ui/money-text";
import { NumericInput } from "@/components/ui/numeric-input";
import { buildAporteAssetRouteBreakdown } from "@/domain/calculation-memory";
import { isAssetReviewOverdue } from "@/domain/portfolio";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import { formatAssetQuantity } from "@/services/formatting";
import { formatPercent } from "@/services/masks";
import { AporteReasonBadge } from "./aporte-reason-badge";
import { AporteRowActions } from "./aporte-row-actions";
import type { AporteRouteRow, EffectiveAporteRouteState } from "./aporte-result-types";

export interface AporteDesktopTableProps {
  routes: AporteRouteRow[];
  effectiveRouteMap: ReadonlyMap<string, EffectiveAporteRouteState>;
  quantityOverrides: ReadonlyMap<string, number>;
  quantityDrafts: ReadonlyMap<string, string>;
  priceOverrides?: ReadonlyMap<string, number>;
  priceDrafts?: ReadonlyMap<string, string>;
  completedTickers: ReadonlySet<string>;
  onToggleAssetSelection: (assetId: string, checked: boolean) => void;
  onQuantityChange: (assetId: string, rawStr: string) => void;
  onPriceChange?: (assetId: string, rawStr: string) => void;
  onResetAsset?: (assetId: string) => void;
  onToggleTicker: (ticker: string) => void;
  onOpenWizard?: (ticker: string, quantity: number, allocatedBRL?: number) => void;
  onInspectAsset?: (ticker: string) => void;
}

/**
 * Tabela Desktop de Ordens Sugeridas (§Fase 3):
 * - Inputs subtle/ghost com tabular-nums;
 * - Ações padronizadas compactas (sem pílula pendente poluente);
 * - Badges suaves de motivos e tetos prudenciais.
 */
export function AporteDesktopTable({
  routes,
  effectiveRouteMap,
  quantityOverrides,
  quantityDrafts,
  priceOverrides,
  priceDrafts,
  completedTickers,
  onToggleAssetSelection,
  onQuantityChange,
  onPriceChange,
  onResetAsset,
  onToggleTicker,
  onOpenWizard,
  onInspectAsset,
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
      className: "flex-[1.8] min-w-[180px]",
      cell: (row) => {
        const isDone = completedTickers.has(row.ticker);
        const eff = effectiveRouteMap.get(row.assetId);
        const routeBreakdown = buildAporteAssetRouteBreakdown({
          ticker: row.ticker,
          assetClass: row.assetClass,
          sector: row.sector,
          currentValueBRL: row.currentValueBRL,
          targetValueBRL: row.targetValueBRL,
          gapBRL: row.gapBRL,
          priceBRL: row.priceBRL,
          quantity: eff?.effectiveQuantity ?? row.quantity,
          allocatedBRL: eff?.effectiveAllocatedBRL ?? row.allocatedBRL,
          effectiveTargetPct: row.effectiveTargetPct,
          reasonLabel: row.reasonLabel,
          ceilingReason: row.ceilingReason,
        });

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
          <div className={cn("flex min-w-0 flex-col gap-0.5 transition-opacity duration-150 py-0.5", isDone && "opacity-60")}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="truncate font-mono text-sm font-bold text-foreground">{row.ticker}</span>
              <CalculationMemoryModal breakdown={routeBreakdown} />
              {row.isConstrainedByCeiling ? (
                <Badge
                  variant="muted"
                  size="xs"
                  className="border-border/80 bg-surface-raised text-muted-foreground font-mono text-[10px] shrink-0"
                  title={row.ceilingReason}
                >
                  {row.ceilingReason === "asset_ceiling"
                    ? "Teto Ativo"
                    : row.ceilingReason === "sector_ceiling"
                    ? "Teto Setor"
                    : row.ceilingReason === "macro_sector_ceiling"
                    ? "Teto Macro"
                    : row.ceilingReason === "issuer_ceiling"
                    ? "Teto Emissor"
                    : "Teto"}
                </Badge>
              ) : null}
              {row.rawScore !== undefined ? (
                onInspectAsset ? (
                  <button
                    type="button"
                    onClick={() => onInspectAsset(row.ticker)}
                    className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md cursor-pointer shrink-0"
                    title={`Ver tese e reavaliar nota de ${row.ticker}`}
                  >
                    <Badge
                      variant="muted"
                      size="xs"
                      className="cursor-pointer hover:border-primary/50 transition-colors font-mono text-[10px]"
                    >
                      {row.rawScore === null ? "Sem nota" : `Nota ${row.rawScore}/10`}
                    </Badge>
                  </button>
                ) : (
                  <Badge variant="muted" size="xs" className="font-mono text-[10px] shrink-0">
                    {row.rawScore === null ? "Sem nota" : `Nota ${row.rawScore}/10`}
                  </Badge>
                )
              ) : null}
              {row.rawScore !== null && isAssetReviewOverdue(row.lastReviewedAt, row.reviewFrequencyMonths) ? (
                onInspectAsset ? (
                  <button
                    type="button"
                    onClick={() => onInspectAsset(row.ticker)}
                    className="inline-flex items-center gap-1 text-[10px] text-warning-strong bg-warning/10 hover:bg-warning/20 border border-warning/25 px-1.5 py-0.5 rounded cursor-pointer transition-colors shrink-0"
                    title="Tese de investimento pendente de revisão periódica. Clique para revisar critérios."
                  >
                    <Clock className="size-2.5 shrink-0" aria-hidden="true" />
                    <span>Revisão pendente</span>
                  </button>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] text-warning-strong bg-warning/10 border border-warning/25 px-1.5 py-0.5 rounded shrink-0"
                    title="Tese de investimento pendente de revisão periódica."
                  >
                    <Clock className="size-2.5 shrink-0" aria-hidden="true" />
                    <span>Revisão pendente</span>
                  </span>
                )
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
      key: "reason",
      header: "Motivo da Sugestão",
      className: "flex-[1.4] min-w-[150px]",
      cell: (row) => (
        <div className="flex items-center min-w-0">
          <AporteReasonBadge
            ticker={row.ticker}
            reasonKind={row.reasonKind}
            reasonLabel={row.reasonLabel}
            reasonDescription={row.reasonDescription}
            hasQualityConflict={row.hasQualityConflict}
            qualityConflictDetail={row.qualityConflictDetail}
            rawScore={row.rawScore}
            onInspect={onInspectAsset ? () => onInspectAsset(row.ticker) : undefined}
          />
        </div>
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
            className="font-semibold tabular-nums"
          />
        );
      },
    },
    {
      key: "quantity",
      header: "Quantidade",
      align: "right",
      className: "flex-none w-[130px] min-w-[130px]",
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
              className="w-24 sm:w-28 h-7.5 px-2 text-right font-mono tabular-nums border border-border/40 hover:border-border/80 focus:border-primary/80 bg-surface-raised/40 hover:bg-surface-raised/70 focus:bg-surface transition-colors shadow-xs rounded-md text-xs"
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
      className: "flex-none w-[130px] min-w-[130px]",
      cell: (row) => {
        const eff = effectiveRouteMap.get(row.assetId);
        const currentPrice = priceOverrides?.get(row.assetId) ?? row.priceBRL;
        const draftValue = priceDrafts?.get(row.assetId) ?? String(currentPrice);
        return (
          <div className="flex flex-col items-end gap-0.5">
            {onPriceChange ? (
              <NumericInput
                size="sm"
                value={draftValue}
                onValueChange={(raw) => onPriceChange(row.assetId, raw)}
                aria-label={`Preço unitário para ${row.ticker}`}
                className="w-24 sm:w-28 h-7.5 px-2 text-right font-mono tabular-nums border border-border/40 hover:border-border/80 focus:border-primary/80 bg-surface-raised/40 hover:bg-surface-raised/70 focus:bg-surface transition-colors shadow-xs rounded-md text-xs"
              />
            ) : (
              <MoneyText cents={numberToCents(row.priceBRL)} tone="default" className="text-muted-foreground font-mono tabular-nums" />
            )}
            {eff?.isPriceCustom ? (
              <span
                className="text-[10px] text-muted-foreground font-mono"
                title={`Sugerido originalmente: R$ ${row.priceBRL.toFixed(2)}`}
              >
                (sug: R$ {row.priceBRL.toFixed(2)})
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Execução",
      align: "right",
      className: "flex-none w-[200px] min-w-[200px]",
      cell: (row): ReactNode => {
        const eff = effectiveRouteMap.get(row.assetId);
        const hasCustom = eff?.isQuantityCustom || eff?.isPriceCustom;
        return (
          <div className="flex items-center justify-end gap-1.5">
            {hasCustom && !completedTickers.has(row.ticker) ? (
              <Badge variant="warning" size="xs">
                Editado
              </Badge>
            ) : null}
            {hasCustom && onResetAsset ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onResetAsset(row.assetId)}
                title={`Restaurar cotação e quantidade sugeridas para ${row.ticker}`}
                aria-label={`Restaurar valores sugeridos para ${row.ticker}`}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
              </Button>
            ) : null}
            <AporteRowActions
              ticker={row.ticker}
              isDone={completedTickers.has(row.ticker)}
              quantity={eff?.effectiveQuantity ?? row.quantity}
              allocatedBRL={eff?.effectiveAllocatedBRL ?? row.allocatedBRL}
              onToggleDone={onToggleTicker}
              onOpenWizard={onOpenWizard}
              onInspect={onInspectAsset ? () => onInspectAsset(row.ticker) : undefined}
            />
          </div>
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
        className="border-none shadow-none min-w-[860px]"
        emptyMessage="Sem sugestão de aporte."
      />
    </div>
  );
}
