import { useState } from "react";
import { Alert, Button, Checkbox, ConfirmDialog, Input, Modal, ModalFooter, MoneyInput, Select } from "@/components/ui";
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
import type { DbInsert, PortfolioContribution } from "@/types";

export interface ContributionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contribution?: PortfolioContribution | null;
  defaultAssetId?: string | null;
  onSuccess?: () => void;
}

interface ContributionFormContentProps {
  contribution?: PortfolioContribution | null;
  defaultAssetId?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ContributionFormContent({
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
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    contribution?.asset_id ?? defaultAssetId ?? cashAsset?.id ?? "none",
  );
  const [notes, setNotes] = useState(contribution?.notes ?? "");
  const [syncCashDelta, setSyncCashDelta] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pending =
    createContrib.isPending || updateContrib.isPending || deleteContrib.isPending || updateAsset.isPending;

  const canSubmit = !pending && date !== "" && amountCents > 0;

  const assetOptions = [
    { value: "none", label: "Aporte Geral (Sem ativo específico)" },
    ...allAssets.map((a) => ({
      value: a.id,
      label: `${a.ticker} (${a.asset_class})`,
    })),
  ];

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      const amount = amountCents / 100;
      const effectiveAssetId = selectedAssetId === "none" ? null : selectedAssetId;
      const targetIsCash =
        cashAsset && effectiveAssetId === cashAsset.id;

      if (isEdit && contribution) {
        const prevAmount = contribution.amount;
        const delta = Math.round((amount - prevAmount) * 100) / 100;

        await updateContrib.mutateAsync({
          id: contribution.id,
          input: {
            date,
            amount,
            asset_id: effectiveAssetId,
            notes: notes.trim() === "" ? null : notes.trim(),
          },
        });

        // Se o aporte for em Caixa e o usuário mantiver syncCashDelta, ajusta o saldo do Caixa pelo delta
        if (targetIsCash && syncCashDelta && delta !== 0 && cashAsset) {
          const currentCashBalance = Number(cashAsset.quantity ?? 0);
          const newCashBalance = Math.max(0, Math.round((currentCashBalance + delta) * 100) / 100);
          await updateAsset.mutateAsync({
            id: cashAsset.id,
            patch: {
              quantity: newCashBalance,
              average_price: 1,
            },
          });
        }

        pushToast({
          title: "Aporte atualizado",
          description: "O lançamento e os saldos foram recalculados com sucesso.",
          variant: "success",
        });
      } else {
        const payload: Omit<DbInsert<PortfolioContribution>, "user_id"> = {
          date,
          amount,
          asset_id: effectiveAssetId,
          notes: notes.trim() === "" ? null : notes.trim(),
        };

        await createContrib.mutateAsync(payload);

        // Se criou aporte direto em Caixa, incrementa o saldo de Caixa
        if (targetIsCash && syncCashDelta && cashAsset) {
          const currentCashBalance = Number(cashAsset.quantity ?? 0);
          await updateAsset.mutateAsync({
            id: cashAsset.id,
            patch: {
              quantity: Math.round((currentCashBalance + amount) * 100) / 100,
              average_price: 1,
            },
          });
        }

        pushToast({
          title: "Aporte registrado",
          description: "O aporte financeiro foi adicionado à carteira.",
          variant: "success",
        });
      }

      triggerSensory("success");
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      triggerSensory("destructive");
    }
  };

  const confirmDeleteContrib = async () => {
    if (!contribution) return;
    setError(null);
    try {
      await deleteContrib.mutateAsync(contribution);

      // Se era aporte em Caixa e pediu estorno, subtrai o valor do saldo do Caixa
      const targetIsCash = cashAsset && contribution.asset_id === cashAsset.id;
      if (targetIsCash && syncCashDelta && cashAsset) {
        const currentCashBalance = Number(cashAsset.quantity ?? 0);
        const newCashBalance = Math.max(0, Math.round((currentCashBalance - contribution.amount) * 100) / 100);
        await updateAsset.mutateAsync({
          id: cashAsset.id,
          patch: {
            quantity: newCashBalance,
            average_price: 1,
          },
        });
      }

      triggerSensory("destructive");
      pushToast({
        title: "Aporte excluído",
        description: "O lançamento de aporte foi removido da carteira.",
        variant: "info",
      });
      setConfirmDelete(false);
      onSuccess?.();
      onClose();
    } catch (err) {
      setConfirmDelete(false);
      setError(getErrorMessage(err));
    }
  };

  const isCashTarget = cashAsset && selectedAssetId === cashAsset.id;

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) {
            void submit();
          }
        }}
        className="mt-4 flex flex-col gap-3.5"
      >
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
          Data do aporte
          <DatePicker value={date} onValueChange={setDate} ariaLabel="Data do aporte" />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
          Valor do aporte (R$)
          <MoneyInput
            cents={amountCents}
            onCentsChange={setAmountCents}
            placeholder="R$ 0,00"
            aria-label="Valor do aporte"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
          Destino / Ativo vinculado
          <Select
            value={selectedAssetId}
            onValueChange={setSelectedAssetId}
            options={assetOptions}
            ariaLabel="Destino do aporte"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
          Observações / Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: Depósito em conta, Aporte mensal..."
            maxLength={120}
            aria-label="Observações do aporte"
          />
        </label>

        {isCashTarget && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-portfolio/20 bg-portfolio/5 p-3 text-xs">
            <Checkbox
              checked={syncCashDelta}
              onCheckedChange={(checked) => setSyncCashDelta(Boolean(checked))}
              label="Ajustar saldo do Ativo Caixa proporcionalmente"
            />
            <p className="text-[11px] text-muted-foreground pl-6">
              {isEdit
                ? "Se o valor for alterado, o saldo do Caixa receberá o ajuste da diferença."
                : "O saldo do seu Ativo Caixa será incrementado com o valor deste aporte."}
            </p>
          </div>
        )}

        {error ? <Alert variant="error">{error}</Alert> : null}

        <ModalFooter
          destructiveAction={
            isEdit ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
                className="text-critical-strong hover:bg-critical/10"
              >
                Excluir aporte
              </Button>
            ) : undefined
          }
        >
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {pending ? "Salvando…" : isEdit ? "Salvar" : "Registrar Aporte"}
          </Button>
        </ModalFooter>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
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

export function ContributionFormDialog({
  open,
  onOpenChange,
  contribution = null,
  defaultAssetId = null,
  onSuccess,
}: ContributionFormDialogProps) {
  const isEdit = contribution !== null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar Aporte Financeiro" : "Novo Aporte Financeiro"}
      description="Gerencie os recursos externos injetados na carteira que compõem o fluxo do mês e o custo de aquisição do bolso."
      size="md"
      showCalculator
    >
      {open ? (
        <ContributionFormContent
          key={contribution?.id ?? "new-contribution"}
          contribution={contribution}
          defaultAssetId={defaultAssetId}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      ) : null}
    </Modal>
  );
}
