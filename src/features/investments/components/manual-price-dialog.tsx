import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Alert, Badge, Button, FormField, Modal, ModalFooter, MoneyInput, MoneyText } from "@/components/ui";
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
    priceQuote?: number;
    priceBRL: number;
    usdRate?: number;
    source: PriceSource;
    pricingMode?: string;
  } | null;
}

interface ManualPriceContentProps {
  asset: NonNullable<ManualPriceDialogProps["asset"]>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

function ManualPriceContent({ asset, open, onOpenChange, onClose }: ManualPriceContentProps) {
  const setManual = useSetManualPrice();
  const removeManual = useRemoveManualPrice();

  const nativePrice =
    asset.priceQuote ??
    (asset.currency === "USD" && asset.usdRate && asset.usdRate > 0
      ? Math.round((asset.priceBRL / asset.usdRate) * 10000) / 10000
      : asset.priceBRL);

  const [priceCents, setPriceCents] = useState(() =>
    asset.source === "manual" ? numberToCents(nativePrice) : 0,
  );
  const [error, setError] = useState<string | null>(null);

  const pending = setManual.isPending || removeManual.isPending;
  const parsedPrice = priceCents / 100;
  const canSave = Number.isFinite(parsedPrice) && parsedPrice > 0 && !pending;

  const handleSave = async () => {
    if (!canSave) return;
    setError(null);
    try {
      await setManual.mutateAsync({ ticker: asset.ticker, price: parsedPrice });
      triggerSensory("success");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      triggerSensory("error");
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
      triggerSensory("error");
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Cotação · ${asset.ticker}`}
      description={`Defina o preço unitário em ${asset.currency} ou restaure a cotação automática.`}
      size="md"
      showCalculator
      footer={
        <ModalFooter
          borderless
          destructiveAction={
            asset.source === "manual" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void handleRemove()}
                disabled={pending}
                sensoryIntent={false}
                className="text-xs"
              >
                <RefreshCw className="mr-1.5 size-3.5" aria-hidden="true" />
                Usar cotação automática
              </Button>
            ) : undefined
          }
        >
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="manual-price-form"
            disabled={!canSave}
            sensoryIntent={false}
          >
            {pending ? "Salvando..." : "Salvar preço"}
          </Button>
        </ModalFooter>
      }
    >
      <form
        id="manual-price-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) void handleSave();
        }}
        className="flex flex-col gap-4 pt-1"
      >
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-hover/30 p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Preço atual considerado</span>
            <div className="flex items-center gap-2">
              <MoneyText
                cents={numberToCents(nativePrice)}
                currency={asset.currency}
                tone="default"
                className="text-sm font-semibold"
              />
              {asset.currency === "USD" ? (
                <span className="text-xs text-muted-foreground font-mono">
                  (<MoneyText cents={numberToCents(asset.priceBRL)} currency="BRL" tone="default" variant="caption" />)
                </span>
              ) : null}
            </div>
          </div>
          <Badge variant={asset.source === "manual" ? "portfolio" : "muted"}>
            {asset.source === "manual" ? "Manual" : asset.source === "api" ? "Cotação API" : "Fallback"}
          </Badge>
        </div>

        <FormField label={`Preço unitário manual (${asset.currency})`} htmlFor="manual-price-input">
          <MoneyInput
            id="manual-price-input"
            cents={priceCents}
            currency={asset.currency}
            onCentsChange={setPriceCents}
            placeholder={asset.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
            aria-label={`Preço manual do ativo em ${asset.currency}`}
            className="text-base sm:text-sm"
            showCalculatorAction
          />
        </FormField>

        {error ? <Alert variant="error">{error}</Alert> : null}
      </form>
    </Modal>
  );
}

/**
 * Diálogo para definição de override de preço manual (§1.6 / D5).
 */
export function ManualPriceDialog({ open, onOpenChange, asset }: ManualPriceDialogProps) {
  if (!open || !asset) return null;

  return (
    <ManualPriceContent
      key={`${asset.id}-${asset.source}-${asset.priceBRL}-${asset.priceQuote ?? ""}`}
      asset={asset}
      open={open}
      onOpenChange={onOpenChange}
      onClose={() => onOpenChange(false)}
    />
  );
}
