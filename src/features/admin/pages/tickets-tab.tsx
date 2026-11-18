import { useState, useMemo } from "react";
import { useSearchParams } from "react-router";
import { AlertCircle, Inbox } from "lucide-react";
import { Button, EmptyState, SearchInput, Select, Skeleton } from "@/components/ui";
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

  const activeTicketId = selectedTicketId ?? ticketParam;
  const selectedTicket = useMemo(() => {
    if (!activeTicketId || allTickets.length === 0) return null;
    return allTickets.find((t) => t.id === activeTicketId) ?? null;
  }, [activeTicketId, allTickets]);

  const metrics = useMemo(() => {
    const total = allTickets.length;
    const open = allTickets.filter((t) => t.status === "open").length;
    const inProgress = allTickets.filter((t) => t.status === "in_progress").length;
    const resolved = allTickets.filter((t) => t.status === "resolved" || t.status === "closed").length;
    return { total, open, inProgress, resolved };
  }, [allTickets]);

  const filteredTickets = useMemo(() => {
    return allTickets.filter((ticket) => {
      if (statusFilter && ticket.status !== statusFilter) return false;
      if (typeFilter && ticket.type !== typeFilter) return false;
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        return (
          (ticket.user_name || "").toLowerCase().includes(query) ||
          (ticket.user_email || "").toLowerCase().includes(query) ||
          (ticket.subject || "").toLowerCase().includes(query) ||
          ticket.message.toLowerCase().includes(query) ||
          (ticket.current_route || "").toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [allTickets, statusFilter, typeFilter, search]);

  const clearTicketParam = () => {
    setSelectedTicketId(null);
    if (ticketParam) {
      const next = new URLSearchParams(searchParams);
      next.delete("ticket");
      setSearchParams(next, { replace: true });
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <KpiGrid columns={4}>
        <KpiCard label="Total Recebidos" value={String(metrics.total)} />
        <KpiCard label="Abertos" value={String(metrics.open)} tone="default" />
        <KpiCard label="Em Atendimento" value={String(metrics.inProgress)} tone="default" />
        <KpiCard label="Resolvidos" value={String(metrics.resolved)} tone="positive" />
      </KpiGrid>

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

      {ticketsQuery.isLoading && (
        <div className="space-y-3.5" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs space-y-3.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <div className="flex items-center justify-between pt-1 border-t border-border/80">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {ticketsQuery.isError && (
        <EmptyState
          icon={<AlertCircle className="size-10 text-critical-strong" aria-hidden="true" />}
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

      <TicketManageDialog
        ticket={selectedTicket}
        open={Boolean(selectedTicket)}
        onOpenChange={(open) => {
          if (!open) clearTicketParam();
        }}
        onSuccess={clearTicketParam}
      />
    </div>
  );
}
