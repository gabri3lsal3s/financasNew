import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Badge, Button, Checkbox, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import type { ParsedPortfolioImportRow } from "@/domain/portfolio/b3-csv-parser";
import { formatDateBR } from "@/lib/date";
import { formatAssetQuantity } from "@/services/formatting";
import type { PortfolioAsset, PortfolioTransactionType } from "@/types";
import { ImportInlineRowEditor } from "./import-inline-row-editor";

const OPERATION_LABEL: Record<
  PortfolioTransactionType,
  { label: string; variant: "default" | "positive" | "negative" | "portfolio" | "muted" }
> = {
  buy: { label: "Compra", variant: "positive" },
  sell: { label: "Venda", variant: "negative" },
  dividend: { label: "Dividendo", variant: "portfolio" },
  jcp: { label: "JCP", variant: "portfolio" },
  fii_yield: { label: "Rendimento", variant: "portfolio" },
  subscription: { label: "Subscrição", variant: "default" },
  split: { label: "Desdobramento", variant: "muted" },
  reverse_split: { label: "Grupamento", variant: "muted" },
};

export interface ImportPreviewTableStepProps {
  parsedRows: readonly ParsedPortfolioImportRow[];
  selectedIndices: ReadonlySet<number>;
  editingIndex: number | null;
  isPositionMode: boolean;
  hasMappingBack: boolean;
  existingTickerMap: ReadonlyMap<string, PortfolioAsset>;
  onToggleSelectAll: () => void;
  onToggleIndex: (idx: number) => void;
  onStartEdit: (idx: number) => void;
  onDoneEdit: () => void;
  onUpdateRow: (idx: number, updates: Partial<ParsedPortfolioImportRow>) => void;
  onRemoveRow: (idx: number) => void;
  onAddNewRow: () => void;
  onAdjustColumns: () => void;
}

export function ImportPreviewTableStep({
  parsedRows,
  selectedIndices,
  editingIndex,
  isPositionMode,
  hasMappingBack,
  existingTickerMap,
  onToggleSelectAll,
  onToggleIndex,
  onStartEdit,
  onDoneEdit,
  onUpdateRow,
  onRemoveRow,
  onAddNewRow,
  onAdjustColumns,
}: ImportPreviewTableStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="selectAllPortfolio"
            checked={selectedIndices.size === parsedRows.length && parsedRows.length > 0}
            onCheckedChange={onToggleSelectAll}
          />
          <label htmlFor="selectAllPortfolio" className="text-xs font-medium text-foreground cursor-pointer select-none">
            Selecionar todos ({selectedIndices.size} de {parsedRows.length})
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onAddNewRow} className="text-xs gap-1">
            <Plus aria-hidden="true" className="size-3.5" />
            Adicionar linha
          </Button>
          {hasMappingBack ? (
            <Button type="button" variant="outline" size="sm" onClick={onAdjustColumns} className="text-xs gap-1">
              <RotateCcw aria-hidden="true" className="size-3.5" />
              Ajustar colunas
            </Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto no-scrollbar scroll-smooth rounded-xl border border-border/80 bg-surface divide-y divide-border/60 p-1 w-full">
        {parsedRows.map((row, idx) => {
          const isSelected = selectedIndices.has(idx);
          const op =
            isPositionMode && row.type === "buy"
              ? { label: "Posição Inicial", variant: "portfolio" as const }
              : OPERATION_LABEL[row.type];
          const isNewAsset = !existingTickerMap.has(row.ticker.trim().toUpperCase());

          if (editingIndex === idx) {
            return (
              <ImportInlineRowEditor
                key={`edit-${idx}`}
                index={idx}
                row={row}
                isPositionMode={isPositionMode}
                onUpdate={(updates) => onUpdateRow(idx, updates)}
                onDone={onDoneEdit}
              />
            );
          }

          return (
            <div
              key={`${row.ticker}-${row.date}-${idx}`}
              className={`flex items-center justify-between gap-3 p-3 min-w-[320px] transition-colors ${isSelected ? "bg-primary/5" : "opacity-65 hover:bg-surface-hover/50"}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleIndex(idx)}
                  aria-label={`Selecionar ${row.ticker}`}
                />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs text-foreground font-mono">{row.ticker}</span>
                    <Badge variant={op.variant} size="xs">{op.label}</Badge>
                    {isNewAsset ? <Badge variant="portfolio" size="xs">Novo ativo</Badge> : null}
                    {row.assetClass ? <Badge variant="muted" size="xs">{row.assetClass}</Badge> : null}
                  </div>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {isPositionMode ? "Custódia" : formatDateBR(row.date)}
                    {row.quantity > 0 ? ` · ${formatAssetQuantity(row.quantity, row.assetClass ?? undefined)} cotas` : ""}
                    {row.price > 0 ? (
                      <>
                        {" "}@{" "}
                        <MoneyText cents={numberToCents(row.price)} currency={row.currency} variant="caption" tone="default" />{" "}
                        ({isPositionMode ? "médio" : "un"})
                      </>
                    ) : null}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="text-right">
                  {row.total > 0 ? (
                    <MoneyText cents={numberToCents(row.total)} currency={row.currency} tone="default" className="text-xs font-semibold" />
                  ) : (
                    <span className="text-[11px] text-muted-foreground font-medium">Cadastro</span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onStartEdit(idx)}
                    className="size-8 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                    title="Editar valores desta linha"
                    aria-label={`Editar valores de ${row.ticker}`}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveRow(idx)}
                    className="size-8 p-0 shrink-0 text-muted-foreground hover:text-critical-strong"
                    title="Remover linha"
                    aria-label={`Remover linha ${row.ticker}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
