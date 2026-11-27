/**
 * Página de Detalhes da Viagem (/viagens/:id).
 * Visão do organizador e membros autenticados no Axir.
 */

import { useNavigate, useParams } from "react-router";
import { Calendar, MapPin, Receipt, ShieldCheck, Users } from "lucide-react";
import { Badge, Tabs, TripsSkeleton } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { resolveActiveTripMember } from "@/domain/trips";
import { useAuth } from "@/hooks/use-auth";
import { formatDateBR } from "@/lib/date";
import { useTripMode } from "@/state";
import { useTripDetails } from "@/state/queries/use-trips";
import { TripPersonalContextCard } from "../components";
import {
  TripDetailsDialogs,
  TripDetailsHeaderActions,
  TripDetailsModeInactiveView,
  TripDetailsNotFoundView,
  TripExpensesTab,
  TripMembersTab,
  TripSettlementsTab,
  TripSummaryMetrics,
  useTripDetailsState,
} from "../components/details";

export function TripDetailsPage() {
  const { id: tripId } = useParams<{ id: string }>();
  return <TripDetailsPageContent key={tripId ?? "unknown"} tripId={tripId} />;
}

function TripDetailsPageContent({ tripId }: { tripId: string | undefined }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isTripModeEnabled, toggleTripMode, isPending: isTogglingTripMode } = useTripMode();
  const { data, isLoading } = useTripDetails(tripId);
  const state = useTripDetailsState(tripId ?? "");

  if (isLoading) {
    return <TripsSkeleton />;
  }

  if (!isTripModeEnabled) {
    return (
      <TripDetailsModeInactiveView
        isTogglingTripMode={isTogglingTripMode}
        onActivateMode={() => void toggleTripMode(true)}
      />
    );
  }

  if (!data) {
    return <TripDetailsNotFoundView />;
  }

  const {
    trip,
    members,
    expenses,
    settlements,
    balances,
    suggestedSettlements,
    totalExpensesCents,
  } = data;

  const myMember = resolveActiveTripMember(members, user?.id, trip.host_user_id);
  const isHost = Boolean(user && trip.host_user_id === user.id) || Boolean(myMember?.is_host);
  const myBalance = myMember ? (balances.find((b) => b.memberId === myMember.id) ?? null) : null;
  const displayedExpenses =
    state.filterMyExpenses && myMember
      ? expenses.filter((e) => e.paid_by_member_id === myMember.id)
      : expenses;

  const statusLabel =
    trip.status === "completed"
      ? "Finalizada"
      : trip.status === "settling"
        ? "Em Acerto"
        : "Ativa";

  const statusVariant =
    trip.status === "completed"
      ? "positive"
      : trip.status === "settling"
        ? "warning"
        : "muted";

  const tabItems = [
    {
      value: "expenses",
      label: `Despesas (${expenses.length})`,
      icon: <Receipt className="size-4" aria-hidden="true" />,
      content: (
        <TripExpensesTab
          expenses={displayedExpenses}
          members={members}
          isHost={isHost}
          filterMyExpenses={state.filterMyExpenses}
          onClearFilter={() => state.setFilterMyExpenses(false)}
          onOpenRebalance={() => state.setIsRebalanceOpen(true)}
          onOpenAddExpense={() => state.setIsAddExpenseOpen(true)}
          onEditExpense={state.setEditingExpense}
          onDeleteExpense={state.setDeletingExpense}
        />
      ),
    },
    {
      value: "members",
      label: `Participantes (${members.length})`,
      icon: <Users className="size-4" aria-hidden="true" />,
      content: (
        <TripMembersTab
          members={members}
          balances={balances}
          myMember={myMember}
          isHost={isHost}
          onOpenInvite={() => state.setIsInviteOpen(true)}
          onOpenAddMember={() => state.setIsAddMemberOpen(true)}
          onOpenMemberStatement={state.setSelectedMemberForStatement}
          onRequestRemoveMember={state.setMemberToRemove}
        />
      ),
    },
    {
      value: "settlements",
      label: `Acerto (${suggestedSettlements.length})`,
      icon: <ShieldCheck className="size-4" aria-hidden="true" />,
      content: (
        <TripSettlementsTab
          suggestedSettlements={suggestedSettlements}
          onOpenSettlement={() => state.setIsSettlementOpen(true)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/viagens"
        backLabel="Voltar para todas as viagens"
        title={trip.title}
        badge={
          <Badge size="sm" variant={statusVariant}>
            {statusLabel}
          </Badge>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
            {trip.destination ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>{trip.destination}</span>
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>
                {formatDateBR(trip.start_date)} até {formatDateBR(trip.end_date)}
              </span>
            </span>
          </span>
        }
        actions={
          <TripDetailsHeaderActions
            tripStatus={trip.status}
            isHost={isHost}
            hasMember={Boolean(myMember)}
            copiedLink={state.copiedLink}
            onOpenAddExpense={() => state.setIsAddExpenseOpen(true)}
            onOpenSettlement={() => state.setIsSettlementOpen(true)}
            onOpenInvite={() => state.setIsInviteOpen(true)}
            onCopyPublicLink={() => void state.handleCopyPublicLink(trip.public_token)}
            onOpenReopenTrip={() => state.setIsReopenTripOpen(true)}
            onOpenDeleteTrip={() => state.setIsDeleteTripOpen(true)}
            onOpenLeaveTrip={() => state.setIsLeaveTripOpen(true)}
          />
        }
      />

      <TripPersonalContextCard
        trip={trip}
        myMember={myMember}
        myBalance={myBalance}
        isHost={isHost}
        onOpenSettlement={() => state.setIsSettlementOpen(true)}
        onOpenStatement={
          myMember ? () => state.setSelectedMemberForStatement(myMember) : undefined
        }
        isFilterActive={state.filterMyExpenses}
        onToggleFilterMyExpenses={() => state.setFilterMyExpenses((prev) => !prev)}
      />

      <TripSummaryMetrics
        totalExpensesCents={totalExpensesCents}
        expensesCount={expenses.length}
        membersCount={members.length}
        pendingSettlementsCount={suggestedSettlements.length}
      />

      <Tabs
        value={state.activeTab}
        onValueChange={state.setActiveTab}
        items={tabItems}
        variant="underline"
        swipeable
      />

      <TripDetailsDialogs
        trip={trip}
        members={members}
        expenses={expenses}
        settlements={settlements}
        suggestedSettlements={suggestedSettlements}
        myMember={myMember}
        myBalance={myBalance}
        isHost={isHost}
        state={state}
        onNavigateList={() => navigate("/viagens")}
      />
    </div>
  );
}
