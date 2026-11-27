import { Check, Clock, Copy, Loader2, QrCode, ShieldCheck, Trash2 } from "lucide-react";
import {
  Button,
  FormField,
  Input,
  Modal,
  ModalFooter,
} from "@/components/ui";
import { formatCentsAsCurrency } from "@/services/masks";

export interface PixRenewalCheckoutModalProps {
  open: boolean;
  totalCents: number;
  selectedMonths: number;
  copiedKey: boolean;
  isCanceling?: boolean;
  pixData: {
    paymentId?: string;
    qrCodeBase64: string;
    copyPasteKey: string;
    expirationDate: string;
    reused?: boolean;
  } | null;
  onClose: () => void;
  onCopyPix: () => void;
  onCancelPix?: () => void;
}

export function PixRenewalCheckoutModal({
  open,
  totalCents,
  selectedMonths,
  copiedKey,
  isCanceling = false,
  pixData,
  onClose,
  onCopyPix,
  onCancelPix,
}: PixRenewalCheckoutModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="md"
      title="Pagamento Pix — Antecipação Pro"
      description={`Pague ${formatCentsAsCurrency(totalCents)} para estender seu plano por +${selectedMonths} meses.`}
      footer={
        <ModalFooter
          borderless
          destructiveAction={
            onCancelPix ? (
              <Button
                type="button"
                variant="ghost"
                sensoryIntent="destructive"
                disabled={isCanceling}
                onClick={onCancelPix}
                className="gap-1.5 text-critical-strong hover:text-critical-strong hover:bg-critical/10"
              >
                {isCanceling ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-3.5" aria-hidden="true" />
                )}
                <span>{isCanceling ? "Cancelando..." : "Cancelar Pix"}</span>
              </Button>
            ) : undefined
          }
        >
          <Button
            type="button"
            variant="outline"
            disabled={isCanceling}
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Fechar
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4 py-2">
        {pixData?.qrCodeBase64 ? (
          <div className="flex flex-col items-center gap-3">
            <div className="p-2.5 rounded-xl bg-surface border border-border/80 shadow-xs">
              <img
                width={208}
                height={208}
                src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                alt="QR Code Pix"
                className="size-48 sm:size-52 object-contain rounded-lg"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5 text-warning-strong shrink-0" aria-hidden="true" />
              <span>Válido por 1 hora · Confirmação instantânea</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
            <QrCode className="size-12 text-primary" aria-hidden="true" />
            <span className="text-xs">Use o código Copia e Cola abaixo para pagar.</span>
          </div>
        )}

        {pixData?.copyPasteKey ? (
          <FormField label="Código Pix Copia e Cola" htmlFor="pix-renewal-copy-key">
            <div className="flex items-center gap-2">
              <Input
                id="pix-renewal-copy-key"
                type="text"
                readOnly
                value={pixData.copyPasteKey}
                className="text-base sm:text-xs font-mono bg-muted/40 truncate select-all flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                sensoryIntent={false}
                onClick={onCopyPix}
                className="gap-1.5 shrink-0"
              >
                {copiedKey ? (
                  <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                ) : (
                  <Copy className="size-3.5" aria-hidden="true" />
                )}
                <span>{copiedKey ? "Copiado" : "Copiar"}</span>
              </Button>
            </div>
          </FormField>
        ) : null}

        <div className="p-3 rounded-xl bg-surface-raised/60 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
          <span>
            Assim que o pagamento for confirmado, seu novo vencimento será atualizado automaticamente.
          </span>
        </div>
      </div>
    </Modal>
  );
}
