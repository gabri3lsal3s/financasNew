import { useState } from "react";
import { creditCardFormSchema } from "@/domain/cards";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import {
  useCreateCard,
  useDeleteCard,
  useUpdateCard,
  useUpdateCustomSettings,
  useUserPreferences,
} from "@/state";
import type { CreditCard, CreditCardForm } from "@/types";

export interface UseCardFormSubmitParams {
  card: CreditCard | null;
  onClose: () => void;
  onDeleted?: (deletedCardId: string) => void;
}

export function useCardFormSubmit({ card, onClose, onDeleted }: UseCardFormSubmitParams) {
  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();
  const primaryCardId = userPreferencesQuery.data?.custom_settings?.primaryCardId ?? null;
  const currentCardOrder = userPreferencesQuery.data?.custom_settings?.cardOrder ?? [];

  const [name, setName] = useState(card?.name ?? "");
  const [brand, setBrand] = useState(card?.brand ?? "");
  const [limitCents, setLimitCents] = useState(
    card?.credit_limit === null || card?.credit_limit === undefined
      ? 0
      : Math.round(card.credit_limit * 100),
  );
  const [closingDay, setClosingDay] = useState(card?.closing_day ?? 10);
  const [dueDay, setDueDay] = useState(card?.due_day ?? 15);
  const [color, setColor] = useState(card?.color ?? "");
  const [lastFourDigits, setLastFourDigits] = useState(card?.last_four_digits ?? "");
  const [isActive, setIsActive] = useState(card?.is_active ?? true);
  const [isPrimary, setIsPrimary] = useState(card ? card.id === primaryCardId : false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();
  const pending =
    createCard.isPending ||
    updateCard.isPending ||
    deleteCard.isPending ||
    updateCustomSettingsMutation.isPending;

  const handleSubmit = async () => {
    setError(null);
    const parsed = creditCardFormSchema.safeParse({
      name,
      brand: brand.trim() || null,
      credit_limit: limitCents > 0 ? limitCents / 100 : null,
      closing_day: closingDay,
      due_day: dueDay,
      color: color.trim() || null,
      is_active: isActive,
      last_four_digits: lastFourDigits.trim() || null,
    });
    if (!parsed.success) {
      triggerSensory("error");
      setError(parsed.error.issues[0]?.message ?? "Dados do cartão inválidos");
      return;
    }

    const form: CreditCardForm = parsed.data;
    try {
      let savedCardId = card?.id;
      if (card) {
        await updateCard.mutateAsync({ id: card.id, input: form });
      } else {
        const created = await createCard.mutateAsync(form);
        savedCardId = created.id;
      }

      if (savedCardId) {
        if (isPrimary && primaryCardId !== savedCardId) {
          const newOrder = [savedCardId, ...currentCardOrder.filter((id) => id !== savedCardId)];
          await updateCustomSettingsMutation.mutateAsync({
            primaryCardId: savedCardId,
            cardOrder: newOrder,
          });
        } else if (!isPrimary && primaryCardId === savedCardId) {
          await updateCustomSettingsMutation.mutateAsync({ primaryCardId: null });
        }
      }

      triggerSensory("success");
      onClose();
    } catch (err) {
      triggerSensory("error");
      setError(getErrorMessage(err));
    }
  };

  const handleDeactivateNow = async () => {
    if (!card) return;
    setError(null);
    try {
      await updateCard.mutateAsync({
        id: card.id,
        input: {
          name: name.trim() || card.name,
          brand: brand.trim() || card.brand,
          credit_limit: limitCents > 0 ? limitCents / 100 : null,
          closing_day: closingDay,
          due_day: dueDay,
          color: color.trim() || null,
          is_active: false,
        },
      });
      triggerSensory("success");
      onClose();
    } catch (err) {
      triggerSensory("error");
      setError(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!card) return;
    setError(null);
    try {
      await deleteCard.mutateAsync(card.id);
      if (primaryCardId === card.id || currentCardOrder.includes(card.id)) {
        await updateCustomSettingsMutation.mutateAsync({
          primaryCardId: primaryCardId === card.id ? null : primaryCardId,
          cardOrder: currentCardOrder.filter((id) => id !== card.id),
        });
      }
      triggerSensory("destructive");
      setDeleteConfirmOpen(false);
      onClose();
      onDeleted?.(card.id);
    } catch (err) {
      triggerSensory("error");
      setDeleteConfirmOpen(false);
      const msg = getErrorMessage(err);
      const lower = msg.toLowerCase();
      if (
        lower.includes("foreign key") ||
        lower.includes("histórico") ||
        lower.includes("vinculad") ||
        lower.includes("desativá-lo")
      ) {
        setError(
          "Não é possível excluir um cartão que possui despesas ou pagamentos registrados. Você pode desativá-lo para mantê-lo no histórico.",
        );
      } else {
        setError(msg);
      }
    }
  };

  const isDirty = card
    ? name !== card.name ||
      brand !== (card.brand ?? "") ||
      limitCents !== (card.credit_limit ? Math.round(card.credit_limit * 100) : 0) ||
      closingDay !== card.closing_day ||
      dueDay !== card.due_day ||
      color !== (card.color ?? "") ||
      lastFourDigits !== (card.last_four_digits ?? "") ||
      isActive !== card.is_active ||
      isPrimary !== (card.id === primaryCardId)
    : name.trim() !== "" ||
      brand.trim() !== "" ||
      limitCents > 0 ||
      color.trim() !== "" ||
      lastFourDigits.trim() !== "";

  return {
    isDirty,
    name,
    setName,
    brand,
    setBrand,
    limitCents,
    setLimitCents,
    closingDay,
    setClosingDay,
    dueDay,
    setDueDay,
    color,
    setColor,
    lastFourDigits,
    setLastFourDigits,
    isActive,
    setIsActive,
    isPrimary,
    setIsPrimary,
    error,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    pending,
    handleSubmit,
    handleDeactivateNow,
    handleDelete,
  };
}
