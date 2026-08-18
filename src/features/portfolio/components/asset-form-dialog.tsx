import { useState } from "react";
import { Alert, Button, ConfirmDialog, Input, Modal, Select } from "@/components/ui";
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

function AssetFormContent({ asset = null, onClose }: AssetFormContentProps) {
  const createAsset = useCreatePortfolioAsset();
  const updateAsset = useUpdatePortfolioAsset();
  const deleteAsset = useDeletePortfolioAsset();

  const [ticker, setTicker] = useState(asset?.ticker ?? "");
  const [assetClass, setAssetClass] = useState(asset?.asset_class ?? "");
  const [currency, setCurrency] = useState<AssetCurrency>(asset?.currency ?? "BRL");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = asset !== null;
  const pending = createAsset.isPending || updateAsset.isPending || deleteAsset.isPending;

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
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Ticker
          <Input
            value={ticker}
            onChange={(event) => setTicker(event.target.value)}
            placeholder="PETR4, BOVA11, AAPL…"
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

        <div className="flex items-center justify-between gap-2">
          {isEdit ? (
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pending}>
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
              {pending ? "Salvando…" : isEdit ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Excluir ${asset?.ticker ?? "ativo"}?`}
        description="O ativo, suas transações e metas de alocação serão removidos em cascata. A posição é recalculada automaticamente."
        confirmLabel="Excluir"
        variant="destructive"
        confirmPending={deleteAsset.isPending}
        onConfirm={() => void confirmDeleteAsset()}
      />
    </>
  );
}

/**
 * Cadastro/edição de ativo da carteira (§3.11) — ticker, classe e moeda.
 * Com `asset`, opera em modo edição (update + exclusão com confirmação);
 * sem `asset`, cria um ativo novo. Feedback uniforme (F15): haptic + áudio.
 */
export function AssetFormDialog({ open, onOpenChange, asset = null }: AssetFormDialogProps) {
  const isEdit = asset !== null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar ativo" : "Adicionar ativo"}
      description={
        isEdit
          ? "Atualize o ticker, a classe ou a moeda. O ledger e a posição são recalculados automaticamente."
          : "Registre o ticker e a classe (ex.: Ações, FIIs, RF, caixa)."
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
