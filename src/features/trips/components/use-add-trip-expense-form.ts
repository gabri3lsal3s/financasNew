import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  useCategories,
  useCreateExpense,
  useCreditCards,
  useLinkPersonalExpenseToTripMutation,
  useUpdateCustomSettings,
  useUserPreferences,
} from "@/state";
import { useAddTripExpenseMutation } from "@/state/queries/use-trips";
import { calculateEqualSplits, calculateLinkedExpenseWeight } from "@/domain/trips/trip-math";
import { buildExpenseInstallments } from "@/features/transactions/wizard/wizard-state";
import { pushToast } from "@/services/toast";
import { todayISO } from "@/lib/date";
import type { Category } from "@/types";
import type { TripMember } from "@/types/trips";
import { buildTripCategoryOptions } from "./trip-expense-category-options";

export function useAddTripExpenseForm({
  tripId,
  members,
  defaultPayerId,
  onOpenChange,
}: {
  tripId: string;
  members: readonly TripMember[];
  defaultPayerId?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [amountCents, setAmountCents] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [selectedPersonalCategoryId, setSelectedPersonalCategoryId] = useState<string | null>(null);
  const [expenseDate, setExpenseDate] = useState(() => todayISO());
  const [selectedPayerId, setSelectedPayerId] = useState("");
  const [splitMode, setSplitMode] = useState<"all" | "selected">("all");
  const [customMemberIds, setCustomMemberIds] = useState<string[]>([]);
  const [syncWithPersonal, setSyncWithPersonal] = useState(false);
  const [personalPaymentMethod, setPersonalPaymentMethod] = useState<"pix" | "cash" | "credit_card" | "debit">("pix");
  const [personalCardId, setPersonalCardId] = useState<string>("");
  const [personalInstallmentsCount, setPersonalInstallmentsCount] = useState<number>(1);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [newlyCreatedCategories, setNewlyCreatedCategories] = useState<Category[]>([]);

  const { session } = useAuth();
  const categoriesQuery = useCategories();
  const cardsQuery = useCreditCards();
  const createExpense = useCreateExpense();
  const addExpenseMutation = useAddTripExpenseMutation();
  const linkPersonalExpenseMutation = useLinkPersonalExpenseToTripMutation(tripId);
  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const allExpenseCategories = useMemo(() => {
    const map = new Map<string, Category>();
    for (const cat of categoriesQuery.data ?? []) {
      if (!cat.type || cat.type === "expense") map.set(cat.id, cat);
    }
    for (const cat of newlyCreatedCategories) {
      if (!map.has(cat.id)) map.set(cat.id, cat);
    }
    return Array.from(map.values());
  }, [categoriesQuery.data, newlyCreatedCategories]);

  const preferredCatId = userPreferencesQuery.data?.custom_settings?.preferredTripCategoryId;
  const preferredCat = preferredCatId ? allExpenseCategories.find((c) => c.id === preferredCatId) : null;
  const categoryName = selectedCategoryName ?? preferredCat?.name ?? "Alimentação";

  const resolvedPersonalCategoryId =
    selectedPersonalCategoryId ??
    preferredCat?.id ??
    allExpenseCategories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase())?.id ??
    allExpenseCategories[0]?.id ??
    "";

  const tripCategoryOptions = useMemo(() => buildTripCategoryOptions(allExpenseCategories), [allExpenseCategories]);
  const availableCards = cardsQuery.data ?? [];
  const effectivePersonalCardId = personalCardId || availableCards[0]?.id || "";
  const selectedPersonalCard = availableCards.find((c) => c.id === effectivePersonalCardId);

  const host = members.find((m) => m.is_host);
  const effectivePayerId =
    selectedPayerId && members.some((m) => m.id === selectedPayerId)
      ? selectedPayerId
      : defaultPayerId && members.some((m) => m.id === defaultPayerId)
        ? defaultPayerId
        : host?.id || members[0]?.id || "";

  const selectedPayer = members.find((m) => m.id === effectivePayerId);
  const isCurrentUserPayer = Boolean(
    session?.user &&
      (selectedPayer?.user_id === session.user.id || (selectedPayer?.is_host && host?.user_id === session.user.id)),
  );

  const activeSelectedMemberIds =
    customMemberIds.length > 0 && customMemberIds.some((id) => members.some((m) => m.id === id))
      ? customMemberIds
      : members.map((m) => m.id);

  const handleToggleMember = (memberId: string) => {
    if (activeSelectedMemberIds.includes(memberId)) {
      if (activeSelectedMemberIds.length === 1) return;
      setCustomMemberIds(activeSelectedMemberIds.filter((id) => id !== memberId));
    } else {
      setCustomMemberIds([...activeSelectedMemberIds, memberId]);
    }
  };

  const resetForm = () => {
    setAmountCents(0);
    setDescription("");
    setSelectedPayerId("");
    setCustomMemberIds([]);
    setSplitMode("all");
    setSyncWithPersonal(false);
    setPersonalPaymentMethod("pix");
    setPersonalCardId("");
    setSelectedPersonalCategoryId(null);
    setSelectedCategoryName(null);
    setPersonalInstallmentsCount(1);
    setNewlyCreatedCategories([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountCents <= 0 || !description.trim() || !effectivePayerId) return;

    const participatingMembers = splitMode === "all" ? members.map((m) => m.id) : activeSelectedMemberIds;
    const calculatedSplits = calculateEqualSplits({
      totalAmountCents: amountCents,
      memberIds: participatingMembers,
      payerMemberId: effectivePayerId,
    });

    const userShareCents = calculatedSplits.find((s) => s.memberId === effectivePayerId)?.shareCents ?? amountCents;
    const linkedWeight = calculateLinkedExpenseWeight(amountCents, userShareCents);

    try {
      let linkedPersonalId: string | null = null;
      if (syncWithPersonal && isCurrentUserPayer) {
        if (resolvedPersonalCategoryId) {
          void updateCustomSettingsMutation.mutateAsync({ preferredTripCategoryId: resolvedPersonalCategoryId }).catch(() => {});
        }
        try {
          const installments =
            personalPaymentMethod === "credit_card" && selectedPersonalCard
              ? buildExpenseInstallments({
                  totalCents: amountCents,
                  count: personalInstallmentsCount,
                  startDate: expenseDate,
                  closingDay: selectedPersonalCard.closing_day,
                })
              : [{ date: expenseDate, value: amountCents / 100, billCompetence: null }];

          const createdId = await createExpense.mutateAsync({
            value: amountCents / 100,
            date: expenseDate,
            categoryId: resolvedPersonalCategoryId,
            paymentMethod: personalPaymentMethod,
            cardId: personalPaymentMethod === "credit_card" ? selectedPersonalCard?.id ?? null : null,
            description: description.trim(),
            reportWeight: linkedWeight,
            installments: installments.map((inst) => ({
              date: inst.date,
              value: inst.value,
              billCompetence: inst.billCompetence ?? null,
            })),
            isFamily: false,
          });

          if (createdId && typeof createdId === "string") {
            linkedPersonalId = createdId;
            await linkPersonalExpenseMutation.mutateAsync({ personalExpenseId: createdId, tripId });
          }
        } catch {
          pushToast({
            title: "Despesa da viagem criada, mas houve falha no extrato",
            description: "A despesa foi registrada na viagem, porém não pôde ser lançada no seu extrato pessoal.",
            variant: "warning",
          });
        }
      }

      await addExpenseMutation.mutateAsync({
        trip_id: tripId,
        paid_by_member_id: effectivePayerId,
        amount_cents: amountCents,
        description: description.trim(),
        category_name: categoryName,
        expense_date: expenseDate,
        split_type: splitMode === "all" ? "equal" : "custom",
        linked_personal_expense_id: linkedPersonalId,
        splits: calculatedSplits.map((s) => ({ member_id: s.memberId, share_cents: s.shareCents })),
      });

      resetForm();
      onOpenChange(false);
    } catch {
      // Erro gerenciado no hook useAddTripExpenseMutation
    }
  };

  return {
    amountCents,
    setAmountCents,
    description,
    setDescription,
    categoryName,
    setSelectedCategoryName,
    setSelectedPersonalCategoryId,
    expenseDate,
    setExpenseDate,
    effectivePayerId,
    setSelectedPayerId,
    splitMode,
    setSplitMode,
    activeSelectedMemberIds,
    handleToggleMember,
    syncWithPersonal,
    setSyncWithPersonal,
    personalPaymentMethod,
    setPersonalPaymentMethod,
    effectivePersonalCardId,
    setPersonalCardId,
    availableCards,
    selectedPersonalCard,
    personalInstallmentsCount,
    setPersonalInstallmentsCount,
    isCreateCategoryOpen,
    setIsCreateCategoryOpen,
    setNewlyCreatedCategories,
    allExpenseCategories,
    resolvedPersonalCategoryId,
    tripCategoryOptions,
    isCurrentUserPayer,
    isPending: addExpenseMutation.isPending,
    handleSubmit,
  };
}
