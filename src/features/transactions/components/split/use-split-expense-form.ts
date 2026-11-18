import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { calculateSplitSummary, type SplitRemainderPolicy } from "@/domain/finance/split-math";
import { detectPixKeyType, type PixKeyType } from "@/domain/pix/pix-br-code";
import { generateShareToken } from "@/domain/share/token";
import { getPublicAppUrl, getPublicShareUrl } from "@/services/app-url";
import { formatCentsAsBRL } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { useSplitPreferences } from "@/services/split-preferences";
import { pushToast } from "@/services/toast";
import { useExpense } from "@/state";
import { useDemoSession } from "@/state/demo-mode";
import { useCreatePublicShare } from "@/state/mutations/use-public-share-mutations";
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
  categoryName?: string;
  categoryIcon?: string;
  autoGenerate?: boolean;
  isSimulation?: boolean;
}

export function useSplitExpenseForm(params: UseSplitExpenseFormParams) {
  const {
    open, expense, fromWizard = false, initialAmountCents, initialDescription, initialDate,
    initialPeopleCount, initialInstallmentsCount, categoryName, categoryIcon, autoGenerate = false, isSimulation = false,
  } = params;

  const queryClient = useQueryClient();
  const { isDemoActive } = useDemoSession();
  const isSimulationActive = Boolean(isSimulation || isDemoActive);
  const { profile } = useUserAccess();
  const { preferences, updatePreferences } = useSplitPreferences();
  const createPublicShareMutation = useCreatePublicShare();
  const { data: fullExpense } = useExpense(expense?.id ?? null);

  const isPreconfigured = Boolean(fromWizard || (expense && typeof expense.value === "number" && (initialPeopleCount ?? 0) >= 2));
  const defaults = resolveDefaultPixDefaults(isSimulationActive, preferences, profile);
  const effectiveInitialCount = initialPeopleCount ?? preferences.defaultPeopleCount ?? 2;
  const initialBaseCents = expense && typeof expense.value === "number" ? Math.round(expense.value * 100) : (initialAmountCents ?? 0);
  const initialDesc = expense?.description || initialDescription || "";

  const [totalCents, setTotalCents] = useState<number>(initialBaseCents);
  const [description, setDescription] = useState<string>(initialDesc);
  const [peopleCount, setPeopleCount] = useState<number>(effectiveInitialCount);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [participants, setParticipants] = useState<string[]>(() =>
    Array.from({ length: effectiveInitialCount }, (_, i) => (i === 0 ? "Você (Anfitrião)" : `Participante ${i + 1}`)),
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
      setParticipants(Array.from({ length: count }, (_, i) => (i === 0 ? "Você (Anfitrião)" : `Participante ${i + 1}`)));
      setRemainderPolicy(nextDefaults.remainderPolicy);
      setGeneratedLink(null);
      setCopied(false);
      setPixKey(nextDefaults.pixKey);
      setSelectedKeyType(nextDefaults.keyType);
      setMerchantName(nextDefaults.merchantName);
      setMerchantCity(nextDefaults.merchantCity);
    }
  }

  const detectedType = useMemo(() => {
    if (selectedKeyType !== "auto") return selectedKeyType as PixKeyType;
    const detected = detectPixKeyType(pixKey);
    return detected === "unknown" ? "cpf" : detected;
  }, [pixKey, selectedKeyType]);

  const summary = useMemo(() => {
    return calculateSplitSummary(Math.max(0, totalCents), Math.max(1, Math.min(peopleCount, 50)), { remainderPolicy });
  }, [totalCents, peopleCount, remainderPolicy]);

  const handlePeopleCountChange = (count: number) => {
    const clamped = Math.max(2, Math.min(count, 50));
    setPeopleCount(clamped);
    setParticipants((prev) => {
      if (clamped < prev.length) return prev.slice(0, clamped);
      const next = [...prev];
      for (let i = next.length; i < clamped; i++) next.push(`Participante ${i + 1}`);
      return next;
    });
  };

  const handleParticipantNameChange = (index: number, name: string) => {
    setParticipants((prev) => prev.map((item, i) => (i === index ? name : item)));
  };

  const handleAddParticipant = () => { if (peopleCount < 50) handlePeopleCountChange(peopleCount + 1); };
  const handleRemoveParticipant = (index: number) => {
    if (peopleCount <= 2 || index === 0) return;
    setParticipants((prev) => prev.filter((_, i) => i !== index));
    setPeopleCount((prev) => prev - 1);
  };

  const handleGenerateAndCopy = useCallback(async () => {
    if (totalCents <= 0 || peopleCount < 2 || !pixKey.trim()) return;
    try {
      const cleanMerchant = merchantName.trim() || (isSimulationActive ? "Gabriel (Demonstração)" : profile?.name || "Anfitriao");
      const cleanCity = merchantCity.trim();
      if (!cleanCity) return;

      const resolvedHostName = cleanMerchant && cleanMerchant !== "Você" ? cleanMerchant : (isSimulationActive ? "Gabriel (Demonstração)" : profile?.name || "Anfitrião");
      const payload = buildSplitSharePayload({
        totalCents, peopleCount, description, pixKey, detectedType, cleanMerchant, cleanCity,
        resolvedHostName, participants, summary, remainderPolicy, expense, fullExpense,
        initialDate, initialInstallmentsCount, categoryName, categoryIcon,
      });

      if (isSimulationActive) {
        const demoUrl = getPublicAppUrl("r/demo-racha-480");
        setGeneratedLink(demoUrl);
        try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(demoUrl); setCopied(true); } } catch { /* noop */ }
        triggerSensory("success");
        pushToast({ title: "Demonstração de link do racha", description: "Link demonstrativo gerado em memória para apresentação didática.", variant: "success" });
        return;
      }

      const share = await createPublicShareMutation.mutateAsync({ kind: "split", token: generateShareToken(10), payload: payload as unknown as Record<string, unknown> });
      const url = getPublicShareUrl(`r/${share.token}`);
      setGeneratedLink(url);
      ["my-public-shares", "public-shares", "debts", "expenses", "overview"].forEach((k) => void queryClient.invalidateQueries({ queryKey: [k] }));
      try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); setCopied(true); } } catch { /* noop */ }
      updatePreferences({ pixKey: pixKey.trim(), pixKeyType: detectedType, merchantName: cleanMerchant, merchantCity: cleanCity, remainderPolicy, defaultPeopleCount: peopleCount });
      triggerSensory("success");
      pushToast({ title: "Link do racha gerado e copiado!", description: "Compartilhe com seus amigos para receber via Pix.", variant: "success" });
    } catch { /* Tratado pela mutation */ }
  }, [totalCents, peopleCount, pixKey, merchantName, merchantCity, profile, detectedType, summary, description, expense, initialDate, participants, remainderPolicy, categoryName, categoryIcon, createPublicShareMutation, updatePreferences, isSimulationActive, initialInstallmentsCount, fullExpense, queryClient]);

  const handleCopyLinkAgain = async () => {
    if (!generatedLink || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      triggerSensory("success");
      pushToast({ title: "Link copiado para a área de transferência!", variant: "default" });
      setTimeout(() => setCopied(false), 3000);
    } catch { pushToast({ title: "Não foi possível copiar automaticamente.", variant: "destructive" }); }
  };

  const handleShareWhatsApp = () => {
    if (!generatedLink || typeof window === "undefined") return;
    const msg = `Oi! Segue o link para o racha da conta de ${description.trim() || "Despesa"} (${formatCentsAsBRL(summary.guestShareCents)} para cada):\n\n${generatedLink}\n\nVocê pode pagar direto copiando o Pix!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  const handleShareNative = async () => {
    if (!generatedLink) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Racha: ${description.trim() || "Despesa"}`,
          text: `Sua parte na despesa ficou em ${formatCentsAsBRL(summary.guestShareCents)}. Acesse o link para copiar o Pix:`,
          url: generatedLink,
        });
      } catch { /* cancelado */ }
    } else await handleCopyLinkAgain();
  };

  const isFormValid = totalCents > 0 && peopleCount >= 2 && pixKey.trim().length > 0 && merchantName.trim().length > 0 && merchantCity.trim().length > 0;

  useEffect(() => {
    if (!open || !autoGenerate || generatedLink || !isFormValid || createPublicShareMutation.isPending) return;
    const timer = setTimeout(() => void handleGenerateAndCopy(), 50);
    return () => clearTimeout(timer);
  }, [open, autoGenerate, generatedLink, isFormValid, createPublicShareMutation.isPending, handleGenerateAndCopy]);

  return {
    isPreconfigured, totalCents, setTotalCents, description, setDescription, peopleCount, isCustomMode, setIsCustomMode,
    participants, remainderPolicy, setRemainderPolicy, pixKey, setPixKey, selectedKeyType, setSelectedKeyType,
    merchantName, setMerchantName, merchantCity, setMerchantCity, detectedType, summary, generatedLink, copied,
    isFormValid, isPending: createPublicShareMutation.isPending,
    handlePeopleCountChange, handleParticipantNameChange, handleAddParticipant, handleRemoveParticipant,
    handleGenerateAndCopy, handleCopyLinkAgain, handleShareWhatsApp, handleShareNative,
  };
}
