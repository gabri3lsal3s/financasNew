import { KeyRound, Laptop, Loader2, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

export interface AccountSessionsCardProps {
  isSigningOutOthers: boolean;
  onOpenSignOutModal: () => void;
  onSignOutOthers: () => void;
  onOpenMfaModal: () => void;
}

function resolveDevicePlatformLabel(): { isMobile: boolean; label: string } {
  if (typeof navigator === "undefined") {
    return { isMobile: false, label: "Terminal de Acesso" };
  }
  const ua = navigator.userAgent;
  const isMobile = /mobile|android|iphone/i.test(ua);
  const label = ua.includes("Android")
    ? "Aplicativo Android / Mobile"
    : ua.includes("iPhone")
      ? "Navegador iOS Safari"
      : "Navegador Web / Desktop";
  return { isMobile, label };
}

export function AccountSessionsCard({
  isSigningOutOthers,
  onOpenSignOutModal,
  onSignOutOthers,
  onOpenMfaModal,
}: AccountSessionsCardProps) {
  const { isMobile, label } = resolveDevicePlatformLabel();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Segurança de Acesso &amp; Sessões</span>
        </CardTitle>
        <CardDescription>
          Monitore dispositivos conectados, encerre outros acessos ativos e configure proteção em duas etapas (2FA).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl bg-surface-raised/60">
          <div className="flex items-start gap-3 min-w-0">
            {isMobile ? (
              <Smartphone className="size-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : (
              <Laptop className="size-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground">
                  Este Dispositivo
                </span>
                <Badge variant="positive" size="xs">
                  Sessão Ativa
                </Badge>
              </div>
              <span className="text-[11px] text-muted-foreground block font-mono">
                {label}
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSignOutModal}
            className="shrink-0 gap-1.5 self-start sm:self-auto"
          >
            <LogOut className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Sair deste aparelho</span>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl bg-surface-raised/60">
          <div className="space-y-0.5 min-w-0">
            <span className="text-xs font-semibold text-foreground block">
              Encerrar outras sessões ativas
            </span>
            <span className="text-[11px] text-muted-foreground block">
              Desconecta imediatamente seu usuário em outros computadores, celulares ou navegadores conectados.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            sensoryIntent={false}
            disabled={isSigningOutOthers}
            onClick={onSignOutOthers}
            className="shrink-0 gap-1.5 self-start sm:self-auto"
          >
            {isSigningOutOthers ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                <span>Encerrando…</span>
              </>
            ) : (
              <>
                <KeyRound className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Desconectar outros aparelhos</span>
              </>
            )}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl bg-surface-raised/60">
          <div className="space-y-0.5 min-w-0">
            <span className="text-xs font-semibold text-foreground block">
              Verificação em Duas Etapas (2FA / TOTP)
            </span>
            <span className="text-[11px] text-muted-foreground block">
              Exige um código numérico temporário de 6 dígitos do Google Authenticator ou 1Password no login.
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
