import { InvitesTab } from "./invites-tab";

export function AdminInvitesPage() {
  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Convites &amp; Allowlist de Acesso
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Geração de tokens de acesso antecipado, cotas e pré-atribuição de planos
        </p>
      </div>

      <InvitesTab />
    </div>
  );
}
