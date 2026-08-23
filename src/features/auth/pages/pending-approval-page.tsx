import { useState } from "react";
import { Clock, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { useUserAccess } from "@/state";
import { useSignOut } from "@/hooks/use-sign-out";
import { pushToast } from "@/services/toast";

export function PendingApprovalPage() {
  const { profile, refetch, isActive } = useUserAccess();
  const { signOut } = useSignOut();
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await refetch();
      if (isActive) {
        window.location.href = "/";
      } else {
        pushToast({
          title: "Status mantido",
          description: "Sua conta ainda está na fila de aprovação da administração.",
          variant: "info",
        });
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-background text-foreground">
      <div className="flex w-full max-w-md flex-col items-center text-center gap-6 rounded-3xl border border-border/80 bg-surface p-6 sm:p-8 shadow-sm">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-warning/10 border border-warning/20 text-warning">
          <Clock className="size-7" aria-hidden="true" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground">
            Cadastro em Análise
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Seu cadastro foi realizado com sucesso e está aguardando liberação de acesso por um administrador.
          </p>
        </div>

        {profile?.email ? (
          <div className="w-full rounded-xl border border-border/80 bg-surface-hover/30 p-3 flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground">
            <ShieldAlert className="size-4 text-warning" aria-hidden="true" />
            <span>{profile.email}</span>
          </div>
        ) : null}

        <div className="flex w-full flex-col gap-2.5 pt-2">
          <Button
            type="button"
            variant="default"
            onClick={handleCheck}
            disabled={checking}
            className="w-full gap-2"
          >
            <RefreshCw className={`size-4 ${checking ? "animate-spin" : ""}`} aria-hidden="true" />
            Verificar Aprovação
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => void signOut()}
            className="w-full gap-2"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sair da Conta
          </Button>
        </div>
      </div>
    </div>
  );
}
