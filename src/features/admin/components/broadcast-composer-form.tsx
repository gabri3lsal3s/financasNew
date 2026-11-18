import { useState } from "react";
import type { FormEvent } from "react";
import { ExternalLink, Megaphone, Radio, Send } from "lucide-react";
import { Badge, Button, FormField, Input, Select, Textarea } from "@/components/ui";
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

export interface BroadcastComposerFormProps {
  isPending: boolean;
  onSubmit: (payload: {
    title: string;
    message: string;
    type: BroadcastType;
    actionUrl: string | null;
    targetAudience: BroadcastAudience;
  }) => Promise<void>;
}

/**
 * Formulário de composição e pré-visualização em tempo real de comunicados broadcast.
 */
export function BroadcastComposerForm({ isPending, onSubmit }: BroadcastComposerFormProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<BroadcastType>("info");
  const [actionUrl, setActionUrl] = useState("");
  const [targetAudience, setTargetAudience] = useState<BroadcastAudience>("all");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    await onSubmit({
      title: title.trim(),
      message: message.trim(),
      type,
      actionUrl: actionUrl.trim() || null,
      targetAudience,
    });
    setTitle("");
    setMessage("");
    setActionUrl("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Megaphone className="size-4 text-primary-strong" aria-hidden="true" />
            <h2 className="text-sm font-bold text-foreground">Compor Novo Comunicado</h2>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField label="Título da Notificação" htmlFor="broadcast-title" required>
              <Input
                id="broadcast-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Atualização disponível com novas ferramentas!"
                required
              />
            </FormField>

            <FormField label="Mensagem Detalhada" htmlFor="broadcast-message" required>
              <Textarea
                id="broadcast-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite o conteúdo que será lido pelos clientes no sininho do app…"
                rows={3}
                required
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label="Categoria do Aviso" htmlFor="broadcast-type">
                <Select
                  id="broadcast-type"
                  ariaLabel="Categoria do Aviso"
                  value={type}
                  onValueChange={(val) => setType(val as BroadcastType)}
                  options={BROADCAST_TYPES}
                />
              </FormField>

              <FormField label="Público-Alvo" htmlFor="broadcast-audience">
                <Select
                  id="broadcast-audience"
                  ariaLabel="Público-Alvo"
                  value={targetAudience}
                  onValueChange={(val) => setTargetAudience(val as BroadcastAudience)}
                  options={AUDIENCE_OPTIONS}
                />
              </FormField>
            </div>

            <FormField label="Link de Ação Rápida" htmlFor="broadcast-action" optional>
              <Input
                id="broadcast-action"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="Ex: /ferramentas ou /configuracoes"
              />
            </FormField>

            <Button
              type="submit"
              variant="default"
              loading={isPending}
              disabled={isPending || !title.trim() || !message.trim()}
              className="mt-1 gap-2"
            >
              <Send className="size-4" aria-hidden="true" />
              <span>{isPending ? "Disparando comunicado…" : "Enviar Notificação aos Clientes"}</span>
            </Button>
          </form>
        </div>
      </div>

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
            <Megaphone className="size-4 text-primary-strong shrink-0 mt-0.5" aria-hidden="true" />
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
                {message.trim() ||
                  "O texto digitado aparecerá aqui para os usuários no sininho de notificações."}
              </p>
              {actionUrl.trim() && (
                <div className="flex items-center gap-1 text-[10px] text-primary-strong pt-1">
                  <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{actionUrl.trim()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
