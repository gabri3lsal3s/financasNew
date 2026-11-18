import { useState } from "react";
import { Alert, Button, Checkbox, ConfirmDialog, FormField, Input, Modal, ModalFooter, MoneyInput, Select } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { todayISO } from "@/domain/debts";
import { numberToCents } from "@/domain/money";
import { isCashAssetClass } from "@/domain/portfolio";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useCreatePortfolioContribution,
  useDeletePortfolioContribution,
  usePortfolioAssets,
  useUpdatePortfolioAsset,
  useUpdatePortfolioContribution,
} from "@/state";
import type { PortfolioContribution } from "@/types";

export interface ContributionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contribution?: PortfolioContribution | null;
  defaultAssetId?: string | null;
  onSuccess?: () => void;
}

interface ContributionFormContentProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  contribution?: PortfolioContribution | null;
  defaultAssetId?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const FORM_ID = "contribution-form-dialog-form";

export function ContributionFormContent({
  open = true,
  onOpenChange,
  contribution = null,
  defaultAssetId = null,
  onClose,
  onSuccess,
}: ContributionFormContentProps) {
  const createContrib = useCreatePortfolioContribution();
  const updateContrib = useUpdatePortfolioContribution();
  const deleteContrib = useDeletePortfolioContribution();
  const updateAsset = useUpdatePortfolioAsset();
  const assetsQuery = usePortfolioAssets();

  const allAssets = assetsQuery.data ?? [];
  const cashAsset = allAssets.find((a) => a.ticker.toUpperCase() === "CAIXA" || isCashAssetClass(a.asset_class));
  const isEdit = contribution !== null;

  const [date, setDate] = useState(contribution?.date ?? todayISO());
  const [amountCents, setAmountCents] = useState(contribution ? numberToCents(contribution.amount) : 0);
  const [selectedAssetId, setSelectedAssetId] = useState<string>(contribution?.asset_id ?? defaultAssetId ?? cashAsset?.id ?? "none");
  const [notes, setNotes] = useState(contribution?.notes ?? "");
  const [syncCashDelta, setSyncCashDelta] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pending = createContrib.isPending || updateContrib.isPending || deleteContrib.isPending || updateAsset.isPending;
  const canSubmit = !pending && date !== "" && amountCents > 0;
  const assetOptions = [
    { value: "none", label: "Aporte Geral (Sem ativo específico)" },
    ...allAssets.map((a) => ({ value: a.id, label: `${a.ticker} (${a.asset_class})` })),
  ];

  const adjustCashBalance = async (delta: number) => {
    if (!cashAsset || !syncCashDelta || delta === 0) return;
    const nextBalance = Math.max(0, Math.round((Number(cashAsset.quantity ?? 0) + delta) * 100) / 100);
    await updateAsset.mutateAsync({ id: cashAsset.id, patch: { quantity: nextBalance, average_price: 1 } });
  };

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      const amount = amountCents / 100;
      const effectiveAssetId = selectedAssetId === "none" ? null : selectedAssetId;
      const isCashTarget = Boolean(cashAsset && effectiveAssetId === cashAsset.id);
      const trimmedNotes = notes.trim() === "" ? null : notes.trim();

      if (isEdit && contribution) {
        await updateContrib.mutateAsync({ id: contribution.id, input: { date, amount, asset_id: effectiveAssetId, notes: trimmedNotes } });
        if (isCashTarget) await adjustCashBalance(Math.round((amount - contribution.amount) * 100) / 100);
        pushToast({ title: "Aporte atualizado", description: "O lançamento e os saldos foram recalculados com sucesso.", variant: "success" });
      } else {
        await createContrib.mutateAsync({ date, amount, asset_id: effectiveAssetId, notes: trimmedNotes });
        if (isCashTarget) await adjustCashBalance(amount);
        pushToast({ title: "Aporte registrado", description: "O aporte financeiro foi adicionado à carteira.", variant: "success" });
      }

      triggerSensory("success");
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      triggerSensory("error");
    }
  };

  const confirmDeleteContrib = async () => {
    if (!contribution) return;
    setError(null);
    try {
      await deleteContrib.mutateAsync(contribution);
      if (cashAsset && contribution.asset_id === cashAsset.id) await adjustCashBalance(-contribution.amount);
      pushToast({ title: "Aporte excluído", description: "O lançamento de aporte foi removido da carteira.", variant: "info" });
      setConfirmDelete(false);
      onSuccess?.();
      onClose();
    } catch (err) {
      setConfirmDelete(false);
      setError(getErrorMessage(err));
      triggerSensory("error");
    }
  };

  const isCashTarget = Boolean(cashAsset && selectedAssetId === cashAsset.id);

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(next) => (onOpenChange ? onOpenChange(next) : !next && onClose())}
        title={isEdit ? "Editar Aporte Financeiro" : "Novo Aporte Financeiro"}
        description="Gerencie os recursos externos injetados na carteira que compõem o fluxo do mês e o custo de aquisição do bolso."
        size="md"
        showCalculator
        footer={
          <ModalFooter
            borderless
            destructiveAction={
              isEdit ? (
                <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pending} className="text-critical-strong hover:bg-critical/10">
                  Excluir aporte
                </Button>
              ) : undefined
            }
          >
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
            <Button type="submit" form={FORM_ID} disabled={!canSubmit} sensoryIntent={false}>
              {pending ? "Salvando..." : isEdit ? "Salvar" : "Registrar Aporte"}
            </Button>
          </ModalFooter>
        }
      >
        <form id={FORM_ID} onSubmit={(e) => { e.preventDefault(); if (canSubmit) void submit(); }} className="flex flex-col gap-3.5 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField label="Data do aporte" htmlFor="contribution-date">
              <DatePicker id="contribution-date" value={date} onValueChange={setDate} ariaLabel="Data do aporte" />
            </FormField>
            <FormField label="Valor do aporte (R$)" htmlFor="contribution-amount">
              <MoneyInput id="contribution-amount" cents={amountCents} onCentsChange={setAmountCents} placeholder="R$ 0,00" aria-label="Valor do aporte" className="text-base sm:text-sm" showCalculatorAction />
            </FormField>
          </div>

          <FormField label="Destino / Ativo vinculado" htmlFor="contribution-asset">
            <Select id="contribution-asset" value={selectedAssetId} onValueChange={setSelectedAssetId} options={assetOptions} ariaLabel="Destino do aporte" />
          </FormField>

          <FormField label="Observações / Descrição" htmlFor="contribution-notes" optional>
            <Input id="contribution-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: Depósito em conta, Aporte mensal..." maxLength={120} aria-label="Observações do aporte" />
          </FormField>

          {isCashTarget ? (
            <div className="flex flex-col gap-1.5 rounded-xl border border-portfolio/20 bg-portfolio/5 p-3 text-xs">
              <Checkbox checked={syncCashDelta} onCheckedChange={(c) => setSyncCashDelta(Boolean(c))} label="Ajustar saldo do Ativo Caixa proporcionalmente" />
              <p className="text-[11px] text-muted-foreground pl-6">
                {isEdit ? "Se o valor for alterado, o saldo do Caixa receberá o ajuste da diferença." : "O saldo do seu Ativo Caixa será incrementado com o valor deste aporte."}
              </p>
            </div>
          ) : null}

          {error ? <Alert variant="error">{error}</Alert> : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        elevated
        title="Excluir lançamento de aporte?"
        description="O registro de aporte financeiro será removido permanentemente e as estatísticas do mês recalculadas."
        confirmLabel="Excluir aporte"
        variant="destructive"
        confirmPending={deleteContrib.isPending}
        onConfirm={() => void confirmDeleteContrib()}
      />
    </>
  );
}

export function ContributionFormDialog({ open, onOpenChange, contribution = null, defaultAssetId = null, onSuccess }: ContributionFormDialogProps) {
  if (!open) return null;
  return (
    <ContributionFormContent
      key={contribution?.id ?? "new-contribution"}
      open={open}
      onOpenChange={onOpenChange}
      contribution={contribution}
      defaultAssetId={defaultAssetId}
      onClose={() => onOpenChange(false)}
      onSuccess={onSuccess}
    />
  );
}
