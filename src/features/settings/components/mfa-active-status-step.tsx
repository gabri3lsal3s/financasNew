import { Smartphone } from "lucide-react";
import { Badge } from "@/components/ui";

/**
 * Etapa de exibição do status ativo de proteção 2FA via App Autenticador.
 */
export function MfaActiveStatusStep() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border/80 bg-surface-raised">
        <Smartphone className="size-4.5 shrink-0 text-primary-strong" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">App Autenticador</span>
            <Badge variant="default" size="xs">
              Ativo
            </Badge>
          </div>
          <span className="text-[11px] text-muted-foreground block">
            Google Authenticator, Microsoft Authenticator, 1Password ou Authy
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Sua conta está configurada com proteção bancária de dois fatores. Ao fazer login, será
        solicitado um código temporário de 6 dígitos gerado pelo seu aplicativo autenticador.
      </p>
    </div>
  );
}
