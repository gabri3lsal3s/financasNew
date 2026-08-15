import { useState } from "react";
import { Alert, Button, ConfirmDialog, Input, Modal, Select } from "@/components/ui";
import { getVisualCustomization } from "@/hooks/use-visual-customization";
import { playSound } from "@/services/audio-fx";
import { getErrorMessage } from "@/services/errors";
import { triggerHaptic } from "@/services/haptics";
import { useCreatePortfolioAsset, useDeletePortfolioAsset, useUpdatePortfolioAsset } from "@/state";
import type { AssetCurrency, PortfolioAsset } from "@/types";

export interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ativo em edição — quando informado, o diálogo salva (update) em vez de criar. */
  asset?: PortfolioAsset | null;
}

const CURRENCY_OPTIONS: { value: AssetCurrency; label: string }[] = [
  { value: "BRL", label: "BRL (B3, renda fixa, cripto)" },
  { value: "USD", label: "USD (internacional)" },
];

/**
 * Cadastro/edição de ativo da carteira (§3.11) — ticker, classe e moeda.
 * Com `asset`, opera em modo edição (update + exclusão com confirmação);
 * sem `asset`, cria um ativo novo. Feedback uniforme (F15): haptic + áudio.
 */
export function AssetFormDialog({ open, onOpenChange, asset = null }: AssetFormDialogProps) {
  const createAsset = useCreatePortfolioAsset();
  const updateAsset = useUpdatePortfolioAsset();
  const deleteAsset = useDeletePortfolioAsset();
  // Estado inicial derivado das props (lazy) + re-sincronização a cada
  // abertura via "ajuste de estado durante render" (padrão oficial React —
  // evita setState em effect, exigência das regras do React Compiler).
  const [ticker, setTicker] = useState(() => asset?.ticker ?? "");
  const [assetClass, setAssetClass] = useState(() => asset?.asset_class ?? "");
  const [currency, setCurrency] = useState<AssetCurrency>(() => asset?.currency ?? "BRL");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTicker(asset?.ticker ?? "");
      setAssetClass(asset?.asset_class ?? "");
      setCurrency(asset?.currency ?? "BRL");
      setError(null);
    }
  }

  const isEdit = asset !== null;
  const pending = createAsset.isPending || updateAsset.isPending || deleteAsset.isPending;

  const openDialog = (next: boolean) => {
    onOpenChange(next);
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
      };
      if (isEdit && asset) {
        await updateAsset.mutateAsync({ id: asset.id, patch: payload });
      } else {
        await createAsset.mutateAsync(payload);
      }
      triggerHaptic("success");
      playSound("success", getVisualCustomization().soundEnabled);
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const confirmDeleteAsset = async () => {
    if (!asset) return;
    setError(null);
    try {
      await deleteAsset.mutateAsync(asset.id);
      triggerHaptic("warning");
      playSound("delete", getVisualCustomization().soundEnabled);
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (err) {
      setConfirmDelete(false);
      setError(getErrorMessage(err));
    }
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={openDialog}
        title={isEdit ? "Editar ativo" : "Adicionar ativo"}
        description={
          isEdit
            ? "Atualize o ticker, a classe ou a moeda. O ledger e a posição são recalculados automaticamente."
            : "Registre o ticker e a classe (ex.: Ações, FIIs, RF, caixa)."
        }
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

          <div className="flex items-center justify-between gap-2">
            {isEdit ? (
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pending}>
                Excluir ativo
              </Button>
            ) : (
              <span />
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
                {pending ? "Salvando…" : isEdit ? "Salvar" : "Adicionar"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

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
