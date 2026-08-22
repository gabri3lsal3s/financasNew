import { useState } from "react";
import { Calculator, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Alert, Button, Checkbox, ConfirmDialog, Input, Modal, MoneyInput, Select } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { calculateWeightedAveragePrice, isCashAssetClass } from "@/domain/portfolio";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { useCreatePortfolioAsset, useDeletePortfolioAsset, useUpdatePortfolioAsset } from "@/state";
import type { AssetCurrency, PortfolioAsset } from "@/types";

export interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ativo em edição — quando informado, o diálogo salva (update) em vez de criar. */
  asset?: PortfolioAsset | null;
}

interface AssetFormContentProps {
  asset?: PortfolioAsset | null;
  onClose: () => void;
}

const CURRENCY_OPTIONS: { value: AssetCurrency; label: string }[] = [
  { value: "BRL", label: "BRL (B3, renda fixa, cripto)" },
  { value: "USD", label: "USD (internacional)" },
];

const ASSET_CLASS_PRESETS = [
  "Ações",
  "FIIs",
  "ETFs",
  "BDRs",
  "Renda Fixa",
  "Cripto",
  "Caixa",
  "Internacional",
];

function AssetFormContent({ asset = null, onClose }: AssetFormContentProps) {
  const createAsset = useCreatePortfolioAsset();
  const updateAsset = useUpdatePortfolioAsset();
  const deleteAsset = useDeletePortfolioAsset();

  const [ticker, setTicker] = useState(asset?.ticker ?? "");
  const [assetClass, setAssetClass] = useState(asset?.asset_class ?? "");
  const [currency, setCurrency] = useState<AssetCurrency>(asset?.currency ?? "BRL");
  const [quantityStr, setQuantityStr] = useState(asset?.quantity !== undefined && asset.quantity > 0 ? String(asset.quantity) : "");
  const [averagePriceCents, setAveragePriceCents] = useState(asset?.average_price !== undefined ? numberToCents(asset.average_price) : 0);
  const [notes, setNotes] = useState(asset?.notes ?? "");

  // Saldo Direto 1:1 (caixa / renda fixa sem cotas)
  const isDirectCash = isCashAssetClass(assetClass);
  const [directBalanceMode, setDirectBalanceMode] = useState(isDirectCash);

  // Helper de novo lote de compras
  const [showLotCalculator, setShowLotCalculator] = useState(false);
  const [newLotQtyStr, setNewLotQtyStr] = useState("");
  const [newLotPriceCents, setNewLotPriceCents] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = asset !== null;
  const pending = createAsset.isPending || updateAsset.isPending || deleteAsset.isPending;

  const parseNumber = (raw: string): number => {
    const clean = raw.replace(/\s+/g, "").replace(",", ".");
    const val = Number(clean);
    return Number.isFinite(val) ? val : 0;
  };

  const parsedQuantity = parseNumber(quantityStr);
  const parsedAvgPrice = directBalanceMode ? 1 : averagePriceCents / 100;

  // Cálculo da prévia do helper de lote
  const parsedNewLotQty = parseNumber(newLotQtyStr);
  const parsedNewLotPrice = newLotPriceCents / 100;
  const lotPreview = calculateWeightedAveragePrice(
    parsedQuantity,
    parsedAvgPrice,
    parsedNewLotQty,
    parsedNewLotPrice,
  );

  const handleApplyLot = () => {
    if (parsedNewLotQty <= 0 || parsedNewLotPrice <= 0) return;
    setQuantityStr(String(lotPreview.newQuantity));
    setAveragePriceCents(Math.round(lotPreview.newAveragePrice * 100));
    setNewLotQtyStr("");
    setNewLotPriceCents(0);
    setShowLotCalculator(false);
    triggerSensory("selection");
  };

  const normalizedTicker = ticker.trim().toUpperCase();
  const canSubmit = normalizedTicker.length > 0 && !pending;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      const payload = {
        ticker: normalizedTicker,
        asset_class: assetClass.trim() === "" ? null : assetClass.trim(),
        currency,
        quantity: directBalanceMode ? parsedQuantity : Math.max(0, parsedQuantity),
        average_price: directBalanceMode ? 1 : Math.max(0, parsedAvgPrice),
        notes: notes.trim() === "" ? null : notes.trim(),
      };
      if (isEdit && asset) {
        await updateAsset.mutateAsync({ id: asset.id, patch: payload });
      } else {
        await createAsset.mutateAsync(payload);
      }
      triggerSensory("success");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const confirmDeleteAsset = async () => {
    if (!asset) return;
    setError(null);
    try {
      await deleteAsset.mutateAsync(asset.id);
      triggerSensory("destructive");
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      setConfirmDelete(false);
      setError(getErrorMessage(err));
    }
  };

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) {
            void submit();
          }
        }}
        className="mt-4 flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Ticker / Código do Ativo
            <Input
              value={ticker}
              onChange={(event) => setTicker(event.target.value)}
              placeholder="PETR4, MXRF11, AAPL, CDB…"
              maxLength={20}
              aria-label="Ticker do ativo"
              autoFocus={!isEdit}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Classe
            <Input
              value={assetClass}
              onChange={(event) => {
                const val = event.target.value;
                setAssetClass(val);
                if (isCashAssetClass(val)) {
                  setDirectBalanceMode(true);
                }
              }}
              placeholder="Ações, FIIs, Renda Fixa, Caixa…"
              maxLength={40}
              aria-label="Classe do ativo"
            />
          </label>
        </div>

        {/* Chips de classes comuns */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Sugestões:</span>
          {ASSET_CLASS_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setAssetClass(preset);
                if (isCashAssetClass(preset)) {
                  setDirectBalanceMode(true);
                }
              }}
              className="rounded-md border border-border/70 bg-surface-hover/50 px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-surface-hover"
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Moeda de Negociação
            <Select
              value={currency}
              onValueChange={(value) => setCurrency(value as AssetCurrency)}
              options={CURRENCY_OPTIONS}
              ariaLabel="Moeda do ativo"
            />
          </label>

          <div className="flex flex-col justify-end pb-1">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
              <Checkbox
                checked={directBalanceMode}
                onCheckedChange={(checked) => setDirectBalanceMode(Boolean(checked))}
              />
              <span>Modo Saldo Direto 1:1 (Renda Fixa / Caixa)</span>
            </label>
          </div>
        </div>

        {/* Campos de Posição Consolidada */}
        <div className="rounded-xl border border-border/80 bg-surface-hover/20 p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Posição Atual de Custódia</span>
            {isEdit && !directBalanceMode && (
              <button
                type="button"
                onClick={() => setShowLotCalculator(!showLotCalculator)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                <Calculator className="size-3.5" aria-hidden="true" />
                <span>{showLotCalculator ? "Ocultar calculadora de lote" : "Adicionar novo lote de compra"}</span>
                {showLotCalculator ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {directBalanceMode ? "Saldo Total Investido (R$)" : "Quantidade Atual (Cotas / Unidades)"}
              <Input
                value={quantityStr}
                onChange={(e) => setQuantityStr(e.target.value)}
                placeholder={directBalanceMode ? "10000,00" : "100"}
                inputMode="decimal"
                aria-label="Quantidade ou saldo"
              />
            </label>

            {!directBalanceMode ? (
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Preço Médio por Cota ({currency})
                <MoneyInput
                  cents={averagePriceCents}
                  onCentsChange={setAveragePriceCents}
                  aria-label="Preço médio por cota"
                />
              </label>
            ) : null}
          </div>

          {/* Helper / Calculadora de Novo Lote de Compras */}
          {showLotCalculator && !directBalanceMode && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex flex-col gap-2.5 mt-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" aria-hidden="true" />
                <span>Calculadora de Novo Preço Médio Ponderado</span>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                  Novas Cotas Adquiridas
                  <Input
                    value={newLotQtyStr}
                    onChange={(e) => setNewLotQtyStr(e.target.value)}
                    placeholder="Ex: 50"
                    inputMode="decimal"
                    className="h-8 text-xs"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                  Preço Unitário Pago ({currency})
                  <MoneyInput
                    cents={newLotPriceCents}
                    onCentsChange={setNewLotPriceCents}
                    className="h-8 text-xs"
                  />
                </label>
              </div>

              {parsedNewLotQty > 0 && parsedNewLotPrice > 0 ? (
                <div className="flex items-center justify-between rounded-md bg-background/80 px-2.5 py-1.5 text-xs">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Resultado após aporte:</span>
                    <span className="font-semibold text-foreground">
                      {lotPreview.newQuantity} cotas com Preço Médio de {currency} {lotPreview.newAveragePrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </span>
                  </div>
                  <Button type="button" size="sm" onClick={handleApplyLot} className="h-7 text-xs">
                    Aplicar
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Notas / Observações (opcional)
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Corretora, estratégia, tese…"
            maxLength={100}
            aria-label="Notas do ativo"
          />
        </label>

        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
          {isEdit ? (
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pending} className="text-negative-strong hover:text-negative-strong">
              Excluir ativo
            </Button>
          ) : (
            <span />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Adicionar à carteira"}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Excluir ${asset?.ticker ?? "ativo"}?`}
        description="O ativo e suas metas de alocação serão removidos da carteira."
        confirmLabel="Excluir"
        variant="destructive"
        confirmPending={deleteAsset.isPending}
        onConfirm={() => void confirmDeleteAsset()}
      />
    </>
  );
}

/**
 * Cadastro e edição de ativo da carteira em 1 único passo (Posição Consolidada §F36).
 */
export function AssetFormDialog({ open, onOpenChange, asset = null }: AssetFormDialogProps) {
  const isEdit = asset !== null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Editar ${asset?.ticker}` : "Adicionar ativo à carteira"}
      description={
        isEdit
          ? "Atualize o ticker, classe, quantidade de cotas ou preço médio da sua custódia."
          : "Cadastre o ticker, classe e sua posição atual de custódia (quantidade e preço médio)."
      }
    >
      {open ? (
        <AssetFormContent
          key={asset?.id ?? "new-asset"}
          asset={asset}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}
