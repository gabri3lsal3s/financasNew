import { useEffect, useRef, useState } from "react";
import { Check, Copy, QrCode, ShieldCheck } from "lucide-react";
import { Badge, Button, QrCodeCanvas } from "@/components/ui";
import { inspectPixPaymentPayload } from "@/domain/pix";
import { copyTextToClipboard } from "@/services/export-actions";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

export interface ShareGoalQrCardProps {
  pixBrCode: string;
  showQrPreview: boolean;
  onToggleQrPreview: () => void;
}

export function ShareGoalQrCard({
  pixBrCode,
  showQrPreview,
  onToggleQrPreview,
}: ShareGoalQrCardProps) {
  const [copiedTest, setCopiedTest] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const inspection = inspectPixPaymentPayload({ pixBrCode });

  const handleTestCopy = async () => {
    const clean = pixBrCode.trim();
    if (!clean) return;
    const ok = await copyTextToClipboard(clean);
    if (ok) {
      setCopiedTest(true);
      triggerSensory("selection");
      pushToast({
        title: "Código Pix de teste copiado!",
        description: "Cole em Pix Copia e Cola de outra conta para confirmar o recebimento.",
        variant: "default",
      });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopiedTest(false), 3000);
    } else {
      triggerSensory("destructive");
      pushToast({ title: "Não foi possível copiar o código automaticamente.", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <QrCode className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="text-xs font-medium text-foreground truncate">QR Code Pix para Arrecadação</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          sensoryIntent="selection"
          className="text-xs text-muted-foreground hover:text-foreground shrink-0"
          onClick={onToggleQrPreview}
        >
          {showQrPreview ? "Ocultar" : "Visualizar"}
        </Button>
      </div>
      {showQrPreview && (
        <div className="flex flex-col items-center justify-center p-3.5 bg-surface-raised rounded-xl border border-border/80 self-center gap-2.5">
          {inspection.isValidEmv && inspection.crc16 ? (
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-medium text-foreground">EMV Verificado</span>
              <Badge size="xs" variant="positive">
                CRC16 {inspection.crc16}
              </Badge>
            </div>
          ) : null}

          <QrCodeCanvas text={pixBrCode} size={200} label="QR Code Pix do Organizador" />

          <p className="text-[11px] text-muted-foreground font-medium text-center">
            Pix Padrão Banco Central (EMV QRCPS-MPM)
          </p>

          <Button
            type="button"
            variant="outline"
            size="xs"
            sensoryIntent={false}
            onClick={() => void handleTestCopy()}
            className="gap-1.5"
          >
            {copiedTest ? (
              <>
                <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                <span>Copiado para teste</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" aria-hidden="true" />
                <span>Testar Copia e Cola</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
