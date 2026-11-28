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
import { Switch } from "@/components/ui/switch";
import {
  getActiveUserMfaFactor,
  updateMfaAdminOnlyPreference,
  useAuth,
} from "@/hooks/use-auth";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import { useUserAccess } from "@/state/queries/use-user-access";

export interface TwoFactorCardProps {
  onOpenMfaModal: () => void;
  refreshKey?: number;
  isAdmin?: boolean;
}

export function TwoFactorCard({
  onOpenMfaModal,
  refreshKey = 0,
  isAdmin: isAdminProp,
}: TwoFactorCardProps) {
  const { user, mfaAdminOnly = false } = useAuth();
  const { isAdmin: accessIsAdmin } = useUserAccess(user?.id);
  const isAdmin = isAdminProp ?? accessIsAdmin;
  const [hasMfa, setHasMfa] = useState<boolean | null>(null);
  const [isUpdatingAdminOnly, setIsUpdatingAdminOnly] = useState(false);

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

  const handleToggleAdminOnly = async (checked: boolean) => {
    setIsUpdatingAdminOnly(true);
    try {
      await updateMfaAdminOnlyPreference(checked);
      pushToast({
        title: checked
          ? "2FA restrito ao Console Administrativo"
          : "2FA exigido em todos os acessos",
        description: checked
          ? "O login pessoal entra direto com e-mail e senha; o código TOTP continua obrigatório em /admin."
          : "O código de verificação será solicitado no login pessoal e no Console Administrativo.",
        variant: "success",
      });
    } catch (error) {
      pushToast({
        title: "Não foi possível atualizar a preferência de 2FA",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsUpdatingAdminOnly(false);
    }
  };

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
      <CardContent className="space-y-3">
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

        {isAdmin && hasMfa ? (
          <div className="rounded-xl border border-border/80 bg-surface-raised/60 p-4">
            <Switch
              checked={Boolean(mfaAdminOnly)}
              disabled={isUpdatingAdminOnly}
              onCheckedChange={(checked) => {
                void handleToggleAdminOnly(checked);
              }}
              label="Exigir 2FA apenas no Console Administrativo"
              description="No login pessoal, você entra direto com e-mail e senha, mantendo a exigência de TOTP ao acessar /admin."
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
