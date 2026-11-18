import { useEffect, useRef, useState } from "react";
import { Clock, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui";
import { useSignOut } from "@/hooks/use-sign-out";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useUserAccess } from "@/state";

export function PendingApprovalPage() {
  const { profile, refetch, isActive } = useUserAccess();
  const { signOut } = useSignOut();
  const [checking, setChecking] = useState(false);

  // Evita leitura obsoleta da closure após `await refetch()` (AUDITORIA_UI_UX M8)
  const isActiveRef = useRef(isActive);

  useEffect(() => {
    isActiveRef.current = isActive;
    if (isActive) {
      triggerSensory("success");
      window.location.href = "/";
    }
  }, [isActive]);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await refetch();
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (isActiveRef.current) {
        triggerSensory("success");
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
    <div
      className="flex min-h-dvh w-full flex-col items-center justify-center p-4 bg-background text-foreground pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
    >
      <div className="w-full max-w-md flex justify-end mb-2.5">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-md flex-col items-center text-center gap-6 rounded-2xl border border-border/80 bg-surface p-6 sm:p-8 shadow-xs">
        <div className="flex size-12 sm:size-14 items-center justify-center rounded-2xl bg-warning/15 border border-warning/20 text-warning-strong">
          <Clock className="size-6 sm:size-7" aria-hidden="true" />
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
          <div className="w-full rounded-xl bg-surface-raised/60 p-3 flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground">
            <ShieldAlert className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="truncate">{profile.email}</span>
          </div>
        ) : null}

        <div className="flex w-full flex-col gap-2.5 pt-2">
          <Button
            type="button"
            variant="solid"
            onClick={() => {
              void handleCheck();
            }}
            disabled={checking}
            className="w-full gap-2"
          >
            <RefreshCw className={`size-4 ${checking ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>Verificar Aprovação</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => void signOut()}
            className="w-full gap-2"
          >
            <LogOut className="size-4" aria-hidden="true" />
            <span>Sair da Conta</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
