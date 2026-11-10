import { useState } from "react";
import type { FormEvent } from "react";
import {
  BellRing,
  ExternalLink,
  Megaphone,
  Radio,
  Send,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { useAdminBroadcastNotifications, useAdminSendBroadcast } from "@/state";
import { triggerSensory } from "@/services/sensory";
import type { BroadcastAudience, BroadcastType } from "@/types";

const BROADCAST_TYPES: { value: BroadcastType; label: string }[] = [
  { value: "info", label: "Informativo (Geral)" },
  { value: "system", label: "Atualização de Sistema" },
  { value: "warning", label: "Aviso de Atenção" },
  { value: "critical", label: "Alerta Crítico" },
  { value: "promotion", label: "Novidade / Aporte VIP" },
];

const AUDIENCE_OPTIONS: { value: BroadcastAudience; label: string }[] = [
  { value: "all", label: "Todos os Usuários da Plataforma" },
  { value: "pro", label: "Apenas Assinantes Pro / Vitalício" },
  { value: "free", label: "Apenas Usuários Free / Em Teste" },
];

export function AdminNotificationsPage() {
  const broadcastsQuery = useAdminBroadcastNotifications();
  const sendMutation = useAdminSendBroadcast();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<BroadcastType>("info");
  const [actionUrl, setActionUrl] = useState("");
  const [targetAudience, setTargetAudience] = useState<BroadcastAudience>("all");

  const broadcasts = broadcastsQuery.data ?? [];

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    triggerSensory("action");
    sendMutation.mutate(
      {
        title: title.trim(),
        message: message.trim(),
        type,
        actionUrl: actionUrl.trim() || null,
        targetAudience,
      },
      {
        onSuccess: () => {
          setTitle("");
          setMessage("");
          setActionUrl("");
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-8 w-full min-w-0">
      {/* Cabeçalho */}
      <PageHeader
        title="Central de Notificações & Push"
        description="Dispare comunicados em tempo real diretamente para o aplicativo dos usuários"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Formulário de Envio (coluna da esquerda) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Megaphone className="size-4 text-primary-strong" aria-hidden="true" />
              <h2 className="text-sm font-bold text-foreground">Compor Novo Comunicado</h2>
            </div>

            <form onSubmit={handleSend} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="broadcast-title" className="text-xs font-semibold text-foreground">
                  Título da Notificação
                </label>
                <Input
                  id="broadcast-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Atualização 3.0 disponível com novas ferramentas!"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="broadcast-message" className="text-xs font-semibold text-foreground">
                  Mensagem Detalhada
                </label>
                <Textarea
                  id="broadcast-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite o conteúdo que será lido pelos clientes no sininho do app…"
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="broadcast-type" className="text-xs font-semibold text-foreground">
                    Categoria do Aviso
                  </label>
                  <Select
                    value={type}
                    onValueChange={(val) => setType(val as BroadcastType)}
                    options={BROADCAST_TYPES}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="broadcast-audience" className="text-xs font-semibold text-foreground">
                    Público-Alvo
                  </label>
                  <Select
                    value={targetAudience}
                    onValueChange={(val) => setTargetAudience(val as BroadcastAudience)}
                    options={AUDIENCE_OPTIONS}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="broadcast-action" className="text-xs font-semibold text-foreground">
                  Link de Ação Rápida <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
                </label>
                <Input
                  id="broadcast-action"
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  placeholder="Ex: /ferramentas ou /configuracoes"
                />
              </div>

              <Button
                type="submit"
                variant="default"
                disabled={sendMutation.isPending || !title.trim() || !message.trim()}
                className="mt-2 flex items-center justify-center gap-2"
              >
                <Send className="size-4" aria-hidden="true" />
                <span>{sendMutation.isPending ? "Disparando comunicado…" : "Enviar Notificação aos Clientes"}</span>
              </Button>
            </form>
          </div>
        </div>

        {/* Pré-visualização ao Vivo (coluna da direita) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Pré-visualização no Aplicativo
              </h3>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Como a mensagem aparecerá no popover de notificações dos clientes:
            </p>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-start gap-3 mt-1">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong mt-0.5">
                <Megaphone className="size-4" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {title.trim() || "Título do Comunicado"}
                  </span>
                  <Badge variant="default" size="xs">
                    Comunicado
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
                  {message.trim() || "O texto digitado aparecerá aqui para os usuários no sininho de notificações."}
                </p>
                {actionUrl.trim() && (
                  <div className="flex items-center gap-1 text-[10px] text-primary-strong pt-1">
                    <ExternalLink className="size-3" aria-hidden="true" />
                    <span className="truncate">{actionUrl.trim()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de Comunicados Enviados */}
      <section aria-label="Histórico de Comunicados" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BellRing className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-bold text-foreground">Histórico de Mensagens Enviadas</h2>
          </div>
          <Badge variant="muted" size="xs">
            {broadcasts.length} disparos
          </Badge>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
          {broadcastsQuery.isLoading ? (
            <div className="p-6 flex flex-col gap-3">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="Nenhum comunicado enviado"
                description="Use o formulário acima para disparar seu primeiro aviso a todos ou parte dos usuários."
              />
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {broadcasts.map((b) => (
                <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-hover/20 transition-colors">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">{b.title}</span>
                      <Badge variant="muted" size="xs" className="font-mono">
                        {b.target_audience === "all" ? "Todos" : b.target_audience === "pro" ? "Pro" : "Free"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                      {b.message}
                    </p>
                    {b.action_url && (
                      <span className="text-[10px] text-primary-strong font-mono mt-1">
                        Ação: {b.action_url}
                      </span>
                    )}
                  </div>

                  <div className="shrink-0 text-right text-xs text-muted-foreground font-mono">
                    {new Date(b.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
