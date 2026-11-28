import { Activity } from "lucide-react";
import { Link } from "react-router";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
  buttonVariants,
} from "@/components/ui";
import { formatDateTimeBR, formatMonthYear } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { useAdminConnectionsHealth } from "@/state";
import type { AdminConnectionsHealth } from "@/types";
import { AdminHelpTip } from "./admin-help-tip";

const STATUS = {
  recent: { label: "Evidência recente", variant: "positive" },
  warning: { label: "Atenção", variant: "warning" },
  failure: { label: "Falha observada", variant: "critical" },
  unknown: { label: "Sem evidência recente", variant: "muted" },
} as const;

interface ServiceEvidence {
  name: string;
  status: keyof typeof STATUS;
  source: string;
  detail: string;
  timestamp?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function getServiceEvidence(data: AdminConnectionsHealth): ServiceEvidence[] {
  const { supabase_db, asaas, resend, quotes, ai_gemini, push, telegram } = data;
  const quotesAge = quotes.last_fetched_at
    ? Date.parse(supabase_db.checked_at) - Date.parse(quotes.last_fetched_at)
    : Number.POSITIVE_INFINITY;
  const telegramPaused = Boolean(telegram.updated_at) && (
    telegram.silent_mode || (!telegram.notify_support && !telegram.notify_new_users)
  );

  return [
    {
      name: "Supabase DB",
      status: "recent",
      source: "Consulta ao banco",
      detail: "Leitura concluída",
      timestamp: supabase_db.checked_at,
    },
    {
      name: "Asaas",
      status: asaas.failures_24h > 0 ? "failure" : asaas.events_24h > 0 ? "recent" : "unknown",
      source: "Registros de webhooks",
      detail: `${asaas.events_24h} eventos e ${asaas.failures_24h} com falha ou sem processamento em 24 h`,
      timestamp: asaas.last_event_at,
    },
    {
      name: "Resend",
      status: resend.failed_7d > 0 ? "failure" : resend.sent_7d > 0 ? "recent" : "unknown",
      source: "Registros de e-mails transacionais",
      detail: `${resend.sent_7d} enviados e ${resend.failed_7d} com outro status em 7 dias`,
      timestamp: resend.last_event_at,
    },
    {
      name: "Cotações",
      status: quotesAge <= DAY_MS ? (quotes.fallback_count > 0 ? "warning" : "recent") : "unknown",
      source: "Preços armazenados",
      detail: `${quotes.api_count} preços da API e ${quotes.fallback_count} da fonte alternativa`,
      timestamp: quotes.last_fetched_at,
    },
    {
      name: "IA Gemini",
      status: ai_gemini.active_quota_users > 0 ? "recent" : "unknown",
      source: "Cotas de IA e cache de extrações",
      detail: `${ai_gemini.active_quota_users} usuários com cota em ${formatMonthYear(ai_gemini.current_month)} e ${ai_gemini.cache_entries} extrações em cache`,
    },
    {
      name: "Push",
      status: "unknown",
      source: "Inscrições de push",
      detail: `${push.active_subscriptions} inscrições habilitadas`,
    },
    {
      name: "Telegram",
      status: telegramPaused ? "warning" : "unknown",
      source: "Configurações do bot",
      detail: telegram.silent_mode
        ? "Modo silencioso ativo"
        : telegram.updated_at
          ? "Suporte " + (telegram.notify_support ? "ativo" : "inativo") +
            " e avisos de novos usuários " + (telegram.notify_new_users ? "ativos" : "inativos")
          : "Sem configuração registrada",
      timestamp: telegram.updated_at,
    },
  ];
}

export function ConnectionsHealthPanel() {
  const query = useAdminConnectionsHealth();

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2.5">
        <Activity className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <CardTitle className="line-clamp-2 break-words">Conexões</CardTitle>
        <AdminHelpTip
          title="leitura passiva das conexões"
          what="O painel consulta registros existentes. A leitura passiva tem custo zero em chamadas aos provedores."
          when="Confira a origem e a data ao investigar alertas. Para cotações, a janela de evidência é de 24 horas."
          impact="Cotas, inscrições e configurações descrevem registros internos. A confirmação de disponibilidade ou entrega exige evidência do provedor."
        />
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : query.isError ? (
          <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : query.data ? (
          <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {getServiceEvidence(query.data).map(({ name, status, source, detail, timestamp }) => (
              <li
                key={name}
                className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface p-4 shadow-xs sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="break-words text-xs text-muted-foreground">{detail}</p>
                  <p className="text-xs text-muted-foreground">
                    {source}
                    {timestamp ? <>
                      {" em "}
                      <time dateTime={timestamp}>{formatDateTimeBR(timestamp)}</time>
                    </> : " sem horário registrado"}
                  </p>
                </div>
                <Badge variant={STATUS[status].variant} size="sm" className="self-start">
                  {STATUS[status].label}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nenhuma leitura disponível" />
        )}
      </CardContent>
    </Card>
  );
}

export function ConnectionsHealthPopover() {
  const query = useAdminConnectionsHealth();
  const services = query.data ? getServiceEvidence(query.data) : [];
  const alerts = services.filter(({ status }) => status === "warning" || status === "failure").length;
  const unknown = services.filter(({ status }) => status === "unknown").length;
  const label = query.isLoading
    ? "Lendo conexões"
    : query.isError || !query.data
      ? "Conexões indisponíveis"
      : alerts === 0
        ? "Conexões OK"
        : `${alerts} ${alerts === 1 ? "alerta" : "alertas"}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="size-9 p-0 lg:w-auto lg:px-3"
          aria-label={label}
          title={label}
        >
          <Activity
            className={query.isError || alerts > 0 ? "text-warning-strong" : "text-muted-foreground"}
            aria-hidden="true"
          />
          <span className="hidden lg:inline">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Resumo das conexões" className="max-w-[calc(100vw-1rem)] space-y-3">
        {query.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : query.isError ? (
          <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : query.data ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted-foreground">
              {unknown} de {services.length} serviços sem evidência recente na leitura passiva.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma leitura disponível</p>
        )}
        <PopoverClose asChild>
          <Link to="/admin/sistema?tab=conexoes" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Ver conexões
          </Link>
        </PopoverClose>
      </PopoverContent>
    </Popover>
  );
}
