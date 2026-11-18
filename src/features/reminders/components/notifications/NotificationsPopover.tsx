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
import { AdvisorNotificationRow, ReminderNotificationRow } from "./ReminderNotificationRows";
import {
  BroadcastNotificationRow,
  OnboardingNotificationRow,
  SupportReplyRow,
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
    !data.showOnboarding &&
    data.advisorAlerts.length === 0 &&
    data.unreadSupportTickets.length === 0 &&
    data.unreadBroadcasts.length === 0;

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
            <span className="font-semibold text-sm text-foreground">Lembretes &amp; Avisos</span>
            {data.effectiveTotalCount > 0 ? (
              <Badge variant={data.hasUrgent ? "critical" : "muted"} size="xs">
                {data.effectiveTotalCount}
              </Badge>
            ) : null}
          </div>
          {data.items.length > 0 ? (
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

        <div className="max-h-[22rem] overflow-y-auto divide-y divide-border/50 p-1">
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
              {data.unreadBroadcasts.map((b) => (
                <BroadcastNotificationRow
                  key={b.id}
                  broadcast={b}
                  onOpen={() => data.handleOpenBroadcast(b.id, b.action_url)}
                />
              ))}

              {data.unreadSupportTickets.map((st) => (
                <SupportReplyRow key={st.id} ticket={st} onOpen={data.handleOpenSupport} />
              ))}

              {data.showOnboarding ? (
                <OnboardingNotificationRow
                  done={data.onboardingProg.done}
                  total={data.onboardingProg.total}
                  onOpen={data.handleOpenOnboarding}
                  onDismiss={data.dismissOnboarding}
                />
              ) : null}

              {data.advisorAlerts.map((advisorItem) => (
                <AdvisorNotificationRow
                  key={advisorItem.id}
                  advisorItem={advisorItem}
                  onOpen={() => data.handleOpenAdvisorAlert(advisorItem)}
                  onDismiss={() => data.dismissAdvisor(advisorItem.themeKey, 30)}
                />
              ))}

              {data.items.slice(0, 6).map((item) => (
                <ReminderNotificationRow
                  key={item.key}
                  item={item}
                  onOpen={() => data.handleOpenItem(item)}
                  onMarkRead={() => data.handleMarkRead(item.key)}
                />
              ))}
            </>
          )}
        </div>

        <footer className="border-t border-border/80 p-2 bg-surface-raised/50 flex items-center justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full h-8 max-sm:min-h-11 text-xs font-medium text-primary-strong hover:text-primary-strong hover:bg-primary/10"
            onClick={data.handleViewAll}
          >
            Ver todos os lembretes e avisos
            <ExternalLink className="size-3 ml-1.5" aria-hidden="true" />
          </Button>
        </footer>
      </PopoverContent>
    </Popover>
  );
}
