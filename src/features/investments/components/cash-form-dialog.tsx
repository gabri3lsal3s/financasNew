import { useState } from "react";
import { Trash2, Wallet } from "lucide-react";
import { Alert, Button, ConfirmDialog, Input, Modal, MoneyInput } from "@/components/ui";
import { todayISO } from "@/domain/debts";
import { numberToCents } from "@/domain/money";
import { isCashAssetClass } from "@/domain/portfolio";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useCreatePortfolioAsset,
  useCreatePortfolioContribution,
  useCreatePortfolioTransaction,
  useDeletePortfolioAsset,
  usePortfolioAssets,
  useUpdatePortfolioAsset,
} from "@/state";
import type { PortfolioAsset } from "@/types";

export interface CashFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ativo de caixa em edição — quando nulo, cadastra o único ativo de caixa da carteira. */
  asset?: PortfolioAsset | null;
}

interface CashFormContentProps {
  asset?: PortfolioAsset | null;
  onClose: () => void;
}

function CashFormContent({ asset = null, onClose }: CashFormContentProps) {
  const createAsset = useCreatePortfolioAsset();
  const updateAsset = useUpdatePortfolioAsset();
  const deleteAsset = useDeletePortfolioAsset();
  const createTx = useCreatePortfolioTransaction();
  const createContrib = useCreatePortfolioContribution();
  const allAssetsQuery = usePortfolioAssets();

  // Localiza caixa existente caso o usuário tenha aberto sem passar o asset
  const existingCash = asset ?? (allAssetsQuery.data ?? []).find(
    (a) => isCashAssetClass(a.asset_class) || a.ticker.toUpperCase() === "CAIXA",
  );
  const isEdit = existingCash !== undefined && existingCash !== null;

  const [balanceCents, setBalanceCents] = useState<number>(() => {
    if (existingCash?.quantity !== undefined && existingCash.quantity > 0) {
      return numberToCents(existingCash.quantity);
    }
    return 0;
  });
  const [notes, setNotes] = useState<string>(existingCash?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pending =
    createAsset.isPending ||
    updateAsset.isPending ||
    deleteAsset.isPending ||
    createTx.isPending ||
    createContrib.isPending;

  const submit = async () => {
    setError(null);
    try {
      const quantity = balanceCents / 100;
      const payload = {
        ticker: "CAIXA",
        asset_class: "Caixa",
        currency: "BRL" as const,
        quantity,
        average_price: 1,
        notes: notes.trim() === "" ? null : notes.trim(),
      };

      if (isEdit && existingCash) {
        const delta = Math.round((quantity - existingCash.quantity) * 100) / 100;
        await updateAsset.mutateAsync({ id: existingCash.id, patch: payload });
        if (delta > 0) {
          await createTx.mutateAsync({
            asset_id: existingCash.id,
            type: "buy",
            date: todayISO(),
            quantity: delta,
            price: 1,
            total: delta,
          });
          await createContrib.mutateAsync({
            asset_id: existingCash.id,
            date: todayISO(),
            amount: delta,
            notes: "Aporte em Caixa · Depósito adicional",
          });
        } else if (delta < 0) {
          const absDelta = Math.abs(delta);
          await createTx.mutateAsync({
            asset_id: existingCash.id,
            type: "sell",
            date: todayISO(),
            quantity: absDelta,
            price: 1,
            total: absDelta,
          });
        }
        pushToast({ variant: "success", title: "Saldo em caixa atualizado" });
      } else {
        const created = await createAsset.mutateAsync(payload);
        if (quantity > 0) {
          await createTx.mutateAsync({
            asset_id: created.id,
            type: "buy",
            date: todayISO(),
            quantity,
            price: 1,
            total: quantity,
          });
          await createContrib.mutateAsync({
            asset_id: created.id,
            date: todayISO(),
            amount: quantity,
            notes: "Aporte inicial · Saldo em Caixa",
          });
        }
        pushToast({ variant: "success", title: "Saldo em caixa cadastrado" });
      }

      triggerSensory("success");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      triggerSensory("error");
    }
  };

  const confirmDeleteAsset = async () => {
    if (!existingCash) return;
    try {
      await deleteAsset.mutateAsync(existingCash.id);
      pushToast({ variant: "success", title: "Ativo de caixa removido" });
      triggerSensory("success");
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      triggerSensory("error");
    }
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="mt-4 flex flex-col gap-4"
      >
        {error ? <Alert variant="error">{error}</Alert> : null}

        {/* Informação contextual de regra de Caixa */}
        <div className="flex items-center gap-2.5 rounded-xl border border-portfolio/20 bg-portfolio/5 p-3 text-xs text-foreground">
          <Wallet className="size-4 shrink-0 text-portfolio" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">Ativo Único de Caixa</span>
            <span className="text-muted-foreground">
              Nome fixo: <strong className="text-foreground">CAIXA</strong> · Paridade 1:1 em BRL para oportunidades e aportes.
            </span>
          </div>
        </div>

        {/* Campo de Saldo Disponível */}
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Saldo Disponível em Caixa (R$)
          <MoneyInput
            cents={balanceCents}
            onCentsChange={setBalanceCents}
            aria-label="Saldo disponível em caixa"
          />
        </label>

        {/* Campo de Observações */}
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Anotações (opcional)
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: Reserva em conta corrente, CDI de liquidez diária…"
            maxLength={100}
            aria-label="Anotações do caixa"
          />
        </label>

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border mt-2">
          {isEdit ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
              className="gap-1.5"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Excluir caixa
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={pending}
            >
              {pending ? "Salvando…" : isEdit ? "Atualizar saldo" : "Cadastrar caixa"}
            </Button>
          </div>
        </div>
      </form>

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir ativo de caixa?"
        description="O ativo de caixa será removido da carteira e a posição será recalculada."
        confirmLabel="Excluir"
        variant="destructive"
        confirmPending={deleteAsset.isPending}
        onConfirm={() => void confirmDeleteAsset()}
      />
    </>
  );
}

/**
 * Diálogo especializado para cadastro e ajuste do único ativo de Caixa da carteira (§F38/F40).
 * Garante paridade 1:1, identificação padronizada ("CAIXA") e impede duplicidade.
 */
export function CashFormDialog({ open, onOpenChange, asset = null }: CashFormDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={asset ? "Editar Saldo em Caixa" : "Cadastrar Saldo em Caixa"}
      description="Informe o valor disponível em conta ou corretora reservado para oportunidades e novos aportes."
      showCalculator
    >
      {open ? (
        <CashFormContent
          key={asset?.id ?? "cash-dialog"}
          asset={asset}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}
