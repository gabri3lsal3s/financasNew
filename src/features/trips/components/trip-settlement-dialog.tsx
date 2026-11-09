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
import { Check, Copy, Share2, ShieldCheck, Wallet } from "lucide-react";
import { formatCentsAsBRL } from "@/services/masks/money";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getPublicAppUrl } from "@/services/app-url";
import { getErrorMessage } from "@/services/errors";
import { useAuth } from "@/hooks/use-auth";
import { useCategories, useCreateIncome } from "@/state";
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
  publicToken?: string;
  suggestedSettlements: readonly SuggestedSettlement[];
  existingSettlements: TripSettlement[];
}

export function TripSettlementDialog({
  open,
  onOpenChange,
  tripId,
  tripTitle,
  publicToken,
  suggestedSettlements,
  existingSettlements,
}: TripSettlementDialogProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [syncedSettlementKeys, setSyncedSettlementKeys] = useState<Set<string>>(new Set());

  const { session } = useAuth();
  const categoriesQuery = useCategories();
  const createIncomeMutation = useCreateIncome();
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

  const handleSyncToIncome = async (key: string, amountCents: number, fromName: string) => {
    if (!session?.user) return;
    const cat =
      (categoriesQuery.data ?? []).find(
        (c) =>
          c.name.toLowerCase().includes("reemb") ||
          c.name.toLowerCase().includes("outr") ||
          c.name.toLowerCase().includes("viag")
      ) || (categoriesQuery.data ?? [])[0];

    try {
      await createIncomeMutation.mutateAsync({
        value: amountCents / 100,
        date: new Date().toISOString().split("T")[0] ?? "",
        description: `Acerto da viagem ${tripTitle} (${fromName})`,
        category_id: cat?.id ?? "",
        receive_type: "pix",
        report_weight: 1,
        source_ref: null,
      });

      setSyncedSettlementKeys((prev) => new Set([...prev, key]));
      triggerSensory("success");
      pushToast({
        title: "Receita registrada no extrato",
        description: `${formatCentsAsBRL(amountCents)} recebido de ${fromName} lançado como entrada Pix.`,
      });
    } catch (err) {
      triggerSensory("error");
      pushToast({
        title: "Erro ao registrar no extrato",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
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
    if (publicToken) {
      msg += `\nVer extrato completo: ${getPublicAppUrl(`viagem/${publicToken}`)}\n`;
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
                      {isConfirmed ? (
                        <div className="flex items-center gap-1.5">
                          <Badge size="xs" variant="positive">
                            Pago
                          </Badge>
                          {session?.user && (
                            syncedSettlementKeys.has(`${s.fromMemberId}-${s.toMemberId}`) ? (
                              <Badge size="xs" variant="positive" className="gap-1 border-positive/30">
                                <Check className="size-3" aria-hidden="true" />
                                Extrato
                              </Badge>
                            ) : (
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() =>
                                  handleSyncToIncome(
                                    `${s.fromMemberId}-${s.toMemberId}`,
                                    s.amountCents,
                                    s.fromMemberName
                                  )
                                }
                                loading={createIncomeMutation.isPending}
                                className="h-6 px-1.5 text-[10px] gap-1 border-primary/30 text-primary-strong hover:bg-primary/5 cursor-pointer"
                                title="Registrar entrada no extrato bancário"
                              >
                                <Wallet className="size-3" aria-hidden="true" />
                                <span>+ Extrato</span>
                              </Button>
                            )
                          )}
                        </div>
                      ) : null}
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
