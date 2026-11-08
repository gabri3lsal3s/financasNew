/**
 * Modal de liquidação, cálculo de acertos e fechamento da viagem.
 */

import { useState } from "react";
import {
  Modal,
  ModalFooter,
  Button,
  Badge,
  Card,
  EmptyState,
} from "@/components/ui";
import { Check, Copy, Share2, ShieldCheck } from "lucide-react";
import { formatCentsAsBRL } from "@/services/masks/money";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useRecordTripSettlementsMutation,
  useConfirmTripSettlementMutation,
} from "@/state/queries/use-trips";
import type { SuggestedSettlement, TripSettlement } from "@/types/trips";

export interface TripSettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripTitle: string;
  suggestedSettlements: readonly SuggestedSettlement[];
  existingSettlements: TripSettlement[];
}

export function TripSettlementDialog({
  open,
  onOpenChange,
  tripId,
  tripTitle,
  suggestedSettlements,
  existingSettlements,
}: TripSettlementDialogProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const recordMutation = useRecordTripSettlementsMutation(tripId);
  const confirmMutation = useConfirmTripSettlementMutation(tripId);

  const handleCopyPix = (pixKey: string) => {
    navigator.clipboard.writeText(pixKey);
    setCopiedKey(pixKey);
    triggerSensory("success");
    pushToast({
      title: "Chave Pix copiada",
      description: "Cole no seu app bancário para efetuar a transferência.",
    });
    setTimeout(() => setCopiedKey(null), 3000);
  };

  const handleRecord = async () => {
    const payload = suggestedSettlements.map((s) => ({
      from_member_id: s.fromMemberId,
      to_member_id: s.toMemberId,
      amount_cents: s.amountCents,
    }));

    try {
      await recordMutation.mutateAsync(payload);
    } catch {
      // O erro já é tratado e exibido via toast destrutivo no onError do useRecordTripSettlementsMutation
    }
  };

  const handleShareWhatsApp = () => {
    let msg = `*Acerto de Contas da Viagem: ${tripTitle}*\n\n`;
    if (suggestedSettlements.length > 0) {
      suggestedSettlements.forEach((s) => {
        msg += `• ${s.fromMemberName} paga ${formatCentsAsBRL(s.amountCents)} para ${s.toMemberName}`;
        if (s.toPixKey) msg += ` (Chave Pix: ${s.toPixKey})`;
        msg += `\n`;
      });
    } else {
      msg += `Todas as contas estão perfeitamente equilibradas!\n`;
    }
    const encoded = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Acerto de Contas da Viagem"
      description="Compensação ótima líquida calculada para equilibrar os gastos do grupo com o menor número de transferências."
      footer={
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleShareWhatsApp}
            className="gap-1.5 text-xs mr-auto"
          >
            <Share2 className="size-3.5" aria-hidden="true" />
            Compartilhar no WhatsApp
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
          {existingSettlements.length === 0 && suggestedSettlements.length > 0 && (
            <Button
              type="button"
              onClick={handleRecord}
              loading={recordMutation.isPending}
            >
              Gravar Acertos
            </Button>
          )}
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        {suggestedSettlements.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="size-8" />}
            title="Contas 100% equilibradas"
            description="Todos os gastos foram compensados e ninguém deve nada para ninguém."
          />
        ) : (
          <div className="space-y-2.5">
            {suggestedSettlements.map((s, idx) => {
              const matchedExisting = existingSettlements.find(
                (es) =>
                  es.from_member_id === s.fromMemberId &&
                  es.to_member_id === s.toMemberId
              );

              const isConfirmed = matchedExisting?.status === "confirmed";

              return (
                <Card
                  key={`${s.fromMemberId}-${s.toMemberId}-${idx}`}
                  className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="font-semibold text-foreground">
                      <span>{s.fromMemberName}</span>
                      <span className="text-muted-foreground font-normal mx-1.5">
                        transfere para
                      </span>
                      <span className="text-primary font-bold">
                        {s.toMemberName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold tabular-nums text-foreground">
                        {formatCentsAsBRL(s.amountCents)}
                      </span>
                      {isConfirmed && (
                        <Badge size="xs" variant="positive">
                          Pago
                        </Badge>
                      )}
                    </div>
                  </div>

                  {s.toPixKey && (
                    <div className="flex items-center justify-between bg-surface-raised p-2 rounded-lg text-xs">
                      <div className="min-w-0 truncate pr-2">
                        <span className="text-[10px] text-muted-foreground block">
                          Chave Pix ({s.toPixKeyType ?? "Pix"}):
                        </span>
                        <span className="font-mono text-[11px] text-foreground truncate block">
                          {s.toPixKey}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyPix(s.toPixKey!)}
                          className="h-7 text-xs gap-1"
                        >
                          {copiedKey === s.toPixKey ? (
                            <>
                              <Check className="size-3 text-positive" aria-hidden="true" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" aria-hidden="true" />
                              Copiar
                            </>
                          )}
                        </Button>

                        {matchedExisting && !isConfirmed && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => confirmMutation.mutate(matchedExisting.id)}
                            loading={confirmMutation.isPending}
                            className="h-7 text-xs"
                          >
                            Confirmar
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
