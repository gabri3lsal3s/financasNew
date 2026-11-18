import { Globe } from "lucide-react";
import { Badge, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { formatPercent } from "@/services/masks";
import type { AssetDetailMetrics } from "./use-asset-detail-metrics";

export interface AssetUsdCustodyCardProps {
  metrics: AssetDetailMetrics;
}

export function AssetUsdCustodyCard({ metrics }: AssetUsdCustodyCardProps) {
  const {
    isUSD,
    usdRate,
    currentValue,
    currentPrice,
    positionRow,
    averageCost,
    totalDividendsNative,
    yieldOnCostPct,
  } = metrics;

  if (!isUSD) return null;

  const nativeQuote = positionRow?.priceQuote ?? currentPrice / usdRate;
  const formattedPtax = usdRate.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Custódia Internacional (USD)
          </span>
        </div>
        <Badge variant="muted" size="xs">
          Taxa PTAX: <span className="num font-mono">{formattedPtax}</span>
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Posição em US$
          </span>
          <MoneyText
            cents={numberToCents(currentValue / usdRate)}
            currency="USD"
            tone="default"
            className="text-sm font-bold"
          />
          <MoneyText cents={numberToCents(currentValue)} currency="BRL" variant="caption" tone="default" className="text-muted-foreground" />
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Cotação Nativa
          </span>
          <MoneyText
            cents={numberToCents(nativeQuote)}
            currency="USD"
            tone="default"
            className="text-sm font-bold"
          />
          <MoneyText cents={numberToCents(currentPrice)} currency="BRL" variant="caption" tone="default" className="text-muted-foreground" />
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Preço Médio US$
          </span>
          <MoneyText
            cents={numberToCents(averageCost)}
            currency="USD"
            tone="default"
            className="text-sm font-bold"
          />
          <span className="text-[11px] text-muted-foreground font-mono">Custo nativo</span>
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Proventos em US$
          </span>
          <MoneyText
            cents={numberToCents(totalDividendsNative)}
            currency="USD"
            tone="positive"
            className="text-sm font-bold"
          />
          <span className="text-[11px] text-muted-foreground font-mono">
            YoC Nativo: <span className="num">{formatPercent(yieldOnCostPct)}%</span>
          </span>
        </div>
      </div>
    </div>
  );
}
