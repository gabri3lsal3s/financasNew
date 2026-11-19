import { PageHeader } from "@/components/layout";
import { ForensicsDashboard } from "../components/forensics-dashboard";

export function AdminForensicsPage() {
  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <PageHeader
        title="Laboratório Forense de Auditoria"
        description="Auditoria quantitativa sintética e contínua de invariantes financeiras e integridade contábil"
      />

      <ForensicsDashboard />
    </div>
  );
}
