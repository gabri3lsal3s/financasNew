import { useState, type ClipboardEvent } from "react";
import { ArrowRight, ClipboardPaste, FileUp, Loader2 } from "lucide-react";
import { Alert, Button, Dropzone, Modal, ModalFooter, Textarea } from "@/components/ui";
import { toISODate } from "@/domain/money";
import {
  parseClipboardTransactionCandidate,
  type ParsedBankTransaction,
  type ReceiptUserContext,
} from "@/domain/notifications";
import { readClipboardText } from "@/services/clipboard";
import { formatCentsAsCurrency } from "@/services/masks";
import {
  useBankCardMapping,
  useCardDigitsMapping,
  useMerchantLearning,
} from "@/services/merchant-learning";
import { MAX_RECEIPT_FILE_SIZE_BYTES, addPendingSuggestion } from "@/services/native";
import { consumeCurrentDetectedPix } from "@/services/pix-clipboard-store";
import {
  resolveAndScanReceiptFile,
  resolveReceiptFromText,
  resolveReceiptTransaction,
} from "@/services/receipt-resolution";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { CreditCard } from "@/types/schema";

export interface AttachReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onParsed?: (parsed: ParsedBankTransaction) => void;
  onNavigateToStatementImport?: () => void;
  userContext?: ReceiptUserContext;
  userId?: string | null;
  cards?: CreditCard[];
  isReadOnlyMode?: boolean;
  aiExtractionEnabled?: boolean;
}

/** Diálogo de "Anexar Comprovante": processa PDF/imagem ou texto Pix/notificação via `receipt-resolution`. */
export function AttachReceiptDialog({
  open,
  onOpenChange,
  onParsed,
  onNavigateToStatementImport,
  userContext,
  userId,
  cards,
  isReadOnlyMode,
  aiExtractionEnabled,
}: AttachReceiptDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [multiStatementMessage, setMultiStatementMessage] = useState<string | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [manualText, setManualText] = useState("");

  const { memory: userMemory } = useMerchantLearning();
  const { cardDigitsMapping } = useCardDigitsMapping();
  const { bankCardMapping } = useBankCardMapping();

  const resolutionOptions = {
    cards,
    isManualAttachment: true,
    userContext,
    userId,
    userMemory,
    cardDigitsMapping,
    bankCardMapping,
    isReadOnlyMode,
    aiFallbackEnabled: aiExtractionEnabled ?? true,
  };

  const handleClose = () => {
    if (loading) return;
    setError(null);
    setMultiStatementMessage(null);
    setShowTextInput(false);
    setManualText("");
    onOpenChange(false);
  };

  const notifySuccess = (parsed: ParsedBankTransaction, kindLabel: string) => {
    triggerSensory("success");
    const description =
      parsed.amountCents > 0
        ? `${parsed.description} no valor de ${formatCentsAsCurrency(parsed.amountCents)} pronto para conferência.`
        : `${parsed.description} pronto — informe o valor no lançamento rápido.`;
    pushToast({
      title: `${kindLabel} reconhecido`,
      description,
      variant: parsed.amountCents > 0 ? "success" : "default",
    });
    if (onParsed) onParsed(parsed);
    else addPendingSuggestion(parsed);
    handleClose();
  };

  const handleProcessText = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      triggerSensory("warning");
      setError(
        "Não foi possível ler o texto informado. Certifique-se de que contenha informações de pagamento Pix ou bancário.",
      );
      return;
    }

    setError(null);
    setMultiStatementMessage(null);
    setLoading(true);
    try {
      const clipCandidate = parseClipboardTransactionCandidate(trimmed);
      if (
        clipCandidate &&
        (clipCandidate.kind === "PIX_BRCODE" || clipCandidate.kind === "PIX_KEY")
      ) {
        const candidateTx: ParsedBankTransaction = {
          id: `pix_clip_${Date.now()}`,
          bankName: "Pix",
          nature: clipCandidate.nature,
          type: clipCandidate.nature,
          amountCents: clipCandidate.valueCents,
          description: clipCandidate.description,
          merchant: clipCandidate.merchant,
          recipientName: clipCandidate.recipientName,
          pixKey: clipCandidate.pixKey,
          taxId: clipCandidate.taxId,
          date: clipCandidate.date || toISODate(new Date()),
          paymentMethod: "pix",
          timestamp: Date.now(),
          rawText: trimmed,
          confidence:
            clipCandidate.kind === "PIX_BRCODE" && clipCandidate.valueCents > 0
              ? "high"
              : "medium",
          fieldConfidence: {
            amount: clipCandidate.valueCents > 0 ? "high" : "low",
            counterparty:
              clipCandidate.recipientName || clipCandidate.merchant
                ? "high"
                : clipCandidate.kind === "PIX_KEY"
                  ? "medium"
                  : "low",
            nature: "high",
            date: clipCandidate.date ? "high" : "low",
          },
          extractionSource: "local_deterministic",
        };
        const resolvedClip = resolveReceiptTransaction(candidateTx, resolutionOptions);
        consumeCurrentDetectedPix(trimmed, userId);
        notifySuccess(
          resolvedClip.parsed,
          clipCandidate.kind === "PIX_BRCODE" ? "Pix Copia e Cola" : "Chave Pix",
        );
        return;
      }

      const resolved = resolveReceiptFromText(trimmed, resolutionOptions);
      if (resolved) {
        consumeCurrentDetectedPix(trimmed, userId);
        notifySuccess(resolved.parsed, resolved.kindLabel);
      } else {
        triggerSensory("warning");
        setError(
          "Não foi possível identificar informações financeiras válidas (valor, data e destinatário) no comprovante. Verifique o arquivo e tente novamente.",
        );
      }
    } catch {
      triggerSensory("warning");
      setError("Ocorreu uma falha inesperada ao processar o comprovante. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleProcessFile = async (file: File) => {
    if (!file) return;
    setError(null);
    setMultiStatementMessage(null);
    setLoading(true);
    try {
      const result = await resolveAndScanReceiptFile(file, resolutionOptions);
      if (result.ok && result.parsed) {
        notifySuccess(result.parsed, result.kindLabel ?? "Comprovante");
      } else if (result.status === "multi_statement") {
        triggerSensory("warning");
        setMultiStatementMessage(
          result.errorMessage ??
            "Este documento parece ser um extrato ou fatura com vários lançamentos. Use a importação em lote na tela de Cartões.",
        );
      } else {
        triggerSensory("warning");
        setError(
          result.errorMessage ??
            "Ocorreu uma falha inesperada ao ler o arquivo do comprovante. Tente novamente.",
        );
      }
    } catch {
      triggerSensory("warning");
      setError("Ocorreu uma falha inesperada ao ler o arquivo do comprovante. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    setError(null);
    setMultiStatementMessage(null);
    try {
      const clipResult = await readClipboardText();
      if (clipResult.status === "success" && clipResult.text?.trim()) {
        await handleProcessText(clipResult.text);
      } else {
        setShowTextInput(true);
      }
    } catch {
      setShowTextInput(true);
    }
  };

  const handleDialogPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData?.files ?? []);
    const imageFile = files.find((f) => f.type.startsWith("image/"));
    if (imageFile) {
      event.preventDefault();
      void handleProcessFile(imageFile);
      return;
    }

    const targetTag = (event.target as HTMLElement | null)?.tagName;
    if (targetTag === "TEXTAREA" || targetTag === "INPUT") {
      return;
    }

    const pastedText = event.clipboardData?.getData("text")?.trim();
    if (pastedText) {
      event.preventDefault();
      void handleProcessText(pastedText);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}
      title="Anexar Comprovante ou Cupom"
      description="Identificação automática de cupons fiscais (DANFE NFC-e / SAT), comprovantes Pix, cartões com parcelamento, boletos bancários e carnês em PDF ou foto."
      size="md"
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-4 py-1" onPaste={handleDialogPaste}>
        {error ? <Alert variant="error">{error}</Alert> : null}

        {multiStatementMessage ? (
          <Alert variant="info">
            <div className="flex flex-col gap-2">
              <span>{multiStatementMessage}</span>
              {onNavigateToStatementImport ? (
                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      handleClose();
                      onNavigateToStatementImport();
                    }}
                    className="gap-1.5"
                  >
                    <span>Ir para importação de fatura</span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </div>
          </Alert>
        ) : null}

        {loading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/80 bg-surface-raised p-8 text-center animate-in fade-in duration-150"
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary-strong">
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-foreground">
                Lendo dados do comprovante...
              </span>
              <span className="text-xs text-muted-foreground">
                Identificando tipo de comprovante, valor, parcelamento e cartão para o Wizard Rápido
              </span>
            </div>
          </div>
        ) : (
          <Dropzone
            accept="image/png,image/jpeg,image/jpg,image/webp,image/avif,application/pdf,.png,.jpg,.jpeg,.webp,.avif,.pdf"
            maxSizeBytes={MAX_RECEIPT_FILE_SIZE_BYTES}
            label="Arraste o comprovante aqui ou toque para selecionar"
            hint="Formatos aceitos: PDF digital, PDF escaneado, PNG, JPG, WebP ou AVIF (até 15 MB) · ou cole com Ctrl+V"
            enableCamera={true}
            onFiles={(files) => {
              if (files[0]) void handleProcessFile(files[0]);
            }}
            onFileRejected={(_file, reason) => {
              if (reason === "too-large") {
                triggerSensory("warning");
                setError(
                  "O arquivo selecionado excede o limite de 15 MB. Envie um comprovante mais leve.",
                );
              }
            }}
            extraActions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handlePasteFromClipboard()}
                className="gap-1.5 border-primary/30 text-primary-strong hover:bg-primary/5"
              >
                <ClipboardPaste className="size-3.5" aria-hidden="true" />
                <span>Colar comprovante Pix</span>
              </Button>
            }
          />
        )}

        {showTextInput && !loading ? (
          <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5">
            <label htmlFor="manual-receipt-text" className="text-xs font-semibold text-foreground">
              Cole o texto do comprovante ou notificação bancária
            </label>
            <Textarea
              id="manual-receipt-text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Cole aqui o texto do Pix, chave Pix, boleto ou notificação..."
              rows={4}
              className="font-mono resize-none"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowTextInput(false)}>
                Ocultar
              </Button>
              <Button
                type="button"
                size="sm"
                sensoryIntent={false}
                disabled={!manualText.trim()}
                onClick={() => void handleProcessText(manualText)}
                className="gap-1.5 font-semibold"
              >
                <ClipboardPaste className="size-3.5" aria-hidden="true" />
                <span>Reconhecer Pix</span>
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2 rounded-lg bg-surface-raised px-3 py-2.5 text-[11px] text-muted-foreground">
          <FileUp className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            Compatível com cupons fiscais com múltiplos itens, Pix Copia e Cola, chaves Pix,
            comprovantes bancários, slips de maquininhas em até 60x e boletos/carnês.
          </span>
        </div>
      </div>
    </Modal>
  );
}
