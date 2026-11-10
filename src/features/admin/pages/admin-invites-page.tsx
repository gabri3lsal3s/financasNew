import { PageHeader } from "@/components/layout";
import { InvitesTab } from "./invites-tab";

export function AdminInvitesPage() {
  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <PageHeader
        title="Convites & Allowlist de Acesso"
        description="Geração de tokens de acesso antecipado, cotas e pré-atribuição de planos"
      />

      <InvitesTab />
    </div>
  );
}
