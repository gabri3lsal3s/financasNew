import { useNavigate } from "react-router";
import { coreOnboardingProgress, coreOnboardingSteps, shouldShowOnboardingBanner } from "@/domain/onboarding";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import type { ReminderItem } from "@/domain/reminders";
import { useSmartAdvisorInsights } from "@/features/overview/hooks";
import { useOnboardingDismissed } from "@/hooks";
import {
  useMarkAllRemindersAsRead,
  useMarkBroadcastAsRead,
  useMyBroadcastNotifications,
  useMySupportTickets,
  useOnboardingCounts,
  useReminders,
  useSetReminderState,
  useUserAccess,
} from "@/state";
import { navigateAdvisorAlert } from "../../utils/navigate-advisor-alert";

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
  const { hasFeature } = useUserAccess();
  const { items, totalCount, urgentCount, isLoading } = useReminders();
  const onboardingQuery = useOnboardingCounts();
  const { isDismissed, dismiss } = useOnboardingDismissed();
  const setReminderStateMutation = useSetReminderState();
  const markAllMutation = useMarkAllRemindersAsRead();
  const myTicketsQuery = useMySupportTickets();
  const broadcastsQuery = useMyBroadcastNotifications();
  const markBroadcastMutation = useMarkBroadcastAsRead();

  const unreadBroadcasts = (broadcastsQuery.data ?? []).filter((b) => !b.is_read);
  const unreadSupportTickets = (myTicketsQuery.data ?? []).filter(
    (t) => Boolean(t.admin_reply) && !t.user_read_at,
  );

  const advisorHook = useSmartAdvisorInsights({ enabled: propAdvisorAlerts === undefined });
  const advisorAlerts =
    propAdvisorAlerts ?? advisorHook.insights.filter((i) => i.priority === 1 || i.priority === 2);
  const dismissAdvisor = propOnDismissAdvisor ?? advisorHook.dismiss;

  const showOnboarding =
    !isDismissed && onboardingQuery?.data
      ? shouldShowOnboardingBanner(onboardingQuery.data, hasFeature)
      : false;
  const onboardingProg = onboardingQuery?.data
    ? coreOnboardingProgress(onboardingQuery.data, hasFeature)
    : { done: 0, total: 0 };

  const effectiveTotalCount =
    totalCount +
    (showOnboarding ? 1 : 0) +
    advisorAlerts.length +
    unreadSupportTickets.length +
    unreadBroadcasts.length;
  const hasUrgent = urgentCount > 0 || advisorAlerts.some((i) => i.priority === 1);

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
    if (!onboardingQuery.data) return;

    const pending = coreOnboardingSteps(onboardingQuery.data, hasFeature).filter((s) => !s.done);
    const nextStep = pending[0];

    if (nextStep) {
      switch (nextStep.id) {
        case "expense-category":
        case "income-category":
          navigate("/orcamentos?tab=categories&novo=categoria");
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
      }
    }

    if (hasFeature("investments") && !hasFeature("transactions")) {
      navigate("/investments");
    } else {
      navigate("/transacoes?novo=transacao");
    }
  };

  const handleOpenBroadcast = (id: string, actionUrl: string | null | undefined) => {
    markBroadcastMutation.mutate(id);
    onOpenChange?.(false);
    if (actionUrl) navigate(actionUrl);
  };

  const handleOpenSupport = () => {
    onOpenChange?.(false);
    navigate("/configuracoes?tab=support");
  };

  const handleMarkRead = (key: string) => {
    setReminderStateMutation.mutate({ occurrenceKey: key, state: { kind: "read" } });
  };

  const handleMarkAllRead = () => {
    const keys = items.map((i) => i.key);
    if (keys.length > 0) markAllMutation.mutate(keys);
  };

  const handleViewAll = () => {
    onOpenChange?.(false);
    navigate("/lembretes");
  };

  return {
    items,
    isLoading,
    unreadBroadcasts,
    unreadSupportTickets,
    advisorAlerts,
    showOnboarding,
    onboardingProg,
    effectiveTotalCount,
    hasUrgent,
    markAllPending: markAllMutation.isPending,
    dismissOnboarding: dismiss,
    dismissAdvisor,
    handleOpenItem,
    handleOpenAdvisorAlert,
    handleOpenOnboarding,
    handleOpenBroadcast,
    handleOpenSupport,
    handleMarkRead,
    handleMarkAllRead,
    handleViewAll,
  };
}
