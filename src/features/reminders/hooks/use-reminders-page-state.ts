import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { addDaysISO, todayISO } from "@/domain/debts";
import type { ReminderItem as ReminderItemData } from "@/domain/reminders";
import { useSmartAdvisorInsights } from "@/features/overview/hooks";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import {
  useDebts,
  useMarkAllRemindersAsRead,
  usePermission,
  useReminders,
  useReminderStates,
  useSetReminderState,
} from "@/state";
import type { Debt } from "@/types";

export type RemindersMainTab = "pending" | "read";
export type RemindersSubFilter = "all" | "overdue" | "bills" | "debts" | "advisor";

export function useRemindersPageState() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const permission = usePermission("reminders");
  const { guardAction, upgradeModal } = useMutationGuard();
  const today = todayISO();
  const { highlightId } = useHighlightTarget("q");

  const [mainTabOverride, setMainTabOverride] = useState<RemindersMainTab | null>(null);
  const [subFilter, setSubFilter] = useState<RemindersSubFilter>("all");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settleDebt, setSettleDebt] = useState<Debt | null>(null);
  const [billPayment, setBillPayment] = useState<{
    cardId: string;
    competenceMonth: string;
    openBalanceCents: number;
  } | null>(null);

  const debtsQuery = useDebts();
  const { allItems, readHistoryItems, totalCount, overdueCount, isLoading, error, preferences } =
    useReminders(today);
  const statesQuery = useReminderStates();
  const setState = useSetReminderState();
  const markAllMutation = useMarkAllRemindersAsRead();
  const advisor = useSmartAdvisorInsights();
  const advisorAlerts = advisor.insights.filter((i) => i.priority === 1 || i.priority === 2);

  const stateMap = useMemo(
    () => new Map((statesQuery.data ?? []).map((s) => [s.key, s.kind])),
    [statesQuery.data],
  );

  const isTargetRead = useMemo(() => {
    if (!highlightId) return false;
    const all = [...allItems, ...readHistoryItems];
    const target = all.find(
      (it) => it.key === highlightId || it.link?.params?.q === highlightId || it.link?.params?.debt === highlightId,
    );
    return Boolean(target && stateMap.get(target.key) === "read");
  }, [highlightId, allItems, readHistoryItems, stateMap]);

  const mainTab: RemindersMainTab = mainTabOverride ?? (isTargetRead ? "read" : "pending");

  const handleStateUpdate = useCallback(
    (occurrenceKey: string, state: { kind: "read" | "snoozed"; snoozeUntil?: string } | null) => {
      guardAction(() => {
        setState.mutate({ occurrenceKey, state });
      }, "Gerenciar Lembretes");
    },
    [guardAction, setState],
  );

  const snooze = useCallback(
    (key: string) => {
      handleStateUpdate(key, { kind: "snoozed", snoozeUntil: addDaysISO(today, 7) });
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
          setBillPayment({ cardId, competenceMonth: month, openBalanceCents: item.amountCents });
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
        (it) => it.key === key || it.link?.params?.q === key || it.link?.params?.debt === key,
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

  const filteredItems = useMemo(
    () =>
      allItems
        .filter((item) => {
          const stateKind = stateMap.get(item.key) ?? null;
          if (mainTab === "pending") {
            if (stateKind === "read") return false;
            if (subFilter === "overdue") return item.status === "overdue";
            if (subFilter === "bills") return item.kind === "bill";
            if (subFilter === "debts") return item.kind === "debt";
            if (subFilter === "advisor") return false;
            return true;
          }
          return stateKind === "read";
        })
        .sort((a, b) => {
          const aState = stateMap.get(a.key) ?? null;
          const bState = stateMap.get(b.key) ?? null;
          if (aState === "read" && bState !== "read") return 1;
          if (aState !== "read" && bState === "read") return -1;
          const priority: Record<string, number> = { overdue: 0, due_today: 1, due_soon: 2, pending: 3 };
          const diff = (priority[a.status] ?? 3) - (priority[b.status] ?? 3);
          return diff !== 0 ? diff : a.dueDate.localeCompare(b.dueDate);
        }),
    [allItems, mainTab, stateMap, subFilter],
  );

  const unreadFilteredItems = useMemo(
    () => filteredItems.filter((i) => stateMap.get(i.key) !== "read"),
    [filteredItems, stateMap],
  );

  const handleMarkAllRead = () => {
    guardAction(() => {
      const keys = unreadFilteredItems.map((i) => i.key);
      if (keys.length > 0) markAllMutation.mutate(keys);
    }, "Marcar Lembretes como Lidos");
  };

  const billsCount = allItems.filter((i) => i.kind === "bill" && stateMap.get(i.key) !== "read").length;
  const debtsCount = allItems.filter((i) => i.kind === "debt" && stateMap.get(i.key) !== "read").length;
  const advisorCount = advisorAlerts.length;
  const totalPendingEffective = totalCount + advisorCount;
  const hasUrgentPending = overdueCount > 0 || advisorAlerts.some((i) => i.priority === 1);

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
    advisorCount,
    totalPendingEffective,
    hasUrgentPending,
    advisorAlerts,
    dismissAdvisor: advisor.dismiss,
    filteredItems,
    unreadFilteredItems,
    stateMap,
    markAllPending: markAllMutation.isPending,
    handleStateUpdate,
    snooze,
    openReminder,
    handleSettle,
    handleMarkAllRead,
  };
}
