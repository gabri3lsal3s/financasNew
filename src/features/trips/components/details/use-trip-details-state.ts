import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { useRemoveTripMemberMutation } from "@/state/queries/use-trips";
import { getPublicAppUrl } from "@/services/app-url";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { TripExpense, TripMember } from "@/types/trips";

export type TripDetailsTabKey = "expenses" | "members" | "settlements";

function parseTripTabParam(raw: string | null): TripDetailsTabKey | null {
  if (raw === "expenses" || raw === "members" || raw === "settlements") {
    return raw;
  }
  return null;
}

export function useTripDetailsState(tripId: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickedTab, setPickedTab] = useState<string>("expenses");
  const paramTab = parseTripTabParam(searchParams.get("tab"));
  const highlightMemberId = searchParams.get("member");
  const activeTab = paramTab ?? (highlightMemberId ? "settlements" : pickedTab);

  const setActiveTab = useCallback(
    (next: string) => {
      setPickedTab(next);
      if (searchParams.has("tab") || searchParams.has("member")) {
        setSearchParams(
          (prev) => {
            const updated = new URLSearchParams(prev);
            updated.delete("tab");
            updated.delete("member");
            return updated;
          },
          { replace: true },
        );
      }
    },
    [searchParams, setSearchParams],
  );
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [isRebalanceOpen, setIsRebalanceOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<TripExpense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<TripExpense | null>(null);
  const [selectedMemberForStatement, setSelectedMemberForStatement] =
    useState<TripMember | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<TripMember | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [filterMyExpenses, setFilterMyExpenses] = useState(false);
  const [isDeleteTripOpen, setIsDeleteTripOpen] = useState(false);
  const [isReopenTripOpen, setIsReopenTripOpen] = useState(false);
  const [isLeaveTripOpen, setIsLeaveTripOpen] = useState(false);

  const removeMemberMutation = useRemoveTripMemberMutation(tripId);

  const handleCopyPublicLink = async (publicToken: string) => {
    const url = getPublicAppUrl(`viagem/${publicToken}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      triggerSensory("success");
      pushToast({
        title: "Link de compartilhamento copiado",
        description:
          "Envie este link no grupo para que os amigos lancem despesas sem precisar de login.",
      });
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      triggerSensory("error");
      pushToast({
        title: "Erro ao copiar link",
        description: "Não foi possível copiar o link automaticamente.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmRemoveMember = () => {
    if (!memberToRemove) return;
    removeMemberMutation.mutate(memberToRemove.id, {
      onSuccess: () => setMemberToRemove(null),
    });
  };

  return {
    activeTab,
    setActiveTab,
    highlightMemberId,
    isAddExpenseOpen,
    setIsAddExpenseOpen,
    isAddMemberOpen,
    setIsAddMemberOpen,
    isInviteOpen,
    setIsInviteOpen,
    isSettlementOpen,
    setIsSettlementOpen,
    isRebalanceOpen,
    setIsRebalanceOpen,
    editingExpense,
    setEditingExpense,
    deletingExpense,
    setDeletingExpense,
    selectedMemberForStatement,
    setSelectedMemberForStatement,
    memberToRemove,
    setMemberToRemove,
    copiedLink,
    filterMyExpenses,
    setFilterMyExpenses,
    isDeleteTripOpen,
    setIsDeleteTripOpen,
    isReopenTripOpen,
    setIsReopenTripOpen,
    isLeaveTripOpen,
    setIsLeaveTripOpen,
    removeMemberPending: removeMemberMutation.isPending,
    handleCopyPublicLink,
    handleConfirmRemoveMember,
  };
}

export type TripDetailsState = ReturnType<typeof useTripDetailsState>;
