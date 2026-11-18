import { Layers } from "lucide-react";
import type { PointInTimeResult } from "@/domain/portfolio";
import { cn } from "@/lib/utils";
import { ClosingAssetRowEditor } from "./monthly-closing/closing-asset-row-editor";
import { ClosingSummaryHeader } from "./monthly-closing/closing-summary-header";
import { useMonthlyClosingDraft } from "./monthly-closing/use-monthly-closing-draft";

export interface MonthlyClosingEditorProps {
  month: string;
  historicalPosition: PointInTimeResult;
  onSaved?: () => void;
  className?: string;
}

export function MonthlyClosingEditor({
  month,
  historicalPosition,
  onSaved,
  className,
}: MonthlyClosingEditorProps) {
  const {
    cashBalanceCents,
    setCashBalanceCents,
    recalculatedSummary,
    isSaving,
    handleReset,
    handlePriceChange,
    handleQuantityChange,
    handleSave,
  } = useMonthlyClosingDraft({ month, historicalPosition, onSaved });

  return (
    <div className={cn("flex flex-col gap-4 w-full", className)}>
      <ClosingSummaryHeader
        month={month}
        isBalanceOnly={historicalPosition.fidelity?.status === "balance_only"}
        snapshotTotalValue={historicalPosition.fidelity?.snapshotTotalValue ?? null}
        cashBalanceCents={cashBalanceCents}
        onCashBalanceChange={setCashBalanceCents}
        summary={recalculatedSummary}
        isSaving={isSaving}
        onReset={handleReset}
        onSave={() => void handleSave()}
      />

      <div className="rounded-xl border border-border/80 bg-surface overflow-hidden shadow-xs">
        <div className="p-3 border-b border-border/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Layers className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Ativos em Custódia no Fechamento
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            {recalculatedSummary.items.length} ativos listados
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar scroll-smooth w-full">
          <table className="w-full min-w-[740px] text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/80 bg-muted/30 text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Ativo / Classe</th>
                <th className="py-2.5 px-2.5 text-right w-32">Qtd. Fechamento</th>
                <th className="py-2.5 px-2.5 text-right w-44">Cotação Fechamento</th>
                <th className="py-2.5 px-2 text-center">Origem</th>
                <th className="py-2.5 px-2.5 text-right">Cotação Ref.</th>
                <th className="py-2.5 px-2 text-right">Dif. (%)</th>
                <th className="py-2.5 px-3 text-right">Total Fechamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {recalculatedSummary.items.map((item) => (
                <ClosingAssetRowEditor
                  key={item.ticker}
                  item={item}
                  onQuantityChange={handleQuantityChange}
                  onPriceChange={handlePriceChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
