import { useState } from "react";
import {
  LifeBuoy,
  MessageSquare,
  CheckCircle2,
  Clock,
  HelpCircle,
  Bug,
  Lightbulb,
  Check,
  Send,
} from "lucide-react";
import { Button, Badge, EmptyState, Skeleton } from "@/components/ui";
import { useMySupportTickets, useMarkTicketAsReadMutation } from "@/state";
import { SupportChatDialog } from "@/components/modules/support/support-chat-dialog";
import type { SupportTicketStatus, SupportTicketType } from "@/types";

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

export function SupportTab() {
  const [chatOpen, setChatOpen] = useState(false);
  const ticketsQuery = useMySupportTickets();
  const markAsReadMutation = useMarkTicketAsReadMutation();

  const tickets = ticketsQuery.data ?? [];

  const handleMarkRead = (ticketId: string) => {
    markAsReadMutation.mutate(ticketId);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Central de Suporte & Chamados</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Acompanhe o retorno das suas dúvidas, sugestões e reportes enviados à administração.
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => setChatOpen(true)}
          className="gap-2 shrink-0"
        >
          <Send className="size-3.5" aria-hidden="true" />
          <span>Novo Chamado</span>
        </Button>
      </div>

      {/* Lista de Chamados */}
      {ticketsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy className="size-6 text-muted-foreground" aria-hidden="true" />}
          title="Nenhum chamado aberto"
          description="Você ainda não enviou nenhuma mensagem ou dúvida para a nossa equipe."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setChatOpen(true)}
              className="gap-2"
            >
              <LifeBuoy className="size-4" aria-hidden="true" />
              <span>Enviar Dúvida ou Sugestão</span>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => {
            const hasReply = Boolean(ticket.admin_reply);
            const isUnread = hasReply && !ticket.user_read_at;
            const typeInfo = TYPE_CONFIG[ticket.type] || TYPE_CONFIG.other;
            const TypeIcon = typeInfo.icon;
            const statusInfo = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;

            return (
              <div
                key={ticket.id}
                className={`rounded-2xl border p-4 sm:p-5 shadow-xs transition-all ${
                  isUnread
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/80 bg-surface"
                }`}
              >
                {/* Header do Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-surface-hover text-muted-foreground">
                      <TypeIcon className="size-4" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      {ticket.subject || typeInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isUnread && (
                      <Badge variant="warning" size="xs">
                        Nova Resposta
                      </Badge>
                    )}
                    <Badge variant={statusInfo.badgeVariant} size="xs">
                      {statusInfo.label}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(ticket.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Mensagem Enviada pelo Usuário */}
                <div className="py-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  <span className="font-semibold text-foreground">Sua mensagem: </span>
                  {ticket.message}
                </div>

                {/* Resposta do Administrador (se houver) */}
                {hasReply ? (
                  <div className="rounded-xl border border-primary/20 bg-surface p-3.5 mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <CheckCircle2 className="size-4 text-positive-strong" aria-hidden="true" />
                        <span>Resposta da Equipe Áxis:</span>
                      </div>
                      {ticket.admin_replied_at && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
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
                      )}
                    </div>
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                      {ticket.admin_reply}
                    </p>

                    {/* Botão de Marcar como Lido */}
                    {isUnread && (
                      <div className="pt-2 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => handleMarkRead(ticket.id)}
                          disabled={markAsReadMutation.isPending}
                          className="gap-1.5"
                        >
                          <Check className="size-3" aria-hidden="true" />
                          <span>Marcar como lida</span>
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/60 bg-surface-subtle/40 p-3 mt-2 text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                    <span>Aguardando resposta do suporte...</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Diálogo para criação de novos chamados */}
      <SupportChatDialog open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}
