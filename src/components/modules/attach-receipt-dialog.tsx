import { useRef, useState } from "react";
import { Camera, FileUp, Loader2, UploadCloud } from "lucide-react";
import {
  Alert,
  Button,
  ResponsiveDialog,
} from "@/components/ui";
import {
  lookupMerchantCategory,
  parseBankNotification,
  parsePixShareText,
  type ParsedBankTransaction,
} from "@/domain/notifications";
import {
  addPendingSuggestion,
  extractReceiptTextFromFile,
  processPixShare,
  useMerchantCategoryMapping,
} from "@/services/native";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { formatCentsAsCurrency } from "@/services/masks";

export interface AttachReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback acionado quando o comprovante é convertido com sucesso */
  onParsed?: (parsed: ParsedBankTransaction) => void;
}

/**
 * Diálogo ergonômico de "Anexar Comprovante".
 *
 * Permite ao usuário enviar o comprovante bancário por arquivo (PDF ou imagem)
 * ou tirar foto diretamente pela câmera no mobile, convertendo automaticamente
 * as informações financeiras via OCR e abrindo o Wizard Rápido pré-preenchido.
 */
export function AttachReceiptDialog({
  open,
  onOpenChange,
  onParsed,
}: AttachReceiptDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const merchantMemory = useMerchantCategoryMapping();

  const handleClose = () => {
    if (loading) return;
    setError(null);
    setDragOver(false);
    onOpenChange(false);
  };

  const handleProcessFile = async (file: File) => {
    if (!file) return;

    setError(null);
    setLoading(true);
    triggerSensory("action");

    try {
      const extractedText = await extractReceiptTextFromFile(file);
      const trimmed = extractedText.trim();

      if (!trimmed) {
        triggerSensory("warning");
        setError(
          "Não foi possível ler o texto deste arquivo. Certifique-se de que o comprovante esteja nítido ou seja um PDF digital emitido pelo banco.",
        );
        setLoading(false);
        return;
      }

      // Processa com o motor semântico sem poluir a lista de sugestões da Home
      let parsed = processPixShare(trimmed, { skipSuggestion: true });
      if (!parsed) {
        parsed =
          parsePixShareText(trimmed) ||
          parseBankNotification({ title: "", text: trimmed });
      }

      if (parsed) {
        // Aplica memorização semântica aprendida
        const categorySlug =
          lookupMerchantCategory(parsed.merchant, merchantMemory) || parsed.categorySlug;

        const resolvedParsed: ParsedBankTransaction = {
          ...parsed,
          categorySlug,
        };

        triggerSensory("success");

        if (onParsed) {
          onParsed(resolvedParsed);
        } else {
          addPendingSuggestion(resolvedParsed);
          const formattedAmount = formatCentsAsCurrency(resolvedParsed.amountCents);
          pushToast({
            title: "Comprovante reconhecido",
            description: `${resolvedParsed.description} no valor de ${formattedAmount} pronto para conferência.`,
            variant: "success",
          });
        }

        handleClose();
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleProcessFile(file);
    }
    // Reseta o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleProcessFile(file);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(next);
      }}
      title="Anexar Comprovante"
      description="Envie o comprovante Pix, transferência ou fatura em PDF ou imagem para identificação e preenchimento automático."
      size="md"
      footer={
        <div className="flex items-center justify-end w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={loading}
            className="w-full sm:w-auto cursor-pointer"
          >
            Cancelar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        {/* Input de arquivo oculto */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={handleFileChange}
        />

        {/* Input de câmera oculto */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={handleFileChange}
        />

        {error && <Alert variant="error">{error}</Alert>}

        {loading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border border-border/80 bg-surface/50 text-center animate-in fade-in duration-150"
          >
            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-foreground">
                Lendo dados do comprovante...
              </span>
              <span className="text-xs text-muted-foreground">
                Identificando valor, data e estabelecimento para o Wizard Rápido
              </span>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed transition-colors text-center cursor-pointer select-none ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border/80 bg-surface hover:bg-surface-hover hover:border-border"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
              <UploadCloud className="size-6" aria-hidden="true" />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-foreground">
                Arraste o comprovante aqui ou toque para selecionar
              </span>
              <span className="text-xs text-muted-foreground">
                Formatos aceitos: PDF digital, PNG ou JPG (até 10 MB)
              </span>
            </div>

            <div
              className="flex items-center gap-2 pt-2 flex-wrap justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 cursor-pointer"
              >
                <FileUp className="size-3.5" aria-hidden="true" />
                <span>Escolher arquivo</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => cameraInputRef.current?.click()}
                className="gap-1.5 cursor-pointer"
              >
                <Camera className="size-3.5" aria-hidden="true" />
                <span>Tirar foto</span>
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/40 border border-border/40 text-[11px] text-muted-foreground">
          <FileUp className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>
            Compatível com comprovantes Pix de todos os bancos homologados (Nubank, Itaú, Bradesco, Inter, BB, Mercado Pago, etc.) e faturas de cartão.
          </span>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
