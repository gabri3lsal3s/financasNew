import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsPopover } from "@/components/modules/notifications-popover";
import { useReminders } from "@/state";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/services/haptics";

/**
 * Botão de notificações no header com indicador de contagem e popover rápido.
 * Renderiza null quando não há pendências — aparece apenas quando há notificações.
 */
export function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const { totalCount, overdueCount, dueTodayCount } = useReminders();

  if (totalCount === 0) return null;

  const isUrgent = overdueCount > 0;
  const isDueToday = dueTodayCount > 0;

  const displayCount = totalCount > 9 ? "9+" : String(totalCount);

  return (
    <NotificationsPopover open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Notificações: ${totalCount} pendências`}
        title="Lembretes e Avisos"
        onClick={() => triggerHaptic("light")}
        className="relative overflow-visible"
      >
        <Bell aria-hidden="true" />
        <span
          className={cn(
            "absolute -top-1 -right-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ring-2 ring-surface pointer-events-none transition-transform animate-in zoom-in-50",
            isUrgent
              ? "bg-danger text-white shadow-xs"
              : isDueToday
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-primary text-primary-contrast",
          )}
        >
          {displayCount}
        </span>
      </Button>
    </NotificationsPopover>
  );
}
