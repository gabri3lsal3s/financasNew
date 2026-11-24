import { Link } from "react-router";
import { ArrowRight, Laptop, LogOut, ShieldCheck, Smartphone } from "lucide-react";
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
  onOpenSignOutModal: () => void;
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

export function AccountSessionsCard({ onOpenSignOutModal }: AccountSessionsCardProps) {
  const { isMobile, label } = resolveDevicePlatformLabel();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Sessão neste Dispositivo</span>
        </CardTitle>
        <CardDescription>
          Encerre sua sessão neste aparelho ou gerencie bloqueio, 2FA e dispositivos conectados na aba de Segurança.
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
                <Badge variant="default" size="xs">
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

        <div className="flex items-center justify-end">
          <Link
            to="/configuracoes?tab=security"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-strong hover:text-primary hover:underline transition-colors"
          >
            <span>Configurar bloqueio, 2FA e outros aparelhos</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
