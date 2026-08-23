import { Ban, LogOut } from "lucide-react";
import { Button } from "@/components/ui";
import { useUserAccess } from "@/state";
import { useSignOut } from "@/hooks/use-sign-out";

export function SuspendedAccountPage() {
  const { profile, isBanned } = useUserAccess();
  const { signOut } = useSignOut();

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-background text-foreground">
      <div className="flex w-full max-w-md flex-col items-center text-center gap-6 rounded-3xl border border-critical/30 bg-surface p-6 sm:p-8 shadow-sm">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-critical/10 border border-critical/20 text-critical">
          <Ban className="size-7" aria-hidden="true" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground">
            {isBanned ? "Conta Banida" : "Acesso Suspenso"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {isBanned
              ? "Sua conta foi permanentemente desativada pela administração da plataforma."
              : "O acesso à sua conta foi temporariamente suspenso pela administração."}
          </p>
        </div>

        {profile?.suspended_reason ? (
          <div className="w-full rounded-xl border border-critical/20 bg-critical/5 p-3.5 flex flex-col gap-1 text-left">
            <span className="text-[11px] font-bold uppercase tracking-wider text-critical">Motivo informado</span>
            <p className="text-xs text-foreground/90">{profile.suspended_reason}</p>
          </div>
        ) : null}

        <div className="flex w-full flex-col gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void signOut()}
            className="w-full gap-2"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Desconectar
          </Button>
        </div>
      </div>
    </div>
  );
}
