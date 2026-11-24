import { useState } from "react";
import { useSearchParams } from "react-router";
import { UserPlus } from "lucide-react";
import { Badge, Button, SearchInput, Select } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { ROLE_LABELS, STATUS_LABELS } from "@/domain/admin";
import { useAdminUsers, useUserAccess } from "@/state";
import { UserCreateDialog, UserEditDialog } from "../components";
import { AdminUsersList } from "../components/admin-users-list";
import type { AdminUserRow } from "@/types";

const VALID_STATUS_FILTERS = new Set(["all", "active", "pending_approval", "suspended", "banned"]);

export function AdminUsersPage() {
  const { role: currentUserRole } = useUserAccess();
  const isSuperadmin = currentUserRole === "superadmin";
  const [searchParams, setSearchParams] = useSearchParams();

  const rawStatusParam = searchParams.get("status") ?? "all";
  const statusFilter = VALID_STATUS_FILTERS.has(rawStatusParam) ? rawStatusParam : "all";

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  const handleStatusFilterChange = (nextStatus: string) => {
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
    limit: 100,
  });

  const users = usersQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <PageHeader
        title="Gestão de Usuários"
        description="Cadastro, planos e permissões modulares"
        badge={<Badge variant="muted" size="sm">{users.length} usuários</Badge>}
        actions={
          isSuperadmin ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              sensoryIntent="selection"
              onClick={() => setIsCreateUserOpen(true)}
              className="gap-1.5 text-xs"
            >
              <UserPlus className="size-3.5" aria-hidden="true" />
              <span>Adicionar Usuário</span>
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          placeholder="Buscar por nome ou e-mail…"
          aria-label="Buscar por nome ou e-mail"
        />

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

        <Select
          value={roleFilter}
          onValueChange={setRoleFilter}
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

      <AdminUsersList
        users={users}
        isLoading={usersQuery.isLoading}
        onSelectUser={setSelectedUser}
      />

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
