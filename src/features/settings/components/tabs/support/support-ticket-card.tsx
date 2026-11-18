import {
  Bug,
  Check,
  CheckCircle2,
  Clock,
  HelpCircle,
  Lightbulb,
  MessageSquare,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { SupportTicket, SupportTicketStatus, SupportTicketType } from "@/types";

const STATUS_CONFIG: Record<
  SupportTicketStatus,
  { label: string; badgeVariant: "warning" | "default" | "muted" }
> = {
  open: { label: "Aberto", badgeVariant: "warning" },
  in_progress: { label: "Em Atendimento", badgeVariant: "default" },
  resolved: { label: "Resolvido", badgeVariant: "muted" },
  closed: { label: "Encerrado", badgeVariant: "muted" },
};

const TYPE_CONFIG: Record<
  SupportTicketType,
  { label: string; icon: typeof HelpCircle }
> = {
  doubt: { label: "Dúvida", icon: HelpCircle },
  bug: { label: "Problema (Bug)", icon: Bug },
  suggestion: { label: "Sugestão", icon: Lightbulb },
  other: { label: "Outro", icon: MessageSquare },
};

export interface SupportTicketCardProps {
  ticket: SupportTicket;
  isMarkingRead: boolean;
  onMarkRead: (ticketId: string) => void;
}

export function SupportTicketCard({
  ticket,
  isMarkingRead,
  onMarkRead,
}: SupportTicketCardProps) {
  const hasReply = Boolean(ticket.admin_reply);
  const isUnread = hasReply && !ticket.user_read_at;
  const typeInfo = TYPE_CONFIG[ticket.type] || TYPE_CONFIG.other;
  const TypeIcon = typeInfo.icon;
  const statusInfo = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 sm:p-5 transition-colors",
        isUnread
          ? "border-primary/40 bg-primary/5"
          : "border-border/80 bg-surface-raised/50",
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/80 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <TypeIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs font-semibold text-foreground truncate">
            {ticket.subject || typeInfo.label}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {isUnread ? (
            <Badge variant="warning" size="xs">
              Nova Resposta
            </Badge>
          ) : null}
          <Badge variant={statusInfo.badgeVariant} size="xs">
            {statusInfo.label}
          </Badge>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {new Date(ticket.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })}
          </span>
        </div>
      </div>

      <div className="py-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
        <span className="font-semibold text-foreground">Sua mensagem: </span>
        {ticket.message}
      </div>

      {hasReply ? (
        <div className="rounded-xl border border-primary/25 bg-surface p-3.5 mt-1 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <CheckCircle2 className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
              <span>Resposta da Equipe Axir:</span>
            </div>
            {ticket.admin_replied_at ? (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums shrink-0">
                <Clock className="size-3" aria-hidden="true" />
                <span>
                  {new Date(ticket.admin_replied_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ) : null}
          </div>
          <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
            {ticket.admin_reply}
          </p>

          {isUnread ? (
            <div className="pt-1 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                sensoryIntent="selection"
                onClick={() => onMarkRead(ticket.id)}
                disabled={isMarkingRead}
                className="gap-1.5"
              >
                <Check className="size-3.5" aria-hidden="true" />
                <span>Marcar como lida</span>
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl bg-muted/50 p-3 mt-1 text-xs text-muted-foreground flex items-center gap-2">
          <Clock className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Aguardando resposta do suporte...</span>
        </div>
      )}
    </div>
  );
}
