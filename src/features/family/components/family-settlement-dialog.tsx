import { useMemo, useState } from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Button, FormField, Input, Modal, ModalFooter, MoneyText } from "@/components/ui";
import { buildFamilySettlementBreakdown } from "@/domain/calculation-memory/builders/family-breakdown";
import { buildSettlementAuditSnapshot, calculateHouseholdSettlement } from "@/domain/family";
import { useRecordFamilySettlement } from "@/state";
import { copyTextToClipboard } from "@/services/export-actions";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { formatDateBR, monthLabel } from "@/lib/date";
import type { FamilyConsolidationResult, FamilySettlementPaymentMethod } from "@/types";
import { FamilySettlementTransferCard } from "./family-settlement-transfer-card";

export interface FamilySettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consolidation: FamilyConsolidationResult;
  currentUserId?: string;
}

export function FamilySettlementDialog({
  open,
  onOpenChange,
  consolidation,
  currentUserId,
}: FamilySettlementDialogProps) {
  const [notes, setNotes] = useState("");
  const recordSettlement = useRecordFamilySettlement();

  const plan = useMemo(() => {
    return calculateHouseholdSettlement({
      monthly_ceiling_cents: consolidation.monthly_ceiling_cents,
      members: consolidation.members.map((m) => ({
        user_id: m.user_id,
        display_name: m.display_name,
        role: m.role,
        split_ratio: m.split_ratio,
        pix_key: m.pix_key,
        pix_key_type: m.pix_key_type,
      })),
      expenses: consolidation.expenses.map((e) => ({
        id: e.id,
        user_id: e.user_id,
        amount_cents: e.amount_cents,
        date: e.date,
        description: e.description,
        category_id: e.category_id,
        category_name: e.category_name,
        category_icon: e.category_icon,
        category_color: e.category_color,
        created_at: e.created_at,
        is_family: true,
      })),
      options: {
        month: consolidation.month,
        splitRule: consolidation.family.split_rule,
      },
    });
  }, [consolidation]);

  const primaryTransfer = plan.transfers[0] ?? null;

  const settlementBreakdown = useMemo(() => {
    if (!primaryTransfer) return undefined;
    const payer = plan.members.find((m) => m.user_id === primaryTransfer.payer_id);
    if (!payer) return undefined;
    return buildFamilySettlementBreakdown(
      {
        userId: payer.user_id,
        displayName: payer.display_name,
        spentCents: payer.spent_cents,
        fairShareCents: payer.fair_share_cents,
        netBalanceCents: payer.net_balance_cents,
      },
      {
        householdTotalSpentCents: consolidation.total_spent_cents,
        splitRuleDescription:
          consolidation.family.split_rule === "proportional"
            ? "Proporcional à renda declarada"
            : "Divisão 50/50 igualitária",
        periodLabel: monthLabel(consolidation.month),
      },
    );
  }, [primaryTransfer, plan.members, consolidation]);

  const handleCopy = async (text: string, label: string) => {
    const copied = await copyTextToClipboard(text);
    if (copied) {
      triggerSensory("action");
      pushToast({
        title: `${label} copiado!`,
        description: "Cole no aplicativo do seu banco para efetuar a transferência.",
        variant: "default",
      });
    } else {
      triggerSensory("error");
      pushToast({
        title: "Não foi possível copiar automaticamente.",
        description: "Selecione e copie manualmente o texto.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmSettlement = async () => {
    if (!primaryTransfer) return;

    try {
      const snapshot = buildSettlementAuditSnapshot(plan, {
        created_by: currentUserId,
        notes: notes.trim() || undefined,
      });

      await recordSettlement.mutateAsync({
        month: consolidation.month,
        payerId: primaryTransfer.payer_id,
        receiverId: primaryTransfer.receiver_id,
        amount: primaryTransfer.amount,
        familyId: consolidation.family.id,
        paymentMethod: "pix" as FamilySettlementPaymentMethod,
        notes: notes.trim() || null,
        snapshot,
      });

      onOpenChange(false);
      setNotes("");
    } catch {
      // Erro gerenciado pela mutation
    }
  };

  const canRecord = Boolean(
    primaryTransfer && (!consolidation.is_settled || consolidation.has_post_settlement_expenses),
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Acerto de Contas Familiar"
      description={`Compensação e liquidação dos gastos de ${monthLabel(consolidation.month)}.`}
      size="md"
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={recordSettlement.isPending}
          >
            Fechar
          </Button>
          {canRecord ? (
            <Button
              type="button"
              variant="default"
              sensoryIntent={false}
              onClick={handleConfirmSettlement}
              disabled={recordSettlement.isPending}
              loading={recordSettlement.isPending}
            >
              Registrar Acerto Realizado
            </Button>
          ) : null}
        </ModalFooter>
      }
    >
      <div className="space-y-4 py-1">
        {consolidation.settlement && (
          <div className="p-3.5 rounded-xl border border-positive/25 bg-positive/10 space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-positive-strong font-semibold">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
              <span>Acerto registrado para esta competência</span>
            </div>
            <p className="text-foreground">
              {consolidation.settlement.payer_name} compensou{" "}
              {consolidation.settlement.receiver_name} no valor de{" "}
              <MoneyText
                cents={consolidation.settlement.amount_cents}
                tone="positive"
                variant="caption"
                className="font-bold"
              />{" "}
              em {formatDateBR(consolidation.settlement.settled_at.slice(0, 10))}.
            </p>
            {consolidation.settlement.notes && (
              <p className="text-muted-foreground italic">Obs: {consolidation.settlement.notes}</p>
            )}
          </div>
        )}

        {consolidation.has_post_settlement_expenses && (
          <div className="p-3 rounded-xl border border-warning/25 bg-warning/15 space-y-1 text-xs text-warning-strong flex items-start gap-2">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Despesas adicionais pós-fechamento</p>
              <p className="text-muted-foreground">
                Novos lançamentos foram detectados após a última liquidação. A compensação complementar abaixo equilibra a nova diferença.
              </p>
            </div>
          </div>
        )}

        {primaryTransfer ? (
          <FamilySettlementTransferCard
            transfer={primaryTransfer}
            month={consolidation.month}
            onCopy={handleCopy}
            breakdown={settlementBreakdown}
          />
        ) : (
          <div className="p-4 rounded-xl border border-border/80 bg-surface-raised text-center space-y-1">
            <p className="text-xs font-semibold text-foreground">Contas Equilibradas</p>
            <p className="text-xs text-muted-foreground">
              Não há valores pendentes de compensação entre os participantes para este mês.
            </p>
          </div>
        )}

        {canRecord ? (
          <FormField label="Observações do acerto" optional htmlFor="settlement-notes">
            <Input
              id="settlement-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: Transferência realizada via Nubank"
              className="h-10 text-base sm:text-sm"
            />
          </FormField>
        ) : null}
      </div>
    </Modal>
  );
}
