import { Bell } from "lucide-react";
import { HighlightRow, ReminderItem } from "@/components/modules";
import { Button, EmptyState, FilterChips } from "@/components/ui";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import type {
  BudgetOverrunAlert,
  ClosedCardBillAlert,
  DividendNotificationAlert,
  PendingSplitSignalSummary,
  TripFamilyAlert,
} from "@/domain/notifications/hub";
import type { ReminderItem as ReminderItemData } from "@/domain/reminders";
import type { SupportTicket, UserBroadcastNotification } from "@/types";
import type { RemindersSubFilter } from "../hooks/use-reminders-page-state";
import { AdvisorReminderCard } from "./AdvisorReminderCard";
import {
  BroadcastNotificationRow,
  BudgetOverrunNotificationRow,
  ClosedBillNotificationRow,
  DividendNotificationRow,
  SplitSignalNotificationRow,
  SubscriptionPastDueRow,
  SupportReplyRow,
  TripFamilyNotificationRow,
} from "./notifications/SystemNotificationRows";

export interface RemindersPendingTabProps {
  subFilter: RemindersSubFilter;
  onSubFilterChange: (next: RemindersSubFilter) => void;
  totalPendingEffective: number;
  overdueCount: number;
  billsCount: number;
  debtsCount: number;
  receivablesCount?: number;
  advisorCount: number;
  systemCount?: number;
  advisorAlerts: SmartAdvisorInsight[];
  closedBillAlerts?: ClosedCardBillAlert[];
  budgetOverrunAlert?: BudgetOverrunAlert | null;
  tripAndFamilyAlerts?: TripFamilyAlert[];
  dividendAlerts?: DividendNotificationAlert[];
  unreadBroadcasts?: UserBroadcastNotification[];
  unreadSupportTickets?: SupportTicket[];
  pendingSplitSignals?: PendingSplitSignalSummary[];
  hasPastDueSubscription?: boolean;
  filteredItems: ReminderItemData[];
  stateMap: Map<string, string>;
  highlightId: string | null;
  billDaysBefore: number;
  debtDaysBefore?: number;
  onOpenAdvisorAlert: (item: SmartAdvisorInsight) => void;
  onDismissAdvisor: (themeKey: string) => void;
  onOpenRoute?: (route: string) => void;
  onOpenBroadcast?: (b: UserBroadcastNotification) => void;
  onMarkBroadcastRead?: (id: string) => void;
  onDismissBroadcast?: (id: string) => void;
  onOpenSupport?: () => void;
  onOpenSplitSignal?: () => void;
  onOpenSubscriptionPastDue?: () => void;
  onMarkRead: (key: string) => void;
  onSnooze: (key: string) => void;
  onRestore: (key: string) => void;
  onSettle: (item: ReminderItemData) => void;
  onOpenReminder: (item: ReminderItemData) => void;
  onOpenSettings: () => void;
}

function getEmptyDescription(subFilter: RemindersSubFilter): string {
  if (subFilter === "overdue") return "Nenhuma fatura ou dívida atrasada.";
  if (subFilter === "bills") return "Nenhuma fatura pendente no momento.";
  if (subFilter === "debts") return "Nenhuma dívida pendente no momento.";
  if (subFilter === "receivables")
    return "Nenhum valor a receber pendente no momento.";
  if (subFilter === "advisor") return "Nenhum aviso inteligente no momento.";
  if (subFilter === "system")
    return "Nenhum comunicado ou sinalização de racha no momento.";
  return "Nenhuma pendência no momento. Todas as faturas, dívidas e avisos estão em dia.";
}

export function RemindersPendingTab({
  subFilter,
  onSubFilterChange,
  totalPendingEffective,
  overdueCount,
  billsCount,
  debtsCount,
  receivablesCount = 0,
  advisorCount,
  systemCount = 0,
  advisorAlerts,
  closedBillAlerts = [],
  budgetOverrunAlert = null,
  tripAndFamilyAlerts = [],
  dividendAlerts = [],
  unreadBroadcasts = [],
  unreadSupportTickets = [],
  pendingSplitSignals = [],
  hasPastDueSubscription = false,
  filteredItems,
  stateMap,
  highlightId,
  billDaysBefore,
  debtDaysBefore,
  onOpenAdvisorAlert,
  onDismissAdvisor,
  onOpenRoute,
  onOpenBroadcast,
  onMarkBroadcastRead,
  onDismissBroadcast,
  onOpenSupport,
  onOpenSplitSignal,
  onOpenSubscriptionPastDue,
  onMarkRead,
  onSnooze,
  onRestore,
  onSettle,
  onOpenReminder,
  onOpenSettings,
}: RemindersPendingTabProps) {
  const showSystem = subFilter === "all" || subFilter === "system";
  const showClosedBills = subFilter === "all" || subFilter === "bills";
  const showAdvisor = subFilter === "all" || subFilter === "advisor";
  const showReminders = subFilter !== "advisor" && subFilter !== "system";
  const visibleAdvisorAlerts = showAdvisor ? advisorAlerts : [];
  const visibleClosedBills = showClosedBills ? closedBillAlerts : [];
  const visibleReminders = showReminders ? filteredItems : [];
  const hasVisibleSystem = showSystem && systemCount > 0;
  const hasAnyVisibleItem =
    hasVisibleSystem ||
    visibleClosedBills.length > 0 ||
    visibleAdvisorAlerts.length > 0 ||
    visibleReminders.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {totalPendingEffective > 0 ? (
        <FilterChips
          items={[
            { key: "all", label: "Todas", count: totalPendingEffective },
            ...(overdueCount > 0
              ? [
                  {
                    key: "overdue",
                    label: "Atrasadas",
                    count: overdueCount,
                    tone: "critical" as const,
                  },
                ]
              : []),
            ...(billsCount > 0
              ? [{ key: "bills", label: "Faturas", count: billsCount }]
              : []),
            ...(debtsCount > 0
              ? [{ key: "debts", label: "Dívidas", count: debtsCount }]
              : []),
            ...(receivablesCount > 0
              ? [
                  {
                    key: "receivables",
                    label: "A receber",
                    count: receivablesCount,
                  },
                ]
              : []),
            ...(advisorCount > 0
              ? [
                  {
                    key: "advisor",
                    label: "Avisos & Renda",
                    count: advisorCount,
                  },
                ]
              : []),
            ...(systemCount > 0
              ? [
                  {
                    key: "system",
                    label: "Comunicados & Rachas",
                    count: systemCount,
                  },
                ]
              : []),
          ]}
          activeKey={subFilter}
          onChange={(key) => onSubFilterChange(key as RemindersSubFilter)}
          className="pt-0.5 flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar scroll-smooth"
          ariaLabel="Filtrar pendências por categoria"
        />
      ) : null}

      {!hasAnyVisibleItem ? (
        <EmptyState
          icon={<Bell className="size-6" aria-hidden="true" />}
          title="Tudo em dia"
          description={getEmptyDescription(subFilter)}
          tone="default"
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {hasVisibleSystem ? (
            <>
              {hasPastDueSubscription && onOpenSubscriptionPastDue ? (
                <SubscriptionPastDueRow onOpen={onOpenSubscriptionPastDue} />
              ) : null}
              {budgetOverrunAlert ? (
                <BudgetOverrunNotificationRow
                  alert={budgetOverrunAlert}
                  onOpen={() => onOpenRoute?.(budgetOverrunAlert.targetRoute)}
                  onMarkRead={() => onMarkRead(budgetOverrunAlert.id)}
                />
              ) : null}
              {tripAndFamilyAlerts.map((alert) => (
                <TripFamilyNotificationRow
                  key={alert.id}
                  alert={alert}
                  onOpen={() => onOpenRoute?.(alert.targetRoute)}
                  onMarkRead={() => onMarkRead(alert.id)}
                />
              ))}
              {dividendAlerts.map((alert) => (
                <DividendNotificationRow
                  key={alert.id}
                  alert={alert}
                  onOpen={() => onOpenRoute?.(alert.targetRoute)}
                  onMarkRead={() => onMarkRead(alert.id)}
                />
              ))}
              {unreadBroadcasts.map((broadcast) => (
                <BroadcastNotificationRow
                  key={broadcast.id}
                  broadcast={broadcast}
                  onOpen={() => onOpenBroadcast?.(broadcast)}
                  onMarkRead={
                    onMarkBroadcastRead
                      ? () => onMarkBroadcastRead(broadcast.id)
                      : undefined
                  }
                  onDismiss={
                    onDismissBroadcast
                      ? () => onDismissBroadcast(broadcast.id)
                      : undefined
                  }
                />
              ))}
              {unreadSupportTickets.map((ticket) => (
                <SupportReplyRow
                  key={ticket.id}
                  ticket={ticket}
                  onOpen={() => onOpenSupport?.()}
                />
              ))}
              {pendingSplitSignals.map((group) => (
                <SplitSignalNotificationRow
                  key={group.shareId}
                  signalGroup={group}
                  onOpen={() => onOpenSplitSignal?.()}
                />
              ))}
            </>
          ) : null}

          {visibleClosedBills.map((closedAlert) => (
            <ClosedBillNotificationRow
              key={closedAlert.key}
              alert={closedAlert}
              onOpen={() => onOpenRoute?.(closedAlert.targetRoute)}
              onMarkRead={() => onMarkRead(closedAlert.key)}
            />
          ))}

          {visibleAdvisorAlerts.map((advisorItem) => (
            <AdvisorReminderCard
              key={advisorItem.id}
              advisorItem={advisorItem}
              onOpen={onOpenAdvisorAlert}
              onDismiss={onDismissAdvisor}
            />
          ))}

          {visibleReminders.map((item, idx) => {
            const isMatch =
              highlightId &&
              (highlightId === item.key ||
                highlightId === item.link?.params?.q ||
                highlightId === item.link?.params?.debt);
            return (
              <div
                key={item.key}
                data-tour={idx === 0 ? "reminders-settle-card" : undefined}
              >
                <HighlightRow
                  highlightId={highlightId}
                  id={isMatch ? highlightId : item.key}
                  className="rounded-2xl"
                >
                  <ReminderItem
                    item={item}
                    stateKind={
                      (stateMap.get(item.key) as
                        | "read"
                        | "snoozed"
                        | undefined) ?? null
                    }
                    onMarkRead={onMarkRead}
                    onSnooze={onSnooze}
                    onRestore={onRestore}
                    onSettle={onSettle}
                    onOpen={() => onOpenReminder(item)}
                  />
                </HighlightRow>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border/80 bg-surface-raised/60 px-3.5 py-2.5 text-xs text-muted-foreground mt-2">
        <span>
          Monitorando faturas e dívidas com vencimento nos próximos{" "}
          <strong className="text-foreground font-semibold">
            {billDaysBefore} dias
          </strong>
          {debtDaysBefore !== undefined && debtDaysBefore !== billDaysBefore ? (
            <>
              {" "}
              (faturas) e{" "}
              <strong className="text-foreground font-semibold">
                {debtDaysBefore} dias
              </strong>{" "}
              (dívidas)
            </>
          ) : null}
          .
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          sensoryIntent="selection"
          className="h-8 max-sm:min-h-11 px-2 text-xs text-primary-strong hover:text-primary-strong self-start sm:self-auto"
          onClick={onOpenSettings}
        >
          Ajustar antecedência
        </Button>
      </div>
    </div>
  );
}
