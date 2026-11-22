import { useNavigate } from "react-router";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import { coreOnboardingSteps } from "@/domain/onboarding";
import type { ReminderItem } from "@/domain/reminders";
import {
  getOptionalHook,
  useNotificationCenter,
} from "@/hooks/use-notification-center";
import * as state from "@/state";
import { navigateAdvisorAlert } from "../../utils/navigate-advisor-alert";

function openActionUrlSafely(
  rawUrl: string,
  navigate: ReturnType<typeof useNavigate>,
  onClose?: () => void,
) {
  const url = rawUrl.trim();
  if (!url) return;
  if (url.startsWith("/") && !url.startsWith("//")) {
    onClose?.();
    navigate(url);
    return;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") {
      onClose?.();
      window.open(parsed.toString(), "_blank", "noopener,noreferrer");
    }
  } catch {
    // URL inválida ignorada por segurança
  }
}

export function useNotificationsPopoverData({
  onOpenChange,
  propAdvisorAlerts,
  propOnDismissAdvisor,
}: {
  onOpenChange?: (open: boolean) => void;
  propAdvisorAlerts?: SmartAdvisorInsight[];
  propOnDismissAdvisor?: (themeKey: string, days?: number) => void;
}) {
  const navigate = useNavigate();
  const center = useNotificationCenter();

  const useSetReminderStateSafe = getOptionalHook<{
    mutate: (args: {
      occurrenceKey: string;
      state: { kind: "read" | "snoozed"; snoozeUntil?: string } | null;
    }) => void;
    isPending: boolean;
  }>(state, "useSetReminderState", () => ({
    mutate: () => {},
    isPending: false,
  }));
  const useMarkAllRemindersAsReadSafe = getOptionalHook<{
    mutate: (keys: string[]) => void;
    isPending: boolean;
  }>(state, "useMarkAllRemindersAsRead", () => ({
    mutate: () => {},
    isPending: false,
  }));
  const useMarkBroadcastAsReadSafe = getOptionalHook<{
    mutate: (id: string) => void;
    isPending: boolean;
  }>(state, "useMarkBroadcastAsRead", () => ({
    mutate: () => {},
    isPending: false,
  }));
  const useDismissBroadcastNotificationSafe = getOptionalHook(
    state,
    "useDismissBroadcastNotification",
    () => null as { mutate: (id: string) => void } | null,
  );

  const setReminderStateMutation = useSetReminderStateSafe();
  const markAllMutation = useMarkAllRemindersAsReadSafe();
  const markBroadcastMutation = useMarkBroadcastAsReadSafe();
  const dismissBroadcastMutation = useDismissBroadcastNotificationSafe();

  const {
    items,
    closedBillAlerts,
    budgetOverrunAlert,
    tripAndFamilyAlerts,
    criticalCount,
    actionNeededCount,
    isLoading,
    unreadBroadcasts,
    unreadSupportTickets,
    pendingSplitSignals,
    hasPastDueSubscription,
    showOnboarding,
    onboardingData,
    onboardingProg,
    hasFeature,
    dismissOnboarding,
    advisorAlerts: centerAdvisorAlerts,
    dismissAdvisor: centerDismissAdvisor,
  } = center;

  const advisorAlerts = propAdvisorAlerts ?? centerAdvisorAlerts;
  const dismissAdvisor = propOnDismissAdvisor ?? centerDismissAdvisor;

  const effectiveTotalCount = propAdvisorAlerts
    ? center.totalBellCount +
      Math.max(0, propAdvisorAlerts.length - centerAdvisorAlerts.length)
    : center.totalBellCount;

  const hasUrgent =
    criticalCount > 0 ||
    propAdvisorAlerts?.some((i) => i.priority === 1 && i.category === "critical") ||
    false;
  const hasActionNeeded = !hasUrgent && actionNeededCount > 0;

  const handleOpenItem = (item: ReminderItem) => {
    onOpenChange?.(false);
    if (!item.link) {
      navigate("/lembretes");
      return;
    }
    const params = new URLSearchParams(item.link.params ?? {});
    navigate(`${item.link.path}?${params.toString()}`);
  };

  const handleOpenAdvisorAlert = (item: SmartAdvisorInsight) => {
    onOpenChange?.(false);
    navigateAdvisorAlert(item, navigate);
  };

  const handleOpenOnboarding = () => {
    onOpenChange?.(false);
    if (!onboardingData) return;

    const pending = coreOnboardingSteps(onboardingData, hasFeature).filter(
      (s) => !s.done,
    );
    const nextStep = pending[0];

    if (nextStep) {
      switch (nextStep.id) {
        case "cash-checkpoint":
          navigate("/configuracoes");
          return;
        case "card":
          navigate("/cartoes");
          return;
        case "first-transaction":
          navigate("/transacoes?novo=transacao");
          return;
        case "portfolio-asset":
          navigate("/investments?novo=ativo");
          return;
        case "portfolio-transaction":
          navigate("/investments?novo=investimento");
          return;
        case "bank-notifications":
          navigate("/configuracoes?tab=notifications");
          return;
      }
    }

    if (hasFeature("investments") && !hasFeature("transactions")) {
      navigate("/investments");
    } else {
      navigate("/transacoes?novo=transacao");
    }
  };

  const handleOpenBroadcast = (
    id: string,
    actionUrl: string | null | undefined,
  ) => {
    if (!actionUrl) return;
    markBroadcastMutation.mutate(id);
    openActionUrlSafely(actionUrl, navigate, () => onOpenChange?.(false));
  };

  const handleMarkBroadcastRead = (id: string) => {
    markBroadcastMutation.mutate(id);
  };

  const handleDismissBroadcast = (id: string) => {
    if (dismissBroadcastMutation) {
      dismissBroadcastMutation.mutate(id);
    } else {
      markBroadcastMutation.mutate(id);
    }
  };

  const handleOpenSupport = () => {
    onOpenChange?.(false);
    navigate("/configuracoes?tab=support");
  };

  const handleOpenSplitSignal = () => {
    onOpenChange?.(false);
    navigate("/dividas");
  };

  const handleOpenSubscriptionPastDue = () => {
    onOpenChange?.(false);
    navigate("/configuracoes?tab=subscription");
  };

  const handleOpenRoute = (route: string) => {
    onOpenChange?.(false);
    navigate(route);
  };

  const handleMarkRead = (key: string) => {
    setReminderStateMutation.mutate({
      occurrenceKey: key,
      state: { kind: "read" },
    });
  };

  const handleMarkAllRead = () => {
    const keys = items.map((i) => i.key);
    keys.push(...closedBillAlerts.map((a) => a.key));
    if (budgetOverrunAlert) keys.push(budgetOverrunAlert.id);
    keys.push(...tripAndFamilyAlerts.map((a) => a.id));
    if (keys.length > 0) markAllMutation.mutate(keys);
    for (const b of unreadBroadcasts) {
      markBroadcastMutation.mutate(b.id);
    }
  };

  const handleViewAll = () => {
    onOpenChange?.(false);
    navigate("/lembretes");
  };

  return {
    items,
    closedBillAlerts,
    budgetOverrunAlert,
    tripAndFamilyAlerts,
    unreadBroadcasts,
    unreadSupportTickets,
    pendingSplitSignals,
    hasPastDueSubscription,
    showOnboarding,
    onboardingProg,
    advisorAlerts,
    dismissAdvisor,
    dismissOnboarding,
    effectiveTotalCount,
    hasUrgent,
    hasActionNeeded,
    isLoading,
    markAllPending: markAllMutation.isPending,
    handleOpenItem,
    handleOpenAdvisorAlert,
    handleOpenOnboarding,
    handleOpenBroadcast,
    handleMarkBroadcastRead,
    handleDismissBroadcast,
    handleOpenSupport,
    handleOpenSplitSignal,
    handleOpenSubscriptionPastDue,
    handleOpenRoute,
    handleMarkRead,
    handleMarkAllRead,
    handleViewAll,
  };
}
