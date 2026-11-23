import { QueryClientContext } from "@tanstack/react-query";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { addDaysISO, todayISO } from "@/domain/debts";
import type { ReminderItem as ReminderItemData } from "@/domain/reminders";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import {
  getOptionalHook,
  useNotificationCenter,
} from "@/hooks/use-notification-center";
import { pushToast } from "@/services/toast";
import * as state from "@/state";
import {
  useDebts,
  useMarkAllRemindersAsRead,
  usePermission,
  useReminderStates,
  useSetReminderState,
} from "@/state";
import type { Debt, UserBroadcastNotification } from "@/types";

export type RemindersMainTab = "pending" | "read";
export type RemindersSubFilter =
  | "all"
  | "overdue"
  | "bills"
  | "debts"
  | "receivables"
  | "advisor"
  | "system";

export function useRemindersPageState() {
  const navigate = useNavigate();
  const queryClient = useContext(QueryClientContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const permission = usePermission("reminders");
  const { guardAction, upgradeModal } = useMutationGuard();
  const today = todayISO();
  const { highlightId } = useHighlightTarget("q");

  const [mainTabOverride, setMainTabOverride] =
    useState<RemindersMainTab | null>(null);
  const [subFilter, setSubFilter] = useState<RemindersSubFilter>("all");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settleDebt, setSettleDebt] = useState<Debt | null>(null);
  const [billPayment, setBillPayment] = useState<{
    cardId: string;
    competenceMonth: string;
    openBalanceCents: number;
  } | null>(null);

  const debtsQuery = useDebts();
  const center = useNotificationCenter({ today });
  const {
    items,
    allItems,
    closedBillAlerts,
    budgetOverrunAlert,
    tripAndFamilyAlerts,
    dividendAlerts,
    readHistoryItems,
    overdueCount,
    criticalCount,
    actionNeededCount,
    totalRemindersPageCount,
    isLoading,
    error,
    preferences,
    advisorAlerts,
    dismissAdvisor,
    unreadBroadcasts,
    unreadSupportTickets,
    pendingSplitSignals,
    hasPastDueSubscription,
  } = center;

  const statesQuery = useReminderStates();
  const setState = useSetReminderState();
  const markAllMutation = useMarkAllRemindersAsRead();

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
  const markBroadcastMutation = useMarkBroadcastAsReadSafe();
  const dismissBroadcastMutation = useDismissBroadcastNotificationSafe();

  const stateMap = useMemo(
    () => new Map((statesQuery.data ?? []).map((s) => [s.key, s.kind])),
    [statesQuery.data],
  );

  const isTargetRead = useMemo(() => {
    if (!highlightId) return false;
    const all = [...allItems, ...readHistoryItems];
    const target = all.find(
      (it) =>
        it.key === highlightId ||
        it.link?.params?.q === highlightId ||
        it.link?.params?.debt === highlightId,
    );
    return Boolean(target && stateMap.get(target.key) === "read");
  }, [highlightId, allItems, readHistoryItems, stateMap]);

  const mainTab: RemindersMainTab =
    mainTabOverride ?? (isTargetRead ? "read" : "pending");

  const handleStateUpdate = useCallback(
    (
      occurrenceKey: string,
      nextState: { kind: "read" | "snoozed"; snoozeUntil?: string } | null,
    ) => {
      guardAction(() => {
        setState.mutate({ occurrenceKey, state: nextState });
        if (nextState) {
          pushToast({
            title:
              nextState.kind === "snoozed"
                ? "Lembrete adiado por 7 dias"
                : "Marcado como lido",
            variant: "default",
            duration: 5000,
            action: {
              label: "Desfazer",
              onClick: () => {
                setState.mutate({ occurrenceKey, state: null });
              },
            },
          });
        } else {
          pushToast({
            title: "Lembrete reaberto",
            variant: "default",
          });
        }
      }, "Gerenciar Lembretes");
    },
    [guardAction, setState],
  );

  const snooze = useCallback(
    (key: string) => {
      handleStateUpdate(key, {
        kind: "snoozed",
        snoozeUntil: addDaysISO(today, 7),
      });
    },
    [handleStateUpdate, today],
  );

  const openReminder = useCallback(
    (item: { link?: { path: string; params?: Record<string, string> } }) => {
      if (!item.link) return;
      const params = new URLSearchParams(item.link.params ?? {});
      navigate(`${item.link.path}?${params.toString()}`);
    },
    [navigate],
  );

  const handleSettle = useCallback(
    (item: ReminderItemData) => {
      if (item.kind === "debt") {
        const debtId = item.key.replace(/^debt:/, "");
        const target = debtsQuery.data?.find((d) => d.id === debtId);
        if (target) setSettleDebt(target);
        else openReminder(item);
      } else if (item.kind === "bill") {
        const parts = item.key.split(":");
        const cardId = parts[1] || item.link?.params?.card;
        const month = parts[2] || item.link?.params?.month;
        if (cardId && month) {
          setBillPayment({
            cardId,
            competenceMonth: month,
            openBalanceCents: item.amountCents,
          });
        } else {
          openReminder(item);
        }
      }
    },
    [debtsQuery.data, openReminder],
  );

  useEffect(() => {
    const action = searchParams.get("action");
    const key = searchParams.get("key");
    if (action === "pay" && key && allItems.length > 0) {
      const target = allItems.find(
        (it) =>
          it.key === key ||
          it.link?.params?.q === key ||
          it.link?.params?.debt === key,
      );
      if (target) {
        queueMicrotask(() => handleSettle(target));
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("action");
          next.delete("key");
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, allItems, handleSettle, setSearchParams]);

  const activePendingSource = useMemo(
    () =>
      items.length > 0 || allItems.length === 0
        ? items
        : allItems.filter((i) => stateMap.get(i.key) !== "read"),
    [items, allItems, stateMap],
  );

  const filteredItems = useMemo(() => {
    const source = mainTab === "pending" ? activePendingSource : allItems;
    return source
      .filter((item) => {
        const stateKind = stateMap.get(item.key) ?? null;
        if (mainTab === "pending") {
          if (stateKind === "read") return false;
          if (subFilter === "overdue") return item.status === "overdue";
          if (subFilter === "bills") return item.kind === "bill";
          if (subFilter === "debts")
            return item.kind === "debt" && item.direction !== "receivable";
          if (subFilter === "receivables")
            return item.direction === "receivable";
          if (subFilter === "advisor" || subFilter === "system") return false;
          return true;
        }
        return stateKind === "read";
      })
      .sort((a, b) => {
        const aState = stateMap.get(a.key) ?? null;
        const bState = stateMap.get(b.key) ?? null;
        if (aState === "read" && bState !== "read") return 1;
        if (aState !== "read" && bState === "read") return -1;
        const priority: Record<string, number> = {
          overdue: 0,
          due_today: 1,
          due_soon: 2,
          pending: 3,
        };
        const diff = (priority[a.status] ?? 3) - (priority[b.status] ?? 3);
        return diff !== 0 ? diff : a.dueDate.localeCompare(b.dueDate);
      });
  }, [activePendingSource, allItems, mainTab, stateMap, subFilter]);

  const unreadFilteredItems = useMemo(
    () => filteredItems.filter((i) => stateMap.get(i.key) !== "read"),
    [filteredItems, stateMap],
  );

  const handleMarkAllRead = () => {
    guardAction(() => {
      const keys = [...unreadFilteredItems.map((i) => i.key)];
      if (subFilter === "all" || subFilter === "bills") {
        keys.push(...closedBillAlerts.map((a) => a.key));
      }
      if (subFilter === "all" || subFilter === "system") {
        if (budgetOverrunAlert) keys.push(budgetOverrunAlert.id);
        keys.push(...tripAndFamilyAlerts.map((a) => a.id));
        keys.push(...dividendAlerts.map((a) => a.id));
        for (const b of unreadBroadcasts) {
          markBroadcastMutation.mutate(b.id);
        }
      }
      if (keys.length > 0) markAllMutation.mutate(keys);
    }, "Marcar Lembretes como Lidos");
  };

  const handleOpenBroadcast = (b: UserBroadcastNotification) => {
    if (!b.action_url) return;
    const rawUrl = b.action_url.trim();
    markBroadcastMutation.mutate(b.id);
    if (rawUrl.startsWith("/") && !rawUrl.startsWith("//")) {
      navigate(rawUrl);
      return;
    }
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === "https:") {
        window.open(parsed.toString(), "_blank", "noopener,noreferrer");
      }
    } catch {
      // Ignora URL inválida
    }
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

  const handleRetry = useCallback(() => {
    if (queryClient) {
      void queryClient.invalidateQueries();
    }
  }, [queryClient]);

  const handleOpenSupport = () => {
    navigate("/configuracoes?tab=support");
  };

  const handleOpenSplitSignal = () => {
    navigate("/dividas");
  };

  const handleOpenSubscriptionPastDue = () => {
    navigate("/configuracoes?tab=subscription");
  };

  const billsCount =
    activePendingSource.filter(
      (i) => i.kind === "bill" && stateMap.get(i.key) !== "read",
    ).length + closedBillAlerts.length;
  const debtsCount = activePendingSource.filter(
    (i) =>
      i.kind === "debt" &&
      i.direction !== "receivable" &&
      stateMap.get(i.key) !== "read",
  ).length;
  const receivablesCount = activePendingSource.filter(
    (i) => i.direction === "receivable" && stateMap.get(i.key) !== "read",
  ).length;
  const advisorCount = advisorAlerts.length;
  const systemCount =
    unreadBroadcasts.length +
    unreadSupportTickets.length +
    pendingSplitSignals.length +
    (hasPastDueSubscription ? 1 : 0) +
    (budgetOverrunAlert ? 1 : 0) +
    tripAndFamilyAlerts.length +
    dividendAlerts.length;

  const totalPendingEffective = totalRemindersPageCount;
  const hasUrgentPending = criticalCount > 0;
  const hasActionNeededPending = !hasUrgentPending && actionNeededCount > 0;

  return {
    navigate,
    permission,
    upgradeModal,
    highlightId,
    mainTab,
    setMainTabOverride,
    subFilter,
    setSubFilter,
    isSettingsOpen,
    setIsSettingsOpen,
    settleDebt,
    setSettleDebt,
    billPayment,
    setBillPayment,
    isLoading,
    error,
    preferences,
    readHistoryItems,
    overdueCount,
    billsCount,
    debtsCount,
    receivablesCount,
    advisorCount,
    systemCount,
    closedBillAlerts,
    budgetOverrunAlert,
    tripAndFamilyAlerts,
    dividendAlerts,
    unreadBroadcasts,
    unreadSupportTickets,
    pendingSplitSignals,
    hasPastDueSubscription,
    totalPendingEffective,
    hasUrgentPending,
    hasActionNeededPending,
    advisorAlerts,
    dismissAdvisor,
    filteredItems,
    unreadFilteredItems,
    stateMap,
    markAllPending: markAllMutation.isPending,
    handleStateUpdate,
    snooze,
    openReminder,
    handleSettle,
    handleMarkAllRead,
    handleOpenBroadcast,
    handleMarkBroadcastRead,
    handleDismissBroadcast,
    handleRetry,
    handleOpenSupport,
    handleOpenSplitSignal,
    handleOpenSubscriptionPastDue,
  };
}
