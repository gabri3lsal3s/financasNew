import { PageHeader } from "@/components/layout";
import { InvitesTab } from "./invites-tab";

export function AdminInvitesPage() {
  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <PageHeader
        title="Convites & Allowlist"
        description="Tokens de acesso antecipado, cotas e planos"
      />

      <InvitesTab />
    </div>
  );
}
