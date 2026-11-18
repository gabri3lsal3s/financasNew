import { Badge, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import type { FixedIncomeRedemptionPreviewResult } from "@/domain/portfolio";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/services/masks";
import type { AssetCurrency } from "@/types";
import { OrderTaxManualAccordion } from "./order-tax-manual-accordion";

export interface OrderFixedIncomeTaxCardProps {
  preview: FixedIncomeRedemptionPreviewResult;
  currency?: AssetCurrency;
  customTaxRatePct?: number | null;
  customTaxAmountCents?: number | null;
  onCustomTaxChange: (patch: {
    customTaxRatePct?: number | null;
    customTaxAmountCents?: number | null;
  }) => void;
  showCashCredit?: boolean;
  idPrefix: string;
}

export function OrderFixedIncomeTaxCard({
  preview,
  currency = "BRL",
  customTaxRatePct = null,
  customTaxAmountCents = null,
  onCustomTaxChange,
  showCashCredit = true,
  idPrefix,
}: OrderFixedIncomeTaxCardProps) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface p-3.5 text-xs shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-foreground">Discriminação do Resgate</span>
          {preview.isCustomized && (
            <Badge variant="warning" size="xs">
              Ajustado
            </Badge>
          )}
        </div>
        {preview.isExempt && !preview.isCustomized && (
          <Badge variant="positive" size="xs">
            Isento de IR
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Valor Bruto do Resgate:</span>
        <MoneyText cents={numberToCents(preview.grossAmount)} currency={currency} className="font-medium text-foreground" />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Custo Original Aplicado:</span>
        <MoneyText cents={numberToCents(preview.appliedCostBasis)} currency={currency} className="font-medium text-foreground" />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Rendimento Bruto Realizado:</span>
        <span className={cn("font-mono font-semibold", preview.realizedProfit >= 0 ? "text-positive-strong" : "text-critical-strong")}>
          {preview.realizedProfit >= 0 ? "+" : ""}
          <MoneyText cents={numberToCents(preview.realizedProfit)} currency={currency} className="inline" /> (
          {preview.realizedProfitPct >= 0 ? "+" : ""}
          {formatPercent(preview.realizedProfitPct)}%)
        </span>
      </div>

      {preview.iofAmount > 0 && (
        <div className="flex items-center justify-between gap-2 text-warning-strong">
          <span>IOF Regressivo ({formatPercent(preview.iofRatePct)}%):</span>
          <span className="font-mono font-medium">
            −<MoneyText cents={numberToCents(preview.iofAmount)} currency="BRL" className="inline text-warning-strong" />
          </span>
        </div>
      )}

      <div className={cn("flex items-center justify-between gap-2", preview.taxAmount > 0 ? "text-warning-strong" : "text-muted-foreground")}>
        <span>IRRF Retido na Fonte ({formatPercent(preview.taxRatePct)}%):</span>
        <span className="font-mono font-medium">
          {preview.taxAmount > 0 ? "−" : ""}
          <MoneyText
            cents={numberToCents(preview.taxAmount)}
            currency="BRL"
            className={cn("inline", preview.taxAmount > 0 ? "text-warning-strong" : "text-muted-foreground")}
          />
        </span>
      </div>

      {showCashCredit && (
        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2 font-bold">
          <span className="text-foreground">Crédito Líquido no Caixa:</span>
          <MoneyText cents={numberToCents(preview.netCredit)} currency="BRL" tone="positive" className="text-sm font-bold" />
        </div>
      )}

      <div className="flex flex-col gap-1 border-t border-border/60 pt-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Saldo bruto restante:</span>
          {preview.isFullRedemption ? (
            <Badge variant="muted" size="xs">
              Posição Encerrada
            </Badge>
          ) : (
            <MoneyText cents={numberToCents(preview.remainingGrossBalance)} currency={currency} className="font-semibold text-foreground" />
          )}
        </div>
        {!preview.isFullRedemption && preview.remainingCostBasis > 0 && (
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>Custo original remanescente:</span>
            <MoneyText cents={numberToCents(preview.remainingCostBasis)} currency={currency} variant="caption" tone="default" />
          </div>
        )}
      </div>

      {preview.taxCountdown && (
        <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/60">
          A alíquota de IR reduzirá para{" "}
          <span className="font-semibold text-foreground">{formatPercent(preview.taxCountdown.nextRatePct)}%</span> em{" "}
          <span className="font-semibold text-foreground">{preview.taxCountdown.daysRemaining} dias</span>.
        </p>
      )}

      <OrderTaxManualAccordion
        preview={preview}
        currency={currency}
        customTaxRatePct={customTaxRatePct}
        customTaxAmountCents={customTaxAmountCents}
        onCustomTaxChange={onCustomTaxChange}
        idPrefix={idPrefix}
      />
    </div>
  );
}
