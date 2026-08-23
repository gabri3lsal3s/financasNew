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

type ReminderFilter = "all" | "pending" | "overdue" | "bills" | "debts" | "read";

/**
 * Central de lembretes (§3.10) — consolida faturas (saldo aberto por
 * competência) e dívidas pendentes; ações de lido/snooze/restaurar
 * persistidas em `reminder_states` e preferências em `user_preferences`.
 */
export function RemindersPage() {
  const navigate = useNavigate();
  const today = todayISO();
  const [filter, setFilter] = useState<ReminderFilter>("all");

  const { allItems, totalCount, overdueCount, readCount, isLoading, error, preferences } = useReminders(today);
  const statesQuery = useReminderStates();
  const setState = useSetReminderState();
  const markAllMutation = useMarkAllRemindersAsRead();

  const stateMap = new Map((statesQuery.data ?? []).map((s) => [s.key, s.kind]));

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

  const filteredItems = allItems
    .filter((item) => {
      const stateKind = stateMap.get(item.key) ?? null;
      if (filter === "pending") return stateKind !== "read";
      if (filter === "overdue") return item.status === "overdue" && stateKind !== "read";
      if (filter === "bills") return item.kind === "bill";
      if (filter === "debts") return item.kind === "debt";
      if (filter === "read") return stateKind === "read";
      return true;
    })
    .sort((a, b) => {
      const aState = stateMap.get(a.key) ?? null;
      const bState = stateMap.get(b.key) ?? null;
      if (aState === "read" && bState !== "read") return 1;
      if (aState !== "read" && bState === "read") return -1;

      const priority: Record<string, number> = { overdue: 0, due_today: 1, due_soon: 2, pending: 3 };
      const diff = (priority[a.status] ?? 3) - (priority[b.status] ?? 3);
      if (diff !== 0) return diff;
      return a.dueDate.localeCompare(b.dueDate);
    });

  const unreadFilteredItems = filteredItems.filter((i) => stateMap.get(i.key) !== "read");

  const handleMarkAllRead = () => {
    triggerHaptic("medium");
    const keys = unreadFilteredItems.map((i) => i.key);
    if (keys.length > 0) {
      markAllMutation.mutate(keys);
    }
  };

  const billsCount = allItems.filter((i) => i.kind === "bill").length;
  const debtsCount = allItems.filter((i) => i.kind === "debt").length;

  const getEmptyDescription = () => {
    switch (filter) {
      case "read":
        return "Nenhum lembrete marcado como lido.";
      case "overdue":
        return "Nenhuma fatura ou dívida atrasada.";
      case "bills":
        return "Nenhuma fatura pendente ou recente.";
      case "debts":
        return "Nenhuma dívida pendente ou recente.";
      case "pending":
        return "Nenhuma pendência no momento.";
      default:
        return "Nenhuma fatura ou dívida encontrada.";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Lembretes
            </h1>
            {totalCount > 0 && (
              <Badge variant={overdueCount > 0 ? "critical" : "default"}>
                {totalCount} {totalCount === 1 ? "pendência" : "pendências"}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Faturas e compromissos que precisam da sua atenção
          </p>
        </div>

        {allItems.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markAllMutation.isPending || unreadFilteredItems.length === 0}
            className="self-start sm:self-auto shrink-0"
          >
            <CheckCheck className="size-4 mr-1.5 text-muted-foreground" aria-hidden="true" />
            Marcar todas como lidas
          </Button>
        )}
      </header>

      {/* Tabs de Filtro */}
      {allItems.length > 0 && (
        <Tabs
          value={filter}
          onValueChange={(val) => {
            triggerHaptic("light");
            setFilter(val as ReminderFilter);
          }}
          items={[
            { value: "all", label: `Todas (${allItems.length})`, content: null },
            { value: "pending", label: `Pendentes (${totalCount})`, content: null },
            { value: "overdue", label: `Atrasadas (${overdueCount})`, content: null },
            { value: "bills", label: `Faturas (${billsCount})`, content: null },
            { value: "debts", label: `Dívidas (${debtsCount})`, content: null },
            { value: "read", label: `Lidas (${readCount})`, content: null },
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
          description={getEmptyDescription()}
          tone="positive"
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredItems.map((item) => (
            <ReminderItem
              key={item.key}
              item={item}
              stateKind={stateMap.get(item.key) ?? null}
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
