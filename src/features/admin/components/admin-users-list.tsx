import { Settings2, Shield } from "lucide-react";
import { Badge, Button, EmptyState, Skeleton } from "@/components/ui";
import { ROLE_LABELS, STATUS_LABELS } from "@/domain/admin";
import { formatDateBR } from "@/lib/date";
import type { AdminUserRow } from "@/types";

export interface AdminUsersListProps {
  users: AdminUserRow[];
  isLoading: boolean;
  onSelectUser: (user: AdminUserRow) => void;
}

function resolveStatusVariant(status: string): "positive" | "warning" | "critical" {
  if (status === "active") return "positive";
  if (status === "pending_approval") return "warning";
  return "critical";
}

/**
 * Listagem responsiva de usuários no painel administrativo:
 * cards no mobile (< md) e tabela com rolagem horizontal no desktop (>= md).
 */
export function AdminUsersList({ users, isLoading, onSelectUser }: AdminUsersListProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden p-4 sm:p-5 divide-y divide-border/80" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full shrink-0" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-32 sm:w-44" />
                <Skeleton className="h-3 w-40 sm:w-56" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <EmptyState
        title="Nenhum usuário encontrado"
        description="Ajuste os filtros de busca ou verifique o termo digitado."
      />
    );
  }

  return (
    <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
      <div className="flex flex-col divide-y divide-border/80 md:hidden">
        {users.map((u) => (
          <div key={u.id} className="p-4 flex flex-col gap-3 hover:bg-surface-hover/20 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-foreground line-clamp-2 break-words">
                  {u.name || "Nome não informado"}
                </span>
                <span className="text-xs text-muted-foreground font-mono truncate">{u.email}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                <Badge variant={resolveStatusVariant(u.status)} size="xs" className="max-w-full truncate inline-block">
                  {STATUS_LABELS[u.status as keyof typeof STATUS_LABELS] ?? u.status}
                </Badge>
                {u.is_test && (
                  <Badge variant="warning" size="xs" className="max-w-full truncate inline-block">
                    Teste
                  </Badge>
                )}
                {u.deleted_at && (
                  <Badge variant="critical" size="xs" className="max-w-full truncate inline-block">
                    Quarentena
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5">
                <Shield className="size-3.5" aria-hidden="true" />
                <span>{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                sensoryIntent="selection"
                onClick={() => onSelectUser(u)}
              >
                <Settings2 aria-hidden="true" />
                <span>Gerenciar</span>
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto no-scrollbar scroll-smooth">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-surface-raised border-b border-border/80 text-muted-foreground font-semibold">
            <tr>
              <th className="py-3 px-4">Usuário</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Cargo / Função</th>
              <th className="py-3 px-4">Data Cadastro</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-surface-hover/20 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-foreground truncate">
                      {u.name || "Nome não informado"}
                    </span>
                    <span className="text-muted-foreground font-mono text-[11px] truncate">
                      {u.email}
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant={resolveStatusVariant(u.status)} size="xs" className="max-w-full truncate inline-block">
                      {STATUS_LABELS[u.status as keyof typeof STATUS_LABELS] ?? u.status}
                    </Badge>
                    {u.is_test && (
                      <Badge variant="warning" size="xs" className="max-w-full truncate inline-block">
                        Teste
                      </Badge>
                    )}
                    {u.deleted_at && (
                      <Badge variant="critical" size="xs" className="max-w-full truncate inline-block">
                        Quarentena
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}
                  </span>
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                  {formatDateBR(u.created_at)}
                </td>
                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    sensoryIntent="selection"
                    onClick={() => onSelectUser(u)}
                  >
                    <Settings2 aria-hidden="true" />
                    <span>Gerenciar</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
