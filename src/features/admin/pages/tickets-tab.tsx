import { useState, useMemo } from "react";
import { useSearchParams } from "react-router";
import {
  Inbox,
  AlertCircle,
} from "lucide-react";
import { Button, EmptyState, SearchInput, Select, SkeletonList } from "@/components/ui";
import { KpiCard, KpiGrid } from "@/components/modules";
import { useAdminSupportTickets } from "@/state";
import { TicketManageDialog, TicketRow } from "../components";
import type { SupportTicket } from "@/types";

const EMPTY_TICKETS: SupportTicket[] = [];

export function TicketsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const ticketParam = searchParams.get("ticket");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const ticketsQuery = useAdminSupportTickets();
  const allTickets = ticketsQuery.data ?? EMPTY_TICKETS;

  // Derivação do chamado ativo (via deep link ?ticket=<uuid> ou clique manual)
  const activeTicketId = selectedTicketId ?? ticketParam;
  const selectedTicket = useMemo(() => {
    if (!activeTicketId || allTickets.length === 0) return null;
    return allTickets.find((t) => t.id === activeTicketId) ?? null;
  }, [activeTicketId, allTickets]);

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
      <KpiGrid columns={4}>
        <KpiCard label="Total Recebidos" value={String(metrics.total)} />
        <KpiCard label="Abertos" value={String(metrics.open)} tone="default" />
        <KpiCard label="Em Atendimento" value={String(metrics.inProgress)} tone="default" />
        <KpiCard label="Resolvidos" value={String(metrics.resolved)} tone="positive" />
      </KpiGrid>

      {/* Barra de Filtros e Busca */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          placeholder="Buscar por cliente, e-mail ou mensagem…"
          aria-label="Buscar chamados"
        />

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
        <SkeletonList rows={3} className="space-y-3.5" />
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
          {filteredTickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              onOpenManage={(id) => setSelectedTicketId(id)}
            />
          ))}
        </div>
      )}

      {/* Diálogo de Atendimento e Atualização de Status */}
      <TicketManageDialog
        ticket={selectedTicket}
        open={Boolean(selectedTicket)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTicketId(null);
            if (ticketParam) {
              const next = new URLSearchParams(searchParams);
              next.delete("ticket");
              setSearchParams(next, { replace: true });
            }
          }
        }}
        onSuccess={() => {
          setSelectedTicketId(null);
          if (ticketParam) {
            const next = new URLSearchParams(searchParams);
            next.delete("ticket");
            setSearchParams(next, { replace: true });
          }
        }}
      />
    </div>
  );
}
