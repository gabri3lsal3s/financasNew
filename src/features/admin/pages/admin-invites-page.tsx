import { PageHeader } from "@/components/layout";
import { AdminPageGuide } from "../components/admin-help-tip";
import { InvitesTab } from "./invites-tab";

export function AdminInvitesPage() {
  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <PageHeader
        utilityActions={<AdminPageGuide page="invites" />}
        title="Convites"
        description="Acessos, cotas e planos"
      />

      <InvitesTab />
    </div>
  );
}
