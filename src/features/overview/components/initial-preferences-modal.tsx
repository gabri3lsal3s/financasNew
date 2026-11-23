import { useEffect, useState } from "react";
import { Bell, Eye, Fingerprint, Mail, Smartphone } from "lucide-react";
import { Badge, Button, Modal, ModalFooter, Switch } from "@/components/ui";
import { resolveHeaderActionOrder, type HeaderActionSlotKey } from "@/domain/preferences/visual-defaults";
import { useNotificationPreferencesForm } from "@/features/reminders";
import { useBankingAssistant } from "@/features/settings/components/tabs/notifications/use-banking-assistant";
import { ProminentDisclosureModal } from "@/features/settings/components/tabs/notifications/prominent-disclosure-modal";
import { useAuth } from "@/hooks/use-auth";
import { updateVisualCustomization, useVisualCustomization } from "@/hooks/use-visual-customization";
import { cn } from "@/lib/utils";
import {
  authenticateWithBiometrics,
  checkBiometricsAvailability,
  clearWebAuthnPlatformCredential,
  isBiometricLockEnabled,
  resetAppLockBackgroundTimer,
  setBiometricLockEnabled,
} from "@/services/native";
import { pushToast } from "@/services/toast";
import { useUpdateCustomSettings } from "@/state";

export interface InitialPreferencesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal enxuto e não-bloqueante de personalização inicial (sob demanda no primeiro uso).
 * Aplica Verdade de Estado (Truth-in-State): switches só refletem ativo quando a permissão
 * real do sistema operacional/navegador e a capacidade do aparelho estão concedidas.
 */
export function InitialPreferencesModal({
  open,
  onOpenChange,
}: InitialPreferencesModalProps) {
  const { user } = useAuth();
  const form = useNotificationPreferencesForm();
  const bankAssistant = useBankingAssistant();
  const visual = useVisualCustomization();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [bioLockEnabled, setBioLockEnabled] = useState(() => isBiometricLockEnabled());
  const [biometricPending, setBiometricPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void checkBiometricsAvailability().then((res) => {
      if (cancelled) return;
      setBiometricsAvailable(Boolean(res.isAvailable));
      setBioLockEnabled(isBiometricLockEnabled());
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const deviceAlertsActive = form.effectiveDeviceAlertsActive;
  const deviceAlertsBlocked = form.devicePermissionDenied;
  const deviceAlertsSwitchDisabled =
    form.iosNeedsInstall || form.remotePushBusy || deviceAlertsBlocked;

  const deviceStatusLabel = form.iosNeedsInstall
    ? "Instalar na Tela Inicial"
    : deviceAlertsBlocked
      ? form.isNative
        ? "Bloqueado no Android"
        : "Bloqueado no navegador"
      : deviceAlertsActive
        ? "Ativado neste aparelho"
        : form.deviceAlertsPendingPermission
          ? "Permissão Pendente"
          : "Desativado";

  const privacyToggleEnabled = Boolean(visual.headerButtons.privacyToggle);
  const effectiveBiometricActive = biometricsAvailable && bioLockEnabled;

  const handleToggleHeaderPrivacy = (nextChecked: boolean) => {
    const currentOrder = resolveHeaderActionOrder(visual.headerButtons);

    if (nextChecked) {
      const keptFirst: HeaderActionSlotKey =
        currentOrder.find((key) => key !== "privacyToggle") ?? "calculatorButton";
      const nextOrder: HeaderActionSlotKey[] = [keptFirst, "privacyToggle"];
      const nextHeaderButtons = {
        ...visual.headerButtons,
        calculatorButton: nextOrder.includes("calculatorButton"),
        themeToggle: nextOrder.includes("themeToggle"),
        privacyToggle: true,
        order: nextOrder,
      };
      updateVisualCustomization({ headerButtons: nextHeaderButtons });
      updateCustomSettingsMutation.mutate({ headerButtons: nextHeaderButtons });
      return;
    }

    const remaining = currentOrder.filter((key) => key !== "privacyToggle");
    const restoreCandidate: HeaderActionSlotKey = remaining.includes("themeToggle")
      ? "calculatorButton"
      : "themeToggle";
    const nextOrder: HeaderActionSlotKey[] =
      remaining.length < 2 && !remaining.includes(restoreCandidate)
        ? [...remaining, restoreCandidate]
        : remaining;
    const nextHeaderButtons = {
      ...visual.headerButtons,
      calculatorButton: nextOrder.includes("calculatorButton"),
      themeToggle: nextOrder.includes("themeToggle"),
      privacyToggle: false,
      order: nextOrder,
    };
    updateVisualCustomization({ headerButtons: nextHeaderButtons });
    updateCustomSettingsMutation.mutate({ headerButtons: nextHeaderButtons });
  };

  const handleToggleBiometricLock = async (nextChecked: boolean) => {
    if (biometricPending) return;
    if (!nextChecked) {
      clearWebAuthnPlatformCredential();
      setBiometricLockEnabled(false);
      setBioLockEnabled(false);
      pushToast({
        title: "Bloqueio biométrico desativado",
        variant: "default",
      });
      return;
    }

    setBiometricPending(true);
    try {
      const result = await authenticateWithBiometrics({
        reason: "Confirme sua biometria para habilitar o desbloqueio do aplicativo",
        userId: user?.id ?? undefined,
      });
      if (!result.success) {
        setBioLockEnabled(false);
        pushToast({
          title: "Biometria não confirmada",
          description: result.error ?? "Não foi possível validar sua biometria neste aparelho.",
          variant: "warning",
        });
        return;
      }

      setBiometricLockEnabled(true);
      resetAppLockBackgroundTimer();
      setBioLockEnabled(true);
      pushToast({
        title: "Bloqueio biométrico ativado",
        description: "O aplicativo solicitará sua biometria ao retornar do segundo plano.",
        variant: "success",
      });
    } finally {
      setBiometricPending(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Personalizar alertas e privacidade"
        description="Escolha apenas o que faz sentido para a sua rotina. Você pode alterar tudo depois em Configurações."
        size="md"
        footer={
          <ModalFooter borderless>
            <Button
              type="button"
              variant="default"
              onClick={() => onOpenChange(false)}
              className="font-semibold"
            >
              Concluir
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3 py-1">
          <div
            className={cn(
              "flex items-start justify-between gap-4 rounded-xl border p-3.5 shadow-xs transition-colors",
              deviceAlertsActive
                ? "border-primary/40 bg-primary/5"
                : "border-border/80 bg-surface",
            )}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <Bell className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    Alertas de contas e Pix neste aparelho
                  </span>
                  <Badge
                    variant={
                      deviceAlertsActive
                        ? "default"
                        : form.iosNeedsInstall || deviceAlertsBlocked || form.deviceAlertsPendingPermission
                          ? "warning"
                          : "muted"
                    }
                    size="xs"
                  >
                    {deviceStatusLabel}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {form.iosNeedsInstall
                    ? "No iPhone/iPad, adicione o Axir à Tela de Início para receber avisos neste aparelho."
                    : deviceAlertsBlocked
                      ? form.isNative
                        ? "As notificações do Axir estão bloqueadas nas configurações do Android."
                        : "Libere as notificações no ícone de cadeado ao lado do endereço do site para ativar."
                      : "Avisos de faturas próximas, contas a pagar e Pix sinalizado em rachas, com proteção noturna do Horário Silencioso (22:00 às 08:00)."}
                </p>
              </div>
            </div>
            <Switch
              checked={deviceAlertsActive}
              disabled={deviceAlertsSwitchDisabled}
              onCheckedChange={(checked) => {
                void form.handleToggleUnifiedDeviceAlerts(checked);
              }}
              aria-label="Habilitar alertas de contas e Pix neste aparelho"
            />
          </div>

          {bankAssistant.isNative && bankAssistant.isBankListenerAllowed ? (
            <div
              className={cn(
                "flex items-start justify-between gap-4 rounded-xl border p-3.5 shadow-xs transition-colors",
                bankAssistant.effectivePassiveCaptureActive
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/80 bg-surface",
              )}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Smartphone className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      Leitura automática de notificações bancárias
                    </span>
                    <Badge
                      variant={
                        bankAssistant.effectivePassiveCaptureActive
                          ? "default"
                          : bankAssistant.isPassiveCapturePendingPermission
                            ? "warning"
                            : "muted"
                      }
                      size="xs"
                    >
                      {bankAssistant.effectivePassiveCaptureActive
                        ? "Ativado"
                        : bankAssistant.isPassiveCapturePendingPermission
                          ? "Permissão Pendente"
                          : "Desativado"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Identifica compras no cartão e Pix localmente no celular para sugerir lançamentos sem expor suas credenciais.
                  </p>
                </div>
              </div>
              <Switch
                checked={bankAssistant.effectivePassiveCaptureActive}
                onCheckedChange={bankAssistant.handleTogglePassiveCapture}
                aria-label="Habilitar leitura automática de notificações bancárias"
              />
            </div>
          ) : null}

          <div
            className={cn(
              "flex items-start justify-between gap-4 rounded-xl border p-3.5 shadow-xs transition-colors",
              privacyToggleEnabled
                ? "border-primary/40 bg-primary/5"
                : "border-border/80 bg-surface",
            )}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <Eye className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    Botão de ocultar valores no topo
                  </span>
                  <Badge variant={privacyToggleEnabled ? "default" : "muted"} size="xs">
                    {privacyToggleEnabled ? "Visível no topo" : "Oculto"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Adiciona o ícone de privacidade ao cabeçalho para esconder saldos e receitas com um toque em locais públicos.
                </p>
              </div>
            </div>
            <Switch
              checked={privacyToggleEnabled}
              onCheckedChange={handleToggleHeaderPrivacy}
              aria-label="Exibir botão de ocultar valores no topo"
            />
          </div>

          {biometricsAvailable ? (
            <div
              className={cn(
                "flex items-start justify-between gap-4 rounded-xl border p-3.5 shadow-xs transition-colors",
                effectiveBiometricActive
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/80 bg-surface",
              )}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Fingerprint className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      Desbloqueio com biometria ao abrir
                    </span>
                    <Badge variant={effectiveBiometricActive ? "default" : "muted"} size="xs">
                      {effectiveBiometricActive ? "Ativado" : "Opcional"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Exige confirmação biométrica do aparelho ao retornar para o aplicativo após sair da tela.
                  </p>
                </div>
              </div>
              <Switch
                checked={effectiveBiometricActive}
                disabled={biometricPending}
                onCheckedChange={(checked) => {
                  void handleToggleBiometricLock(checked);
                }}
                aria-label="Habilitar desbloqueio com biometria ao abrir"
              />
            </div>
          ) : null}

          <div
            className={cn(
              "flex items-start justify-between gap-4 rounded-xl border p-3.5 shadow-xs transition-colors",
              form.weeklyDigestEnabled
                ? "border-primary/40 bg-primary/5"
                : "border-border/80 bg-surface",
            )}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <Mail className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    Resumo semanal de domingo por e-mail
                  </span>
                  <Badge variant={form.weeklyDigestEnabled ? "default" : "muted"} size="xs">
                    {form.weeklyDigestEnabled ? "Ativado" : "Opcional"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Receba todo domingo um resumo consolidado dos seus gastos da semana e contas em aberto.
                </p>
              </div>
            </div>
            <Switch
              checked={form.weeklyDigestEnabled}
              disabled={form.isWeeklyDigestPending}
              onCheckedChange={form.handleToggleWeeklyDigest}
              aria-label="Habilitar resumo semanal de domingo por e-mail"
            />
          </div>
        </div>
      </Modal>

      {bankAssistant.isNative && bankAssistant.isBankListenerAllowed ? (
        <ProminentDisclosureModal
          open={bankAssistant.isDisclosureModalOpen}
          onOpenChange={bankAssistant.setIsDisclosureModalOpen}
          onConfirm={() => {
            void bankAssistant.handleConfirmDisclosure();
          }}
        />
      ) : null}
    </>
  );
}
