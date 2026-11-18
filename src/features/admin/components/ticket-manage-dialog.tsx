import { useState } from "react";
import { Clock, Loader2, Mail, MapPin, Monitor, Save } from "lucide-react";
import { Badge, Button, FormField, KeyValueGrid, Modal, ModalFooter, Select, Textarea } from "@/components/ui";
import { useUpdateSupportTicketMutation } from "@/state";
import type { SupportTicket, SupportTicketStatus } from "@/types";

export interface TicketManageDialogProps {
  ticket: SupportTicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: "Aberto",
  in_progress: "Em Atendimento",
  resolved: "Resolvido",
  closed: "Encerrado",
};

const TYPE_LABELS: Record<string, string> = {
  doubt: "Dúvida",
  bug: "Problema (Bug)",
  suggestion: "Sugestão",
  other: "Outro",
};

/** Diálogo administrativo para resposta oficial e atualização de status de chamados. */
export function TicketManageDialog({ ticket, open, onOpenChange, onSuccess }: TicketManageDialogProps) {
  const updateMutation = useUpdateSupportTicketMutation();
  const [status, setStatus] = useState<SupportTicketStatus>(ticket?.status ?? "open");
  const [adminNotes, setAdminNotes] = useState(ticket?.admin_notes ?? "");
  const [adminReply, setAdminReply] = useState(ticket?.admin_reply ?? "");
  const [prevKey, setPrevKey] = useState(`${open}:${ticket?.id ?? ""}:${ticket?.status ?? ""}:${ticket?.admin_notes ?? ""}`);

  const currentKey = `${open}:${ticket?.id ?? ""}:${ticket?.status ?? ""}:${ticket?.admin_notes ?? ""}`;
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    if (ticket) {
      setStatus(ticket.status);
      setAdminNotes(ticket.admin_notes ?? "");
      setAdminReply(ticket.admin_reply ?? "");
    }
  }

  if (!ticket || !open) return null;

  const formattedDate = new Date(ticket.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const platformStr =
    ticket.device_info && typeof ticket.device_info === "object" && "platform" in ticket.device_info
      ? String(ticket.device_info.platform)
      : "Web";
  const isSubmitting = updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        ticketId: ticket.id,
        patch: { status, admin_notes: adminNotes.trim() || null, admin_reply: adminReply.trim() || null },
      });
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Erro tratado com toast destrutivo no hook
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Atendimento do Chamado"
      description={`Gerenciamento do chamado #${ticket.id.slice(0, 8)}`}
      size="lg"
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" form="ticket-manage-form" variant="default" sensoryIntent={false} disabled={isSubmitting} className="gap-2">
            {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            <span>{isSubmitting ? "Salvando..." : "Salvar e Enviar"}</span>
          </Button>
        </ModalFooter>
      }
    >
      <form id="ticket-manage-form" onSubmit={handleSubmit} className="space-y-5 pt-1">
        <div className="rounded-xl border border-border/80 bg-muted/50 p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Badge variant="muted" size="sm">{TYPE_LABELS[ticket.type] || "Outro"}</Badge>
              <Badge variant={ticket.status === "open" ? "warning" : ticket.status === "in_progress" ? "default" : "muted"} size="sm">
                {STATUS_LABELS[ticket.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{formattedDate}</span>
            </div>
          </div>

          <KeyValueGrid
            columns={2}
            items={[
              { label: "Cliente", value: ticket.user_name || "Não informado" },
              {
                label: "E-mail",
                value: ticket.user_email ? (
                  <a href={`mailto:${ticket.user_email}?subject=Atendimento Axir: ${encodeURIComponent(ticket.subject || "Chamado de Suporte")}`} className="font-medium text-primary-strong hover:underline flex items-center gap-1 truncate">
                    <Mail className="size-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{ticket.user_email}</span>
                  </a>
                ) : "Não informado",
              },
              {
                label: "Rota",
                value: (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <code className="text-[11px] text-foreground font-mono bg-surface px-1 py-0.5 rounded border border-border/80">{ticket.current_route || "/"}</code>
                  </div>
                ),
              },
              {
                label: "Plataforma",
                value: (
                  <div className="flex items-center gap-1.5">
                    <Monitor className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>{platformStr}</span>
                  </div>
                ),
              },
            ]}
          />

          {ticket.subject && (
            <div className="pt-1">
              <span className="text-xs font-semibold text-foreground">Assunto: </span>
              <span className="text-xs text-foreground">{ticket.subject}</span>
            </div>
          )}

          <FormField label="Mensagem do Usuário" className="pt-1">
            <div className="rounded-lg bg-surface border border-border/80 p-3 text-xs text-foreground whitespace-pre-wrap leading-relaxed">
              {ticket.message}
            </div>
          </FormField>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Textarea id="ticket-admin-reply" label="Resposta Oficial ao Usuário (visível no aplicativo para o cliente)" placeholder="Escreva a resposta ou orientação técnica. O usuário receberá um aviso no sininho do app..." value={adminReply} onChange={(e) => setAdminReply(e.target.value)} disabled={isSubmitting} rows={4} className="resize-none" />
            {ticket.admin_replied_at && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                <span>
                  Última resposta enviada em:{" "}
                  {new Date(ticket.admin_replied_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                <Badge variant={ticket.user_read_at ? "muted" : "warning"} size="xs">
                  {ticket.user_read_at ? "Lido pelo usuário" : "Aguardando leitura"}
                </Badge>
              </div>
            )}
          </div>

          <FormField label="Status do Chamado" htmlFor="ticket-status-select">
            <Select
              id="ticket-status-select"
              value={status}
              onValueChange={(v) => setStatus(v as SupportTicketStatus)}
              options={[
                { value: "open", label: STATUS_LABELS.open },
                { value: "in_progress", label: STATUS_LABELS.in_progress },
                { value: "resolved", label: STATUS_LABELS.resolved },
                { value: "closed", label: STATUS_LABELS.closed },
              ]}
            />
          </FormField>

          <Textarea id="ticket-admin-notes" label="Notas Internas da Equipe (visível apenas para administradores)" placeholder="Registre aqui anotações técnicas, logs ou observações de desenvolvimento..." value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} disabled={isSubmitting} rows={2} className="resize-none" />
        </div>
      </form>
    </Modal>
  );
}
