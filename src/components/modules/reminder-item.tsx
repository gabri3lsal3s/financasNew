import { AlarmClock, Bell, Check, CreditCard, HandCoins, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import type { ReminderItem as ReminderItemData, ReminderStatus } from "@/domain/reminders";
import { cn } from "@/lib/utils";

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
  /** Callbacks opcionais — a tela decide o que renderizar. */
  onMarkRead?: (key: string) => void;
  onSnooze?: (key: string) => void;
  onRestore?: (key: string) => void;
  /** Abre o item na tela de destino (deep-link do lembrete). */
  onOpen?: () => void;
  /** Estado atual (para rotular os botões). */
  stateKind?: "read" | "snoozed" | null;
}

/** Item de lembrete da central (§3.10) — status + ações lido/snooze/reabrir. */
export function ReminderItem({ item, onMarkRead, onSnooze, onRestore, onOpen, stateKind }: ReminderItemProps) {
  const Icon = item.kind === "bill" ? CreditCard : HandCoins;
  const isRead = stateKind === "read";
  const clickable = onOpen !== undefined;
  return (
    <article
      className={cn(
        "flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4 min-w-0 overflow-hidden",
        isRead && "opacity-80 bg-surface/60",
        clickable && "cursor-pointer transition-colors hover:bg-surface-hover",
      )}
      onClick={clickable ? onOpen : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen?.();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center",
            isRead
              ? "text-muted-foreground"
              : item.kind === "bill"
                ? "text-portfolio"
                : "text-primary-strong",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h3 className={cn("text-sm font-semibold truncate min-w-0", isRead ? "text-muted-foreground" : "text-foreground")}>
              {item.title}
            </h3>
            <Badge variant={isRead ? "muted" : STATUS_VARIANTS[item.status]} className="shrink-0">
              {STATUS_LABELS[item.status]}
            </Badge>
            {stateKind === "snoozed" ? <Badge variant="muted" className="shrink-0">Adiado</Badge> : null}
            {isRead ? <Badge variant="muted" className="shrink-0">Lido</Badge> : null}
          </div>
          {item.subtitle ? <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p> : null}
          <p className="text-xs text-muted-foreground truncate">
            Vence em <span className="num font-medium text-foreground">{item.dueDate}</span>
            {item.amountCents > 0 ? (
              <>
                {" "}· <MoneyText cents={item.amountCents} tone="default" className="text-xs" />
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {stateKind === "snoozed" ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRestore?.(item.key);
            }}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Restaurar lembrete ${item.title}`}
          >
            <Bell className="size-3.5" aria-hidden="true" />
            Restaurar
          </button>
        ) : isRead ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRestore?.(item.key);
            }}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Reabrir lembrete ${item.title}`}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Reabrir
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSnooze?.(item.key);
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Adiar lembrete ${item.title}`}
            >
              <AlarmClock className="size-3.5" aria-hidden="true" />
              Adiar
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead?.(item.key);
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              aria-label={`Marcar como lido ${item.title}`}
            >
              <Check className="size-3.5" aria-hidden="true" />
              Concluído
            </button>
          </>
        )}
      </div>
    </article>
  );
}
