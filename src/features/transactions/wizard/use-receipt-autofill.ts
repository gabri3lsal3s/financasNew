import { useCallback, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  extractLastFourDigits,
  inferCategoryKeyword,
  matchCategoryBySlug,
  parseClipboardTransactionCandidate,
  resolveBestMatchingCard,
  type CanonicalCategorySlug,
  type ParsedBankTransaction,
  type ReceiptUserContext,
  type UniversalReceiptData,
} from "@/domain/notifications";
import { readClipboardText } from "@/services/clipboard";
import {
  useBankCardMapping,
  useCardDigitsMapping,
  useMerchantLearning,
} from "@/services/merchant-learning";
import { getBankAssistantPreferences } from "@/services/native";
import { consumeCurrentDetectedPix } from "@/services/pix-clipboard-store";
import {
  buildClipboardCandidateParsedTransaction,
  resolveAndScanReceiptFile,
  resolveReceiptFromText,
  resolveReceiptTransaction,
  type ScanReceiptFileResult,
} from "@/services/receipt-resolution";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { Category, CreditCard } from "@/types";
import { applyResolvedReceiptToLaunchState } from "./wizard-mappers";
import type { LaunchState, ReceiptMeta, WizardMode } from "./wizard-types";

export interface UseReceiptAutofillParams {
  state: LaunchState;
  setState: Dispatch<SetStateAction<LaunchState>>;
  setMode: Dispatch<SetStateAction<WizardMode>>;
  setIsCategoryUnconfirmed: Dispatch<SetStateAction<boolean>>;
  setReceiptMeta: Dispatch<SetStateAction<ReceiptMeta | null>>;
  categories: Category[] | undefined;
  allCategories?: Category[];
  cards: CreditCard[] | undefined;
  initialValues?: Partial<LaunchState>;
  detectedPix: {
    candidate: ReturnType<typeof parseClipboardTransactionCandidate>;
    rawText: string;
  } | null;
  clearDetectedPix: () => void;
  onOpenAttachDialog: () => void;
  userContext?: ReceiptUserContext;
  userId?: string | null;
  isReadOnlyMode?: boolean;
  aiExtractionEnabled?: boolean;
}

export function useReceiptAutofill({
  state,
  setState,
  setMode,
  setIsCategoryUnconfirmed,
  setReceiptMeta,
  categories,
  allCategories,
  cards,
  initialValues,
  detectedPix,
  clearDetectedPix,
  onOpenAttachDialog,
  userContext,
  userId,
  isReadOnlyMode,
  aiExtractionEnabled,
}: UseReceiptAutofillParams) {
  const merchantLearning = useMerchantLearning();
  const cardDigits = useCardDigitsMapping();
  const bankCard = useBankCardMapping();
  const effectiveCategories = allCategories ?? categories;

  useEffect(() => {
    const activeList = effectiveCategories?.some((c) => c.type === state.type)
      ? effectiveCategories.filter((c) => c.type === state.type)
      : categories;
    if (!activeList?.length || activeList.some((c) => c.id === state.categoryId)) return;

    const target = initialValues?.categoryId || state.categoryId;
    let matchedCategory = target
      ? activeList.find((c) => c.id === target) ||
        matchCategoryBySlug(activeList, target as CanonicalCategorySlug)
      : undefined;

    if (!matchedCategory && state.description) {
      const prefs = getBankAssistantPreferences();
      if (prefs.autoCategoryInferenceEnabled) {
        const slug = inferCategoryKeyword(state.description);
        if (slug) matchedCategory = matchCategoryBySlug(activeList, slug);
      }
    }

    if (matchedCategory) {
      const targetCategoryId = matchedCategory.id;
      const timer = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          categoryId: targetCategoryId,
          step: prev.valueCents > 0 && prev.step <= 2 ? 3 : prev.step,
        }));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [
    categories,
    effectiveCategories,
    initialValues?.categoryId,
    state.categoryId,
    state.description,
    state.type,
    setState,
  ]);

  useEffect(() => {
    if (state.type !== "expense" || state.paymentMethod !== "credit_card") return;
    if (!cards?.length || cards.some((c) => c.id === state.cardId)) return;

    const rawToken = initialValues?.cardId || state.cardId;
    const resolvedCard = resolveBestMatchingCard(cards, {
      cardId: rawToken,
      cardLastDigits: extractLastFourDigits(rawToken),
      bankName: rawToken,
      issuerBank: rawToken,
    });

    if (resolvedCard) {
      const targetCardId = resolvedCard.id;
      const timer = setTimeout(
        () => setState((prev) => ({ ...prev, cardId: targetCardId })),
        0,
      );
      return () => clearTimeout(timer);
    }
  }, [state.type, state.paymentMethod, state.cardId, initialValues?.cardId, cards, setState]);

  const handleReceiptParsed = useCallback(
    (
      parsed: ParsedBankTransaction | UniversalReceiptData,
      options?: { silentFeedback?: boolean },
    ) => {
      setMode("quick");
      const resolved = resolveReceiptTransaction(parsed, {
        cards,
        categories: effectiveCategories,
        userContext,
        userId,
        userMemory: merchantLearning.memory,
        cardDigitsMapping: cardDigits.cardDigitsMapping,
        bankCardMapping: bankCard.bankCardMapping,
      });

      const { parsed: enriched, identity, kindLabel } = resolved;
      const packageName =
        "packageName" in parsed && typeof parsed.packageName === "string"
          ? parsed.packageName
          : undefined;
      const needsAmountInput = enriched.amountCents === 0;

      const isBusinessDeduced =
        ("inferredScope" in enriched && enriched.inferredScope === "business") ||
        resolved.matchedCard?.scope === "business";
      const isDeductibleDeduced =
        "isTaxDeductible" in enriched && typeof enriched.isTaxDeductible === "boolean"
          ? enriched.isTaxDeductible
          : undefined;

      setReceiptMeta({
        merchant: identity.friendlyName || enriched.description,
        receiptKind: enriched.receiptKind,
        dueDate: enriched.dueDate,
        documentStatus: enriched.documentStatus,
        cardLastDigits: enriched.cardLastDigits,
        taxId: enriched.taxId || identity.taxId,
        packageName,
        pixKey: ("pixKey" in enriched ? enriched.pixKey : undefined) || identity.pixKey,
        confidence: enriched.confidence,
        confidenceScore: enriched.confidenceScore,
        fieldConfidence: enriched.fieldConfidence,
        isSameTitularity: enriched.isSameTitularity,
        needsAmountInput,
        semanticTags: enriched.semanticTags ?? identity.semanticTags,
        inferredScope: isBusinessDeduced ? "business" : undefined,
        isTaxDeductible: isDeductibleDeduced,
      });

      setState((prev) =>
        applyResolvedReceiptToLaunchState(prev, resolved, effectiveCategories, cards),
      );
      setIsCategoryUnconfirmed(!identity.isLearned);

      if (!options?.silentFeedback) {
        triggerSensory("success");
        const businessTag = isBusinessDeduced
          ? isDeductibleDeduced
            ? " (Modo Negócio • dedutível)"
            : " (Modo Negócio)"
          : "";
        pushToast({
          title: needsAmountInput
            ? `${kindLabel} preenchido${businessTag}`
            : `${kindLabel} reconhecido${businessTag}`,
          description: needsAmountInput
            ? `${identity.friendlyName || enriched.description} — informe o valor para concluir o lançamento.`
            : `${identity.friendlyName || enriched.description} preenchido no Wizard Rápido para conferência.`,
          variant: needsAmountInput ? "default" : "success",
        });
      }
    },
    [
      bankCard.bankCardMapping,
      cardDigits.cardDigitsMapping,
      cards,
      effectiveCategories,
      merchantLearning.memory,
      setIsCategoryUnconfirmed,
      setMode,
      setReceiptMeta,
      setState,
      userContext,
      userId,
    ],
  );

  const scanReceiptFile = useCallback(
    async (file: File): Promise<ScanReceiptFileResult> => {
      const result = await resolveAndScanReceiptFile(file, {
        cards,
        categories: effectiveCategories,
        isManualAttachment: true,
        userContext,
        userId,
        userMemory: merchantLearning.memory,
        cardDigitsMapping: cardDigits.cardDigitsMapping,
        bankCardMapping: bankCard.bankCardMapping,
        isReadOnlyMode,
        aiFallbackEnabled: aiExtractionEnabled,
        preferFastAiVisionForWebImages: true,
      });
      if (result.ok && result.parsed) handleReceiptParsed(result.parsed);
      return result;
    },
    [
      aiExtractionEnabled,
      bankCard.bankCardMapping,
      cardDigits.cardDigitsMapping,
      cards,
      effectiveCategories,
      handleReceiptParsed,
      isReadOnlyMode,
      merchantLearning.memory,
      userContext,
      userId,
    ],
  );

  const handlePasteText = useCallback(
    (rawText: string): boolean => {
      const trimmed = rawText.trim();
      if (!trimmed) return false;

      const candidate = parseClipboardTransactionCandidate(trimmed);
      if (
        candidate &&
        (candidate.kind === "PIX_BRCODE" ||
          candidate.kind === "PIX_KEY" ||
          candidate.paymentMethod === "boleto")
      ) {
        handleReceiptParsed(buildClipboardCandidateParsedTransaction(candidate, trimmed));
        consumeCurrentDetectedPix(trimmed, userId);
        return true;
      }

      const resolvedText = resolveReceiptFromText(trimmed, {
        cards,
        isManualAttachment: true,
        userContext,
        userId,
        userMemory: merchantLearning.memory,
        cardDigitsMapping: cardDigits.cardDigitsMapping,
        bankCardMapping: bankCard.bankCardMapping,
      });

      if (resolvedText) {
        handleReceiptParsed(resolvedText.parsed);
        consumeCurrentDetectedPix(trimmed, userId);
        return true;
      }

      return false;
    },
    [
      bankCard.bankCardMapping,
      cardDigits.cardDigitsMapping,
      cards,
      handleReceiptParsed,
      merchantLearning.memory,
      userContext,
      userId,
    ],
  );

  const handlePasteImageFile = useCallback(
    async (file: File): Promise<void> => {
      const result = await scanReceiptFile(file);
      if (result.ok) return;

      triggerSensory("warning");
      if (result.status === "multi_statement") {
        pushToast({
          title: "Arquivo com vários lançamentos",
          description:
            result.errorMessage ??
            "Use a importação em lote na tela de Cartões para extratos ou faturas.",
          variant: "default",
        });
        return;
      }

      if (result.errorMessage) {
        pushToast({
          title: "Não foi possível ler o print colado",
          description: result.errorMessage,
          variant: "destructive",
        });
      }
    },
    [scanReceiptFile],
  );

  const handlePastePixFromClipboard = useCallback(async () => {
    try {
      if (
        detectedPix?.candidate &&
        (detectedPix.candidate.kind === "PIX_BRCODE" ||
          detectedPix.candidate.kind === "PIX_KEY" ||
          detectedPix.candidate.valueCents > 0)
      ) {
        handleReceiptParsed(
          buildClipboardCandidateParsedTransaction(detectedPix.candidate, detectedPix.rawText),
        );
        clearDetectedPix();
        return;
      }

      const clipResult = await readClipboardText();
      if (clipResult.status === "success" && clipResult.text) {
        if (handlePasteText(clipResult.text)) {
          return;
        }
      }
      onOpenAttachDialog();
    } catch {
      onOpenAttachDialog();
    }
  }, [clearDetectedPix, detectedPix, handlePasteText, handleReceiptParsed, onOpenAttachDialog]);

  return {
    handleReceiptParsed,
    scanReceiptFile,
    handlePasteText,
    handlePasteImageFile,
    handlePastePixFromClipboard,
  };
}
