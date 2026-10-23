import { useNavigate } from "react-router";
import { AlertTriangle, ArrowDownLeft, Bell, Check, CheckCheck, CreditCard, ExternalLink, HandCoins, Sparkles, X } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  MoneyText,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
} from "@/components/ui";
import { useOnboardingCounts, useReminders, useSetReminderState, useMarkAllRemindersAsRead } from "@/state";
import { useOnboardingDismissed } from "@/hooks";
import { shouldShowOnboardingBanner, coreOnboardingProgress } from "@/domain/onboarding";
import type { ReminderItem, ReminderStatus } from "@/domain/reminders";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import { useSmartAdvisorInsights } from "@/features/overview/hooks";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

const STATUS_VARIANTS: Record<ReminderStatus, "critical" | "warning" | "muted"> = {
  overdue: "critical",
  due_today: "warning",
  due_soon: "warning",
  pending: "muted",
};

const STATUS_LABELS: Record<ReminderStatus, string> = {
  overdue: "Vencido",
  due_today: "Vence hoje",
  due_soon: "Em breve",
  pending: "Pendente",
};

export interface NotificationsPopoverProps {
  children: React.ReactNode;
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
  const navigate = useNavigate();
  const { items, totalCount, urgentCount, isLoading } = useReminders();
  const onboardingQuery = useOnboardingCounts();
  const { isDismissed, dismiss } = useOnboardingDismissed();
  const setReminderStateMutation = useSetReminderState();
  const markAllMutation = useMarkAllRemindersAsRead();

  const advisorHook = useSmartAdvisorInsights({ enabled: propAdvisorAlerts === undefined });
  const advisorAlerts =
    propAdvisorAlerts ??
    advisorHook.insights.filter((i) => i.priority === 1 || i.priority === 2);
  const onDismissAdvisor = propOnDismissAdvisor ?? advisorHook.dismiss;

  const showOnboarding =
    !isDismissed && onboardingQuery?.data ? shouldShowOnboardingBanner(onboardingQuery.data) : false;
  const onboardingProg = onboardingQuery?.data ? coreOnboardingProgress(onboardingQuery.data) : { done: 0, total: 4 };

  const effectiveTotalCount = totalCount + (showOnboarding ? 1 : 0) + advisorAlerts.length;
  const hasUrgent = urgentCount > 0 || advisorAlerts.some((i) => i.priority === 1);

  const handleOpenItem = (item: ReminderItem) => {
    triggerSensory("action");
    onOpenChange?.(false);
    if (!item.link) {
      navigate("/lembretes");
      return;
    }
    const params = new URLSearchParams(item.link.params ?? {});
    navigate(`${item.link.path}?${params.toString()}`);
  };

  const handleOpenAdvisorAlert = (item: SmartAdvisorInsight) => {
    triggerSensory("action");
    onOpenChange?.(false);

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
    const forma = p?.forma;
    const cardId = p?.cardId ?? item.metadata?.cardId ?? item.cardContext?.cardId;

    if (name) params.set("descricao", name);
    if (valueCents) params.set("valor", String(valueCents));
    if (categoryId) params.set("categoria", categoryId);
    if (date) params.set("data", date);
    if (forma) params.set("forma", forma);
    if (cardId) params.set("cartao", cardId);

    navigate(`?${params.toString()}`);
  };

  const handleDismissAdvisor = (e: React.MouseEvent, themeKey: string) => {
    e.stopPropagation();
    triggerSensory("action");
    onDismissAdvisor(themeKey, 30);
  };

  const handleOpenOnboarding = () => {
    triggerSensory("action");
    onOpenChange?.(false);
    if (!onboardingQuery.data?.expenseCategories) {
      navigate("/categorias?type=expense");
    } else if (!onboardingQuery.data?.incomeCategories) {
      navigate("/categorias?type=income");
    } else if (!onboardingQuery.data?.cards) {
      navigate("/cartoes");
    } else {
      navigate("/transacoes?novo=transacao");
    }
  };

  const handleMarkRead = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    setReminderStateMutation.mutate({ occurrenceKey: key, state: { kind: "read" } });
  };

  const handleMarkAllRead = () => {
    const keys = items.map((i) => i.key);
    if (keys.length > 0) {
      markAllMutation.mutate(keys);
    }
  };

  const handleViewAll = () => {
    onOpenChange?.(false);
    navigate("/lembretes");
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 shadow-2xl rounded-2xl overflow-hidden border-border/90 bg-surface/95 backdrop-blur-md"
      >
        {/* Cabeçalho */}
        <header className="flex items-center justify-between border-b border-border/80 px-4 py-3 bg-surface/50">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Lembretes & Avisos</span>
            {effectiveTotalCount > 0 && (
              <Badge variant={hasUrgent ? "critical" : "muted"}>
                {effectiveTotalCount}
              </Badge>
            )}
          </div>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={handleMarkAllRead}
              disabled={markAllMutation.isPending}
              aria-label="Marcar todas como lidas"
            >
              <CheckCheck className="size-3.5 mr-1" aria-hidden="true" />
              Marcar lidas
            </Button>
          )}
        </header>

        {/* Lista de Notificações */}
        <div className="max-h-[22rem] overflow-y-auto divide-y divide-border/40 p-1">
          {isLoading ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : items.length === 0 && !showOnboarding && advisorAlerts.length === 0 ? (
            <div className="py-2 px-4">
              <EmptyState
                icon={<Bell className="size-5" aria-hidden="true" />}
                title="Tudo em dia"
                description="Nenhuma fatura ou pendência no momento."
                tone="positive"
                className="py-6 border-0 bg-transparent"
              />
            </div>
          ) : (
            <>
              {showOnboarding && (
                <div
                  onClick={handleOpenOnboarding}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleOpenOnboarding();
                    }
                  }}
                  className="group flex items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-surface-hover rounded-xl cursor-pointer"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                      <Sparkles className="size-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-xs truncate max-w-[11rem]">Configuração inicial</span>
                        <Badge variant="muted" size="xs">
                          {onboardingProg.done}/{onboardingProg.total} passos
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        Complete seus primeiros passos na conta.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0 shrink-0 opacity-80 group-hover:opacity-100 hover:bg-surface-active cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss();
                    }}
                    aria-label="Ignorar configuração inicial"
                    title="Dispensar aviso"
                  >
                    <X className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  </Button>
                </div>
              )}

              {/* Alertas Críticos e do Dia do Smart Advisor (§F29) */}
              {advisorAlerts.map((advisorItem) => {
                const isCritical = advisorItem.priority === 1;
                const isIncome = advisorItem.category === "income";
                const badgeVariant = isCritical ? "critical" : isIncome ? "positive" : "warning";
                const badgeLabel = isCritical ? "Crítico" : isIncome ? "Entrada" : "Vence hoje";
                const cardName = advisorItem.cardContext?.cardName ?? advisorItem.metadata?.cardName;

                return (
                  <div
                    key={advisorItem.id}
                    onClick={() => handleOpenAdvisorAlert(advisorItem)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleOpenAdvisorAlert(advisorItem);
                      }
                    }}
                    className="group flex items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-surface-hover rounded-xl cursor-pointer"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={cn(
                          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border",
                          isCritical
                            ? "border-danger-border bg-danger-surface text-danger-text"
                            : isIncome
                              ? "border-positive-border bg-positive-surface text-positive-text"
                              : "border-warning-border bg-warning-surface text-warning-text",
                        )}
                      >
                        {isCritical ? (
                          <AlertTriangle className="size-3.5" aria-hidden="true" />
                        ) : isIncome ? (
                          <ArrowDownLeft className="size-3.5" aria-hidden="true" />
                        ) : (
                          <CreditCard className="size-3.5" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-xs truncate max-w-[11rem]">{advisorItem.title}</span>
                          <Badge variant={badgeVariant} size="xs">
                            {badgeLabel}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                          {advisorItem.metadata?.valueCents !== undefined && (
                            <MoneyText
                              cents={advisorItem.metadata.valueCents}
                              className="font-semibold text-foreground text-xs"
                            />
                          )}
                          {cardName && <span>• {cardName}</span>}
                          {advisorItem.metadata?.valueCents === undefined && !cardName && (
                            <span className="truncate max-w-[13rem]">{advisorItem.description}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-7 p-0 shrink-0 opacity-80 group-hover:opacity-100 hover:bg-surface-active cursor-pointer"
                      onClick={(e) => handleDismissAdvisor(e, advisorItem.themeKey)}
                      aria-label={`Dispensar ${advisorItem.title}`}
                      title="Dispensar aviso por 30 dias"
                    >
                      <X className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    </Button>
                  </div>
                );
              })}

              {items.slice(0, 6).map((item) => {
                const Icon = item.kind === "bill" ? CreditCard : HandCoins;
                return (
                  <div
                    key={item.key}
                    onClick={() => handleOpenItem(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleOpenItem(item);
                      }
                    }}
                    className="group flex items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-surface-hover rounded-xl cursor-pointer"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={cn(
                          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border",
                          item.status === "overdue"
                            ? "border-danger-border bg-danger-surface text-danger-text"
                            : "border-border bg-surface text-muted-foreground",
                        )}
                      >
                        <Icon className="size-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-xs truncate max-w-[11rem]">{item.title}</span>
                          <Badge variant={STATUS_VARIANTS[item.status]}>
                            {STATUS_LABELS[item.status]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                          <MoneyText cents={item.amountCents} className="font-semibold text-foreground text-xs" />
                          {item.subtitle && <span>• {item.subtitle}</span>}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-7 p-0 shrink-0 opacity-80 group-hover:opacity-100 hover:bg-surface-active"
                      onClick={(e) => handleMarkRead(e, item.key)}
                      aria-label={`Marcar ${item.title} como lido`}
                      title="Marcar como lido"
                    >
                      <Check className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    </Button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Rodapé */}
        <footer className="border-t border-border/80 p-2 bg-surface/50 flex items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs font-medium text-primary hover:text-primary-hover hover:bg-primary/10"
            onClick={handleViewAll}
          >
            Ver todos os lembretes
            <ExternalLink className="size-3 ml-1.5" aria-hidden="true" />
          </Button>
        </footer>
      </PopoverContent>
    </Popover>
  );
}
