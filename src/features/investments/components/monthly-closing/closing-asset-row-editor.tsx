import { Badge, MoneyInput, MoneyText, NumericInput } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks/percent";
import type { MonthlyPriceSource } from "@/types";
import type { ComputedClosingItem } from "./use-monthly-closing-draft";

export interface ClosingAssetRowEditorProps {
  item: ComputedClosingItem;
  onQuantityChange: (ticker: string, rawVal: string) => void;
  onPriceChange: (ticker: string, cents: number) => void;
}

function renderSourceBadge(source: MonthlyPriceSource, isCandidate: boolean) {
  if (source === "manual") {
    return (
      <Badge variant="default" size="xs" className="font-semibold">
        Manual
      </Badge>
    );
  }
  if (source === "api" && !isCandidate) {
    return (
      <Badge variant="positive" size="xs" className="font-semibold">
        Oficial API
      </Badge>
    );
  }
  return (
    <Badge variant="muted" size="xs" className="font-semibold text-muted-foreground">
      Sugerida
    </Badge>
  );
}

export function ClosingAssetRowEditor({
  item,
  onQuantityChange,
  onPriceChange,
}: ClosingAssetRowEditorProps) {
  return (
    <tr className="even:bg-muted/15 hover:bg-surface-hover/40 transition-colors">
      <td className="py-2 px-3 min-w-[140px]">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-foreground text-xs">{item.ticker}</span>
            {item.isCandidate ? (
              <Badge variant="muted" size="xs">
                Sugerido
              </Badge>
            ) : null}
          </div>
          <span className="text-[11px] text-muted-foreground capitalize">{item.assetClass}</span>
        </div>
      </td>

      <td className="py-2 px-2.5 text-right">
        <div className="w-28 ml-auto">
          <NumericInput
            value={item.rawQuantity}
            onValueChange={(val) => onQuantityChange(item.ticker, val)}
            aria-label={`Quantidade de fechamento de ${item.ticker}`}
            calculatorLabel={`Quantidade (${item.ticker})`}
            className="text-base sm:text-sm font-bold text-right px-2"
          />
        </div>
      </td>

      <td className="py-2 px-2.5 text-right">
        <div className="w-40 ml-auto">
          <MoneyInput
            cents={item.priceCents}
            onCentsChange={(cents) => onPriceChange(item.ticker, cents)}
            currency={item.currency}
            aria-label={`Cotação de fechamento de ${item.ticker}`}
            className="text-base sm:text-sm font-bold text-right"
            showCalculatorAction
          />
        </div>
      </td>

      <td className="py-2 px-2 text-center whitespace-nowrap">
        {renderSourceBadge(item.source, item.isCandidate)}
      </td>

      <td className="py-2 px-2.5 text-right font-mono text-muted-foreground text-xs">
        <MoneyText cents={numberToCents(item.currentPrice)} currency={item.currency} tone="default" />
      </td>

      <td className="py-2 px-2 text-right font-mono text-xs whitespace-nowrap">
        {item.diffPct !== null ? (
          <span
            className={cn(
              "num font-semibold",
              item.diffPct >= 0 ? "text-positive-strong" : "text-negative-strong",
            )}
          >
            {item.diffPct >= 0 ? "+" : ""}
            {formatPercent(item.diffPct)}%
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      <td className="py-2 px-3 text-right font-mono font-bold text-foreground text-xs">
        <MoneyText cents={numberToCents(item.editedValueBRL)} tone="default" />
      </td>
    </tr>
  );
}
