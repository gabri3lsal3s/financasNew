import { Check, Copy, QrCode } from "lucide-react";
import { Button, MoneyText, QrCodeCanvas } from "@/components/ui";
import { buildPixTransferCode } from "@/domain/pix";
import { formatCentsAsBRL } from "@/services/masks/money";
import type { PublicTripLedgerData, SuggestedSettlement } from "@/types/trips";

export interface PublicTripSettlementRowProps {
  trip: PublicTripLedgerData["trip"];
  settlement: SuggestedSettlement;
  isQrOpen: boolean;
  isCodeCopied: boolean;
  isKeyCopied: boolean;
  onCopyCode: (code: string, keyId: string) => void;
  onToggleQr: (keyId: string) => void;
  onCopyPixKey: (pixKey: string) => void;
}

/**
 * Linha de transferência sugerida no acerto de contas da viagem pública,
 * com geração de Pix Copia e Cola e QR Code sob demanda.
 */
export function PublicTripSettlementRow({
  trip,
  settlement,
  isQrOpen,
  isCodeCopied,
  isKeyCopied,
  onCopyCode,
  onToggleQr,
  onCopyPixKey,
}: PublicTripSettlementRowProps) {
  const key = `${settlement.fromMemberId}-${settlement.toMemberId}`;
  const rawKey = settlement.toPixKey?.trim() ?? "";
  const txSuffix = `${settlement.fromMemberId.slice(0, 4)}${settlement.toMemberId.slice(0, 4)}`
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  const pixBrCode = rawKey
    ? buildPixTransferCode({
        pixKey: rawKey,
        keyType: settlement.toPixKeyType,
        merchantName: settlement.toMemberName,
        merchantCity: trip.destination || "BRASIL",
        amountCents: settlement.amountCents,
        txId: `TRIP${txSuffix}`,
        infoAdicional: `Acerto: ${trip.title || "Viagem"}`,
        defaultMerchantName: "Recebedor",
        defaultMerchantCity: "BRASIL",
      })
    : null;

  const codeToCopy = pixBrCode || rawKey;

  return (
    <div className="rounded-xl bg-surface-raised p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-foreground min-w-0">
          <span>{settlement.fromMemberName}</span>
          <span className="text-muted-foreground font-normal mx-1.5">paga para</span>
          <span className="text-primary-strong">{settlement.toMemberName}</span>
        </div>
        <MoneyText
          cents={settlement.amountCents}
          variant="value"
          tone="default"
          className="text-xs font-bold shrink-0"
        />
      </div>

      {settlement.toPixKey && (
        <div className="bg-surface border border-border/80 p-2.5 rounded-xl text-xs space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[11px] text-muted-foreground block font-medium">
                Chave Pix ({settlement.toPixKeyType ?? "Pix"}):
              </span>
              <span className="font-mono text-xs text-foreground truncate block font-medium">
                {settlement.toPixKey}
              </span>
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              <Button
                type="button"
                size="sm"
                variant="default"
                sensoryIntent={false}
                onClick={() => onCopyCode(codeToCopy, key)}
                className="px-2.5 text-xs gap-1.5 font-medium flex-1 sm:flex-initial justify-center min-w-0"
                title="Copiar código Pix com valor cravado"
              >
                {isCodeCopied ? (
                  <>
                    <Check className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="sm:hidden num whitespace-nowrap">
                      Pix {formatCentsAsBRL(settlement.amountCents)}
                    </span>
                    <span className="hidden sm:inline num whitespace-nowrap">
                      Copiar Pix ({formatCentsAsBRL(settlement.amountCents)})
                    </span>
                  </>
                )}
              </Button>

              {pixBrCode && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  sensoryIntent="selection"
                  onClick={() => onToggleQr(key)}
                  className="px-2 text-xs gap-1 shrink-0"
                  title="Exibir QR Code Pix"
                >
                  <QrCode className="size-3.5" aria-hidden="true" />
                  <span>{isQrOpen ? "Fechar" : "QR"}</span>
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                variant="ghost"
                sensoryIntent={false}
                onClick={() => onCopyPixKey(settlement.toPixKey!)}
                className="px-2 text-[11px] text-muted-foreground shrink-0"
                title="Copiar apenas a chave Pix"
              >
                <span className="whitespace-nowrap">
                  {isKeyCopied ? "Copiada" : "Só chave"}
                </span>
              </Button>
            </div>
          </div>

          {isQrOpen && pixBrCode && (
            <div className="pt-2 border-t border-border/80 flex flex-col items-center gap-2 text-center">
              <p className="text-[11px] text-muted-foreground">
                Aponte a câmera do aplicativo bancário para pagar o valor exato de{" "}
                <MoneyText
                  cents={settlement.amountCents}
                  variant="caption"
                  tone="default"
                  className="font-bold"
                />
                :
              </p>
              <div className="p-2 rounded-xl border border-border/80 bg-background shadow-xs">
                <QrCodeCanvas
                  text={pixBrCode}
                  size={160}
                  label={`QR Code Pix para ${settlement.toMemberName}`}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
