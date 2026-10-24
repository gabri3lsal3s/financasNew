import { useState, useMemo } from "react";
import {
  Search,
  HelpCircle,
  Bug,
  Lightbulb,
  MessageSquare,
  Clock,
  MapPin,
  Settings2,
  Inbox,
  AlertCircle,
} from "lucide-react";
import { Button, EmptyState, Input, Select, Skeleton, Badge } from "@/components/ui";
import { useAdminSupportTickets } from "@/state";
import { TicketManageDialog } from "../components";
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

const EMPTY_TICKETS: SupportTicket[] = [];

export function TicketsTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const ticketsQuery = useAdminSupportTickets();
  const allTickets = ticketsQuery.data ?? EMPTY_TICKETS;

  // Métricas do Topo
  const metrics = useMemo(() => {
    const total = allTickets.length;
    const open = allTickets.filter((t) => t.status === "open").length;
    const inProgress = allTickets.filter((t) => t.status === "in_progress").length;
    const resolved = allTickets.filter((t) => t.status === "resolved" || t.status === "closed").length;
    return { total, open, inProgress, resolved };
  }, [allTickets]);

  // Filtragem combinada
  const filteredTickets = useMemo(() => {
    return allTickets.filter((ticket) => {
      if (statusFilter && ticket.status !== statusFilter) {
        return false;
      }
      if (typeFilter && ticket.type !== typeFilter) {
        return false;
      }
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matchesName = (ticket.user_name || "").toLowerCase().includes(query);
        const matchesEmail = (ticket.user_email || "").toLowerCase().includes(query);
        const matchesSubject = (ticket.subject || "").toLowerCase().includes(query);
        const matchesMessage = ticket.message.toLowerCase().includes(query);
        const matchesRoute = (ticket.current_route || "").toLowerCase().includes(query);

        return matchesName || matchesEmail || matchesSubject || matchesMessage || matchesRoute;
      }
      return true;
    });
  }, [allTickets, statusFilter, typeFilter, search]);

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      {/* Cards de Métricas Rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Total Recebidos
          </span>
          <div className="text-xl font-bold text-foreground mt-1 tabular-nums">
            {metrics.total}
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-warning-strong uppercase tracking-wider">
            Abertos
          </span>
          <div className="text-xl font-bold text-warning-strong mt-1 tabular-nums">
            {metrics.open}
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-primary uppercase tracking-wider">
            Em Atendimento
          </span>
          <div className="text-xl font-bold text-primary mt-1 tabular-nums">
            {metrics.inProgress}
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-positive-strong uppercase tracking-wider">
            Resolvidos
          </span>
          <div className="text-xl font-bold text-positive-strong mt-1 tabular-nums">
            {metrics.resolved}
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, e-mail ou mensagem..."
            className="pl-9"
          />
          <Search
            className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
        </div>

        <Select
          ariaLabel="Filtrar por status"
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={[
            { value: "", label: "Todos os status" },
            { value: "open", label: "Abertos" },
            { value: "in_progress", label: "Em Atendimento" },
            { value: "resolved", label: "Resolvidos" },
            { value: "closed", label: "Encerrados" },
          ]}
        />

        <Select
          ariaLabel="Filtrar por tipo"
          value={typeFilter}
          onValueChange={setTypeFilter}
          options={[
            { value: "", label: "Todos os tipos" },
            { value: "doubt", label: "Dúvidas" },
            { value: "bug", label: "Problemas (Bugs)" },
            { value: "suggestion", label: "Sugestões" },
            { value: "other", label: "Outros" },
          ]}
        />
      </div>

      {/* Estado: Carregando (Skeleton) */}
      {ticketsQuery.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      )}

      {/* Estado: Erro */}
      {ticketsQuery.isError && (
        <EmptyState
          icon={<AlertCircle className="size-10 text-critical" aria-hidden="true" />}
          tone="negative"
          title="Não foi possível carregar os chamados"
          description="Ocorreu um erro ao carregar os chamados de suporte técnico. Tente novamente."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => ticketsQuery.refetch()}
            >
              Tentar novamente
            </Button>
          }
        />
      )}

      {/* Estado: Vazio */}
      {!ticketsQuery.isLoading && !ticketsQuery.isError && filteredTickets.length === 0 && (
        <EmptyState
          icon={<Inbox className="size-10" aria-hidden="true" />}
          title={
            allTickets.length === 0
              ? "Nenhum chamado recebido até o momento"
              : "Nenhum chamado encontrado para os filtros selecionados"
          }
          description={
            allTickets.length === 0
              ? "Quando os usuários enviarem dúvidas, reportarem problemas ou sugestões no app, os chamados serão listados aqui."
              : "Tente ajustar ou limpar os filtros de busca para visualizar outros chamados."
          }
          action={
            allTickets.length > 0 && (search || statusFilter || typeFilter) ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setTypeFilter("");
                }}
              >
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Lista de Chamados */}
      {!ticketsQuery.isLoading && !ticketsQuery.isError && filteredTickets.length > 0 && (
        <div className="space-y-3.5">
          {filteredTickets.map((ticket) => {
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
              <div
                key={ticket.id}
                className="rounded-xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs space-y-3.5 transition-colors hover:border-border"
              >
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
                        • {ticket.subject}
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
                      onClick={() => setSelectedTicket(ticket)}
                      className="gap-1.5 h-8 text-xs font-medium"
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
          })}
        </div>
      )}

      {/* Diálogo de Atendimento e Atualização de Status */}
      <TicketManageDialog
        ticket={selectedTicket}
        open={Boolean(selectedTicket)}
        onOpenChange={(open) => {
          if (!open) setSelectedTicket(null);
        }}
        onSuccess={() => {
          setSelectedTicket(null);
        }}
      />
    </div>
  );
}
