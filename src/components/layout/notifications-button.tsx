import { useState } from "react";
import { Bell } from "lucide-react";
import { NotificationsPopover } from "@/components/modules/notifications-popover";
import { Button } from "@/components/ui/button";
import { useNotificationCenter } from "@/hooks/use-notification-center";
import { cn } from "@/lib/utils";

/**
 * Botão de notificações no header com indicador de contagem e popover rápido.
 * Consome contagem e severidade unificadas do Notification Hub (`useNotificationCenter`).
 */
export function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const {
    totalBellCount: effectiveTotalCount,
    criticalCount,
    actionNeededCount,
    advisorAlerts,
    dismissAdvisor,
  } = useNotificationCenter();

  const isCritical = criticalCount > 0;
  const isActionNeeded = !isCritical && actionNeededCount > 0;

  const displayCount =
    effectiveTotalCount > 9 ? "9+" : String(effectiveTotalCount);

  return (
    <NotificationsPopover
      open={open}
      onOpenChange={setOpen}
      advisorAlerts={advisorAlerts}
      onDismissAdvisor={dismissAdvisor}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={
          effectiveTotalCount > 0
            ? `Notificações: ${effectiveTotalCount} ${effectiveTotalCount === 1 ? "pendência" : "pendências"}`
            : "Central de Lembretes e Avisos"
        }
        title="Lembretes e Avisos"
        className="relative overflow-visible"
      >
        <Bell aria-hidden="true" />
        {effectiveTotalCount > 0 ? (
          <span
            className={cn(
              "absolute -top-1 -right-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ring-2 ring-surface pointer-events-none transition-transform animate-in zoom-in-50",
              isCritical
                ? "bg-critical text-white shadow-xs"
                : isActionNeeded
                  ? "bg-warning-strong text-white shadow-xs"
                  : "bg-primary text-primary-foreground",
            )}
          >
            {displayCount}
          </span>
        ) : null}
      </Button>
    </NotificationsPopover>
  );
}
