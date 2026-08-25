import { useState } from "react";
import { Search, Settings2, Shield } from "lucide-react";
import { Button, EmptyState, Input, Select, Skeleton } from "@/components/ui";
import { ROLE_LABELS, STATUS_LABELS } from "@/domain/admin";
import { useAdminUsers } from "@/state";
import { UserEditDialog } from "../components";
import type { AdminUserRow } from "@/types";





export function UsersTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);

  const usersQuery = useAdminUsers({
    search: search.trim() ? search.trim() : null,
    status: statusFilter || null,
    role: roleFilter || null,
    limit: 100,
  });

  const users = usersQuery.data ?? [];

  return (
    <div className="flex flex-col gap-5 w-full min-w-0">
      {/* Filtros e Busca */}
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

      {/* Lista / Tabela de Usuários com Layout Adaptativo */}
      <div className="rounded-2xl border border-border/80 bg-surface/90 shadow-xs overflow-hidden">
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
              description="Tente ajustar os termos de busca ou filtros aplicados."
            />
          </div>
        ) : (
          <>
            {/* Visualização em Cards para Mobile */}
            <div className="flex flex-col divide-y divide-border/60 sm:hidden">
              {users.map((user) => (
                <div key={user.id} className="p-4 flex flex-col gap-3 hover:bg-surface-hover/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-sm text-foreground truncate">{user.name || "Sem nome"}</span>
                      <span className="font-mono text-xs text-muted-foreground truncate">{user.email}</span>
                    </div>
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold shrink-0 ${
                        user.status === "active"
                          ? "bg-positive/10 text-positive-strong border border-positive/20"
                          : user.status === "pending_approval"
                            ? "bg-warning/10 text-warning border border-warning/20"
                            : "bg-critical/10 text-critical border border-critical/20"
                      }`}
                    >
                      {STATUS_LABELS[user.status as keyof typeof STATUS_LABELS] || user.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-1">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        user.role === "superadmin"
                          ? "bg-portfolio/10 text-portfolio border border-portfolio/20"
                          : user.role === "admin"
                            ? "bg-primary/10 text-primary-strong border border-primary/20"
                            : "bg-surface-hover text-muted-foreground border border-border"
                      }`}
                    >
                      <Shield className="size-3" aria-hidden="true" />
                      {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                    </span>
                    <span>Criado em {new Date(user.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedUser(user)}
                    className="w-full gap-1.5 text-xs h-8 justify-center mt-1"
                  >
                    <Settings2 className="size-3.5" aria-hidden="true" />
                    Gerenciar Usuário
                  </Button>
                </div>
              ))}
            </div>

            {/* Visualização em Tabela para Tablets e Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-surface-hover/50 text-muted-foreground font-medium">
                    <th className="py-3 px-4">Usuário</th>
                    <th className="py-3 px-4">Cargo (Role)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Criado em</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-col max-w-[240px]">
                          <span className="font-semibold text-foreground truncate">{user.name || "Sem nome"}</span>
                          <span className="font-mono text-muted-foreground text-[11px] truncate">{user.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                            user.role === "superadmin"
                              ? "bg-portfolio/10 text-portfolio border border-portfolio/20"
                              : user.role === "admin"
                                ? "bg-primary/10 text-primary-strong border border-primary/20"
                                : "bg-surface-hover text-muted-foreground border border-border"
                          }`}
                        >
                          <Shield className="size-3" aria-hidden="true" />
                          {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                            user.status === "active"
                              ? "bg-positive/10 text-positive-strong border border-positive/20"
                              : user.status === "pending_approval"
                                ? "bg-warning/10 text-warning border border-warning/20"
                                : "bg-critical/10 text-critical border border-critical/20"
                          }`}
                        >
                          {STATUS_LABELS[user.status as keyof typeof STATUS_LABELS] || user.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {new Date(user.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedUser(user)}
                          className="gap-1.5 text-xs h-8 px-2.5"
                        >
                          <Settings2 className="size-3.5" aria-hidden="true" />
                          Gerenciar
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

      {selectedUser ? (
        <UserEditDialog
          user={selectedUser}
          open={Boolean(selectedUser)}
          onOpenChange={(open) => {
            if (!open) setSelectedUser(null);
          }}
        />
      ) : null}
    </div>
  );
}
