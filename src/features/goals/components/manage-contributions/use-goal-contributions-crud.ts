import { useState } from "react";
import { todayISO } from "@/lib/date";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useUpdatePublicShare } from "@/state";
import type { GoalContribution, PublicShare } from "@/types";

export function useGoalContributionsCrud(share: PublicShare) {
  const updateShareMutation = useUpdatePublicShare();

  const [isAddingOpen, setIsAddingOpen] = useState(false);
  const [newAmountCents, setNewAmountCents] = useState(0);
  const [newContributorName, setNewContributorName] = useState("");
  const [newDate, setNewDate] = useState(() => todayISO());

  const [editingContribId, setEditingContribId] = useState<string | null>(null);
  const [editAmountCents, setEditAmountCents] = useState(0);
  const [editContributorName, setEditContributorName] = useState("");
  const [editDate, setEditDate] = useState("");

  const [deletingContribId, setDeletingContribId] = useState<string | null>(null);

  const payload = share.payload ?? {};
  const title = (payload.title as string) || "Meta Coletiva";
  const contributions: GoalContribution[] =
    (payload.contributions as GoalContribution[] | undefined) ?? [];

  const totalContributionsCents = contributions.reduce((acc, c) => acc + c.amount_cents, 0);

  const startEdit = (contrib: GoalContribution) => {
    setEditingContribId(contrib.id);
    setEditAmountCents(contrib.amount_cents);
    setEditContributorName(contrib.contributor_name ?? "");
    setEditDate(contrib.date);
  };

  const cancelEdit = () => {
    setEditingContribId(null);
    setEditAmountCents(0);
    setEditContributorName("");
    setEditDate("");
  };

  const saveContributionsUpdate = async (
    newContribsList: GoalContribution[],
    successMessage: string,
  ) => {
    try {
      const sumContribs = newContribsList.reduce((acc, c) => acc + c.amount_cents, 0);
      await updateShareMutation.mutateAsync({
        id: share.id,
        payload: {
          ...payload,
          current_cents: sumContribs,
          contributions: newContribsList,
        },
      });
      pushToast({
        title: "Atualizado com sucesso!",
        description: successMessage,
        variant: "success",
      });
    } catch {
      triggerSensory("error");
      pushToast({
        title: "Não foi possível atualizar",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  };

  const handleSaveEdit = async (contribId: string) => {
    if (editAmountCents <= 0) return;
    const updatedList = contributions.map((c) => {
      if (c.id !== contribId) return c;
      return {
        ...c,
        amount_cents: editAmountCents,
        contributor_name: editContributorName.trim() || undefined,
        date: editDate || c.date,
      };
    });
    await saveContributionsUpdate(updatedList, "Dados do depósito atualizados.");
    cancelEdit();
  };

  const handleDelete = async (contribId: string) => {
    const updatedList = contributions.filter((c) => c.id !== contribId);
    await saveContributionsUpdate(updatedList, "Depósito removido com sucesso.");
    setDeletingContribId(null);
  };

  const handleAddSubmit = async () => {
    if (newAmountCents <= 0) return;
    const newContrib: GoalContribution = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `contrib-${Date.now()}`,
      amount_cents: newAmountCents,
      contributor_name: newContributorName.trim() || undefined,
      date: newDate || todayISO(),
    };
    await saveContributionsUpdate([...contributions, newContrib], "Novo depósito adicionado.");
    setNewAmountCents(0);
    setNewContributorName("");
    setNewDate(todayISO());
    setIsAddingOpen(false);
  };

  return {
    title,
    contributions,
    totalContributionsCents,
    isPending: updateShareMutation.isPending,
    isAddingOpen,
    setIsAddingOpen,
    newAmountCents,
    setNewAmountCents,
    newContributorName,
    setNewContributorName,
    newDate,
    setNewDate,
    editingContribId,
    editAmountCents,
    setEditAmountCents,
    editContributorName,
    setEditContributorName,
    editDate,
    setEditDate,
    deletingContribId,
    setDeletingContribId,
    startEdit,
    cancelEdit,
    handleSaveEdit,
    handleDelete,
    handleAddSubmit,
  };
}
