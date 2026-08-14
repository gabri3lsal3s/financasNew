import { useState } from "react";
import { Alert, Button, Input, Modal, Select } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { useCreatePortfolioAsset } from "@/state";
import type { AssetCurrency } from "@/types";

export interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CURRENCY_OPTIONS: { value: AssetCurrency; label: string }[] = [
  { value: "BRL", label: "BRL (B3, renda fixa, cripto)" },
  { value: "USD", label: "USD (internacional)" },
];

/** Cadastro de ativo da carteira (§3.11) — ticker, classe e moeda. */
export function AssetFormDialog({ open, onOpenChange }: AssetFormDialogProps) {
  const createAsset = useCreatePortfolioAsset();
  const [ticker, setTicker] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const [currency, setCurrency] = useState<AssetCurrency>("BRL");
  const [error, setError] = useState<string | null>(null);

  const normalizedTicker = ticker.trim().toUpperCase();
  const canSubmit = normalizedTicker.length > 0 && !createAsset.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await createAsset.mutateAsync({
        ticker: normalizedTicker,
        asset_class: assetClass.trim() === "" ? null : assetClass.trim(),
        currency,
      });
      setTicker("");
      setAssetClass("");
      setCurrency("BRL");
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Adicionar ativo"
      description="Registre o ticker e a classe (ex.: Ações, FIIs, RF, caixa)."
    >
      <div className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Ticker
          <Input
            value={ticker}
            onChange={(event) => setTicker(event.target.value)}
            placeholder="PETR4, BOVA11, AAPL…"
            autoFocus
            maxLength={20}
            aria-label="Ticker do ativo"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Classe (opcional)
          <Input
            value={assetClass}
            onChange={(event) => setAssetClass(event.target.value)}
            placeholder="Ações, FIIs, RF, caixa…"
            maxLength={40}
            aria-label="Classe do ativo"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Moeda
          <Select
            value={currency}
            onValueChange={(value) => setCurrency(value as AssetCurrency)}
            options={CURRENCY_OPTIONS}
            ariaLabel="Moeda do ativo"
          />
        </label>

        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
            {createAsset.isPending ? "Salvando…" : "Adicionar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
