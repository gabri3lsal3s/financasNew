import { ConfirmDialog } from "@/components/ui";
import type {
  SuggestedSettlement,
  Trip,
  TripExpense,
  TripMember,
  TripMemberBalance,
  TripSettlement,
} from "@/types/trips";
import {
  AddTripExpenseDialog,
  AddTripMemberDialog,
  EditTripExpenseDialog,
  InviteTripMemberDialog,
  LeaveTripDialog,
  RebalanceTripSplitsDialog,
  ReopenTripDialog,
  TripDeleteDialog,
  TripExpenseDeleteDialog,
  TripMemberStatementDialog,
  TripSettlementDialog,
} from "../index";
import type { TripDetailsState } from "./use-trip-details-state";

export interface TripDetailsDialogsProps {
  trip: Trip;
  members: TripMember[];
  expenses: TripExpense[];
  settlements: TripSettlement[];
  suggestedSettlements: readonly SuggestedSettlement[];
  myMember: TripMember | null;
  myBalance: TripMemberBalance | null;
  isHost: boolean;
  state: TripDetailsState;
  onNavigateList: () => void;
}

export function TripDetailsDialogs({
  trip,
  members,
  expenses,
  settlements,
  suggestedSettlements,
  myMember,
  myBalance,
  isHost,
  state,
  onNavigateList,
}: TripDetailsDialogsProps) {
  return (
    <>
      <AddTripExpenseDialog
        open={state.isAddExpenseOpen}
        onOpenChange={state.setIsAddExpenseOpen}
        tripId={trip.id}
        members={members}
      />

      <EditTripExpenseDialog
        open={Boolean(state.editingExpense)}
        onOpenChange={(open) => !open && state.setEditingExpense(null)}
        tripId={trip.id}
        expense={state.editingExpense}
        members={members}
      />

      <AddTripMemberDialog
        open={state.isAddMemberOpen}
        onOpenChange={state.setIsAddMemberOpen}
        tripId={trip.id}
      />

      <TripSettlementDialog
        open={state.isSettlementOpen}
        onOpenChange={state.setIsSettlementOpen}
        tripId={trip.id}
        tripTitle={trip.title}
        tripStatus={trip.status}
        isHost={isHost}
        destination={trip.destination}
        publicToken={trip.public_token}
        suggestedSettlements={suggestedSettlements}
        existingSettlements={settlements}
        members={members}
        expenses={expenses}
      />

      <InviteTripMemberDialog
        open={state.isInviteOpen}
        onOpenChange={state.setIsInviteOpen}
        tripId={trip.id}
        tripTitle={trip.title}
        destination={trip.destination}
        publicToken={trip.public_token}
        isCompleted={trip.status === "completed"}
        onOpenAddDirectMember={() => state.setIsAddMemberOpen(true)}
      />

      <TripMemberStatementDialog
        open={Boolean(state.selectedMemberForStatement)}
        onOpenChange={(open) => !open && state.setSelectedMemberForStatement(null)}
        member={state.selectedMemberForStatement}
        members={members}
        expenses={expenses}
      />

      <RebalanceTripSplitsDialog
        open={state.isRebalanceOpen}
        onOpenChange={state.setIsRebalanceOpen}
        tripId={trip.id}
        membersCount={members.length}
      />

      <TripExpenseDeleteDialog
        open={Boolean(state.deletingExpense)}
        onOpenChange={(open) => !open && state.setDeletingExpense(null)}
        tripId={trip.id}
        expense={state.deletingExpense}
      />

      <TripDeleteDialog
        open={state.isDeleteTripOpen}
        onOpenChange={state.setIsDeleteTripOpen}
        trip={trip}
        onSuccess={onNavigateList}
      />

      <ReopenTripDialog
        open={state.isReopenTripOpen}
        onOpenChange={state.setIsReopenTripOpen}
        trip={trip}
      />

      <LeaveTripDialog
        open={state.isLeaveTripOpen}
        onOpenChange={state.setIsLeaveTripOpen}
        trip={trip}
        myMember={myMember}
        myBalance={myBalance}
        onSuccess={onNavigateList}
      />

      <ConfirmDialog
        open={Boolean(state.memberToRemove)}
        onOpenChange={(open) => !open && state.setMemberToRemove(null)}
        title="Remover participante?"
        description={
          state.memberToRemove
            ? `Tem certeza de que deseja remover ${state.memberToRemove.name} desta viagem?`
            : undefined
        }
        confirmLabel="Remover participante"
        cancelLabel="Voltar"
        variant="destructive"
        confirmPending={state.removeMemberPending}
        onConfirm={state.handleConfirmRemoveMember}
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          O participante perderá o vínculo com o grupo. Despesas em que ele já participou poderão exigir revisão no rateio.
        </p>
      </ConfirmDialog>
    </>
  );
}
