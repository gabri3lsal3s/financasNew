import { useNavigate } from "react-router";
import { Bell, Check, CheckCheck, CreditCard, ExternalLink, HandCoins, Sparkles, X } from "lucide-react";
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
import { isOnboardingComplete, onboardingProgress } from "@/domain/onboarding";
import type { ReminderItem, ReminderStatus } from "@/domain/reminders";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/services/haptics";

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
}

export function NotificationsPopover({ children, open, onOpenChange }: NotificationsPopoverProps) {
  const navigate = useNavigate();
  const { items, totalCount, urgentCount, isLoading } = useReminders();
  const onboardingQuery = useOnboardingCounts();
  const { isDismissed, dismiss } = useOnboardingDismissed();
  const setReminderStateMutation = useSetReminderState();
  const markAllMutation = useMarkAllRemindersAsRead();

  const showOnboarding =
    !isDismissed && onboardingQuery?.data ? !isOnboardingComplete(onboardingQuery.data) : false;
  const onboardingProg = onboardingQuery?.data ? onboardingProgress(onboardingQuery.data) : { done: 0, total: 4 };

  const effectiveTotalCount = totalCount + (showOnboarding ? 1 : 0);

  const handleOpenItem = (item: ReminderItem) => {
    triggerHaptic("light");
    onOpenChange?.(false);
    if (!item.link) {
      navigate("/lembretes");
      return;
    }
    const params = new URLSearchParams(item.link.params ?? {});
    navigate(`${item.link.path}?${params.toString()}`);
  };

  const handleOpenOnboarding = () => {
    triggerHaptic("light");
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
    triggerHaptic("medium");
    setReminderStateMutation.mutate({ occurrenceKey: key, state: { kind: "read" } });
  };

  const handleMarkAllRead = () => {
    triggerHaptic("medium");
    const keys = items.map((i) => i.key);
    if (keys.length > 0) {
      markAllMutation.mutate(keys);
    }
  };

  const handleViewAll = () => {
    triggerHaptic("light");
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
              <Badge variant={urgentCount > 0 ? "critical" : "muted"}>
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
          ) : items.length === 0 && !showOnboarding ? (
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
                      triggerHaptic("medium");
                      dismiss();
                    }}
                    aria-label="Ignorar configuração inicial"
                    title="Dispensar aviso"
                  >
                    <X className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  </Button>
                </div>
              )}

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
