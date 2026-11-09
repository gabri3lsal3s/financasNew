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
  Select,
} from "@/components/ui";
import { Check, Copy, Share2, ShieldCheck, Wallet, ArrowRight, ArrowDownLeft } from "lucide-react";
import { formatCentsAsBRL } from "@/services/masks/money";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getErrorMessage } from "@/services/errors";
import { useAuth } from "@/hooks/use-auth";
import { useCategories, useCreateExpense, useCreateIncome } from "@/state";
import {
  useRecordTripSettlementsMutation,
  useConfirmTripSettlementMutation,
} from "@/state/queries/use-trips";
import { buildTripSettlementWhatsAppMessage } from "@/domain/trips";
import type {
  SuggestedSettlement,
  TripSettlement,
  TripMember,
  TripExpense,
} from "@/types/trips";

export interface TripSettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripTitle: string;
  publicToken?: string;
  suggestedSettlements: readonly SuggestedSettlement[];
  existingSettlements: TripSettlement[];
  members?: TripMember[];
  expenses?: TripExpense[];
}

export function TripSettlementDialog({
  open,
  onOpenChange,
  tripId,
  tripTitle,
  publicToken,
  suggestedSettlements,
  existingSettlements,
  members,
  expenses,
}: TripSettlementDialogProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [syncedSettlementKeys, setSyncedSettlementKeys] = useState<Set<string>>(new Set());
  const [payingSettlementKey, setPayingSettlementKey] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const { session } = useAuth();
  const currentUserId = session?.user?.id;
  const currentMember = members?.find((m) => m.user_id && m.user_id === currentUserId);

  const categoriesQuery = useCategories();
  const createIncomeMutation = useCreateIncome();
  const createExpenseMutation = useCreateExpense();
  const recordMutation = useRecordTripSettlementsMutation(tripId);
  const confirmMutation = useConfirmTripSettlementMutation(tripId);

  const categories = categoriesQuery.data ?? [];
  const defaultCategory =
    categories.find(
      (c) =>
        c.name.toLowerCase().includes("viag") ||
        c.name.toLowerCase().includes("lazer") ||
        c.name.toLowerCase().includes("reemb")
    ) || categories[0];

  const effectiveCategoryId = selectedCategoryId || defaultCategory?.id || "";

  const handleCopyPix = (pixKey: string) => {
    navigator.clipboard.writeText(pixKey);
    setCopiedKey(pixKey);
    triggerSensory("action");
    pushToast({
      title: "Chave Pix copiada",
      description: "Cole no seu aplicativo bancario para efetuar a transferencia.",
    });
    setTimeout(() => setCopiedKey(null), 3000);
  };

  /**
   * Fluxo do Devedor: Paga o Pix e registra a saída como Despesa no Extrato Pessoal
   */
  const handlePayAndSyncExpense = async (settlement: SuggestedSettlement) => {
    if (!session?.user) return;
    const key = `${settlement.fromMemberId}-${settlement.toMemberId}`;
    const todayIso = new Date().toISOString().split("T")[0] ?? "";

    try {
      // 1. Registra a despesa de liquidação no extrato pessoal do devedor
      await createExpenseMutation.mutateAsync({
        value: settlement.amountCents / 100,
        date: todayIso,
        categoryId: effectiveCategoryId || categories[0]?.id || "",
        paymentMethod: "pix",
        cardId: null,
        description: `Acerto da viagem ${tripTitle}: pagamento para ${settlement.toMemberName}`,
        reportWeight: 1.0,
        installments: [
          {
            date: todayIso,
            value: settlement.amountCents / 100,
            billCompetence: null,
          },
        ],
        isFamily: false,
      });

      // 2. Grava e confirma o acerto na viagem
      const matched = existingSettlements.find(
        (es) =>
          es.from_member_id === settlement.fromMemberId &&
          es.to_member_id === settlement.toMemberId
      );

      if (matched) {
        if (matched.status !== "confirmed") {
          await confirmMutation.mutateAsync(matched.id);
        }
      } else {
        await recordMutation.mutateAsync([
          {
            from_member_id: settlement.fromMemberId,
            to_member_id: settlement.toMemberId,
            amount_cents: settlement.amountCents,
          },
        ]);
      }

      setSyncedSettlementKeys((prev) => new Set([...prev, key]));
      setPayingSettlementKey(null);
      triggerSensory("success");
      pushToast({
        title: "Acerto pago e registrado no extrato",
        description: `${formatCentsAsBRL(settlement.amountCents)} para ${settlement.toMemberName} lancado no extrato pessoal.`,
      });
    } catch (err) {
      triggerSensory("error");
      pushToast({
        title: "Erro ao registrar acerto no extrato",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  /**
   * Fluxo do Credor: Recebe o Pix e registra a entrada como Reembolso no Extrato Pessoal
   */
  const handleSyncToIncome = async (key: string, amountCents: number, fromName: string) => {
    if (!session?.user) return;
    const cat =
      categories.find(
        (c) =>
          c.name.toLowerCase().includes("reemb") ||
          c.name.toLowerCase().includes("outr") ||
          c.name.toLowerCase().includes("viag")
      ) || categories[0];

    try {
      await createIncomeMutation.mutateAsync({
        value: amountCents / 100,
        date: new Date().toISOString().split("T")[0] ?? "",
        description: `Acerto da viagem ${tripTitle}: reembolso de ${fromName}`,
        category_id: cat?.id ?? "",
        receive_type: "pix",
        report_weight: 0, // Reembolso de despesa nao infla orcamento nem tributacao
        source_ref: null,
      });

      setSyncedSettlementKeys((prev) => new Set([...prev, key]));
      triggerSensory("success");
      pushToast({
        title: "Reembolso registrado no extrato",
        description: `${formatCentsAsBRL(amountCents)} recebido de ${fromName} registrado com sucesso.`,
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

  const handleRecordAll = async () => {
    const payload = suggestedSettlements.map((s) => ({
      from_member_id: s.fromMemberId,
      to_member_id: s.toMemberId,
      amount_cents: s.amountCents,
    }));

    try {
      await recordMutation.mutateAsync(payload);
    } catch {
      // Erro gerenciado no onError do hook
    }
  };

  const handleShareWhatsApp = () => {
    const msg = buildTripSettlementWhatsAppMessage({
      tripTitle,
      suggestedSettlements,
      existingSettlements,
      members,
      expenses,
      publicToken,
    });
    const encoded = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Acerto de Contas da Viagem"
      description="Compensacao otima liquida calculada para equilibrar os gastos do grupo com o menor numero de transferencias."
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
              onClick={handleRecordAll}
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
            description="Todos os gastos foram compensados e ninguem deve nada para ninguem."
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
              const key = `${s.fromMemberId}-${s.toMemberId}`;
              const isCurrentUserDebtor = currentMember && s.fromMemberId === currentMember.id;
              const isCurrentUserCreditor = currentMember && s.toMemberId === currentMember.id;
              const isSynced = syncedSettlementKeys.has(key);
              const isExpandedPaying = payingSettlementKey === key;

              return (
                <Card
                  key={`${key}-${idx}`}
                  className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="font-semibold text-foreground flex items-center flex-wrap gap-1">
                      <span>{s.fromMemberName}</span>
                      {isCurrentUserDebtor && (
                        <Badge size="xs" variant="warning" className="ml-1">
                          Voce
                        </Badge>
                      )}
                      <ArrowRight className="size-3 text-muted-foreground mx-1" aria-hidden="true" />
                      <span className="text-primary font-bold">{s.toMemberName}</span>
                      {isCurrentUserCreditor && (
                        <Badge size="xs" variant="positive" className="ml-1">
                          Voce
                        </Badge>
                      )}
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

                  {/* Informações da Chave Pix */}
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
                              Copiar Pix
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Painel do Devedor: Pagar Pix e Registrar Despesa no Extrato */}
                  {isCurrentUserDebtor && !isConfirmed && (
                    <div className="border-t border-border/60 pt-2.5 space-y-2">
                      {!isExpandedPaying ? (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => setPayingSettlementKey(key)}
                          className="w-full h-8 text-xs gap-1.5"
                        >
                          <Wallet className="size-3.5" aria-hidden="true" />
                          Pagar Pix e Registrar no Meu Extrato
                        </Button>
                      ) : (
                        <div className="bg-surface-raised p-3 rounded-xl border border-border/80 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground">
                              Registrar despesa pessoal no extrato
                            </span>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => setPayingSettlementKey(null)}
                              className="h-6 text-[11px] text-muted-foreground"
                            >
                              Cancelar
                            </Button>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">
                              Categoria no seu extrato
                            </label>
                            <Select
                              value={effectiveCategoryId}
                              onValueChange={setSelectedCategoryId}
                              options={categories.map((c) => ({
                                value: c.id,
                                label: c.name,
                              }))}
                              placeholder="Selecione a categoria"
                            />
                          </div>

                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handlePayAndSyncExpense(s)}
                            loading={createExpenseMutation.isPending || recordMutation.isPending}
                            className="w-full h-8 text-xs gap-1.5"
                          >
                            <Check className="size-3.5" aria-hidden="true" />
                            Confirmar Pagamento e Lançamento
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Painel do Credor: Confirmar Recebimento e Registrar Receita */}
                  {isCurrentUserCreditor && (
                    <div className="border-t border-border/60 pt-2.5 flex items-center justify-end gap-2">
                      {!isConfirmed && matchedExisting && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => confirmMutation.mutate(matchedExisting.id)}
                          loading={confirmMutation.isPending}
                          className="h-7 text-xs"
                        >
                          Confirmar Recebimento
                        </Button>
                      )}

                      {isConfirmed && session?.user && (
                        isSynced ? (
                          <Badge size="xs" variant="positive" className="gap-1 border-positive/30">
                            <Check className="size-3" aria-hidden="true" />
                            Reembolso no Extrato
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleSyncToIncome(
                                key,
                                s.amountCents,
                                s.fromMemberName
                              )
                            }
                            loading={createIncomeMutation.isPending}
                            className="h-7 text-xs gap-1 border-primary/30 text-primary-strong hover:bg-primary/5 cursor-pointer"
                            title="Registrar receita de reembolso no extrato pessoal"
                          >
                            <ArrowDownLeft className="size-3" aria-hidden="true" />
                            <span>Registrar Reembolso (+ Extrato)</span>
                          </Button>
                        )
                      )}
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

