import {
  AlertTriangle,
  ArrowDownLeft,
  Check,
  CreditCard,
  HandCoins,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import type { ReminderItem, ReminderStatus } from "@/domain/reminders";
import {
  resolveSmartAdvisorPresentation,
  type AdvisorIconKind,
} from "@/features/overview/components/smart-advisor/smart-advisor-routing";
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

const ADVISOR_ICON_MAP: Record<AdvisorIconKind, typeof AlertTriangle> = {
  household: Users,
  aporte: TrendingUp,
  critical: AlertTriangle,
  income: ArrowDownLeft,
  savings: TrendingDown,
  calibration: HelpCircle,
};

const BADGE_CONTAINER_TONES: Record<
  "critical" | "muted" | "portfolio" | "positive" | "warning",
  string
> = {
  critical: "border-critical/20 bg-critical/10 text-critical-strong",
  positive: "border-positive/20 bg-positive/10 text-positive-strong",
  portfolio: "border-portfolio/20 bg-portfolio/10 text-portfolio",
  warning: "border-warning/20 bg-warning/15 text-warning-strong",
  muted: "border-border/80 bg-surface text-muted-foreground",
};

export function AdvisorNotificationRow({
  advisorItem,
  onOpen,
  onDismiss,
}: {
  advisorItem: SmartAdvisorInsight;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const presentation = resolveSmartAdvisorPresentation(advisorItem);
  const Icon = ADVISOR_ICON_MAP[presentation.iconKind];
  const cardName = advisorItem.cardContext?.cardName ?? advisorItem.metadata?.cardName;

  const handleActivate = () => {
    triggerSensory("action");
    onOpen();
  };

  return (
    <div className="group flex items-center justify-between gap-2 p-2.5 text-left transition-colors hover:bg-surface-hover rounded-xl">
      <div
        onClick={handleActivate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleActivate();
          }
        }}
        className="flex items-start gap-2.5 min-w-0 flex-1 cursor-pointer rounded-lg p-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border",
            BADGE_CONTAINER_TONES[presentation.badgeVariant],
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-xs text-foreground line-clamp-1 break-words">
              {advisorItem.title}
            </span>
            <Badge variant={presentation.badgeVariant} size="xs" className="shrink-0">
              {presentation.badgeLabel}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
            {advisorItem.metadata?.valueCents !== undefined ? (
              <MoneyText
                cents={advisorItem.metadata.valueCents}
                tone="default"
                className="font-semibold text-foreground text-xs"
              />
            ) : null}
            {cardName ? (
              <span
                className={cn(
                  "truncate",
                  advisorItem.metadata?.valueCents !== undefined && "border-l border-border/80 pl-1.5",
                )}
              >
                {cardName}
              </span>
            ) : null}
            {advisorItem.metadata?.valueCents === undefined && !cardName ? (
              <span className="line-clamp-1">{advisorItem.description}</span>
            ) : null}
          </div>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        sensoryIntent="selection"
        className="size-8 max-sm:min-h-11 max-sm:min-w-11 shrink-0 opacity-80 group-hover:opacity-100 hover:bg-surface-active text-muted-foreground hover:text-foreground"
        onClick={onDismiss}
        aria-label={`Dispensar ${advisorItem.title}`}
        title="Dispensar aviso por 30 dias"
      >
        <X className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function ReminderNotificationRow({
  item,
  onOpen,
  onMarkRead,
}: {
  item: ReminderItem;
  onOpen: () => void;
  onMarkRead: () => void;
}) {
  const Icon = item.kind === "bill" ? CreditCard : HandCoins;
  const isReceivable = item.direction === "receivable";
  const badgeVariant = isReceivable ? "portfolio" : STATUS_VARIANTS[item.status];
  const badgeLabel = isReceivable ? "A receber" : STATUS_LABELS[item.status];

  const handleActivate = () => {
    triggerSensory("action");
    onOpen();
  };

  return (
    <div className="group flex items-center justify-between gap-2 p-2.5 text-left transition-colors hover:bg-surface-hover rounded-xl">
      <div
        onClick={handleActivate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleActivate();
          }
        }}
        className="flex items-start gap-2.5 min-w-0 flex-1 cursor-pointer rounded-lg p-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border",
            isReceivable
              ? "border-portfolio/20 bg-portfolio/10 text-portfolio"
              : item.status === "overdue"
                ? "border-critical/20 bg-critical/10 text-critical-strong"
                : "border-border/80 bg-surface text-muted-foreground",
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-xs text-foreground line-clamp-1 break-words">
              {item.title}
            </span>
            <Badge variant={badgeVariant} size="xs" className="shrink-0">
              {badgeLabel}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
            <MoneyText cents={item.amountCents} tone="default" className="font-semibold text-foreground text-xs" />
            {item.subtitle ? (
              <span className="truncate border-l border-border/80 pl-1.5">{item.subtitle}</span>
            ) : null}
          </div>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        sensoryIntent="success"
        className="size-8 max-sm:min-h-11 max-sm:min-w-11 shrink-0 opacity-80 group-hover:opacity-100 hover:bg-surface-active text-muted-foreground hover:text-foreground"
        onClick={onMarkRead}
        aria-label={`Marcar ${item.title} como lido`}
        title="Marcar como lido"
      >
        <Check className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
