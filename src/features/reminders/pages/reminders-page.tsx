import { Bell, CheckCheck, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { ReadOnlyBanner } from "@/components/modules";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  Tabs,
} from "@/components/ui";
import { PaymentDialog } from "@/features/cards/components/payment-dialog";
import { SettleDialog } from "@/features/debts/components/settle-dialog";
import { getErrorMessage } from "@/services/errors";
import { RemindersPendingTab } from "../components/RemindersPendingTab";
import { RemindersReadTab } from "../components/RemindersReadTab";
import { RemindersSettingsModal } from "../components/reminders-settings-modal";
import {
  useRemindersPageState,
  type RemindersMainTab,
} from "../hooks/use-reminders-page-state";
import { navigateAdvisorAlert } from "../utils/navigate-advisor-alert";

/**
 * Central de Lembretes & Avisos (§3.10) — consolida faturas, dívidas pendentes,
 * recebíveis, comunicados, suporte, sinais de racha e avisos inteligentes (Smart Advisor).
 */
export function RemindersPage() {
  const s = useRemindersPageState();

  return (
    <div className="flex flex-col gap-5 sm:gap-6 min-w-0">
      <PageHeader
        title="Lembretes e Avisos"
        description="Faturas, compromissos e avisos inteligentes que precisam da sua atenção"
        badge={
          s.totalPendingEffective > 0 ? (
            <Badge
              variant={
                s.hasUrgentPending
                  ? "critical"
                  : s.hasActionNeededPending
                    ? "warning"
                    : "default"
              }
              size="sm"
            >
              {s.totalPendingEffective}{" "}
              {s.totalPendingEffective === 1 ? "pendência" : "pendências"}
            </Badge>
          ) : undefined
        }
        actions={
          <>
            {s.unreadFilteredItems.length > 0 ||
            s.closedBillAlerts.length > 0 ||
            Boolean(s.budgetOverrunAlert) ||
            s.tripAndFamilyAlerts.length > 0 ||
            s.unreadBroadcasts.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                sensoryIntent="success"
                onClick={s.handleMarkAllRead}
                disabled={s.markAllPending}
                aria-label="Marcar todas como lidas"
                className="max-sm:min-h-11"
              >
                <CheckCheck
                  className="size-4 mr-1.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="sm:hidden">Marcar lidas</span>
                <span className="hidden sm:inline">
                  Marcar todas como lidas
                </span>
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="sm"
              sensoryIntent="selection"
              onClick={() => s.setIsSettingsOpen(true)}
              title="Configurar Lembretes e Antecedência"
              className="max-sm:min-h-11"
            >
              <SlidersHorizontal
                className="size-4 mr-1.5 text-muted-foreground"
                aria-hidden="true"
              />
              Ajustes
            </Button>
          </>
        }
      />

      {s.permission.isReadOnlyMode ? <ReadOnlyBanner /> : null}
      {s.error ? (
        <ErrorState message={getErrorMessage(s.error)} onRetry={s.handleRetry} />
      ) : null}

      {s.isLoading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border/80 bg-surface shadow-xs"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-xl shrink-0" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-36 sm:w-48" />
                  <Skeleton className="h-3 w-28 sm:w-36" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : !s.preferences.enabled && s.systemCount === 0 && s.advisorCount === 0 ? (
        <EmptyState
          icon={<Bell className="size-6" aria-hidden="true" />}
          title="Lembretes desativados"
          description="Você desativou os lembretes automáticos nas configurações."
          tone="default"
          action={
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => s.setIsSettingsOpen(true)}
              className="max-sm:min-h-11"
            >
              Ativar lembretes
            </Button>
          }
        />
      ) : (
        <Tabs
          value={s.mainTab}
          onValueChange={(val) => {
            s.setMainTabOverride(val as RemindersMainTab);
            s.setSubFilter("all");
          }}
          variant="underline"
          swipeable
          className="w-full"
          items={[
            {
              value: "pending",
              label:
                s.totalPendingEffective > 0
                  ? `Pendentes (${s.totalPendingEffective})`
                  : "Pendentes",
              icon: <Bell className="size-4" aria-hidden="true" />,
              content: (
                <RemindersPendingTab
                  subFilter={s.subFilter}
                  onSubFilterChange={s.setSubFilter}
                  totalPendingEffective={s.totalPendingEffective}
                  overdueCount={s.overdueCount}
                  billsCount={s.billsCount}
                  debtsCount={s.debtsCount}
                  receivablesCount={s.receivablesCount}
                  advisorCount={s.advisorCount}
                  systemCount={s.systemCount}
                  advisorAlerts={s.advisorAlerts}
                  closedBillAlerts={s.closedBillAlerts}
                  budgetOverrunAlert={s.budgetOverrunAlert}
                  tripAndFamilyAlerts={s.tripAndFamilyAlerts}
                  unreadBroadcasts={s.unreadBroadcasts}
                  unreadSupportTickets={s.unreadSupportTickets}
                  pendingSplitSignals={s.pendingSplitSignals}
                  hasPastDueSubscription={s.hasPastDueSubscription}
                  filteredItems={s.filteredItems}
                  stateMap={s.stateMap}
                  highlightId={s.highlightId}
                  billDaysBefore={s.preferences.billDaysBefore}
                  debtDaysBefore={s.preferences.debtDaysBefore}
                  onOpenAdvisorAlert={(item) =>
                    navigateAdvisorAlert(item, s.navigate)
                  }
                  onDismissAdvisor={(themeKey) =>
                    s.dismissAdvisor(themeKey, 30)
                  }
                  onOpenRoute={(route) => s.navigate(route)}
                  onOpenBroadcast={s.handleOpenBroadcast}
                  onMarkBroadcastRead={s.handleMarkBroadcastRead}
                  onDismissBroadcast={s.handleDismissBroadcast}
                  onOpenSupport={s.handleOpenSupport}
                  onOpenSplitSignal={s.handleOpenSplitSignal}
                  onOpenSubscriptionPastDue={s.handleOpenSubscriptionPastDue}
                  onMarkRead={(key) =>
                    s.handleStateUpdate(key, { kind: "read" })
                  }
                  onSnooze={s.snooze}
                  onRestore={(key) => s.handleStateUpdate(key, null)}
                  onSettle={s.handleSettle}
                  onOpenReminder={s.openReminder}
                  onOpenSettings={() => s.setIsSettingsOpen(true)}
                />
              ),
            },
            {
              value: "read",
              label:
                s.readHistoryItems.length > 0
                  ? `Lidas (${s.readHistoryItems.length})`
                  : "Lidas",
              icon: <CheckCheck className="size-4" aria-hidden="true" />,
              content: (
                <RemindersReadTab
                  items={s.readHistoryItems}
                  highlightId={s.highlightId}
                  onMarkRead={(key) =>
                    s.handleStateUpdate(key, { kind: "read" })
                  }
                  onSnooze={s.snooze}
                  onRestore={(key) => s.handleStateUpdate(key, null)}
                  onOpenReminder={s.openReminder}
                />
              ),
            },
          ]}
        />
      )}

      <RemindersSettingsModal
        open={s.isSettingsOpen}
        onOpenChange={s.setIsSettingsOpen}
      />

      {s.settleDebt ? (
        <SettleDialog
          open={Boolean(s.settleDebt)}
          debt={s.settleDebt}
          onOpenChange={(next) => {
            if (!next) s.setSettleDebt(null);
          }}
        />
      ) : null}

      {s.billPayment ? (
        <PaymentDialog
          open={Boolean(s.billPayment)}
          cardId={s.billPayment.cardId}
          competenceMonth={s.billPayment.competenceMonth}
          mode="payment"
          openBalanceCents={s.billPayment.openBalanceCents}
          onOpenChange={(next) => {
            if (!next) s.setBillPayment(null);
          }}
        />
      ) : null}

      {s.upgradeModal}
    </div>
  );
}
