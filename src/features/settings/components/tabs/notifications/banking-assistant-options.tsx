import { useId } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Checkbox } from "@/components/ui";
import type { BankAssistantPreferences } from "@/domain/notifications";
import { PROMINENT_DISCLOSURE_INFO } from "@/lib/institutional";
import { cn } from "@/lib/utils";

export interface BankingAssistantOptionsProps {
  bankPrefs: BankAssistantPreferences;
  listenerGranted: boolean;
  onOpenDisclosure: () => void;
  onTogglePassiveCapture: (enabled: boolean) => void;
  onToggleInteractiveNotifications: (enabled: boolean) => void;
}

export function BankingAssistantOptions({
  bankPrefs,
  listenerGranted,
  onOpenDisclosure,
  onTogglePassiveCapture,
  onToggleInteractiveNotifications,
}: BankingAssistantOptionsProps) {
  const baseId = useId();
  const passiveId = `${baseId}-passive`;
  const interactiveId = `${baseId}-interactive`;
  const effectiveActive = Boolean(bankPrefs.passiveCaptureEnabled && listenerGranted);
  const pendingPermission = Boolean(bankPrefs.passiveCaptureEnabled && !listenerGranted);

  return (
    <>
      <label
        htmlFor={passiveId}
        className={cn(
          "flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
          effectiveActive
            ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
            : "border-border/80 bg-surface hover:bg-surface-hover",
        )}
      >
        <div className="min-w-0 pr-2">
          <div className="font-semibold text-sm text-foreground">
            Captura Passiva de Notificações Bancárias
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Detecta compras no cartão (com parcelamento e categoria automáticos), transferências e Pix, gerando sugestões inteligentes no aplicativo.
          </div>
        </div>
        <Checkbox
          id={passiveId}
          checked={effectiveActive}
          onCheckedChange={onTogglePassiveCapture}
          aria-label="Habilitar Captura Passiva de Notificações"
        />
      </label>

      {pendingPermission ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border border-warning/40 bg-warning/5 gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-xs text-foreground">
              Acesso a Notificações Pendente no Android
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Para detectar compras em segundo plano, conceda acesso ao leitor de notificações nas configurações do dispositivo.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenDisclosure}
              className="border-warning/40 hover:bg-warning/10 text-foreground"
            >
              Habilitar no Android
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onTogglePassiveCapture(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Desativar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-3 rounded-xl bg-surface-raised/60 p-3.5 text-xs">
        <ShieldCheck className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-semibold text-foreground text-xs">
            {PROMINENT_DISCLOSURE_INFO.onDeviceBadge}
          </span>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {PROMINENT_DISCLOSURE_INFO.onDeviceDescription}{" "}
            {PROMINENT_DISCLOSURE_INFO.dataDiscardDescription}
          </p>
        </div>
      </div>

      {effectiveActive ? (
        <label
          htmlFor={interactiveId}
          className={cn(
            "flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors cursor-pointer select-none",
            bankPrefs.interactiveNotificationsEnabled
              ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
              : "border-border/80 bg-surface hover:bg-surface-hover",
          )}
        >
          <div className="min-w-0 pr-1">
            <div className="font-semibold text-xs text-foreground">
              Notificações com Ação Rápida
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Exibe notificação interativa no celular com botões Adicionar em 1 toque e Editar.
            </div>
          </div>
          <Checkbox
            id={interactiveId}
            checked={bankPrefs.interactiveNotificationsEnabled}
            onCheckedChange={onToggleInteractiveNotifications}
            aria-label="Habilitar Notificações com Ação Rápida"
          />
        </label>
      ) : null}
    </>
  );
}
