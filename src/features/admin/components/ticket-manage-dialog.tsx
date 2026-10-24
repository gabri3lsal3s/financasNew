import { useState } from "react";
import { Mail, Clock, MapPin, Monitor, Loader2, Save } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

export function TicketManageDialog({
  ticket,
  open,
  onOpenChange,
  onSuccess,
}: TicketManageDialogProps) {
  if (!ticket || !open) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Atendimento do Chamado"
      description={`Gerenciamento do chamado #${ticket.id.slice(0, 8)}`}
      size="lg"
    >
      <TicketManageForm
        key={`${ticket.id}-${ticket.status}-${ticket.admin_notes ?? ""}`}
        ticket={ticket}
        onClose={() => onOpenChange(false)}
        onSuccess={onSuccess}
      />
    </Modal>
  );
}

interface TicketManageFormProps {
  ticket: SupportTicket;
  onClose: () => void;
  onSuccess?: () => void;
}

function TicketManageForm({ ticket, onClose, onSuccess }: TicketManageFormProps) {
  const [status, setStatus] = useState<SupportTicketStatus>(ticket.status);
  const [adminNotes, setAdminNotes] = useState(ticket.admin_notes ?? "");
  const updateMutation = useUpdateSupportTicketMutation();

  const formattedDate = new Date(ticket.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateMutation.mutateAsync({
        ticketId: ticket.id,
        patch: {
          status,
          admin_notes: adminNotes.trim() || null,
        },
      });

      onClose();
      onSuccess?.();
    } catch {
      // Erro tratado com toast destrutivo no hook
    }
  };

  const isSubmitting = updateMutation.isPending;
  const platformStr =
    ticket.device_info && typeof ticket.device_info === "object" && "platform" in ticket.device_info
      ? String(ticket.device_info.platform)
      : "Web";

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-1">
      {/* Resumo do Chamado */}
      <div className="rounded-xl border border-border/80 bg-surface-subtle/50 p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
          <div className="flex items-center gap-2">
            <Badge variant="muted" size="sm">
              {TYPE_LABELS[ticket.type] || "Outro"}
            </Badge>
            <Badge
              variant={
                ticket.status === "open"
                  ? "warning"
                  : ticket.status === "in_progress"
                    ? "default"
                    : "muted"
              }
              size="sm"
            >
              {STATUS_LABELS[ticket.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Informações do Cliente */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Cliente: </span>
            <span className="font-semibold text-foreground">
              {ticket.user_name || "Não informado"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-muted-foreground">E-mail: </span>
            {ticket.user_email ? (
              <a
                href={`mailto:${ticket.user_email}?subject=Atendimento Áxis Finance: ${encodeURIComponent(ticket.subject || "Chamado de Suporte")}`}
                className="font-medium text-primary hover:underline flex items-center gap-1 truncate"
              >
                <Mail className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{ticket.user_email}</span>
              </a>
            ) : (
              <span className="text-muted-foreground">Não informado</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Rota: </span>
            <code className="text-[11px] text-foreground font-mono bg-surface px-1 py-0.5 rounded border border-border/60">
              {ticket.current_route || "/"}
            </code>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Monitor className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Plataforma: </span>
            <span className="text-foreground">{platformStr}</span>
          </div>
        </div>

        {ticket.subject && (
          <div className="pt-1">
            <span className="text-xs font-semibold text-foreground">Assunto: </span>
            <span className="text-xs text-foreground">{ticket.subject}</span>
          </div>
        )}

        {/* Mensagem do Usuário */}
        <div className="space-y-1 pt-1">
          <label className="text-xs font-semibold text-foreground">
            Mensagem do Usuário:
          </label>
          <div className="rounded-lg bg-surface border border-border/80 p-3 text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {ticket.message}
          </div>
        </div>
      </div>

      {/* Formulário de Gestão do Atendimento */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Status do Chamado
          </label>
          <Select
            value={status}
            onValueChange={(val) => setStatus(val as SupportTicketStatus)}
            options={[
              { value: "open", label: STATUS_LABELS.open },
              { value: "in_progress", label: STATUS_LABELS.in_progress },
              { value: "resolved", label: STATUS_LABELS.resolved },
              { value: "closed", label: STATUS_LABELS.closed },
            ]}
          />
        </div>

        <div className="space-y-1.5">
          <Textarea
            id="ticket-admin-notes"
            label="Notas Internas da Equipe (visível apenas para administradores)"
            placeholder="Registre aqui as providências tomadas, data de contato ou observações técnicas..."
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            disabled={isSubmitting}
            rows={3}
            className="resize-none"
          />
        </div>
      </div>

      {/* Rodapé Padronizado: Cancelar à esquerda, Salvar à direita */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-border/80">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isSubmitting}
          className="w-full sm:w-auto"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={isSubmitting}
          className="w-full sm:w-auto gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              <span>Salvando...</span>
            </>
          ) : (
            <>
              <Save className="size-4" aria-hidden="true" />
              <span>Salvar Alterações</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
