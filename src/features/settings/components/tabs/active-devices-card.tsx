import { useState, useMemo } from "react";
import {
  Laptop,
  Smartphone,
  ShieldCheck,
  LogOut,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  ModalFooter,
  Skeleton,
  SkeletonList,
} from "@/components/ui";
import { useDevices, useRevokeDevice, useDeleteDevice } from "@/state";
import { getOrCreateDeviceId } from "@/services/native/device-info";
import { getActiveUserMfaFactor, verifyMfaTotpCode, verifyCurrentPassword } from "@/hooks/use-auth";
import { triggerSensory } from "@/services/sensory";
import { formatDateTimeBR } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { cn } from "@/lib/utils";
import type { UserDevice } from "@/types";

export interface ActiveDevicesCardProps {
  className?: string;
}

export function ActiveDevicesCard({ className }: ActiveDevicesCardProps) {
  const devicesQuery = useDevices();
  const revokeDeviceMutation = useRevokeDevice();
  const deleteDeviceMutation = useDeleteDevice();

  const currentDeviceId = useMemo(() => getOrCreateDeviceId(), []);

  // Modal de Revogação Segura
  const [targetDevice, setTargetDevice] = useState<UserDevice | null>(null);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [hasMfa, setHasMfa] = useState<boolean | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [isCheckingMfa, setIsCheckingMfa] = useState(false);
  const [challengeValue, setChallengeValue] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const devices = useMemo(() => devicesQuery.data ?? [], [devicesQuery.data]);

  // Ordena colocando o aparelho atual no topo, seguido dos mais recentes
  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => {
      if (a.device_id === currentDeviceId) return -1;
      if (b.device_id === currentDeviceId) return 1;
      if (a.is_revoked !== b.is_revoked) return a.is_revoked ? 1 : -1;
      return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
    });
  }, [devices, currentDeviceId]);

  const activeCount = useMemo(() => {
    return devices.filter((d) => !d.is_revoked).length;
  }, [devices]);

  const handleOpenRevokeModal = async (device: UserDevice) => {
    setTargetDevice(device);
    setChallengeValue("");
    setModalError(null);
    setIsRevokeModalOpen(true);
    setIsCheckingMfa(true);

    try {
      const factor = await getActiveUserMfaFactor();
      if (factor) {
        setHasMfa(true);
        setMfaFactorId(factor.id);
      } else {
        setHasMfa(false);
        setMfaFactorId(null);
      }
    } catch {
      setHasMfa(false);
      setMfaFactorId(null);
    } finally {
      setIsCheckingMfa(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!targetDevice || isVerifying || isCheckingMfa) return;
    setIsVerifying(true);
    setModalError(null);

    try {
      if (hasMfa && mfaFactorId) {
        const cleanCode = challengeValue.trim();
        if (cleanCode.length !== 6) {
          setModalError("Informe o código de 6 dígitos gerado pelo aplicativo autenticador.");
          setIsVerifying(false);
          return;
        }

        const isValidMfa = await verifyMfaTotpCode(mfaFactorId, cleanCode);
        if (!isValidMfa) {
          setModalError("Código de autenticação incorreto ou expirado. Tente novamente.");
          setIsVerifying(false);
          return;
        }
      } else {
        if (!challengeValue) {
          setModalError("Informe sua senha de acesso para autorizar a revogação.");
          setIsVerifying(false);
          return;
        }

        const isValidPassword = await verifyCurrentPassword(challengeValue);
        if (!isValidPassword) {
          setModalError("Senha incorreta. Não foi possível revogar a sessão.");
          setIsVerifying(false);
          return;
        }
      }

      await revokeDeviceMutation.mutateAsync(targetDevice.id);
      triggerSensory("destructive");
      setIsRevokeModalOpen(false);
      setTargetDevice(null);
      setChallengeValue("");
    } catch (err) {
      setModalError(getErrorMessage(err));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDeleteHistorical = async (deviceRecordId: string) => {
    try {
      await deleteDeviceMutation.mutateAsync(deviceRecordId);
    } catch {
      // Toast disparado na mutation
    }
  };

  return (
    <>
      <Card data-tour="settings-active-devices" className={cn("border-border/80 bg-surface shadow-xs", className)}>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Dispositivos Conectados</span>
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="default" size="xs">
                {activeCount} {activeCount === 1 ? "ativo" : "ativos"}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void devicesQuery.refetch()}
                disabled={devicesQuery.isFetching}
                className="h-7 w-7 p-0 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
                title="Atualizar lista de dispositivos"
                aria-label="Atualizar lista de dispositivos"
              >
                <RefreshCw
                  className={cn("size-3.5", devicesQuery.isFetching && "animate-spin text-primary")}
                  aria-hidden="true"
                />
              </Button>
            </div>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Acompanhe os aparelhos com sessão ativa na sua conta e desconecte dispositivos remotos com validação de segurança.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {devicesQuery.isLoading ? (
            <div role="status" aria-busy="true" className="space-y-2.5 p-1">
              <SkeletonList rows={3} />
              <span className="sr-only">Carregando dispositivos conectados...</span>
            </div>
          ) : sortedDevices.length === 0 ? (
            <div className="p-5 rounded-xl border border-dashed border-border/80 text-center">
              <p className="text-xs text-muted-foreground">
                Nenhum dispositivo registrado no momento.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedDevices.map((device) => {
                const isCurrent = device.device_id === currentDeviceId;
                const isRevoked = device.is_revoked;
                const isMobile =
                  device.os.toLowerCase().includes("android") ||
                  device.os.toLowerCase().includes("ios") ||
                  device.device_name.toLowerCase().includes("mobile");

                return (
                  <div
                    key={device.id}
                    data-testid={`device-row-${device.id}`}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors",
                      isCurrent
                        ? "border-primary/30 bg-primary/5"
                        : isRevoked
                          ? "border-border/60 bg-muted/10 opacity-75"
                          : "border-border/80 bg-muted/20",
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 shrink-0 text-muted-foreground">
                        {isMobile ? (
                          <Smartphone className="size-4" aria-hidden="true" />
                        ) : (
                          <Laptop className="size-4" aria-hidden="true" />
                        )}
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {device.device_name}
                          </span>
                          {isCurrent && (
                            <Badge variant="positive" size="xs">
                              Dispositivo Atual
                            </Badge>
                          )}
                          {isRevoked && (
                            <Badge variant="muted" size="xs">
                              Sessão Revogada
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                          <span>
                            {device.browser} · {device.os}
                          </span>
                          {device.ip_address && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>IP {device.ip_address}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>
                            {isCurrent
                              ? "Ativo agora"
                              : `Visto em ${formatDateTimeBR(device.last_seen_at)}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {isCurrent ? (
                        <span className="text-[11px] font-medium text-positive-strong px-2 py-1">
                          Sessão em uso
                        </span>
                      ) : !isRevoked ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => { void handleOpenRevokeModal(device); }}
                          disabled={revokeDeviceMutation.isPending}
                          className="h-8 px-2.5 text-xs font-semibold rounded-xl cursor-pointer text-critical-strong hover:bg-critical/10 hover:border-critical/30 gap-1.5"
                        >
                          <LogOut className="size-3.5" aria-hidden="true" />
                          <span>Revogar</span>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => { void handleDeleteHistorical(device.id); }}
                          disabled={deleteDeviceMutation.isPending}
                          className="h-8 px-2.5 text-xs font-medium rounded-xl cursor-pointer text-muted-foreground hover:text-foreground gap-1.5"
                          title="Remover registro histórico"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                          <span>Remover</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Desafio de Segurança para Revogação */}
      <Modal
        open={isRevokeModalOpen}
        onOpenChange={(open) => {
          if (!open && !isVerifying) {
            setIsRevokeModalOpen(false);
            setTargetDevice(null);
            setChallengeValue("");
            setModalError(null);
          }
        }}
        title="Revogar Dispositivo Remoto"
        description="Encerrar a sessão ativa no aparelho selecionado."
        size="sm"
      >
        <div className="space-y-4 pt-1">
          {modalError ? <Alert variant="error">{modalError}</Alert> : null}

          <div className="rounded-xl border border-warning/25 bg-warning/10 p-3 space-y-1">
            <span className="text-xs font-semibold text-warning-strong flex items-center gap-1.5">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              <span>Desconexão Imediata</span>
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              A sessão em <strong className="text-foreground">{targetDevice?.device_name}</strong> será encerrada. O aparelho perderá o acesso imediatamente.
            </p>
          </div>

          {isCheckingMfa ? (
            <div role="status" aria-busy="true" className="space-y-2 p-2">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <span className="sr-only">Verificando requisitos de segurança...</span>
            </div>
          ) : hasMfa ? (
            <div className="space-y-1.5">
              <label htmlFor="device-revoke-totp-input" className="text-xs font-semibold text-foreground block">
                Código de Autenticação em Duas Etapas (2FA)
              </label>
              <Input
                id="device-revoke-totp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={challengeValue}
                onChange={(e) => {
                  setChallengeValue(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (modalError) setModalError(null);
                }}
                disabled={isVerifying}
                autoComplete="one-time-code"
                className="h-10 text-base sm:text-sm font-mono tracking-widest text-center rounded-xl"
              />
              <span className="text-[11px] text-muted-foreground block">
                Abra seu app autenticador e digite o código de 6 dígitos gerado.
              </span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="device-revoke-password-input" className="text-xs font-semibold text-foreground block">
                Confirme sua Senha Atual
              </label>
              <Input
                id="device-revoke-password-input"
                type="password"
                placeholder="Digite sua senha de acesso"
                value={challengeValue}
                onChange={(e) => {
                  setChallengeValue(e.target.value);
                  if (modalError) setModalError(null);
                }}
                disabled={isVerifying}
                autoComplete="current-password"
                className="h-10 text-base sm:text-sm rounded-xl"
              />
              <span className="text-[11px] text-muted-foreground block">
                Para sua segurança, confirme sua senha para autorizar a revogação.
              </span>
            </div>
          )}

          <ModalFooter className="mt-4 pt-3 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRevokeModalOpen(false)}
              disabled={isVerifying}
              className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => { void handleConfirmRevoke(); }}
              disabled={isVerifying || isCheckingMfa || !challengeValue.trim()}
              className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                  <span>Validando...</span>
                </>
              ) : (
                <>
                  <LogOut className="size-3.5 mr-1.5" aria-hidden="true" />
                  <span>Revogar Sessão</span>
                </>
              )}
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </>
  );
}
