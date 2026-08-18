import { useState } from "react";
import { useNavigate } from "react-router";
import { Bell, CheckCheck } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, Skeleton, Tabs } from "@/components/ui";
import { ReminderItem } from "@/components/modules";
import { addDaysISO, todayISO } from "@/domain/debts";
import { getErrorMessage } from "@/services/errors";
import { triggerHaptic } from "@/services/haptics";
import {
  useReminders,
  useReminderStates,
  useSetReminderState,
  useMarkAllRemindersAsRead,
} from "@/state";

type ReminderFilter = "all" | "overdue" | "bills" | "debts";

/**
 * Central de lembretes (§3.10) — consolida faturas (saldo aberto por
 * competência) e dívidas pendentes; ações de lido/snooze/restaurar
 * persistidas em `reminder_states` e preferências em `user_preferences`.
 */
export function RemindersPage() {
  const navigate = useNavigate();
  const today = todayISO();
  const [filter, setFilter] = useState<ReminderFilter>("all");

  const { items, totalCount, overdueCount, isLoading, error, preferences } = useReminders(today);
  const statesQuery = useReminderStates();
  const setState = useSetReminderState();
  const markAllMutation = useMarkAllRemindersAsRead();

  const handle = (occurrenceKey: string, state: { kind: "read" | "snoozed"; snoozeUntil?: string } | null) => {
    setState.mutate({ occurrenceKey, state });
  };

  const snooze = (key: string) => {
    // Snooze de 7 dias a partir de HOJE (janela padrão de adiamento).
    const until = addDaysISO(today, 7);
    handle(key, { kind: "snoozed", snoozeUntil: until });
  };

  /** Abre o destino do lembrete com o deep-link (destaque do item na tela). */
  const openReminder = (item: { link?: { path: string; params?: Record<string, string> } }) => {
    if (!item.link) return;
    const params = new URLSearchParams(item.link.params ?? {});
    navigate(`${item.link.path}?${params.toString()}`);
  };

  const handleMarkAllRead = () => {
    triggerHaptic("medium");
    const keys = filteredItems.map((i) => i.key);
    if (keys.length > 0) {
      markAllMutation.mutate(keys);
    }
  };

  const filteredItems = items.filter((item) => {
    if (filter === "overdue") return item.status === "overdue";
    if (filter === "bills") return item.kind === "bill";
    if (filter === "debts") return item.kind === "debt";
    return true;
  });

  const billsCount = items.filter((i) => i.kind === "bill").length;
  const debtsCount = items.filter((i) => i.kind === "debt").length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Lembretes</h1>
            {totalCount > 0 && (
              <Badge variant={overdueCount > 0 ? "critical" : "default"}>
                {totalCount} {totalCount === 1 ? "pendência" : "pendências"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Faturas e dívidas consolidadas que precisam de sua atenção.
          </p>
        </div>

        {items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markAllMutation.isPending || filteredItems.length === 0}
            className="self-start sm:self-auto"
          >
            <CheckCheck className="size-4 mr-1.5 text-muted-foreground" aria-hidden="true" />
            Marcar todas como lidas
          </Button>
        )}
      </header>

      {/* Tabs de Filtro */}
      {items.length > 0 && (
        <Tabs
          value={filter}
          onValueChange={(val) => {
            triggerHaptic("light");
            setFilter(val as ReminderFilter);
          }}
          items={[
            { value: "all", label: `Todas (${totalCount})`, content: null },
            { value: "overdue", label: `Atrasadas (${overdueCount})`, content: null },
            { value: "bills", label: `Faturas (${billsCount})`, content: null },
            { value: "debts", label: `Dívidas (${debtsCount})`, content: null },
          ]}
        />
      )}

      {error ? <ErrorState message={getErrorMessage(error)} /> : null}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !preferences.enabled ? (
        <EmptyState
          icon={<Bell className="size-6" aria-hidden="true" />}
          title="Lembretes desativados"
          description="Você desativou os lembretes automáticos nas configurações."
          tone="default"
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-6" aria-hidden="true" />}
          title="Tudo em dia"
          description={
            filter === "all"
              ? "Nenhuma fatura ou dívida vencendo nos próximos dias."
              : "Nenhum lembrete nesta categoria."
          }
          tone="positive"
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredItems.map((item) => (
            <ReminderItem
              key={item.key}
              item={item}
              stateKind={statesQuery.data?.find((s) => s.key === item.key)?.kind ?? null}
              onMarkRead={(key) => handle(key, { kind: "read" })}
              onSnooze={snooze}
              onRestore={(key) => handle(key, null)}
              onOpen={() => openReminder(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
