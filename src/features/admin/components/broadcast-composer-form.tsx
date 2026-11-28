import { useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, ExternalLink, Info, Megaphone, Radio, Send, Sparkles, Terminal } from "lucide-react";
import { Badge, Button, ConfirmDialog, FormField, Input, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
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

type ExpirationPreset = "none" | "7d" | "14d" | "30d";

const EXPIRATION_OPTIONS: { value: ExpirationPreset; label: string }[] = [
  { value: "none", label: "Sem expiração" },
  { value: "7d", label: "Expira em 7 dias" },
  { value: "14d", label: "Expira em 14 dias" },
  { value: "30d", label: "Expira em 30 dias" },
];

const PREVIEW_STYLE_BY_TYPE: Record<
  BroadcastType,
  {
    container: string;
    iconTone: string;
    badgeVariant: "default" | "warning" | "critical" | "portfolio" | "muted";
    badgeLabel: string;
    Icon: typeof Megaphone;
  }
> = {
  info: {
    container: "border-primary/20 bg-primary/5",
    iconTone: "text-primary-strong",
    badgeVariant: "default",
    badgeLabel: "Comunicado",
    Icon: Info,
  },
  system: {
    container: "border-border/80 bg-surface-hover/40",
    iconTone: "text-muted-foreground",
    badgeVariant: "muted",
    badgeLabel: "Sistema",
    Icon: Terminal,
  },
  warning: {
    container: "border-warning/30 bg-warning/10",
    iconTone: "text-warning-strong",
    badgeVariant: "warning",
    badgeLabel: "Atenção",
    Icon: AlertTriangle,
  },
  critical: {
    container: "border-critical/30 bg-critical/10",
    iconTone: "text-critical-strong",
    badgeVariant: "critical",
    badgeLabel: "Urgente",
    Icon: AlertTriangle,
  },
  promotion: {
    container: "border-portfolio/30 bg-portfolio/10",
    iconTone: "text-portfolio",
    badgeVariant: "portfolio",
    badgeLabel: "Novidade",
    Icon: Sparkles,
  },
};

function resolveExpiresAtIso(preset: ExpirationPreset): string | null {
  if (preset === "none") return null;
  const days = preset === "7d" ? 7 : preset === "14d" ? 14 : 30;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function validateActionUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//")) {
      return "Caminhos relativos não podem começar com '//'.";
    }
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") {
      return "Use um caminho interno (ex: /configuracoes) ou uma URL HTTPS.";
    }
    return null;
  } catch {
    return "Informe um caminho interno começando com '/' ou uma URL HTTPS válida.";
  }
}

export interface BroadcastComposerFormProps {
  isPending: boolean;
  onSubmit: (payload: {
    title: string;
    message: string;
    type: BroadcastType;
    actionUrl: string | null;
    targetAudience: BroadcastAudience;
    expiresAt: string | null;
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
  const [actionUrlError, setActionUrlError] = useState<string | null>(null);
  const [targetAudience, setTargetAudience] = useState<BroadcastAudience>("all");
  const [expirationPreset, setExpirationPreset] = useState<ExpirationPreset>("none");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const previewMeta = PREVIEW_STYLE_BY_TYPE[type];
  const PreviewIcon = previewMeta.Icon;
  const selectedTypeLabel = BROADCAST_TYPES.find((t) => t.value === type)?.label ?? type;
  const selectedAudienceLabel =
    AUDIENCE_OPTIONS.find((a) => a.value === targetAudience)?.label ?? targetAudience;
  const selectedExpirationLabel =
    EXPIRATION_OPTIONS.find((e) => e.value === expirationPreset)?.label ?? "Sem expiração";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    const urlValidationError = validateActionUrl(actionUrl);
    if (urlValidationError) {
      setActionUrlError(urlValidationError);
      return;
    }
    setActionUrlError(null);
    setConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    try {
      await onSubmit({
        title: title.trim(),
        message: message.trim(),
        type,
        actionUrl: actionUrl.trim() || null,
        targetAudience,
        expiresAt: resolveExpiresAtIso(expirationPreset),
      });
      setConfirmOpen(false);
      setTitle("");
      setMessage("");
      setActionUrl("");
      setActionUrlError(null);
      setExpirationPreset("none");
    } catch {
      // Erro já notificado via toast pela mutation; preserva os campos preenchidos
      setConfirmOpen(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Megaphone className="size-4 text-muted-foreground" aria-hidden="true" />
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label="Expiração" htmlFor="broadcast-expiration">
                <Select
                  id="broadcast-expiration"
                  ariaLabel="Expiração do comunicado"
                  value={expirationPreset}
                  onValueChange={(val) => setExpirationPreset(val as ExpirationPreset)}
                  options={EXPIRATION_OPTIONS}
                />
              </FormField>

              <FormField
                label="Link de Ação Rápida"
                htmlFor="broadcast-action"
                optional
                error={actionUrlError ?? undefined}
              >
                <Input
                  id="broadcast-action"
                  value={actionUrl}
                  onChange={(e) => {
                    setActionUrl(e.target.value);
                    if (actionUrlError) setActionUrlError(null);
                  }}
                  placeholder="Ex: /ferramentas ou https://..."
                />
              </FormField>
            </div>

            <Button
              type="submit"
              variant="default"
              loading={isPending}
              disabled={isPending || !title.trim() || !message.trim()}
              className="mt-1"
            >
              <Send aria-hidden="true" />
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
            Como a mensagem aparecerá no popover de notificações ({selectedAudienceLabel}):
          </p>

          <div className={cn("rounded-xl border p-3.5 flex items-start gap-3 mt-1", previewMeta.container)}>
            <PreviewIcon className={cn("size-4 shrink-0 mt-0.5", previewMeta.iconTone)} aria-hidden="true" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-foreground line-clamp-2 break-words">
                  {title.trim() || "Título do Comunicado"}
                </span>
                <Badge variant={previewMeta.badgeVariant} size="xs" className="shrink-0">
                  {previewMeta.badgeLabel}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
                {message.trim() ||
                  "O texto digitado aparecerá aqui para os usuários no sininho de notificações."}
              </p>
              {actionUrl.trim() && (
                <div className="flex items-center gap-1 text-[11px] text-primary-strong pt-1">
                  <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{actionUrl.trim()}</span>
                </div>
              )}
              {expirationPreset !== "none" ? (
                <p className="text-[11px] text-muted-foreground pt-0.5">{selectedExpirationLabel}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmar disparo de comunicado"
        description="Este comunicado será exibido na Central de Notificações dos clientes selecionados."
        confirmLabel={isPending ? "Disparando…" : "Confirmar envio"}
        confirmPending={isPending}
        onConfirm={() => void handleConfirmSend()}
      >
        <div className="rounded-xl border border-border/80 bg-surface-hover/40 p-3 text-xs space-y-1.5">
          <div>
            <span className="font-semibold text-foreground">Título:</span>{" "}
            <span className="text-muted-foreground">{title.trim()}</span>
          </div>
          <div>
            <span className="font-semibold text-foreground">Categoria:</span>{" "}
            <span className="text-muted-foreground">{selectedTypeLabel}</span>
          </div>
          <div>
            <span className="font-semibold text-foreground">Público:</span>{" "}
            <span className="text-muted-foreground">{selectedAudienceLabel}</span>
          </div>
          <div>
            <span className="font-semibold text-foreground">Validade:</span>{" "}
            <span className="text-muted-foreground">{selectedExpirationLabel}</span>
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
