import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, Copy, QrCode } from "lucide-react";
import { PixTroubleshootAccordion } from "@/components/modules";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  QrCodeCanvas,
} from "@/components/ui";
import {
  DEFAULT_PIX_CITY,
  buildPixTransferCode,
  formatPixKeyTypeLabel,
  validatePixBrCode,
  type PixKeyType,
} from "@/domain/pix";
import { copyTextToClipboard } from "@/services/export-actions";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { SharedGoalTrackerResult } from "@/types";

export interface GoalPixContributionSidebarProps {
  goalData: SharedGoalTrackerResult;
}

/**
 * Painel lateral sticky para contribuição Pix (Copia e Cola, chave direta e QR Code)
 * ou exibição de estado concluído quando a vaquinha foi encerrada.
 */
export function GoalPixContributionSidebar({ goalData }: GoalPixContributionSidebarProps) {
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  const pixTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pixTimeoutRef.current) clearTimeout(pixTimeoutRef.current);
      if (keyTimeoutRef.current) clearTimeout(keyTimeoutRef.current);
    };
  }, []);

  const effectivePixBrCode = useMemo(() => {
    const rawKey = goalData.pix_key?.trim() ?? "";
    const fallbackBrCode =
      goalData.pix_br_code?.trim() && validatePixBrCode(goalData.pix_br_code.trim())
        ? goalData.pix_br_code.trim()
        : "";
    if (!rawKey) return fallbackBrCode;
    const regenerated = buildPixTransferCode({
      pixKey: rawKey,
      keyType: goalData.pix_key_type as PixKeyType | "auto" | "unknown" | undefined,
      merchantName: goalData.organizer_name || "Organizador",
      merchantCity: goalData.organizer_city || DEFAULT_PIX_CITY,
      txId: "***",
      defaultMerchantName: "Organizador",
      defaultMerchantCity: DEFAULT_PIX_CITY,
    });
    return regenerated || fallbackBrCode;
  }, [
    goalData.pix_key,
    goalData.pix_key_type,
    goalData.organizer_name,
    goalData.organizer_city,
    goalData.pix_br_code,
  ]);

  if (goalData.status === "archived") {
    return (
      <Card className="border-border/80 bg-surface shadow-xs text-center p-6 sm:p-8 space-y-3">
        <div className="flex justify-center">
          <span className="flex size-12 items-center justify-center rounded-2xl border border-positive/20 bg-positive/10 text-positive-strong">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </span>
        </div>
        <h2 className="text-base sm:text-lg font-bold text-foreground">
          Campanha Concluída com Sucesso!
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          A arrecadação para esta meta foi encerrada pelo organizador. Agradecemos a todos os participantes que contribuíram!
        </p>
      </Card>
    );
  }

  const pixCopyTarget = (effectivePixBrCode || goalData.pix_key?.trim() || "").trim();

  const handleCopyPix = async () => {
    if (!pixCopyTarget) return;

    const copied = await copyTextToClipboard(pixCopyTarget);
    if (copied) {
      setCopiedPix(true);
      triggerSensory("success");
      pushToast({
        title: "Pix do organizador copiado!",
        description: "Abra o aplicativo do seu banco para colar e transferir.",
        variant: "success",
      });
      if (pixTimeoutRef.current) clearTimeout(pixTimeoutRef.current);
      pixTimeoutRef.current = setTimeout(() => setCopiedPix(false), 3000);
    } else {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível copiar o Pix",
        description: "Copie a chave Pix manualmente exibida na tela.",
        variant: "destructive",
      });
    }
  };

  const handleCopyKey = async () => {
    const cleanKey = goalData.pix_key?.trim();
    if (!cleanKey) return;
    const copied = await copyTextToClipboard(cleanKey);
    if (copied) {
      setCopiedKey(true);
      triggerSensory("success");
      pushToast({
        title: "Chave Pix copiada!",
        description: "Chave do organizador transferida para a área de transferência.",
        variant: "default",
      });
      if (keyTimeoutRef.current) clearTimeout(keyTimeoutRef.current);
      keyTimeoutRef.current = setTimeout(() => setCopiedKey(false), 3000);
    } else {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível copiar a chave",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardHeader className="pb-3 border-b border-border/80">
        <CardTitle className="text-base flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <span>Contribua com a Meta via Pix</span>
          <Badge variant="muted" size="xs">
            {formatPixKeyTypeLabel(goalData.pix_key_type)}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Envie qualquer quantia diretamente para o organizador para somar ao progresso da meta
        </p>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <Button
          type="button"
          variant="default"
          size="lg"
          sensoryIntent={false}
          onClick={handleCopyPix}
          className="w-full rounded-xl font-semibold gap-2"
          aria-label="Copiar Pix do Organizador"
        >
          {copiedPix ? (
            <>
              <Check className="size-4 text-positive-strong" aria-hidden="true" />
              <span>Pix Copiado com Sucesso!</span>
            </>
          ) : (
            <>
              <Copy className="size-4" aria-hidden="true" />
              <span>Copiar Pix do Organizador</span>
            </>
          )}
        </Button>

        <div className="rounded-xl bg-surface-raised p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground font-medium">Chave Pix:</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono font-semibold text-foreground select-all break-all text-right">
                {goalData.pix_key}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                sensoryIntent={false}
                onClick={handleCopyKey}
                className="size-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                title="Copiar apenas a chave"
                aria-label="Copiar apenas a chave Pix"
              >
                {copiedKey ? (
                  <Check className="size-3 text-positive-strong" aria-hidden="true" />
                ) : (
                  <Copy className="size-3" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/80 pt-2">
            <span className="text-muted-foreground">Favorecido:</span>
            <span className="font-semibold text-foreground text-right">
              {goalData.organizer_name}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/80 pt-2">
            <span className="text-muted-foreground">Cidade:</span>
            <span className="text-foreground text-right">{goalData.organizer_city}</span>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            sensoryIntent="selection"
            onClick={() => setShowQrCode((prev) => !prev)}
            className="w-full gap-2 rounded-xl text-xs"
          >
            <QrCode className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>{showQrCode ? "Ocultar QR Code Pix" : "Exibir QR Code Pix"}</span>
          </Button>

          {showQrCode && (
            <div className="flex flex-col items-center justify-center p-4 bg-surface-raised rounded-xl border border-border/80 space-y-2.5">
              <QrCodeCanvas
                text={pixCopyTarget}
                size={200}
              />
              <p className="text-[11px] text-muted-foreground text-center max-w-xs">
                Abra o aplicativo do seu banco no celular e escaneie o código QR acima para transferir.
              </p>
            </div>
          )}

          <PixTroubleshootAccordion
            pixBrCode={effectivePixBrCode}
            pixKey={goalData.pix_key}
            pixKeyType={goalData.pix_key_type}
            onCopyPixKey={goalData.pix_key ? () => void handleCopyKey() : undefined}
          />
        </div>
      </CardContent>
    </Card>
  );
}
