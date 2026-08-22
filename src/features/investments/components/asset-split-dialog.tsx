import { useState } from "react";
import { Divide, Sparkles } from "lucide-react";
import { Alert, Button, Input, Modal } from "@/components/ui";
import { splitAssetPosition } from "@/domain/portfolio";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useUpdatePortfolioAsset } from "@/state";
import type { PortfolioAsset } from "@/types";

export interface AssetSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: PortfolioAsset | null;
}

export function AssetSplitDialog({ open, onOpenChange, asset }: AssetSplitDialogProps) {
  const updateAsset = useUpdatePortfolioAsset();
  const [ratioFromStr, setRatioFromStr] = useState("1");
  const [ratioToStr, setRatioToStr] = useState("2");
  const [error, setError] = useState<string | null>(null);

  if (!asset) return null;

  const currentQty = Number(asset.quantity ?? 0);
  const currentAvgPrice = Number(asset.average_price ?? 0);

  const ratioFrom = Math.max(0.0001, Number(ratioFromStr.replace(",", ".")) || 1);
  const ratioTo = Math.max(0.0001, Number(ratioToStr.replace(",", ".")) || 1);

  const splitResult = splitAssetPosition({
    currentQuantity: currentQty,
    currentAveragePrice: currentAvgPrice,
    ratioFrom,
    ratioTo,
  });

  const isSplit = ratioTo > ratioFrom;
  const operationLabel = isSplit ? "Desdobramento (Split)" : "Grupamento (Reverse Split)";

  const handleApplySplit = async () => {
    setError(null);
    try {
      await updateAsset.mutateAsync({
        id: asset.id,
        patch: {
          quantity: splitResult.newQuantity,
          average_price: splitResult.newAveragePrice,
        },
      });

      triggerSensory("success");
      pushToast({
        title: `${operationLabel} aplicado`,
        description: `${asset.ticker}: ${splitResult.newQuantity} cotas com PM de R$ ${splitResult.newAveragePrice.toFixed(4)}.`,
      });

      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Ajuste Societário · ${asset.ticker}`}
      description="Desdobramento ou grupamento de cotas. O custo total investido permanece rigorosamente inalterado."
      size="md"
    >
      <div className="mt-4 flex flex-col gap-4">
        {error ? <Alert variant="error">{error}</Alert> : null}

        {/* Proporção da operação */}
        <div className="rounded-xl border border-border/80 bg-surface/90 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Divide className="size-4 text-portfolio" aria-hidden="true" />
            <span>Proporção do Evento</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex-1 flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              De (cada)
              <Input
                value={ratioFromStr}
                onChange={(e) => setRatioFromStr(e.target.value)}
                placeholder="1"
                inputMode="decimal"
                aria-label="Cotas antes da proporção"
              />
            </label>
            <span className="text-sm font-semibold text-muted-foreground pt-5">para</span>
            <label className="flex-1 flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Virou (passa a ter)
              <Input
                value={ratioToStr}
                onChange={(e) => setRatioToStr(e.target.value)}
                placeholder="2"
                inputMode="decimal"
                aria-label="Cotas após a proporção"
              />
            </label>
          </div>

          {/* Atalhos comuns */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-muted-foreground">Atalhos:</span>
            {[
              { label: "1:2 (Dobro)", from: "1", to: "2" },
              { label: "1:5", from: "1", to: "5" },
              { label: "1:10 (10x)", from: "1", to: "10" },
              { label: "10:1 (Grupamento)", from: "10", to: "1" },
            ].map((shortcut) => (
              <button
                key={shortcut.label}
                type="button"
                onClick={() => {
                  setRatioFromStr(shortcut.from);
                  setRatioToStr(shortcut.to);
                }}
                className="rounded-md border border-border/70 bg-surface-hover/50 px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-surface-hover transition-colors"
              >
                {shortcut.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prévia matemática */}
        <div className="rounded-xl border border-portfolio/20 bg-portfolio/5 p-4 flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-portfolio">
            <Sparkles className="size-4" aria-hidden="true" />
            <span>Prévia do Resultado</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex flex-col gap-0.5 rounded-lg bg-background/60 p-2.5">
              <span className="text-muted-foreground">Posição Atual:</span>
              <span className="font-semibold text-foreground">
                {currentQty} cotas @ {asset.currency} {currentAvgPrice.toFixed(2)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Custo total: {asset.currency} {splitResult.totalCostBefore.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-col gap-0.5 rounded-lg bg-background/90 p-2.5 border border-portfolio/30">
              <span className="text-muted-foreground">Após o ajuste:</span>
              <span className="font-bold text-foreground flex items-center gap-1">
                {splitResult.newQuantity} cotas @ {asset.currency} {splitResult.newAveragePrice.toFixed(4)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Custo total preservado: {asset.currency} {splitResult.totalCostAfter.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleApplySplit} disabled={updateAsset.isPending}>
            {updateAsset.isPending ? "Aplicando…" : `Confirmar ${operationLabel}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
