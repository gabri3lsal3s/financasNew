import type { ReactNode } from "react";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
} from "@/components/ui";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import {
  AdvisorNotificationRow,
  ReminderNotificationRow,
} from "./ReminderNotificationRows";
import {
  BroadcastNotificationRow,
  BudgetOverrunNotificationRow,
  ClosedBillNotificationRow,
  DividendNotificationRow,
  OnboardingNotificationRow,
  SplitSignalNotificationRow,
  SubscriptionPastDueRow,
  SupportReplyRow,
  TripFamilyNotificationRow,
} from "./SystemNotificationRows";
import { useNotificationsPopoverData } from "./use-notifications-popover-data";

export interface NotificationsPopoverProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  advisorAlerts?: SmartAdvisorInsight[];
  onDismissAdvisor?: (themeKey: string, days?: number) => void;
}

export function NotificationsPopover({
  children,
  open,
  onOpenChange,
  advisorAlerts: propAdvisorAlerts,
  onDismissAdvisor: propOnDismissAdvisor,
}: NotificationsPopoverProps) {
  const data = useNotificationsPopoverData({
    onOpenChange,
    propAdvisorAlerts,
    propOnDismissAdvisor,
  });

  const isEmpty =
    data.items.length === 0 &&
    data.closedBillAlerts.length === 0 &&
    !data.budgetOverrunAlert &&
    data.tripAndFamilyAlerts.length === 0 &&
    data.dividendAlerts.length === 0 &&
    !data.showOnboarding &&
    data.advisorAlerts.length === 0 &&
    data.unreadSupportTickets.length === 0 &&
    data.unreadBroadcasts.length === 0 &&
    data.pendingSplitSignals.length === 0 &&
    !data.hasPastDueSubscription;

  const displayedItems = data.items.slice(0, 6);
  const remainingRemindersCount = Math.max(0, data.items.length - 6);
  const canMarkAllRead =
    data.items.length > 0 ||
    data.closedBillAlerts.length > 0 ||
    Boolean(data.budgetOverrunAlert) ||
    data.tripAndFamilyAlerts.length > 0 ||
    data.dividendAlerts.length > 0 ||
    data.unreadBroadcasts.length > 0;

  // Ordenação unificada por severidade (P0 Críticos -> P1 Ação necessária -> P2/P3 Informativos)
  const overdueItems = displayedItems.filter(
    (item) => item.direction !== "receivable" && item.status === "overdue",
  );
  const actionPayableItems = displayedItems.filter(
    (item) => item.direction !== "receivable" && item.status !== "overdue",
  );
  const receivableItems = displayedItems.filter(
    (item) => item.direction === "receivable",
  );

  const criticalBroadcasts = data.unreadBroadcasts.filter((b) => b.type === "critical");
  const warningBroadcasts = data.unreadBroadcasts.filter((b) => b.type === "warning");
  const advisoryBroadcasts = data.unreadBroadcasts.filter(
    (b) => b.type !== "critical" && b.type !== "warning",
  );

  const p0AdvisorAlerts = data.advisorAlerts.filter(
    (i) =>
      i.priority === 1 &&
      i.category === "critical" &&
      !i.id.startsWith("household:ceiling_exceeded") &&
      !i.id.startsWith("dup:"),
  );
  const p1AdvisorAlerts = data.advisorAlerts.filter(
    (i) =>
      !p0AdvisorAlerts.includes(i) &&
      (i.priority === 1 || (i.priority === 2 && i.category === "critical")),
  );
  const p2AdvisorAlerts = data.advisorAlerts.filter(
    (i) => !p0AdvisorAlerts.includes(i) && !p1AdvisorAlerts.includes(i),
  );

  const activeTrips = data.tripAndFamilyAlerts.filter(
    (a) => a.kind === "trip_settlement" && a.settlementPending !== false,
  );
  const advisoryTripsAndFamily = data.tripAndFamilyAlerts.filter(
    (a) => !activeTrips.includes(a),
  );
  const pendingDividendAlerts = data.dividendAlerts.filter(
    (a) => a.kind === "pending_confirmation",
  );
  const advisoryDividendAlerts = data.dividendAlerts.filter(
    (a) => a.kind !== "pending_confirmation",
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={{ top: 8, left: 8, right: 8, bottom: 80 }}
        className="w-[calc(100vw-1.5rem)] max-w-80 sm:w-96 sm:max-w-96 p-0 shadow-2xl rounded-2xl overflow-hidden border-border/80 bg-surface/95 backdrop-blur-md"
      >
        <header className="flex items-center justify-between gap-2 border-b border-border/80 px-4 py-3 bg-surface-raised/50">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm text-foreground">
              Lembretes &amp; Avisos
            </span>
            {data.effectiveTotalCount > 0 ? (
              <Badge
                variant={
                  data.hasUrgent ? "critical" : data.hasActionNeeded ? "warning" : "muted"
                }
                size="xs"
              >
                {data.effectiveTotalCount}
              </Badge>
            ) : null}
          </div>
          {canMarkAllRead ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              sensoryIntent="success"
              className="h-8 px-2 max-sm:min-h-11 text-xs text-muted-foreground hover:text-foreground shrink-0"
              onClick={data.handleMarkAllRead}
              disabled={data.markAllPending}
              aria-label="Marcar todas como lidas"
            >
              <CheckCheck className="size-3.5 mr-1" aria-hidden="true" />
              Marcar lidas
            </Button>
          ) : null}
        </header>

        <div className="max-h-[22rem] overflow-y-auto space-y-1 p-1.5">
          {data.isLoading ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : isEmpty ? (
            <div className="py-2 px-4">
              <EmptyState
                icon={<Bell className="size-5" aria-hidden="true" />}
                title="Tudo em dia"
                description="Nenhuma fatura ou pendência no momento."
                tone="default"
                className="py-6 border-0 bg-transparent"
              />
            </div>
          ) : (
            <>
              {/* P0: Críticos reais */}
              {data.hasPastDueSubscription ? (
                <SubscriptionPastDueRow
                  onOpen={data.handleOpenSubscriptionPastDue}
                />
              ) : null}

              {criticalBroadcasts.map((b) => (
                <BroadcastNotificationRow
                  key={b.id}
                  broadcast={b}
                  onOpen={() => data.handleOpenBroadcast(b.id, b.action_url)}
                  onMarkRead={() => data.handleMarkBroadcastRead(b.id)}
                  onDismiss={() => data.handleDismissBroadcast(b.id)}
                />
              ))}

              {overdueItems.map((item) => (
                <ReminderNotificationRow
                  key={item.key}
                  item={item}
                  onOpen={() => data.handleOpenItem(item)}
                  onMarkRead={() => data.handleMarkRead(item.key)}
                />
              ))}

              {p0AdvisorAlerts.map((advisorItem) => (
                <AdvisorNotificationRow
                  key={advisorItem.id}
                  advisorItem={advisorItem}
                  onOpen={() => data.handleOpenAdvisorAlert(advisorItem)}
                  onDismiss={() =>
                    data.dismissAdvisor(advisorItem.themeKey, 30)
                  }
                />
              ))}

              {/* P1: Ação necessária */}
              {actionPayableItems.map((item) => (
                <ReminderNotificationRow
                  key={item.key}
                  item={item}
                  onOpen={() => data.handleOpenItem(item)}
                  onMarkRead={() => data.handleMarkRead(item.key)}
                />
              ))}

              {data.pendingSplitSignals.map((group) => (
                <SplitSignalNotificationRow
                  key={group.shareId}
                  signalGroup={group}
                  onOpen={data.handleOpenSplitSignal}
                />
              ))}

              {data.unreadSupportTickets.map((st) => (
                <SupportReplyRow
                  key={st.id}
                  ticket={st}
                  onOpen={data.handleOpenSupport}
                />
              ))}

              {warningBroadcasts.map((b) => (
                <BroadcastNotificationRow
                  key={b.id}
                  broadcast={b}
                  onOpen={() => data.handleOpenBroadcast(b.id, b.action_url)}
                  onMarkRead={() => data.handleMarkBroadcastRead(b.id)}
                  onDismiss={() => data.handleDismissBroadcast(b.id)}
                />
              ))}

              {data.budgetOverrunAlert ? (
                <BudgetOverrunNotificationRow
                  alert={data.budgetOverrunAlert}
                  onOpen={() =>
                    data.handleOpenRoute(data.budgetOverrunAlert!.targetRoute)
                  }
                  onMarkRead={() =>
                    data.handleMarkRead(data.budgetOverrunAlert!.id)
                  }
                />
              ) : null}

              {activeTrips.map((alert) => (
                <TripFamilyNotificationRow
                  key={alert.id}
                  alert={alert}
                  onOpen={() => data.handleOpenRoute(alert.targetRoute)}
                  onMarkRead={() => data.handleMarkRead(alert.id)}
                />
              ))}

              {pendingDividendAlerts.map((alert) => (
                <DividendNotificationRow
                  key={alert.id}
                  alert={alert}
                  onOpen={() => data.handleOpenRoute(alert.targetRoute)}
                  onMarkRead={() => data.handleMarkRead(alert.id)}
                />
              ))}

              {p1AdvisorAlerts.map((advisorItem) => (
                <AdvisorNotificationRow
                  key={advisorItem.id}
                  advisorItem={advisorItem}
                  onOpen={() => data.handleOpenAdvisorAlert(advisorItem)}
                  onDismiss={() =>
                    data.dismissAdvisor(advisorItem.themeKey, 30)
                  }
                />
              ))}

              {/* P2/P3: Informativos e oportunidades */}
              {receivableItems.map((item) => (
                <ReminderNotificationRow
                  key={item.key}
                  item={item}
                  onOpen={() => data.handleOpenItem(item)}
                  onMarkRead={() => data.handleMarkRead(item.key)}
                />
              ))}

              {data.closedBillAlerts.map((alert) => (
                <ClosedBillNotificationRow
                  key={alert.key}
                  alert={alert}
                  onOpen={() => data.handleOpenRoute(alert.targetRoute)}
                  onMarkRead={() => data.handleMarkRead(alert.key)}
                />
              ))}

              {advisoryBroadcasts.map((b) => (
                <BroadcastNotificationRow
                  key={b.id}
                  broadcast={b}
                  onOpen={() => data.handleOpenBroadcast(b.id, b.action_url)}
                  onMarkRead={() => data.handleMarkBroadcastRead(b.id)}
                  onDismiss={() => data.handleDismissBroadcast(b.id)}
                />
              ))}

              {advisoryTripsAndFamily.map((alert) => (
                <TripFamilyNotificationRow
                  key={alert.id}
                  alert={alert}
                  onOpen={() => data.handleOpenRoute(alert.targetRoute)}
                  onMarkRead={() => data.handleMarkRead(alert.id)}
                />
              ))}

              {advisoryDividendAlerts.map((alert) => (
                <DividendNotificationRow
                  key={alert.id}
                  alert={alert}
                  onOpen={() => data.handleOpenRoute(alert.targetRoute)}
                  onMarkRead={() => data.handleMarkRead(alert.id)}
                />
              ))}

              {p2AdvisorAlerts.map((advisorItem) => (
                <AdvisorNotificationRow
                  key={advisorItem.id}
                  advisorItem={advisorItem}
                  onOpen={() => data.handleOpenAdvisorAlert(advisorItem)}
                  onDismiss={() =>
                    data.dismissAdvisor(advisorItem.themeKey, 30)
                  }
                />
              ))}

              {data.showOnboarding ? (
                <OnboardingNotificationRow
                  done={data.onboardingProg.done}
                  total={data.onboardingProg.total}
                  onOpen={data.handleOpenOnboarding}
                  onDismiss={data.dismissOnboarding}
                />
              ) : null}

              {remainingRemindersCount > 0 ? (
                <button
                  type="button"
                  onClick={data.handleViewAll}
                  className="w-full px-3 py-2 text-center text-[11px] font-medium text-primary-strong hover:bg-surface-hover transition-colors cursor-pointer rounded-lg"
                >
                  +{remainingRemindersCount}{" "}
                  {remainingRemindersCount === 1
                    ? "outro lembrete na Central"
                    : "outros lembretes na Central"}
                </button>
              ) : null}
            </>
          )}
        </div>

        <footer className="border-t border-border/80 p-2 bg-surface-raised/30">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            sensoryIntent="selection"
            className="w-full justify-center gap-1.5 text-xs font-medium text-primary-strong hover:text-primary-strong"
            onClick={data.handleViewAll}
          >
            Ver todos os lembretes
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Button>
        </footer>
      </PopoverContent>
    </Popover>
  );
}
