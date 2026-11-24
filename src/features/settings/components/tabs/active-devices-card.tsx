import { useMemo, useState } from "react";
import { KeyRound, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  SkeletonList,
} from "@/components/ui";
import {
  getActiveUserMfaFactor,
  verifyCurrentPassword,
  verifyMfaTotpCode,
} from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/errors";
import { getOrCreateDeviceId } from "@/services/native/device-info";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useDeleteDevice, useDevices, useRevokeDevice } from "@/state";
import type { UserDevice } from "@/types";
import { DeviceRowItem } from "./security/device-row-item";
import { RevokeDeviceModal } from "./security/revoke-device-modal";

const REVOKED_RETENTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_VISIBLE_REVOKED_DEVICES = 5;

export interface ActiveDevicesCardProps {
  className?: string;
}

export function ActiveDevicesCard({ className }: ActiveDevicesCardProps) {
  const devicesQuery = useDevices();
  const revokeDeviceMutation = useRevokeDevice();
  const deleteDeviceMutation = useDeleteDevice();
  const { signOut } = useSignOut();

  const currentDeviceId = useMemo(() => getOrCreateDeviceId(), []);

  const [targetDevice, setTargetDevice] = useState<UserDevice | null>(null);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [isDisconnectOthersOpen, setIsDisconnectOthersOpen] = useState(false);
  const [isDisconnectingOthers, setIsDisconnectingOthers] = useState(false);
  const [hasMfa, setHasMfa] = useState<boolean | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [isCheckingMfa, setIsCheckingMfa] = useState(false);
  const [challengeValue, setChallengeValue] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [referenceNow, setReferenceNow] = useState(() => Date.now());

  const devices = useMemo(() => devicesQuery.data ?? [], [devicesQuery.data]);

  const sortedDevices = useMemo(() => {
    const active: UserDevice[] = [];
    const recentRevoked: UserDevice[] = [];

    for (const d of devices) {
      if (!d.is_revoked) {
        active.push(d);
      } else {
        const seenAt = new Date(d.last_seen_at).getTime();
        if (Number.isFinite(seenAt) && referenceNow - seenAt <= REVOKED_RETENTION_WINDOW_MS) {
          recentRevoked.push(d);
        }
      }
    }

    active.sort((a, b) => {
      if (a.device_id === currentDeviceId) return -1;
      if (b.device_id === currentDeviceId) return 1;
      return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
    });

    recentRevoked.sort(
      (a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime(),
    );

    return [...active, ...recentRevoked.slice(0, MAX_VISIBLE_REVOKED_DEVICES)];
  }, [devices, currentDeviceId, referenceNow]);

  const activeCount = useMemo(
    () => devices.filter((d) => !d.is_revoked).length,
    [devices],
  );
  const hasOtherActiveDevices = useMemo(
    () => devices.some((d) => !d.is_revoked && d.device_id !== currentDeviceId),
    [devices, currentDeviceId],
  );

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

  const handleCloseRevokeModal = () => {
    setIsRevokeModalOpen(false);
    setTargetDevice(null);
    setChallengeValue("");
    setModalError(null);
  };

  const handleConfirmRevoke = async () => {
    if (!targetDevice || isVerifying || isCheckingMfa) return;
    setIsVerifying(true);
    setModalError(null);

    try {
      if (hasMfa && mfaFactorId) {
        const cleanCode = challengeValue.trim();
        if (cleanCode.length !== 6) {
          triggerSensory("error");
          setModalError("Informe o código de 6 dígitos gerado pelo aplicativo autenticador.");
          setIsVerifying(false);
          return;
        }

        const isValidMfa = await verifyMfaTotpCode(mfaFactorId, cleanCode);
        if (!isValidMfa) {
          triggerSensory("error");
          setModalError("Código de autenticação incorreto ou expirado. Tente novamente.");
          setIsVerifying(false);
          return;
        }
      } else {
        if (!challengeValue) {
          triggerSensory("error");
          setModalError("Informe sua senha de acesso para autorizar a revogação.");
          setIsVerifying(false);
          return;
        }

        const isValidPassword = await verifyCurrentPassword(challengeValue);
        if (!isValidPassword) {
          triggerSensory("error");
          setModalError("Senha incorreta. Não foi possível revogar a sessão.");
          setIsVerifying(false);
          return;
        }
      }

      await revokeDeviceMutation.mutateAsync(targetDevice.id);
      triggerSensory("destructive");
      handleCloseRevokeModal();
    } catch (err) {
      triggerSensory("error");
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

  const handleDisconnectOthers = async () => {
    if (isDisconnectingOthers) return;
    setIsDisconnectingOthers(true);
    try {
      await signOut({ scope: "others" });
      triggerSensory("success");
      pushToast({
        title: "Outros acessos encerrados",
        description:
          "Todas as sessões ativas em outros navegadores ou aparelhos foram desconectadas com sucesso.",
        variant: "success",
      });
      setIsDisconnectOthersOpen(false);
    } catch (err) {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível encerrar outras sessões",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsDisconnectingOthers(false);
    }
  };

  return (
    <>
      <Card data-tour="settings-active-devices" className={className}>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>Dispositivos Conectados</span>
            </CardTitle>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="default" size="xs">
                {activeCount} {activeCount === 1 ? "ativo" : "ativos"}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                sensoryIntent="selection"
                onClick={() => {
                  setReferenceNow(Date.now());
                  void devicesQuery.refetch();
                }}
                disabled={devicesQuery.isFetching}
                className="size-8 p-0 text-muted-foreground hover:text-foreground"
                title="Atualizar lista de dispositivos"
                aria-label="Atualizar lista de dispositivos"
              >
                <RefreshCw
                  className={cn("size-3.5", devicesQuery.isFetching && "animate-spin text-primary")}
                  aria-hidden="true"
                />
              </Button>
            </div>
          </div>
          <CardDescription>
            Acompanhe os aparelhos com sessão ativa na sua conta e desconecte dispositivos remotos com validação de segurança.
          </CardDescription>
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
              {sortedDevices.map((device) => (
                <DeviceRowItem
                  key={device.id}
                  device={device}
                  isCurrent={device.device_id === currentDeviceId}
                  isRevokePending={revokeDeviceMutation.isPending}
                  isDeletePending={deleteDeviceMutation.isPending}
                  onRequestRevoke={(item) => {
                    void handleOpenRevokeModal(item);
                  }}
                  onDeleteHistorical={(id) => {
                    void handleDeleteHistorical(id);
                  }}
                />
              ))}
            </div>
          )}

          {hasOtherActiveDevices || activeCount > 1 ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-surface-raised/60 p-3.5 border border-border/80">
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs font-semibold text-foreground block">
                  Encerrar todas as outras sessões
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Desconecta imediatamente sua conta em todos os outros computadores e celulares, mantendo apenas este aparelho.
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                sensoryIntent={false}
                disabled={isDisconnectingOthers}
                onClick={() => setIsDisconnectOthersOpen(true)}
                className="shrink-0 gap-1.5 self-start sm:self-auto"
              >
                {isDisconnectingOthers ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    <span>Encerrando…</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>Desconectar outros aparelhos</span>
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <RevokeDeviceModal
        open={isRevokeModalOpen}
        targetDevice={targetDevice}
        hasMfa={hasMfa}
        isCheckingMfa={isCheckingMfa}
        isVerifying={isVerifying}
        challengeValue={challengeValue}
        modalError={modalError}
        onClose={handleCloseRevokeModal}
        onChallengeChange={(val) => {
          setChallengeValue(val);
          if (modalError) setModalError(null);
        }}
        onConfirm={handleConfirmRevoke}
      />

      <ConfirmDialog
        open={isDisconnectOthersOpen}
        onOpenChange={(open) => {
          if (!isDisconnectingOthers) setIsDisconnectOthersOpen(open);
        }}
        title="Desconectar outros aparelhos"
        description="Todas as sessões ativas em outros navegadores e celulares serão encerradas imediatamente."
        confirmLabel="Desconectar outros"
        cancelLabel="Cancelar"
        variant="destructive"
        confirmPending={isDisconnectingOthers}
        onConfirm={() => {
          void handleDisconnectOthers();
        }}
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          Este dispositivo permanecerá conectado normalmente. Os demais aparelhos precisarão informar e-mail e senha novamente.
        </p>
      </ConfirmDialog>
    </>
  );
}
