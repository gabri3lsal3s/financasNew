import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsPopover } from "@/components/modules/notifications-popover";
import { useReminders } from "@/state";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/services/haptics";

/**
 * Botão de notificações no header com indicador de contagem e popover rápido.
 */
export function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const { totalCount, overdueCount, dueTodayCount } = useReminders();

  const isUrgent = overdueCount > 0;
  const isDueToday = dueTodayCount > 0;

  const displayCount = totalCount > 9 ? "9+" : totalCount > 0 ? String(totalCount) : null;

  return (
    <NotificationsPopover open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={
          totalCount > 0
            ? `Notificações: ${totalCount} pendências`
            : "Notificações"
        }
        title="Lembretes e Avisos"
        onClick={() => triggerHaptic("light")}
        className="relative"
      >
        <Bell aria-hidden="true" />
        {displayCount !== null && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ring-2 ring-surface transition-transform animate-in zoom-in-50",
              isUrgent
                ? "bg-danger text-white shadow-xs"
                : isDueToday
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-primary text-primary-contrast",
            )}
          >
            {displayCount}
          </span>
        )}
      </Button>
    </NotificationsPopover>
  );
}
