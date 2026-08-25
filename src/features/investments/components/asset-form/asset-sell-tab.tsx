import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Alert, Badge, Button, Checkbox, DatePicker, Input, MoneyInput } from "@/components/ui";
import { todayISO } from "@/domain/debts";
import type { PortfolioAsset } from "@/types";
import type { sellAssetPosition } from "@/domain/portfolio";

export interface AssetSellTabProps {
  asset: PortfolioAsset;
  isTotalValueMode: boolean;
  sellQtyStr: string;
  setSellQtyStr: (val: string) => void;
  sellPriceCents: number;
  setSellPriceCents: (val: number) => void;
  sellDate: string;
  setSellDate: (val: string) => void;
  creditToCash: boolean;
  setCreditToCash: (val: boolean) => void;
  parsedSellQty: number;
  parsedSellPrice: number;
  sellResult: ReturnType<typeof sellAssetPosition>;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirmSell: (e: React.FormEvent) => void;
}

export function AssetSellTab({
  asset,
  isTotalValueMode,
  sellQtyStr,
  setSellQtyStr,
  sellPriceCents,
  setSellPriceCents,
  sellDate,
  setSellDate,
  creditToCash,
  setCreditToCash,
  parsedSellQty,
  parsedSellPrice,
  sellResult,
  pending,
  error,
  onClose,
  onConfirmSell,
}: AssetSellTabProps) {
  return (
    <form onSubmit={onConfirmSell} className="mt-4 flex flex-col gap-4">
      <div className="rounded-xl border border-negative/20 bg-negative/5 p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            Custódia Disponível para Venda / Resgate
          </span>
          <Badge variant="muted" className="text-xs">
            {asset.quantity} {isTotalValueMode ? "posição" : "cotas"} @ {asset.currency} {asset.average_price?.toFixed(2)}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {isTotalValueMode ? "Valor a Resgatar" : "Quantidade a Vender"}
            <Input
              value={sellQtyStr}
              onChange={(e) => setSellQtyStr(e.target.value)}
              placeholder={isTotalValueMode ? "Ex: 1000,00" : "Ex: 50"}
              inputMode="decimal"
              aria-label={isTotalValueMode ? "Valor a resgatar" : "Quantidade a vender"}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Preço Unitário de Venda ({asset.currency})
            <MoneyInput
              cents={sellPriceCents}
              onCentsChange={setSellPriceCents}
              aria-label="Preço de venda"
            />
          </label>
        </div>

        {/* Atalhos rápidos de quantidade */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Vender:</span>
          {[
            { label: "25%", pct: 0.25 },
            { label: "50%", pct: 0.5 },
            { label: "75%", pct: 0.75 },
            { label: "100% (Tudo)", pct: 1 },
          ].map((shortcut) => (
            <button
              key={shortcut.label}
              type="button"
              onClick={() => {
                const totalQty = asset.quantity ?? 0;
                const calculated = Math.round(totalQty * shortcut.pct * 10000) / 10000;
                setSellQtyStr(String(calculated));
              }}
              className="rounded-md border border-border/70 bg-surface px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-surface-hover transition-colors"
            >
              {shortcut.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Data da Operação
            <DatePicker
              value={sellDate}
              onValueChange={(date: string) => setSellDate(date || todayISO())}
              ariaLabel="Data da venda"
            />
          </label>

          <div className="flex flex-col justify-end pb-1">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
              <Checkbox
                checked={creditToCash}
                onCheckedChange={(checked) => setCreditToCash(Boolean(checked))}
              />
              <span>Creditar valor líquido no Caixa</span>
            </label>
          </div>
        </div>
      </div>

      {/* Prévia financeira e fiscal da venda */}
      {parsedSellQty > 0 && parsedSellPrice > 0 ? (
        <div className="rounded-xl border border-border/80 bg-surface/90 p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Valor bruto a receber:</span>
            <span className="font-bold text-foreground">
              {asset.currency} {sellResult.grossAmount.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Lucro / Prejuízo Realizado:</span>
            <span
              className={`font-semibold ${
                sellResult.realizedPnl >= 0 ? "text-positive-strong" : "text-negative-strong"
              }`}
            >
              {sellResult.realizedPnl >= 0 ? "+" : ""}{asset.currency} {sellResult.realizedPnl.toFixed(2)} ({sellResult.realizedPnlPct >= 0 ? "+" : ""}{sellResult.realizedPnlPct.toFixed(2)}%)
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
            <span className="text-muted-foreground">Posição após a venda:</span>
            <span className="font-medium text-foreground">
              {sellResult.remainingQuantity} {isTotalValueMode ? "posição" : "cotas"} (PM de {asset.currency} {sellResult.remainingAveragePrice.toFixed(2)} inalterado)
            </span>
          </div>

          {/* Status Fiscal */}
          {sellResult.taxInfo.isStock ? (
            sellResult.taxInfo.isTaxExempt ? (
              <div className="flex items-center gap-1.5 text-[11px] text-positive-strong bg-positive/10 rounded-lg p-2">
                <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Isenção de IR aplicável (vendas no mês abaixo de R$ 20.000,00).</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-attention-strong bg-attention/10 rounded-lg p-2">
                <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Vendas no mês ultrapassam R$ 20.000. DARF estimado de 15%: R$ {sellResult.taxInfo.estimatedTaxPayable.toFixed(2)}.</span>
              </div>
            )
          ) : sellResult.taxInfo.isFii ? (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-surface-hover/50 rounded-lg p-2">
              <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
              <span>FIIs: Alíquota fixa de 20% sobre o ganho líquido. DARF estimado: R$ {sellResult.taxInfo.estimatedTaxPayable.toFixed(2)}.</span>
            </div>
          ) : sellResult.taxInfo.isFixedIncome ? (
            sellResult.taxInfo.isTaxExempt ? (
              <div className="flex items-center gap-1.5 text-[11px] text-positive-strong bg-positive/10 rounded-lg p-2">
                <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Renda Fixa Isenta de IR. Valor integral creditado no Caixa: R$ {sellResult.netCreditAmount.toFixed(2)}.</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-attention-strong bg-attention/10 rounded-lg p-2">
                <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
                <span>IRRF retido na fonte estimado ({(sellResult.taxInfo.taxRate * 100).toFixed(1)}%): R$ {sellResult.taxInfo.estimatedTaxPayable.toFixed(2)}. Líquido no Caixa: R$ {sellResult.netCreditAmount.toFixed(2)}.</span>
              </div>
            )
          ) : null}
        </div>
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={parsedSellQty <= 0 || parsedSellPrice <= 0 || pending}
        >
          {pending ? "Processando…" : "Confirmar Venda / Resgate"}
        </Button>
      </div>
    </form>
  );
}
