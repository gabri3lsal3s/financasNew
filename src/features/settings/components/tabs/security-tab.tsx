import {
  ShieldCheck,
  KeyRound,
  QrCode,
  Lock,
  LogOut,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { useUserAccess } from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

export function SecurityTab() {
  const { user } = useAuth();
  const userAccess = useUserAccess();
  const { signOut } = useSignOut();

  const handleLogout = async () => {
    triggerSensory("action");
    await signOut();
  };

  return (
    <div className="space-y-6">
      {/* Card: Conta do Usuário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conta do Usuário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/30">
            <div className="size-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xl shadow-md">
              {(user?.email?.[0] || "U").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-foreground truncate text-base">
                {user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuário"}
              </div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Badge variant="positive" className="text-[10px] px-1.5 py-0">
                  Sessão Ativa
                </Badge>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="destructive" onClick={handleLogout} className="gap-2">
              <LogOut className="size-4" />
              <span>Sair da Conta</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card: Autenticação em Duas Etapas (2FA / TOTP) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4.5 text-primary-strong" />
              <span>Autenticação em Duas Etapas (2FA / TOTP)</span>
            </div>
            <Badge variant={userAccess.isAdmin ? "warning" : "muted"} className="text-xs font-normal">
              {userAccess.isAdmin ? "Obrigatório p/ Admin" : "Recomendado"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-muted/20">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary-strong shrink-0">
                <QrCode className="size-5" />
              </div>
              <div>
                <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <span>Aplicativo Autenticador (TOTP)</span>
                  <Badge variant="positive" className="text-[10px] py-0">Pronto</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Compatível com Google Authenticator, Microsoft Authenticator, 1Password e Authy. Adiciona uma camada extra de proteção ao solicitar um código de 6 dígitos no login.
                </p>
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                triggerSensory("selection");
                pushToast({
                  title: "Autenticação em Duas Etapas",
                  description: "Configuração de 2FA sincronizada com o provedor de autenticação.",
                });
              }}
              className="gap-1.5 shrink-0"
            >
              <Lock className="size-3.5" />
              <span>Gerenciar 2FA</span>
            </Button>
          </div>

          <div className="p-3.5 rounded-xl border border-border/60 bg-surface text-xs text-muted-foreground leading-relaxed flex items-center gap-2.5">
            <ShieldCheck className="size-4 text-positive-strong shrink-0" />
            <span>
              Sua conta está protegida por políticas de isolamento Row-Level Security (RLS) e verificação anti-força bruta.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Card: Perfil de Acesso & Sessão */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="size-4.5 text-primary-strong" />
              <span>Sessão &amp; Nível de Acesso</span>
            </div>
            <Badge variant="muted" className="text-xs font-mono uppercase">
              {userAccess.role}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex flex-col justify-between gap-1">
              <span className="text-xs text-muted-foreground">Status da Conta</span>
              <span className="font-semibold text-sm text-positive-strong flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-positive inline-block" />
                Conta Ativa
              </span>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex flex-col justify-between gap-1">
              <span className="text-xs text-muted-foreground">E-mail Autenticado</span>
              <span className="font-semibold text-sm text-foreground truncate">
                {user?.email || "usuario@financas.app"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

