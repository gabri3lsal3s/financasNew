import { useState } from "react";
import { Trash2, Wallet } from "lucide-react";
import { Alert, Button, Checkbox, ConfirmDialog, FormField, Input, Modal, ModalFooter, MoneyInput } from "@/components/ui";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

const CASH_FORM_ID = "cash-form-dialog-form";

function CashFormContent({ asset = null, open, onOpenChange, onClose }: CashFormContentProps) {
  const createAsset = useCreatePortfolioAsset();
  const updateAsset = useUpdatePortfolioAsset();
  const deleteAsset = useDeletePortfolioAsset();
  const createContrib = useCreatePortfolioContribution();
  const allAssetsQuery = usePortfolioAssets();

  const existingCash = asset ?? (allAssetsQuery.data ?? []).find(
    (a) => isCashAssetClass(a.asset_class) || a.ticker.toUpperCase() === "CAIXA",
  );
  const isEdit = existingCash !== undefined && existingCash !== null;

  const [balanceCents, setBalanceCents] = useState<number>(() =>
    existingCash?.quantity !== undefined && existingCash.quantity > 0 ? numberToCents(existingCash.quantity) : 0,
  );
  const [notes, setNotes] = useState<string>(existingCash?.notes ?? "");
  const [recordAsContribution, setRecordAsContribution] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pending = createAsset.isPending || updateAsset.isPending || deleteAsset.isPending || createContrib.isPending;
  const previousCents = existingCash?.quantity ? numberToCents(existingCash.quantity) : 0;
  const showContributionToggle = isEdit ? balanceCents > previousCents : balanceCents > 0;

  const submit = async () => {
    setError(null);
    try {
      const quantity = balanceCents / 100;
      const trimmedNotes = notes.trim();
      const payload = {
        ticker: "CAIXA",
        asset_class: "Caixa",
        currency: "BRL" as const,
        quantity,
        average_price: 1,
        notes: trimmedNotes === "" ? null : trimmedNotes,
      };

      if (isEdit && existingCash) {
        const delta = Math.round((quantity - existingCash.quantity) * 100) / 100;
        await updateAsset.mutateAsync({ id: existingCash.id, patch: payload });
        if (recordAsContribution && delta > 0) {
          await createContrib.mutateAsync({
            asset_id: existingCash.id,
            date: todayISO(),
            amount: delta,
            notes: trimmedNotes ? `Aporte em Caixa · ${trimmedNotes}` : "Aporte em Caixa · Depósito adicional",
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
            notes: trimmedNotes ? `Aporte em Caixa · ${trimmedNotes}` : "Aporte inicial · Saldo em Caixa",
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
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      triggerSensory("error");
    }
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={isEdit ? "Editar Saldo em Caixa" : "Cadastrar Saldo em Caixa"}
        description="Informe o valor disponível em conta ou corretora reservado para oportunidades e novos aportes."
        size="md"
        showCalculator
        footer={
          <ModalFooter
            borderless
            destructiveAction={
              isEdit ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} disabled={pending} className="text-critical-strong hover:bg-critical/10 gap-1.5">
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Excluir caixa
                </Button>
              ) : null
            }
          >
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" form={CASH_FORM_ID} size="sm" disabled={pending} sensoryIntent={false}>
              {pending ? "Salvando..." : isEdit ? "Atualizar saldo" : "Cadastrar caixa"}
            </Button>
          </ModalFooter>
        }
      >
        <form
          id={CASH_FORM_ID}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-3.5 pt-1"
        >
          {error ? <Alert variant="error">{error}</Alert> : null}

          <div className="flex items-center gap-2.5 rounded-xl border border-portfolio/20 bg-portfolio/5 p-3 text-xs text-foreground">
            <Wallet className="size-4 shrink-0 text-portfolio" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="font-semibold text-foreground">Ativo Único de Caixa</span>
              <span className="text-muted-foreground">
                Nome fixo: <strong className="text-foreground">CAIXA</strong> · Paridade 1:1 em BRL para oportunidades e aportes.
              </span>
            </div>
          </div>

          <FormField label="Saldo Disponível em Caixa (R$)" htmlFor="cash-balance-input">
            <MoneyInput id="cash-balance-input" cents={balanceCents} onCentsChange={setBalanceCents} aria-label="Saldo disponível em caixa" className="text-base sm:text-sm" showCalculatorAction />
          </FormField>

          <FormField label="Anotações" htmlFor="cash-notes-input" optional>
            <Input id="cash-notes-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: Reserva em conta corrente, CDI de liquidez diária..." maxLength={100} aria-label="Anotações do caixa" />
          </FormField>

          {showContributionToggle ? (
            <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-surface-hover/30 p-3">
              <Checkbox id="cash-record-external-contribution" checked={recordAsContribution} onCheckedChange={setRecordAsContribution} label="Registrar como Aporte do Bolso (Depósito em Caixa)" />
              <p className="pl-6 text-[11px] text-muted-foreground">
                Desligado por padrão (reconciliação contábil pura). Ao ativar, registra um <strong>Aporte em Caixa</strong> nas movimentações e no fluxo do mês.
              </p>
            </div>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        elevated
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
 */
export function CashFormDialog({ open, onOpenChange, asset = null }: CashFormDialogProps) {
  if (!open) return null;

  return (
    <CashFormContent
      key={asset?.id ?? "cash-dialog"}
      asset={asset}
      open={open}
      onOpenChange={onOpenChange}
      onClose={() => onOpenChange(false)}
    />
  );
}
