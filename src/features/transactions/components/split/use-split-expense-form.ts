import { useCallback, useEffect, useMemo, useState } from "react";
import { todayISO } from "@/domain/debts";
import {
  calculateSplitSummary,
  splitAmountEqually,
  type SplitRemainderPolicy,
} from "@/domain/finance/split-math";
import { validateAndClassifyPixKey, type PixKeyType } from "@/domain/pix";
import { generateShareToken } from "@/domain/share/token";
import { getPublicAppUrl, getPublicShareUrl } from "@/services/app-url";
import { copyTextToClipboard, shareText } from "@/services/export-actions";
import { formatCentsAsBRL } from "@/services/masks";
import { isNativePlatform } from "@/services/native";
import { triggerSensory } from "@/services/sensory";
import { useSplitPreferences } from "@/services/split-preferences";
import { pushToast } from "@/services/toast";
import { useCreateLinkedSplit, useExpense } from "@/state";
import { useDemoSession } from "@/state/demo-mode";
import { useUserAccess } from "@/state/queries/use-user-access";
import type { Expense } from "@/types";
import { resolveDefaultPixDefaults } from "./split-constants";
import { buildSplitSharePayload } from "./split-payload-builder";

export interface UseSplitExpenseFormParams {
  open: boolean;
  expense?: Partial<Expense> | null;
  fromWizard?: boolean;
  initialAmountCents?: number;
  initialDescription?: string;
  initialDate?: string;
  initialPeopleCount?: number;
  initialInstallmentsCount?: number;
  initialInstallmentsMode?: "single_total" | "per_installment";
  linkedDebtId?: string | null;
  categoryName?: string;
  categoryIcon?: string;
  autoGenerate?: boolean;
  isSimulation?: boolean;
}

export function useSplitExpenseForm(params: UseSplitExpenseFormParams) {
  const {
    open, expense, fromWizard = false, initialAmountCents, initialDescription, initialDate,
    initialPeopleCount, initialInstallmentsCount, initialInstallmentsMode, linkedDebtId,
    categoryName, categoryIcon, autoGenerate = false, isSimulation = false,
  } = params;

  const { isDemoActive } = useDemoSession();
  const isSimulationActive = Boolean(isSimulation || isDemoActive);
  const { profile } = useUserAccess();
  const { preferences, updatePreferences } = useSplitPreferences();
  const createLinkedSplitMutation = useCreateLinkedSplit();
  const { data: fullExpense } = useExpense(expense?.id ?? null);

  const isPreconfigured = Boolean(fromWizard || (expense && typeof expense.value === "number" && (initialPeopleCount ?? 0) >= 2));
  const defaults = resolveDefaultPixDefaults(isSimulationActive, preferences, profile);
  const effectiveInitialCount = initialPeopleCount ?? preferences.defaultPeopleCount ?? 2;
  const initialBaseCents =
    initialAmountCents && initialAmountCents > 0
      ? initialAmountCents
      : expense && typeof expense.value === "number"
        ? Math.round(expense.value * 100)
        : 0;
  const initialDesc = expense?.description || initialDescription || "";

  const [totalCents, setTotalCents] = useState<number>(initialBaseCents);
  const [description, setDescription] = useState<string>(initialDesc);
  const [peopleCount, setPeopleCount] = useState<number>(effectiveInitialCount);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [participants, setParticipants] = useState<string[]>(() =>
    Array.from({ length: effectiveInitialCount }, (_, i) => (i === 0 ? "Você (Anfitrião)" : `Participante ${i + 1}`)),
  );
  const [customSharesCents, setCustomSharesCents] = useState<number[]>(() =>
    splitAmountEqually(Math.max(0, initialBaseCents), Math.max(2, effectiveInitialCount), {
      remainderPolicy: defaults.remainderPolicy,
    }),
  );
  const [remainderPolicy, setRemainderPolicy] = useState<SplitRemainderPolicy>(defaults.remainderPolicy);
  const [pixKey, setPixKey] = useState<string>(defaults.pixKey);
  const [selectedKeyType, setSelectedKeyType] = useState<string>(defaults.keyType);
  const [merchantName, setMerchantName] = useState<string>(defaults.merchantName);
  const [merchantCity, setMerchantCity] = useState<string>(defaults.merchantCity);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const nextDefaults = resolveDefaultPixDefaults(isSimulationActive, preferences, profile);
      const count = initialPeopleCount ?? preferences.defaultPeopleCount ?? 2;
      setTotalCents(initialBaseCents);
      setDescription(initialDesc);
      setPeopleCount(count);
      setIsCustomMode(false);
      setSplitMode("equal");
      setParticipants(Array.from({ length: count }, (_, i) => (i === 0 ? "Você (Anfitrião)" : `Participante ${i + 1}`)));
      setCustomSharesCents(
        splitAmountEqually(Math.max(0, initialBaseCents), Math.max(2, count), {
          remainderPolicy: nextDefaults.remainderPolicy,
        }),
      );
      setRemainderPolicy(nextDefaults.remainderPolicy);
      setGeneratedLink(null);
      setCopied(false);
      setPixKey(nextDefaults.pixKey);
      setSelectedKeyType(nextDefaults.keyType);
      setMerchantName(nextDefaults.merchantName);
      setMerchantCity(nextDefaults.merchantCity);
    }
  }

  const pixValidation = useMemo(
    () =>
      validateAndClassifyPixKey(
        pixKey,
        selectedKeyType === "auto" ? undefined : (selectedKeyType as PixKeyType),
      ),
    [pixKey, selectedKeyType],
  );

  const detectedType: PixKeyType | null = pixValidation.resolvedType;

  const summary = useMemo(() => {
    const base = calculateSplitSummary(Math.max(0, totalCents), Math.max(1, Math.min(peopleCount, 50)), {
      remainderPolicy,
    });
    if (splitMode === "custom" && customSharesCents.length === peopleCount) {
      return {
        ...base,
        shares: customSharesCents,
        hostShareCents: customSharesCents[0] ?? base.hostShareCents,
        guestShareCents: customSharesCents[1] ?? base.guestShareCents,
      };
    }
    return base;
  }, [totalCents, peopleCount, remainderPolicy, splitMode, customSharesCents]);

  const handleSplitModeChange = (mode: "equal" | "custom") => {
    setSplitMode(mode);
    if (mode === "custom") {
      setCustomSharesCents(
        splitAmountEqually(Math.max(0, totalCents), Math.max(2, peopleCount), {
          remainderPolicy,
        }),
      );
    }
  };

  const handleCustomShareChange = (index: number, cents: number) => {
    setCustomSharesCents((prev) => prev.map((v, i) => (i === index ? Math.max(0, cents) : v)));
  };

  const handlePeopleCountChange = (count: number) => {
    const clamped = Math.max(2, Math.min(count, 50));
    setPeopleCount(clamped);
    setParticipants((prev) => {
      if (clamped < prev.length) return prev.slice(0, clamped);
      const next = [...prev];
      for (let i = next.length; i < clamped; i++) next.push(`Participante ${i + 1}`);
      return next;
    });
    setCustomSharesCents(
      splitAmountEqually(Math.max(0, totalCents), clamped, { remainderPolicy }),
    );
  };

  const handleParticipantNameChange = (index: number, name: string) => {
    setParticipants((prev) => prev.map((item, i) => (i === index ? name : item)));
  };

  const handleAddParticipant = () => { if (peopleCount < 50) handlePeopleCountChange(peopleCount + 1); };
  const handleRemoveParticipant = (index: number) => {
    if (peopleCount <= 2 || index === 0) return;
    const nextCount = peopleCount - 1;
    setParticipants((prev) => prev.filter((_, i) => i !== index));
    setPeopleCount(nextCount);
    setCustomSharesCents((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.length === nextCount
        ? filtered
        : splitAmountEqually(Math.max(0, totalCents), nextCount, { remainderPolicy });
    });
  };

  const handleGenerateAndCopy = useCallback(async () => {
    if (totalCents <= 0 || peopleCount < 2 || !pixValidation.isValid || !pixValidation.resolvedType) return;
    try {
      const cleanMerchant = merchantName.trim() || (isSimulationActive ? "Gabriel (Demonstração)" : profile?.name || "Anfitriao");
      const cleanCity = merchantCity.trim();
      if (!cleanCity) return;

      const resolvedType = pixValidation.resolvedType;
      const cleanPixKey = pixValidation.normalizedKey ?? pixKey.trim();
      const resolvedHostName = cleanMerchant && cleanMerchant !== "Você" ? cleanMerchant : (isSimulationActive ? "Gabriel (Demonstração)" : profile?.name || "Anfitrião");
      const payload = buildSplitSharePayload({
        totalCents, peopleCount, description, pixKey: cleanPixKey, detectedType: resolvedType, cleanMerchant, cleanCity,
        resolvedHostName, participants, summary, remainderPolicy,
        splitMode, customSharesCents, installmentsMode: initialInstallmentsMode, linkedDebtId,
        expense, fullExpense, initialDate, initialInstallmentsCount, categoryName, categoryIcon,
      });

      if (isSimulationActive) {
        const demoUrl = getPublicAppUrl("r/demo-racha-480");
        setGeneratedLink(demoUrl);
        const copiedOk = await copyTextToClipboard(demoUrl);
        if (copiedOk) setCopied(true);
        triggerSensory("success");
        pushToast({ title: "Demonstração de link do racha", description: "Link demonstrativo gerado em memória para apresentação didática.", variant: "success" });
        return;
      }

      const friendsExpectedCents = payload.participants
        .filter((p) => !p.is_host)
        .reduce((acc, p) => acc + p.share_cents, 0);

      const { share } = await createLinkedSplitMutation.mutateAsync({
        token: generateShareToken(10),
        payload,
        expenseId: expense?.id ?? null,
        installmentGroupId:
          expense?.installment_group_id ?? fullExpense?.installment_group_id ?? null,
        linkedDebtId: linkedDebtId ?? null,
        title: payload.title,
        date: expense?.date || initialDate || todayISO(),
        installmentsCount: payload.installments_count ?? initialInstallmentsCount ?? 1,
        friendsExpectedCents,
      });

      const url = getPublicShareUrl(`r/${share.token}`);
      setGeneratedLink(url);
      const copiedOk = await copyTextToClipboard(url);
      if (copiedOk) setCopied(true);
      updatePreferences({ pixKey: cleanPixKey, pixKeyType: resolvedType, merchantName: cleanMerchant, merchantCity: cleanCity, remainderPolicy, defaultPeopleCount: peopleCount });
      triggerSensory("success");
      pushToast({ title: "Link do racha gerado e copiado!", description: "Compartilhe com seus amigos para receber via Pix.", variant: "success" });
    } catch { /* Tratado pela mutation */ }
  }, [
    totalCents, peopleCount, pixValidation, pixKey, merchantName, merchantCity, profile,
    summary, description, splitMode, customSharesCents, initialInstallmentsMode, linkedDebtId,
    expense, initialDate, participants, remainderPolicy, categoryName, categoryIcon,
    createLinkedSplitMutation, updatePreferences, isSimulationActive, initialInstallmentsCount, fullExpense,
  ]);

  const handleCopyLinkAgain = async () => {
    if (!generatedLink) return;
    const copiedOk = await copyTextToClipboard(generatedLink);
    if (copiedOk) {
      setCopied(true);
      triggerSensory("success");
      pushToast({ title: "Link copiado para a área de transferência!", variant: "default" });
      setTimeout(() => setCopied(false), 3000);
    } else {
      pushToast({ title: "Não foi possível copiar automaticamente.", variant: "destructive" });
    }
  };

  const handleShareWhatsApp = () => {
    if (!generatedLink || typeof window === "undefined") return;
    const msg = `Oi! Segue o link para o racha da conta de ${description.trim() || "Despesa"} (${formatCentsAsBRL(summary.guestShareCents)} para cada):\n\n${generatedLink}\n\nVocê pode pagar direto copiando o Pix!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  const handleShareNative = async () => {
    if (!generatedLink) return;
    const title = `Racha: ${description.trim() || "Despesa"}`;
    const body = `Sua parte na despesa ficou em ${formatCentsAsBRL(summary.guestShareCents)}. Acesse o link para copiar o Pix:`;
    if (isNativePlatform()) {
      const res = await shareText(title, `${body}\n\n${generatedLink}`);
      if (res === "unsupported") {
        await handleCopyLinkAgain();
      }
      return;
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          text: body,
          url: generatedLink,
        });
      } catch { /* cancelado */ }
    } else await handleCopyLinkAgain();
  };

  const isCustomValid =
    splitMode === "equal" ||
    (customSharesCents.length === peopleCount &&
      customSharesCents.reduce((acc, c) => acc + c, 0) === totalCents &&
      customSharesCents.every((c) => c >= 0));

  const isFormValid =
    totalCents > 0 &&
    peopleCount >= 2 &&
    pixValidation.isValid &&
    merchantName.trim().length > 0 &&
    merchantCity.trim().length > 0 &&
    isCustomValid;

  useEffect(() => {
    if (!open || !autoGenerate || generatedLink || !isFormValid || createLinkedSplitMutation.isPending) return;
    const timer = setTimeout(() => void handleGenerateAndCopy(), 50);
    return () => clearTimeout(timer);
  }, [open, autoGenerate, generatedLink, isFormValid, createLinkedSplitMutation.isPending, handleGenerateAndCopy]);

  return {
    isPreconfigured, totalCents, setTotalCents, description, setDescription, peopleCount,
    isCustomMode, setIsCustomMode, splitMode, handleSplitModeChange, customSharesCents, handleCustomShareChange,
    participants, remainderPolicy, setRemainderPolicy, pixKey, setPixKey, selectedKeyType, setSelectedKeyType,
    merchantName, setMerchantName, merchantCity, setMerchantCity,
    detectedType,
    pixValidationError: pixValidation.errorMessage,
    isAmbiguousCpfOrPhone: pixValidation.isAmbiguousCpfOrPhone,
    summary, generatedLink, copied,
    isFormValid, isPending: createLinkedSplitMutation.isPending,
    handlePeopleCountChange, handleParticipantNameChange, handleAddParticipant, handleRemoveParticipant,
    handleGenerateAndCopy, handleCopyLinkAgain, handleShareWhatsApp, handleShareNative,
  };
}
