import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Alert, Badge, Button, Modal, NumberStepperInput } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { PriceSource } from "@/domain/portfolio";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { useRemoveManualPrice, useSetManualPrice } from "@/state";
import type { AssetCurrency } from "@/types";

export interface ManualPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: {
    id: string;
    ticker: string;
    currency: AssetCurrency;
    priceBRL: number;
    source: PriceSource;
    pricingMode?: string;
  } | null;
}

interface ManualPriceContentProps {
  asset: NonNullable<ManualPriceDialogProps["asset"]>;
  onClose: () => void;
}

function ManualPriceContent({ asset, onClose }: ManualPriceContentProps) {
  const setManual = useSetManualPrice();
  const removeManual = useRemoveManualPrice();

  const [priceInput, setPriceInput] = useState(() => (asset.source === "manual" ? String(asset.priceBRL) : ""));
  const [error, setError] = useState<string | null>(null);

  const pending = setManual.isPending || removeManual.isPending;

  const parseNumber = (raw: string): number => {
    const parsed = Number(raw.replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : NaN;
  };

  const parsedPrice = parseNumber(priceInput);
  const canSave = Number.isFinite(parsedPrice) && parsedPrice > 0 && !pending;

  const handleSave = async () => {
    if (!canSave) return;
    setError(null);
    try {
      await setManual.mutateAsync({
        ticker: asset.ticker,
        price: parsedPrice,
      });
      triggerSensory("success");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleRemove = async () => {
    setError(null);
    try {
      await removeManual.mutateAsync(asset.ticker);
      triggerSensory("success");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) {
          void handleSave();
        }
      }}
      className="mt-4 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-hover/30 p-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Preço atual considerado</span>
          <span className="num text-sm font-semibold text-foreground">
            <MoneyText cents={numberToCents(asset.priceBRL)} tone="default" />
          </span>
        </div>
        <Badge variant={asset.source === "manual" ? "portfolio" : "muted"}>
          {asset.source === "manual" ? "Manual" : asset.source === "api" ? "Cotação API" : "Fallback"}
        </Badge>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {asset.pricingMode === "total_value" ? `Preço Atual / Saldo (${asset.currency})` : `Preço unitário manual (${asset.currency})`}
        <NumberStepperInput
          value={priceInput}
          step={0.01}
          min={0}
          onValueChange={setPriceInput}
          placeholder={asset.pricingMode === "total_value" ? "Ex.: 10500,00" : "Ex.: 42,50"}
          ariaLabel="Preço manual do ativo"
        />
      </label>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex items-center justify-between gap-2 pt-2">
        {asset.source === "manual" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleRemove()}
            disabled={pending}
            className="text-xs"
          >
            <RefreshCw className="mr-1.5 size-3.5" aria-hidden="true" />
            Usar cotação automática
          </Button>
        ) : (
          <span />
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!canSave}>
            {pending ? "Salvando…" : "Salvar preço"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/**
 * Diálogo para definição de override de preço manual (§1.6 / D5).
 * Preço manual prevalece sobre cotações de API e fallback.
 */
export function ManualPriceDialog({ open, onOpenChange, asset }: ManualPriceDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Cotação · ${asset?.ticker ?? ""}`}
      description="Defina um preço fixo manual ou restaure a cotação automática da API de mercado."
      showCalculator
    >
      {open && asset ? (
        <ManualPriceContent
          key={`${asset.id}-${asset.source}-${asset.priceBRL}`}
          asset={asset}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}
