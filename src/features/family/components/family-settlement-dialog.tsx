import { useMemo, useState } from "react";
import { CheckCircle2, Copy, QrCode, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { MoneyText } from "@/components/ui/money-text";
import {
  calculateHouseholdSettlement,
  buildSettlementAuditSnapshot,
} from "@/domain/family";
import { useRecordFamilySettlement } from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { formatDateBR } from "@/lib/date";
import type { FamilyConsolidationResult, FamilySettlementPaymentMethod } from "@/types";

export interface FamilySettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consolidation: FamilyConsolidationResult;
  currentUserId?: string;
}

/**
 * Diálogo de Acerto de Contas Familiar e Compensação via Pix (/familia).
 * Apura a compensação exata calculada pelo motor puro, gera o payload Pix Copia e Cola
 * e registra a liquidação auditada com snapshot imutável.
 */
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

  const handleCopy = async (text: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        triggerSensory("action");
        pushToast({
          title: `${label} copiado!`,
          description: "Cole no aplicativo do seu banco para efetuar a transferência.",
          variant: "default",
        });
      } catch {
        pushToast({
          title: "Não foi possível copiar automaticamente.",
          description: "Selecione e copie manualmente o texto.",
          variant: "destructive",
        });
      }
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
      // Erro gerenciado globalmente pelo hook com sensory e toast
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Acerto de Contas Familiar"
      description={`Compensação e liquidação dos gastos de ${consolidation.month}.`}
      size="md"
      footer={
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={recordSettlement.isPending}
          >
            Fechar
          </Button>

          {primaryTransfer && (!consolidation.is_settled || consolidation.has_post_settlement_expenses) ? (
            <Button
              type="button"
              variant="default"
              onClick={handleConfirmSettlement}
              disabled={recordSettlement.isPending}
            >
              {recordSettlement.isPending ? "Registrando..." : "Registrar Acerto Realizado"}
            </Button>
          ) : null}
        </ModalFooter>
      }
    >
      <div className="space-y-4 py-1">
        {/* Histórico do Acerto Existente (se houver) */}
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
                className="font-bold"
              />{" "}
              em {formatDateBR(consolidation.settlement.settled_at.slice(0, 10))}.
            </p>
            {consolidation.settlement.notes && (
              <p className="text-muted-foreground italic">
                Obs: {consolidation.settlement.notes}
              </p>
            )}
          </div>
        )}

        {/* Alerta de Despesas Pós-Acerto */}
        {consolidation.has_post_settlement_expenses && (
          <div className="p-3 rounded-xl border border-warning/25 bg-warning/15 space-y-1 text-xs text-warning-strong flex items-start gap-2">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Despesas adicionais pós-fechamento</p>
              <p className="text-muted-foreground">
                Novos lançamentos foram detectados após a última liquidação. A compensação
                complementar abaixo equilibra a nova diferença.
              </p>
            </div>
          </div>
        )}

        {/* Detalhes da Transferência Proposta */}
        {primaryTransfer ? (
          <div className="p-4 rounded-xl border border-border/80 bg-surface-muted/30 space-y-3.5">
            <div>
              <p className="text-xs font-semibold text-foreground">Proposta de Compensação</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-semibold text-foreground">{primaryTransfer.payer_name}</span>{" "}
                deve transferir para{" "}
                <span className="font-semibold text-foreground">{primaryTransfer.receiver_name}</span>
              </p>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-border/70 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Valor a compensar</span>
              <MoneyText
                cents={primaryTransfer.amount_cents}
                tone="default"
                className="text-lg font-bold text-foreground tabular-nums whitespace-nowrap"
              />
            </div>

            {/* Chave Pix do Recebedor */}
            {primaryTransfer.has_pix && primaryTransfer.pix_key ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Chave Pix de {primaryTransfer.receiver_name}
                  </label>
                  {primaryTransfer.pix_key_type ? (
                    <Badge variant="muted" size="xs">
                      {primaryTransfer.pix_key_type}
                    </Badge>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={primaryTransfer.pix_key}
                    className="font-mono text-xs bg-surface h-9 select-all"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 gap-1.5"
                    onClick={() => handleCopy(primaryTransfer.pix_key!, "Chave Pix")}
                  >
                    <Copy className="size-3.5" aria-hidden="true" />
                    <span>Copiar</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg border border-border/70 bg-surface text-xs text-muted-foreground">
                {primaryTransfer.receiver_name} ainda não cadastrou uma Chave Pix nas configurações
                da família. A transferência pode ser feita por outro canal acordado entre vocês.
              </div>
            )}

            {/* Pix Copia e Cola Payload */}
            {primaryTransfer.pix_payload && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <QrCode className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span>Pix Copia e Cola (BR Code com valor exato)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={primaryTransfer.pix_payload}
                    className="font-mono text-xs bg-surface h-9 select-all truncate text-muted-foreground"
                  />
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-9 shrink-0 gap-1.5"
                    onClick={() => handleCopy(primaryTransfer.pix_payload!, "Código Pix")}
                  >
                    <Copy className="size-3.5" aria-hidden="true" />
                    <span>Copiar Pix</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-border/80 bg-surface-muted/30 text-center space-y-1">
            <p className="text-xs font-semibold text-foreground">Contas Equilibradas</p>
            <p className="text-xs text-muted-foreground">
              Não há valores pendentes de compensação entre os participantes para este mês.
            </p>
          </div>
        )}

        {/* Campo de Anotações Opcionais */}
        {primaryTransfer && (!consolidation.is_settled || consolidation.has_post_settlement_expenses) ? (
          <div className="space-y-1">
            <label htmlFor="settlement-notes" className="text-xs font-semibold text-foreground">
              Observações do acerto <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
            </label>
            <Input
              id="settlement-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: Transferência realizada via Nubank"
              className="h-9 text-xs"
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
