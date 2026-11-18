import { Bell } from "lucide-react";
import { Button, EmptyState, FilterChips } from "@/components/ui";
import { HighlightRow, ReminderItem } from "@/components/modules";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import type { ReminderItem as ReminderItemData } from "@/domain/reminders";
import type { RemindersSubFilter } from "../hooks/use-reminders-page-state";
import { AdvisorReminderCard } from "./AdvisorReminderCard";

export interface RemindersPendingTabProps {
  subFilter: RemindersSubFilter;
  onSubFilterChange: (next: RemindersSubFilter) => void;
  totalPendingEffective: number;
  overdueCount: number;
  billsCount: number;
  debtsCount: number;
  advisorCount: number;
  advisorAlerts: SmartAdvisorInsight[];
  filteredItems: ReminderItemData[];
  stateMap: Map<string, string>;
  highlightId: string | null;
  billDaysBefore: number;
  onOpenAdvisorAlert: (item: SmartAdvisorInsight) => void;
  onDismissAdvisor: (themeKey: string) => void;
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
  if (subFilter === "advisor") return "Nenhum aviso inteligente no momento.";
  return "Nenhuma pendência no momento. Todas as faturas, dívidas e avisos estão em dia.";
}

export function RemindersPendingTab({
  subFilter,
  onSubFilterChange,
  totalPendingEffective,
  overdueCount,
  billsCount,
  debtsCount,
  advisorCount,
  advisorAlerts,
  filteredItems,
  stateMap,
  highlightId,
  billDaysBefore,
  onOpenAdvisorAlert,
  onDismissAdvisor,
  onMarkRead,
  onSnooze,
  onRestore,
  onSettle,
  onOpenReminder,
  onOpenSettings,
}: RemindersPendingTabProps) {
  const showAdvisor = subFilter === "all" || subFilter === "advisor";
  const showReminders = subFilter !== "advisor";
  const visibleAdvisorAlerts = showAdvisor ? advisorAlerts : [];
  const visibleReminders = showReminders ? filteredItems : [];
  const hasAnyVisibleItem = visibleAdvisorAlerts.length > 0 || visibleReminders.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {totalPendingEffective > 0 ? (
        <FilterChips
          items={[
            { key: "all", label: "Todas", count: totalPendingEffective },
            ...(overdueCount > 0
              ? [{ key: "overdue", label: "Atrasadas", count: overdueCount, tone: "critical" as const }]
              : []),
            ...(billsCount > 0 ? [{ key: "bills", label: "Faturas", count: billsCount }] : []),
            ...(debtsCount > 0 ? [{ key: "debts", label: "Dívidas", count: debtsCount }] : []),
            ...(advisorCount > 0
              ? [{ key: "advisor", label: "Avisos & Renda", count: advisorCount }]
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
              <div key={item.key} data-tour={idx === 0 ? "reminders-settle-card" : undefined}>
                <HighlightRow
                  highlightId={highlightId}
                  id={isMatch ? highlightId : item.key}
                  className="rounded-2xl"
                >
                  <ReminderItem
                    item={item}
                    stateKind={(stateMap.get(item.key) as "read" | "snoozed" | undefined) ?? null}
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
          <strong className="text-foreground font-semibold">{billDaysBefore} dias</strong>.
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
