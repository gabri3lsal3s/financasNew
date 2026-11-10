import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AlertTriangle, ArrowDownLeft, Bell, CheckCheck, CreditCard, SlidersHorizontal, X } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, MoneyText, Skeleton, Tabs } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { HighlightRow, ReadOnlyBanner, ReminderItem } from "@/components/modules";
import { RemindersSettingsModal } from "../components/reminders-settings-modal";
import { SettleDialog } from "@/features/debts/components/settle-dialog";
import { PaymentDialog } from "@/features/cards/components/payment-dialog";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { addDaysISO, todayISO } from "@/domain/debts";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import {
  useDebts,
  useMarkAllRemindersAsRead,
  usePermission,
  useReminders,
  useReminderStates,
  useSetReminderState,
} from "@/state";
import { useSmartAdvisorInsights } from "@/features/overview/hooks";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import type { ReminderItem as ReminderItemData } from "@/domain/reminders";
import type { Debt } from "@/types";

type MainTab = "pending" | "read";
type SubFilter = "all" | "overdue" | "bills" | "debts" | "advisor";

/**
 * Central de Lembretes & Avisos (§3.10) — consolida faturas, dívidas pendentes
 * e avisos inteligentes (Smart Advisor, ex.: renda habitual prevista).
 * Preserva o histórico de lidos/quitados em `reminder_states`.
 */
export function RemindersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const permission = usePermission("reminders");
  const { guardAction, upgradeModal } = useMutationGuard();
  const today = todayISO();
  const { highlightId } = useHighlightTarget("q");
  const [mainTabOverride, setMainTabOverride] = useState<MainTab | null>(null);
  const [subFilter, setSubFilter] = useState<SubFilter>("all");
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

  const mainTab: MainTab = mainTabOverride ?? (isTargetRead ? "read" : "pending");

  const handle = (occurrenceKey: string, state: { kind: "read" | "snoozed"; snoozeUntil?: string } | null) => {
    guardAction(() => {
      setState.mutate({ occurrenceKey, state });
    }, "Gerenciar Lembretes");
  };

  const snooze = (key: string) => {
    // Snooze de 7 dias a partir de HOJE (janela padrão de adiamento).
    const until = addDaysISO(today, 7);
    handle(key, { kind: "snoozed", snoozeUntil: until });
  };

  /** Abre o destino do lembrete com o deep-link (destaque do item na tela). */
  const openReminder = useCallback(
    (item: { link?: { path: string; params?: Record<string, string> } }) => {
      if (!item.link) return;
      const params = new URLSearchParams(item.link.params ?? {});
      navigate(`${item.link.path}?${params.toString()}`);
    },
    [navigate],
  );

  /** Ação de baixa/quitação in-loco com confirmação explícita. */
  const handleSettle = useCallback(
    (item: ReminderItemData) => {
      triggerSensory("action");
      if (item.kind === "debt") {
        const debtId = item.key.replace(/^debt:/, "");
        const target = debtsQuery.data?.find((d) => d.id === debtId);
        if (target) {
          setSettleDebt(target);
        } else {
          openReminder(item);
        }
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

  // Resposta a notificações nativas: ao tocar em "Pagar no App", abre o diálogo de quitação com confirmação
  useEffect(() => {
    const action = searchParams.get("action");
    const key = searchParams.get("key");
    if (action === "pay" && key && allItems.length > 0) {
      const target = allItems.find((it) => it.key === key || it.link?.params?.q === key || it.link?.params?.debt === key);
      if (target) {
        queueMicrotask(() => {
          handleSettle(target);
        });
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("action");
        next.delete("key");
        return next;
      }, { replace: true });
    }
  }, [searchParams, allItems, debtsQuery.data, handleSettle, setSearchParams]);

  const handleOpenAdvisorAlert = (item: SmartAdvisorInsight) => {
    triggerSensory("action");

    // 1. Aporte para rebalanceamento
    if (item.primaryAction?.kind === "navigate_aporte" || item.themeKey.startsWith("aporte:")) {
      const p = item.primaryAction?.payload as { valorCents?: number } | undefined;
      const valor = p?.valorCents;
      if (valor && valor > 0) {
        navigate(`/investments?tab=aporte&valor=${valor}`);
      } else {
        navigate("/investments?tab=aporte");
      }
      return;
    }

    // 2. Revisão de recorrências / assinaturas / duplicidades
    if (
      item.category === "savings" ||
      item.primaryAction?.kind === "cut_subscription" ||
      item.id.startsWith("dup:")
    ) {
      const p = item.primaryAction?.payload as { key?: string } | undefined;
      const itemKey = p?.key ?? item.themeKey.replace(/^(dup:|savings:|price_adj:)/, "");
      navigate(`/insights?aba=recurrences&item=${encodeURIComponent(itemKey)}`);
      return;
    }

    // 3. Entrada / Receita
    if (
      item.category === "income" ||
      item.primaryAction?.kind === "open_income" ||
      item.primaryAction?.kind === "confirm_income"
    ) {
      const p = item.primaryAction?.payload as
        | { name?: string; categoryId?: string; date?: string; valueCents?: number }
        | undefined;
      const params = new URLSearchParams(window.location.search);
      params.set("novo", "receita");
      params.set("modo", "rapido");
      if (p?.name) params.set("descricao", p.name);
      if (p?.categoryId) params.set("categoria", p.categoryId);
      if (p?.date) params.set("data", p.date);
      if (p?.valueCents) params.set("valor", String(p.valueCents));
      else if (item.metadata?.valueCents) params.set("valor", String(item.metadata.valueCents));

      navigate(`?${params.toString()}`);
      return;
    }

    // 4. Despesa crítica / conta a pagar pré-preenchida
    const p = item.primaryAction?.payload as
      | {
          name?: string;
          valueCents?: number;
          categoryId?: string;
          date?: string;
          forma?: string;
          cardId?: string;
        }
      | undefined;

    const params = new URLSearchParams(window.location.search);
    params.set("novo", "despesa");
    params.set("modo", "rapido");
    const name = p?.name ?? item.title;
    const valueCents = p?.valueCents ?? item.metadata?.valueCents;
    const categoryId = p?.categoryId ?? item.metadata?.categoryId;
    const date = p?.date ?? item.metadata?.expectedDate;

    if (name) params.set("descricao", name);
    if (valueCents) params.set("valor", String(valueCents));
    if (categoryId) params.set("categoria", categoryId);
    if (date) params.set("data", date);
    navigate(`?${params.toString()}`);
  };

  const handleDismissAdvisor = (e: React.MouseEvent, themeKey: string) => {
    e.stopPropagation();
    triggerSensory("action");
    advisor.dismiss(themeKey, 30);
  };

  const filteredItems = allItems
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
      if (diff !== 0) return diff;
      return a.dueDate.localeCompare(b.dueDate);
    });

  const unreadFilteredItems = filteredItems.filter((i) => stateMap.get(i.key) !== "read");

  const handleMarkAllRead = () => {
    guardAction(() => {
      const keys = unreadFilteredItems.map((i) => i.key);
      if (keys.length > 0) {
        markAllMutation.mutate(keys);
      }
    }, "Marcar Lembretes como Lidos");
  };

  const billsCount = allItems.filter((i) => i.kind === "bill" && stateMap.get(i.key) !== "read").length;
  const debtsCount = allItems.filter((i) => i.kind === "debt" && stateMap.get(i.key) !== "read").length;
  const advisorCount = advisorAlerts.length;
  const totalPendingEffective = totalCount + advisorCount;
  const hasUrgentPending = overdueCount > 0 || advisorAlerts.some((i) => i.priority === 1);

  const getEmptyDescription = () => {
    if (subFilter === "overdue") return "Nenhuma fatura ou dívida atrasada.";
    if (subFilter === "bills") return "Nenhuma fatura pendente no momento.";
    if (subFilter === "debts") return "Nenhuma dívida pendente no momento.";
    if (subFilter === "advisor") return "Nenhum aviso inteligente no momento.";
    return "Nenhuma pendência no momento. Todas as faturas, dívidas e avisos estão em dia.";
  };

  const renderAdvisorAlert = (advisorItem: SmartAdvisorInsight) => {
    const isCritical = advisorItem.priority === 1;
    const isIncome = advisorItem.category === "income";
    const badgeVariant = isCritical ? "critical" : isIncome ? "positive" : "warning";
    const badgeLabel = isCritical ? "Crítico" : isIncome ? "Entrada" : "Vence hoje";
    const cardName = advisorItem.cardContext?.cardName ?? advisorItem.metadata?.cardName;

    return (
      <article
        key={advisorItem.id}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4 min-w-0 overflow-hidden"
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl border",
              isCritical
                ? "bg-critical/10 border-critical/20 text-critical-strong"
                : isIncome
                  ? "bg-positive/10 border-positive/20 text-positive-strong"
                  : "bg-warning/15 border-warning/20 text-warning-strong",
            )}
          >
            {isCritical ? (
              <AlertTriangle className="size-4.5" aria-hidden="true" />
            ) : isIncome ? (
              <ArrowDownLeft className="size-4.5" aria-hidden="true" />
            ) : (
              <CreditCard className="size-4.5" aria-hidden="true" />
            )}
          </span>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate min-w-0">
                {advisorItem.title}
              </h3>
              <Badge variant={badgeVariant} size="xs" className="shrink-0">
                {badgeLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {advisorItem.description}
            </p>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              {advisorItem.metadata?.valueCents !== undefined && (
                <MoneyText
                  cents={advisorItem.metadata.valueCents}
                  className="font-semibold text-foreground text-xs"
                />
              )}
              {cardName && <span>• {cardName}</span>}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
          <Button
            type="button"
            size="sm"
            variant={isIncome ? "default" : "outline"}
            onClick={() => handleOpenAdvisorAlert(advisorItem)}
            className="h-8 text-xs font-medium"
          >
            {advisorItem.primaryAction?.label ?? (isIncome ? "Informar valor" : "Ver detalhe")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-surface-active"
            onClick={(e) => handleDismissAdvisor(e, advisorItem.themeKey)}
            title="Dispensar aviso por 30 dias"
            aria-label={`Dispensar ${advisorItem.title}`}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </article>
    );
  };

  const renderPendingContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      );
    }
    if (!preferences.enabled) {
      return (
        <EmptyState
          icon={<Bell className="size-6" aria-hidden="true" />}
          title="Lembretes desativados"
          description="Você desativou os lembretes automáticos nas configurações."
          tone="default"
        />
      );
    }

    const showAdvisor = subFilter === "all" || subFilter === "advisor";
    const showReminders = subFilter !== "advisor";
    const visibleAdvisorAlerts = showAdvisor ? advisorAlerts : [];
    const visibleReminders = showReminders ? filteredItems : [];
    const hasAnyVisibleItem = visibleAdvisorAlerts.length > 0 || visibleReminders.length > 0;

    return (
      <div className="flex flex-col gap-4">
        {/* Sub-filtros secundários quando há pendências de qualquer tipo */}
        {totalPendingEffective > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <Button
              type="button"
              variant={subFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSubFilter("all");
              }}
              className="text-xs h-7 px-2.5"
            >
              Todas ({totalPendingEffective})
            </Button>
            {overdueCount > 0 && (
              <Button
                type="button"
                variant={subFilter === "overdue" ? "destructive" : "outline"}
                size="sm"
                onClick={() => {
                  setSubFilter("overdue");
                }}
                className={cn(
                  "text-xs h-7 px-2.5",
                  subFilter !== "overdue" && "border-critical/30 text-critical hover:bg-critical/10",
                )}
              >
                Atrasadas ({overdueCount})
              </Button>
            )}
            {billsCount > 0 && (
              <Button
                type="button"
                variant={subFilter === "bills" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSubFilter("bills");
                }}
                className="text-xs h-7 px-2.5"
              >
                Faturas ({billsCount})
              </Button>
            )}
            {debtsCount > 0 && (
              <Button
                type="button"
                variant={subFilter === "debts" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSubFilter("debts");
                }}
                className="text-xs h-7 px-2.5"
              >
                Dívidas ({debtsCount})
              </Button>
            )}
            {advisorCount > 0 && (
              <Button
                type="button"
                variant={subFilter === "advisor" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSubFilter("advisor");
                }}
                className="text-xs h-7 px-2.5"
              >
                Avisos & Renda ({advisorCount})
              </Button>
            )}
          </div>
        )}

        {!hasAnyVisibleItem ? (
          <EmptyState
            icon={<Bell className="size-6" aria-hidden="true" />}
            title="Tudo em dia"
            description={getEmptyDescription()}
            tone="positive"
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {/* Alertas do Smart Advisor (ex.: Renda habitual prevista) */}
            {visibleAdvisorAlerts.map(renderAdvisorAlert)}

            {/* Lembretes de Faturas e Dívidas */}
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
                      stateKind={stateMap.get(item.key) ?? null}
                      onMarkRead={(key) => handle(key, { kind: "read" })}
                      onSnooze={snooze}
                      onRestore={(key) => handle(key, null)}
                      onSettle={handleSettle}
                      onOpen={() => openReminder(item)}
                    />
                  </HighlightRow>
                </div>
              );
            })}
          </div>
        )}

        {/* Nota informativa transparente sobre a janela de monitoramento */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border/80 bg-surface/50 px-3.5 py-2.5 text-xs text-muted-foreground mt-2">
          <span>
            Monitorando faturas e dívidas com vencimento nos próximos{" "}
            <strong className="text-foreground font-semibold">{preferences.billDaysBefore} dias</strong>.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs text-primary self-start sm:self-auto cursor-pointer"
            onClick={() => {
              triggerSensory("action");
              setIsSettingsOpen(true);
            }}
          >
            Ajustar antecedência
          </Button>
        </div>
      </div>
    );
  };

  const renderReadContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      );
    }
    if (readHistoryItems.length === 0) {
      return (
        <EmptyState
          icon={<CheckCheck className="size-6" aria-hidden="true" />}
          title="Histórico vazio"
          description="Nenhuma fatura ou dívida arquivada no histórico de lidos."
          tone="default"
        />
      );
    }
    return (
      <div className="flex flex-col gap-2.5">
        {readHistoryItems.map((item) => {
          const isMatch =
            highlightId &&
            (highlightId === item.key ||
              highlightId === item.link?.params?.q ||
              highlightId === item.link?.params?.debt);
          return (
            <HighlightRow
              key={item.key}
              highlightId={highlightId}
              id={isMatch ? highlightId : item.key}
              className="rounded-2xl"
            >
              <ReminderItem
                item={item}
                stateKind="read"
                onMarkRead={(key) => handle(key, { kind: "read" })}
                onSnooze={snooze}
                onRestore={(key) => handle(key, null)}
                onOpen={() => openReminder(item)}
              />
            </HighlightRow>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lembretes e Avisos"
        description="Faturas, compromissos e avisos inteligentes que precisam da sua atenção"
        badge={
          totalPendingEffective > 0 ? (
            <Badge variant={hasUrgentPending ? "critical" : "default"} size="sm">
              {totalPendingEffective} {totalPendingEffective === 1 ? "pendência" : "pendências"}
            </Badge>
          ) : undefined
        }
        actions={
          <>
            {unreadFilteredItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllRead}
                disabled={markAllMutation.isPending}
              >
                <CheckCheck className="size-4 mr-1.5 text-muted-foreground" aria-hidden="true" />
                Marcar todas como lidas
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                triggerSensory("action");
                setIsSettingsOpen(true);
              }}
              title="Configurar Lembretes e Antecedência"
            >
              <SlidersHorizontal className="size-4 mr-1.5 text-muted-foreground" aria-hidden="true" />
              Ajustes
            </Button>
          </>
        }
      />

      {permission.isReadOnlyMode && <ReadOnlyBanner />}

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
          action={
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                triggerSensory("action");
                setIsSettingsOpen(true);
              }}
            >
              Ativar lembretes
            </Button>
          }
        />
      ) : (
        <Tabs
          value={mainTab}
          onValueChange={(val) => {
            setMainTabOverride(val as MainTab);
            setSubFilter("all");
          }}
          variant="underline"
          swipeable
          items={[
            {
              value: "pending",
              label: totalPendingEffective > 0 ? `Pendentes (${totalPendingEffective})` : "Pendentes",
              icon: <Bell className="size-4" aria-hidden="true" />,
              content: renderPendingContent(),
            },
            {
              value: "read",
              label: readHistoryItems.length > 0 ? `Lidas (${readHistoryItems.length})` : "Lidas",
              icon: <CheckCheck className="size-4" aria-hidden="true" />,
              content: renderReadContent(),
            },
          ]}
        />
      )}

      <RemindersSettingsModal
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />

      {settleDebt && (
        <SettleDialog
          open={Boolean(settleDebt)}
          debt={settleDebt}
          onOpenChange={(next) => {
            if (!next) {
              setSettleDebt(null);
            }
          }}
        />
      )}

      {billPayment && (
        <PaymentDialog
          open={Boolean(billPayment)}
          cardId={billPayment.cardId}
          competenceMonth={billPayment.competenceMonth}
          mode="payment"
          openBalanceCents={billPayment.openBalanceCents}
          onOpenChange={(next) => {
            if (!next) {
              setBillPayment(null);
            }
          }}
        />
      )}

      {upgradeModal}
    </div>
  );
}
