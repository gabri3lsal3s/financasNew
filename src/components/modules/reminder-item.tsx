import { AlarmClock, Bell, Check, CheckCircle2, CreditCard, HandCoins, RotateCcw } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import type { ReminderItem as ReminderItemData, ReminderStatus } from "@/domain/reminders";
import { formatDateBR } from "@/lib/date";
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

export interface ReminderItemProps {
  item: ReminderItemData;
  onMarkRead?: (key: string) => void;
  onSnooze?: (key: string) => void;
  onRestore?: (key: string) => void;
  onSettle?: (item: ReminderItemData) => void;
  onOpen?: () => void;
  stateKind?: "read" | "snoozed" | null;
}

/** Item de lembrete da central (§3.10) — status + ações lido/snooze/reabrir. */
export function ReminderItem({
  item,
  onMarkRead,
  onSnooze,
  onRestore,
  onSettle,
  onOpen,
  stateKind,
}: ReminderItemProps) {
  const Icon = item.kind === "bill" ? CreditCard : HandCoins;
  const isRead = stateKind === "read";
  const isReceivable = item.direction === "receivable";
  const clickable = onOpen !== undefined;
  const badgeVariant = isRead ? "muted" : isReceivable ? "portfolio" : STATUS_VARIANTS[item.status];
  const badgeLabel = isReceivable ? "A receber" : STATUS_LABELS[item.status];
  const settleLabel =
    item.kind === "bill"
      ? "Pagar Fatura"
      : isReceivable
        ? "Registrar Recebimento"
        : "Dar Baixa";
  const settleAriaLabel =
    item.kind === "bill"
      ? `Pagar fatura ${item.title}`
      : isReceivable
        ? `Registrar recebimento ${item.title}`
        : `Dar baixa ${item.title}`;

  const handleOpen = () => {
    if (!onOpen) return;
    triggerSensory("action");
    onOpen();
  };

  return (
    <article
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs min-w-0 overflow-hidden",
        isRead && "opacity-75 bg-surface-raised/60",
      )}
    >
      <div
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-label={clickable ? `Abrir ${item.title}` : undefined}
        onClick={clickable ? handleOpen : undefined}
        onKeyDown={
          clickable
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleOpen();
                }
              }
            : undefined
        }
        className={cn(
          "flex items-start gap-3 min-w-0 flex-1 rounded-lg p-1 -m-1",
          clickable &&
            "cursor-pointer transition-colors hover:bg-surface-hover/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center mt-0.5",
            isRead
              ? "text-muted-foreground"
              : item.kind === "bill"
                ? "text-portfolio"
                : "text-muted-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>

        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <h3
              className={cn(
                "text-sm font-semibold line-clamp-2 break-words min-w-0",
                isRead ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {item.title}
            </h3>
            <Badge
              variant={badgeVariant}
              size="xs"
              className="shrink-0 max-w-full truncate"
            >
              {badgeLabel}
            </Badge>
            {stateKind === "snoozed" ? (
              <Badge variant="muted" size="xs" className="shrink-0">
                Adiado
              </Badge>
            ) : null}
            {isRead ? (
              <Badge variant="muted" size="xs" className="shrink-0">
                Lido
              </Badge>
            ) : null}
          </div>

          {item.subtitle && item.subtitle !== badgeLabel ? (
            <p className="text-xs text-muted-foreground line-clamp-1 break-words">{item.subtitle}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              {isReceivable ? "Previsto para " : "Vence em "}
              <span className="num font-medium text-foreground">{formatDateBR(item.dueDate)}</span>
            </span>
            {item.amountCents > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="text-muted-foreground/60">·</span>
                <MoneyText cents={item.amountCents} tone="default" className="text-xs font-semibold" />
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap sm:flex-nowrap shrink-0 items-center gap-1.5 self-end sm:self-center">
        {stateKind === "snoozed" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            sensoryIntent="action"
            onClick={() => onRestore?.(item.key)}
            className="h-8 max-sm:min-h-11 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            aria-label={`Restaurar lembrete ${item.title}`}
          >
            <Bell className="size-3.5" aria-hidden="true" />
            <span>Restaurar</span>
          </Button>
        ) : isRead ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            sensoryIntent="action"
            onClick={() => onRestore?.(item.key)}
            className="h-8 max-sm:min-h-11 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            aria-label={`Reabrir lembrete ${item.title}`}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span>Reabrir</span>
          </Button>
        ) : (
          <>
            {onSettle ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => onSettle(item)}
                className="h-8 max-sm:min-h-11 px-2.5 text-xs font-semibold gap-1.5 shrink-0"
                aria-label={settleAriaLabel}
              >
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                <span>{settleLabel}</span>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              sensoryIntent="selection"
              onClick={() => onSnooze?.(item.key)}
              className="h-8 max-sm:min-h-11 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              aria-label={`Adiar lembrete ${item.title}`}
            >
              <AlarmClock className="size-3.5" aria-hidden="true" />
              <span>Adiar</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              sensoryIntent="success"
              onClick={() => onMarkRead?.(item.key)}
              className="h-8 max-sm:min-h-11 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              aria-label={`Marcar como lido ${item.title}`}
              title="Apenas marcar como lido sem liquidar financeiramente"
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span>Arquivar</span>
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
