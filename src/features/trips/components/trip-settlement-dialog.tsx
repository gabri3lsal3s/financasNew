/**
 * Modal de liquidação, cálculo de acertos e fechamento da viagem.
 * Suporta geração de Pix Copia e Cola EMV com valor cravado, exibição de QR Code,
 * liquidação e gravação isolada de cada acerto e gate de finalização pelo organizador.
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
  QrCodeCanvas,
} from "@/components/ui";
import {
  Check,
  Copy,
  Share2,
  ShieldCheck,
  Wallet,
  ArrowRight,
  ArrowDownLeft,
  QrCode,
  Undo2,
  CheckCircle2,
  Lock,
  RotateCcw,
} from "lucide-react";
import { formatCentsAsBRL } from "@/services/masks/money";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getErrorMessage } from "@/services/errors";
import { useAuth } from "@/hooks/use-auth";
import { useCategories, useCreateExpense, useCreateIncome } from "@/state";
import {
  useRecordTripSettlementsMutation,
  useConfirmTripSettlementMutation,
  useRecordSingleTripSettlementMutation,
  useReopenTripSettlementMutation,
  useUpdateTripMutation,
} from "@/state/queries/use-trips";
import { buildTripSettlementWhatsAppMessage } from "@/domain/trips";
import { generatePixBrCode, detectPixKeyType } from "@/domain/pix";
import type {
  SuggestedSettlement,
  TripSettlement,
  TripMember,
  TripExpense,
  TripStatus,
} from "@/types/trips";

export interface TripSettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripTitle: string;
  tripStatus?: TripStatus;
  isHost?: boolean;
  destination?: string | null;
  publicToken?: string;
  suggestedSettlements: readonly SuggestedSettlement[];
  existingSettlements: TripSettlement[];
  members?: TripMember[];
  expenses?: TripExpense[];
}

function buildSettlementPixCode(
  settlement: SuggestedSettlement,
  destination?: string | null,
  tripTitle?: string
): string | null {
  if (!settlement.toPixKey) return null;
  try {
    const rawKey = settlement.toPixKey.trim();
    const detectedType = settlement.toPixKeyType || detectPixKeyType(rawKey);

    const cleanCity = (destination || "BRASIL")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .toUpperCase()
      .trim()
      .slice(0, 15) || "BRASIL";

    const cleanMerchant = (settlement.toMemberName || "Recebedor")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .slice(0, 25);

    const cleanTitle = (tripTitle || "Viagem")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .slice(0, 16);

    const txSuffix = `${settlement.fromMemberId.slice(0, 4)}${settlement.toMemberId.slice(0, 4)}`
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();

    return generatePixBrCode({
      pixKey: rawKey,
      keyType: detectedType === "unknown" ? undefined : detectedType,
      merchantName: cleanMerchant || "Recebedor",
      merchantCity: cleanCity,
      amountCents: settlement.amountCents,
      txId: `TRIP${txSuffix}`.slice(0, 25),
      infoAdicional: `Acerto: ${cleanTitle}`.slice(0, 25),
    });
  } catch {
    return null;
  }
}

export function TripSettlementDialog({
  open,
  onOpenChange,
  tripId,
  tripTitle,
  tripStatus,
  isHost = false,
  destination,
  publicToken,
  suggestedSettlements,
  existingSettlements,
  members,
  expenses,
}: TripSettlementDialogProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);
  const [qrCodeOpenKey, setQrCodeOpenKey] = useState<string | null>(null);
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
  const recordSingleMutation = useRecordSingleTripSettlementMutation(tripId);
  const reopenMutation = useReopenTripSettlementMutation(tripId);
  const updateTripMutation = useUpdateTripMutation();

  const categories = categoriesQuery.data ?? [];
  const defaultCategory =
    categories.find(
      (c) =>
        c.name.toLowerCase().includes("viag") ||
        c.name.toLowerCase().includes("lazer") ||
        c.name.toLowerCase().includes("reemb")
    ) || categories[0];

  const effectiveCategoryId = selectedCategoryId || defaultCategory?.id || "";

  // Progresso dos acertos
  const confirmedCount = suggestedSettlements.filter((s) => {
    const matched = existingSettlements.find(
      (es) => es.from_member_id === s.fromMemberId && es.to_member_id === s.toMemberId
    );
    return matched?.status === "confirmed";
  }).length;

  const totalCount = suggestedSettlements.length;
  const isAllSettled = totalCount > 0 && confirmedCount === totalCount;
  const progressPercent = totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 100;

  const handleCopyPixBrCode = async (code: string, keyIdentifier: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        setCopiedCodeKey(keyIdentifier);
        triggerSensory("action");
        pushToast({
          title: "Pix Copia e Cola com valor copiado!",
          description: "Abra o aplicativo do seu banco para colar e pagar o valor exato.",
        });
        setTimeout(() => setCopiedCodeKey(null), 3000);
      }
    } catch {
      pushToast({
        title: "Erro ao copiar código Pix",
        description: "Selecione e copie manualmente.",
        variant: "destructive",
      });
    }
  };

  const handleCopyRawPixKey = async (pixKey: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pixKey);
        setCopiedKey(pixKey);
        triggerSensory("action");
        pushToast({
          title: "Chave Pix copiada",
          description: "Cole no seu aplicativo bancário para efetuar a transferência.",
        });
        setTimeout(() => setCopiedKey(null), 3000);
      }
    } catch {
      pushToast({
        title: "Erro ao copiar chave",
        variant: "destructive",
      });
    }
  };

  const handleMarkSingleSettled = async (settlement: SuggestedSettlement) => {
    const matched = existingSettlements.find(
      (es) =>
        es.from_member_id === settlement.fromMemberId &&
        es.to_member_id === settlement.toMemberId
    );

    try {
      if (matched) {
        await confirmMutation.mutateAsync(matched.id);
      } else {
        await recordSingleMutation.mutateAsync({
          fromMemberId: settlement.fromMemberId,
          toMemberId: settlement.toMemberId,
          amountCents: settlement.amountCents,
          status: "confirmed",
        });
      }
    } catch {
      // Erro gerenciado na mutation
    }
  };

  const handleReopenSingleSettlement = async (settlementId: string) => {
    try {
      await reopenMutation.mutateAsync(settlementId);
    } catch {
      // Erro gerenciado na mutation
    }
  };

  const handleFinalizeTrip = async () => {
    try {
      await updateTripMutation.mutateAsync({
        tripId,
        input: { status: "completed" },
      });
      triggerSensory("success");
      pushToast({
        title: "Viagem finalizada com sucesso!",
        description: "Todas as contas foram concluídas e o link de compartilhamento foi encerrado.",
      });
    } catch {
      // Erro gerenciado na mutation
    }
  };

  const handleReopenTrip = async () => {
    try {
      await updateTripMutation.mutateAsync({
        tripId,
        input: { status: "active" },
      });
      triggerSensory("success");
      pushToast({
        title: "Viagem reaberta com sucesso!",
        description: "A viagem está ativa novamente para receber novos lançamentos e acertos.",
      });
    } catch {
      // Erro gerenciado na mutation
    }
  };

  /**
   * Fluxo do Devedor: Paga o Pix e registra a saída como Despesa no Extrato Pessoal
   */
  const handlePayAndSyncExpense = async (settlement: SuggestedSettlement) => {
    if (!session?.user) return;
    const key = `${settlement.fromMemberId}-${settlement.toMemberId}`;
    const todayIso = new Date().toISOString().split("T")[0] ?? "";

    try {
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
        await recordSingleMutation.mutateAsync({
          fromMemberId: settlement.fromMemberId,
          toMemberId: settlement.toMemberId,
          amountCents: settlement.amountCents,
          status: "confirmed",
        });
      }

      setSyncedSettlementKeys((prev) => new Set([...prev, key]));
      setPayingSettlementKey(null);
      triggerSensory("success");
      pushToast({
        title: "Acerto pago e registrado no extrato",
        description: `${formatCentsAsBRL(settlement.amountCents)} para ${settlement.toMemberName} lançado no extrato pessoal.`,
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
        report_weight: 0,
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
      // Erro gerenciado no hook
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
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank", "noopener,noreferrer");
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
            className="gap-1.5 text-xs mr-auto cursor-pointer"
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

          {existingSettlements.length === 0 && suggestedSettlements.length > 0 && !isAllSettled && (
            <Button
              type="button"
              variant="outline"
              onClick={handleRecordAll}
              loading={recordMutation.isPending}
              className="text-xs"
            >
              Gravar Todos Pendentes
            </Button>
          )}

          {isAllSettled && isHost && tripStatus !== "completed" && (
            <Button
              type="button"
              variant="default"
              onClick={handleFinalizeTrip}
              loading={updateTripMutation.isPending}
              className="gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Finalizar Viagem
            </Button>
          )}

          {isHost && tripStatus === "completed" && (
            <Button
              type="button"
              variant="outline"
              onClick={handleReopenTrip}
              loading={updateTripMutation.isPending}
              className="gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reabrir Viagem
            </Button>
          )}
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        {/* Barra de Progresso */}
        {totalCount > 0 && (
          <div className="p-3 rounded-xl border border-border/80 bg-surface-raised space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">
                Progresso dos Acertos
              </span>
              <span className="font-bold tabular-nums text-foreground">
                {confirmedCount} de {totalCount} quitados ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-positive transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Banner de Celebração quando todas as contas foram quitadas */}
        {isAllSettled && (
          <div className="p-4 rounded-xl border border-positive/30 bg-positive/10 text-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-positive-strong">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                <span>Todas as contas foram quitadas e equilibradas!</span>
              </div>
              {tripStatus === "completed" && (
                <Badge size="xs" variant="positive" className="gap-1">
                  <Lock className="size-3" aria-hidden="true" />
                  Viagem Finalizada
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-[11px]">
              Nenhum participante possui pendências financeiras nesta viagem.
              {tripStatus === "completed"
                ? " O link de compartilhamento foi encerrado e a viagem está no histórico."
                : isHost
                ? " Como organizador, clique no botão 'Finalizar Viagem' abaixo para encerrar o link e arquivar as contas."
                : " Aguardando o organizador finalizar oficialmente a viagem."}
            </p>
          </div>
        )}

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
              const key = `${s.fromMemberId}-${s.toMemberId}`;
              const isCurrentUserDebtor = currentMember && s.fromMemberId === currentMember.id;
              const isCurrentUserCreditor = currentMember && s.toMemberId === currentMember.id;
              const isSynced = syncedSettlementKeys.has(key);
              const isExpandedPaying = payingSettlementKey === key;
              const isQrOpen = qrCodeOpenKey === key;

              const pixBrCode = buildSettlementPixCode(s, destination, tripTitle);
              const codeToCopy = pixBrCode || s.toPixKey || "";

              return (
                <Card
                  key={`${key}-${idx}`}
                  className={`p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-3 transition-colors ${
                    isConfirmed ? "bg-surface/50 border-positive/30" : ""
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="font-semibold text-foreground flex items-center flex-wrap gap-1">
                      <span>{s.fromMemberName}</span>
                      {isCurrentUserDebtor && (
                        <Badge size="xs" variant="warning" className="ml-1">
                          Você
                        </Badge>
                      )}
                      <ArrowRight className="size-3 text-muted-foreground mx-1" aria-hidden="true" />
                      <span className="text-primary font-bold">{s.toMemberName}</span>
                      {isCurrentUserCreditor && (
                        <Badge size="xs" variant="positive" className="ml-1">
                          Você
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold tabular-nums text-foreground">
                        {formatCentsAsBRL(s.amountCents)}
                      </span>
                      {isConfirmed ? (
                        <Badge size="xs" variant="positive" className="gap-1 font-semibold">
                          <Check className="size-3" aria-hidden="true" />
                          Acertado
                        </Badge>
                      ) : (
                        <Badge size="xs" variant="muted">
                          Pendente
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Informações da Chave Pix & Ações de Cópia / QR Code */}
                  {s.toPixKey && (
                    <div className="bg-surface-raised p-2.5 rounded-xl border border-border/70 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 truncate">
                          <span className="text-[10px] text-muted-foreground block">
                            Chave Pix ({s.toPixKeyType ?? "Pix"}):
                          </span>
                          <span className="font-mono text-[11px] text-foreground truncate block font-medium">
                            {s.toPixKey}
                          </span>
                        </div>

                        {/* Botões de Cópia e QR Code */}
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {/* Copiar Pix Copia e Cola (com valor ou chave) */}
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleCopyPixBrCode(codeToCopy, key)}
                            className="h-7 text-xs gap-1 cursor-pointer font-medium"
                            title="Copiar código Pix com valor cravado"
                          >
                            {copiedCodeKey === key ? (
                              <>
                                <Check className="size-3 text-positive-strong" aria-hidden="true" />
                                <span>Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" aria-hidden="true" />
                                <span>Copiar Pix ({formatCentsAsBRL(s.amountCents)})</span>
                              </>
                            )}
                          </Button>

                          {/* Exibir / Ocultar QR Code */}
                          {pixBrCode && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setQrCodeOpenKey(isQrOpen ? null : key)}
                              className="h-7 text-xs gap-1 cursor-pointer"
                              title="Exibir QR Code Pix"
                            >
                              <QrCode className="size-3" aria-hidden="true" />
                              <span>{isQrOpen ? "Fechar QR" : "QR Code"}</span>
                            </Button>
                          )}

                          {/* Fallback: Copiar apenas a chave pura */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyRawPixKey(s.toPixKey!)}
                            className="h-7 text-[11px] text-muted-foreground cursor-pointer px-2"
                            title="Copiar apenas a chave Pix (sem valor)"
                          >
                            {copiedKey === s.toPixKey ? "Chave copiada" : "Só a chave"}
                          </Button>
                        </div>
                      </div>

                      {/* Bloco de QR Code Expandido */}
                      {isQrOpen && pixBrCode && (
                        <div className="pt-2 border-t border-border/60 flex flex-col items-center gap-2 text-center">
                          <p className="text-[11px] text-muted-foreground">
                            Aponte a câmera do aplicativo bancário para pagar o valor exato de{" "}
                            <strong className="text-foreground">{formatCentsAsBRL(s.amountCents)}</strong>:
                          </p>
                          <div className="p-2 rounded-xl border border-border/80 bg-background/80 shadow-2xs">
                            <QrCodeCanvas
                              text={pixBrCode}
                              size={160}
                              label={`QR Code Pix para ${s.toMemberName}`}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Beneficiário: <span className="font-medium text-foreground">{s.toMemberName}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ação Individual de Liquidação */}
                  <div className="border-t border-border/60 pt-2 flex items-center justify-between gap-2 text-xs">
                    <div>
                      {isConfirmed && matchedExisting && (isCurrentUserCreditor || isHost) && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => handleReopenSingleSettlement(matchedExisting.id)}
                          loading={reopenMutation.isPending}
                          className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
                          title="Reabrir pendência deste acerto"
                        >
                          <Undo2 className="size-3" aria-hidden="true" />
                          <span>Desfazer</span>
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!isConfirmed && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkSingleSettled(s)}
                          loading={recordSingleMutation.isPending || confirmMutation.isPending}
                          className="h-7 text-xs gap-1 border-primary/30 text-primary-strong hover:bg-primary/5 cursor-pointer"
                        >
                          <Check className="size-3" aria-hidden="true" />
                          <span>Marcar como Acertado</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Painel do Devedor: Pagar Pix e Registrar Despesa no Extrato Pessoal */}
                  {isCurrentUserDebtor && !isConfirmed && (
                    <div className="border-t border-border/60 pt-2 space-y-2">
                      {!isExpandedPaying ? (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => setPayingSettlementKey(key)}
                          className="w-full h-8 text-xs gap-1.5 cursor-pointer"
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
                              className="h-6 text-[11px] text-muted-foreground cursor-pointer"
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
                            loading={createExpenseMutation.isPending || recordSingleMutation.isPending}
                            className="w-full h-8 text-xs gap-1.5 cursor-pointer"
                          >
                            <Check className="size-3.5" aria-hidden="true" />
                            Confirmar Pagamento e Lançamento
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Painel do Credor: Registrar Receita de Reembolso no Extrato */}
                  {isCurrentUserCreditor && isConfirmed && session?.user && (
                    <div className="border-t border-border/60 pt-2 flex items-center justify-end">
                      {isSynced ? (
                        <Badge size="xs" variant="positive" className="gap-1 border-positive/30">
                          <Check className="size-3" aria-hidden="true" />
                          Reembolso no Extrato
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSyncToIncome(key, s.amountCents, s.fromMemberName)}
                          loading={createIncomeMutation.isPending}
                          className="h-7 text-xs gap-1 border-primary/30 text-primary-strong hover:bg-primary/5 cursor-pointer"
                          title="Registrar receita de reembolso no extrato pessoal"
                        >
                          <ArrowDownLeft className="size-3" aria-hidden="true" />
                          <span>Registrar Reembolso (+ Extrato)</span>
                        </Button>
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
