import {
  Clock,
  MapPin,
  Settings2,
  HelpCircle,
  Bug,
  Lightbulb,
  MessageSquare,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
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

export interface TicketRowProps {
  ticket: SupportTicket;
  onOpenManage: (ticketId: string) => void;
}

/**
 * Linha de exibição de chamado no painel de suporte administrativo (DRY).
 */
export function TicketRow({ ticket, onOpenManage }: TicketRowProps) {
  const typeInfo = TYPE_CONFIG[ticket.type] || TYPE_CONFIG.other;
  const TypeIcon = typeInfo.icon;
  const statusInfo = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;

  const formattedDate = new Date(ticket.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const platformStr =
    ticket.device_info &&
    typeof ticket.device_info === "object" &&
    "platform" in ticket.device_info
      ? String(ticket.device_info.platform)
      : "Web";

  return (
    <div className="rounded-xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs space-y-3.5 transition-colors hover:border-border">
      {/* Cabeçalho do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <TypeIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>{typeInfo.label}</span>
          </div>

          <Badge variant={statusInfo.badgeVariant} size="sm">
            {statusInfo.label}
          </Badge>

          {ticket.subject && (
            <span className="text-xs font-semibold text-foreground truncate max-w-xs sm:max-w-md">
              {ticket.subject}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{formattedDate}</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenManage(ticket.id)}
            className="gap-1.5 h-8 text-xs font-medium cursor-pointer"
          >
            <Settings2 className="size-3.5" aria-hidden="true" />
            <span>Atender Chamado</span>
          </Button>
        </div>
      </div>

      {/* Mensagem do Usuário */}
      <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap bg-surface-subtle/50 rounded-lg p-3 border border-border/50">
        {ticket.message}
      </p>

      {/* Metadados do Cliente e Ambiente */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground pt-0.5">
        <div>
          <span className="font-semibold text-foreground">Cliente: </span>
          <span>{ticket.user_name || "Não informado"}</span>
        </div>

        <div>
          <span className="font-semibold text-foreground">E-mail: </span>
          {ticket.user_email ? (
            <a
              href={`mailto:${ticket.user_email}`}
              className="text-primary hover:underline"
            >
              {ticket.user_email}
            </a>
          ) : (
            <span>Não informado</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <MapPin className="size-3 shrink-0" aria-hidden="true" />
          <span>Rota: </span>
          <code className="text-[11px] font-mono">{ticket.current_route || "/"}</code>
        </div>

        <div>
          <span>Plataforma: </span>
          <span className="text-foreground">{platformStr}</span>
        </div>

        {ticket.admin_notes && (
          <div className="w-full pt-1 text-xs text-primary bg-primary/5 rounded px-2.5 py-1 border border-primary/20">
            <span className="font-semibold">Nota da equipe: </span>
            <span>{ticket.admin_notes}</span>
          </div>
        )}
      </div>
    </div>
  );
}
