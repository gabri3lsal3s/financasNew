import { PageHeader } from "@/components/layout";
import { TicketsTab } from "./tickets-tab";

export function AdminTicketsPage() {
  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <PageHeader
        title="Chamados & Suporte"
        description="Fila de atendimento, prazos e notas internas"
      />

      <TicketsTab />
    </div>
  );
}
