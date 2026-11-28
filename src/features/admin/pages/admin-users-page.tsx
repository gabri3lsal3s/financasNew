import { useState } from "react";
import { useSearchParams } from "react-router";
import { AlertCircle, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { Badge, Button, EmptyState, SearchInput, Select } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { AdminHelpTip, AdminPageGuide } from "../components/admin-help-tip";
import { ROLE_LABELS, STATUS_LABELS } from "@/domain/admin";
import { useAdminUsers, useUserAccess } from "@/state";
import { UserCreateDialog, UserEditDialog } from "../components";
import { AdminUsersList } from "../components/admin-users-list";
import type { AdminUserRow } from "@/types";

const VALID_STATUS_FILTERS = new Set(["all", "active", "pending_approval", "suspended", "banned"]);
const PAGE_SIZE = 25;

export function AdminUsersPage() {
  const { role: currentUserRole } = useUserAccess();
  const isSuperadmin = currentUserRole === "superadmin";
  const [searchParams, setSearchParams] = useSearchParams();

  const rawStatusParam = searchParams.get("status") ?? "all";
  const statusFilter = VALID_STATUS_FILTERS.has(rawStatusParam) ? rawStatusParam : "all";

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  const handleStatusFilterChange = (nextStatus: string) => {
    setPage(0);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (!nextStatus || nextStatus === "all") {
          next.delete("status");
        } else {
          next.set("status", nextStatus);
        }
        return next;
      },
      { replace: true },
    );
  };

  const usersQuery = useAdminUsers({
    search: search.trim() ? search.trim() : null,
    status: statusFilter && statusFilter !== "all" ? statusFilter : null,
    role: roleFilter && roleFilter !== "all" ? roleFilter : null,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const users = usersQuery.data ?? [];
  const totalCount = users[0]?.total_count ?? users.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <PageHeader
        utilityActions={<AdminPageGuide page="users" />}
        title="Usuários"
        description="Cadastros, planos e permissões"
        badge={<Badge variant="muted" size="sm">{totalCount} usuários</Badge>}
        actions={
          isSuperadmin ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              sensoryIntent="selection"
              onClick={() => setIsCreateUserOpen(true)}
            >
              <UserPlus aria-hidden="true" />
              <span>Adicionar usuário</span>
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SearchInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          onClear={() => {
            setSearch("");
            setPage(0);
          }}
          placeholder="Buscar por nome ou e-mail…"
          aria-label="Buscar por nome ou e-mail"
        />

        <div className="flex min-w-0 items-center gap-1">
          <div className="min-w-0 flex-1">
            <Select
              value={statusFilter}
              onValueChange={handleStatusFilterChange}
              ariaLabel="Filtrar por status"
              placeholder="Status: Todos"
              options={[
                { value: "all", label: "Status: Todos" },
                { value: "active", label: STATUS_LABELS.active },
                { value: "pending_approval", label: STATUS_LABELS.pending_approval },
                { value: "suspended", label: STATUS_LABELS.suspended },
                { value: "banned", label: STATUS_LABELS.banned },
              ]}
            />
          </div>
          <AdminHelpTip
            title="Status"
            what="Indica se a conta está ativa, pendente de aprovação, suspensa ou bloqueada."
            when="Use o filtro para localizar cadastros pendentes ou conferir uma restrição de acesso."
            impact="Ao editar uma conta, a mudança de status pode liberar ou bloquear o acesso."
          />
        </div>

        <div className="flex min-w-0 items-center gap-1">
          <div className="min-w-0 flex-1">
            <Select
              value={roleFilter}
              onValueChange={(nextRole) => {
                setRoleFilter(nextRole);
                setPage(0);
              }}
              ariaLabel="Filtrar por cargo"
              placeholder="Cargo: Todos"
              options={[
                { value: "all", label: "Cargo: Todos" },
                { value: "user", label: ROLE_LABELS.user },
                { value: "admin", label: ROLE_LABELS.admin },
                { value: "superadmin", label: ROLE_LABELS.superadmin },
              ]}
            />
          </div>
          <AdminHelpTip
            title="Permissões"
            what="O cargo define quais ações administrativas a conta pode executar. As permissões por módulo são ajustadas na ficha do usuário."
            when="Abra a ficha quando precisar revisar o acesso a um módulo."
            impact="Mudanças de permissão alteram quais módulos a conta pode acessar."
          />
        </div>
      </div>

      {usersQuery.isError ? (
        <EmptyState
          icon={<AlertCircle className="size-10 text-critical-strong" aria-hidden="true" />}
          tone="negative"
          title="Não foi possível carregar os usuários"
          description="Ocorreu um erro ao buscar a lista de usuários. Tente novamente."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void usersQuery.refetch()}
            >
              Tentar novamente
            </Button>
          }
        />
      ) : (
        <>
          <AdminUsersList
            users={users}
            isLoading={usersQuery.isLoading}
            onSelectUser={setSelectedUser}
          />

          {totalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs text-muted-foreground tabular-nums">
                Página {page + 1} de {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page === 0 || usersQuery.isLoading}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft aria-hidden="true" />
                  <span>Anterior</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= totalPages || usersQuery.isLoading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <span>Próxima</span>
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedUser && (
        <UserEditDialog
          key={selectedUser.id}
          user={selectedUser}
          open={Boolean(selectedUser)}
          onOpenChange={(open) => {
            if (!open) setSelectedUser(null);
          }}
        />
      )}

      <UserCreateDialog
        open={isCreateUserOpen}
        onOpenChange={setIsCreateUserOpen}
      />
    </div>
  );
}
