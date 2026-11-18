import { LifeBuoy, Megaphone, Sparkles, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import type { SupportTicket, UserBroadcastNotification } from "@/types";

export function BroadcastNotificationRow({
  broadcast,
  onOpen,
}: {
  broadcast: UserBroadcastNotification;
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
      className="group flex items-start gap-3 p-3 text-left transition-colors hover:bg-surface-hover rounded-xl cursor-pointer bg-primary/5 border border-primary/20 mb-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong mt-0.5">
        <Megaphone className="size-4" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground line-clamp-1 break-words">
            {broadcast.title}
          </span>
          <Badge variant="default" size="xs" className="shrink-0">
            Comunicado
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          {broadcast.message}
        </p>
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
      className="group flex items-start gap-3 p-3 text-left transition-colors hover:bg-surface-hover rounded-xl cursor-pointer bg-primary/5 border border-primary/20 mb-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong mt-0.5">
        <LifeBuoy className="size-4" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground line-clamp-1 break-words">
            Resposta do Suporte Axir
          </span>
          <Badge variant="warning" size="xs" className="shrink-0">
            Novo
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          {ticket.admin_reply}
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
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary-strong">
          <Sparkles className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-xs text-foreground line-clamp-1 break-words">
              Configuração inicial
            </span>
            <Badge variant="muted" size="xs" className="shrink-0">
              {done}/{total} passos
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
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
