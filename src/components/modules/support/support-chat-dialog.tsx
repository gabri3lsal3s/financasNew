import { useState } from "react";
import { useLocation } from "react-router";
import { Bug, HelpCircle, Lightbulb, Loader2, Send } from "lucide-react";
import { Button, FormField, Input, Modal, ModalFooter, Tabs, Textarea, type TabItem } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { collectDeviceDiagnostics } from "@/services/diagnostics";
import { AXIR_APP_VERSION } from "@/services/native/app-links";
import { useCreateSupportTicketMutation } from "@/state";
import type { SupportTicketType } from "@/types";

export interface SupportChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: SupportTicketType;
  initialMessage?: string;
  currentRoute?: string;
  onSuccess?: () => void;
}

const MAX_MESSAGE_LENGTH = 1000;
const MIN_MESSAGE_LENGTH = 5;

const TAB_ITEMS: TabItem[] = [
  { value: "doubt", label: "Dúvida", icon: <HelpCircle className="size-4 shrink-0" aria-hidden="true" /> },
  { value: "bug", label: "Problema (Bug)", icon: <Bug className="size-4 shrink-0" aria-hidden="true" /> },
  { value: "suggestion", label: "Sugestão", icon: <Lightbulb className="size-4 shrink-0" aria-hidden="true" /> },
];

const PLACEHOLDERS: Record<SupportTicketType, { subject: string; message: string }> = {
  bug: { subject: "Ex: Erro ao cadastrar ativo na carteira", message: "Conte o que aconteceu e os passos para reproduzir o problema..." },
  suggestion: { subject: "Ex: Sugestão de novo relatório", message: "Compartilhe sua ideia para tornar o Axir ainda melhor..." },
  doubt: { subject: "Ex: Como funciona o rebalanceamento", message: "Escreva sua dúvida sobre o uso do aplicativo..." },
  other: { subject: "Ex: Solicitação de atendimento", message: "Escreva os detalhes da sua solicitação..." },
};

function useSafeLocationPath(overrideRoute?: string): string {
  try {
    return useLocation().pathname;
  } catch {
    if (overrideRoute) return overrideRoute;
    return typeof window !== "undefined" && window.location?.pathname ? window.location.pathname : "/";
  }
}

/** Diálogo de suporte direto e reporte de bugs/sugestões com diagnóstico tipado. */
export function SupportChatDialog({
  open,
  onOpenChange,
  defaultType = "doubt",
  initialMessage = "",
  currentRoute,
  onSuccess,
}: SupportChatDialogProps) {
  const activeRoute = useSafeLocationPath(currentRoute);
  const { user } = useAuth();
  const createMutation = useCreateSupportTicketMutation();
  const [type, setType] = useState<SupportTicketType>(defaultType);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [prevKey, setPrevKey] = useState(`${open}:${defaultType}:${initialMessage}`);

  const currentKey = `${open}:${defaultType}:${initialMessage}`;
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    if (open) {
      setType(defaultType);
      setSubject("");
      setMessage(initialMessage);
      setValidationError(null);
    }
  }

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length > MAX_MESSAGE_LENGTH) return;
    setMessage(val);
    if (validationError && val.trim().length >= MIN_MESSAGE_LENGTH) setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < MIN_MESSAGE_LENGTH) {
      setValidationError(`Por favor, descreva sua mensagem com pelo menos ${MIN_MESSAGE_LENGTH} caracteres.`);
      return;
    }
    try {
      const userName = (user?.user_metadata?.name as string | undefined) || user?.email?.split("@")[0] || null;
      await createMutation.mutateAsync({
        type,
        subject: subject.trim() || null,
        message: trimmed,
        user_name: userName,
        user_email: user?.email || null,
        current_route: activeRoute,
        app_version: AXIR_APP_VERSION,
        device_info: collectDeviceDiagnostics(),
      });
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Erro tratado pelo hook de mutação
    }
  };

  const isSubmitting = createMutation.isPending;
  const remainingChars = MAX_MESSAGE_LENGTH - message.length;
  const placeholders = PLACEHOLDERS[type] ?? PLACEHOLDERS.doubt;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Falar com o Suporte"
      description="Envie sua dúvida, sugestão ou relate um problema para atendimento direto com nossa equipe."
      size="md"
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="support-chat-form" variant="default" sensoryIntent={false} disabled={isSubmitting || message.trim().length < MIN_MESSAGE_LENGTH} className="gap-2">
            {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
            <span>{isSubmitting ? "Enviando..." : "Enviar Mensagem"}</span>
          </Button>
        </ModalFooter>
      }
    >
      <form id="support-chat-form" onSubmit={handleSubmit} className="space-y-4 pt-1">
        <FormField label="Tipo de Atendimento" htmlFor="support-type-tabs">
          <Tabs value={type} onValueChange={(v) => setType(v as SupportTicketType)} items={TAB_ITEMS} variant="pills" fullWidth />
        </FormField>

        <FormField label="Assunto" optional htmlFor="support-subject">
          <Input id="support-subject" placeholder={placeholders.subject} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={isSubmitting} maxLength={100} className="text-base sm:text-sm" />
        </FormField>

        <div className="space-y-1.5">
          <Textarea id="support-message" label="Mensagem detalhada" placeholder={placeholders.message} value={message} onChange={handleMessageChange} disabled={isSubmitting} error={validationError ?? undefined} rows={5} className="resize-none" />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span>Mínimo de {MIN_MESSAGE_LENGTH} caracteres</span>
            <span className={remainingChars < 50 ? "text-warning-strong font-medium" : ""}>{message.length} / {MAX_MESSAGE_LENGTH}</span>
          </div>
        </div>
      </form>
    </Modal>
  );
}
