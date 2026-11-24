import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { getActiveUserMfaFactor } from "@/hooks/use-auth";

export interface TwoFactorCardProps {
  onOpenMfaModal: () => void;
  refreshKey?: number;
}

export function TwoFactorCard({ onOpenMfaModal, refreshKey = 0 }: TwoFactorCardProps) {
  const [hasMfa, setHasMfa] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getActiveUserMfaFactor()
      .then((factor) => {
        if (!cancelled) {
          setHasMfa(Boolean(factor));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasMfa(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>Verificação em Duas Etapas (2FA)</span>
          </CardTitle>
          {hasMfa !== null ? (
            <div className="shrink-0 self-start sm:self-auto">
              <Badge variant={hasMfa ? "default" : "muted"} size="xs">
                {hasMfa ? "Ativo" : "Desativado"}
              </Badge>
            </div>
          ) : null}
        </div>
        <CardDescription>
          Adicione uma camada extra de proteção exigindo um código de 6 dígitos do aplicativo autenticador ao entrar em novos dispositivos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-surface-raised/60 p-4">
          <div className="space-y-0.5 min-w-0">
            <span className="text-xs font-semibold text-foreground block">
              Autenticador TOTP (Google Authenticator, 1Password)
            </span>
            <span className="text-[11px] text-muted-foreground block">
              {hasMfa
                ? "Sua conta exige verificação em duas etapas no login."
                : "Proteja sua conta ativando a verificação em duas etapas."}
            </span>
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onOpenMfaModal}
            className="shrink-0 gap-1.5 self-start sm:self-auto"
          >
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            <span>Gerenciar 2FA</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
