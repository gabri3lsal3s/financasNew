import { QrCodeCanvas } from "@/components/ui/qr-code-canvas";
import { Check, Copy, QrCode } from "lucide-react";
import { PixTroubleshootAccordion } from "@/components/modules";
import { Button, MoneyText } from "@/components/ui";
import { DEFAULT_PIX_CITY, buildPixTransferCode, formatPixKeyTypeLabel } from "@/domain/pix";
import type { SuggestedSettlement } from "@/types/trips";

export interface TripPixPaymentPanelProps {
  settlement: SuggestedSettlement;
  settlementKey: string;
  destination?: string | null;
  tripTitle: string;
  copiedKey: string | null;
  copiedCodeKey: string | null;
  isQrOpen: boolean;
  onToggleQr: () => void;
  onCopyPixBrCode: (code: string, keyIdentifier: string) => void;
  onCopyRawPixKey: (pixKey: string) => void;
}

export function TripPixPaymentPanel({
  settlement,
  settlementKey,
  destination,
  tripTitle,
  copiedKey,
  copiedCodeKey,
  isQrOpen,
  onToggleQr,
  onCopyPixBrCode,
  onCopyRawPixKey,
}: TripPixPaymentPanelProps) {
  if (!settlement.toPixKey) return null;

  const rawKey = settlement.toPixKey.trim();
  const pixBrCode = buildPixTransferCode({
    pixKey: rawKey,
    keyType: settlement.toPixKeyType ?? "auto",
    merchantName: settlement.toMemberName || "Recebedor",
    merchantCity: destination || DEFAULT_PIX_CITY,
    amountCents: settlement.amountCents,
    txId: "***",
    infoAdicional: `Acerto ${tripTitle || "Viagem"}`,
    defaultMerchantName: "Recebedor",
    defaultMerchantCity: DEFAULT_PIX_CITY,
  });

  const codeToCopy = (pixBrCode || rawKey).trim();

  return (
    <div className="bg-surface-raised p-2.5 rounded-xl border border-border/80 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="min-w-0 truncate">
          <span className="text-[11px] text-muted-foreground block">
            Chave Pix ({settlement.toPixKeyType ? formatPixKeyTypeLabel(settlement.toPixKeyType) : "Pix"}):
          </span>
          <span className="font-mono text-xs text-foreground truncate block font-medium">
            {rawKey}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="default"
            sensoryIntent={false}
            onClick={() => onCopyPixBrCode(codeToCopy, settlementKey)}
            className="gap-1 font-medium"
            title="Copiar código Pix com valor cravado"
          >
            {copiedCodeKey === settlementKey ? (
              <>
                <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" aria-hidden="true" />
                <span>
                  Copiar Pix (
                  <MoneyText cents={settlement.amountCents} tone="default" variant="caption" className="text-current" />)
                </span>
              </>
            )}
          </Button>

          {pixBrCode && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onToggleQr}
              className="gap-1"
              title="Exibir QR Code Pix"
            >
              <QrCode className="size-3.5" aria-hidden="true" />
              <span>{isQrOpen ? "Fechar QR" : "QR Code"}</span>
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            sensoryIntent={false}
            onClick={() => onCopyRawPixKey(rawKey)}
            className="text-muted-foreground px-2"
            title="Copiar apenas a chave Pix (sem valor)"
          >
            {copiedKey === rawKey || copiedKey === settlement.toPixKey ? "Chave copiada" : "Só a chave"}
          </Button>
        </div>
      </div>

      {isQrOpen && pixBrCode && (
        <div className="pt-2 border-t border-border/80 flex flex-col items-center gap-2 text-center">
          <p className="text-[11px] text-muted-foreground">
            Aponte a câmera do aplicativo bancário para pagar o valor exato de{" "}
            <MoneyText cents={settlement.amountCents} tone="default" variant="caption" className="font-bold text-foreground" />:
          </p>
          <QrCodeCanvas
            text={pixBrCode}
            size={200}
            label={`QR Code Pix para ${settlement.toMemberName}`}
          />
          <p className="text-[11px] text-muted-foreground">
            Beneficiário: <span className="font-medium text-foreground">{settlement.toMemberName}</span>
          </p>
        </div>
      )}

      {isQrOpen || !pixBrCode ? (
        <PixTroubleshootAccordion
          pixBrCode={pixBrCode}
          pixKey={rawKey}
          pixKeyType={settlement.toPixKeyType}
          onCopyPixKey={() => onCopyRawPixKey(rawKey)}
        />
      ) : null}
    </div>
  );
}
