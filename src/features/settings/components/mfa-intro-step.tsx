import { Smartphone } from "lucide-react";

/**
 * Etapa inicial de apresentação do 2FA quando nenhum fator TOTP está configurado.
 */
export function MfaIntroStep() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/80 bg-surface-raised">
        <Smartphone className="size-4.5 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <span className="text-xs font-semibold text-foreground block">
            Camada extra contra invasões
          </span>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Mesmo que sua senha seja descoberta, ninguém poderá acessar seus dados financeiros sem
            o código de segurança gerado no seu celular.
          </p>
        </div>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground block">Aplicativos compatíveis:</span>
        <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
          <li>Google Authenticator (Android e iOS)</li>
          <li>Microsoft Authenticator</li>
          <li>1Password / Bitwarden</li>
          <li>Authy</li>
        </ul>
      </div>
    </div>
  );
}
