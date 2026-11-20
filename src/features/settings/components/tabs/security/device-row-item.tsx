import { Laptop, LogOut, Smartphone, Trash2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { formatDateTimeBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { UserDevice } from "@/types";

export interface DeviceRowItemProps {
  device: UserDevice;
  isCurrent: boolean;
  isRevokePending: boolean;
  isDeletePending: boolean;
  onRequestRevoke: (device: UserDevice) => void;
  onDeleteHistorical: (deviceRecordId: string) => void;
}

export function DeviceRowItem({
  device,
  isCurrent,
  isRevokePending,
  isDeletePending,
  onRequestRevoke,
  onDeleteHistorical,
}: DeviceRowItemProps) {
  const isRevoked = device.is_revoked;
  const isMobile =
    device.os.toLowerCase().includes("android") ||
    device.os.toLowerCase().includes("ios") ||
    device.device_name.toLowerCase().includes("mobile");

  return (
    <div
      data-testid={`device-row-${device.id}`}
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors",
        isCurrent
          ? "border-primary/30 bg-primary/5"
          : isRevoked
            ? "border-border/80 bg-muted/20 opacity-75"
            : "border-border/80 bg-surface-raised/60",
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
            <span className="text-xs font-semibold text-foreground line-clamp-2 break-words">
              {device.device_name}
            </span>
            {isCurrent ? (
              <Badge variant="default" size="xs">
                Dispositivo Atual
              </Badge>
            ) : null}
            {isRevoked ? (
              <Badge variant="muted" size="xs">
                Sessão Revogada
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            <span>
              {device.browser} · {device.os}
            </span>
            {device.ip_address ? (
              <>
                <span aria-hidden="true">·</span>
                <span>IP {device.ip_address}</span>
              </>
            ) : null}
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
            variant="destructive"
            size="sm"
            onClick={() => onRequestRevoke(device)}
            disabled={isRevokePending}
            className="gap-1.5"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            <span>Revogar</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDeleteHistorical(device.id)}
            disabled={isDeletePending}
            className="text-muted-foreground hover:text-foreground gap-1.5"
            title="Remover registro histórico"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span>Remover</span>
          </Button>
        )}
      </div>
    </div>
  );
}
