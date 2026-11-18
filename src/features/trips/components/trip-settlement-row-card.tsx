import { ArrowDownLeft, ArrowRight, Check, Undo2, Wallet } from "lucide-react";
import { Badge, Button, Card, MoneyText, Select } from "@/components/ui";
import type { Category } from "@/types";
import type { SuggestedSettlement, TripSettlement } from "@/types/trips";
import { TripPixPaymentPanel } from "./trip-pix-payment-panel";

export interface TripSettlementRowCardProps {
  settlement: SuggestedSettlement;
  settlementKey: string;
  matchedExisting?: TripSettlement;
  isDebtor: boolean;
  isCreditor: boolean;
  isHost: boolean;
  hasSessionUser: boolean;
  destination?: string | null;
  tripTitle: string;
  categories: Category[];
  effectiveCategoryId: string;
  onCategoryChange: (id: string) => void;
  copiedKey: string | null;
  copiedCodeKey: string | null;
  isQrOpen: boolean;
  onToggleQr: () => void;
  isSynced: boolean;
  isExpandedPaying: boolean;
  onExpandPayingChange: (expanded: boolean) => void;
  confirmOrRecordSinglePending: boolean;
  reopenMutationPending: boolean;
  createExpensePending: boolean;
  createIncomePending: boolean;
  onCopyPixBrCode: (code: string, keyIdentifier: string) => void;
  onCopyRawPixKey: (pixKey: string) => void;
  onMarkSingleSettled: () => void;
  onReopenSingleSettlement: (settlementId: string) => void;
  onPayAndSyncExpense: () => void;
  onSyncToIncome: () => void;
}

export function TripSettlementRowCard({
  settlement: s,
  settlementKey: key,
  matchedExisting,
  isDebtor,
  isCreditor,
  isHost,
  hasSessionUser,
  destination,
  tripTitle,
  categories,
  effectiveCategoryId,
  onCategoryChange,
  copiedKey,
  copiedCodeKey,
  isQrOpen,
  onToggleQr,
  isSynced,
  isExpandedPaying,
  onExpandPayingChange,
  confirmOrRecordSinglePending,
  reopenMutationPending,
  createExpensePending,
  createIncomePending,
  onCopyPixBrCode,
  onCopyRawPixKey,
  onMarkSingleSettled,
  onReopenSingleSettlement,
  onPayAndSyncExpense,
  onSyncToIncome,
}: TripSettlementRowCardProps) {
  const isConfirmed = matchedExisting?.status === "confirmed";

  return (
    <Card
      className={`p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-3 transition-colors ${
        isConfirmed ? "bg-surface/50 border-positive/30" : ""
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="font-semibold text-foreground flex items-center flex-wrap gap-1">
          <span>{s.fromMemberName}</span>
          {isDebtor && <Badge size="xs" variant="warning" className="ml-1">Você</Badge>}
          <ArrowRight className="size-3 text-muted-foreground mx-1" aria-hidden="true" />
          <span className="text-primary-strong font-bold">{s.toMemberName}</span>
          {isCreditor && <Badge size="xs" variant="positive" className="ml-1">Você</Badge>}
        </div>

        <div className="flex items-center gap-2">
          <MoneyText cents={s.amountCents} tone="default" className="font-bold" />
          {isConfirmed ? (
            <Badge size="xs" variant="positive" className="gap-1 font-semibold">
              <Check className="size-3" aria-hidden="true" />
              Acertado
            </Badge>
          ) : (
            <Badge size="xs" variant="muted">Pendente</Badge>
          )}
        </div>
      </div>

      <TripPixPaymentPanel
        settlement={s}
        settlementKey={key}
        destination={destination}
        tripTitle={tripTitle}
        copiedKey={copiedKey}
        copiedCodeKey={copiedCodeKey}
        isQrOpen={isQrOpen}
        onToggleQr={onToggleQr}
        onCopyPixBrCode={onCopyPixBrCode}
        onCopyRawPixKey={onCopyRawPixKey}
      />

      <div className="border-t border-border/80 pt-2 flex items-center justify-between gap-2 text-xs">
        <div>
          {isConfirmed && matchedExisting && (isCreditor || isHost) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              sensoryIntent={false}
              onClick={() => onReopenSingleSettlement(matchedExisting.id)}
              loading={reopenMutationPending}
              className="text-muted-foreground hover:text-foreground gap-1"
              title="Reabrir pendência deste acerto"
            >
              <Undo2 className="size-3.5" aria-hidden="true" />
              <span>Desfazer</span>
            </Button>
          )}
        </div>

        {!isConfirmed && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            sensoryIntent={false}
            onClick={onMarkSingleSettled}
            loading={confirmOrRecordSinglePending}
            className="gap-1 border-primary/30 text-primary-strong hover:bg-primary/5"
          >
            <Check className="size-3.5" aria-hidden="true" />
            <span>Marcar como Acertado</span>
          </Button>
        )}
      </div>

      {isDebtor && !isConfirmed && (
        <div className="border-t border-border/80 pt-2 space-y-2">
          {!isExpandedPaying ? (
            <Button type="button" size="sm" variant="default" onClick={() => onExpandPayingChange(true)} className="w-full gap-1.5">
              <Wallet className="size-3.5" aria-hidden="true" />
              <span>Pagar Pix e Registrar no Meu Extrato</span>
            </Button>
          ) : (
            <div className="bg-surface-raised p-3 rounded-xl border border-border/80 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">Registrar despesa pessoal no extrato</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => onExpandPayingChange(false)} className="text-muted-foreground">
                  Cancelar
                </Button>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Categoria no seu extrato</label>
                <Select
                  value={effectiveCategoryId}
                  onValueChange={onCategoryChange}
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  placeholder="Selecione a categoria"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="default"
                sensoryIntent={false}
                onClick={onPayAndSyncExpense}
                loading={createExpensePending}
                className="w-full gap-1.5"
              >
                <Check className="size-3.5" aria-hidden="true" />
                <span>Confirmar Pagamento e Lançamento</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {isCreditor && isConfirmed && hasSessionUser && (
        <div className="border-t border-border/80 pt-2 flex items-center justify-end">
          {isSynced ? (
            <Badge size="xs" variant="positive" className="gap-1 border-positive/30">
              <Check className="size-3" aria-hidden="true" />
              Reembolso no Extrato
            </Badge>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              sensoryIntent={false}
              onClick={onSyncToIncome}
              loading={createIncomePending}
              className="gap-1 border-primary/30 text-primary-strong hover:bg-primary/5"
              title="Registrar receita de reembolso no extrato pessoal"
            >
              <ArrowDownLeft className="size-3.5" aria-hidden="true" />
              <span>Registrar Reembolso (+ Extrato)</span>
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
