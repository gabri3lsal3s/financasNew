import { AlarmClock, Bell, Check, CreditCard, HandCoins } from "lucide-react";
import { Badge } from "@/components/ui";
import type { ReminderItem as ReminderItemData, ReminderStatus } from "@/domain/reminders";
import { formatCentsAsBRL } from "@/services/masks/money";
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
  /** Estado atual (para rotular os botões). */
  stateKind?: "read" | "snoozed" | null;
}

/** Item de lembrete da central (§3.10) — status + ações lido/snooze. */
export function ReminderItem({ item, onMarkRead, onSnooze, onRestore, stateKind }: ReminderItemProps) {
  const Icon = item.kind === "bill" ? CreditCard : HandCoins;
  return (
    <article className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            item.kind === "bill" ? "bg-portfolio/12 text-portfolio" : "bg-primary/12 text-primary-strong",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
            <Badge variant={STATUS_VARIANTS[item.status]}>{STATUS_LABELS[item.status]}</Badge>
            {stateKind === "snoozed" ? <Badge variant="muted">Adiado</Badge> : null}
          </div>
          {item.subtitle ? <p className="text-xs text-muted-foreground">{item.subtitle}</p> : null}
          <p className="text-xs text-muted-foreground">
            Vence em <span className="num font-medium text-foreground">{item.dueDate}</span>
            {item.amountCents > 0 ? (
              <>
                {" "}· <span className="num font-medium text-foreground">{formatCentsAsBRL(item.amountCents)}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {stateKind === "snoozed" ? (
          <button
            type="button"
            onClick={() => onRestore?.(item.key)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Restaurar lembrete ${item.title}`}
          >
            <Bell className="size-3.5" aria-hidden="true" />
            Restaurar
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onSnooze?.(item.key)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Adiar lembrete ${item.title}`}
            >
              <AlarmClock className="size-3.5" aria-hidden="true" />
              Adiar
            </button>
            <button
              type="button"
              onClick={() => onMarkRead?.(item.key)}
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
