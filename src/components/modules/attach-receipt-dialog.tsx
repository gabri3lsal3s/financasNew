import { useId, useState, type ClipboardEvent } from "react";
import { ArrowRight, ClipboardPaste, FileUp, Loader2, Lock } from "lucide-react";
import {
  Alert,
  Button,
  Dropzone,
  FormField,
  Modal,
  ModalFooter,
  PasswordInput,
  Tabs,
  Textarea,
} from "@/components/ui";
import type { ParsedBankTransaction, ReceiptUserContext } from "@/domain/notifications";
import type { AiCategoryOptionInput } from "@/services/ai-assistant";
import { readClipboardText } from "@/services/clipboard";
import { formatCentsAsCurrency } from "@/services/masks";
import { MAX_RECEIPT_FILE_SIZE_BYTES, addPendingSuggestion } from "@/services/native";
import { useReceiptIngestion } from "@/services/receipt-resolution";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { CreditCard } from "@/types/schema";

export const RECEIPT_FILE_ACCEPT =
  "image/png,image/jpeg,image/jpg,image/webp,image/avif,image/heic,image/heif,application/pdf,.png,.jpg,.jpeg,.webp,.avif,.heic,.heif,.pdf";

type ReceiptInputMode = "file" | "paste";

export interface AttachReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onParsed?: (parsed: ParsedBankTransaction) => void;
  onNavigateToStatementImport?: () => void;
  userContext?: ReceiptUserContext;
  userId?: string | null;
  cards?: CreditCard[];
  categories?: readonly AiCategoryOptionInput[];
  isReadOnlyMode?: boolean;
  aiExtractionEnabled?: boolean;
}

/**
 * Diálogo de "Anexar Comprovante ou Cupom":
 * harmonizado visual e funcionalmente com `StatementUploadStep`
 * (abas Arquivo/Colar texto, desbloqueio inline de PDF com senha,
 * barra de progresso calma com Cancelar real e redirecionamento para faturas).
 */
export function AttachReceiptDialog({
  open,
  onOpenChange,
  onParsed,
  onNavigateToStatementImport,
  userContext,
  userId,
  cards,
  categories,
  isReadOnlyMode,
  aiExtractionEnabled,
}: AttachReceiptDialogProps) {
  const uid = useId();
  const [mode, setMode] = useState<ReceiptInputMode>("file");
  const [manualText, setManualText] = useState("");
  const [pdfPasswordInput, setPdfPasswordInput] = useState("");

  const closeDialog = () => {
    setMode("file");
    setManualText("");
    setPdfPasswordInput("");
    onOpenChange(false);
  };

  const ingestion = useReceiptIngestion({
    userContext,
    userId,
    cards,
    categories,
    isReadOnlyMode,
    aiExtractionEnabled,
    onSuccess: (parsed, kindLabel) => {
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
      ingestion.reset();
      closeDialog();
    },
  });

  const handleClose = () => {
    ingestion.reset();
    closeDialog();
  };

  const handleFileProcess = async (file: File) => {
    const res = await ingestion.handleProcessFile(file);
    if (res && !res.ok && res.status !== "cancelled") {
      triggerSensory("warning");
    }
  };

  const handlePasteFromClipboard = async () => {
    const outcome = await ingestion.readAndProcessClipboard();
    if (outcome === "empty_or_unrecognized") {
      setMode("paste");
    }
  };

  const handlePasteIntoTextarea = async () => {
    if (ingestion.loading) return;
    try {
      const clipResult = await readClipboardText();
      if (clipResult.status === "success" && clipResult.text?.trim()) {
        setManualText(clipResult.text);
      }
    } catch {
      // Silencioso caso permissão de clipboard não esteja disponível
    }
  };

  const handleDialogPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (ingestion.loading || ingestion.pendingPasswordFile) return;

    const files = Array.from(event.clipboardData?.files ?? []);
    const imageFile = files.find((f) => f.type.startsWith("image/"));
    if (imageFile) {
      event.preventDefault();
      void handleFileProcess(imageFile);
      return;
    }

    const targetTag = (event.target as HTMLElement | null)?.tagName;
    if (targetTag === "TEXTAREA" || targetTag === "INPUT") {
      return;
    }

    const pastedText = event.clipboardData?.getData("text")?.trim();
    if (pastedText) {
      event.preventDefault();
      void ingestion.handleProcessText(pastedText).then((ok) => {
        if (!ok) triggerSensory("warning");
      });
    }
  };

  const handleUnlockPdf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfPasswordInput.trim() || ingestion.loading) return;
    const pw = pdfPasswordInput;
    setPdfPasswordInput("");
    void ingestion.handlePasswordSubmit(pw).then(() => {
      // warning feedback if password failed is reflected via passwordError
    });
  };

  const modeTabs = [
    { value: "file", label: "Enviar arquivo ou foto", content: null },
    { value: "paste", label: "Colar texto ou código", content: null },
  ];

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}
      title="Anexar Comprovante ou Cupom"
      description="Identificação automática de cupons fiscais (DANFE NFC-e / SAT), comprovantes Pix, boletos bancários e cartões em PDF ou foto."
      size="md"
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={ingestion.loading ? ingestion.cancelProcessing : handleClose}
          >
            Cancelar
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-3.5 pt-1" onPaste={handleDialogPaste}>
        {ingestion.error ? <Alert variant="error">{ingestion.error}</Alert> : null}

        {ingestion.multiStatementMessage ? (
          <Alert variant="info">
            <div className="flex flex-col gap-2">
              <span>{ingestion.multiStatementMessage}</span>
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

        {ingestion.pendingPasswordFile ? (
          <form
            onSubmit={handleUnlockPdf}
            className="rounded-xl border border-warning/30 bg-surface p-4 space-y-3 shadow-xs animate-in fade-in duration-200"
          >
            <div className="flex items-start gap-2.5">
              <Lock className="size-4 text-warning-strong shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1 flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground line-clamp-2 break-words">
                  Boleto ou comprovante em PDF protegido
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O arquivo <strong className="text-foreground">{ingestion.pendingPasswordFile.name}</strong> está
                  protegido por senha. Digite a senha para continuar.
                </p>
              </div>
            </div>

            <FormField
              label="Senha do arquivo PDF"
              htmlFor={`${uid}-receipt-pdf-pass`}
              helperText="A senha não é armazenada e permanece apenas em memória durante a leitura."
              error={ingestion.passwordError ?? undefined}
            >
              <PasswordInput
                id={`${uid}-receipt-pdf-pass`}
                value={pdfPasswordInput}
                onChange={(e) => setPdfPasswordInput(e.target.value)}
                placeholder="Digite a senha do PDF (ex.: primeiros dígitos do CPF)"
                disabled={ingestion.loading}
                aria-label="Senha do arquivo PDF"
              />
            </FormField>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={ingestion.loading}
                onClick={() => {
                  setPdfPasswordInput("");
                  ingestion.handlePasswordCancel();
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={ingestion.loading || !pdfPasswordInput.trim()}
                className="gap-1.5"
              >
                {ingestion.loading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    <span>Desbloqueando...</span>
                  </>
                ) : (
                  <span>Desbloquear e continuar</span>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <Tabs
              value={mode}
              onValueChange={(val) => setMode(val as ReceiptInputMode)}
              items={modeTabs}
              fullWidth
            />

            {mode === "file" ? (
              <Dropzone
                accept={RECEIPT_FILE_ACCEPT}
                maxSizeBytes={MAX_RECEIPT_FILE_SIZE_BYTES}
                disabled={ingestion.loading}
                label="Arraste o comprovante aqui ou toque para selecionar"
                hint="Aceita PDF digital ou escaneado, PNG, JPG, WebP, AVIF e HEIC (até 15 MB) · ou cole com Ctrl+V"
                enableCamera={true}
                onFiles={(files) => {
                  if (files[0]) void handleFileProcess(files[0]);
                }}
                onFileRejected={(_file, reason) => {
                  if (reason === "too-large") {
                    triggerSensory("warning");
                    ingestion.setError(
                      "O arquivo selecionado excede o limite de 15 MB. Envie um comprovante mais leve.",
                    );
                  }
                }}
                extraActions={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={ingestion.loading}
                    onClick={() => void handlePasteFromClipboard()}
                    className="gap-1.5 border-primary/30 text-primary-strong hover:bg-primary/5"
                  >
                    <ClipboardPaste className="size-3.5" aria-hidden="true" />
                    <span>Colar comprovante Pix</span>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
                <FormField
                  label="Cole o texto do Pix, boleto ou cupom"
                  htmlFor={`${uid}-manual-receipt-text`}
                  helperText="Aceita Pix Copia e Cola, chave Pix, linha digitável de boleto (47/48 dígitos) ou texto de comprovante."
                >
                  <Textarea
                    id={`${uid}-manual-receipt-text`}
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    disabled={ingestion.loading}
                    placeholder="Cole aqui o Pix Copia e Cola, linha digitável do boleto ou texto do comprovante..."
                    rows={5}
                    aria-label="Conteúdo colado do comprovante ou boleto"
                    className="font-mono text-base sm:text-sm resize-none"
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={ingestion.loading}
                    onClick={() => void handlePasteIntoTextarea()}
                    className="gap-1.5"
                  >
                    <ClipboardPaste className="size-4" aria-hidden="true" />
                    <span>Colar área</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    sensoryIntent={false}
                    disabled={ingestion.loading || !manualText.trim()}
                    onClick={() => {
                      void ingestion.handleProcessText(manualText).then((ok) => {
                        if (!ok) triggerSensory("warning");
                      });
                    }}
                    className="gap-1.5"
                  >
                    <FileUp className="size-4" aria-hidden="true" />
                    <span>Reconhecer dados</span>
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {ingestion.loading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface px-3.5 py-2.5 text-xs text-muted-foreground shadow-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Loader2
                className="size-4 shrink-0 animate-spin text-primary-strong"
                aria-hidden="true"
              />
              <span className="truncate">
                {ingestion.progressMessage || "Lendo dados do comprovante..."}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={ingestion.cancelProcessing}
              className="shrink-0"
            >
              Cancelar
            </Button>
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
