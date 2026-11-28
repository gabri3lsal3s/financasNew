import { Link } from "react-router";
import { Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  ErrorState,
  Skeleton,
  buttonVariants,
} from "@/components/ui";
import { formatDateTimeBR } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { useAdminRetentionRadar } from "@/state";
import type { AdminRetentionRiskKind } from "@/types";

const RISK_LABEL: Record<AdminRetentionRiskKind, string> = {
  paid_inactive_21d: "Plano pago sem atividade há 21 dias",
  trial_stalled_72h: "Teste sem retorno após 72 h",
  past_due_with_ticket: "Pagamento em atraso com chamado aberto",
};

export function RetentionRadarCard() {
  const query = useAdminRetentionRadar(10);
  const accounts = query.data ?? [];

  return (
    <section aria-labelledby="retention-radar-title">
      <Card>
        <CardHeader className="gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="retention-radar-title" className="flex items-center gap-2 text-base font-bold">
            <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="line-clamp-2 break-words">Radar de retenção</span>
          </h2>
          <Link to="/admin/usuarios" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Ver usuários
          </Link>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : query.isError ? (
            <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />
          ) : accounts.length === 0 ? (
            <EmptyState title="Nenhuma conta em atenção" />
          ) : (
            <ul className="divide-y divide-border/80">
              {accounts.map((account) => (
                <li key={account.user_id} className="space-y-1 py-2.5">
                  <p className="break-words text-sm font-semibold">{account.name || account.email || "Conta sem identificação"}</p>
                  <p className="text-xs text-muted-foreground">{RISK_LABEL[account.risk_kind]}</p>
                  <p className="text-xs text-muted-foreground">
                    {account.last_seen_at
                      ? <>Último registro de dispositivo em <time dateTime={account.last_seen_at}>{formatDateTimeBR(account.last_seen_at)}</time></>
                      : "Sem registro de atividade em dispositivo"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
