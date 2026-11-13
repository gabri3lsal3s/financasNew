import { useState } from "react";
import { RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { Alert, Badge, Button, Checkbox, DatePicker, ModalFooter, MoneyInput, NumericInput } from "@/components/ui";
import { todayISO } from "@/domain/debts";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
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
  customTaxRatePct?: number | null;
  setCustomTaxRatePct?: (rate: number | null) => void;
  customTaxAmountCents?: number | null;
  setCustomTaxAmountCents?: (cents: number | null) => void;
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
  customTaxRatePct,
  setCustomTaxRatePct,
  customTaxAmountCents,
  setCustomTaxAmountCents,
}: AssetSellTabProps) {
  const [showTaxEditor, setShowTaxEditor] = useState(false);
  return (
    <form onSubmit={onConfirmSell} className="mt-4 flex flex-col gap-4">
      <div className="rounded-xl border border-negative/20 bg-negative/5 p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            Custódia Disponível para Venda / Resgate
          </span>
          <Badge variant="muted" size="xs">
            {asset.quantity} {isTotalValueMode ? "posição" : "cotas"} @ {asset.currency} {asset.average_price?.toFixed(2)}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
            {isTotalValueMode ? "Valor a Resgatar" : "Quantidade a Vender"}
            {isTotalValueMode ? (
              <MoneyInput
                cents={Math.round(parsedSellQty * 100)}
                currency={asset.currency}
                onCentsChange={(cents) => setSellQtyStr((cents / 100).toFixed(2))}
                aria-label="Valor a resgatar"
              />
            ) : (
              <NumericInput
                value={sellQtyStr}
                onValueChange={setSellQtyStr}
                placeholder="Ex: 50"
                aria-label="Quantidade a vender"
                showCalculatorAction
              />
            )}
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
            Preço Unitário de Venda ({asset.currency})
            <MoneyInput
              cents={sellPriceCents}
              currency={asset.currency}
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
                if (isTotalValueMode) {
                  const totalVal =
                    asset.fixed_income_metadata?.base_value !== undefined &&
                    asset.fixed_income_metadata?.base_value !== null &&
                    asset.fixed_income_metadata.base_value > 0
                      ? asset.fixed_income_metadata.base_value
                      : (asset.average_price > 0 ? asset.average_price : asset.quantity);
                  const calculated = Math.round(totalVal * shortcut.pct * 100) / 100;
                  setSellQtyStr(String(calculated));
                } else {
                  const totalQty = asset.quantity ?? 0;
                  const calculated = Math.round(totalQty * shortcut.pct * 10000) / 10000;
                  setSellQtyStr(String(calculated));
                }
              }}
              className="rounded-md border border-border/70 bg-surface px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-surface-hover transition-colors"
            >
              {shortcut.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
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
            <span className="text-muted-foreground">{isTotalValueMode ? "Posição após o resgate:" : "Posição após a venda:"}</span>
            <span className="font-medium text-foreground">
              {isTotalValueMode ? (
                sellResult.remainingQuantity === 0 ? (
                  "Posição Encerrada"
                ) : (
                  `Posição Ativa (Custo residual: ${asset.currency} ${sellResult.remainingAveragePrice.toFixed(2)})`
                )
              ) : (
                `${sellResult.remainingQuantity} cotas (PM de ${asset.currency} ${sellResult.remainingAveragePrice.toFixed(2)} inalterado)`
              )}
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
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-1.5 text-[11px] text-attention-strong bg-attention/10 rounded-lg p-2">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    IRRF retido na fonte {(sellResult.taxInfo.isCustomized) ? "ajustado" : "estimado"} ({(sellResult.taxInfo.taxRate * 100).toFixed(1)}%): R$ {sellResult.taxInfo.estimatedTaxPayable.toFixed(2)}. Líquido no Caixa: R$ {sellResult.netCreditAmount.toFixed(2)}.
                  </span>
                </div>
                {setCustomTaxAmountCents && setCustomTaxRatePct && (
                  <button
                    type="button"
                    onClick={() => setShowTaxEditor((prev) => !prev)}
                    className="underline text-muted-foreground hover:text-foreground cursor-pointer shrink-0 font-medium ml-2"
                  >
                    {showTaxEditor ? "Fechar" : "Ajustar"}
                  </button>
                )}
              </div>

              {showTaxEditor && setCustomTaxAmountCents && setCustomTaxRatePct && (
                <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-surface-hover/50 p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-foreground">Ajuste Fiscal Manual (Nota de Corretagem)</span>
                    {sellResult.taxInfo.isCustomized && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomTaxRatePct(null);
                          setCustomTaxAmountCents(null);
                        }}
                        className="flex items-center gap-1 text-[10px] text-primary hover:underline cursor-pointer"
                      >
                        <RotateCcw className="size-2.5" aria-hidden="true" />
                        <span>Restaurar</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-muted-foreground">Alíquota de IR (%):</label>
                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { label: "22,5%", rate: 22.5 },
                        { label: "20%", rate: 20 },
                        { label: "17,5%", rate: 17.5 },
                        { label: "15%", rate: 15 },
                        { label: "Isento", rate: 0 },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setCustomTaxRatePct(item.rate);
                            setCustomTaxAmountCents(null);
                          }}
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium border cursor-pointer",
                            customTaxRatePct === item.rate || (customTaxRatePct == null && Math.abs(sellResult.taxInfo.taxRate * 100 - item.rate) < 0.1)
                              ? "border-primary bg-primary/10 text-primary-strong font-bold"
                              : "border-border/60 bg-surface hover:bg-surface-hover text-foreground",
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 pt-1 border-t border-border/40">
                    <label htmlFor="assetsell-tax-irrf" className="text-[11px] text-muted-foreground">IRRF Retido ({asset.currency}):</label>
                    <MoneyInput
                      id="assetsell-tax-irrf"
                      cents={customTaxAmountCents ?? numberToCents(sellResult.taxInfo.estimatedTaxPayable)}
                      currency={asset.currency}
                      onCentsChange={(cents) => {
                        setCustomTaxAmountCents(cents);
                        if (sellResult.realizedPnl > 0) {
                          setCustomTaxRatePct(Math.round(((cents / 100) / sellResult.realizedPnl) * 10000) / 100);
                        }
                      }}
                      placeholder="R$ 0,00"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}

      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={parsedSellQty <= 0 || parsedSellPrice <= 0 || pending}
          className="w-full sm:w-auto"
        >
          {pending ? "Processando…" : "Confirmar Venda / Resgate"}
        </Button>
      </ModalFooter>
    </form>
  );
}
