import { useState } from "react";
import { numberToCents } from "@/domain/money";
import { Alert, Button, Input, Modal, MoneyInput, Select } from "@/components/ui";
import { isCashAssetClass } from "@/domain/portfolio/valuation";
import { assetMetadataSchema } from "@/domain/portfolio/schemas";
import { getErrorMessage } from "@/services/errors";
import { useUpdatePortfolioAsset } from "@/state";
import type { AssetCurrency, PortfolioAsset } from "@/types";

export interface AssetEditDialogProps {
  asset: PortfolioAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ASSET_CLASSES = [
  { value: "Ações", label: "Ações" },
  { value: "FIIs", label: "FIIs / Imobiliário" },
  { value: "ETFs", label: "ETFs / Índices" },
  { value: "BDRs", label: "BDRs" },
  { value: "Renda Fixa", label: "Renda Fixa" },
  { value: "Cripto", label: "Criptomoedas" },
  { value: "Caixa", label: "Caixa / Reserva" },
  { value: "Internacional", label: "Internacional (EUA)" },
];

const CURRENCIES: { value: AssetCurrency; label: string }[] = [
  { value: "BRL", label: "BRL (Reais)" },
  { value: "USD", label: "USD (Dólares)" },
];

interface AssetEditFormContentProps {
  asset: PortfolioAsset;
  onClose: () => void;
}

function AssetEditFormContent({ asset, onClose }: AssetEditFormContentProps) {
  const updateAsset = useUpdatePortfolioAsset();

  const [ticker, setTicker] = useState(asset.ticker);
  const [assetClass, setAssetClass] = useState(asset.asset_class ?? "Ações");
  const [currency, setCurrency] = useState<AssetCurrency>(asset.currency ?? "BRL");
  const [notes, setNotes] = useState(asset.notes ?? "");
  const [accumulatedDividendsCents, setAccumulatedDividendsCents] = useState(
    numberToCents(asset.accumulated_dividends ?? 0),
  );
  const [estimatedDividendPerShareCents, setEstimatedDividendPerShareCents] = useState(
    numberToCents(asset.estimated_monthly_dividend_per_share ?? 0),
  );
  const [error, setError] = useState<string | null>(null);

  const isCash = isCashAssetClass(assetClass);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = assetMetadataSchema.safeParse({
      ticker,
      asset_class: assetClass,
      currency,
      accumulated_dividends: accumulatedDividendsCents / 100,
      estimated_monthly_dividend_per_share: estimatedDividendPerShareCents / 100,
      notes: notes.trim() || null,
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    try {
      await updateAsset.mutateAsync({
        id: asset.id,
        patch: {
          ticker: validation.data.ticker,
          asset_class: validation.data.asset_class,
          currency: validation.data.currency,
          accumulated_dividends: validation.data.accumulated_dividends,
          estimated_monthly_dividend_per_share: validation.data.estimated_monthly_dividend_per_share,
          notes: validation.data.notes,
        },
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-asset-ticker" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Código do Ativo (Ticker)
        </label>
        <Input
          id="edit-asset-ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase().trim())}
          placeholder="Ex: WEGE3"
          className="font-mono uppercase font-bold"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Classe de Ativo
          </span>
          <Select
            value={assetClass}
            onValueChange={setAssetClass}
            options={ASSET_CLASSES}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Moeda
          </span>
          <Select
            value={currency}
            onValueChange={(val) => setCurrency(val as AssetCurrency)}
            options={CURRENCIES}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-asset-notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Anotações / Descrição
        </label>
        <Input
          id="edit-asset-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: Tese, setor, corretora..."
        />
      </div>

      {/* Proventos Acumulados — oculto para ativos de caixa */}
      {!isCash && (
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface/50 p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-foreground">
              Proventos Anteriores ao Cadastro (Opcional)
            </span>
            <span className="text-[11px] text-muted-foreground">
              Alimentam o Yield on Cost e a Bola de Neve sem distorcer o extrato mensal nem o calendario.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edit-accumulated-dividends"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Total Acumulado Recebido ({currency})
              </label>
              <MoneyInput
                id="edit-accumulated-dividends"
                cents={accumulatedDividendsCents}
                onCentsChange={setAccumulatedDividendsCents}
                placeholder="R$ 0,00"
                aria-label="Total de proventos acumulados anteriores ao cadastro"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edit-estimated-div-per-share"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Dividendo Estimado / Cota / Mes ({currency})
              </label>
              <MoneyInput
                id="edit-estimated-div-per-share"
                cents={estimatedDividendPerShareCents}
                onCentsChange={setEstimatedDividendPerShareCents}
                placeholder="R$ 0,00"
                aria-label="Dividendo mensal estimado por cota para calculo da Bola de Neve"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/80">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={updateAsset.isPending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={updateAsset.isPending}
        >
          {updateAsset.isPending ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  );
}

export function AssetEditDialog({
  asset,
  open,
  onOpenChange,
}: AssetEditDialogProps) {
  if (!asset) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Editar Ativo"
      description={`Atualize as informações cadastrais de ${asset.ticker}`}
      size="lg"
    >
      <AssetEditFormContent
        key={asset.id}
        asset={asset}
        onClose={() => onOpenChange(false)}
      />
    </Modal>

  );
}
