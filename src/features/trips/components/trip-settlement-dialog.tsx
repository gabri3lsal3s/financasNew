import { useState } from "react";
import { CheckCircle2, History, Lock, RotateCcw, Scale, Share2 } from "lucide-react";
import { Badge, Button, Modal, ModalFooter, Progress, Tabs } from "@/components/ui";
import type {
  SuggestedSettlement,
  TripExpense,
  TripMember,
  TripSettlement,
  TripStatus,
} from "@/types/trips";
import { TripSettlementHistoryTab } from "./trip-settlement-history-tab";
import { TripSettlementPlanList } from "./trip-settlement-plan-list";
import { useTripSettlementActions } from "./use-trip-settlement-actions";

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
  const [activeTab, setActiveTab] = useState("plan");
  const actions = useTripSettlementActions({
    tripId,
    tripTitle,
    publicToken,
    suggestedSettlements,
    existingSettlements,
    members,
    expenses,
  });

  const confirmedCount = suggestedSettlements.filter((s) => {
    const matched = existingSettlements.find(
      (es) => es.from_member_id === s.fromMemberId && es.to_member_id === s.toMemberId,
    );
    return matched?.status === "confirmed";
  }).length;

  const totalCount = suggestedSettlements.length;
  const isAllSettled = totalCount > 0 && confirmedCount === totalCount;
  const progressPercent = totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 100;

  const compactSecondaryActions = (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={actions.handleShareWhatsApp}
        title="Compartilhar no WhatsApp"
        aria-label="Compartilhar no WhatsApp"
        className="!w-9 !min-w-9 h-9 sm:!w-8 sm:!min-w-8 sm:h-8 p-0 shrink-0"
      >
        <Share2 className="size-4 text-positive-strong" aria-hidden="true" />
        <span className="sr-only">Compartilhar no WhatsApp</span>
      </Button>
      {existingSettlements.length === 0 && suggestedSettlements.length > 0 && !isAllSettled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          sensoryIntent={false}
          onClick={actions.handleRecordAll}
          loading={actions.recordMutationPending}
          className="text-xs"
        >
          Gravar Pendentes
        </Button>
      )}
    </div>
  );

  const planContent = (
    <div className="space-y-4">
      {totalCount > 0 && (
        <div className="p-3 rounded-xl border border-border/80 bg-surface-raised space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">Progresso dos Acertos</span>
            <span className="font-bold tabular-nums text-foreground">
              {confirmedCount} de {totalCount} quitados ({progressPercent}%)
            </span>
          </div>
          <Progress value={progressPercent} tone="positive" className="h-1.5" aria-label="Progresso dos acertos" />
        </div>
      )}

      {isAllSettled && (
        <div className="p-4 rounded-xl border border-positive/30 bg-positive/10 text-xs space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
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

      <TripSettlementPlanList
        suggestedSettlements={suggestedSettlements}
        existingSettlements={existingSettlements}
        currentMember={actions.currentMember}
        hasSessionUser={Boolean(actions.session?.user)}
        isHost={isHost}
        destination={destination}
        tripTitle={tripTitle}
        categories={actions.categories}
        effectiveCategoryId={actions.effectiveCategoryId}
        onCategoryChange={actions.setSelectedCategoryId}
        copiedKey={actions.copiedKey}
        copiedCodeKey={actions.copiedCodeKey}
        qrCodeOpenKey={actions.qrCodeOpenKey}
        onToggleQr={(key) => actions.setQrCodeOpenKey(actions.qrCodeOpenKey === key ? null : key)}
        syncedSettlementKeys={actions.syncedSettlementKeys}
        payingSettlementKey={actions.payingSettlementKey}
        onPayingSettlementKeyChange={actions.setPayingSettlementKey}
        confirmOrRecordSinglePending={actions.confirmOrRecordSinglePending}
        reopenMutationPending={actions.reopenMutationPending}
        createExpensePending={actions.createExpensePending}
        createIncomePending={actions.createIncomePending}
        onCopyPixBrCode={actions.handleCopyPixBrCode}
        onCopyRawPixKey={actions.handleCopyRawPixKey}
        onMarkSingleSettled={actions.handleMarkSingleSettled}
        onReopenSingleSettlement={actions.handleReopenSingleSettlement}
        onPayAndSyncExpense={actions.handlePayAndSyncExpense}
        onSyncToIncome={actions.handleSyncToIncome}
      />
    </div>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Acerto de Contas da Viagem"
      description="Compensação ótima líquida calculada para equilibrar os gastos do grupo com o menor número de transferências."
      footer={
        <ModalFooter borderless destructiveAction={compactSecondaryActions}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {isAllSettled && isHost && tripStatus !== "completed" && (
            <Button
              type="button"
              variant="default"
              sensoryIntent={false}
              onClick={actions.handleFinalizeTrip}
              loading={actions.updateTripMutationPending}
              className="gap-1.5 font-semibold"
            >
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              <span>Finalizar Viagem</span>
            </Button>
          )}
          {isHost && tripStatus === "completed" && (
            <Button
              type="button"
              variant="outline"
              sensoryIntent={false}
              onClick={actions.handleReopenTrip}
              loading={actions.updateTripMutationPending}
              className="gap-1.5 font-semibold"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span>Reabrir Viagem</span>
            </Button>
          )}
        </ModalFooter>
      }
    >
      {existingSettlements.length > 0 ? (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          fullWidth
          items={[
            { value: "plan", label: "Plano de Acertos", icon: <Scale className="size-4" />, content: planContent },
            {
              value: "history",
              label: `Histórico (${existingSettlements.length})`,
              icon: <History className="size-4" />,
              content: <TripSettlementHistoryTab settlements={existingSettlements} members={members} />,
            },
          ]}
        />
      ) : (
        planContent
      )}
    </Modal>
  );
}
