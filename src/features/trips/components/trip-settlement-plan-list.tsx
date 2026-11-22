import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { buildTripSettlementBreakdown } from "@/domain/calculation-memory/builders/trips-breakdown";
import type { Category } from "@/types";
import type { SuggestedSettlement, TripMember, TripMemberBalance, TripSettlement } from "@/types/trips";
import { TripSettlementRowCard } from "./trip-settlement-row-card";

export interface TripSettlementPlanListProps {
  suggestedSettlements: readonly SuggestedSettlement[];
  existingSettlements: TripSettlement[];
  memberBalances?: readonly TripMemberBalance[];
  totalTripExpensesCents?: number;
  currentMember?: TripMember;
  hasSessionUser: boolean;
  isHost: boolean;
  destination?: string | null;
  tripTitle: string;
  categories: Category[];
  effectiveCategoryId: string;
  onCategoryChange: (id: string) => void;
  copiedKey: string | null;
  copiedCodeKey: string | null;
  qrCodeOpenKey: string | null;
  onToggleQr: (key: string) => void;
  syncedSettlementKeys: Set<string>;
  payingSettlementKey: string | null;
  onPayingSettlementKeyChange: (key: string | null) => void;
  confirmOrRecordSinglePending: boolean;
  reopenMutationPending: boolean;
  createExpensePending: boolean;
  createIncomePending: boolean;
  onCopyPixBrCode: (code: string, keyIdentifier: string) => void;
  onCopyRawPixKey: (pixKey: string) => void;
  onMarkSingleSettled: (settlement: SuggestedSettlement) => void;
  onReopenSingleSettlement: (settlementId: string) => void;
  onPayAndSyncExpense: (settlement: SuggestedSettlement) => void;
  onSyncToIncome: (key: string, amountCents: number, fromName: string) => void;
}

export function TripSettlementPlanList({
  suggestedSettlements,
  existingSettlements,
  memberBalances,
  totalTripExpensesCents,
  currentMember,
  hasSessionUser,
  isHost,
  destination,
  tripTitle,
  categories,
  effectiveCategoryId,
  onCategoryChange,
  copiedKey,
  copiedCodeKey,
  qrCodeOpenKey,
  onToggleQr,
  syncedSettlementKeys,
  payingSettlementKey,
  onPayingSettlementKeyChange,
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
}: TripSettlementPlanListProps) {
  if (suggestedSettlements.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck className="size-6" aria-hidden="true" />}
        title="Contas 100% equilibradas"
        description="Todos os gastos foram compensados e ninguém deve nada para ninguém."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {suggestedSettlements.map((s, idx) => {
        const matchedExisting = existingSettlements.find(
          (es) => es.from_member_id === s.fromMemberId && es.to_member_id === s.toMemberId,
        );
        const key = `${s.fromMemberId}-${s.toMemberId}`;
        const memberBalance = memberBalances?.find((b) => b.memberId === s.fromMemberId);
        const breakdown = memberBalance
          ? buildTripSettlementBreakdown(memberBalance, {
              tripTitle,
              totalTripExpensesCents,
            })
          : undefined;

        return (
          <TripSettlementRowCard
            key={`${key}-${idx}`}
            settlement={s}
            settlementKey={key}
            matchedExisting={matchedExisting}
            breakdown={breakdown}
            isDebtor={Boolean(currentMember && s.fromMemberId === currentMember.id)}
            isCreditor={Boolean(currentMember && s.toMemberId === currentMember.id)}
            isHost={isHost}
            hasSessionUser={hasSessionUser}
            destination={destination}
            tripTitle={tripTitle}
            categories={categories}
            effectiveCategoryId={effectiveCategoryId}
            onCategoryChange={onCategoryChange}
            copiedKey={copiedKey}
            copiedCodeKey={copiedCodeKey}
            isQrOpen={qrCodeOpenKey === key}
            onToggleQr={() => onToggleQr(key)}
            isSynced={syncedSettlementKeys.has(key)}
            isExpandedPaying={payingSettlementKey === key}
            onExpandPayingChange={(expanded) => onPayingSettlementKeyChange(expanded ? key : null)}
            confirmOrRecordSinglePending={confirmOrRecordSinglePending}
            reopenMutationPending={reopenMutationPending}
            createExpensePending={createExpensePending}
            createIncomePending={createIncomePending}
            onCopyPixBrCode={onCopyPixBrCode}
            onCopyRawPixKey={onCopyRawPixKey}
            onMarkSingleSettled={() => onMarkSingleSettled(s)}
            onReopenSingleSettlement={onReopenSingleSettlement}
            onPayAndSyncExpense={() => onPayAndSyncExpense(s)}
            onSyncToIncome={() => onSyncToIncome(key, s.amountCents, s.fromMemberName)}
          />
        );
      })}
    </div>
  );
}
