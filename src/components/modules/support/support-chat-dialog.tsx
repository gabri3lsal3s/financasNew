import { useState } from "react";
import { useLocation } from "react-router";
import { HelpCircle, Bug, Lightbulb, Send, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useCreateSupportTicketMutation } from "@/state";
import { isNativePlatform } from "@/services/native/platform";
import type { SupportTicketType } from "@/types";

export interface SupportChatDialogProps {
  /** Se o modal está aberto */
  open: boolean;
  /** Callback para alternar visibilidade */
  onOpenChange: (open: boolean) => void;
  /** Tipo inicial de chamado */
  defaultType?: SupportTicketType;
  /** Mensagem pré-preenchida (ex.: stacktrace em ErrorBoundary) */
  initialMessage?: string;
  /** Rota atual opcional para override ou ambientes fora do Router */
  currentRoute?: string;
  /** Callback opcional chamado após envio com sucesso */
  onSuccess?: () => void;
}

const MAX_MESSAGE_LENGTH = 1000;
const MIN_MESSAGE_LENGTH = 5;

/**
 * Resolve o path da rota de forma segura e resiliente, mesmo fora de um Router.
 */
function useSafeLocationPath(overrideRoute?: string): string {
  try {
    const location = useLocation();
    return location.pathname;
  } catch {
    if (overrideRoute) return overrideRoute;
    if (typeof window !== "undefined" && window.location?.pathname) {
      return window.location.pathname;
    }
    return "/";
  }
}

/**
 * Coleta metadados técnicos do ambiente do cliente de forma transparente.
 */
function collectClientDeviceInfo(): Record<string, unknown> {
  if (typeof window === "undefined") {
    return { platform: "unknown" };
  }

  const isPwa =
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Boolean((navigator as any).standalone);

  const isNative = isNativePlatform();

  return {
    platform: isNative ? "Android Nativo" : isPwa ? "PWA Instalado" : "Navegador Web",
    isNative,
    isPwa,
    screenResolution: `${window.innerWidth}x${window.innerHeight}`,
    locale: navigator.language || "pt-BR",
    userAgent: navigator.userAgent,
  };
}

interface SupportChatFormProps {
  defaultType: SupportTicketType;
  initialMessage: string;
  activeRoute: string;
  onClose: () => void;
  onSuccess?: () => void;
}

function SupportChatForm({
  defaultType,
  initialMessage,
  activeRoute,
  onClose,
  onSuccess,
}: SupportChatFormProps) {
  const { user } = useAuth();
  const createMutation = useCreateSupportTicketMutation();

  const [type, setType] = useState<SupportTicketType>(defaultType);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [validationError, setValidationError] = useState<string | null>(null);

  const tabItems: TabItem[] = [
    {
      value: "doubt",
      label: "Dúvida",
      icon: <HelpCircle className="size-4 shrink-0" aria-hidden="true" />,
    },
    {
      value: "bug",
      label: "Problema (Bug)",
      icon: <Bug className="size-4 shrink-0" aria-hidden="true" />,
    },
    {
      value: "suggestion",
      label: "Sugestão",
      icon: <Lightbulb className="size-4 shrink-0" aria-hidden="true" />,
    },
  ];

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_MESSAGE_LENGTH) {
      setMessage(val);
      if (validationError && val.trim().length >= MIN_MESSAGE_LENGTH) {
        setValidationError(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = message.trim();
    if (trimmed.length < MIN_MESSAGE_LENGTH) {
      setValidationError(`Por favor, descreva sua mensagem com pelo menos ${MIN_MESSAGE_LENGTH} caracteres.`);
      return;
    }

    try {
      const deviceInfo = collectClientDeviceInfo();
      const userName = (user?.user_metadata?.name as string | undefined) || user?.email?.split("@")[0] || null;
      const userEmail = user?.email || null;

      await createMutation.mutateAsync({
        type,
        subject: subject.trim() || null,
        message: trimmed,
        user_name: userName,
        user_email: userEmail,
        current_route: activeRoute,
        app_version: "1.0.0",
        device_info: deviceInfo,
      });

      onClose();
      onSuccess?.();
    } catch {
      // O erro já é tratado com toast destrutivo e sensory de erro no hook de mutação
    }
  };

  const isSubmitting = createMutation.isPending;
  const remainingChars = MAX_MESSAGE_LENGTH - message.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      {/* Seletor de Categoria com Abas Estilizadas */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground">
          Tipo de Atendimento
        </label>
        <Tabs
          value={type}
          onValueChange={(val) => setType(val as SupportTicketType)}
          items={tabItems}
          variant="pills"
          fullWidth
        />
      </div>

      {/* Assunto (Opcional) */}
      <div className="space-y-1.5">
        <label htmlFor="support-subject" className="text-xs font-semibold text-foreground">
          Assunto (opcional)
        </label>
        <Input
          id="support-subject"
          placeholder={
            type === "bug"
              ? "Ex: Erro ao cadastrar ativo na carteira"
              : type === "suggestion"
                ? "Ex: Sugestão de novo relatório"
                : "Ex: Como funciona o rebalanceamento"
          }
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={isSubmitting}
          maxLength={100}
        />
      </div>

      {/* Mensagem Principal com Contador */}
      <div className="space-y-1.5">
        <Textarea
          id="support-message"
          label="Mensagem detalhada"
          placeholder={
            type === "bug"
              ? "Conte o que aconteceu e os passos para reproduzir o problema..."
              : type === "suggestion"
                ? "Compartilhe sua ideia para tornar o Áxis Finance ainda melhor..."
                : "Escreva sua dúvida sobre o uso do aplicativo..."
          }
          value={message}
          onChange={handleMessageChange}
          disabled={isSubmitting}
          error={validationError ?? undefined}
          rows={5}
          className="resize-none"
        />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
          <span>Mínimo de {MIN_MESSAGE_LENGTH} caracteres</span>
          <span className={remainingChars < 50 ? "text-warning font-medium" : ""}>
            {message.length} / {MAX_MESSAGE_LENGTH}
          </span>
        </div>
      </div>

      {/* Rodapé Padronizado: Cancelar à esquerda, Enviar à direita */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-border/80">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isSubmitting}
          className="w-full sm:w-auto"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={isSubmitting || message.trim().length < MIN_MESSAGE_LENGTH}
          className="w-full sm:w-auto gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              <span>Enviando...</span>
            </>
          ) : (
            <>
              <Send className="size-4" aria-hidden="true" />
              <span>Enviar Mensagem</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

/**
 * Diálogo nativo e acessível de suporte direto e reporte de bugs/sugestões.
 * Captura metadados técnicos, formata mensagem e despacha notificação ao fundador.
 */
export function SupportChatDialog({
  open,
  onOpenChange,
  defaultType = "doubt",
  initialMessage = "",
  currentRoute,
  onSuccess,
}: SupportChatDialogProps) {
  const activeRoute = useSafeLocationPath(currentRoute);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Falar com o Suporte"
      description="Envie sua dúvida, sugestão ou relate um problema para atendimento direto com nossa equipe."
      size="md"
    >
      {open ? (
        <SupportChatForm
          key={`${defaultType}-${initialMessage}`}
          defaultType={defaultType}
          initialMessage={initialMessage}
          activeRoute={activeRoute}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      ) : null}
    </Modal>
  );
}
