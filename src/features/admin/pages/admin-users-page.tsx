import { useState } from "react";
import { Search, Settings2, Shield, UserPlus } from "lucide-react";
import { Button, EmptyState, Input, Select, Skeleton, Badge } from "@/components/ui";
import { ROLE_LABELS, STATUS_LABELS } from "@/domain/admin";
import { useAdminUsers, useUserAccess } from "@/state";
import { UserCreateDialog, UserEditDialog } from "../components";
import type { AdminUserRow } from "@/types";
import { triggerSensory } from "@/services/sensory";

export function AdminUsersPage() {
  const { role: currentUserRole } = useUserAccess();
  const isSuperadmin = currentUserRole === "superadmin";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  const usersQuery = useAdminUsers({
    search: search.trim() ? search.trim() : null,
    status: statusFilter || null,
    role: roleFilter || null,
    limit: 100,
  });

  const users = usersQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Gestão de Usuários
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Consulta cadastral, contato criptografado, concessão de planos e permissões modulares
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isSuperadmin && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                triggerSensory("selection");
                setIsCreateUserOpen(true);
              }}
              className="gap-1.5 h-8 text-xs"
            >
              <UserPlus className="size-3.5" aria-hidden="true" />
              <span>Adicionar Usuário</span>
            </Button>
          )}
          <Badge variant="muted" size="sm">
            {users.length} usuários listados
          </Badge>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="pl-9"
          />
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
        </div>

        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={[
            { value: "", label: "Todos os status" },
            { value: "active", label: STATUS_LABELS.active },
            { value: "pending_approval", label: STATUS_LABELS.pending_approval },
            { value: "suspended", label: STATUS_LABELS.suspended },
            { value: "banned", label: STATUS_LABELS.banned },
          ]}
        />

        <Select
          value={roleFilter}
          onValueChange={setRoleFilter}
          options={[
            { value: "", label: "Todos os cargos" },
            { value: "user", label: ROLE_LABELS.user },
            { value: "admin", label: ROLE_LABELS.admin },
            { value: "superadmin", label: ROLE_LABELS.superadmin },
          ]}
        />
      </div>

      {/* Lista / Tabela de Usuários */}
      <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        {usersQuery.isLoading ? (
          <div className="p-6 flex flex-col gap-3">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Nenhum usuário encontrado"
              description="Ajuste os filtros de busca ou verifique o termo digitado."
            />
          </div>
        ) : (
          <>
            {/* Visualização Card no Mobile (< md) */}
            <div className="flex flex-col divide-y divide-border/60 md:hidden">
              {users.map((u) => (
                <div key={u.id} className="p-4 flex flex-col gap-3 hover:bg-surface-hover/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-foreground truncate">{u.name || "Nome não informado"}</span>
                      <span className="text-xs text-muted-foreground font-mono truncate">{u.email}</span>
                    </div>
                    <Badge
                      variant={
                        u.status === "active"
                          ? "positive"
                          : u.status === "pending_approval"
                            ? "warning"
                            : "critical"
                      }
                      size="xs"
                    >
                      {STATUS_LABELS[u.status as keyof typeof STATUS_LABELS] ?? u.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-1">
                    <div className="flex items-center gap-1.5">
                      <Shield className="size-3.5" aria-hidden="true" />
                      <span>{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        triggerSensory("selection");
                        setSelectedUser(u);
                      }}
                      className="gap-1 text-xs h-7.5"
                    >
                      <Settings2 className="size-3.5" aria-hidden="true" />
                      <span>Gerenciar</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabela Densificada no Desktop (≥ md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-hover/40 border-b border-border/80 text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Usuário</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Cargo / Função</th>
                    <th className="py-3 px-4">Data Cadastro</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-hover/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground truncate">{u.name || "Nome não informado"}</span>
                          <span className="text-muted-foreground font-mono text-[11px] truncate">{u.email}</span>
                        </div>
                      </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Badge
                            variant={
                              u.status === "active"
                                ? "positive"
                                : u.status === "pending_approval"
                                  ? "warning"
                                  : "critical"
                            }
                            size="xs"
                          >
                            {STATUS_LABELS[u.status as keyof typeof STATUS_LABELS] ?? u.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-muted-foreground">
                          <span className="font-medium text-foreground">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</span>
                        </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                        {new Date(u.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            triggerSensory("selection");
                            setSelectedUser(u);
                          }}
                          className="gap-1.5 text-xs h-7.5 px-2.5"
                        >
                          <Settings2 className="size-3.5" aria-hidden="true" />
                          <span>Gerenciar</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Diálogo Completo de Gestão de Usuário com Revelação Auditada LGPD */}
      {selectedUser && (
        <UserEditDialog
          user={selectedUser}
          open={Boolean(selectedUser)}
          onOpenChange={(open) => {
            if (!open) setSelectedUser(null);
          }}
        />
      )}

      {/* Diálogo de Criação/Provisionamento de Usuário pelo Superadmin */}
      <UserCreateDialog
        open={isCreateUserOpen}
        onOpenChange={setIsCreateUserOpen}
      />
    </div>
  );
}
