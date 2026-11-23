import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui";
import { copyTextToClipboard } from "@/services/export-actions";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { PublicTripLedgerData, SuggestedSettlement } from "@/types/trips";
import { PublicTripSettlementRow } from "./public-trip-settlement-row";

export interface PublicTripSettlementsCardProps {
  trip: PublicTripLedgerData["trip"];
  suggestedSettlements: readonly SuggestedSettlement[];
}

/**
 * Painel de acerto de contas otimizado com geração automática de Pix Copia e Cola e QR Code.
 */
export function PublicTripSettlementsCard({
  trip,
  suggestedSettlements,
}: PublicTripSettlementsCardProps) {
  const [copiedPixKey, setCopiedPixKey] = useState<string | null>(null);
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);
  const [qrCodeOpenKey, setQrCodeOpenKey] = useState<string | null>(null);

  const pixTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pixTimerRef.current) clearTimeout(pixTimerRef.current);
      if (codeTimerRef.current) clearTimeout(codeTimerRef.current);
    };
  }, []);

  const handleCopyPix = async (pixKey: string) => {
    const cleanKey = pixKey.trim();
    if (!cleanKey) return;
    const copied = await copyTextToClipboard(cleanKey);
    if (copied) {
      setCopiedPixKey(cleanKey);
      triggerSensory("success");
      pushToast({
        title: "Chave Pix copiada",
        description: "Cole no seu aplicativo bancário para realizar a transferência.",
      });
      if (pixTimerRef.current) clearTimeout(pixTimerRef.current);
      pixTimerRef.current = setTimeout(() => setCopiedPixKey(null), 3000);
    } else {
      triggerSensory("destructive");
      pushToast({
        title: "Erro ao copiar chave",
        description: "Selecione e copie manualmente.",
        variant: "destructive",
      });
    }
  };

  const handleCopyPixBrCode = async (code: string, keyIdentifier: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;
    const copied = await copyTextToClipboard(cleanCode);
    if (copied) {
      setCopiedCodeKey(keyIdentifier);
      triggerSensory("success");
      pushToast({
        title: "Pix Copia e Cola copiado!",
        description: "Abra o aplicativo do seu banco para colar e pagar o valor exato.",
      });
      if (codeTimerRef.current) clearTimeout(codeTimerRef.current);
      codeTimerRef.current = setTimeout(() => setCopiedCodeKey(null), 3000);
    } else {
      triggerSensory("destructive");
      pushToast({
        title: "Erro ao copiar código",
        description: "Selecione e copie manualmente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-border/80 bg-surface shadow-xs rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-border/80 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
          <span className="text-sm font-bold text-foreground truncate">
            Acerto de Contas ({suggestedSettlements.length})
          </span>
        </div>
        <Badge variant="muted" size="xs" className="shrink-0">
          Pix Direto
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Transferências recomendadas para liquidar todas as contas da viagem com o menor número de transações.
      </p>

      {suggestedSettlements.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="size-8 text-muted-foreground" aria-hidden="true" />}
          title="Tudo equilibrado"
          description="Não há transferências pendentes para liquidar esta viagem."
        />
      ) : (
        <div className="space-y-2.5">
          {suggestedSettlements.map((settlement, idx) => {
            const key = `${settlement.fromMemberId}-${settlement.toMemberId}`;
            return (
              <PublicTripSettlementRow
                key={`${key}-${idx}`}
                trip={trip}
                settlement={settlement}
                isQrOpen={qrCodeOpenKey === key}
                isCodeCopied={copiedCodeKey === key}
                isKeyCopied={copiedPixKey === settlement.toPixKey}
                onCopyCode={(code, id) => void handleCopyPixBrCode(code, id)}
                onToggleQr={(id) => setQrCodeOpenKey((prev) => (prev === id ? null : id))}
                onCopyPixKey={(pix) => void handleCopyPix(pix)}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}
