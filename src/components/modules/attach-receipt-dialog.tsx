import { useRef, useState } from "react";
import { Camera, FileUp, Loader2, UploadCloud } from "lucide-react";
import {
  Alert,
  Button,
  ResponsiveDialog,
} from "@/components/ui";
import {
  getReceiptKindLabel,
  parseBankNotification,
  parsePixShareText,
  parseUniversalReceipt,
  resolveBestMatchingCard,
  resolveMerchantIdentity,
  type ParsedBankTransaction,
} from "@/domain/notifications";
import {
  addPendingSuggestion,
  extractReceiptTextFromFile,
  processPixShare,
} from "@/services/native";
import {
  useCardDigitsMapping,
  useMerchantLearning,
} from "@/services/merchant-learning";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { formatCentsAsCurrency } from "@/services/masks";
import type { CreditCard } from "@/types/schema";

export interface AttachReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback acionado quando o comprovante é convertido com sucesso */
  onParsed?: (parsed: ParsedBankTransaction) => void;
  /** Carteira de cartões de crédito ativos para auto-resolução */
  cards?: CreditCard[];
}

/**
 * Diálogo ergonômico de "Anexar Comprovante".
 *
 * Permite ao usuário enviar comprovantes bancários por arquivo (PDF ou imagem)
 * ou tirar foto diretamente pela câmera no mobile, convertendo automaticamente
 * as informações financeiras via OCR e abrindo o Wizard Rápido pré-preenchido.
 */
export function AttachReceiptDialog({
  open,
  onOpenChange,
  onParsed,
  cards,
}: AttachReceiptDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { memory: userMemory } = useMerchantLearning();
  const { cardDigitsMapping } = useCardDigitsMapping();

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

      // 1. Processa primariamente via Orquestrador Universal
      const universal = parseUniversalReceipt(trimmed);
      let resolvedParsed: ParsedBankTransaction | null = null;

      if (universal) {
        // 2. Resolução de Identidade do Estabelecimento em 3 Camadas
        const merchantTarget = universal.merchantOrBeneficiary || universal.description;
        const identity = resolveMerchantIdentity({
          merchantOrDescription: merchantTarget,
          rawText: universal.rawCleanText,
          taxId: universal.taxId,
          userMemory,
        });

        // 3. Resolução de Cartão em 5 Etapas
        const matchedCard = resolveBestMatchingCard(cards, {
          cardId: identity.preferredCardId,
          cardLastDigits: universal.cardLastDigits,
          bankName: universal.bankName,
          issuerBank: universal.bankName,
          cardBrand: universal.cardBrand,
          cardDigitsMapping,
          preferredCardId: identity.preferredCardId,
        });

        const effectivePaymentMethod =
          universal.paymentMethod ||
          identity.preferredPaymentMethod ||
          (matchedCard ? "credit_card" : "pix");

        resolvedParsed = {
          id: universal.id,
          bankName: universal.bankName || matchedCard?.name || "Banco",
          nature: universal.nature,
          type: universal.nature === "income" ? "income" : "expense",
          amountCents: universal.amountCents,
          description: identity.friendlyName || universal.description,
          date: universal.date,
          paymentMethod: effectivePaymentMethod,
          cardId: matchedCard?.id,
          cardLastDigits: universal.cardLastDigits,
          cardBrand: universal.cardBrand || matchedCard?.brand || undefined,
          merchant: identity.friendlyName,
          categorySlug: identity.categorySlug,
          receiptKind: universal.kind,
          rawText: universal.rawCleanText,
          timestamp: Date.now(),
          installments: universal.installments?.count,
          currentInstallment: universal.installments?.currentInstallment,
          installmentAmountCents: universal.installments?.installmentAmountCents,
          taxId: universal.taxId,
          payerName: universal.payerOrSource,
          recipientName: universal.merchantOrBeneficiary,
          source: "receipt",
        };
      } else {
        // Fallback secundário para parsers legados
        let legacyParsed = processPixShare(trimmed, { skipSuggestion: true });
        if (!legacyParsed) {
          legacyParsed =
            parsePixShareText(trimmed) ||
            parseBankNotification({ title: "", text: trimmed });
        }

        if (legacyParsed) {
          const identity = resolveMerchantIdentity({
            merchantOrDescription: legacyParsed.merchant || legacyParsed.description,
            rawText: legacyParsed.rawText || trimmed,
            taxId: legacyParsed.taxId,
            userMemory,
          });

          const matchedCard = resolveBestMatchingCard(cards, {
            cardId: identity.preferredCardId,
            cardLastDigits: legacyParsed.cardLastDigits,
            bankName: legacyParsed.bankName,
            issuerBank: legacyParsed.issuerBank,
            cardBrand: legacyParsed.cardBrand,
            cardDigitsMapping,
            preferredCardId: identity.preferredCardId,
          });

          resolvedParsed = {
            ...legacyParsed,
            description: identity.friendlyName || legacyParsed.description,
            merchant: identity.friendlyName,
            categorySlug: identity.categorySlug || legacyParsed.categorySlug,
            cardId: matchedCard?.id || legacyParsed.cardId,
            cardBrand: matchedCard?.brand || legacyParsed.cardBrand,
          };
        }
      }

      if (resolvedParsed) {
        const kindLabel = getReceiptKindLabel(
          resolvedParsed.receiptKind,
          resolvedParsed.installments,
        );
        const formattedAmount = formatCentsAsCurrency(resolvedParsed.amountCents);

        triggerSensory("success");

        pushToast({
          title: `${kindLabel} reconhecido`,
          description: `${resolvedParsed.description} no valor de ${formattedAmount} pronto para conferência.`,
          variant: "success",
        });

        if (onParsed) {
          onParsed(resolvedParsed);
        } else {
          addPendingSuggestion(resolvedParsed);
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
      description="Envie comprovantes Pix, cartões de crédito/débito, boletos, concessionárias ou notas fiscais em PDF ou imagem para identificação automática."
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
                Identificando tipo de comprovante, valor, parcelamento e cartão para o Wizard Rápido
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
            Compatível com comprovantes Pix de todos os bancos homologados, cartões de crédito/débito com parcelamento, boletos bancários, concessionárias e cupons fiscais (NFC-e/SAT).
          </span>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
