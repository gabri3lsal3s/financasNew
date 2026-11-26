import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CreditCard,
  HandCoins,
  LifeBuoy,
  Megaphone,
  ShieldAlert,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import type {
  BudgetOverrunAlert,
  ClosedCardBillAlert,
  DividendNotificationAlert,
  PendingSplitSignalSummary,
  TripFamilyAlert,
} from "@/domain/notifications/hub";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import type { SupportTicket, UserBroadcastNotification } from "@/types";

export function BroadcastNotificationRow({
  broadcast,
  onOpen,
  onMarkRead,
  onDismiss,
}: {
  broadcast: UserBroadcastNotification;
  onOpen: () => void;
  onMarkRead?: () => void;
  onDismiss?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const isCritical = broadcast.type === "critical";
  const isWarning = broadcast.type === "warning";
  const isPromo = broadcast.type === "promotion";
  const isSystem = broadcast.type === "system";

  const Icon = isCritical || isWarning ? AlertTriangle : isPromo ? Sparkles : Megaphone;
  const badgeVariant = isCritical
    ? "critical"
    : isWarning
      ? "warning"
      : isPromo
        ? "portfolio"
        : "default";
  const badgeLabel = isCritical
    ? "Urgente"
    : isWarning
      ? "Importante"
      : isPromo
        ? "Novidade"
        : isSystem
          ? "Sistema"
          : "Comunicado";

  const containerTone = isCritical
    ? "bg-critical/5 border-critical/20"
    : isWarning
      ? "bg-warning/10 border-warning/20"
      : isPromo
        ? "bg-portfolio/5 border-portfolio/20"
        : "bg-surface border-border/80";

  const iconTone = isCritical
    ? "border-critical/20 bg-critical/10 text-critical-strong"
    : isWarning
      ? "border-warning/20 bg-warning/15 text-warning-strong"
      : isPromo
        ? "border-portfolio/20 bg-portfolio/10 text-portfolio"
        : "border-border/80 bg-surface text-muted-foreground";

  const handleActivate = () => {
    triggerSensory("action");
    if (!broadcast.action_url) {
      setExpanded((prev) => !prev);
      return;
    }
    onOpen();
  };

  return (
    <div
      className={cn(
        "group flex items-start justify-between gap-2 p-2.5 text-left transition-colors hover:bg-surface-hover rounded-xl border",
        containerTone,
      )}
    >
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
        className="flex items-start gap-2.5 flex-1 min-w-0 cursor-pointer rounded-lg p-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border",
            iconTone,
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-foreground line-clamp-2 break-words">
              {broadcast.title}
            </span>
            <Badge variant={badgeVariant} size="xs" className="shrink-0">
              {badgeLabel}
            </Badge>
          </div>
          <p
            className={cn(
              "text-[11px] text-muted-foreground leading-relaxed",
              expanded ? "whitespace-pre-line" : "line-clamp-2",
            )}
          >
            {broadcast.message}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {!broadcast.action_url && onMarkRead ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            sensoryIntent="success"
            className="size-8 max-sm:min-h-11 max-sm:min-w-11 shrink-0 opacity-80 group-hover:opacity-100 hover:bg-surface-active text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead();
            }}
            aria-label={`Marcar comunicado ${broadcast.title} como lido`}
            title="Marcar como lido"
          >
            <Check className="size-3.5" aria-hidden="true" />
          </Button>
        ) : null}

        {onDismiss ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            sensoryIntent="selection"
            className="size-8 max-sm:min-h-11 max-sm:min-w-11 shrink-0 opacity-80 group-hover:opacity-100 hover:bg-surface-active text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            aria-label={`Dispensar comunicado ${broadcast.title}`}
            title="Dispensar comunicado"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function SupportReplyRow({
  ticket,
  onOpen,
}: {
  ticket: SupportTicket;
  onOpen: () => void;
}) {
  const handleActivate = () => {
    triggerSensory("action");
    onOpen();
  };

  return (
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
      className="group flex items-start gap-2.5 p-2.5 text-left transition-colors hover:bg-surface-hover rounded-xl cursor-pointer bg-surface border border-border/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface text-muted-foreground">
        <LifeBuoy className="size-3.5" aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground line-clamp-2 break-words">
            Resposta do Suporte Axir
          </span>
          <Badge variant="warning" size="xs" className="shrink-0">
            Novo
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          {ticket.admin_reply || ticket.subject}
        </p>
      </div>
    </div>
  );
}

export function SplitSignalNotificationRow({
  signalGroup,
  onOpen,
}: {
  signalGroup: PendingSplitSignalSummary;
  onOpen: () => void;
}) {
  const handleActivate = () => {
    triggerSensory("action");
    onOpen();
  };

  const description =
    signalGroup.signals.length === 1
      ? `${signalGroup.signals[0]!.participant_name} sinalizou um pagamento via Pix.`
      : `${signalGroup.signals.length} participantes sinalizaram pagamento via Pix.`;

  return (
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
      className="group flex items-start justify-between gap-2.5 p-2.5 text-left transition-colors hover:bg-surface-hover rounded-xl cursor-pointer bg-portfolio/5 border border-portfolio/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-portfolio/20 bg-portfolio/10 text-portfolio">
          <HandCoins className="size-3.5" aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-foreground line-clamp-2 break-words">
              {signalGroup.title}
            </span>
            <Badge variant="portfolio" size="xs" className="shrink-0">
              Pix Sinalizado
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="line-clamp-2 break-words">{description}</span>
            {signalGroup.totalCents > 0 ? (
              <MoneyText
                cents={signalGroup.totalCents}
                tone="default"
                className="text-[11px] font-semibold"
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionPastDueRow({ onOpen }: { onOpen: () => void }) {
  const handleActivate = () => {
    triggerSensory("action");
    onOpen();
  };

  return (
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
      className="group flex items-start gap-2.5 p-2.5 text-left transition-colors hover:bg-surface-hover rounded-xl cursor-pointer bg-critical/5 border border-critical/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-critical/20 bg-critical/10 text-critical-strong">
        <ShieldAlert className="size-3.5" aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground line-clamp-2 break-words">
            Pagamento da assinatura pendente
          </span>
          <Badge variant="critical" size="xs" className="shrink-0">
            Assinatura
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          Regularize o método de pagamento para manter os recursos Pro ativos.
        </p>
      </div>
    </div>
  );
}

export function OnboardingNotificationRow({
  done,
  total,
  onOpen,
  onDismiss,
}: {
  done: number;
  total: number;
  onOpen: () => void;
  onDismiss: () => void;
}) {
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
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface text-muted-foreground">
          <Sparkles className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-xs text-foreground line-clamp-2 break-words">
              Configuração inicial
            </span>
            <Badge variant="muted" size="xs" className="shrink-0">
              {done}/{total} passos
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 break-words">
            Complete seus primeiros passos na conta.
          </p>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        sensoryIntent="selection"
        className="size-8 max-sm:min-h-11 max-sm:min-w-11 shrink-0 opacity-80 group-hover:opacity-100 hover:bg-surface-active text-muted-foreground hover:text-foreground"
        onClick={onDismiss}
        aria-label="Ignorar configuração inicial"
        title="Dispensar aviso"
      >
        <X className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function ClosedBillNotificationRow({
  alert,
  onOpen,
  onMarkRead,
}: {
  alert: ClosedCardBillAlert;
  onOpen: () => void;
  onMarkRead?: () => void;
}) {
  const handleActivate = () => {
    triggerSensory("action");
    onOpen();
  };

  return (
    <div className="group flex items-center justify-between gap-2 p-2.5 text-left transition-colors hover:bg-surface-hover rounded-xl border border-border/80 bg-surface">
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
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface text-muted-foreground">
          <CreditCard className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-xs text-foreground line-clamp-2 break-words">
              Fatura {alert.cardName} fechada
            </span>
            <Badge variant="default" size="xs" className="shrink-0">
              Fatura fechada
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
            <MoneyText cents={alert.balanceCents} tone="default" className="font-semibold text-foreground text-xs" />
            <span className="truncate border-l border-border/80 pl-1.5">
              Vencimento em {alert.dueDate.split("-").reverse().slice(0, 2).join("/")}
            </span>
          </div>
        </div>
      </div>

      {onMarkRead ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          sensoryIntent="success"
          className="size-8 max-sm:min-h-11 max-sm:min-w-11 shrink-0 opacity-80 group-hover:opacity-100 hover:bg-surface-active text-muted-foreground hover:text-foreground"
          onClick={onMarkRead}
          aria-label={`Marcar fatura fechada ${alert.cardName} como lida`}
          title="Marcar como lida"
        >
          <Check className="size-3.5" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

export function BudgetOverrunNotificationRow({
  alert,
  onOpen,
  onMarkRead,
}: {
  alert: BudgetOverrunAlert;
  onOpen: () => void;
  onMarkRead?: () => void;
}) {
  const handleActivate = () => {
    triggerSensory("action");
    onOpen();
  };

  const title =
    alert.exceededCount === 1
      ? `Orçamento excedido (${alert.topCategories[0]?.categoryName ?? "Categoria"})`
      : `${alert.exceededCount} orçamentos excedidos no mês`;
  const names = alert.topCategories.map((c) => c.categoryName).join(", ");

  return (
    <div className="group flex items-center justify-between gap-2 p-2.5 text-left transition-colors hover:bg-surface-hover rounded-xl border border-warning/20 bg-warning/10">
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
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-warning/20 bg-warning/15 text-warning-strong">
          <AlertTriangle className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-xs text-foreground line-clamp-2 break-words">
              {title}
            </span>
            <Badge variant="warning" size="xs" className="shrink-0">
              Orçamento
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
            <MoneyText cents={alert.totalExcessCents} tone="default" className="font-semibold text-foreground text-xs" />
            <span className="truncate border-l border-border/80 pl-1.5">
              acima do teto ({names})
            </span>
          </div>
        </div>
      </div>

      {onMarkRead ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          sensoryIntent="success"
          className="size-8 max-sm:min-h-11 max-sm:min-w-11 shrink-0 opacity-80 group-hover:opacity-100 hover:bg-surface-active text-muted-foreground hover:text-foreground"
          onClick={onMarkRead}
          aria-label="Marcar alerta de orçamento como lido"
          title="Marcar como lido"
        >
          <Check className="size-3.5" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

export function TripFamilyNotificationRow({
  alert,
  onOpen,
  onMarkRead,
}: {
  alert: TripFamilyAlert;
  onOpen: () => void;
  onMarkRead?: () => void;
}) {
  const handleActivate = () => {
    triggerSensory("action");
    onOpen();
  };

  const isPassive =
    alert.kind === "family_invite" ||
    (alert.kind === "trip_settlement" && alert.settlementPending === false);

  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-2 p-2.5 text-left transition-colors hover:bg-surface-hover rounded-xl border",
        isPassive ? "border-border/80 bg-surface" : "border-warning/20 bg-warning/5",
      )}
    >
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
            isPassive
              ? "border-border/80 bg-surface text-muted-foreground"
              : "border-warning/20 bg-warning/15 text-warning-strong",
          )}
        >
          <Users className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-xs text-foreground line-clamp-2 break-words">
              {alert.title}
            </span>
            <Badge
              variant={isPassive ? "default" : "warning"}
              size="xs"
              className="shrink-0"
            >
              {alert.badgeLabel}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
            {alert.body}
          </p>
        </div>
      </div>

      {onMarkRead ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          sensoryIntent="success"
          className="size-8 max-sm:min-h-11 max-sm:min-w-11 shrink-0 opacity-80 group-hover:opacity-100 hover:bg-surface-active text-muted-foreground hover:text-foreground"
          onClick={onMarkRead}
          aria-label={`Marcar ${alert.title} como lido`}
          title="Marcar como lido"
        >
          <Check className="size-3.5" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

export function DividendNotificationRow({
  alert,
  onOpen,
  onMarkRead,
}: {
  alert: DividendNotificationAlert;
  onOpen: () => void;
  onMarkRead?: () => void;
}) {
  const handleActivate = () => {
    triggerSensory("action");
    onOpen();
  };

  const isPending = alert.kind === "pending_confirmation";
  const isSettled = alert.kind === "settled";
  const badgeVariant = isPending ? "warning" : isSettled ? "positive" : "portfolio";
  const containerTone = isPending
    ? "border-warning/20 bg-warning/5"
    : isSettled
      ? "border-positive/20 bg-positive/5"
      : "border-portfolio/20 bg-portfolio/5";
  const iconTone = isPending
    ? "border-warning/20 bg-warning/15 text-warning-strong"
    : isSettled
      ? "border-positive/20 bg-positive/10 text-positive-strong"
      : "border-portfolio/20 bg-portfolio/10 text-portfolio";

  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-2 p-2.5 text-left transition-colors hover:bg-surface-hover rounded-xl border",
        containerTone,
      )}
    >
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
            iconTone,
          )}
        >
          <HandCoins className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-xs text-foreground line-clamp-2 break-words">
              {alert.title}
            </span>
            <Badge variant={badgeVariant} size="xs" className="shrink-0">
              {alert.badgeLabel}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
            {alert.totalBRLCents > 0 ? (
              <MoneyText
                cents={alert.totalBRLCents}
                variant="caption"
                tone={isSettled ? "positive" : "default"}
                className={cn("font-semibold text-xs", !isSettled && "text-foreground")}
              />
            ) : null}
            <span className={cn("line-clamp-2", alert.totalBRLCents > 0 && "border-l border-border/80 pl-1.5")}>
              {alert.body}
            </span>
          </div>
        </div>
      </div>

      {onMarkRead ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          sensoryIntent="success"
          className="size-8 max-sm:min-h-11 max-sm:min-w-11 shrink-0 opacity-80 group-hover:opacity-100 hover:bg-surface-active text-muted-foreground hover:text-foreground"
          onClick={onMarkRead}
          aria-label={`Marcar ${alert.title} como lido`}
          title="Marcar como lido"
        >
          <Check className="size-3.5" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
