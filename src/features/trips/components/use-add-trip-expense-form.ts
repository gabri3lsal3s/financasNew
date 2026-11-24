import { useMemo, useState, type ClipboardEvent } from "react";
import { parseDecimalNumber } from "@/domain/money";
import {
  inferCategoryKeyword,
  matchCategoryBySlug,
  parseClipboardTransactionCandidate,
  type CanonicalCategorySlug,
} from "@/domain/notifications";
import {
  convertForeignCentsToBrlCents,
  detectForeignCurrencyFromText,
  normalizeTripCurrencyCode,
  type TripForeignCurrencyCode,
} from "@/domain/trips";
import { calculateEqualSplits, calculateLinkedExpenseWeight } from "@/domain/trips/trip-math";
import { buildExpenseInstallments } from "@/features/transactions/wizard/wizard-state";
import { useAuth } from "@/hooks/use-auth";
import { todayISO } from "@/lib/date";
import { readClipboardText } from "@/services/clipboard";
import {
  getBankCardMapping,
  getCardDigitsMapping,
  getMerchantLearningMemory,
  recordTransactionLearning,
} from "@/services/merchant-learning";
import {
  resolveAndScanReceiptFile,
  resolveReceiptFromText,
  resolveReceiptTransaction,
  type ResolvedReceiptResult,
} from "@/services/receipt-resolution";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getUserStorageItem, setUserStorageItem } from "@/services/user-storage";
import {
  useCategories,
  useCreateExpense,
  useCreditCards,
  useLinkPersonalExpenseToTripMutation,
  useUpdateCustomSettings,
  useUserPreferences,
} from "@/state";
import { useAddTripExpenseMutation } from "@/state/queries/use-trips";
import type { Category } from "@/types";
import type { TripMember } from "@/types/trips";
import { buildTripCategoryOptions } from "./trip-expense-category-options";

const TRIP_FX_RATES_STORAGE_KEY = "trip_fx_rates_v1";

function loadSavedTripFxRate(tripId: string, currency: TripForeignCurrencyCode): string {
  try {
    const raw = getUserStorageItem(TRIP_FX_RATES_STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as Record<string, Record<string, string>>;
    return parsed?.[tripId]?.[currency] ?? "";
  } catch {
    return "";
  }
}

function saveTripFxRate(tripId: string, currency: TripForeignCurrencyCode, rateStr: string): void {
  try {
    const raw = getUserStorageItem(TRIP_FX_RATES_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Record<string, string>>) : {};
    const next = {
      ...parsed,
      [tripId]: {
        ...(parsed[tripId] ?? {}),
        [currency]: rateStr,
      },
    };
    setUserStorageItem(TRIP_FX_RATES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Falha silenciosa em storage restrito
  }
}

function mapSlugToTripCategoryName(
  slug: string | undefined,
  options: readonly { value: string; label: string }[],
  matchedPersonalCat?: Category,
): string | null {
  if (matchedPersonalCat) {
    const exactOption = options.find(
      (o) => o.value.toLowerCase() === matchedPersonalCat.name.toLowerCase(),
    );
    if (exactOption) return exactOption.value;
  }

  const slugMap: Record<string, string> = {
    alimentacao: "Alimentação",
    mercado: "Alimentação",
    restaurantes: "Alimentação",
    transporte: "Transporte",
    combustivel: "Transporte",
    moradia: "Hospedagem",
    lazer: "Lazer",
    compras: "Compras",
  };
  const targetName = slug ? slugMap[slug.toLowerCase()] : undefined;
  if (targetName) {
    const opt = options.find((o) => o.value.toLowerCase() === targetName.toLowerCase());
    if (opt) return opt.value;
  }
  return null;
}

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
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scanFeedbackMessage, setScanFeedbackMessage] = useState<string | null>(null);
  const [foreignCurrency, setForeignCurrency] = useState<TripForeignCurrencyCode | null>(null);
  const [foreignAmountCents, setForeignAmountCents] = useState<number>(0);
  const [exchangeRateInput, setExchangeRateInput] = useState<string>("");
  const [scannedReceiptMeta, setScannedReceiptMeta] = useState<{
    merchant?: string;
    taxId?: string;
    cardLastDigits?: string;
    semanticTags?: string[];
  } | null>(null);

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
    setIsScanningReceipt(false);
    setScanFeedbackMessage(null);
    setForeignCurrency(null);
    setForeignAmountCents(0);
    setExchangeRateInput("");
    setScannedReceiptMeta(null);
  };

  const applyResolvedReceipt = (resolved: ResolvedReceiptResult, rawTextForCurrency?: string) => {
    const { parsed, identity, matchedCard, installmentCount } = resolved;
    const nextDescription = identity.friendlyName || parsed.description || "";
    if (nextDescription) {
      setDescription(nextDescription);
    }
    if (parsed.date) {
      setExpenseDate(parsed.date);
    }

    let matchedCat: Category | undefined;
    if (allExpenseCategories.length > 0) {
      if (identity.isLearned && identity.categorySlug) {
        matchedCat = matchCategoryBySlug(allExpenseCategories, identity.categorySlug);
      }
      if (!matchedCat && parsed.aiCategoryId) {
        matchedCat = allExpenseCategories.find((c) => c.id === parsed.aiCategoryId);
      }
      if (!matchedCat) {
        const slugCandidate =
          (!identity.isLearned ? identity.categorySlug : undefined) || parsed.categorySlug;
        if (slugCandidate) {
          matchedCat = matchCategoryBySlug(
            allExpenseCategories,
            slugCandidate as CanonicalCategorySlug,
          );
        }
      }
      if (!matchedCat && nextDescription) {
        const inferred = inferCategoryKeyword(nextDescription);
        if (inferred) {
          matchedCat = matchCategoryBySlug(allExpenseCategories, inferred);
        }
      }
      if (matchedCat) {
        setSelectedPersonalCategoryId(matchedCat.id);
      }
    }

    const mappedTripCat = mapSlugToTripCategoryName(
      matchedCat?.name || identity.categorySlug || parsed.categorySlug,
      tripCategoryOptions,
      matchedCat,
    );
    if (mappedTripCat) {
      setSelectedCategoryName(mappedTripCat);
    }

    const aiCurrency = normalizeTripCurrencyCode(parsed.originalCurrency);
    const detectedCurrency =
      aiCurrency && aiCurrency !== "BRL"
        ? aiCurrency
        : detectForeignCurrencyFromText(
            rawTextForCurrency || parsed.rawText || parsed.description,
          );

    if (detectedCurrency) {
      const origCents =
        parsed.originalAmountCents && parsed.originalAmountCents > 0
          ? parsed.originalAmountCents
          : parsed.amountCents;
      const savedRateStr = loadSavedTripFxRate(tripId, detectedCurrency);
      const savedRateNum = savedRateStr ? parseDecimalNumber(savedRateStr) : 0;

      setForeignCurrency(detectedCurrency);
      setForeignAmountCents(origCents);
      setExchangeRateInput(savedRateStr);

      if (savedRateNum > 0 && origCents > 0) {
        setAmountCents(convertForeignCentsToBrlCents(origCents, savedRateNum));
      } else if (
        parsed.originalAmountCents &&
        parsed.originalAmountCents > 0 &&
        parsed.amountCents > 0 &&
        parsed.amountCents !== parsed.originalAmountCents
      ) {
        const impliedRate = (parsed.amountCents / parsed.originalAmountCents).toFixed(2);
        setExchangeRateInput(impliedRate.replace(".", ","));
        setAmountCents(parsed.amountCents);
      } else {
        setAmountCents(0);
      }
    } else {
      setForeignCurrency(null);
      setForeignAmountCents(0);
      setExchangeRateInput("");
      if (parsed.amountCents > 0) {
        setAmountCents(parsed.amountCents);
      }
    }

    if (matchedCard && availableCards.some((c) => c.id === matchedCard.id)) {
      setPersonalCardId(matchedCard.id);
      setPersonalPaymentMethod("credit_card");
    } else if (parsed.paymentMethod === "credit_card") {
      setPersonalPaymentMethod("credit_card");
    } else if (parsed.paymentMethod === "debit") {
      setPersonalPaymentMethod("debit");
    } else if (parsed.paymentMethod === "cash") {
      setPersonalPaymentMethod("cash");
    } else if (parsed.paymentMethod === "pix") {
      setPersonalPaymentMethod("pix");
    }

    if (installmentCount && installmentCount > 1) {
      setPersonalInstallmentsCount(installmentCount);
      setPersonalPaymentMethod("credit_card");
    }

    setScannedReceiptMeta({
      merchant: nextDescription || undefined,
      taxId: parsed.taxId || identity.taxId,
      cardLastDigits: parsed.cardLastDigits,
      semanticTags: parsed.semanticTags ?? identity.semanticTags,
    });
    setScanFeedbackMessage(null);
    triggerSensory("success");
    pushToast({
      title: detectedCurrency
        ? `Comprovante em ${detectedCurrency} lido`
        : `${resolved.kindLabel} lido`,
      description: detectedCurrency
        ? `${nextDescription || "Recibo"} — informe ou confirme a cotação para converter para R$.`
        : `${nextDescription || "Recibo"} preenchido automaticamente.`,
      variant: "success",
    });
  };

  const handleReceiptFileSelect = async (file: File) => {
    setIsScanningReceipt(true);
    setScanFeedbackMessage(null);
    try {
      const result = await resolveAndScanReceiptFile(file, {
        isManualAttachment: true,
        preferFastAiVisionForWebImages: true,
        userId: session?.user?.id,
        userMemory: getMerchantLearningMemory(),
        cardDigitsMapping: getCardDigitsMapping(),
        bankCardMapping: getBankCardMapping(),
        cards: availableCards,
        categories: allExpenseCategories.map((c) => ({
          id: c.id,
          name: c.name,
          type: "expense" as const,
        })),
      });

      if (!result.ok || !result.parsed || !result.identity) {
        setScanFeedbackMessage(
          result.errorMessage ||
            "Não foi possível ler o recibo automaticamente. Preencha os campos manualmente.",
        );
        return;
      }

      applyResolvedReceipt(
        {
          parsed: result.parsed,
          identity: result.identity,
          matchedCard: result.matchedCard,
          kindLabel: result.kindLabel || "Comprovante",
          installmentCount: result.parsed.installments,
        },
        result.extractedText,
      );
    } catch {
      setScanFeedbackMessage("Falha ao processar o recibo. Preencha os campos manualmente.");
    } finally {
      setIsScanningReceipt(false);
    }
  };

  const resolvePastedTextReceipt = (rawText: string): boolean => {
    const trimmed = rawText.trim();
    if (!trimmed || trimmed.length < 6) return false;

    const resolveOpts = {
      isManualAttachment: true,
      cards: availableCards,
      userMemory: getMerchantLearningMemory(),
      cardDigitsMapping: getCardDigitsMapping(),
      bankCardMapping: getBankCardMapping(),
    };

    const resolvedFromText = resolveReceiptFromText(trimmed, resolveOpts);
    if (resolvedFromText) {
      applyResolvedReceipt(resolvedFromText, trimmed);
      return true;
    }

    const candidate = parseClipboardTransactionCandidate(trimmed);
    if (candidate && candidate.valueCents > 0) {
      const resolved = resolveReceiptTransaction(
        {
          id: `trip_clip_${Date.now()}`,
          bankName: "Pix",
          nature: "expense",
          type: "expense",
          amountCents: candidate.valueCents,
          description: candidate.description,
          merchant: candidate.merchant,
          recipientName: candidate.recipientName,
          pixKey: candidate.pixKey,
          taxId: candidate.taxId,
          date: candidate.date || todayISO(),
          paymentMethod:
            candidate.paymentMethod === "boleto"
              ? "other"
              : candidate.paymentMethod === "debit_card"
                ? "debit"
                : candidate.paymentMethod,
          rawText: trimmed,
          timestamp: Date.now(),
        },
        resolveOpts,
      );
      applyResolvedReceipt(resolved, trimmed);
      return true;
    }

    return false;
  };

  const handlePasteClipboard = async () => {
    setScanFeedbackMessage(null);
    const clip = await readClipboardText();
    if (clip.status !== "success") {
      setScanFeedbackMessage(
        "Área de transferência vazia ou sem permissão. Copie o texto do Pix/recibo ou envie o arquivo.",
      );
      return;
    }
    if (!resolvePastedTextReceipt(clip.text)) {
      setScanFeedbackMessage("Não foi possível reconhecer valor ou estabelecimento no texto colado.");
    }
  };

  const handleFormPaste = (event: ClipboardEvent<HTMLFormElement>) => {
    const file = event.clipboardData?.files?.[0];
    if (file) {
      event.preventDefault();
      void handleReceiptFileSelect(file);
      return;
    }
    const targetTag = (event.target as HTMLElement | null)?.tagName;
    if (targetTag === "INPUT" || targetTag === "TEXTAREA") {
      return;
    }
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (text.trim().length >= 8 && resolvePastedTextReceipt(text)) {
      event.preventDefault();
    }
  };

  const handleForeignCurrencyChange = (nextCurrency: TripForeignCurrencyCode) => {
    setForeignCurrency(nextCurrency);
    const saved = loadSavedTripFxRate(tripId, nextCurrency);
    const rateToUse = saved || exchangeRateInput;
    if (saved) setExchangeRateInput(saved);
    const parsedRate = parseDecimalNumber(rateToUse);
    if (foreignAmountCents > 0 && parsedRate > 0) {
      setAmountCents(convertForeignCentsToBrlCents(foreignAmountCents, parsedRate));
    }
  };

  const handleForeignAmountCentsChange = (nextForeignCents: number) => {
    setForeignAmountCents(nextForeignCents);
    const parsedRate = parseDecimalNumber(exchangeRateInput);
    if (nextForeignCents > 0 && parsedRate > 0) {
      setAmountCents(convertForeignCentsToBrlCents(nextForeignCents, parsedRate));
    }
  };

  const handleExchangeRateChange = (nextRateStr: string) => {
    setExchangeRateInput(nextRateStr);
    const parsedRate = parseDecimalNumber(nextRateStr);
    if (foreignCurrency && parsedRate > 0) {
      saveTripFxRate(tripId, foreignCurrency, nextRateStr);
      if (foreignAmountCents > 0) {
        setAmountCents(convertForeignCentsToBrlCents(foreignAmountCents, parsedRate));
      }
    }
  };

  const clearForeignCurrency = () => {
    setForeignCurrency(null);
    setForeignAmountCents(0);
    setExchangeRateInput("");
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

      if (isCurrentUserPayer && description.trim() && resolvedPersonalCategoryId) {
        recordTransactionLearning({
          merchant: scannedReceiptMeta?.merchant || description.trim(),
          categoryId: resolvedPersonalCategoryId,
          paymentMethod: personalPaymentMethod,
          cardId: personalPaymentMethod === "credit_card" ? selectedPersonalCard?.id : undefined,
          cardLastDigits: scannedReceiptMeta?.cardLastDigits,
          taxId: scannedReceiptMeta?.taxId,
          semanticTags: scannedReceiptMeta?.semanticTags,
          nature: "expense",
        });
      }

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
    isScanningReceipt,
    scanFeedbackMessage,
    foreignCurrency,
    foreignAmountCents,
    exchangeRateInput,
    handleReceiptFileSelect,
    handlePasteClipboard,
    handleFormPaste,
    handleForeignCurrencyChange,
    handleForeignAmountCentsChange,
    handleExchangeRateChange,
    clearForeignCurrency,
    handleSubmit,
  };
}
