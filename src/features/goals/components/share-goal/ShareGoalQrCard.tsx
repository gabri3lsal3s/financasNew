import { QrCode } from "lucide-react";
import { Button, QrCodeCanvas } from "@/components/ui";

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
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <QrCode className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs font-medium text-foreground">QR Code Pix para Arrecadação</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          sensoryIntent="selection"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={onToggleQrPreview}
        >
          {showQrPreview ? "Ocultar" : "Visualizar"}
        </Button>
      </div>
      {showQrPreview && (
        <div className="flex flex-col items-center justify-center p-3 bg-surface-raised rounded-xl border border-border/80 self-center">
          <QrCodeCanvas text={pixBrCode} size={180} label="QR Code Pix do Organizador" />
          <p className="mt-2 text-[11px] text-muted-foreground font-medium">
            Pix Padrão Banco Central (EMV QRCPS-MPM)
          </p>
        </div>
      )}
    </div>
  );
}
