import { useState } from "react";
import { Clock } from "lucide-react";
import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Select,
  type SelectOption,
} from "@/components/ui";
import {
  getIdleLogoutPolicy,
  isSharedDeviceSession,
  setIdleLogoutPolicy,
  type IdleLogoutPolicy,
} from "@/services/session-policy";
import { pushToast } from "@/services/toast";

const IDLE_POLICY_OPTIONS: SelectOption[] = [
  { value: "never", label: "Manter conectado (Recomendado)" },
  { value: "15m", label: "15 minutos" },
  { value: "30m", label: "30 minutos" },
  { value: "60m", label: "1 hora" },
  { value: "240m", label: "4 horas" },
];

export interface SessionInactivityCardProps {
  userId?: string | null;
}

export function SessionInactivityCard({ userId }: SessionInactivityCardProps) {
  const [policy, setPolicy] = useState<IdleLogoutPolicy>(() =>
    getIdleLogoutPolicy(userId),
  );
  const sharedModeActive = isSharedDeviceSession();

  const handlePolicyChange = (val: string) => {
    const nextPolicy = val as IdleLogoutPolicy;
    setPolicy(nextPolicy);
    setIdleLogoutPolicy(nextPolicy, userId);
    pushToast({
      title:
        nextPolicy === "never"
          ? "Sessão contínua ativada"
          : "Encerramento por inatividade atualizado",
      description:
        nextPolicy === "never"
          ? "Este dispositivo permanecerá conectado até você sair manualmente."
          : "Você receberá um aviso de 60 segundos antes de encerrar a sessão.",
      variant: "default",
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>Sessão e Inatividade neste Navegador</span>
          </CardTitle>
          <div className="shrink-0 self-start sm:self-auto">
            <Badge variant={sharedModeActive || policy !== "never" ? "default" : "muted"} size="xs">
              {sharedModeActive
                ? "Computador Compartilhado (30m)"
                : policy === "never"
                  ? "Manter Conectado"
                  : `Sair após ${policy}`}
            </Badge>
          </div>
        </div>
        <CardDescription>
          Defina se este navegador deve encerrar a sessão automaticamente após ficar sem uso. Para proteger apenas a tela sem sair da conta, use o bloqueio por PIN acima.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sharedModeActive ? (
          <Alert variant="info" className="text-xs">
            Modo computador compartilhado ativo nesta sessão: o encerramento automático após 30 minutos sem uso está habilitado até você sair.
          </Alert>
        ) : null}

        <div className="rounded-xl bg-surface-raised/60 p-4">
          <FormField
            label="Encerrar sessão automaticamente por inatividade"
            htmlFor="session-inactivity-policy"
            helperText="Recomendamos 'Manter conectado' em dispositivos pessoais e um tempo menor em computadores compartilhados."
          >
            <Select
              id="session-inactivity-policy"
              value={policy}
              onValueChange={handlePolicyChange}
              options={IDLE_POLICY_OPTIONS}
              ariaLabel="Selecione a política de inatividade da sessão"
            />
          </FormField>
        </div>
      </CardContent>
    </Card>
  );
}
