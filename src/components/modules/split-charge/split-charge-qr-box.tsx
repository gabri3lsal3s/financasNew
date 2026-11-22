import { AlertTriangle, Check, Copy, ShieldCheck } from "lucide-react";
import { Alert, Button, QrCodeCanvas } from "@/components/ui";

export interface SplitChargeQrBoxProps {
  pixBoxTourId?: string;
  pixBrCode?: string;
  pixKey?: string;
  pixKeyType?: string;
  copiedKey: boolean;
  onCopyPixKey: () => void;
}

/**
 * Caixa de visualização do QR Code Pix vetorial SVG e cópia da chave direta.
 */
export function SplitChargeQrBox({
  pixBoxTourId,
  pixBrCode,
  pixKey,
  pixKeyType = "E-mail",
  copiedKey,
  onCopyPixKey,
}: SplitChargeQrBoxProps) {
  return (
    <div
      data-tour={pixBoxTourId}
      className="rounded-xl border border-border/80 bg-surface-raised p-4 flex flex-col items-center gap-3 text-center"
    >
      {pixBrCode ? (
        <>
          <p className="text-xs text-muted-foreground">
            Abra o app do seu banco, escolha <strong>Pagar com QR Code</strong> e aponte para a tela:
          </p>
          <div className="rounded-xl border border-border/80 bg-white p-2 shadow-xs">
            <QrCodeCanvas text={pixBrCode} size={180} label="Código QR Pix oficial" />
          </div>
        </>
      ) : (
        <Alert variant="warning" className="text-left">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5 text-warning-strong" aria-hidden="true" />
            <span className="text-xs leading-relaxed">
              Não foi possível gerar o QR Code Pix com esta chave. Utilize a chave Pix abaixo ou peça ao anfitrião para revisar os dados.
            </span>
          </div>
        </Alert>
      )}
      {pixKey ? (
        <div className="w-full pt-2 border-t border-border/80 flex flex-col items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">
            Chave Pix ({pixKeyType || "cadastrada"}):
          </span>
          <div className="flex items-center gap-2 max-w-full">
            <code className="text-xs font-mono bg-surface px-2 py-1 rounded border border-border/80 text-foreground truncate max-w-[160px] sm:max-w-[240px]">
              {pixKey}
            </code>
            <Button
              type="button"
              variant="outline"
              size="xs"
              sensoryIntent={false}
              onClick={onCopyPixKey}
              className="gap-1 shrink-0"
              aria-label="Copiar chave Pix diretamente"
            >
              {copiedKey ? (
                <Check className="size-3 text-positive-strong" aria-hidden="true" />
              ) : (
                <Copy className="size-3 text-muted-foreground" aria-hidden="true" />
              )}
              <span>{copiedKey ? "Copiada" : "Copiar"}</span>
            </Button>
          </div>
          <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mt-0.5">
            <ShieldCheck className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
            <span>Dados protegidos e sem cobrança de taxas</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
