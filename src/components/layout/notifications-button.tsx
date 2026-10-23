import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsPopover } from "@/components/modules/notifications-popover";
import { useOnboardingCounts, useReminders } from "@/state";
import { useOnboardingDismissed } from "@/hooks";
import { shouldShowOnboardingBanner } from "@/domain/onboarding";
import { useSmartAdvisorInsights } from "@/features/overview/hooks";
import { cn } from "@/lib/utils";

/**
 * Botão de notificações no header com indicador de contagem e popover rápido.
 * Renderiza null quando não há pendências — aparece apenas quando há notificações.
 */
export function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const { totalCount, overdueCount, dueTodayCount } = useReminders();
  const onboardingQuery = useOnboardingCounts();
  const { isDismissed } = useOnboardingDismissed();
  const advisor = useSmartAdvisorInsights();

  const showOnboarding =
    !isDismissed && onboardingQuery?.data ? shouldShowOnboardingBanner(onboardingQuery.data) : false;

  const advisorAlerts = advisor.insights.filter((i) => i.priority === 1 || i.priority === 2);
  const hasAdvisorCritical = advisorAlerts.some((i) => i.priority === 1);
  const hasAdvisorDueToday = advisorAlerts.some((i) => i.priority === 2);

  const effectiveTotalCount = totalCount + (showOnboarding ? 1 : 0) + advisorAlerts.length;

  if (effectiveTotalCount === 0) return null;

  const isUrgent = overdueCount > 0 || hasAdvisorCritical;
  const isDueToday = !isUrgent && (dueTodayCount > 0 || hasAdvisorDueToday);

  const displayCount = effectiveTotalCount > 9 ? "9+" : String(effectiveTotalCount);

  return (
    <NotificationsPopover
      open={open}
      onOpenChange={setOpen}
      advisorAlerts={advisorAlerts}
      onDismissAdvisor={advisor.dismiss}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Notificações: ${effectiveTotalCount} pendências`}
        title="Lembretes e Avisos"
        className="relative overflow-visible"
      >
        <Bell aria-hidden="true" />
        <span
          className={cn(
            "absolute -top-1 -right-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ring-2 ring-surface pointer-events-none transition-transform animate-in zoom-in-50",
            isUrgent
              ? "bg-critical text-white shadow-xs"
              : isDueToday
                ? "bg-warning-strong text-white shadow-xs"
                : "bg-primary text-primary-foreground",
          )}
        >
          {displayCount}
        </span>
      </Button>
    </NotificationsPopover>
  );
}

