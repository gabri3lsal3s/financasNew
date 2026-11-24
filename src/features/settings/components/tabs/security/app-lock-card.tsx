import { Fingerprint, KeyRound } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  FormField,
  Select,
  type SelectOption,
} from "@/components/ui";

const APP_LOCK_GRACE_OPTIONS: SelectOption[] = [
  { value: "0", label: "Imediato (ao sair do app)" },
  { value: "1", label: "Após 1 minuto em segundo plano" },
  { value: "5", label: "Após 5 minutos em segundo plano" },
  { value: "15", label: "Após 15 minutos em segundo plano" },
  { value: "30", label: "Após 30 minutos em segundo plano" },
];

export interface AppLockCardProps {
  showBiometrics: boolean;
  showPrivacyShield: boolean;
  biometricsAvailable: boolean | null;
  biometryType: string;
  isDemoActive: boolean;
  bioLockEnabled: boolean;
  graceMinutes: string;
  lockOnIdle?: boolean;
  hasPinConfigured: boolean;
  privacyEnabled: boolean;
  onToggleBiometrics: (enabled: boolean) => void;
  onTogglePinLock: (enabled: boolean) => void;
  onOpenPinDialog: () => void;
  onGraceMinutesChange: (val: string) => void;
  onToggleLockOnIdle?: (enabled: boolean) => void;
  onTogglePrivacyShield: (enabled: boolean) => void;
}

export function AppLockCard({
  showBiometrics,
  showPrivacyShield,
  biometricsAvailable,
  biometryType,
  isDemoActive,
  bioLockEnabled,
  graceMinutes,
  lockOnIdle = true,
  hasPinConfigured,
  privacyEnabled,
  onToggleBiometrics,
  onTogglePinLock,
  onOpenPinDialog,
  onGraceMinutesChange,
  onToggleLockOnIdle,
  onTogglePrivacyShield,
}: AppLockCardProps) {
  const showIdleToggle = Number(graceMinutes) > 0 && Boolean(onToggleLockOnIdle);
  const effectiveBiometricActive =
    bioLockEnabled && (biometricsAvailable !== false || isDemoActive);
  const effectivePinActive = bioLockEnabled && hasPinConfigured;

  return (
    <Card data-tour="settings-app-lock">
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Fingerprint className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>Bloqueio do Aplicativo &amp; Privacidade</span>
          </CardTitle>
          <div className="shrink-0 self-start sm:self-auto">
            {showBiometrics ? (
              biometricsAvailable === false && !isDemoActive ? (
                <Badge variant="muted" size="xs">
                  Biometria Indisponível
                </Badge>
              ) : bioLockEnabled && (biometricsAvailable || isDemoActive) ? (
                <Badge variant="default" size="xs">
                  {biometryType === "face"
                    ? "Bloqueio Facial Ativo"
                    : biometryType === "iris"
                      ? "Bloqueio por Íris Ativo"
                      : "Bloqueio Biométrico Ativo"}
                </Badge>
              ) : biometricsAvailable !== null || isDemoActive ? (
                <Badge variant="muted" size="xs">
                  Bloqueio Desativado
                </Badge>
              ) : null
            ) : (
              <Badge variant={effectivePinActive ? "default" : "muted"} size="xs">
                {effectivePinActive
                  ? "Bloqueio por PIN Ativo"
                  : hasPinConfigured
                    ? "Bloqueio Desativado"
                    : "PIN Não Configurado"}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showBiometrics ? (
          <div className="space-y-4 rounded-xl bg-surface-raised/60 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <label
                  htmlFor="toggle-biometrics"
                  className="text-sm font-semibold text-foreground cursor-pointer block"
                >
                  Exigir biometria ao retornar
                </label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Bloqueia o acesso às suas informações financeiras quando você alternar de aplicativo ou minimizar a tela.
                </p>
              </div>
              <Checkbox
                id="toggle-biometrics"
                aria-label="Exigir biometria ao retornar ao aplicativo"
                checked={effectiveBiometricActive}
                disabled={biometricsAvailable === false && !isDemoActive}
                onCheckedChange={onToggleBiometrics}
              />
            </div>

            {effectiveBiometricActive ? (
              <div className="pt-3 border-t border-border/80 space-y-3">
                <FormField
                  label="Tolerância para bloqueio"
                  htmlFor="app-lock-grace-bio"
                  helperText="Define quanto tempo o app pode permanecer em segundo plano antes de exigir nova validação biométrica."
                >
                  <Select
                    id="app-lock-grace-bio"
                    value={graceMinutes}
                    onValueChange={onGraceMinutesChange}
                    options={APP_LOCK_GRACE_OPTIONS}
                    ariaLabel="Selecione o tempo de tolerância para bloqueio"
                  />
                </FormField>

                {showIdleToggle ? (
                  <div className="flex items-start justify-between gap-4 pt-2 border-t border-border/60">
                    <div className="space-y-0.5 min-w-0">
                      <label
                        htmlFor="toggle-lock-on-idle-bio"
                        className="text-xs font-semibold text-foreground cursor-pointer block"
                      >
                        Bloquear também quando a tela ficar parada
                      </label>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Trava o aplicativo sem encerrar sua sessão se ficar sem interação pelo tempo de tolerância.
                      </p>
                    </div>
                    <Checkbox
                      id="toggle-lock-on-idle-bio"
                      aria-label="Bloquear também quando a tela ficar parada"
                      checked={lockOnIdle}
                      onCheckedChange={(checked) => onToggleLockOnIdle?.(Boolean(checked))}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4 rounded-xl bg-surface-raised/60 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <label
                  htmlFor="toggle-pin-lock"
                  className="text-sm font-semibold text-foreground cursor-pointer block"
                >
                  Bloqueio com PIN de Acesso
                </label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Exige um código PIN numérico de 4 a 6 dígitos ao retornar para a aba do aplicativo após o tempo de tolerância.
                </p>
              </div>
              <Checkbox
                id="toggle-pin-lock"
                aria-label="Exigir PIN ao retornar ao aplicativo"
                checked={effectivePinActive}
                onCheckedChange={onTogglePinLock}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-border/80">
              <span className="text-xs text-muted-foreground">
                {hasPinConfigured ? "PIN configurado neste dispositivo" : "Nenhum PIN configurado"}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenPinDialog}
                className="gap-1.5 self-start sm:self-auto"
              >
                <KeyRound className="size-3.5" aria-hidden="true" />
                <span>{hasPinConfigured ? "Alterar PIN" : "Configurar PIN"}</span>
              </Button>
            </div>

            {effectivePinActive ? (
              <div className="pt-3 border-t border-border/80 space-y-3">
                <FormField
                  label="Tolerância para bloqueio"
                  htmlFor="app-lock-grace-pin"
                  helperText="Define quanto tempo a aba pode permanecer inativa antes de exigir o PIN."
                >
                  <Select
                    id="app-lock-grace-pin"
                    value={graceMinutes}
                    onValueChange={onGraceMinutesChange}
                    options={APP_LOCK_GRACE_OPTIONS}
                    ariaLabel="Selecione o tempo de tolerância para bloqueio"
                  />
                </FormField>

                {showIdleToggle ? (
                  <div className="flex items-start justify-between gap-4 pt-2 border-t border-border/60">
                    <div className="space-y-0.5 min-w-0">
                      <label
                        htmlFor="toggle-lock-on-idle-pin"
                        className="text-xs font-semibold text-foreground cursor-pointer block"
                      >
                        Bloquear também quando a tela ficar parada
                      </label>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Exige o PIN sem encerrar sua sessão se a aba ficar parada pelo tempo de tolerância.
                      </p>
                    </div>
                    <Checkbox
                      id="toggle-lock-on-idle-pin"
                      aria-label="Bloquear também quando a tela ficar parada"
                      checked={lockOnIdle}
                      onCheckedChange={(checked) => onToggleLockOnIdle?.(Boolean(checked))}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {showPrivacyShield ? (
          <div className="flex items-start justify-between gap-4 rounded-xl bg-surface-raised/60 p-4">
            <div className="space-y-0.5 min-w-0">
              <label
                htmlFor="toggle-privacy-shield"
                className="text-sm font-semibold text-foreground cursor-pointer block"
              >
                Escudo de Privacidade (Privacy Shield)
              </label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Oculta saldos e dados na tela de aplicativos recentes do sistema e bloqueia capturas de tela.
              </p>
            </div>
            <Checkbox
              id="toggle-privacy-shield"
              aria-label="Ativar escudo de privacidade contra capturas e visualização recente"
              checked={privacyEnabled}
              onCheckedChange={onTogglePrivacyShield}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
