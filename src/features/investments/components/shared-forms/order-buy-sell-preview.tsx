import { ArrowRight, Calculator, Info } from "lucide-react";
import { MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import { formatCentsAsBRL, formatPercent } from "@/services/masks";
import type { AssetCurrency } from "@/types";

export interface OrderBuySellPreviewProps {
  isSell: boolean;
  isCash: boolean;
  isTotalValue: boolean;
  currency: AssetCurrency;
  buyPreview?: {
    currentAveragePrice: number;
    newAveragePrice: number;
    totalOrderValueNative?: number;
    totalOrderValueBRL: number;
    newAppliedBalance?: number;
  } | null;
  sellVariablePreview?: {
    realizedPnl: number;
    realizedPnlPct: number;
    showActionExemptionNote?: boolean;
  } | null;
}

export function OrderBuySellPreview({
  isSell,
  isCash,
  isTotalValue,
  currency,
  buyPreview,
  sellVariablePreview,
}: OrderBuySellPreviewProps) {
  if (!isSell && isTotalValue && buyPreview?.newAppliedBalance !== undefined) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-surface-raised/60 p-3 text-xs">
        <span className="text-muted-foreground">Saldo aplicado resultante:</span>
        <MoneyText
          cents={numberToCents(buyPreview.newAppliedBalance)}
          currency={currency}
          tone="positive"
          className="text-sm font-bold text-primary-strong"
        />
      </div>
    );
  }

  if (!isSell && !isTotalValue && !isCash && buyPreview) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Calculator className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Impacto no Preço Médio e Posição</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="flex flex-col gap-1 rounded-lg bg-surface-raised/70 p-2.5">
            <span className="text-[11px] text-muted-foreground">Preço Médio</span>
            <div className="flex items-center gap-1.5 font-mono font-semibold text-foreground">
              <MoneyText cents={numberToCents(buyPreview.currentAveragePrice)} currency={currency} />
              <ArrowRight className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
              <MoneyText cents={numberToCents(buyPreview.newAveragePrice)} currency={currency} className="font-bold text-primary-strong" />
            </div>
          </div>

          <div className="flex flex-col gap-1 rounded-lg bg-surface-raised/70 p-2.5">
            <span className="text-[11px] text-muted-foreground">Total Investido na Ordem</span>
            {currency === "USD" && buyPreview.totalOrderValueNative !== undefined ? (
              <div className="flex flex-col">
                <MoneyText cents={numberToCents(buyPreview.totalOrderValueNative)} currency="USD" className="text-sm font-bold text-foreground" />
                <span className="text-[11px] text-muted-foreground font-mono">
                  (<MoneyText cents={numberToCents(buyPreview.totalOrderValueBRL)} currency="BRL" className="inline" />)
                </span>
              </div>
            ) : (
              <MoneyText cents={numberToCents(buyPreview.totalOrderValueBRL)} currency="BRL" className="text-sm font-bold text-foreground" />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isSell && !isTotalValue && sellVariablePreview) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 text-xs shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Resultado Realizado:</span>
          <span className={cn("font-mono font-bold text-sm", sellVariablePreview.realizedPnl >= 0 ? "text-positive-strong" : "text-negative-strong")}>
            {sellVariablePreview.realizedPnl >= 0 ? "+" : ""}
            <MoneyText cents={numberToCents(sellVariablePreview.realizedPnl)} currency={currency} className="inline text-sm font-bold" /> (
            {sellVariablePreview.realizedPnlPct >= 0 ? "+" : ""}
            {formatPercent(sellVariablePreview.realizedPnlPct)}%)
          </span>
        </div>
        {sellVariablePreview.showActionExemptionNote && (
          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
            <Info className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>Isenção de IRPF se o total de vendas de ações no mês for até {formatCentsAsBRL(2_000_000)}.</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}
