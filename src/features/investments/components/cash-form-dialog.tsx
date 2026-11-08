import { useState } from "react";
import { Trash2, Wallet } from "lucide-react";
import { Alert, Button, Checkbox, ConfirmDialog, Input, Modal, ModalFooter, MoneyInput } from "@/components/ui";
import { todayISO } from "@/domain/debts";
import { numberToCents } from "@/domain/money";
import { isCashAssetClass } from "@/domain/portfolio";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useCreatePortfolioAsset,
  useCreatePortfolioContribution,
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
  const [recordAsContribution, setRecordAsContribution] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pending =
    createAsset.isPending ||
    updateAsset.isPending ||
    deleteAsset.isPending ||
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

        if (recordAsContribution && delta > 0) {
          await createContrib.mutateAsync({
            asset_id: existingCash.id,
            date: todayISO(),
            amount: delta,
            notes: notes.trim() !== "" ? `Aporte em Caixa · ${notes.trim()}` : "Aporte em Caixa · Depósito adicional",
          });
        }
        pushToast({ variant: "success", title: "Saldo em caixa atualizado" });
      } else {
        const created = await createAsset.mutateAsync(payload);
        if (recordAsContribution && quantity > 0) {
          await createContrib.mutateAsync({
            asset_id: created.id,
            date: todayISO(),
            amount: quantity,
            notes: notes.trim() !== "" ? `Aporte em Caixa · ${notes.trim()}` : "Aporte inicial · Saldo em Caixa",
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
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
          Saldo Disponível em Caixa (R$)
          <MoneyInput
            cents={balanceCents}
            onCentsChange={setBalanceCents}
            aria-label="Saldo disponível em caixa"
          />
        </label>

        {/* Campo de Observações */}
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
          Anotações <span className="font-normal text-muted-foreground">(opcional)</span>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: Reserva em conta corrente, CDI de liquidez diária…"
            maxLength={100}
            aria-label="Anotações do caixa"
          />
        </label>

        {/* Switch opcional de registro de aporte financeiro externo */}
        {(isEdit ? balanceCents > (existingCash?.quantity ? numberToCents(existingCash.quantity) : 0) : balanceCents > 0) && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-surface-hover/30 p-3">
            <Checkbox
              id="cash-record-external-contribution"
              checked={recordAsContribution}
              onCheckedChange={setRecordAsContribution}
              label="Registrar como Aporte do Bolso (Depósito em Caixa)"
            />
            <p className="pl-6 text-[11px] text-muted-foreground">
              Desligado por padrão (reconciliação contábil pura). Ao ativar, registra um <strong>Aporte em Caixa</strong> nas movimentações e no fluxo do mês (dinheiro novo transferido da sua conta corrente para a corretora).
            </p>
          </div>
        )}

        {/* Rodapé de Ações */}
        <ModalFooter
          destructiveAction={
            isEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
                className="text-critical hover:bg-critical/10 gap-1.5"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Excluir caixa
              </Button>
            ) : null
          }
        >
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
        </ModalFooter>
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
      size="md"
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
