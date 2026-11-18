import { Copy, QrCode } from "lucide-react";
import { Badge, Button, Input, MoneyText, QrCodeCanvas } from "@/components/ui";
import { buildPixTransferCode } from "@/domain/pix";
import type { SettlementTransfer } from "@/domain/family";

export interface FamilySettlementTransferCardProps {
  transfer: SettlementTransfer;
  month: string;
  onCopy: (text: string, label: string) => void;
}

export function FamilySettlementTransferCard({
  transfer,
  month,
  onCopy,
}: FamilySettlementTransferCardProps) {
  const pixPayload =
    transfer.pix_payload ||
    buildPixTransferCode({
      pixKey: transfer.pix_key,
      keyType: transfer.pix_key_type ?? "auto",
      merchantName: transfer.receiver_name,
      amountCents: transfer.amount_cents,
      txId: transfer.tx_id,
      infoAdicional: `Familia ${month}`,
    });

  return (
    <div className="p-4 rounded-xl border border-border/80 bg-surface-raised space-y-3.5">
      <div>
        <p className="text-xs font-semibold text-foreground">Proposta de Compensação</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          <span className="font-semibold text-foreground">{transfer.payer_name}</span> deve transferir para{" "}
          <span className="font-semibold text-foreground">{transfer.receiver_name}</span>
        </p>
      </div>

      <div className="p-3 rounded-lg bg-surface border border-border/80 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground font-medium">Valor a compensar</span>
        <MoneyText
          cents={transfer.amount_cents}
          tone="default"
          className="text-lg font-bold text-foreground"
        />
      </div>

      {transfer.has_pix && transfer.pix_key ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-foreground">
              Chave Pix de {transfer.receiver_name}
            </label>
            {transfer.pix_key_type ? (
              <Badge variant="muted" size="xs">
                {transfer.pix_key_type}
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={transfer.pix_key}
              className="font-mono text-base sm:text-sm bg-surface h-10 select-all"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              sensoryIntent={false}
              className="shrink-0 gap-1.5"
              onClick={() => onCopy(transfer.pix_key!, "Chave Pix")}
            >
              <Copy className="size-3.5" aria-hidden="true" />
              <span>Copiar</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-2.5 rounded-lg border border-border/80 bg-surface text-xs text-muted-foreground">
          {transfer.receiver_name} ainda não cadastrou uma Chave Pix nas configurações da família. A transferência pode ser feita por outro canal acordado entre vocês.
        </div>
      )}

      {pixPayload && (
        <div className="space-y-2.5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <QrCode className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Pix Copia e Cola (BR Code com valor exato)</span>
            </label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={pixPayload}
                className="font-mono text-base sm:text-sm bg-surface h-10 select-all truncate text-muted-foreground"
              />
              <Button
                type="button"
                variant="default"
                size="sm"
                sensoryIntent={false}
                className="shrink-0 gap-1.5"
                onClick={() => onCopy(pixPayload, "Código Pix")}
              >
                <Copy className="size-3.5" aria-hidden="true" />
                <span>Copiar Pix</span>
              </Button>
            </div>
          </div>

          <div className="pt-2 border-t border-border/80 flex flex-col items-center gap-2 text-center">
            <QrCodeCanvas
              text={pixPayload}
              size={156}
              label={`QR Code Pix para ${transfer.receiver_name}`}
            />
            <span className="text-[11px] text-muted-foreground">
              Aponte a câmera do aplicativo bancário para pagar{" "}
              <MoneyText cents={transfer.amount_cents} tone="default" variant="caption" className="font-semibold text-foreground" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
