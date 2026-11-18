import { useState } from "react";
import { ClipboardPaste, FileUp, Loader2 } from "lucide-react";
import { Alert, Button, Dropzone, Modal, ModalFooter, Textarea } from "@/components/ui";
import { MAX_RECEIPT_FILE_SIZE_BYTES, addPendingSuggestion } from "@/services/native";
import { useBankCardMapping, useCardDigitsMapping, useMerchantLearning } from "@/services/merchant-learning";
import { resolveAndScanReceiptFile, resolveReceiptFromText } from "@/services/receipt-resolution";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { formatCentsAsCurrency } from "@/services/masks";
import type { ParsedBankTransaction } from "@/domain/notifications";
import type { CreditCard } from "@/types/schema";

export interface AttachReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onParsed?: (parsed: ParsedBankTransaction) => void;
  cards?: CreditCard[];
}

/** Diálogo de "Anexar Comprovante": processa PDF/imagem ou texto Pix/notificação via `receipt-resolution`. */
export function AttachReceiptDialog({ open, onOpenChange, onParsed, cards }: AttachReceiptDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [manualText, setManualText] = useState("");

  const { memory: userMemory } = useMerchantLearning();
  const { cardDigitsMapping } = useCardDigitsMapping();
  const { bankCardMapping } = useBankCardMapping();

  const resolutionOptions = { cards, isManualAttachment: true, userMemory, cardDigitsMapping, bankCardMapping };

  const handleClose = () => {
    if (loading) return;
    setError(null);
    setShowTextInput(false);
    setManualText("");
    onOpenChange(false);
  };

  const notifySuccess = (parsed: ParsedBankTransaction, kindLabel: string) => {
    triggerSensory("success");
    pushToast({
      title: `${kindLabel} reconhecido`,
      description: `${parsed.description} no valor de ${formatCentsAsCurrency(parsed.amountCents)} pronto para conferência.`,
      variant: "success",
    });
    if (onParsed) onParsed(parsed);
    else addPendingSuggestion(parsed);
    handleClose();
  };

  const handleProcessText = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      triggerSensory("warning");
      setError("Não foi possível ler o texto informado. Certifique-se de que contenha informações de pagamento Pix ou bancário.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const resolved = resolveReceiptFromText(trimmed, resolutionOptions);
      if (resolved) notifySuccess(resolved.parsed, resolved.kindLabel);
      else {
        triggerSensory("warning");
        setError("Não foi possível identificar informações financeiras válidas (valor, data e destinatário) no comprovante. Verifique o arquivo e tente novamente.");
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
    setLoading(true);
    try {
      const result = await resolveAndScanReceiptFile(file, resolutionOptions);
      if (result.ok && result.parsed) notifySuccess(result.parsed, result.kindLabel ?? "Comprovante");
      else {
        triggerSensory("warning");
        setError(result.errorMessage ?? "Ocorreu uma falha inesperada ao ler o arquivo do comprovante. Tente novamente.");
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
    try {
      if (!navigator.clipboard?.readText) { setShowTextInput(true); return; }
      const clipText = await navigator.clipboard.readText();
      if (clipText?.trim()) await handleProcessText(clipText);
      else setShowTextInput(true);
    } catch {
      setShowTextInput(true);
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
      <div className="flex flex-col gap-4 py-1">
        {error ? <Alert variant="error">{error}</Alert> : null}

        {loading ? (
          <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/80 bg-surface-raised p-8 text-center animate-in fade-in duration-150">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary-strong">
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-foreground">Lendo dados do comprovante...</span>
              <span className="text-xs text-muted-foreground">Identificando tipo de comprovante, valor, parcelamento e cartão para o Wizard Rápido</span>
            </div>
          </div>
        ) : (
          <Dropzone
            accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
            maxSizeBytes={MAX_RECEIPT_FILE_SIZE_BYTES}
            label="Arraste o comprovante aqui ou toque para selecionar"
            hint="Formatos aceitos: PDF digital, PNG ou JPG (até 15 MB)"
            enableCamera={true}
            onFiles={(files) => { if (files[0]) void handleProcessFile(files[0]); }}
            onFileRejected={(_file, reason) => {
              if (reason === "too-large") {
                triggerSensory("warning");
                setError("O arquivo selecionado excede o limite de 15 MB. Envie um comprovante mais leve.");
              }
            }}
            extraActions={
              <Button type="button" variant="outline" size="sm" onClick={() => void handlePasteFromClipboard()} className="gap-1.5 border-primary/30 text-primary-strong hover:bg-primary/5">
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
              placeholder="Cole aqui o texto do Pix, boleto ou notificação..."
              rows={4}
              className="font-mono resize-none"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowTextInput(false)}>Ocultar</Button>
              <Button type="button" size="sm" sensoryIntent={false} disabled={!manualText.trim()} onClick={() => void handleProcessText(manualText)} className="gap-1.5 font-semibold">
                <ClipboardPaste className="size-3.5" aria-hidden="true" />
                <span>Reconhecer Pix</span>
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2 rounded-lg bg-surface-raised px-3 py-2.5 text-[11px] text-muted-foreground">
          <FileUp className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>Compatível com cupons fiscais com múltiplos itens, comprovantes Pix de 11 bancos, slips de maquininhas com parcelamento em até 60x, boletos bancários e carnês de lojas.</span>
        </div>
      </div>
    </Modal>
  );
}
