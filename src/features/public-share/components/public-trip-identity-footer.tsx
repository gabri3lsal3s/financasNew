import { Link } from "react-router";
import { ArrowRight, LogIn, UserCheck } from "lucide-react";

export interface PublicTripIdentityFooterProps {
  isAuthenticated: boolean;
  loginRedirectUrl: string;
  onClaimAccount?: () => void;
}

/**
 * Rodapé compartilhado dos dois estados do `PublicTripIdentityBanner`,
 * evitando duplicação do bloco de login/vínculo de viagem (DRY).
 */
export function PublicTripIdentityFooter({
  isAuthenticated,
  loginRedirectUrl,
  onClaimAccount,
}: PublicTripIdentityFooterProps) {
  if (!isAuthenticated) {
    return (
      <div className="pt-2 border-t border-border/80">
        <Link
          to={loginRedirectUrl}
          className="group flex items-center justify-between min-h-11 p-2.5 rounded-xl bg-surface-raised border border-border/80 hover:bg-surface-hover hover:border-border transition-colors text-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <LogIn
              className="size-3.5 text-muted-foreground group-hover:text-primary-strong transition-colors shrink-0"
              aria-hidden="true"
            />
            <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors truncate">
              Já tem conta no Axir?{" "}
              <span className="font-semibold text-foreground underline decoration-border group-hover:decoration-primary">
                Entrar com minha conta Axir para sincronizar com meu extrato
              </span>
            </span>
          </div>
          <ArrowRight
            className="size-3 text-muted-foreground group-hover:text-primary-strong group-hover:translate-x-0.5 transition-all shrink-0 ml-2"
            aria-hidden="true"
          />
        </Link>
      </div>
    );
  }

  if (!onClaimAccount) {
    return null;
  }

  return (
    <div className="pt-2 border-t border-border/80">
      <button
        type="button"
        onClick={onClaimAccount}
        className="group flex w-full items-center justify-between min-h-11 p-2.5 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors text-xs cursor-pointer text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <UserCheck
            className="size-3.5 text-primary-strong shrink-0"
            aria-hidden="true"
          />
          <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors truncate">
            Conectado ao Axir.{" "}
            <span className="font-semibold text-foreground underline decoration-primary/40 group-hover:decoration-primary">
              Vincular esta viagem ao meu aplicativo Axir
            </span>
          </span>
        </div>
        <ArrowRight
          className="size-3 text-primary-strong group-hover:translate-x-0.5 transition-all shrink-0 ml-2"
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
