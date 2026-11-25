import { useCallback, useEffect, useRef, useState } from "react";
import { toISODate } from "@/domain/money";
import {
  parseClipboardTransactionCandidate,
  type ParsedBankTransaction,
  type ReceiptUserContext,
} from "@/domain/notifications";
import type { AiCategoryOptionInput } from "@/services/ai-assistant";
import { readClipboardText } from "@/services/clipboard";
import {
  useBankCardMapping,
  useCardDigitsMapping,
  useMerchantLearning,
} from "@/services/merchant-learning";
import { consumeCurrentDetectedPix } from "@/services/pix-clipboard-store";
import type { CreditCard } from "@/types/schema";
import {
  resolveAndScanReceiptFile,
  resolveReceiptFromText,
  type ScanReceiptFileResult,
} from "./receipt-pipeline";
import { resolveReceiptTransaction } from "./receipt-vision-runner";

export interface UseReceiptIngestionParams {
  userContext?: ReceiptUserContext;
  userId?: string | null;
  cards?: CreditCard[];
  categories?: readonly AiCategoryOptionInput[];
  isReadOnlyMode?: boolean;
  aiExtractionEnabled?: boolean;
  onSuccess: (
    parsed: ParsedBankTransaction,
    kindLabel: string,
    scanResult?: ScanReceiptFileResult,
  ) => void;
}

export function buildClipboardCandidateParsedTransaction(
  candidate: NonNullable<ReturnType<typeof parseClipboardTransactionCandidate>>,
  rawText: string,
): ParsedBankTransaction {
  const isBoleto = candidate.paymentMethod === "boleto";
  const hasCounterparty = Boolean(candidate.recipientName || candidate.merchant);
  const amountConfidence = candidate.valueCents > 0 ? "high" : "low";
  const counterpartyConfidence = hasCounterparty
    ? "high"
    : candidate.kind === "PIX_KEY"
      ? "medium"
      : "low";
  const overallConfidence =
    candidate.kind === "PIX_BRCODE" && candidate.valueCents > 0
      ? "high"
      : candidate.kind === "PIX_KEY"
        ? "medium"
        : candidate.confidence;

  return {
    id: `${isBoleto ? "boleto_clip" : "pix_clip"}_${Date.now()}`,
    bankName: isBoleto ? candidate.merchant || "Boleto Bancário" : "Pix",
    nature: candidate.nature,
    type: candidate.nature,
    amountCents: candidate.valueCents,
    description: candidate.description,
    merchant: candidate.merchant,
    recipientName: candidate.recipientName,
    pixKey: candidate.pixKey,
    taxId: candidate.taxId,
    date: candidate.date || toISODate(new Date()),
    dueDate: isBoleto ? candidate.date : undefined,
    documentStatus: isBoleto ? "pending_due" : undefined,
    receiptKind: isBoleto ? "bank_slip_payment" : undefined,
    paymentMethod:
      candidate.paymentMethod === "debit_card"
        ? "debit"
        : candidate.paymentMethod === "boleto"
          ? "other"
          : candidate.paymentMethod,
    timestamp: Date.now(),
    rawText,
    confidence: overallConfidence,
    fieldConfidence: {
      amount: amountConfidence,
      counterparty: counterpartyConfidence,
      nature: "high",
      date: candidate.date ? "high" : "low",
    },
    extractionSource: "local_deterministic",
  };
}

/**
 * Hook unificado de ingestão de comprovantes, boletos e cupons fiscais.
 * Espelha a ergonomia de `useStatementIngestion` (cancelamento real via AbortController,
 * desbloqueio de PDF protegido por senha e feedback calmo por etapa).
 */
export function useReceiptIngestion({
  userContext,
  userId,
  cards,
  categories,
  isReadOnlyMode,
  aiExtractionEnabled,
  onSuccess,
}: UseReceiptIngestionParams) {
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [multiStatementMessage, setMultiStatementMessage] = useState<string | null>(null);
  const [pendingPasswordFile, setPendingPasswordFile] = useState<File | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const { memory: userMemory } = useMerchantLearning();
  const { cardDigitsMapping } = useCardDigitsMapping();
  const { bankCardMapping } = useBankCardMapping();

  const abortControllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const cancelProcessing = useCallback(() => {
    runIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    setProgressMessage(null);
  }, []);

  const reset = useCallback(() => {
    cancelProcessing();
    setError(null);
    setMultiStatementMessage(null);
    setPendingPasswordFile(null);
    setPasswordError(null);
  }, [cancelProcessing]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const buildResolutionOptions = useCallback(
    () => ({
      cards,
      categories,
      isManualAttachment: true,
      userContext,
      userId,
      userMemory,
      cardDigitsMapping,
      bankCardMapping,
      isReadOnlyMode,
      aiFallbackEnabled: aiExtractionEnabled ?? true,
      preferFastAiVisionForWebImages: true,
    }),
    [
      aiExtractionEnabled,
      bankCardMapping,
      cardDigitsMapping,
      cards,
      categories,
      isReadOnlyMode,
      userContext,
      userId,
      userMemory,
    ],
  );

  const processText = useCallback(
    (rawText: string): { ok: true; parsed: ParsedBankTransaction; kindLabel: string } | { ok: false; errorMessage: string } => {
      const trimmed = rawText.trim();
      if (!trimmed) {
        return {
          ok: false,
          errorMessage:
            "Não foi possível ler o texto informado. Certifique-se de que contenha informações de Pix, boleto ou cupom.",
        };
      }

      const resolutionOptions = buildResolutionOptions();
      const clipCandidate = parseClipboardTransactionCandidate(trimmed);
      if (
        clipCandidate &&
        (clipCandidate.kind === "PIX_BRCODE" ||
          clipCandidate.kind === "PIX_KEY" ||
          clipCandidate.paymentMethod === "boleto")
      ) {
        const candidateTx = buildClipboardCandidateParsedTransaction(clipCandidate, trimmed);
        const resolvedClip = resolveReceiptTransaction(candidateTx, resolutionOptions);
        consumeCurrentDetectedPix(trimmed, userId);
        const kindLabel =
          clipCandidate.kind === "PIX_BRCODE"
            ? "Pix Copia e Cola"
            : clipCandidate.kind === "PIX_KEY"
              ? "Chave Pix"
              : "Boleto Bancário";
        onSuccess(resolvedClip.parsed, kindLabel);
        return { ok: true, parsed: resolvedClip.parsed, kindLabel };
      }

      const resolved = resolveReceiptFromText(trimmed, resolutionOptions);
      if (resolved) {
        consumeCurrentDetectedPix(trimmed, userId);
        onSuccess(resolved.parsed, resolved.kindLabel);
        return { ok: true, parsed: resolved.parsed, kindLabel: resolved.kindLabel };
      }

      return {
        ok: false,
        errorMessage:
          "Não foi possível identificar informações financeiras válidas (valor, data e destinatário) no texto informado. Verifique e tente novamente.",
      };
    },
    [buildResolutionOptions, onSuccess, userId],
  );

  const handleProcessText = useCallback(
    async (rawText: string): Promise<boolean> => {
      setError(null);
      setMultiStatementMessage(null);
      setPendingPasswordFile(null);
      setPasswordError(null);
      const result = processText(rawText);
      if (!result.ok) {
        setError(result.errorMessage);
        return false;
      }
      return true;
    },
    [processText],
  );

  const handleProcessFile = useCallback(
    async (file: File, pdfPassword?: string): Promise<ScanReceiptFileResult | null> => {
      if (!file) return null;

      const runId = ++runIdRef.current;
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setError(null);
      setMultiStatementMessage(null);
      setPasswordError(null);
      if (!pdfPassword) {
        setPendingPasswordFile(null);
      }
      setLoading(true);
      setProgressMessage(pdfPassword ? "Desbloqueando PDF..." : "Lendo documento...");

      try {
        const result = await resolveAndScanReceiptFile(file, {
          ...buildResolutionOptions(),
          pdfPassword,
          signal: controller.signal,
          onProgress: (_stage, msg) => {
            if (runIdRef.current === runId && !controller.signal.aborted) {
              setProgressMessage(msg);
            }
          },
        });

        if (runIdRef.current !== runId || controller.signal.aborted || result.status === "cancelled") {
          return null;
        }

        if (result.ok && result.parsed) {
          setPendingPasswordFile(null);
          setPasswordError(null);
          onSuccess(result.parsed, result.kindLabel ?? "Comprovante", result);
          return result;
        }

        if (result.status === "password_required") {
          setPendingPasswordFile(file);
          setPasswordError(pdfPassword ? result.errorMessage ?? "Senha incorreta. Tente novamente." : null);
          return result;
        }

        if (result.status === "multi_statement") {
          setMultiStatementMessage(
            result.errorMessage ??
              "Este documento parece ser um extrato ou fatura com vários lançamentos. Use a importação em lote na tela de Cartões.",
          );
          return result;
        }

        setError(
          result.errorMessage ??
            "Ocorreu uma falha inesperada ao ler o arquivo do comprovante. Tente novamente.",
        );
        return result;
      } catch {
        if (runIdRef.current !== runId || controller.signal.aborted) {
          return null;
        }
        setError("Ocorreu uma falha inesperada ao ler o arquivo do comprovante. Tente novamente.");
        return null;
      } finally {
        if (runIdRef.current === runId) {
          setLoading(false);
          setProgressMessage(null);
        }
      }
    },
    [buildResolutionOptions, onSuccess],
  );

  const handlePasswordSubmit = useCallback(
    async (password: string): Promise<void> => {
      if (!pendingPasswordFile || !password.trim()) return;
      await handleProcessFile(pendingPasswordFile, password);
    },
    [handleProcessFile, pendingPasswordFile],
  );

  const handlePasswordCancel = useCallback(() => {
    setPendingPasswordFile(null);
    setPasswordError(null);
    setError(null);
  }, []);

  const readAndProcessClipboard = useCallback(async (): Promise<"processed" | "empty_or_unrecognized"> => {
    setError(null);
    setMultiStatementMessage(null);
    try {
      const clipResult = await readClipboardText();
      if (clipResult.status === "success" && clipResult.text?.trim()) {
        const ok = await handleProcessText(clipResult.text);
        if (ok) return "processed";
      }
    } catch {
      // Fallback para abertura da aba de colagem manual
    }
    return "empty_or_unrecognized";
  }, [handleProcessText]);

  return {
    loading,
    progressMessage,
    error,
    setError,
    multiStatementMessage,
    pendingPasswordFile,
    passwordError,
    processText,
    handleProcessText,
    handleProcessFile,
    handlePasswordSubmit,
    handlePasswordCancel,
    cancelProcessing,
    readAndProcessClipboard,
    reset,
  };
}
