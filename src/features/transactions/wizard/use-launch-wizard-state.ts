import { useEffect, useState } from "react";
import { calculateSplitSummary } from "@/domain/finance/split-math";
import { todayISO } from "@/domain/debts";
import type { HabitualEntry } from "@/domain/predictions";
import type { Category, PaymentMethod, ReceiveType, TransactionScope } from "@/types";
import { defaultLaunchState, getStoredWizardMode, setStoredWizardMode } from "./wizard-state";
import type { EntryType, LaunchState, WizardMode } from "./wizard-types";

export interface UseLaunchWizardStateParams {
  initialMode: WizardMode;
  initialType: EntryType;
  initialValues?: Partial<LaunchState>;
  categories: Category[] | undefined;
  preferredTripCategoryId?: string | null;
  isFamilyActive: boolean;
  isBusinessActive?: boolean;
  defaultScope?: TransactionScope;
  onSetCategoryUnconfirmed: (unconfirmed: boolean) => void;
}

export function useLaunchWizardState({
  initialMode,
  initialType,
  initialValues,
  categories,
  preferredTripCategoryId,
  isFamilyActive,
  isBusinessActive = false,
  defaultScope = "personal",
  onSetCategoryUnconfirmed,
}: UseLaunchWizardStateParams) {
  const [mode, setMode] = useState<WizardMode>(() =>
    initialMode === "quick" ? "quick" : (getStoredWizardMode() ?? initialMode),
  );
  const [state, setState] = useState<LaunchState>(() =>
    defaultLaunchState(initialType, {
      ...(defaultScope === "business" ? { scope: "business" } : {}),
      ...initialValues,
    }),
  );

  useEffect(() => {
    if (!state.tripId || state.categoryId) return;
    if (preferredTripCategoryId && categories?.some((c) => c.id === preferredTripCategoryId)) {
      const timer = setTimeout(() => {
        setState((prev) => (prev.categoryId ? prev : { ...prev, categoryId: preferredTripCategoryId }));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [state.tripId, state.categoryId, preferredTripCategoryId, categories]);

  const set = <K extends keyof LaunchState>(key: K, value: LaunchState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const handleSplitToggle = (enabled: boolean) => {
    setState((prev) => {
      if (!enabled) return { ...prev, splitEnabled: false, reportWeight: 1, reportCustomAmountCents: prev.valueCents };
      const splitMath = calculateSplitSummary(prev.valueCents, prev.splitPeopleCount, { remainderPolicy: "host" });
      return {
        ...prev,
        splitEnabled: true,
        tripId: null,
        reportWeight: 1,
        reportCustomAmountCents: prev.valueCents,
        debtEnabled: true,
        debtType: "receivable",
        debtAmountCents: splitMath.guestShareCents * splitMath.guestCount,
        debtDueDate: prev.debtDueDate || prev.date || todayISO(),
      };
    });
  };

  const handleTripChange = (tripId: string | null) => {
    setState((prev) => {
      if (!tripId) return { ...prev, tripId: null };
      const validPreferred = preferredTripCategoryId && categories?.some((c) => c.id === preferredTripCategoryId);
      return {
        ...prev,
        tripId,
        categoryId: prev.categoryId || (validPreferred ? preferredTripCategoryId : prev.categoryId),
        splitEnabled: false,
        debtEnabled: prev.splitEnabled ? false : prev.debtEnabled,
        debtAmountCents: prev.splitEnabled ? 0 : prev.debtAmountCents,
      };
    });
  };

  const handleSplitPeopleCountChange = (count: number) => {
    setState((prev) => {
      const clamped = Math.max(2, Math.min(count, 50));
      const splitMath = calculateSplitSummary(prev.valueCents, clamped, { remainderPolicy: "host" });
      return {
        ...prev,
        splitPeopleCount: clamped,
        reportCustomAmountCents: prev.splitEnabled ? prev.valueCents : prev.reportCustomAmountCents,
        debtAmountCents: prev.splitEnabled ? splitMath.guestShareCents * splitMath.guestCount : prev.debtAmountCents,
      };
    });
  };

  const handleValueChange = (cents: number) => {
    setState((prev) => {
      if (!prev.splitEnabled) return { ...prev, valueCents: cents };
      const splitMath = calculateSplitSummary(cents, prev.splitPeopleCount, { remainderPolicy: "host" });
      return {
        ...prev,
        valueCents: cents,
        reportCustomAmountCents: cents,
        debtAmountCents: splitMath.guestShareCents * splitMath.guestCount,
      };
    });
  };

  const handleTypeChange = (type: EntryType) => {
    setState((prev) => ({
      ...prev,
      type,
      categoryId: "",
      cardId: null,
      debtEnabled: false,
      debtType: "payable",
      recurring: false,
      recurrenceEndDate: "",
      splitEnabled: false,
      splitPFPJEnabled: false,
      taxWithheldCents: 0,
    }));
  };

  const handleCategorySelect = (categoryId: string) => {
    set("categoryId", categoryId);
    onSetCategoryUnconfirmed(false);
    const cat = categories?.find((c) => c.id === categoryId);
    if (isFamilyActive && cat?.is_family) set("isFamily", true);
    if (isBusinessActive && cat?.scope === "business") {
      setState((prev) => ({
        ...prev,
        scope: "business",
        isFamily: false,
        tripId: null,
        splitEnabled: false,
        splitPFPJEnabled: false,
      }));
    }
  };

  const handleScopeChange = (nextScope: TransactionScope) => {
    setState((prev) => {
      if ((prev.scope ?? "personal") === nextScope) return prev;
      const selectedCat = categories?.find((c) => c.id === prev.categoryId);
      const keepCat =
        !selectedCat ||
        !selectedCat.scope ||
        selectedCat.scope === "both" ||
        selectedCat.scope === nextScope;
      return {
        ...prev,
        scope: nextScope,
        categoryId: keepCat ? prev.categoryId : "",
        ...(nextScope === "business"
          ? { isFamily: false, tripId: null, splitEnabled: false, splitPFPJEnabled: false }
          : { isTaxDeductible: false, taxWithheldCents: 0 }),
      };
    });
  };

  const handleTaxWithheldChange = (cents: number) => {
    set("taxWithheldCents", Math.max(0, cents));
  };

  const handleSplitPFPJToggle = (enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      splitPFPJEnabled: enabled,
      splitPFPJBusinessPercent: prev.splitPFPJBusinessPercent ?? 50,
      ...(enabled
        ? {
            isFamily: false,
            tripId: null,
            splitEnabled: false,
            scope: "personal",
          }
        : {}),
    }));
  };

  const handleSplitPFPJBusinessPercentChange = (percent: number) => {
    setState((prev) => ({
      ...prev,
      splitPFPJBusinessPercent: Math.max(1, Math.min(99, percent)),
    }));
  };

  const switchToQuick = () => {
    setMode("quick");
    setStoredWizardMode("quick");
  };

  const switchToGuided = () => {
    setMode("guided");
    setStoredWizardMode("guided");
    setState((prev) => ({
      ...prev,
      step: prev.valueCents > 0 && prev.categoryId ? 3 : prev.valueCents > 0 ? 2 : 1,
    }));
  };

  const applyHabitual = (habit: HabitualEntry) => {
    handleValueChange(Math.round(habit.value * 100));
    set("categoryId", habit.categoryId);
    set("description", habit.description);
    if (habit.paymentMethod) {
      set("paymentMethod", habit.paymentMethod as PaymentMethod);
      set("cardId", habit.cardId);
    } else if (habit.receiveType) {
      set("receiveType", habit.receiveType as ReceiveType);
    }
  };

  return {
    mode,
    setMode,
    state,
    setState,
    set,
    handleSplitToggle,
    handleTripChange,
    handleSplitPeopleCountChange,
    handleValueChange,
    handleTypeChange,
    handleCategorySelect,
    handleScopeChange,
    handleTaxWithheldChange,
    handleSplitPFPJToggle,
    handleSplitPFPJBusinessPercentChange,
    applyHabitual,
    switchToQuick,
    switchToGuided,
  };
}
